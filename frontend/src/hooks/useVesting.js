/**
 * hooks/useVesting.js
 * All vesting pallet interactions.
 *
 * Pallet references from official docs:
 *
 * WRITES:
 *   vesting.vestedTransfer(target, schedule: PalletVestingVestingInfo)
 *     — Send POT that unlocks gradually over blocks.
 *     — schedule = { locked: u128, per_block: u128, starting_block: u32 }
 *     https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/vesting.html
 *
 *   vesting.vest()
 *     — Unlock any vested (matured) funds for the caller.
 *     https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/vesting.html
 *
 *   vesting.vestOther(target)
 *     — Unlock vested funds for another account.
 *     https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/vesting.html
 *
 * READS:
 *   vesting.vesting(AccountId32) → Option<Vec<PalletVestingVestingInfo>>
 *     — Returns all vesting schedules for an account.
 *     — Each schedule: { locked, per_block, starting_block }
 *     https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/vesting.html
 *
 * EVENTS (listened to via useFeed):
 *   vesting.VestingUpdated(account, unvested)  — partial unlock
 *   vesting.VestingCompleted(account)          — fully unlocked
 *   https://portaldot-dev.readthedocs.io/en/latest/module-interface/events/vesting.html
 *
 * HOW VestingInfo WORKS:
 *   locked        = total POT locked in this schedule (planck)
 *   per_block     = how many planck unlock each block
 *   starting_block = the block at which unlocking begins
 *
 *   At block B, unlocked amount = min(locked, (B - starting_block) * per_block)
 *   Fully unlocked when: starting_block + (locked / per_block) <= current_block
 */

import { useState, useCallback } from "react";
import { log } from "../lib/logger";
import { planckToPot, potToPlanck } from "../lib/chain";

export function useVesting(api) {
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  // ── READS ───────────────────────────────────────────────────────────────

  /**
   * Read all vesting schedules for an address.
   * Storage: vesting.vesting(AccountId32) → Vec<PalletVestingVestingInfo>
   * https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/vesting.html
   *
   * Returns enriched schedule objects with human-readable values.
   */
  const getVestingSchedules = useCallback(async (address) => {
    if (!api) throw new Error("Chain not connected");

    log.step(1, "Reading vesting.vesting");
    log.info("Address", address);

    const result = await api.query.vesting.vesting(address);
    const raw    = result.toJSON();

    if (!raw || raw.length === 0) {
      log.info("No vesting schedules found");
      return [];
    }

    // Get current block to calculate how much has unlocked
    const header       = await api.rpc.chain.getHeader();
    const currentBlock = header.number.toNumber();

    const schedules = raw.map((s, i) => {
      const locked       = BigInt(s.locked);
      const perBlock     = BigInt(s.perBlock);
      const startBlock   = s.startingBlock;

      // How much has unlocked so far
      const blocksElapsed  = BigInt(Math.max(0, currentBlock - startBlock));
      const unlockedRaw    = perBlock * blocksElapsed;
      const unlockedCapped = unlockedRaw > locked ? locked : unlockedRaw;
      const stillLocked    = locked - unlockedCapped;

      // Block at which it fully unlocks
      const endBlock = startBlock + Number(locked / perBlock);

      return {
        index:        i,
        locked:       planckToPot(locked.toString()),
        perBlock:     planckToPot(perBlock.toString()),
        startBlock,
        endBlock,
        currentBlock,
        unlocked:     planckToPot(unlockedCapped.toString()),
        stillLocked:  planckToPot(stillLocked.toString()),
        isComplete:   stillLocked === 0n,
        blocksLeft:   Math.max(0, endBlock - currentBlock),
      };
    });

    schedules.forEach((s, i) => {
      log.info(`Schedule ${i}`, `${s.stillLocked.toFixed(4)} POT locked — unlocks block ${s.endBlock}`);
    });

    return schedules;
  }, [api]);

  // ── WRITES ──────────────────────────────────────────────────────────────

  /**
   * Send POT that unlocks gradually to a target address.
   * Extrinsic: vesting.vestedTransfer(target, schedule)
   * https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/vesting.html
   *
   * schedule params:
   *   locked        — total POT to lock (in planck)
   *   per_block     — how many planck unlock per block
   *   starting_block — when unlocking begins (usually current block + small delay)
   *
   * Example: lock 100 POT, unlock 2 POT per block starting in 5 blocks
   *   → fully unlocked after 50 blocks from start
   */
  const vestedTransfer = useCallback(async (
    destAddress,
    totalAmountPot,
    unlockBlocks,   // how many blocks until fully unlocked
    getSigner,
  ) => {
    if (!api) throw new Error("Chain not connected");
    setSubmitting(true);
    setError(null);

    try {
      log.step(2, "vesting.vestedTransfer");
      log.info("To",             destAddress);
      log.info("Total amount",   `${totalAmountPot} POT`);
      log.info("Unlock blocks",  `${unlockBlocks} blocks`);

      // Get current block to set starting_block
      const header       = await api.rpc.chain.getHeader();
      const currentBlock = header.number.toNumber();
      const startBlock   = currentBlock + 1; // start next block

      const lockedPlanck  = potToPlanck(totalAmountPot);
      // per_block = locked / unlock_blocks (round up by 1 to ensure full unlock)
      const perBlockPlanck = (lockedPlanck / BigInt(unlockBlocks)) + 1n;

      log.info("Start block",    startBlock.toString());
      log.info("Per block",      `${planckToPot(perBlockPlanck.toString()).toFixed(6)} POT`);
      log.info("End block ~",    (startBlock + unlockBlocks).toString());

      const { signer, address } = await getSigner();

      const txHash = await new Promise((resolve, reject) => {
        api.tx.vesting
          .vestedTransfer(destAddress, {
            locked:        lockedPlanck,
            perBlock:      perBlockPlanck,
            startingBlock: startBlock,
          })
          .signAndSend(address, { signer }, ({ status, dispatchError }) => {
            if (dispatchError) {
              log.error(`vestedTransfer failed: ${dispatchError.toString()}`);
              return reject(new Error(dispatchError.toString()));
            }
            if (status.isInBlock || status.isFinalized) {
              log.success(`Locked payment created — ${totalAmountPot} POT → ${destAddress.slice(0,6)}…`);
              log.tx(status.hash.toString());
              resolve(status.hash.toString());
            }
          });
      });

      return txHash;

    } catch (err) {
      log.error(`vestedTransfer error: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [api]);

  /**
   * Claim all matured vested funds for the connected wallet.
   * Extrinsic: vesting.vest()
   * https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/vesting.html
   *
   * Emits vesting.VestingUpdated or vesting.VestingCompleted
   */
  const vest = useCallback(async (getSigner) => {
    if (!api) throw new Error("Chain not connected");
    setSubmitting(true);
    setError(null);

    try {
      log.step(2, "vesting.vest — claiming unlocked POT");

      const { signer, address } = await getSigner();

      const txHash = await new Promise((resolve, reject) => {
        api.tx.vesting
          .vest()
          .signAndSend(address, { signer }, ({ status, dispatchError }) => {
            if (dispatchError) {
              log.error(`vest failed: ${dispatchError.toString()}`);
              return reject(new Error(dispatchError.toString()));
            }
            if (status.isInBlock || status.isFinalized) {
              log.success("vest() confirmed — unlocked POT is now spendable");
              log.tx(status.hash.toString());
              resolve(status.hash.toString());
            }
          });
      });

      return txHash;

    } catch (err) {
      log.error(`vest error: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [api]);

  return {
    getVestingSchedules,
    vestedTransfer,
    vest,
    submitting,
    error,
  };
}
