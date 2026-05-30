/**
 * hooks/useAssets.js
 * Create and read native Portaldot assets (the `assets` pallet — no contract).
 *
 * A token is created and funded in ONE atomic transaction via utility.batchAll:
 *   assets.create(id, admin, minBalance)            — make a new asset class
 *   assets.setMetadata(id, name, symbol, decimals)  — human-readable info
 *   assets.mint(id, beneficiary, amount)            — mint the initial supply
 * https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/assets.html
 *
 * Once created the token is a first-class chain asset: PortalPay's existing
 * "Pay a token" flow (usePayment.sendAssetPayment → assets.transferKeepAlive)
 * can immediately send it.
 */

import { useState, useCallback } from "react";
import { log } from "../lib/logger";

export function useAssets(api) {
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);

  /** Suggest the next unused asset id (max existing + 1, or 1 if none). */
  const nextAssetId = useCallback(async () => {
    if (!api) throw new Error("Chain not connected");
    const keys = await api.query.assets.asset.keys();
    const ids  = keys.map(k => k.args[0].toNumber());
    return ids.length ? Math.max(...ids) + 1 : 1;
  }, [api]);

  /** List every asset that has metadata, with supply. */
  const listAssets = useCallback(async () => {
    if (!api) throw new Error("Chain not connected");
    const entries = await api.query.assets.metadata.entries();
    const out = [];
    for (const [key, meta] of entries) {
      const id = key.args[0].toNumber();
      let symbol = "", name = "";
      try { symbol = meta.symbol.toUtf8(); } catch {}
      try { name   = meta.name.toUtf8();   } catch {}
      const decimals = meta.decimals.toNumber();
      if (!symbol && decimals === 0) continue;                 // unregistered
      const assetInfo = await api.query.assets.asset(id);
      const supplyRaw = assetInfo.isSome ? assetInfo.unwrap().supply.toString() : "0";
      out.push({ id, name, symbol, decimals, supply: Number(BigInt(supplyRaw)) / 10 ** decimals });
    }
    return out.sort((a, b) => a.id - b.id);
  }, [api]);

  /** Read one account's balance of an asset, in whole token units. */
  const getAssetBalance = useCallback(async (assetId, address) => {
    if (!api) throw new Error("Chain not connected");
    const meta = await api.query.assets.metadata(assetId);
    const decimals = meta.decimals.toNumber();
    const acct = await api.query.assets.account(assetId, address);
    // Account record shape varies by version: { balance } directly or Option<{ balance }>
    let raw = 0n;
    try {
      const v = acct.isSome ? acct.unwrap() : acct;
      raw = BigInt((v.balance ?? v).toString());
    } catch { raw = 0n; }
    return Number(raw) / 10 ** decimals;
  }, [api]);

  /**
   * Create a token and mint its initial supply to the creator — one signature.
   * { assetId, name, symbol, decimals, initialSupply }  (supply in whole tokens)
   */
  const createToken = useCallback(async (
    { assetId, name, symbol, decimals, initialSupply },
    getSigner,
  ) => {
    if (!api) throw new Error("Chain not connected");
    setSubmitting(true);
    setError(null);

    try {
      const { signer, address } = await getSigner();
      const dec        = parseInt(decimals);
      const supplyRaw  = BigInt(Math.round(parseFloat(initialSupply) * 10 ** dec));
      const minBalance = 1n;  // smallest unit — any amount of the token is valid

      log.step(2, "utility.batchAll — assets.create + setMetadata + mint");
      log.info("Asset id", String(assetId));
      log.info("Token",    `${name} (${symbol}), ${dec} decimals`);
      log.info("Supply",   `${initialSupply} ${symbol} → ${address.slice(0, 6)}…`);

      const calls = [
        api.tx.assets.create(assetId, address, minBalance),
        api.tx.assets.setMetadata(assetId, name, symbol, dec),
        api.tx.assets.mint(assetId, address, supplyRaw),
      ];

      const txHash = await new Promise((resolve, reject) => {
        api.tx.utility
          .batchAll(calls)
          .signAndSend(address, { signer }, ({ status, dispatchError }) => {
            if (dispatchError) {
              const msg = dispatchError.isModule
                ? (() => { const d = api.registry.findMetaError(dispatchError.asModule); return `${d.section}.${d.name}`; })()
                : dispatchError.toString();
              log.error(`createToken failed: ${msg}`);
              return reject(new Error(msg));
            }
            if (status.isInBlock || status.isFinalized) {
              log.success(`Token ${symbol} (#${assetId}) created and minted`);
              log.tx(status.hash.toString());
              resolve(status.hash.toString());
            }
          });
      });

      return txHash;

    } catch (err) {
      log.error(`createToken failed: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [api]);

  return { nextAssetId, listAssets, getAssetBalance, createToken, submitting, error };
}
