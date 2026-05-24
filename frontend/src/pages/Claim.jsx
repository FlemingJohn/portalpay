/**
 * pages/Claim.jsx
 * Claim a PortalPay username (yourname.portalpay).
 *
 * Linear flow:
 *   STEP 1  User connects wallet
 *   STEP 2  User types desired username
 *   STEP 3  identity.setIdentity  → display name saved onchain
 *   STEP 4  identity.acceptUsername → username active
 *           (Authority must have pre-granted via setUsernameFor — done via seed_demo.py
 *            or the admin backend in production)
 *
 * Extrinsics used:
 *   identity.setIdentity    — set display name
 *   identity.acceptUsername — accept pending username
 *
 * https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/identity.html
 */

import React, { useState } from "react";
import { useIdentity } from "../hooks/useIdentity";
import { POT_SUFFIX   } from "../lib/chain";
import { log           } from "../lib/logger";

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

      // STEP 3 — set identity
      log.divider();
      await setIdentity(displayName, getSigner);

      // STEP 4 — accept username
      // Note: authority must have called setUsernameFor first (via seed_demo.py or admin)
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
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Connect your wallet first</h2>
        <p style={{ color: "#6b7280", lineHeight: 1.7 }}>
          You need the Polkadot.js extension to claim a username.{" "}
          <a href="https://polkadot.js.org/extension/" target="_blank" rel="noreferrer"
            style={{ color: "#6366f1" }}>
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
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>
          {username}.{POT_SUFFIX} is yours
        </h2>
        <p style={{ color: "#6b7280", lineHeight: 1.7, marginBottom: 20 }}>
          Your username is permanently saved on Portaldot.
          Share your pay link and anyone can send you POT instantly.
        </p>
        <div style={{
          background: "#f3f4f6", borderRadius: 10, padding: "12px 16px",
          fontFamily: "monospace", fontSize: 13, marginBottom: 20, color: "#374151",
        }}>
          {window.location.origin}/profile/{username}.{POT_SUFFIX}
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(
            `${window.location.origin}/profile/${username}.${POT_SUFFIX}`
          )}
          style={{
            padding: "10px 24px", borderRadius: 8, border: "none",
            background: "#111", color: "#fff", fontSize: 14, cursor: "pointer",
          }}
        >
          Copy pay link
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>Claim your name</h1>
      <p style={{ color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>
        Claim <strong>yourname.{POT_SUFFIX}</strong> — permanently yours on Portaldot.
        Anyone can send you POT by typing your name.
      </p>

      <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
        Your display name
      </label>
      <input
        style={{
          width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
          border: "1px solid #e5e7eb", boxSizing: "border-box", marginBottom: 16,
        }}
        type="text" placeholder="e.g. Bob Smith"
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
      />

      <label style={{ fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>
        Choose your username
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 20 }}>
        <input
          style={{
            flex: 1, padding: "10px 14px", borderRadius: "8px 0 0 8px", fontSize: 14,
            border: "1px solid #e5e7eb", borderRight: "none", boxSizing: "border-box",
          }}
          type="text" placeholder="yourname"
          value={username}
          onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
        />
        <div style={{
          padding: "10px 14px", background: "#f3f4f6", border: "1px solid #e5e7eb",
          borderRadius: "0 8px 8px 0", fontSize: 14, color: "#6b7280", whiteSpace: "nowrap",
        }}>
          .{POT_SUFFIX}
        </div>
      </div>

      {username && (
        <div style={{
          background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8,
          padding: "10px 14px", fontSize: 13, color: "#166534", marginBottom: 16,
        }}>
          Your pay link will be:{" "}
          <strong>{window.location.origin}/profile/{username}.{POT_SUFFIX}</strong>
        </div>
      )}

      {(formError || idError) && (
        <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 14 }}>
          {formError || idError}
        </p>
      )}

      <button
        onClick={handleClaim}
        disabled={loading || !api}
        style={{
          width: "100%", padding: 13, borderRadius: 8, border: "none",
          background: loading ? "#9ca3af" : "#111",
          color: "#fff", fontSize: 15, fontWeight: 600,
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Saving to Portaldot…" : `Claim ${username || "yourname"}.${POT_SUFFIX}`}
      </button>

      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 10, textAlign: "center" }}>
        Two small POT gas fees — one to set your identity, one to accept your username.
      </p>
    </div>
  );
}
