/**
 * pages/Home.jsx
 * Landing page — explains PortalPay in plain English.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { POT_SUFFIX } from "../lib/chain";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>

      <h1 style={{ fontSize: 36, fontWeight: 800, margin: "0 0 16px", letterSpacing: "-1px" }}>
        Send POT by name.<br />
        <span style={{ color: "#6366f1" }}>Not by address.</span>
      </h1>

      <p style={{ fontSize: 17, color: "#6b7280", lineHeight: 1.7, margin: "0 0 40px" }}>
        Portaldot wallet addresses are 48 characters long.
        PortalPay turns them into human names like{" "}
        <strong>bob.{POT_SUFFIX}</strong> — permanent, onchain, owned by you.
      </p>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 56 }}>
        <button
          onClick={() => navigate("/claim")}
          style={{
            padding: "12px 28px", borderRadius: 10, border: "none",
            background: "#111", color: "#fff", fontSize: 15,
            fontWeight: 600, cursor: "pointer",
          }}
        >
          Claim your name
        </button>
        <button
          onClick={() => navigate("/pay")}
          style={{
            padding: "12px 28px", borderRadius: 10, fontSize: 15,
            border: "1px solid #e5e7eb", background: "#fff",
            color: "#374151", cursor: "pointer",
          }}
        >
          Send POT
        </button>
      </div>

      {/* How it works */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, textAlign: "left" }}>
        {[
          { n: "1", title: "Claim",  body: `Pick a name like yourname.${POT_SUFFIX}. One transaction. Permanent.` },
          { n: "2", title: "Share",  body: "Share your pay link. Anyone opens it in a browser and sends POT — no account needed." },
          { n: "3", title: "Receive",body: "POT lands in your wallet instantly. No fee cut. No middleman." },
        ].map(({ n, title, body }) => (
          <div key={n} style={{
            background: "#f9fafb", borderRadius: 12, padding: "18px 16px",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", background: "#111",
              color: "#fff", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 700, marginBottom: 10,
            }}>
              {n}
            </div>
            <p style={{ fontWeight: 600, margin: "0 0 6px", fontSize: 15 }}>{title}</p>
            <p style={{ color: "#6b7280", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{body}</p>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 40, fontSize: 12, color: "#d1d5db" }}>
        Built on Portaldot · Uses native identity pallet · No smart contracts
      </p>
    </div>
  );
}
