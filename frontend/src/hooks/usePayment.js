/**
 * hooks/usePayment.js
 * Payment functions using native Portaldot pallets.
 *
 * Pallet references from official docs:
 *
 * balances.transferKeepAlive(dest, value)
 *   — Safe transfer. Keeps sender account alive.
 *   https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/balances.html
 *
 * utility.batchAll(calls)
 *   — Atomic batch. All succeed or ALL roll back.
 *   https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/utility.html
 *
 * assets.transferKeepAlive(id, target, amount)
 *   — Send any Portaldot asset, not just POT.
 *   https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/assets.html
 *
 * system.remarkWithEvent(remark)
 *   — Stamp an onchain memo / invoice reference alongside a payment.
 *   https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/system.html
 *
 * (Locked & recurring payments live in useVesting + LockedPay —
 *  the vesting and scheduler pallets.)
 */

import { useState, useCallback } from "react";
import { log } from "../lib/logger";
import { potToPlanck } from "../lib/chain";

export function usePayment(api) {
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  /**
   * Send POT to one address.
   * Extrinsic: balances.transferKeepAlive
   *
   * transferKeepAlive is used (not Transfer) because it guarantees
   * the sender account is never killed — it always keeps the
   * existential deposit intact.
   */
  const sendPayment = useCallback(async (destAddress, amountPot, getSigner) => {
    if (!api) throw new Error("Chain not connected");
    setSubmitting(true);
    setError(null);

    try {
      log.step(2, "balances.transferKeepAlive");
      log.info("To",     destAddress);
      log.info("Amount", `${amountPot} POT`);

      const amountPlanck = potToPlanck(amountPot);
      log.info("Planck", amountPlanck.toString());

      const { signer, address } = await getSigner();

      const txHash = await new Promise((resolve, reject) => {
        api.tx.balances
          .transferKeepAlive(destAddress, amountPlanck)
          .signAndSend(address, { signer }, ({ status, dispatchError }) => {
            if (dispatchError) {
              log.error(`Transfer failed: ${dispatchError.toString()}`);
              return reject(new Error(dispatchError.toString()));
            }
            if (status.isInBlock || status.isFinalized) {
              log.success(`${amountPot} POT sent`);
              log.tx(status.hash.toString());
              resolve(status.hash.toString());
            }
          });
      });

      return txHash;

    } catch (err) {
      log.error(`sendPayment failed: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [api]);

  /**
   * Send POT to multiple addresses in ONE atomic transaction.
   * Extrinsic: utility.batchAll
   *
   * batchAll is atomic — if any single transfer fails,
   * ALL transfers in the batch are rolled back automatically.
   *
   * recipients: [{ address: string, amountPot: number, username: string }]
   */
  const splitPay = useCallback(async (recipients, getSigner) => {
    if (!api) throw new Error("Chain not connected");
    setSubmitting(true);
    setError(null);

    try {
      const totalPot = recipients.reduce((sum, r) => sum + r.amountPot, 0);
      log.step(2, `utility.batchAll — ${recipients.length} transfers`);
      log.info("Total POT", `${totalPot}`);
      recipients.forEach(r =>
        log.info(`  ${r.username || r.address}`, `${r.amountPot} POT`)
      );

      // Build individual transferKeepAlive calls
      const calls = recipients.map(r =>
        api.tx.balances.transferKeepAlive(
          r.address,
          potToPlanck(r.amountPot),
        )
      );

      log.info("Calls in batch", calls.length.toString());

      const { signer, address } = await getSigner();

      const txHash = await new Promise((resolve, reject) => {
        // utility.batchAll — atomic, all-or-nothing
        api.tx.utility
          .batchAll(calls)
          .signAndSend(address, { signer }, ({ status, dispatchError, events }) => {
            if (dispatchError) {
              log.error(`Batch failed — all rolled back: ${dispatchError.toString()}`);
              return reject(new Error(dispatchError.toString()));
            }
            if (status.isInBlock || status.isFinalized) {
              log.success(`All ${recipients.length} transfers confirmed in one block`);
              log.tx(status.hash.toString());
              resolve(status.hash.toString());
            }
          });
      });

      return txHash;

    } catch (err) {
      log.error(`splitPay failed: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [api]);

  /**
   * Pay with an onchain memo / invoice reference.
   * Extrinsics: utility.batchAll([ balances.transferKeepAlive, system.remarkWithEvent ])
   *   system.remarkWithEvent(remark: Bytes) records the note in the transaction
   *   and emits system.Remarked(sender, H256) — a tamper-proof hash of the note.
   * https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/system.html
   *
   * The transfer and the note land in ONE atomic transaction: the memo text is
   * in the call data and its integrity hash is in the event — a native,
   * contract-free invoice/receipt.
   */
  const payWithMemo = useCallback(async (destAddress, amountPot, memo, getSigner) => {
    if (!api) throw new Error("Chain not connected");
    setSubmitting(true);
    setError(null);

    try {
      log.step(2, "utility.batchAll — transfer + onchain memo");
      log.info("To",     destAddress);
      log.info("Amount", `${amountPot} POT`);
      log.info("Memo",   memo);

      const calls = [
        api.tx.balances.transferKeepAlive(destAddress, potToPlanck(amountPot)),
        api.tx.system.remarkWithEvent(new TextEncoder().encode(memo)),
      ];

      const { signer, address } = await getSigner();

      const txHash = await new Promise((resolve, reject) => {
        api.tx.utility
          .batchAll(calls)
          .signAndSend(address, { signer }, ({ status, dispatchError }) => {
            if (dispatchError) {
              log.error(`payWithMemo failed: ${dispatchError.toString()}`);
              return reject(new Error(dispatchError.toString()));
            }
            if (status.isInBlock || status.isFinalized) {
              log.success(`${amountPot} POT sent with onchain memo`);
              log.tx(status.hash.toString());
              resolve(status.hash.toString());
            }
          });
      });

      return txHash;

    } catch (err) {
      log.error(`payWithMemo failed: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [api]);

  /**
   * Read an asset's onchain metadata (decimals, symbol, name).
   * Storage: assets.metadata(id) → PalletAssetsAssetMetadata
   * https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/assets.html
   *
   * Returns { decimals, symbol, name } or null if the asset is not registered.
   */
  const getAssetMetadata = useCallback(async (assetId) => {
    if (!api) throw new Error("Chain not connected");

    const meta     = await api.query.assets.metadata(assetId);
    const decimals = meta.decimals.toNumber();

    let symbol = "";
    let name   = "";
    try { symbol = meta.symbol.toUtf8(); } catch { symbol = ""; }
    try { name   = meta.name.toUtf8();   } catch { name   = ""; }

    // An unregistered asset returns zeroed metadata
    if (!symbol && decimals === 0) return null;

    return { decimals, symbol, name };
  }, [api]);

  /**
   * Send ANY Portaldot asset (not just POT) to an address.
   * Extrinsic: assets.transferKeepAlive(id, target, amount)
   *   id     = Compact<u32>   asset id
   *   amount = Compact<u128>  in the asset's smallest unit
   * https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/assets.html
   *
   * Decimals are resolved from chain metadata (assets.metadata) — the caller
   * does not pass them. The asset must already exist (assets.create + mint).
   */
  const sendAssetPayment = useCallback(async (assetId, destAddress, amount, getSigner) => {
    if (!api) throw new Error("Chain not connected");
    setSubmitting(true);
    setError(null);

    try {
      log.step(2, "assets.transferKeepAlive");

      // 1. Resolve the asset's own decimals + symbol from chain metadata
      const meta = await getAssetMetadata(assetId);
      if (!meta) throw new Error(`Asset #${assetId} not found on chain`);
      log.info("Asset",  `#${assetId} ${meta.symbol} (${meta.decimals} decimals)`);
      log.info("To",     destAddress);
      log.info("Amount", `${amount} ${meta.symbol}`);

      // 2. Convert to the asset's smallest unit
      const amountRaw = BigInt(Math.round(amount * 10 ** meta.decimals));
      log.info("Raw amount", amountRaw.toString());

      // 3. Sign and submit
      const { signer, address } = await getSigner();

      const txHash = await new Promise((resolve, reject) => {
        api.tx.assets
          .transferKeepAlive(assetId, destAddress, amountRaw.toString())
          .signAndSend(address, { signer }, ({ status, dispatchError }) => {
            if (dispatchError) {
              log.error(`asset transfer failed: ${dispatchError.toString()}`);
              return reject(new Error(dispatchError.toString()));
            }
            if (status.isInBlock || status.isFinalized) {
              log.success(`Sent ${amount} ${meta.symbol} (asset #${assetId})`);
              log.tx(status.hash.toString());
              resolve(status.hash.toString());
            }
          });
      });

      return txHash;

    } catch (err) {
      log.error(`sendAssetPayment failed: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [api, getAssetMetadata]);

  return {
    sendPayment,
    splitPay,
    payWithMemo,
    getAssetMetadata,
    sendAssetPayment,
    submitting,
    error,
  };
}
