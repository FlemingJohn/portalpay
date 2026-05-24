/**
 * pages/LockedPay.jsx
 * Two features on one page:
 *
 * TAB 1 — Locked Payment (Pay on Delivery)
 *   Send POT to a username but it unlocks gradually over N blocks.
 *   The recipient can see it locked in their wallet but cannot spend it yet.
 *   When the blocks pass, they call vest() to claim it.
 *
 *   Extrinsic: vesting.vestedTransfer(target, schedule)
 *   https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/vesting.html
 *
 * TAB 2 — Recurring Payment
 *   Schedule a payment to fire automatically at a future block,
 *   optionally repeating every N blocks.
 *
 *   Extrinsic: scheduler.scheduleNamed(id, when, maybe_periodic, priority, call)
 *   https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/scheduler.html
 *
 *   maybe_periodic = (period_blocks, repetitions) — enables recurring payments
 *   The id is a [u8;32] — we derive it from username + timestamp
 *
 * Linear flow for Locked Pay:
 *   1. Sender types username + amount + unlock blocks
 *   2. App resolves username → address
 *   3. vesting.vestedTransfer called → POT locked onchain
 *   4. Recipient sees locked balance on their profile
 *   5. After N blocks, recipient calls vest() → POT arrives
 *
 * Linear flow for Recurring Pay:
 *   1. Sender types username + amount + start block + period + repetitions
 *   2. App resolves username → address
 *   3. scheduler.scheduleNamed called → task registered onchain
 *   4. Chain automatically fires balances.transferKeepAlive at each scheduled block
 *   5. Sender can cancel anytime with scheduler.cancelNamed
 */

import React, { useState } from "react";
import { useIdentity }  from "../hooks/useIdentity";
import { useVesting  }  from "../hooks/useVesting";
import { useScheduler } from "../hooks/useScheduler";
import { log          } from "../lib/logger";
import { POT_SUFFIX, potToPlanck } from "../lib/chain";
import VestingStatus from "../components/VestingStatus";

const INPUT = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  border: "1px solid #e5e7eb", fontSize: 14,
  boxSizing: "border-box", marginBottom: 14,
};
const LABEL = {
  fontSize: 13, fontWeight: 500, color: "#374151",
  display: "block", marginBottom: 6,
};

// ── Recurring Pay — uses scheduler.scheduleNamed ──────────────────────────

function RecurringPayForm({ api, getSigner, isConnected }) {
  const { resolveUsername } = useIdentity(api);
  const { scheduleCall }    = useScheduler(api);

  const [username,    setUsername]    = useState("");
  const [amount,      setAmount]      = useState("");
  const [periodBlocks, setPeriod]     = useState("100");
  const [repetitions, setRepetitions] = useState("10");
  const [submitting,  setSubmitting]  = useState(false);
  const [txHash,      setTxHash]      = useState(null);
  const [error,       setError]       = useState(null);

  const handleSchedule = async () => {
    setError(null);
    setTxHash(null);
    if (!username.trim()) return setError("Enter a username");
    if (!amount || parseFloat(amount) <= 0) return setError("Enter a valid amount");

    setSubmitting(true);
    try {
      log.banner("PortalPay — Recurring Payment");
      log.step(1, "Resolving username");

      const fullName = username.includes(".") ? username : `${username}.${POT_SUFFIX}`;
      const destAddr = await resolveUsername(fullName);
      if (!destAddr) throw new Error(`Username '${fullName}' not found`);

      // The chain runs this transfer itself, every period, with no keeper bot
      const transferCall = api.tx.balances.transferKeepAlive(
        destAddr,
        potToPlanck(parseFloat(amount)),
      );
      const { txHash } = await scheduleCall(
        transferCall,
        {
          afterBlocks:  5,
          periodBlocks: parseInt(periodBlocks),
          repetitions:  parseInt(repetitions),
        },
        getSigner,
      );

      setTxHash(txHash);
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  if (txHash) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>⏰</div>
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Recurring payment scheduled</h3>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 12, lineHeight: 1.6 }}>
          The Portaldot chain will automatically send {amount} POT to {username}{" "}
          every {periodBlocks} blocks, {repetitions} times.
          No action needed — the chain handles it.
        </p>
        <div style={{
          background: "#f9fafb", borderRadius: 8, padding: 12,
          fontFamily: "monospace", fontSize: 11, color: "#374151",
          wordBreak: "break-all", marginBottom: 16,
        }}>
          tx: {txHash}
        </div>
        <button onClick={() => { setTxHash(null); setUsername(""); setAmount(""); }}
          style={{
            padding: "10px 20px", borderRadius: 8, border: "none",
            background: "#111", color: "#fff", fontSize: 14, cursor: "pointer",
          }}>
          Schedule another
        </button>
      </div>
    );
  }

  return (
    <>
      <p style={{ color: "#6b7280", margin: "0 0 20px", lineHeight: 1.6, fontSize: 14 }}>
        Schedule automatic recurring payments. The Portaldot chain fires them at the right block —
        no server, no cron job, no action needed from you.
      </p>

      <label style={LABEL}>Recipient username</label>
      <input style={INPUT} type="text"
        placeholder={`e.g. bob.${POT_SUFFIX}`}
        value={username} onChange={e => setUsername(e.target.value)} />

      <label style={LABEL}>Amount per payment (POT)</label>
      <input style={INPUT} type="number" min="0.0001"
        placeholder="e.g. 10"
        value={amount} onChange={e => setAmount(e.target.value)} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={LABEL}>Repeat every (blocks)</label>
          <input style={INPUT} type="number" min="1"
            placeholder="e.g. 100"
            value={periodBlocks} onChange={e => setPeriod(e.target.value)} />
        </div>
        <div>
          <label style={LABEL}>Number of payments</label>
          <input style={INPUT} type="number" min="1" max="100"
            placeholder="e.g. 10"
            value={repetitions} onChange={e => setRepetitions(e.target.value)} />
        </div>
      </div>

      {periodBlocks && repetitions && amount && (
        <div style={{
          background: "#fafafe", border: "1px solid #e0e7ff",
          borderRadius: 8, padding: "10px 14px", marginBottom: 14,
          fontSize: 13, color: "#374151", lineHeight: 1.6,
        }}>
          Total: <strong>{(parseFloat(amount || 0) * parseInt(repetitions || 0)).toFixed(4)} POT</strong>
          {" "}paid over <strong>{(parseInt(periodBlocks || 0) * parseInt(repetitions || 0))} blocks</strong>
        </div>
      )}

      {error && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 14 }}>{error}</p>}

      <button onClick={handleSchedule} disabled={submitting || !api}
        style={{
          width: "100%", padding: 13, borderRadius: 8, border: "none",
          background: submitting ? "#9ca3af" : "#111",
          color: "#fff", fontSize: 15, fontWeight: 600,
          cursor: submitting ? "default" : "pointer",
        }}>
        {submitting ? "Scheduling on chain…" : "Schedule recurring payment"}
      </button>

      <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
        Uses scheduler.scheduleNamed — chain executes payments automatically
      </p>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function LockedPay({ api, getSigner, isConnected, walletAddress }) {
  const { resolveUsername }                          = useIdentity(api);
  const { vestedTransfer, submitting, error: vErr }  = useVesting(api);

  const [tab,          setTab]         = useState("locked");
  const [username,     setUsername]    = useState("");
  const [amount,       setAmount]      = useState("");
  const [unlockBlocks, setUnlockBlocks]= useState("50");
  const [txHash,       setTxHash]      = useState(null);
  const [destAddr,     setDestAddr]    = useState(null);
  const [formError,    setFormError]   = useState(null);

  const handleLockedPay = async () => {
    setFormError(null);
    setTxHash(null);
    if (!username.trim()) return setFormError("Enter a username");
    if (!amount || parseFloat(amount) <= 0) return setFormError("Enter a valid amount");
    if (!unlockBlocks || parseInt(unlockBlocks) < 1) return setFormError("Enter unlock blocks");

    try {
      log.banner("PortalPay — Locked Payment");
      log.step(1, "Resolving username");

      const fullName = username.includes(".") ? username : `${username}.${POT_SUFFIX}`;
      const addr     = await resolveUsername(fullName);
      if (!addr) return setFormError(`Username '${fullName}' not found`);

      setDestAddr(addr);
      const hash = await vestedTransfer(addr, parseFloat(amount), parseInt(unlockBlocks), getSigner);
      setTxHash(hash);
    } catch (err) {
      setFormError(err.message);
    }
  };

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Connect your wallet first</h2>
        <p style={{ color: "#6b7280", lineHeight: 1.7 }}>
          Click "Connect wallet" to use locked or recurring payments.
        </p>
      </div>
    );
  }

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{
      padding: "8px 18px", borderRadius: 8, border: "none",
      background: tab === id ? "#111" : "#f3f4f6",
      color:      tab === id ? "#fff" : "#374151",
      fontSize: 14, cursor: "pointer",
      fontWeight: tab === id ? 600 : 400,
    }}>
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>Advanced payments</h1>
      <p style={{ color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>
        Native Portaldot pallet features — no smart contracts.
      </p>

      {/* Tab toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {tabBtn("locked",    "🔒 Locked payment")}
        {tabBtn("recurring", "⏰ Recurring payment")}
      </div>

      {/* ── Locked payment tab ── */}
      {tab === "locked" && (
        <>
          {txHash ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
              <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Payment locked</h3>
              <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 12, lineHeight: 1.6 }}>
                {amount} POT is now locked onchain for {username}.
                It unlocks over the next {unlockBlocks} blocks.
                They can see it in their wallet already — but cannot spend it yet.
              </p>
              <div style={{
                background: "#f9fafb", borderRadius: 8, padding: 12,
                fontFamily: "monospace", fontSize: 11, color: "#374151",
                wordBreak: "break-all", marginBottom: 16,
              }}>
                tx: {txHash}
              </div>
              {destAddr && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
                    Recipient vesting status:
                  </p>
                  <VestingStatus api={api} address={destAddr} isOwner={false} />
                </div>
              )}
              <button onClick={() => { setTxHash(null); setUsername(""); setAmount(""); }}
                style={{
                  padding: "10px 20px", borderRadius: 8, border: "none",
                  background: "#111", color: "#fff", fontSize: 14, cursor: "pointer",
                }}>
                Send another
              </button>
            </div>
          ) : (
            <>
              <p style={{ color: "#6b7280", margin: "0 0 20px", lineHeight: 1.6, fontSize: 14 }}>
                Lock POT for a recipient — they can see it immediately but cannot spend it
                until the unlock blocks pass. Perfect for milestone-based payments.
              </p>

              <label style={LABEL}>Recipient username</label>
              <input style={INPUT} type="text"
                placeholder={`e.g. bob.${POT_SUFFIX}`}
                value={username} onChange={e => setUsername(e.target.value)} />

              <label style={LABEL}>Amount (POT)</label>
              <input style={INPUT} type="number" min="0.0001"
                placeholder="e.g. 50"
                value={amount} onChange={e => setAmount(e.target.value)} />

              <label style={LABEL}>Unlock over how many blocks?</label>
              <input style={INPUT} type="number" min="1"
                placeholder="e.g. 50  (on local node ≈ 5 minutes)"
                value={unlockBlocks} onChange={e => setUnlockBlocks(e.target.value)} />

              {amount && unlockBlocks && (
                <div style={{
                  background: "#fafafe", border: "1px solid #e0e7ff",
                  borderRadius: 8, padding: "10px 14px", marginBottom: 14,
                  fontSize: 13, color: "#374151",
                }}>
                  {parseFloat(amount || 0).toFixed(4)} POT unlocks gradually over {unlockBlocks} blocks
                  — ~{(parseFloat(amount || 0) / parseInt(unlockBlocks || 1)).toFixed(4)} POT per block
                </div>
              )}

              {(formError || vErr) && (
                <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 14 }}>
                  {formError || vErr}
                </p>
              )}

              <button onClick={handleLockedPay} disabled={submitting || !api}
                style={{
                  width: "100%", padding: 13, borderRadius: 8, border: "none",
                  background: submitting ? "#9ca3af" : "#111",
                  color: "#fff", fontSize: 15, fontWeight: 600,
                  cursor: submitting ? "default" : "pointer",
                }}>
                {submitting ? "Locking payment…" : "Lock payment"}
              </button>

              <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
                Uses vesting.vestedTransfer — POT is locked by the chain, not a contract
              </p>

              {/* Show own vesting status if wallet connected */}
              {walletAddress && (
                <div style={{ marginTop: 24 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 8 }}>
                    Your locked incoming payments
                  </p>
                  <VestingStatus
                    api={api}
                    address={walletAddress}
                    isOwner={true}
                    getSigner={getSigner}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Recurring payment tab ── */}
      {tab === "recurring" && (
        <RecurringPayForm api={api} getSigner={getSigner} isConnected={isConnected} />
      )}
    </div>
  );
}
