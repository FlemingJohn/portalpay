/**
 * pages/Pay.jsx
 * Send POT to one or many usernames.
 *
 * Single pay  → balances.transferKeepAlive
 * Split pay   → utility.batchAll
 *
 * Linear flow:
 *   1. User types recipient username (e.g. bob.portalpay)
 *   2. App resolves username → SS58 address  (identity.usernameInfoOf)
 *   3. User enters amount
 *   4. User clicks Send → extension popup → user approves
 *   5. Success screen shows tx hash
 */

import React, { useState, useEffect } from "react";
import { useIdentity } from "../hooks/useIdentity";
import { usePayment  } from "../hooks/usePayment";
import { log          } from "../lib/logger";
import { POT_SUFFIX   } from "../lib/chain";

const INPUT = {
  width: "100%", padding: "11px 14px", borderRadius: 0,
  border: "1px solid #1A1A1A", background: "#0A0A0A", color: "#ffffff",
  fontSize: 14, boxSizing: "border-box", marginBottom: 14, outline: "none",
};
const LABEL = {
  fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)",
  display: "block", marginBottom: 8,
  textTransform: "uppercase", letterSpacing: "0.12em",
};

export default function Pay({ api, getSigner, isConnected }) {
  const { resolveUsername }           = useIdentity(api);
  const { sendPayment, splitPay, payWithMemo, getAssetMetadata, sendAssetPayment, submitting, error: payError } = usePayment(api);

  const [mode,       setMode]       = useState("single");  // single | split | memo | asset
  const [username,   setUsername]   = useState("");
  const [amount,     setAmount]     = useState("");
  const [recipients, setRecipients] = useState([
    { username: "", amount: "" },
    { username: "", amount: "" },
  ]);
  const [memo,             setMemo]             = useState("");
  const [assetId,          setAssetId]          = useState("");
  const [assetMeta,        setAssetMeta]        = useState(null);   // { decimals, symbol, name } | null
  const [assetLookupError, setAssetLookupError] = useState(null);
  const [txHash,     setTxHash]     = useState(null);
  const [formError,  setFormError]  = useState(null);

  // ── Look up asset metadata when an asset id is entered ────────────────────

  useEffect(() => {
    if (mode !== "asset" || assetId === "") {
      setAssetMeta(null);
      setAssetLookupError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const meta = await getAssetMetadata(parseInt(assetId));
        if (cancelled) return;
        setAssetMeta(meta);
        setAssetLookupError(meta ? null : `Asset #${assetId} not found on chain`);
      } catch {
        if (cancelled) return;
        setAssetMeta(null);
        setAssetLookupError("Could not read asset metadata");
      }
    })();
    return () => { cancelled = true; };
  }, [mode, assetId, getAssetMetadata]);

  // ── Single pay ─────────────────────────────────────────────────────────

  const handleSinglePay = async () => {
    setFormError(null);
    setTxHash(null);

    if (!username.trim()) return setFormError("Enter a username");
    if (!amount || parseFloat(amount) <= 0) return setFormError("Enter a valid amount");

    const fullName = username;  // resolveUsername accepts a name or a raw SS58 address

    try {
      log.banner("PortalPay — Single Payment");
      log.step(1, "Starting single payment flow");

      const address = await resolveUsername(fullName);
      if (!address) return setFormError(`Username '${fullName}' not found on Portaldot`);

      const hash = await sendPayment(address, parseFloat(amount), getSigner);
      setTxHash(hash);
    } catch (err) {
      setFormError(err.message);
    }
  };

  // ── Split pay ───────────────────────────────────────────────────────────

  const updateRecipient = (i, field, val) => {
    setRecipients(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      return next;
    });
  };

  const addRecipient = () =>
    setRecipients(prev => [...prev, { username: "", amount: "" }]);

  const removeRecipient = (i) =>
    setRecipients(prev => prev.filter((_, idx) => idx !== i));

  const handleSplitPay = async () => {
    setFormError(null);
    setTxHash(null);

    const valid = recipients.filter(r => r.username.trim() && parseFloat(r.amount) > 0);
    if (valid.length < 2) return setFormError("Add at least 2 recipients");

    try {
      log.banner("PortalPay — Split Pay (batch)");
      log.step(1, `Resolving ${valid.length} usernames`);

      const resolved = await Promise.all(
        valid.map(async r => {
          const address  = await resolveUsername(r.username);
          if (!address) throw new Error(`Username '${fullName}' not found`);
          return { address, amountPot: parseFloat(r.amount), username: fullName };
        })
      );

      const hash = await splitPay(resolved, getSigner);
      setTxHash(hash);
    } catch (err) {
      setFormError(err.message);
    }
  };

  // ── Pay with onchain memo ─────────────────────────────────────────────────

  const handleMemoPay = async () => {
    setFormError(null);
    setTxHash(null);

    if (!username.trim()) return setFormError("Enter a username");
    if (!amount || parseFloat(amount) <= 0) return setFormError("Enter a valid amount");
    if (!memo.trim()) return setFormError("Enter a memo / invoice note");

    const fullName = username;  // resolveUsername accepts a name or a raw SS58 address

    try {
      log.banner("PortalPay — Payment with memo");
      log.step(1, "Resolving username");

      const address = await resolveUsername(fullName);
      if (!address) return setFormError(`Username '${fullName}' not found on Portaldot`);

      const hash = await payWithMemo(address, parseFloat(amount), memo.trim(), getSigner);
      setTxHash(hash);
    } catch (err) {
      setFormError(err.message);
    }
  };

  // ── Pay an asset (any token, not just POT) ─────────────────────────────────

  const handleAssetPay = async () => {
    setFormError(null);
    setTxHash(null);

    if (assetId === "" || parseInt(assetId) < 0) return setFormError("Enter an asset id");
    if (assetLookupError) return setFormError(assetLookupError);
    if (!username.trim()) return setFormError("Enter a username");
    if (!amount || parseFloat(amount) <= 0) return setFormError("Enter a valid amount");

    const fullName = username;  // resolveUsername accepts a name or a raw SS58 address

    try {
      log.banner("PortalPay — Asset payment");
      log.step(1, "Resolving username");

      const address = await resolveUsername(fullName);
      if (!address) return setFormError(`Username '${fullName}' not found on Portaldot`);

      const hash = await sendAssetPayment(
        parseInt(assetId), address, parseFloat(amount), getSigner,
      );
      setTxHash(hash);
    } catch (err) {
      setFormError(err.message);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Connect your wallet to send</h2>
        <p style={{ color: "#6b7280", lineHeight: 1.7 }}>
          Click "Connect wallet" above. Install the Polkadot.js extension from{" "}
          <a href="https://polkadot.js.org/extension/" target="_blank" rel="noreferrer"
            style={{ color: "#6366f1" }}>
            polkadot.js.org/extension
          </a>{" "}
          if you haven't already.
        </p>
      </div>
    );
  }

  if (txHash) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontWeight: 800, marginBottom: 8, textTransform: "uppercase", letterSpacing: "-0.5px" }}>Payment sent</h2>
        <p style={{ color: "rgba(255,255,255,0.55)", marginBottom: 20 }}>
          Your POT has been sent and confirmed on Portaldot.
        </p>
        <div style={{
          background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 0, padding: "12px 16px",
          fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12, color: "#00FF00",
          wordBreak: "break-all", marginBottom: 20,
        }}>
          tx: {txHash}
        </div>
        <button
          onClick={() => { setTxHash(null); setUsername(""); setAmount(""); }}
          style={{
            padding: "11px 24px", borderRadius: 0, border: "none",
            background: "#00FF00", color: "#050505", fontSize: 13, fontWeight: 700, cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.12em", boxShadow: "0 0 15px rgba(0,255,0,0.2)",
          }}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>Send POT</h1>
      <p style={{ color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>
        Type a name instead of a 48-character address.
      </p>

      {/* Mode toggle */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        {[
          ["single", "Send to one"],
          ["split",  "Split pay"],
          ["memo",   "With memo"],
          ["asset",  "Pay a token"],
        ].map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "8px 16px", borderRadius: 0, fontSize: 12, border: "1px solid #1A1A1A",
            background: mode === m ? "#00FF00" : "transparent",
            color:      mode === m ? "#050505" : "rgba(255,255,255,0.6)",
            cursor: "pointer", fontWeight: mode === m ? 700 : 500,
            textTransform: "uppercase", letterSpacing: "0.1em",
            boxShadow: mode === m ? "0 0 15px rgba(0,255,0,0.2)" : "none",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Single pay form */}
      {mode === "single" && (
        <>
          <label style={LABEL}>
            Recipient username
          </label>
          <input
            style={INPUT} type="text"
            placeholder={`#42 or 5Grwva… address`}
            value={username}
            onChange={e => setUsername(e.target.value)}
          />

          <label style={LABEL}>
            Amount (POT)
          </label>
          <input
            style={INPUT} type="number" min="0.0001"
            placeholder="e.g. 5"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </>
      )}

      {/* Split pay form */}
      {mode === "split" && (
        <>
          {recipients.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <input
                style={{ ...INPUT, marginBottom: 0, flex: 2 }}
                type="text" placeholder={`#42 or 5Grwva… address`}
                value={r.username}
                onChange={e => updateRecipient(i, "username", e.target.value)}
              />
              <input
                style={{ ...INPUT, marginBottom: 0, flex: 1 }}
                type="number" min="0" placeholder="POT"
                value={r.amount}
                onChange={e => updateRecipient(i, "amount", e.target.value)}
              />
              {recipients.length > 2 && (
                <button onClick={() => removeRecipient(i)}
                  style={{ padding: "9px 11px", borderRadius: 0, border: "1px solid #1A1A1A",
                    background: "transparent", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14 }}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addRecipient}
            style={{ fontSize: 12, color: "#00FF00", background: "none",
              border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 16,
              textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}
          >
            + Add recipient
          </button>
        </>
      )}

      {/* Pay with memo form */}
      {mode === "memo" && (
        <>
          <label style={LABEL}>Recipient username</label>
          <input
            style={INPUT} type="text"
            placeholder={`#42 or 5Grwva… address`}
            value={username}
            onChange={e => setUsername(e.target.value)}
          />

          <label style={LABEL}>Amount (POT)</label>
          <input
            style={INPUT} type="number" min="0.0001"
            placeholder="e.g. 5"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />

          <label style={LABEL}>Memo / invoice note</label>
          <input
            style={INPUT} type="text"
            placeholder="e.g. Invoice #1024"
            value={memo}
            onChange={e => setMemo(e.target.value)}
          />
          <p style={{ fontSize: 11, color: "#9ca3af", marginTop: -8, marginBottom: 14, lineHeight: 1.5 }}>
            Sent in one atomic transaction via system.remarkWithEvent — the note text
            is recorded onchain and a tamper-proof hash is emitted as an event.
          </p>
        </>
      )}

      {/* Pay an asset form */}
      {mode === "asset" && (
        <>
          <label style={LABEL}>Asset id</label>
          <input
            style={INPUT} type="number" min="0"
            placeholder="e.g. 1"
            value={assetId}
            onChange={e => setAssetId(e.target.value)}
          />

          {/* Decimals + symbol are read from chain — no manual entry */}
          {assetMeta && (
            <p style={{ fontSize: 12, color: "#16a34a", marginTop: -8, marginBottom: 14 }}>
              ✓ {assetMeta.name || "Asset"} ({assetMeta.symbol || "—"}) · {assetMeta.decimals} decimals
            </p>
          )}
          {assetLookupError && (
            <p style={{ fontSize: 12, color: "#ef4444", marginTop: -8, marginBottom: 14 }}>
              {assetLookupError}
            </p>
          )}

          <label style={LABEL}>Recipient username</label>
          <input
            style={INPUT} type="text"
            placeholder={`#42 or 5Grwva… address`}
            value={username}
            onChange={e => setUsername(e.target.value)}
          />

          <label style={LABEL}>Amount{assetMeta?.symbol ? ` (${assetMeta.symbol})` : ""}</label>
          <input
            style={INPUT} type="number" min="0"
            placeholder="e.g. 25"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <p style={{ fontSize: 11, color: "#9ca3af", marginTop: -8, marginBottom: 14, lineHeight: 1.5 }}>
            Sends any Portaldot asset via assets.transferKeepAlive. Decimals are read
            from the chain (assets.metadata); the asset must already exist.
          </p>
        </>
      )}

      {(formError || payError) && (
        <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 14 }}>
          {formError || payError}
        </p>
      )}

      <button
        onClick={
          mode === "single" ? handleSinglePay
          : mode === "split" ? handleSplitPay
          : mode === "memo"  ? handleMemoPay
          : handleAssetPay
        }
        disabled={submitting || !api}
        style={{
          width: "100%", padding: 13, borderRadius: 0, border: "none",
          background: submitting ? "#1A1A1A" : "#00FF00",
          color: submitting ? "rgba(255,255,255,0.4)" : "#050505",
          fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
          cursor: submitting ? "default" : "pointer",
          boxShadow: submitting ? "none" : "0 0 15px rgba(0,255,0,0.2)",
        }}
      >
        {submitting
          ? "Waiting for confirmation…"
          : mode === "single" ? "Send POT"
          : mode === "split"  ? `Send to ${recipients.filter(r => r.username).length} people`
          : mode === "memo"   ? "Send with memo"
          : `Send asset${assetId ? ` #${assetId}` : ""}`}
      </button>

      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 10, textAlign: "center" }}>
        A small POT gas fee will be charged for this transaction.
      </p>
    </div>
  );
}
