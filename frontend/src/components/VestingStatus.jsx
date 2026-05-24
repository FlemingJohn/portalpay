/**
 * components/VestingStatus.jsx
 * Shows vesting schedules for an address (vesting.vesting storage).
 * If the viewer owns the address, shows a "Claim unlocked POT" button (vesting.vest).
 * https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/vesting.html
 */

import React, { useEffect, useState } from "react";
import { useVesting } from "../hooks/useVesting";

function ProgressBar({ pct }) {
  return (
    <div style={{
      height: 6, background: "#1A1A1A", borderRadius: 0,
      overflow: "hidden", marginTop: 8,
    }}>
      <div style={{
        height: "100%", borderRadius: 0,
        background: "#00FF00",
        boxShadow: "0 0 8px rgba(0,255,0,0.4)",
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
      const updated = await getVestingSchedules(address);
      setSchedules(updated);
    } catch (err) {
      setVestError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "12px 0", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
        Loading vesting schedules…
      </div>
    );
  }

  if (schedules.length === 0) return null;

  const hasUnlocked = schedules.some(s => s.unlocked > 0 && !s.isComplete);
  const totalLocked = schedules.reduce((sum, s) => sum + s.stillLocked, 0);

  return (
    <div style={{
      border: "1px solid #1A1A1A", borderRadius: 0,
      background: "#0A0A0A", padding: "16px 18px", marginTop: 16,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        <span style={{ fontWeight: 600, fontSize: 12, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          Locked POT
        </span>
        <span style={{
          fontSize: 10, padding: "2px 8px", borderRadius: 0,
          background: "rgba(0,255,0,0.1)", color: "#00FF00", border: "1px solid rgba(0,255,0,0.3)",
          textTransform: "uppercase", letterSpacing: "0.1em",
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
            borderBottom: i < schedules.length - 1 ? "1px solid #1A1A1A" : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 16, color: "#ffffff", fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
                  {s.stillLocked.toFixed(4)} POT
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 6 }}>
                  locked
                </span>
              </div>
              {s.isComplete ? (
                <span style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 0,
                  background: "rgba(0,255,0,0.1)", color: "#00FF00", border: "1px solid rgba(0,255,0,0.3)",
                  textTransform: "uppercase", letterSpacing: "0.1em",
                }}>
                  ✓ Fully unlocked
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  ~{s.blocksLeft} blocks left
                </span>
              )}
            </div>

            {/* Unlocked so far */}
            {s.unlocked > 0 && (
              <div style={{ fontSize: 12, color: "#00FF00", marginBottom: 4 }}>
                {s.unlocked.toFixed(4)} POT ready to claim
              </div>
            )}

            <ProgressBar pct={pct} />

            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            }}>
              <span>Start {s.startBlock}</span>
              <span>{pct.toFixed(0)}% unlocked</span>
              <span>End {s.endBlock}</span>
            </div>
          </div>
        );
      })}

      {/* Claim button — only shown to the owner when something is unlocked */}
      {isOwner && (hasUnlocked || schedules.some(s => s.isComplete)) && (
        <div style={{ marginTop: 16 }}>
          {txHash && (
            <div style={{
              fontSize: 12, color: "#00FF00", marginBottom: 8,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace', wordBreak: "break-all",
            }}>
              ✓ Claimed — tx: {txHash.slice(0, 20)}…
            </div>
          )}
          {vestError && (
            <div style={{ fontSize: 12, color: "#f87171", marginBottom: 8 }}>
              {vestError}
            </div>
          )}
          <button
            onClick={handleVest}
            disabled={submitting}
            style={{
              width: "100%", padding: "11px", borderRadius: 0, border: "none",
              background: submitting ? "#1A1A1A" : "#00FF00",
              color: submitting ? "rgba(255,255,255,0.4)" : "#050505",
              fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
              cursor: submitting ? "default" : "pointer",
              boxShadow: submitting ? "none" : "0 0 15px rgba(0,255,0,0.2)",
            }}
          >
            {submitting
              ? "Claiming…"
              : `Claim ${schedules.reduce((sum, s) => sum + s.unlocked, 0).toFixed(4)} POT`}
          </button>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 6 }}>
            Calls vesting.vest() — small POT gas fee
          </p>
        </div>
      )}

      {/* Total summary */}
      {schedules.length > 1 && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: "1px solid #1A1A1A",
          display: "flex", justifyContent: "space-between",
          fontSize: 12, color: "rgba(255,255,255,0.5)",
        }}>
          <span>Total locked</span>
          <span style={{ fontWeight: 600, color: "#ffffff", fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>{totalLocked.toFixed(4)} POT</span>
        </div>
      )}
    </div>
  );
}
