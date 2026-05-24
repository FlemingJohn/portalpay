/**
 * hooks/useFeed.js
 * Live transaction feed using native chain event subscription.
 *
 * Subscribes to system.events every block and filters for:
 *   balances.Transfer  — every POT transfer on the chain
 *   vesting.VestingCreated — when a locked payment is created (emitted via VestingUpdated)
 *   vesting.VestingCompleted — when a vesting schedule fully unlocks
 *
 * Event references from official docs:
 *   https://portaldot-dev.readthedocs.io/en/latest/module-interface/events/balances.html
 *     balances.Transfer(from: AccountId32, to: AccountId32, amount: u128)
 *
 *   https://portaldot-dev.readthedocs.io/en/latest/module-interface/events/vesting.html
 *     vesting.VestingUpdated(account: AccountId32, unvested: u128)
 *     vesting.VestingCompleted(account: AccountId32)
 *
 * HOW IT WORKS:
 *   api.query.system.events(callback) — fires on every new block
 *   Each block contains a Vec of EventRecord
 *   We check event.section + event.method to identify which pallet + event
 *   We optionally filter to only show events involving a specific address
 */

import { useState, useEffect, useCallback } from "react";
import { planckToPot } from "../lib/chain";
import { log } from "../lib/logger";

const MAX_FEED_ITEMS = 50; // keep last 50 events in memory

export function useFeed(api, filterAddress = null) {
  const [events,      setEvents]      = useState([]);
  const [currentBlock, setBlock]      = useState(null);
  const [listening,   setListening]   = useState(false);

  useEffect(() => {
    if (!api) return;

    let unsub = null;
    let mounted = true;

    (async () => {
      log.banner("PortalPay — Live Feed");
      log.step(1, "Subscribing to system.events");
      if (filterAddress) log.info("Filter address", filterAddress);

      setListening(true);

      // api.query.system.events — fires callback on every new block
      // This is the standard @polkadot/api subscription pattern
      unsub = await api.query.system.events((eventRecords) => {
        if (!mounted) return;

        // Get current block number
        api.rpc.chain.getHeader().then(header => {
          if (!mounted) return;
          const blockNum = header.number.toNumber();
          setBlock(blockNum);

          const newItems = [];

          eventRecords.forEach(({ event }) => {
            const { section, method, data } = event;

            // ── balances.Transfer ─────────────────────────────────────────
            // From: https://portaldot-dev.readthedocs.io/en/latest/module-interface/events/balances.html
            // Transfer(from: AccountId32, to: AccountId32, amount: u128)
            if (section === "balances" && method === "Transfer") {
              const from   = data[0].toString();
              const to     = data[1].toString();
              const amount = planckToPot(data[2].toString());

              // If filter is set, only show events involving that address
              if (filterAddress && from !== filterAddress && to !== filterAddress) return;

              newItems.push({
                id:        `${blockNum}-${section}-${method}-${from}-${to}`,
                type:      "transfer",
                section,
                method,
                block:     blockNum,
                from,
                to,
                amount,
                timestamp: Date.now(),
              });

              log.success(`Transfer: ${amount.toFixed(4)} POT  ${from.slice(0,6)}… → ${to.slice(0,6)}…`);
            }

            // ── vesting.VestingUpdated ────────────────────────────────────
            // From: https://portaldot-dev.readthedocs.io/en/latest/module-interface/events/vesting.html
            // VestingUpdated(account: AccountId32, unvested: u128)
            if (section === "vesting" && method === "VestingUpdated") {
              const account  = data[0].toString();
              const unvested = planckToPot(data[1].toString());

              if (filterAddress && account !== filterAddress) return;

              newItems.push({
                id:        `${blockNum}-vesting-updated-${account}`,
                type:      "vesting_updated",
                section,
                method,
                block:     blockNum,
                account,
                unvested,
                timestamp: Date.now(),
              });

              log.info("VestingUpdated", `${account.slice(0,6)}… — ${unvested.toFixed(4)} POT still locked`);
            }

            // ── vesting.VestingCompleted ──────────────────────────────────
            // From: https://portaldot-dev.readthedocs.io/en/latest/module-interface/events/vesting.html
            // VestingCompleted(account: AccountId32)
            if (section === "vesting" && method === "VestingCompleted") {
              const account = data[0].toString();

              if (filterAddress && account !== filterAddress) return;

              newItems.push({
                id:        `${blockNum}-vesting-completed-${account}`,
                type:      "vesting_completed",
                section,
                method,
                block:     blockNum,
                account,
                timestamp: Date.now(),
              });

              log.success(`VestingCompleted: ${account.slice(0,6)}… fully unlocked`);
            }
          });

          if (newItems.length > 0) {
            setEvents(prev => {
              // prepend new items, cap at MAX_FEED_ITEMS
              const merged = [...newItems, ...prev];
              return merged.slice(0, MAX_FEED_ITEMS);
            });
          }
        });
      });

      log.success("Feed subscribed — watching every block");
    })();

    return () => {
      mounted = false;
      setListening(false);
      if (unsub) {
        unsub();
        log.info("Feed unsubscribed");
      }
    };
  }, [api, filterAddress]);

  const clearFeed = useCallback(() => setEvents([]), []);

  return { events, currentBlock, listening, clearFeed };
}
