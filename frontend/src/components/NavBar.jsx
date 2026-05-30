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

  const navBtn = (label, path) => {
    const active = pathname === path;
    return (
      <button
        onClick={() => navigate(path)}
        style={{
          padding: "7px 14px", borderRadius: 0, border: "none",
          cursor: "pointer", fontSize: 12,
          background: "transparent",
          color: active ? "#00FF00" : "rgba(255,255,255,0.55)",
          fontWeight: active ? 700 : 500,
          textTransform: "uppercase", letterSpacing: "0.14em",
          textShadow: active ? "0 0 10px rgba(0,255,0,0.3)" : "none",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 24px", background: "rgba(5,5,5,0.8)",
      backdropFilter: "blur(8px)",
      borderBottom: "1px solid #1A1A1A",
      position: "sticky", top: 0, zIndex: 10,
    }}>

      {/* Logo + chain status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: chainReady ? "#00FF00" : "#1A1A1A",
          boxShadow: chainReady ? "0 0 8px #00FF00" : "none",
        }} />
        <span
          style={{
            fontWeight: 800, fontSize: 18, letterSpacing: "-0.5px", cursor: "pointer",
            fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: "#ffffff",
          }}
          onClick={() => navigate("/")}
        >
          PortalPay
        </span>
        {chainReady && (
          <span style={{
            fontSize: 10, color: "rgba(255,255,255,0.35)", marginLeft: 2,
            textTransform: "uppercase", letterSpacing: "0.2em",
          }}>
            Portaldot
          </span>
        )}
      </div>

      {/* Nav tabs */}
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {navBtn("Pay",     "/pay")}
        {navBtn("Locked",  "/locked")}
        {navBtn("Shared",  "/multisig")}
        {navBtn("Token",   "/token")}
        {navBtn("Profile", "/profile")}
        {navBtn("Claim",   "/claim")}
      </div>

      {/* Wallet */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {wallet.error && (
          <span style={{ fontSize: 11, color: "#f87171", maxWidth: 220 }}>
            {wallet.error}
          </span>
        )}
        {!wallet.isConnected ? (
          <button
            onClick={wallet.connect}
            disabled={wallet.connecting || !chainReady}
            style={{
              padding: "9px 18px", borderRadius: 0, fontSize: 12, fontWeight: 700,
              background: "#00FF00", color: "#050505", border: "none",
              cursor: wallet.connecting ? "default" : "pointer",
              opacity: wallet.connecting || !chainReady ? 0.5 : 1,
              textTransform: "uppercase", letterSpacing: "0.12em",
              boxShadow: "0 0 15px rgba(0,255,0,0.2)",
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
                  fontSize: 12, padding: "6px 8px", borderRadius: 0,
                  border: "1px solid #1A1A1A", background: "#0A0A0A", color: "#ffffff",
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
              padding: "6px 14px", borderRadius: 0, background: "#0A0A0A",
              border: "1px solid #1A1A1A",
              fontSize: 12, fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: "#00FF00",
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
