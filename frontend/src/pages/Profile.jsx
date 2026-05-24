/**
 * pages/Profile.jsx
 * Public profile for any PortalPay username or SS58 address.
 * No wallet needed — all reads are free. Handles /profile/:username links.
 *
 * Reads: identity.identityOf, identity.usernameOf, identity.usernameInfoOf, system.account
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

  useEffect(() => {
    if (urlUsername && api) handleLookup(urlUsername);
  }, [urlUsername, api, handleLookup]);

  const shareLink = address
    ? `${window.location.origin}/profile/${identity?.username || address}`
    : null;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "-0.5px" }}>Profile</h1>
      <p style={{ color: "rgba(255,255,255,0.55)", margin: "0 0 24px", lineHeight: 1.6 }}>
        Look up any PortalPay username or Portaldot address. No wallet needed.
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
            flex: 1, padding: "11px 14px", borderRadius: 0,
            border: "1px solid #1A1A1A", background: "#0A0A0A", color: "#ffffff",
            fontSize: 14, outline: "none",
          }}
        />
        <button
          onClick={() => handleLookup(input)}
          disabled={loading || !api}
          style={{
            padding: "11px 20px", borderRadius: 0, border: "none",
            background: "#00FF00", color: "#050505", fontSize: 13, fontWeight: 700, cursor: "pointer",
            textTransform: "uppercase", letterSpacing: "0.12em", boxShadow: "0 0 15px rgba(0,255,0,0.2)",
          }}
        >
          {loading ? "Loading…" : "Look up"}
        </button>
      </div>

      {error && (
        <p style={{ color: "#f87171", fontSize: 14, marginBottom: 16 }}>{error}</p>
      )}

      {searched && identity && (
        <div>
          {/* Identity card */}
          <div style={{
            border: "1px solid #1A1A1A", borderRadius: 0, padding: "24px 24px 20px",
            background: "#0A0A0A", marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              {/* Avatar */}
              <div style={{
                width: 56, height: 56, borderRadius: 0,
                background: "#050505", border: "1px solid #1A1A1A", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#00FF00",
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
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
                      fontSize: 10, padding: "2px 8px", borderRadius: 0,
                      background: "rgba(0,255,0,0.1)", color: "#00FF00", fontWeight: 600,
                      border: "1px solid rgba(0,255,0,0.3)",
                      textTransform: "uppercase", letterSpacing: "0.1em",
                    }}>
                      ✓ Verified
                    </span>
                  )}
                </div>
                {identity.username && (
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 2, fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
                    {typeof identity.username === "string"
                      ? identity.username
                      : JSON.stringify(identity.username)}
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "#050505", border: "1px solid #1A1A1A", borderRadius: 0, padding: "10px 14px" }}>
                <p style={{ margin: "0 0 2px", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Balance</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 18, fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
                  {balance !== null ? `${balance.toFixed(4)} POT` : "—"}
                </p>
              </div>
              <div style={{ background: "#050505", border: "1px solid #1A1A1A", borderRadius: 0, padding: "10px 14px" }}>
                <p style={{ margin: "0 0 2px", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Address</p>
                <p style={{ margin: 0, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  {shortAddress(address)}
                </p>
              </div>
            </div>
          </div>

          {/* Vesting status */}
          <VestingStatus
            api={api}
            address={address}
            isOwner={walletAddress === address}
            getSigner={getSigner}
          />

          {/* Share link */}
          {shareLink && (
            <div style={{
              background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 0, padding: "12px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16,
            }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: "0 0 2px", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Share this pay link
                </p>
                <p style={{ margin: 0, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12, color: "rgba(255,255,255,0.7)", wordBreak: "break-all" }}>
                  {shareLink}
                </p>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(shareLink); }}
                style={{
                  padding: "7px 14px", borderRadius: 0, border: "1px solid #1A1A1A",
                  background: "transparent", fontSize: 11, cursor: "pointer", color: "#00FF00",
                  textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0, marginLeft: 12,
                }}
              >
                Copy
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live transaction feed filtered to this address */}
      {address && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Live transactions
          </p>
          <TransactionFeed api={api} filterAddress={address} maxHeight={280} />
        </div>
      )}

      {searched && !identity && !error && (
        <div style={{ textAlign: "center", paddingTop: 48, color: "rgba(255,255,255,0.4)" }}>
          <p>No identity found for this address.</p>
          <p style={{ fontSize: 13 }}>They may not have set up their PortalPay profile yet.</p>
        </div>
      )}
    </div>
  );
}
