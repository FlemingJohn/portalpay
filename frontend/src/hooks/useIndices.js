/**
 * hooks/useIndices.js
 * Short account "handles" using the native indices pallet.
 *
 * A handle is a small number (e.g. #42) that the chain maps to an address — the
 * native, contract-free way to be paid without sharing a 48-character address.
 *
 *   indices.claim(index)            — claim a free index for the caller
 *   indices.free(index)             — release your index (returns the deposit)
 *   indices.transfer(new, index)    — give your index to someone else
 *   storage indices.accounts(index) — (owner, deposit, frozen) | None
 * https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/indices.html
 *
 * Claiming reserves a small POT deposit (consts.indices.deposit), refunded on free().
 */

import { useState, useCallback } from "react";
import { log } from "../lib/logger";
import { planckToPot } from "../lib/chain";

export function useIndices(api) {
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  /** The reserved deposit required to claim an index, in POT. */
  const deposit = api ? planckToPot(api.consts.indices.deposit.toString()) : 0;

  /** Resolve an index → owner address (or null if unclaimed). */
  const getOwner = useCallback(async (index) => {
    if (!api) throw new Error("Chain not connected");
    const rec = await api.query.indices.accounts(index);
    return rec.isSome ? rec.unwrap()[0].toString() : null;
  }, [api]);

  /** Is this index free to claim? */
  const isFree = useCallback(async (index) => {
    return (await getOwner(index)) === null;
  }, [getOwner]);

  /** Find the index currently owned by an address, or null. */
  const findMine = useCallback(async (address) => {
    if (!api) throw new Error("Chain not connected");
    const entries = await api.query.indices.accounts.entries();
    for (const [key, val] of entries) {
      if (val.isSome && val.unwrap()[0].toString() === address) return key.args[0].toNumber();
    }
    return null;
  }, [api]);

  /** Suggest a small free index (scans upward from 1). */
  const suggestFree = useCallback(async () => {
    for (let i = 1; i <= 200; i++) { if (await isFree(i)) return i; }
    return Math.floor(Math.random() * 1_000_000);
  }, [isFree]);

  /**
   * Claim a handle. Optionally set a display name in the SAME signature
   * (utility.batchAll([identity.setIdentity, indices.claim])).
   */
  const claimHandle = useCallback(async ({ index, displayName }, getSigner) => {
    if (!api) throw new Error("Chain not connected");
    setSubmitting(true);
    setError(null);

    try {
      if (!(await isFree(index))) throw new Error(`#${index} is already taken — pick another`);

      const { signer, address } = await getSigner();

      const claimCall = api.tx.indices.claim(index);
      const calls = [];
      if (displayName && displayName.trim()) {
        calls.push(api.tx.identity.setIdentity({
          display: { Raw: displayName.trim() }, legal: { None: null }, web: { None: null },
          riot: { None: null }, email: { None: null }, pgpFingerprint: null,
          image: { None: null }, twitter: { None: null },
        }));
      }
      calls.push(claimCall);
      const tx = calls.length > 1 ? api.tx.utility.batchAll(calls) : claimCall;

      log.step(2, displayName ? "utility.batchAll(setIdentity + indices.claim)" : "indices.claim");
      log.info("Handle", `#${index}`);
      if (displayName) log.info("Display name", displayName);

      const txHash = await new Promise((resolve, reject) => {
        tx.signAndSend(address, { signer }, ({ status, dispatchError }) => {
          if (dispatchError) {
            const msg = dispatchError.isModule
              ? (() => { const d = api.registry.findMetaError(dispatchError.asModule); return `${d.section}.${d.name}`; })()
              : dispatchError.toString();
            log.error(`claimHandle failed: ${msg}`);
            return reject(new Error(msg));
          }
          if (status.isInBlock || status.isFinalized) {
            log.success(`#${index} is yours — anyone can pay you at #${index}`);
            log.tx(status.hash.toString());
            resolve(status.hash.toString());
          }
        });
      });

      return txHash;

    } catch (err) {
      log.error(`claimHandle failed: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [api, isFree]);

  return { deposit, getOwner, isFree, findMine, suggestFree, claimHandle, submitting, error };
}
