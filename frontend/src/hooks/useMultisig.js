/**
 * hooks/useMultisig.js
 * Shared-wallet (M-of-N) payments using the native multisig pallet.
 *
 * A multisig account is a deterministic address derived from a set of signatories
 * plus a threshold. Funds sent to it can only move when `threshold` of the
 * signatories approve the SAME call — no smart contract, the chain enforces it.
 *
 * Pallet references (verified against the connected runtime — this chain runs the
 * legacy `WrapperKeepOpaque` multisig, which has its own quirks):
 *
 *   multisig.asMulti(threshold, otherSignatories, maybeTimepoint, call, storeCall, maxWeight)
 *     — Register an approval for `call`. When the approval count reaches the
 *       threshold, the chain dispatches the call. NOTE: `call` must be passed as
 *       the RAW inner-call bytes (`call.method.toHex()`), not the call object, or
 *       the pallet records the approval but never executes.
 *   multisig.cancelAsMulti(threshold, otherSignatories, timepoint, callHash)
 *     — Cancel a pending operation (only the original creator can).
 *   storage multisig.multisigs(multisigAddress, callHash) -> Option<Multisig>
 *     — The pending operation: { when (timepoint), approvals: Vec<AccountId>, ... }
 *
 * Address derivation uses @polkadot/util-crypto:
 *   encodeAddress(createKeyMulti(sortAddresses(signatories), threshold), 42)
 */

import { useState, useCallback } from "react";
import {
  createKeyMulti,
  encodeAddress,
  sortAddresses,
} from "@polkadot/util-crypto";
import { log } from "../lib/logger";
import { potToPlanck, SS58_FORMAT } from "../lib/chain";

export function useMultisig(api) {
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  /**
   * Derive the deterministic multisig address for a signatory set + threshold.
   * Pure (no chain call). Signatories are sorted before derivation so the order
   * the user types them in does not matter.
   */
  const deriveAddress = useCallback((signatories, threshold) => {
    const sorted = sortAddresses(signatories);
    return encodeAddress(createKeyMulti(sorted, threshold), SS58_FORMAT);
  }, []);

  /**
   * Build the payment call the multisig will execute (a plain POT transfer).
   * Every signatory rebuilds the identical call from {recipient, amount}, so its
   * bytes and hash match across signers without sharing anything but those two values.
   */
  const buildPaymentCall = useCallback((recipient, amountPot) => {
    if (!api) throw new Error("Chain not connected");
    return api.tx.balances.transferKeepAlive(recipient, potToPlanck(amountPot));
  }, [api]);

  /**
   * Read the pending operation for a given multisig + call, if any.
   * Returns { timepoint, approvals: string[], approvalsCount } or null.
   */
  const getPending = useCallback(async (multisigAddress, callHash) => {
    if (!api) throw new Error("Chain not connected");
    const info = await api.query.multisig.multisigs(multisigAddress, callHash);
    if (info.isNone) return null;
    const m = info.unwrap();
    return {
      timepoint:      m.when,
      approvals:      m.approvals.map(a => a.toString()),
      approvalsCount: m.approvals.length,
    };
  }, [api]);

  /**
   * Approve (and, on the threshold-th approval, execute) a payment FROM the
   * multisig to `recipient`. Any signatory calls this; the first call records the
   * approval, the final one dispatches the transfer. Idempotent per signer — the
   * chain rejects a second approval from the same account.
   *
   * signatories: full set (all M addresses). threshold: number required.
   */
  const approvePayment = useCallback(async (
    { signatories, threshold, recipient, amountPot },
    getSigner,
  ) => {
    if (!api) throw new Error("Chain not connected");
    setSubmitting(true);
    setError(null);

    try {
      const multisigAddress = deriveAddress(signatories, threshold);
      const call     = buildPaymentCall(recipient, amountPot);
      const callArg  = call.method.toHex();        // RAW bytes — required for execution
      const callHash = call.method.hash.toHex();

      const { signer, address } = await getSigner();

      if (!signatories.includes(address)) {
        throw new Error("Connected account is not one of the signatories");
      }

      // otherSignatories = all signatories except the caller, sorted ascending
      const others = sortAddresses(signatories.filter(a => a !== address));

      // If an operation is already pending, supply its timepoint; otherwise None (first approval).
      const pending   = await getPending(multisigAddress, callHash);
      const timepoint = pending ? pending.timepoint : null;

      // maxWeight must be >= the call's real weight; it is charged, so keep it tight.
      const { weight } = await call.paymentInfo(address);

      log.step(2, "multisig.asMulti");
      log.info("Multisig",  multisigAddress);
      log.info("Pay",       `${amountPot} POT → ${recipient}`);
      log.info("Threshold", `${threshold} of ${signatories.length}`);
      log.info("State",     pending ? `${pending.approvalsCount}/${threshold} approved — adding yours` : "first approval");

      const result = await new Promise((resolve, reject) => {
        api.tx.multisig
          .asMulti(threshold, others, timepoint, callArg, false, weight)
          .signAndSend(address, { signer }, ({ status, dispatchError, events }) => {
            if (dispatchError) {
              const msg = dispatchError.isModule
                ? (() => { const d = api.registry.findMetaError(dispatchError.asModule); return `${d.section}.${d.name}`; })()
                : dispatchError.toString();
              log.error(`asMulti failed: ${msg}`);
              return reject(new Error(msg));
            }
            if (status.isInBlock || status.isFinalized) {
              const executed = events.some(({ event }) =>
                event.section === "multisig" && event.method === "MultisigExecuted");
              if (executed) log.success(`Threshold met — ${amountPot} POT sent from the shared wallet`);
              else          log.success("Approval recorded — waiting for more signatories");
              log.tx(status.hash.toString());
              resolve({ txHash: status.hash.toString(), executed, callHash, multisigAddress });
            }
          });
      });

      return result;

    } catch (err) {
      log.error(`approvePayment failed: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [api, deriveAddress, buildPaymentCall, getPending]);

  /**
   * Cancel a pending operation. Only the account that created it can cancel.
   */
  const cancelPayment = useCallback(async (
    { signatories, threshold, recipient, amountPot },
    getSigner,
  ) => {
    if (!api) throw new Error("Chain not connected");
    setSubmitting(true);
    setError(null);

    try {
      const multisigAddress = deriveAddress(signatories, threshold);
      const call     = buildPaymentCall(recipient, amountPot);
      const callHash = call.method.hash.toHex();

      const pending = await getPending(multisigAddress, callHash);
      if (!pending) throw new Error("No pending operation to cancel");

      const { signer, address } = await getSigner();
      const others = sortAddresses(signatories.filter(a => a !== address));

      log.step(2, "multisig.cancelAsMulti");

      const txHash = await new Promise((resolve, reject) => {
        api.tx.multisig
          .cancelAsMulti(threshold, others, pending.timepoint, callHash)
          .signAndSend(address, { signer }, ({ status, dispatchError }) => {
            if (dispatchError) return reject(new Error(dispatchError.toString()));
            if (status.isInBlock || status.isFinalized) {
              log.success("Pending payment cancelled");
              resolve(status.hash.toString());
            }
          });
      });

      return txHash;

    } catch (err) {
      log.error(`cancelPayment failed: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [api, deriveAddress, buildPaymentCall, getPending]);

  return {
    deriveAddress,
    buildPaymentCall,
    getPending,
    approvePayment,
    cancelPayment,
    submitting,
    error,
  };
}
