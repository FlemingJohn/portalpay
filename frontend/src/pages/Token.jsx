/**
 * pages/Token.jsx
 * Launch your own token on Portaldot — native assets pallet, no contract.
 *
 * Create a fungible token (community currency, loyalty points, creator coin) and
 * mint its initial supply to yourself in one signature. Created tokens appear
 * below and can be sent from Pay → "Pay a token" using their asset id.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAssets } from "../hooks/useAssets";

const INPUT = {
  width: "100%", padding: "11px 14px", borderRadius: 0,
  border: "1px solid #1A1A1A", background: "#0A0A0A", color: "#ffffff",
  fontSize: 14, boxSizing: "border-box", marginBottom: 14, outline: "none",
};
const LABEL = {
  fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)",
  display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.12em",
};

export default function Token({ api, getSigner, isConnected, walletAddress }) {
  const { nextAssetId, listAssets, getAssetBalance, createToken, submitting, error: assetErr } =
    useAssets(api);

  const [assetId,  setAssetId]  = useState("");
  const [name,     setName]     = useState("");
  const [symbol,   setSymbol]   = useState("");
  const [decimals, setDecimals] = useState("2");
  const [supply,   setSupply]   = useState("");
  const [tokens,   setTokens]   = useState([]);
  const [balances, setBalances] = useState({});   // id -> my balance
  const [formError, setFormError] = useState(null);
  const [done,     setDone]     = useState(null);

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      const list = await listAssets();
      setTokens(list);
      if (walletAddress) {
        const b = {};
        for (const t of list) { try { b[t.id] = await getAssetBalance(t.id, walletAddress); } catch {} }
        setBalances(b);
      }
      if (!assetId) { try { setAssetId(String(await nextAssetId())); } catch {} }
    } catch { /* ignore */ }
  }, [api, listAssets, getAssetBalance, walletAddress, nextAssetId, assetId]);

  useEffect(() => { refresh(); }, [api, walletAddress]);   // eslint-disable-line

  const handleCreate = async () => {
    setFormError(null); setDone(null);
    if (!assetId) return setFormError("Asset id is required");
    if (!name.trim()) return setFormError("Enter a token name");
    if (!symbol.trim()) return setFormError("Enter a symbol");
    if (!supply || parseFloat(supply) <= 0) return setFormError("Enter an initial supply");
    try {
      await createToken(
        { assetId: parseInt(assetId), name: name.trim(), symbol: symbol.trim(), decimals: parseInt(decimals) || 0, initialSupply: parseFloat(supply) },
        getSigner,
      );
      setDone(`${symbol.trim()} (#${assetId}) created — pay it from Pay → "Pay a token"`);
      setName(""); setSymbol(""); setSupply("");
      setTimeout(refresh, 800);
    } catch (err) { setFormError(err.message); }
  };

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🪙</div>
        <h2 style={{ fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Connect your wallet first</h2>
        <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>Click "Connect wallet" to launch a token.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 540, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "-0.5px" }}>Launch a token</h1>
      <p style={{ color: "rgba(255,255,255,0.55)", margin: "0 0 24px", lineHeight: 1.6 }}>
        Mint your own currency — community points, a creator coin, event credits —
        natively on Portaldot. No smart contract.
      </p>

      <div style={{ border: "1px solid #1A1A1A", background: "#0A0A0A", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={LABEL}>Name</label>
            <input style={INPUT} type="text" placeholder="e.g. Coffee Token" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div style={{ width: 120 }}>
            <label style={LABEL}>Symbol</label>
            <input style={INPUT} type="text" placeholder="COFFEE" value={symbol} onChange={e => setSymbol(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={LABEL}>Initial supply</label>
            <input style={INPUT} type="number" min="0.0001" placeholder="e.g. 1000" value={supply} onChange={e => setSupply(e.target.value)} />
          </div>
          <div style={{ width: 90 }}>
            <label style={LABEL}>Decimals</label>
            <input style={INPUT} type="number" min="0" max="18" value={decimals} onChange={e => setDecimals(e.target.value)} />
          </div>
          <div style={{ width: 90 }}>
            <label style={LABEL}>Asset id</label>
            <input style={INPUT} type="number" min="1" value={assetId} onChange={e => setAssetId(e.target.value)} />
          </div>
        </div>
        <button onClick={handleCreate} disabled={submitting || !api}
          style={{
            width: "100%", padding: 13, borderRadius: 0, border: "none",
            background: submitting ? "#1A1A1A" : "#00FF00",
            color: submitting ? "rgba(255,255,255,0.4)" : "#050505",
            fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
            cursor: submitting ? "default" : "pointer",
            boxShadow: submitting ? "none" : "0 0 15px rgba(0,255,0,0.2)",
          }}>
          {submitting ? "Creating onchain…" : "Create token"}
        </button>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 8 }}>
          utility.batchAll(create + setMetadata + mint) — one signature
        </p>
      </div>

      {done && <p style={{ color: "#00FF00", fontSize: 13, marginBottom: 14 }}>✓ {done}</p>}
      {(formError || assetErr) && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 14 }}>{formError || assetErr}</p>}

      {tokens.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Tokens on this chain</div>
          {tokens.map(t => (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #1A1A1A", background: "#0A0A0A", padding: "12px 16px", marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#00FF00", fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>{t.symbol}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginLeft: 8 }}>{t.name} · id #{t.id}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Your balance</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{balances[t.id] != null ? `${balances[t.id]} ${t.symbol}` : "—"}</div>
              </div>
            </div>
          ))}
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 4 }}>
            Send any of these from Pay → "Pay a token" using its id.
          </p>
        </>
      )}
    </div>
  );
}
