/**
 * hooks/useScheduler.js
 * Native onchain automation via the scheduler pallet.
 *
 * scheduler.scheduleNamedAfter(id, after, maybe_periodic, priority, call)
 *   — Run `call` after `after` blocks; optionally repeat. The chain executes
 *     it itself — no keeper bot, no server, no contract.
 *   https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/scheduler.html
 *
 * scheduler.cancelNamed(id)
 *   — Cancel a named scheduled task.
 *   https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/scheduler.html
 *
 * Scheduled calls dispatch with the origin of the account that scheduled them,
 * so a scheduled balances.transferKeepAlive spends the scheduler's own funds.
 * This is the feature EVM chains cannot replicate without external automation.
 */

import { useState, useCallback } from "react";
import { log } from "../lib/logger";

// [u8;32] task-id helpers — ids travel as hex strings in the UI / localStorage
const bytesToHex = (bytes) =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
const hexToBytes = (hex) =>
  Uint8Array.from(hex.match(/.{1,2}/g).map((h) => parseInt(h, 16)));

export function useScheduler(api) {
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  /** Current block number — used for countdown displays. */
  const getCurrentBlock = useCallback(async () => {
    if (!api) throw new Error("Chain not connected");
    const header = await api.rpc.chain.getHeader();
    return header.number.toNumber();
  }, [api]);

  /**
   * Schedule any call to run after `afterBlocks`, optionally repeating.
   * Returns { txHash, taskIdHex } — keep taskIdHex to cancel/reset later.
   *
   * opts = { afterBlocks, periodBlocks?, repetitions? }
   *   periodBlocks + repetitions present → recurring (maybe_periodic = Some)
   *   otherwise                          → one-shot   (maybe_periodic = None)
   */
  const scheduleCall = useCallback(async (innerCall, opts, getSigner) => {
    if (!api) throw new Error("Chain not connected");
    setSubmitting(true);
    setError(null);

    try {
      const { afterBlocks, periodBlocks, repetitions } = opts;

      // 1. Build a unique [u8;32] task id
      const taskId    = crypto.getRandomValues(new Uint8Array(32));
      const taskIdHex = bytesToHex(taskId);

      // 2. Decide one-shot vs recurring
      const maybePeriodic =
        periodBlocks && repetitions ? [periodBlocks, repetitions] : null;

      log.step(2, "scheduler.scheduleNamedAfter");
      log.info("After",   `${afterBlocks} blocks`);
      log.info("Repeat",  maybePeriodic ? `every ${periodBlocks} × ${repetitions}` : "one-shot");
      log.info("Task ID", taskIdHex);

      // 3. Sign and submit — the chain runs innerCall on its own
      const { signer, address } = await getSigner();

      const txHash = await new Promise((resolve, reject) => {
        api.tx.scheduler
          .scheduleNamedAfter(taskId, afterBlocks, maybePeriodic, 0, innerCall)
          .signAndSend(address, { signer }, ({ status, dispatchError }) => {
            if (dispatchError) {
              log.error(`scheduleNamedAfter failed: ${dispatchError.toString()}`);
              return reject(new Error(dispatchError.toString()));
            }
            if (status.isInBlock || status.isFinalized) {
              log.success("Scheduled onchain — the chain will run it, no bot needed");
              log.tx(status.hash.toString());
              resolve(status.hash.toString());
            }
          });
      });

      return { txHash, taskIdHex };

    } catch (err) {
      log.error(`scheduleCall failed: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [api]);

  /**
   * Cancel a scheduled task by its hex id.
   * scheduler.cancelNamed(id: [u8;32])
   */
  const cancelScheduled = useCallback(async (taskIdHex, getSigner) => {
    if (!api) throw new Error("Chain not connected");
    setSubmitting(true);
    setError(null);

    try {
      log.step(2, "scheduler.cancelNamed");
      log.info("Task ID", taskIdHex);

      const { signer, address } = await getSigner();

      const txHash = await new Promise((resolve, reject) => {
        api.tx.scheduler
          .cancelNamed(hexToBytes(taskIdHex))
          .signAndSend(address, { signer }, ({ status, dispatchError }) => {
            if (dispatchError) {
              log.error(`cancelNamed failed: ${dispatchError.toString()}`);
              return reject(new Error(dispatchError.toString()));
            }
            if (status.isInBlock || status.isFinalized) {
              log.success("Scheduled task cancelled");
              log.tx(status.hash.toString());
              resolve(status.hash.toString());
            }
          });
      });

      return txHash;

    } catch (err) {
      log.error(`cancelScheduled failed: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [api]);

  return { getCurrentBlock, scheduleCall, cancelScheduled, submitting, error };
}
