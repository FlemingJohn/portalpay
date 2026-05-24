/**
 * pages/Heir.jsx
 * Dead-man's-switch inheritance — native, no contract, no keeper bot.
 *
 * Set an heir by username + amount. The chain schedules a one-shot release to
 * them after an inactivity window (scheduler.scheduleNamedAfter). Tapping
 * "I'm here" cancels the pending release and reschedules it further out
 * (scheduler.cancelNamed + scheduleNamedAfter). If you ever go silent, the
 * chain sends the POT to your heir on its own — no oracle, no bot, no contract.
 *
 * Pallet: scheduler
 *   https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/scheduler.html
 *
 * Linear flow:
 *   Set heir  → resolve username → build transfer call → scheduleCall(after window)
 *   I'm here  → cancelScheduled(old) → scheduleCall(after window) → save new id
 *   Cancel    → cancelScheduled(old) → clear
 */

import React, { useState, useEffect } from "react";
import { useIdentity }  from "../hooks/useIdentity";
import { useScheduler } from "../hooks/useScheduler";
import { log }          from "../lib/logger";
import { POT_SUFFIX, potToPlanck } from "../lib/chain";

const INPUT = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  border: "1px solid #e5e7eb", fontSize: 14,
  boxSizing: "border-box", marginBottom: 14,
};
const LABEL = {
  fontSize: 13, fontWeight: 500, color: "#374151",
  display: "block", marginBottom: 6,
};

const storageKey = (addr) => `portalpay:heir:${addr}`;

export default function Heir({ api, getSigner, isConnected, walletAddress }) {
  const { resolveUsername } = useIdentity(api);
  const { getCurrentBlock, scheduleCall, cancelScheduled, submitting, error: schedErr } =
    useScheduler(api);

  const [heirUsername, setHeirUsername] = useState("");
  const [amount,       setAmount]       = useState("");
  const [windowBlocks, setWindowBlocks] = useState("100");
  const [record,       setRecord]       = useState(null);  // saved heir setup
  const [currentBlock, setCurrentBlock] = useState(null);
  const [formError,    setFormError]    = useState(null);

  // Load any saved heir setup for this wallet
  useEffect(() => {
    if (!walletAddress) { setRecord(null); return; }
    const saved = localStorage.getItem(storageKey(walletAddress));
    setRecord(saved ? JSON.parse(saved) : null);
  }, [walletAddress]);

  // Keep the current block fresh for the countdown
  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    getCurrentBlock().then(b => { if (!cancelled) setCurrentBlock(b); }).catch(() => {});
    return () => { cancelled = true; };
  }, [api, record, getCurrentBlock]);

  const save = (rec) => {
    setRecord(rec);
    if (!walletAddress) return;
    if (rec) localStorage.setItem(storageKey(walletAddress), JSON.stringify(rec));
    else     localStorage.removeItem(storageKey(walletAddress));
  };

  // Set heir → schedule a one-shot release after the inactivity window
  const handleSetHeir = async () => {
    setFormError(null);
    if (!heirUsername.trim()) return setFormError("Enter your heir's username");
    if (!amount || parseFloat(amount) <= 0) return setFormError("Enter a valid amount");
    const window = parseInt(windowBlocks);
    if (!window || window < 1) return setFormError("Enter an inactivity window in blocks");

    try {
      log.banner("PortalPay — Set heir");
      const fullName = heirUsername.includes(".") ? heirUsername : `${heirUsername}.${POT_SUFFIX}`;
      const heirAddr = await resolveUsername(fullName);
      if (!heirAddr) return setFormError(`Username '${fullName}' not found`);

      const innerCall = api.tx.balances.transferKeepAlive(heirAddr, potToPlanck(parseFloat(amount)));
      const { taskIdHex } = await scheduleCall(innerCall, { afterBlocks: window }, getSigner);

      const now = await getCurrentBlock();
      save({
        taskIdHex, heir: fullName, heirAddr,
        amount: parseFloat(amount), windowBlocks: window, scheduledAtBlock: now,
      });
      setCurrentBlock(now);
    } catch (err) {
      setFormError(err.message);
    }
  };

  // "I'm here" → cancel the pending release, reschedule a fresh one
  const handleCheckIn = async () => {
    if (!record) return;
    setFormError(null);
    try {
      log.banner("PortalPay — Heir check-in");
      await cancelScheduled(record.taskIdHex, getSigner);

      const innerCall = api.tx.balances.transferKeepAlive(
        record.heirAddr, potToPlanck(record.amount),
      );
      const { taskIdHex } = await scheduleCall(
        innerCall, { afterBlocks: record.windowBlocks }, getSigner,
      );

      const now = await getCurrentBlock();
      save({ ...record, taskIdHex, scheduledAtBlock: now });
      setCurrentBlock(now);
    } catch (err) {
      setFormError(err.message);
    }
  };

  // Cancel → remove the scheduled release entirely
  const handleCancel = async () => {
    if (!record) return;
    setFormError(null);
    try {
      log.banner("PortalPay — Cancel heir");
      await cancelScheduled(record.taskIdHex, getSigner);
      save(null);
    } catch (err) {
      setFormError(err.message);
    }
  };

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🕊️</div>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Connect your wallet first</h2>
        <p style={{ color: "#6b7280", lineHeight: 1.7 }}>
          Click "Connect wallet" to set up an heir.
        </p>
      </div>
    );
  }

  const releaseBlock = record ? record.scheduledAtBlock + record.windowBlocks : null;
  const blocksLeft   = (releaseBlock != null && currentBlock != null)
    ? Math.max(0, releaseBlock - currentBlock)
    : null;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>Inheritance</h1>
      <p style={{ color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>
        A dead-man's switch for your POT. The chain releases it to your heir if you
        go silent — no contract, no oracle, no bot.
      </p>

      {/* Active heir setup */}
      {record ? (
        <div style={{
          border: "1px solid #e0e7ff", background: "#fafafe",
          borderRadius: 12, padding: 20, marginBottom: 16,
        }}>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>Heir</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{record.heir}</div>

          <div style={{ display: "flex", gap: 24, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Amount</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{record.amount} POT</div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Releases in</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {blocksLeft != null ? `~${blocksLeft} blocks` : "…"}
              </div>
            </div>
          </div>

          <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, lineHeight: 1.6 }}>
            If you don't check in before block {releaseBlock ?? "…"}, the chain sends
            {" "}{record.amount} POT to {record.heir} automatically.
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleCheckIn} disabled={submitting}
              style={{
                flex: 1, padding: 12, borderRadius: 8, border: "none",
                background: submitting ? "#9ca3af" : "#111",
                color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: submitting ? "default" : "pointer",
              }}>
              {submitting ? "Working…" : "✋ I'm here (reset timer)"}
            </button>
            <button onClick={handleCancel} disabled={submitting}
              style={{
                padding: "12px 16px", borderRadius: 8,
                border: "1px solid #e5e7eb", background: "#fff",
                color: "#6b7280", fontSize: 14, cursor: "pointer",
              }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <label style={LABEL}>Heir username</label>
          <input style={INPUT} type="text"
            placeholder={`e.g. alice.${POT_SUFFIX}`}
            value={heirUsername} onChange={e => setHeirUsername(e.target.value)} />

          <label style={LABEL}>Amount to release (POT)</label>
          <input style={INPUT} type="number" min="0.0001"
            placeholder="e.g. 100"
            value={amount} onChange={e => setAmount(e.target.value)} />

          <label style={LABEL}>Inactivity window (blocks)</label>
          <input style={INPUT} type="number" min="1"
            placeholder="e.g. 100  (on local node ≈ 10 minutes)"
            value={windowBlocks} onChange={e => setWindowBlocks(e.target.value)} />
          <p style={{ fontSize: 11, color: "#9ca3af", marginTop: -8, marginBottom: 14, lineHeight: 1.5 }}>
            The release fires this many blocks after your last check-in. Tap
            "I'm here" any time to push it back.
          </p>

          <button onClick={handleSetHeir} disabled={submitting || !api}
            style={{
              width: "100%", padding: 13, borderRadius: 8, border: "none",
              background: submitting ? "#9ca3af" : "#111",
              color: "#fff", fontSize: 15, fontWeight: 600,
              cursor: submitting ? "default" : "pointer",
            }}>
            {submitting ? "Scheduling onchain…" : "Set heir"}
          </button>

          <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
            Uses scheduler.scheduleNamedAfter — the chain releases the funds itself
          </p>
        </>
      )}

      {(formError || schedErr) && (
        <p style={{ color: "#ef4444", fontSize: 13, marginTop: 14 }}>
          {formError || schedErr}
        </p>
      )}
    </div>
  );
}
