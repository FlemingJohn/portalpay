/**
 * components/NavBar.jsx
 * Top navigation bar with chain status and wallet connect button.
 */

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { shortAddress } from "../lib/chain";

export default function NavBar({ chainReady, wallet }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const navBtn = (label, path) => (
    <button
      onClick={() => navigate(path)}
      style={{
        padding: "7px 16px", borderRadius: 8, border: "none",
        cursor: "pointer", fontSize: 14,
        background: pathname === path ? "#111" : "transparent",
        color:      pathname === path ? "#fff"  : "#6b7280",
        fontWeight: pathname === path ? 600     : 400,
      }}
    >
      {label}
    </button>
  );

  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 24px", background: "#fff",
      borderBottom: "1px solid #f0f0f0",
      position: "sticky", top: 0, zIndex: 10,
    }}>

      {/* Logo + chain status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: chainReady ? "#22c55e" : "#d1d5db",
          boxShadow: chainReady ? "0 0 6px #22c55e" : "none",
        }} />
        <span
          style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.5px", cursor: "pointer" }}
          onClick={() => navigate("/")}
        >
          PortalPay
        </span>
        {chainReady && (
          <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 2 }}>
            Portaldot
          </span>
        )}
      </div>

      {/* Nav tabs */}
      <div style={{ display: "flex", gap: 2 }}>
        {navBtn("Pay",     "/pay")}
        {navBtn("Payroll", "/payroll")}
        {navBtn("Locked",  "/locked")}
        {navBtn("Heir",    "/heir")}
        {navBtn("Profile", "/profile")}
        {navBtn("Claim",   "/claim")}
      </div>

      {/* Wallet */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {wallet.error && (
          <span style={{ fontSize: 11, color: "#ef4444", maxWidth: 220 }}>
            {wallet.error}
          </span>
        )}
        {!wallet.isConnected ? (
          <button
            onClick={wallet.connect}
            disabled={wallet.connecting || !chainReady}
            style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 14,
              background: "#111", color: "#fff", border: "none",
              cursor: wallet.connecting ? "default" : "pointer",
              opacity: wallet.connecting || !chainReady ? 0.5 : 1,
            }}
          >
            {wallet.connecting ? "Connecting…" : "Connect wallet"}
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {wallet.accounts.length > 1 && (
              <select
                value={wallet.selected?.address || ""}
                onChange={e =>
                  wallet.setSelected(wallet.accounts.find(a => a.address === e.target.value))
                }
                style={{
                  fontSize: 12, padding: "5px 8px",
                  borderRadius: 6, border: "1px solid #e5e7eb",
                }}
              >
                {wallet.accounts.map(a => (
                  <option key={a.address} value={a.address}>
                    {a.meta.name || shortAddress(a.address)}
                  </option>
                ))}
              </select>
            )}
            <div style={{
              padding: "6px 14px", borderRadius: 8, background: "#f3f4f6",
              fontSize: 12, fontFamily: "monospace", color: "#374151",
            }}>
              {wallet.selected?.meta.name
                ? `${wallet.selected.meta.name} (${shortAddress(wallet.selected.address)})`
                : shortAddress(wallet.selected?.address)}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
