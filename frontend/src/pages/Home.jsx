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

      <h1 style={{
        fontSize: 38, fontWeight: 800, margin: "0 0 16px",
        letterSpacing: "-1px", textTransform: "uppercase", lineHeight: 1.05,
      }}>
        Send POT by name.<br />
        <span style={{ color: "#00FF00", textShadow: "0 0 10px rgba(0,255,0,0.3)" }}>Not by address.</span>
      </h1>

      <p style={{ fontSize: 17, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, margin: "0 0 40px" }}>
        Portaldot wallet addresses are 48 characters long.
        PortalPay turns them into human names like{" "}
        <strong style={{ color: "#ffffff", fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>bob.{POT_SUFFIX}</strong>{" "}
        — permanent, onchain, owned by you.
      </p>

      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 56 }}>
        <button
          onClick={() => navigate("/claim")}
          style={{
            padding: "13px 28px", borderRadius: 0, border: "none",
            background: "#00FF00", color: "#050505", fontSize: 13,
            fontWeight: 700, cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.12em",
            boxShadow: "0 0 15px rgba(0,255,0,0.2)",
          }}
        >
          Claim your name
        </button>
        <button
          onClick={() => navigate("/pay")}
          style={{
            padding: "13px 28px", borderRadius: 0, fontSize: 13,
            border: "1px solid #1A1A1A", background: "transparent",
            color: "rgba(255,255,255,0.8)", cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600,
          }}
        >
          Send POT
        </button>
      </div>

      {/* How it works */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, textAlign: "left" }}>
        {[
          { n: "1", title: "Claim",   body: `Pick a name like yourname.${POT_SUFFIX}. One transaction. Permanent.` },
          { n: "2", title: "Share",   body: "Share your pay link. Anyone opens it in a browser and sends POT — no account needed." },
          { n: "3", title: "Receive", body: "POT lands in your wallet instantly. No fee cut. No middleman." },
        ].map(({ n, title, body }) => (
          <div key={n} style={{
            background: "#0A0A0A", border: "1px solid #1A1A1A",
            borderRadius: 0, padding: "18px 16px",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 0, background: "#00FF00",
              color: "#050505", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 700, marginBottom: 10,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            }}>
              {n}
            </div>
            <p style={{
              fontWeight: 700, margin: "0 0 6px", fontSize: 14,
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>{title}</p>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{body}</p>
          </div>
        ))}
      </div>

      <p style={{
        marginTop: 40, fontSize: 11, color: "rgba(255,255,255,0.3)",
        textTransform: "uppercase", letterSpacing: "0.15em",
      }}>
        Built on Portaldot · Native identity pallet · No smart contracts
      </p>
    </div>
  );
}
