/**
 * pages/LockedPay.jsx
 * Locked payment — vesting.vestedTransfer. Funds are visible to the recipient
 * immediately but unlock gradually over blocks, enforced natively by the chain
 * (no smart contract). Good for milestone / on-delivery payments.
 *
 * https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/vesting.html
 */

import React, { useState } from "react";
import { useIdentity } from "../hooks/useIdentity";
import { useVesting  } from "../hooks/useVesting";
import { log }         from "../lib/logger";
import { POT_SUFFIX }  from "../lib/chain";
import VestingStatus from "../components/VestingStatus";

// This runtime's vesting pallet enforces a minimum vested-transfer amount.
const MIN_VESTED_POT = 100;

const INPUT = {
  width: "100%", padding: "11px 14px", borderRadius: 0,
  border: "1px solid #1A1A1A", background: "#0A0A0A", color: "#ffffff",
  fontSize: 14, boxSizing: "border-box", marginBottom: 14, outline: "none",
};
const LABEL = {
  fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)",
  display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.12em",
};
const PRIMARY_BTN = (submitting) => ({
  width: "100%", padding: 13, borderRadius: 0, border: "none",
  background: submitting ? "#1A1A1A" : "#00FF00",
  color: submitting ? "rgba(255,255,255,0.4)" : "#050505",
  fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
  cursor: submitting ? "default" : "pointer",
  boxShadow: submitting ? "none" : "0 0 15px rgba(0,255,0,0.2)",
});
const TX_BOX = {
  background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 0, padding: 12,
  fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, color: "#00FF00",
  wordBreak: "break-all", marginBottom: 16,
};
const INFO_BOX = {
  background: "#0A0A0A", border: "1px solid #1A1A1A",
  borderRadius: 0, padding: "10px 14px", marginBottom: 14,
  fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.6,
};
const FOOTNOTE = { fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 8 };

export default function LockedPay({ api, getSigner, isConnected, walletAddress }) {
  const { resolveUsername }                          = useIdentity(api);
  const { vestedTransfer, submitting, error: vErr }  = useVesting(api);

  const [username,     setUsername]    = useState("");
  const [amount,       setAmount]      = useState("");
  const [unlockBlocks, setUnlockBlocks]= useState("50");
  const [txHash,       setTxHash]      = useState(null);
  const [destAddr,     setDestAddr]    = useState(null);
  const [formError,    setFormError]   = useState(null);

  const handleLockedPay = async () => {
    setFormError(null);
    setTxHash(null);
    if (!username.trim()) return setFormError("Enter a recipient");
    if (!amount || parseFloat(amount) <= 0) return setFormError("Enter a valid amount");
    if (parseFloat(amount) < MIN_VESTED_POT) return setFormError(`Locked payments must be at least ${MIN_VESTED_POT} POT (chain minimum)`);
    if (!unlockBlocks || parseInt(unlockBlocks) < 1) return setFormError("Enter unlock blocks");

    try {
      log.banner("PortalPay — Locked Payment");
      log.step(1, "Resolving recipient");

      const addr = await resolveUsername(username);
      if (!addr) return setFormError(`Could not resolve '${username}' — paste a 5… address`);

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
        <h2 style={{ fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Connect your wallet first</h2>
        <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
          Click "Connect wallet" to send a locked payment.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "-0.5px" }}>Locked payment</h1>
      <p style={{ color: "rgba(255,255,255,0.55)", margin: "0 0 24px", lineHeight: 1.6 }}>
        Lock POT for a recipient — they see it immediately but can only spend it as it
        unlocks over time. Enforced natively by the chain, no smart contract.
      </p>

      {txHash ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
          <h3 style={{ fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Payment locked</h3>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, marginBottom: 12, lineHeight: 1.6 }}>
            {amount} POT is now locked onchain for {username}. It unlocks over the next
            {" "}{unlockBlocks} blocks — visible in their wallet already, but not yet spendable.
          </p>
          <div style={TX_BOX}>tx: {txHash}</div>
          {destAddr && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>Recipient vesting status:</p>
              <VestingStatus api={api} address={destAddr} isOwner={false} />
            </div>
          )}
          <button onClick={() => { setTxHash(null); setUsername(""); setAmount(""); }}
            style={{
              padding: "11px 20px", borderRadius: 0, border: "none",
              background: "#00FF00", color: "#050505", fontSize: 13, fontWeight: 700, cursor: "pointer",
              textTransform: "uppercase", letterSpacing: "0.12em", boxShadow: "0 0 15px rgba(0,255,0,0.2)",
            }}>
            Send another
          </button>
        </div>
      ) : (
        <>
          <label style={LABEL}>Recipient</label>
          <input style={INPUT} type="text"
            placeholder={`#42 or 5Grwva… address`}
            value={username} onChange={e => setUsername(e.target.value)} />

          <label style={LABEL}>Amount (POT)</label>
          <input style={INPUT} type="number" min={MIN_VESTED_POT}
            placeholder={`e.g. 100  (min ${MIN_VESTED_POT} POT)`}
            value={amount} onChange={e => setAmount(e.target.value)} />

          <label style={LABEL}>Unlock over how many blocks?</label>
          <input style={INPUT} type="number" min="1"
            placeholder="e.g. 50  (on local node ~ 5 minutes)"
            value={unlockBlocks} onChange={e => setUnlockBlocks(e.target.value)} />

          {amount && unlockBlocks && (
            <div style={INFO_BOX}>
              {parseFloat(amount || 0).toFixed(4)} POT unlocks gradually over {unlockBlocks} blocks
              — ~{(parseFloat(amount || 0) / parseInt(unlockBlocks || 1)).toFixed(4)} POT per block
            </div>
          )}

          {(formError || vErr) && (
            <p style={{ color: "#f87171", fontSize: 13, marginBottom: 14 }}>{formError || vErr}</p>
          )}

          <button onClick={handleLockedPay} disabled={submitting || !api} style={PRIMARY_BTN(submitting)}>
            {submitting ? "Locking payment…" : "Lock payment"}
          </button>

          <p style={FOOTNOTE}>vesting.vestedTransfer — POT is locked by the chain, not a contract</p>

          {walletAddress && (
            <div style={{ marginTop: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Your locked incoming payments
              </p>
              <VestingStatus api={api} address={walletAddress} isOwner={true} getSigner={getSigner} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
