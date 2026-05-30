/**
 * pages/Claim.jsx
 * Claim a short on-chain handle (e.g. #42) via the native indices pallet, plus an
 * optional display name (identity.setIdentity). Anyone can then pay you at #42 —
 * no 48-character address to share. No smart contract.
 */

import React, { useState, useEffect } from "react";
import { useIndices } from "../hooks/useIndices";

const INPUT = {
  width: "100%", padding: "11px 14px", borderRadius: 0, fontSize: 14,
  border: "1px solid #1A1A1A", background: "#0A0A0A", color: "#ffffff",
  boxSizing: "border-box", marginBottom: 16, outline: "none",
};
const LABEL = {
  fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)",
  display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.12em",
};

export default function Claim({ api, getSigner, isConnected, walletAddress }) {
  const { deposit, isFree, findMine, suggestFree, claimHandle, submitting, error: idxErr } = useIndices(api);

  const [handle,      setHandle]      = useState("");
  const [displayName, setDisplayName] = useState("");
  const [existing,    setExisting]    = useState(null);   // already-owned index
  const [formError,   setFormError]   = useState(null);
  const [done,        setDone]        = useState(null);   // claimed index number

  // Load existing handle + suggest a free one
  useEffect(() => {
    if (!api || !walletAddress) return;
    let cancelled = false;
    (async () => {
      try {
        const mine = await findMine(walletAddress);
        if (cancelled) return;
        setExisting(mine);
        if (mine == null && !handle) { try { setHandle(String(await suggestFree())); } catch {} }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [api, walletAddress]);   // eslint-disable-line

  const handleClaim = async () => {
    setFormError(null);
    const n = parseInt(handle);
    if (!n || n < 0) return setFormError("Pick a positive number for your handle");
    try {
      if (!(await isFree(n))) return setFormError(`#${n} is taken — pick another`);
      await claimHandle({ index: n, displayName }, getSigner);
      setDone(n);
      setExisting(n);
    } catch (err) { setFormError(err.message); }
  };

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Connect your wallet first</h2>
        <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
          You need the Polkadot.js extension to claim a handle.{" "}
          <a href="https://polkadot.js.org/extension/" target="_blank" rel="noreferrer" style={{ color: "#00FF00" }}>Install it here.</a>
        </p>
      </div>
    );
  }

  if (done != null) {
    const link = `${window.location.origin}/profile/${done}`;
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>#{done} is yours</h2>
        <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 20 }}>
          Your handle is registered on Portaldot. Anyone can pay you by typing
          {" "}<strong style={{ color: "#00FF00" }}>#{done}</strong> in Pay — no address needed.
        </p>
        <div style={{
          background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 0, padding: "12px 16px",
          fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 13, marginBottom: 20, color: "#00FF00", wordBreak: "break-all",
        }}>{link}</div>
        <button onClick={() => navigator.clipboard.writeText(link)}
          style={{
            padding: "11px 24px", borderRadius: 0, border: "none", background: "#00FF00", color: "#050505",
            fontSize: 13, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.12em",
            boxShadow: "0 0 15px rgba(0,255,0,0.2)",
          }}>Copy pay link</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "-0.5px" }}>Claim your handle</h1>
      <p style={{ color: "rgba(255,255,255,0.55)", margin: "0 0 24px", lineHeight: 1.6 }}>
        Claim a short number like <strong style={{ color: "#00FF00", fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>#42</strong> that maps to your
        address. Share it instead of a 48-character address — anyone can pay you at it.
      </p>

      {existing != null && (
        <div style={{ background: "#0A0A0A", border: "1px solid rgba(0,255,0,0.3)", padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#00FF00" }}>
          You already own <strong style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>#{existing}</strong>. Claiming another will add a second handle.
        </div>
      )}

      <label style={LABEL}>Your handle (a number)</label>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ padding: "11px 14px", background: "#1A1A1A", border: "1px solid #1A1A1A", borderRight: "none", fontSize: 14, color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>#</div>
        <input style={{ ...INPUT, marginBottom: 0, flex: 1 }} type="number" min="0" placeholder="42"
          value={handle} onChange={e => setHandle(e.target.value)} />
      </div>

      <label style={{ ...LABEL, marginTop: 16 }}>Display name (optional)</label>
      <input style={INPUT} type="text" placeholder="e.g. Bob Smith"
        value={displayName} onChange={e => setDisplayName(e.target.value)} />

      {(formError || idxErr) && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 14 }}>{formError || idxErr}</p>}

      <button onClick={handleClaim} disabled={submitting || !api}
        style={{
          width: "100%", padding: 13, borderRadius: 0, border: "none",
          background: submitting ? "#1A1A1A" : "#00FF00", color: submitting ? "rgba(255,255,255,0.4)" : "#050505",
          fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
          cursor: submitting ? "default" : "pointer", boxShadow: submitting ? "none" : "0 0 15px rgba(0,255,0,0.2)",
        }}>
        {submitting ? "Claiming onchain…" : `Claim ${handle ? "#" + handle : "your handle"}`}
      </button>

      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 10, textAlign: "center" }}>
        indices.claim — reserves a refundable {deposit ? `${deposit} POT` : ""} deposit
      </p>
    </div>
  );
}
