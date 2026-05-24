/**
 * pages/Profile.jsx
 * Public profile for any PortalPay username or SS58 address.
 * No wallet needed — all reads are free.
 *
 * Also handles /profile/:username route for shareable links.
 * e.g. portalpay.app/profile/bob.portalpay
 *
 * Reads:
 *   identity.identityOf  — display name, judgements
 *   identity.usernameOf  — primary username
 *   identity.usernameInfoOf — resolve username → address
 *   system.account       — POT balance
 */

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useIdentity } from "../hooks/useIdentity";
import { POT_SUFFIX, shortAddress } from "../lib/chain";
import { log } from "../lib/logger";
import VestingStatus   from "../components/VestingStatus";
import TransactionFeed from "../components/TransactionFeed";

export default function Profile({ api, getSigner, walletAddress }) {
  const { username: urlUsername } = useParams();

  const { resolveUsername, getIdentity, getBalance } = useIdentity(api);

  const [input,    setInput]    = useState(urlUsername || "");
  const [identity, setIdentity] = useState(null);
  const [balance,  setBalance]  = useState(null);
  const [address,  setAddress]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [searched, setSearched] = useState(false);

  const handleLookup = useCallback(async (query) => {
    if (!api || !query?.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(false);
    setIdentity(null);
    setBalance(null);

    try {
      log.banner("PortalPay — Profile Lookup");
      log.step(1, `Looking up: ${query}`);

      let resolvedAddress = query.trim();

      // If it looks like a username (not an SS58 address), resolve it
      if (!query.startsWith("5")) {
        const fullName = query.includes(".") ? query : `${query}.${POT_SUFFIX}`;
        const addr     = await resolveUsername(fullName);
        if (!addr) {
          setError(`Username '${fullName}' not found on Portaldot`);
          setLoading(false);
          return;
        }
        resolvedAddress = addr;
      }

      setAddress(resolvedAddress);
      log.step(2, "Reading identity and balance");

      const [id, bal] = await Promise.all([
        getIdentity(resolvedAddress),
        getBalance(resolvedAddress),
      ]);

      setIdentity(id);
      setBalance(bal);
      setSearched(true);
    } catch (err) {
      log.error(err.message);
      setError("Could not load profile. Check the username or address.");
    }

    setLoading(false);
  }, [api, resolveUsername, getIdentity, getBalance]);

  // Auto-load if URL has a username — declared AFTER handleLookup
  useEffect(() => {
    if (urlUsername && api) handleLookup(urlUsername);
  }, [urlUsername, api, handleLookup]);

  const shareLink = address
    ? `${window.location.origin}/profile/${identity?.username || address}`
    : null;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>Profile</h1>
      <p style={{ color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>
        Look up any PortalPay username or Portaldot address.
        No wallet needed.
      </p>

      {/* Search bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        <input
          type="text"
          placeholder={`e.g. bob.${POT_SUFFIX} or 5Grwva…`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLookup(input)}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 8,
            border: "1px solid #e5e7eb", fontSize: 14,
          }}
        />
        <button
          onClick={() => handleLookup(input)}
          disabled={loading || !api}
          style={{
            padding: "10px 20px", borderRadius: 8, border: "none",
            background: "#111", color: "#fff", fontSize: 14, cursor: "pointer",
          }}
        >
          {loading ? "Loading…" : "Look up"}
        </button>
      </div>

      {error && (
        <p style={{ color: "#ef4444", fontSize: 14, marginBottom: 16 }}>{error}</p>
      )}

      {searched && identity && (
        <div>
          {/* Identity card */}
          <div style={{
            border: "1px solid #e5e7eb", borderRadius: 14, padding: "24px 24px 20px",
            background: "#fff", marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              {/* Avatar */}
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "#f3f4f6", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#374151",
              }}>
                {(identity.display || "?")[0].toUpperCase()}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>
                    {identity.display || "Unnamed"}
                  </span>
                  {identity.isVerified && (
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 20,
                      background: "#dcfce7", color: "#166534", fontWeight: 500,
                    }}>
                      ✓ Verified
                    </span>
                  )}
                </div>
                {identity.username && (
                  <div style={{ fontSize: 14, color: "#6b7280", marginTop: 2 }}>
                    {typeof identity.username === "string"
                      ? identity.username
                      : JSON.stringify(identity.username)}
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px" }}>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: "#9ca3af" }}>Balance</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>
                  {balance !== null ? `${balance.toFixed(4)} POT` : "—"}
                </p>
              </div>
              <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px" }}>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: "#9ca3af" }}>Address</p>
                <p style={{ margin: 0, fontFamily: "monospace", fontSize: 12, color: "#374151" }}>
                  {shortAddress(address)}
                </p>
              </div>
            </div>
          </div>

          {/* Vesting status — locked POT from vesting.vesting storage */}
          <VestingStatus
            api={api}
            address={address}
            isOwner={walletAddress === address}
            getSigner={getSigner}
          />

          {/* Share link */}
          {shareLink && (
            <div style={{
              background: "#f3f4f6", borderRadius: 10, padding: "12px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: "#9ca3af" }}>
                  Share this pay link
                </p>
                <p style={{ margin: 0, fontFamily: "monospace", fontSize: 12, color: "#374151" }}>
                  {shareLink}
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                }}
                style={{
                  padding: "6px 14px", borderRadius: 6, border: "1px solid #e5e7eb",
                  background: "#fff", fontSize: 12, cursor: "pointer", color: "#374151",
                }}
              >
                Copy
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live transaction feed filtered to this address — Feature 1 */}
        {address && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#374151", margin: "0 0 10px" }}>
              Live transactions
            </p>
            <TransactionFeed api={api} filterAddress={address} maxHeight={280} />
          </div>
        )}

      {searched && !identity && !error && (
        <div style={{ textAlign: "center", paddingTop: 48, color: "#9ca3af" }}>
          <p>No identity found for this address.</p>
          <p style={{ fontSize: 13 }}>They may not have set up their PortalPay profile yet.</p>
        </div>
      )}
    </div>
  );
}
