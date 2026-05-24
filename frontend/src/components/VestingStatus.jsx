/**
 * components/VestingStatus.jsx
 * Shows vesting schedules for an address.
 * Used in Profile page and LockedPay page.
 *
 * Reads: vesting.vesting(AccountId32) → Vec<PalletVestingVestingInfo>
 * https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/vesting.html
 *
 * Each schedule shows:
 *   - Total locked amount
 *   - How much has unlocked so far
 *   - How much is still locked
 *   - Block at which it fully unlocks
 *   - Progress bar
 *
 * If the user is the owner of this address, shows a "Claim unlocked POT" button
 * which calls vesting.vest()
 */

import React, { useEffect, useState } from "react";
import { useVesting } from "../hooks/useVesting";

function ProgressBar({ pct }) {
  return (
    <div style={{
      height: 6, background: "#f3f4f6", borderRadius: 3,
      overflow: "hidden", marginTop: 8,
    }}>
      <div style={{
        height: "100%", borderRadius: 3,
        background: pct >= 100 ? "#22c55e" : "#6366f1",
        width: `${Math.min(100, pct)}%`,
        transition: "width 0.4s ease",
      }} />
    </div>
  );
}

export default function VestingStatus({ api, address, isOwner = false, getSigner }) {
  const { getVestingSchedules, vest, submitting, error } = useVesting(api);

  const [schedules, setSchedules] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [txHash,    setTxHash]    = useState(null);
  const [vestError, setVestError] = useState(null);

  useEffect(() => {
    if (!api || !address) return;
    setLoading(true);
    getVestingSchedules(address)
      .then(s => setSchedules(s))
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  }, [api, address, getVestingSchedules]);

  const handleVest = async () => {
    setVestError(null);
    setTxHash(null);
    try {
      const hash = await vest(getSigner);
      setTxHash(hash);
      // Refresh schedules after claiming
      const updated = await getVestingSchedules(address);
      setSchedules(updated);
    } catch (err) {
      setVestError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "12px 0", color: "#9ca3af", fontSize: 13 }}>
        Loading vesting schedules…
      </div>
    );
  }

  if (schedules.length === 0) return null;

  const hasUnlocked = schedules.some(s => s.unlocked > 0 && !s.isComplete);
  const totalLocked = schedules.reduce((sum, s) => sum + s.stillLocked, 0);

  return (
    <div style={{
      border: "1px solid #e0e7ff", borderRadius: 12,
      background: "#fafafe", padding: "16px 18px", marginTop: 16,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: "#374151" }}>
          Locked POT
        </span>
        <span style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 20,
          background: "#e0e7ff", color: "#3730a3",
        }}>
          {schedules.length} schedule{schedules.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Schedules */}
      {schedules.map((s, i) => {
        const pct = s.locked > 0 ? (s.unlocked / s.locked) * 100 : 0;

        return (
          <div key={i} style={{
            marginBottom: i < schedules.length - 1 ? 14 : 0,
            paddingBottom: i < schedules.length - 1 ? 14 : 0,
            borderBottom: i < schedules.length - 1 ? "1px solid #e0e7ff" : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 16, color: "#111" }}>
                  {s.stillLocked.toFixed(4)} POT
                </span>
                <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 6 }}>
                  locked
                </span>
              </div>
              {s.isComplete ? (
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 20,
                  background: "#dcfce7", color: "#166534",
                }}>
                  ✓ Fully unlocked
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "#9ca3af" }}>
                  ~{s.blocksLeft} blocks left
                </span>
              )}
            </div>

            {/* Unlocked so far */}
            {s.unlocked > 0 && (
              <div style={{ fontSize: 12, color: "#6366f1", marginBottom: 4 }}>
                {s.unlocked.toFixed(4)} POT ready to claim
              </div>
            )}

            {/* Progress bar */}
            <ProgressBar pct={pct} />

            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 11, color: "#9ca3af", marginTop: 4,
            }}>
              <span>Start block {s.startBlock}</span>
              <span>{pct.toFixed(0)}% unlocked</span>
              <span>End block {s.endBlock}</span>
            </div>
          </div>
        );
      })}

      {/* Claim button — only shown to the owner when something is unlocked */}
      {isOwner && (hasUnlocked || schedules.some(s => s.isComplete)) && (
        <div style={{ marginTop: 16 }}>
          {txHash && (
            <div style={{
              fontSize: 12, color: "#16a34a", marginBottom: 8,
              fontFamily: "monospace", wordBreak: "break-all",
            }}>
              ✓ Claimed — tx: {txHash.slice(0, 20)}…
            </div>
          )}
          {vestError && (
            <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 8 }}>
              {vestError}
            </div>
          )}
          <button
            onClick={handleVest}
            disabled={submitting}
            style={{
              width: "100%", padding: "10px", borderRadius: 8, border: "none",
              background: submitting ? "#9ca3af" : "#6366f1",
              color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: submitting ? "default" : "pointer",
            }}
          >
            {submitting
              ? "Claiming…"
              : `Claim ${schedules.reduce((sum, s) => sum + s.unlocked, 0).toFixed(4)} POT`}
          </button>
          <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 6 }}>
            Calls vesting.vest() — small POT gas fee
          </p>
        </div>
      )}

      {/* Total summary */}
      {schedules.length > 1 && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: "1px solid #e0e7ff",
          display: "flex", justifyContent: "space-between",
          fontSize: 12, color: "#6b7280",
        }}>
          <span>Total locked</span>
          <span style={{ fontWeight: 600 }}>{totalLocked.toFixed(4)} POT</span>
        </div>
      )}
    </div>
  );
}
