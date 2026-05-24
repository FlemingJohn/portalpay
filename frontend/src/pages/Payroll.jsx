/**
 * pages/Payroll.jsx
 * Self-executing payroll — a recurring batch payment the chain runs itself.
 *
 * Schedules a utility.batchAll of transfers to repeat every N blocks, M times,
 * via scheduler.scheduleNamedAfter. No keeper bot, no server, no contract —
 * pay your whole team by name, automatically.
 *
 * Pallets:
 *   scheduler.scheduleNamedAfter
 *     https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/scheduler.html
 *   utility.batchAll
 *     https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/utility.html
 *
 * Linear flow:
 *   1. Enter recipients (name + amount), period, repetitions
 *   2. Resolve all usernames → addresses
 *   3. Build batchAll([...transferKeepAlive])
 *   4. scheduleCall(batchAll, { afterBlocks, periodBlocks, repetitions })
 */

import React, { useState } from "react";
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

export default function Payroll({ api, getSigner, isConnected }) {
  const { resolveUsername } = useIdentity(api);
  const { scheduleCall, submitting, error: schedErr } = useScheduler(api);

  const [recipients, setRecipients] = useState([
    { username: "", amount: "" },
    { username: "", amount: "" },
  ]);
  const [periodBlocks, setPeriod]       = useState("100");
  const [repetitions,  setRepetitions]  = useState("12");
  const [txHash,       setTxHash]       = useState(null);
  const [formError,    setFormError]    = useState(null);

  const updateRecipient = (i, field, val) =>
    setRecipients(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      return next;
    });

  const addRecipient = () =>
    setRecipients(prev => [...prev, { username: "", amount: "" }]);

  const removeRecipient = (i) =>
    setRecipients(prev => prev.filter((_, idx) => idx !== i));

  const handleSchedule = async () => {
    setFormError(null);
    setTxHash(null);

    const valid = recipients.filter(r => r.username.trim() && parseFloat(r.amount) > 0);
    if (valid.length < 1) return setFormError("Add at least one recipient");

    const period = parseInt(periodBlocks);
    const reps   = parseInt(repetitions);
    if (!period || period < 1) return setFormError("Enter a valid period");
    if (!reps || reps < 1)     return setFormError("Enter a valid number of payments");

    try {
      log.banner("PortalPay — Payroll");
      log.step(1, `Resolving ${valid.length} usernames`);

      // 1. Resolve every recipient name → address
      const resolved = await Promise.all(valid.map(async r => {
        const fullName = r.username.includes(".") ? r.username : `${r.username}.${POT_SUFFIX}`;
        const addr     = await resolveUsername(fullName);
        if (!addr) throw new Error(`Username '${fullName}' not found`);
        return { addr, amountPot: parseFloat(r.amount) };
      }));

      // 2. Build one atomic batch of transfers
      const calls     = resolved.map(r =>
        api.tx.balances.transferKeepAlive(r.addr, potToPlanck(r.amountPot)));
      const batchCall = api.tx.utility.batchAll(calls);

      // 3. Schedule the batch to repeat — the chain fires it itself
      const { txHash } = await scheduleCall(
        batchCall, { afterBlocks: 5, periodBlocks: period, repetitions: reps }, getSigner,
      );
      setTxHash(txHash);
    } catch (err) {
      setFormError(err.message);
    }
  };

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>💼</div>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Connect your wallet first</h2>
        <p style={{ color: "#6b7280", lineHeight: 1.7 }}>
          Click "Connect wallet" to schedule payroll.
        </p>
      </div>
    );
  }

  if (txHash) {
    const validCount = recipients.filter(r => r.username.trim()).length;
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>💸</div>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Payroll scheduled</h2>
        <p style={{ color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
          The chain will pay {validCount} {validCount === 1 ? "person" : "people"} every
          {" "}{periodBlocks} blocks, {repetitions} times — automatically, with no bot.
        </p>
        <div style={{
          background: "#f9fafb", borderRadius: 8, padding: "12px 16px",
          fontFamily: "monospace", fontSize: 12, color: "#374151",
          wordBreak: "break-all", marginBottom: 20,
        }}>
          tx: {txHash}
        </div>
        <button onClick={() => setTxHash(null)}
          style={{
            padding: "10px 24px", borderRadius: 8, border: "none",
            background: "#111", color: "#fff", fontSize: 14, cursor: "pointer",
          }}>
          Schedule another
        </button>
      </div>
    );
  }

  const total = recipients.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>Payroll</h1>
      <p style={{ color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>
        Pay your whole team by name on a schedule. The chain fires the batch itself —
        no server, no cron, no contract.
      </p>

      {recipients.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
          <input
            style={{ ...INPUT, marginBottom: 0, flex: 2 }}
            type="text" placeholder={`username.${POT_SUFFIX}`}
            value={r.username}
            onChange={e => updateRecipient(i, "username", e.target.value)}
          />
          <input
            style={{ ...INPUT, marginBottom: 0, flex: 1 }}
            type="number" min="0" placeholder="POT"
            value={r.amount}
            onChange={e => updateRecipient(i, "amount", e.target.value)}
          />
          {recipients.length > 1 && (
            <button onClick={() => removeRecipient(i)}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #e5e7eb",
                background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 14 }}>
              ✕
            </button>
          )}
        </div>
      ))}
      <button onClick={addRecipient}
        style={{ fontSize: 13, color: "#6366f1", background: "none",
          border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 16 }}>
        + Add recipient
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={LABEL}>Pay every (blocks)</label>
          <input style={INPUT} type="number" min="1"
            placeholder="e.g. 100"
            value={periodBlocks} onChange={e => setPeriod(e.target.value)} />
        </div>
        <div>
          <label style={LABEL}>Number of pay runs</label>
          <input style={INPUT} type="number" min="1" max="100"
            placeholder="e.g. 12"
            value={repetitions} onChange={e => setRepetitions(e.target.value)} />
        </div>
      </div>

      {total > 0 && periodBlocks && repetitions && (
        <div style={{
          background: "#fafafe", border: "1px solid #e0e7ff",
          borderRadius: 8, padding: "10px 14px", marginBottom: 14,
          fontSize: 13, color: "#374151", lineHeight: 1.6,
        }}>
          <strong>{(total * parseInt(repetitions || 0)).toFixed(4)} POT</strong> total
          {" "}— {total.toFixed(4)} POT per run × {repetitions} runs
        </div>
      )}

      {(formError || schedErr) && (
        <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 14 }}>
          {formError || schedErr}
        </p>
      )}

      <button onClick={handleSchedule} disabled={submitting || !api}
        style={{
          width: "100%", padding: 13, borderRadius: 8, border: "none",
          background: submitting ? "#9ca3af" : "#111",
          color: "#fff", fontSize: 15, fontWeight: 600,
          cursor: submitting ? "default" : "pointer",
        }}>
        {submitting ? "Scheduling onchain…" : "Schedule payroll"}
      </button>

      <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
        scheduler.scheduleNamedAfter wrapping utility.batchAll — fully native
      </p>
    </div>
  );
}
