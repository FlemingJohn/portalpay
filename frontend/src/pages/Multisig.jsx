/**
 * pages/Multisig.jsx
 * Shared wallet — an M-of-N team treasury using the native multisig pallet.
 *
 * Define a set of signatories + a threshold → a deterministic shared address.
 * Anyone can fund it. To spend, `threshold` signatories must each approve the
 * SAME payment; the chain dispatches it on the final approval. No contract.
 *
 * Multi-account demo: define the wallet once, propose as one account, then switch
 * accounts in the Polkadot.js extension and approve as another — the wallet
 * definition and pending list persist in localStorage (same browser origin).
 */

import React, { useState, useEffect, useCallback } from "react";
import { useMultisig } from "../hooks/useMultisig";
import { log } from "../lib/logger";
import { planckToPot, shortAddress } from "../lib/chain";

const INPUT = {
  width: "100%", padding: "11px 14px", borderRadius: 0,
  border: "1px solid #1A1A1A", background: "#0A0A0A", color: "#ffffff",
  fontSize: 14, boxSizing: "border-box", marginBottom: 14, outline: "none",
};
const LABEL = {
  fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)",
  display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.12em",
};
const BTN = (busy) => ({
  width: "100%", padding: 13, borderRadius: 0, border: "none",
  background: busy ? "#1A1A1A" : "#00FF00",
  color: busy ? "rgba(255,255,255,0.4)" : "#050505",
  fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
  cursor: busy ? "default" : "pointer",
  boxShadow: busy ? "none" : "0 0 15px rgba(0,255,0,0.2)",
});

// Well-known dev accounts, pre-filled so the demo works instantly.
const DEV_PREFILL = [
  "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", // Alice
  "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty", // Bob
  "5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y", // Charlie
].join("\n");

const WALLET_KEY  = "portalpay:multisig:wallet";
const pendingKey  = (addr) => `portalpay:multisig:pending:${addr}`;

export default function Multisig({ api, getSigner, isConnected, walletAddress }) {
  const { deriveAddress, getPending, approvePayment, cancelPayment, submitting, error: msErr } =
    useMultisig(api);

  // Shared-wallet definition
  const [sigText,   setSigText]   = useState(DEV_PREFILL);
  const [threshold, setThreshold] = useState("2");
  const [wallet,    setWallet]    = useState(null);   // { signatories[], threshold }
  const [multisigAddress, setMultisigAddress] = useState(null);
  const [balance,   setBalance]   = useState(null);

  // Funding + proposing
  const [fundAmount, setFundAmount] = useState("");
  const [recipient,  setRecipient]  = useState("");
  const [amount,     setAmount]     = useState("");

  // Pending operations { recipient, amountPot, callHash }
  const [pendings, setPendings] = useState([]);
  const [status,   setStatus]   = useState({});       // callHash -> { approvals[], approvalsCount, executed:false }
  const [formError, setFormError] = useState(null);

  // ── Load saved wallet on mount ────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(WALLET_KEY);
    if (saved) {
      const w = JSON.parse(saved);
      setWallet(w);
      setSigText(w.signatories.join("\n"));
      setThreshold(String(w.threshold));
    }
  }, []);

  // ── Derive address + load pendings whenever the wallet changes ────────────
  useEffect(() => {
    if (!wallet || !api) { setMultisigAddress(null); return; }
    try {
      const addr = deriveAddress(wallet.signatories, wallet.threshold);
      setMultisigAddress(addr);
      const saved = localStorage.getItem(pendingKey(addr));
      setPendings(saved ? JSON.parse(saved) : []);
    } catch {
      setMultisigAddress(null);
    }
  }, [wallet, api, deriveAddress]);

  const persistPendings = useCallback((addr, list) => {
    setPendings(list);
    localStorage.setItem(pendingKey(addr), JSON.stringify(list));
  }, []);

  // ── Refresh multisig balance + each pending op's on-chain status ──────────
  const refresh = useCallback(async () => {
    if (!api || !multisigAddress) return;
    try {
      const { data } = await api.query.system.account(multisigAddress);
      setBalance(planckToPot(data.free.toString()));
    } catch { /* ignore */ }

    const next = {};
    for (const p of pendings) {
      try {
        const info = await getPending(multisigAddress, p.callHash);
        next[p.callHash] = info
          ? { approvals: info.approvals, approvalsCount: info.approvalsCount, executed: false }
          : { approvals: [], approvalsCount: 0, executed: true };  // gone from chain = executed/cancelled
      } catch { /* ignore */ }
    }
    setStatus(next);
  }, [api, multisigAddress, pendings, getPending]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Save / edit the shared wallet ─────────────────────────────────────────
  const handleSaveWallet = () => {
    setFormError(null);
    const signatories = sigText.split("\n").map(s => s.trim()).filter(Boolean);
    const t = parseInt(threshold);
    if (signatories.length < 2) return setFormError("Add at least 2 signatory addresses (one per line)");
    if (new Set(signatories).size !== signatories.length) return setFormError("Duplicate signatory address");
    if (!t || t < 1 || t > signatories.length) return setFormError(`Threshold must be between 1 and ${signatories.length}`);
    try {
      deriveAddress(signatories, t);   // throws if an address is invalid
    } catch {
      return setFormError("One of the addresses is not a valid SS58 address");
    }
    const w = { signatories, threshold: t };
    setWallet(w);
    localStorage.setItem(WALLET_KEY, JSON.stringify(w));
  };

  const handleEditWallet = () => { setWallet(null); localStorage.removeItem(WALLET_KEY); };

  // ── Fund the shared wallet from the connected account ─────────────────────
  const handleFund = async () => {
    setFormError(null);
    if (!fundAmount || parseFloat(fundAmount) <= 0) return setFormError("Enter an amount to fund");
    try {
      log.banner("PortalPay — Fund shared wallet");
      const { signer, address } = await getSigner();
      await new Promise((resolve, reject) => {
        api.tx.balances
          .transferKeepAlive(multisigAddress, BigInt(Math.round(parseFloat(fundAmount) * 1e14)))
          .signAndSend(address, { signer }, ({ status: st, dispatchError }) => {
            if (dispatchError) return reject(new Error(dispatchError.toString()));
            if (st.isInBlock || st.isFinalized) resolve();
          });
      });
      setFundAmount("");
      refresh();
    } catch (err) { setFormError(err.message); }
  };

  // ── Propose a payment (first approval) ────────────────────────────────────
  const handlePropose = async () => {
    setFormError(null);
    if (!recipient.trim()) return setFormError("Enter a recipient address");
    if (!amount || parseFloat(amount) <= 0) return setFormError("Enter a valid amount");
    try {
      const res = await approvePayment(
        { signatories: wallet.signatories, threshold: wallet.threshold, recipient: recipient.trim(), amountPot: parseFloat(amount) },
        getSigner,
      );
      const op = { recipient: recipient.trim(), amountPot: parseFloat(amount), callHash: res.callHash };
      const list = pendings.some(p => p.callHash === op.callHash) ? pendings : [op, ...pendings];
      persistPendings(multisigAddress, list);
      setRecipient(""); setAmount("");
      setTimeout(refresh, 500);
    } catch (err) { setFormError(err.message); }
  };

  // ── Approve / execute a pending payment ───────────────────────────────────
  const handleApprove = async (p) => {
    setFormError(null);
    try {
      const res = await approvePayment(
        { signatories: wallet.signatories, threshold: wallet.threshold, recipient: p.recipient, amountPot: p.amountPot },
        getSigner,
      );
      if (res.executed) {
        persistPendings(multisigAddress, pendings.filter(x => x.callHash !== p.callHash));
      }
      setTimeout(refresh, 500);
    } catch (err) { setFormError(err.message); }
  };

  const handleCancel = async (p) => {
    setFormError(null);
    try {
      await cancelPayment(
        { signatories: wallet.signatories, threshold: wallet.threshold, recipient: p.recipient, amountPot: p.amountPot },
        getSigner,
      );
      persistPendings(multisigAddress, pendings.filter(x => x.callHash !== p.callHash));
      setTimeout(refresh, 500);
    } catch (err) { setFormError(err.message); }
  };

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🔐</div>
        <h2 style={{ fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>Connect your wallet first</h2>
        <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
          Click "Connect wallet" to create or use a shared wallet.
        </p>
      </div>
    );
  }

  const iAmSignatory = wallet && walletAddress && wallet.signatories.includes(walletAddress);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "-0.5px" }}>Shared wallet</h1>
      <p style={{ color: "rgba(255,255,255,0.55)", margin: "0 0 24px", lineHeight: 1.6 }}>
        A team treasury that needs <strong style={{ color: "#fff" }}>M-of-N</strong> approvals to spend.
        The chain enforces it natively — no contract, no custodian.
      </p>

      {/* ── Define the wallet ── */}
      {!wallet ? (
        <div style={{ border: "1px solid #1A1A1A", background: "#0A0A0A", padding: 20, marginBottom: 16 }}>
          <label style={LABEL}>Signatories (one SS58 address per line)</label>
          <textarea style={{ ...INPUT, minHeight: 96, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12 }}
            value={sigText} onChange={e => setSigText(e.target.value)} />
          <label style={LABEL}>Approvals required (threshold)</label>
          <input style={INPUT} type="number" min="1" value={threshold} onChange={e => setThreshold(e.target.value)} />
          <button onClick={handleSaveWallet} style={BTN(false)}>Create shared wallet</button>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 8 }}>
            Pre-filled with dev accounts Alice, Bob, Charlie — threshold 2 of 3.
          </p>
        </div>
      ) : (
        <div style={{ border: "1px solid #1A1A1A", background: "#0A0A0A", padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Shared address</div>
            <button onClick={handleEditWallet} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em" }}>Edit</button>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, margin: "4px 0 14px", fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: "#00FF00", wordBreak: "break-all" }}>
            {multisigAddress}
          </div>
          <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Balance</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{balance != null ? `${balance.toFixed(4)} POT` : "…"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Policy</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#00FF00" }}>{wallet.threshold} of {wallet.signatories.length}</div>
            </div>
          </div>
          {!iAmSignatory && (
            <p style={{ fontSize: 12, color: "#fbbf24", marginBottom: 12 }}>
              ⚠ The connected account is not a signatory — switch to one to approve payments.
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...INPUT, marginBottom: 0, flex: 1 }} type="number" min="0.0001"
              placeholder="Fund amount (POT)" value={fundAmount} onChange={e => setFundAmount(e.target.value)} />
            <button onClick={handleFund} disabled={submitting}
              style={{ padding: "0 18px", border: "1px solid #00FF00", background: "transparent", color: "#00FF00", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Fund
            </button>
          </div>
        </div>
      )}

      {/* ── Propose a payment ── */}
      {wallet && (
        <div style={{ border: "1px solid #1A1A1A", background: "#0A0A0A", padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Propose a payment</div>
          <label style={LABEL}>Recipient address</label>
          <input style={INPUT} type="text" placeholder="5Grwva… recipient address"
            value={recipient} onChange={e => setRecipient(e.target.value)} />
          <label style={LABEL}>Amount (POT)</label>
          <input style={INPUT} type="number" min="0.0001" placeholder="e.g. 5"
            value={amount} onChange={e => setAmount(e.target.value)} />
          <button onClick={handlePropose} disabled={submitting || !iAmSignatory} style={BTN(submitting || !iAmSignatory)}>
            {submitting ? "Submitting…" : "Propose & approve (1st signature)"}
          </button>
        </div>
      )}

      {/* ── Pending payments ── */}
      {wallet && pendings.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Pending payments</div>
          {pendings.map((p) => {
            const s = status[p.callHash] || { approvalsCount: 0, approvals: [], executed: false };
            const mine = walletAddress && s.approvals.includes(walletAddress);
            return (
              <div key={p.callHash} style={{ border: "1px solid #1A1A1A", background: "#0A0A0A", padding: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{p.amountPot} POT</span>
                  <span style={{ fontSize: 12, color: s.executed ? "#00FF00" : "rgba(255,255,255,0.5)" }}>
                    {s.executed ? "✓ executed" : `${s.approvalsCount} / ${wallet.threshold} approvals`}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: '"JetBrains Mono", ui-monospace, monospace', marginBottom: 10, wordBreak: "break-all" }}>
                  → {shortAddress(p.recipient)}
                </div>
                {!s.executed && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleApprove(p)} disabled={submitting || !iAmSignatory || mine}
                      style={{ ...BTN(submitting || !iAmSignatory || mine), flex: 1, padding: 10 }}>
                      {mine ? "You approved ✓" : s.approvalsCount + 1 >= wallet.threshold ? "Approve & execute" : "Approve"}
                    </button>
                    <button onClick={() => handleCancel(p)} disabled={submitting}
                      style={{ padding: "10px 14px", border: "1px solid #1A1A1A", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 4 }}>
            Switch accounts in the extension to approve as another signatory.
          </p>
        </div>
      )}

      {(formError || msErr) && (
        <p style={{ color: "#f87171", fontSize: 13, marginTop: 14 }}>{formError || msErr}</p>
      )}
    </div>
  );
}
