/**
 * pages/Claim.jsx
 * Claim a PortalPay username (yourname.portalpay).
 *
 * identity.setIdentity    — set display name
 * identity.acceptUsername — accept pending username
 * https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/identity.html
 */

import React, { useState } from "react";
import { useIdentity } from "../hooks/useIdentity";
import { POT_SUFFIX   } from "../lib/chain";
import { log           } from "../lib/logger";

const INPUT = {
  width: "100%", padding: "11px 14px", borderRadius: 0, fontSize: 14,
  border: "1px solid #1A1A1A", background: "#0A0A0A", color: "#ffffff",
  boxSizing: "border-box", marginBottom: 16, outline: "none",
};
const LABEL = {
  fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)",
  display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.12em",
};

export default function Claim({ api, getSigner, isConnected }) {
  const { setIdentity, acceptUsername, loading, error: idError } = useIdentity(api);

  const [displayName, setDisplayName] = useState("");
  const [username,    setUsername]    = useState("");
  const [formError,   setFormError]   = useState(null);
  const [done,        setDone]        = useState(false);

  const handleClaim = async () => {
    setFormError(null);

    if (!displayName.trim()) return setFormError("Enter your display name");
    if (!username.trim())    return setFormError("Choose a username");
    if (!/^[a-z0-9]+$/.test(username))
      return setFormError("Username must be lowercase letters and numbers only");

    const usernameFull = `${username}.${POT_SUFFIX}`;

    try {
      log.banner("PortalPay — Claim Username");
      log.step(1, "Starting claim flow");
      log.info("Display name",  displayName);
      log.info("Username",      usernameFull);

      log.divider();
      await setIdentity(displayName, getSigner);

      log.divider();
      await acceptUsername(usernameFull, getSigner);

      log.done();
      setDone(true);
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
          You need the Polkadot.js extension to claim a username.{" "}
          <a href="https://polkadot.js.org/extension/" target="_blank" rel="noreferrer"
            style={{ color: "#00FF00" }}>
            Install it here.
          </a>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontWeight: 800, marginBottom: 8, textTransform: "uppercase" }}>
          {username}.{POT_SUFFIX} is yours
        </h2>
        <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 20 }}>
          Your username is permanently saved on Portaldot.
          Share your pay link and anyone can send you POT instantly.
        </p>
        <div style={{
          background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 0, padding: "12px 16px",
          fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 13, marginBottom: 20, color: "#00FF00",
          wordBreak: "break-all",
        }}>
          {window.location.origin}/profile/{username}.{POT_SUFFIX}
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(
            `${window.location.origin}/profile/${username}.${POT_SUFFIX}`
          )}
          style={{
            padding: "11px 24px", borderRadius: 0, border: "none",
            background: "#00FF00", color: "#050505", fontSize: 13, fontWeight: 700, cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.12em", boxShadow: "0 0 15px rgba(0,255,0,0.2)",
          }}
        >
          Copy pay link
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "-0.5px" }}>Claim your name</h1>
      <p style={{ color: "rgba(255,255,255,0.55)", margin: "0 0 24px", lineHeight: 1.6 }}>
        Claim <strong style={{ color: "#ffffff", fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>yourname.{POT_SUFFIX}</strong> — permanently yours on Portaldot.
        Anyone can send you POT by typing your name.
      </p>

      <label style={LABEL}>Your display name</label>
      <input
        style={INPUT}
        type="text" placeholder="e.g. Bob Smith"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
      />

      <label style={LABEL}>Choose your username</label>
      <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: 20 }}>
        <input
          style={{
            flex: 1, padding: "11px 14px", borderRadius: 0, fontSize: 14,
            border: "1px solid #1A1A1A", borderRight: "none", boxSizing: "border-box",
            background: "#0A0A0A", color: "#ffffff", outline: "none",
          }}
          type="text" placeholder="yourname"
          value={username}
          onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
        />
        <div style={{
          padding: "11px 14px", background: "#1A1A1A", border: "1px solid #1A1A1A",
          borderRadius: 0, fontSize: 14, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap",
          display: "flex", alignItems: "center", fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        }}>
          .{POT_SUFFIX}
        </div>
      </div>

      {username && (
        <div style={{
          background: "#0A0A0A", border: "1px solid rgba(0,255,0,0.3)", borderRadius: 0,
          padding: "10px 14px", fontSize: 13, color: "#00FF00", marginBottom: 16, wordBreak: "break-all",
        }}>
          Your pay link will be:{" "}
          <strong style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>{window.location.origin}/profile/{username}.{POT_SUFFIX}</strong>
        </div>
      )}

      {(formError || idError) && (
        <p style={{ color: "#f87171", fontSize: 13, marginBottom: 14 }}>
          {formError || idError}
        </p>
      )}

      <button
        onClick={handleClaim}
        disabled={loading || !api}
        style={{
          width: "100%", padding: 13, borderRadius: 0, border: "none",
          background: loading ? "#1A1A1A" : "#00FF00",
          color: loading ? "rgba(255,255,255,0.4)" : "#050505",
          fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em",
          cursor: loading ? "default" : "pointer",
          boxShadow: loading ? "none" : "0 0 15px rgba(0,255,0,0.2)",
        }}
      >
        {loading ? "Saving to Portaldot…" : `Claim ${username || "yourname"}.${POT_SUFFIX}`}
      </button>

      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 10, textAlign: "center" }}>
        Two small POT gas fees — one to set your identity, one to accept your username.
      </p>
    </div>
  );
}
