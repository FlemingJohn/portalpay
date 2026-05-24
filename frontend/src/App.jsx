/**
 * App.jsx
 * Root component. Holds chain + wallet state and passes them to all pages.
 * Uses React Router for clean URL-based navigation.
 *
 * Route structure:
 *   /           → Home (landing page)
 *   /pay        → Pay (send POT by username)
 *   /profile    → Profile (look up any username/address)
 *   /profile/:username → Profile with auto-loaded username (shareable pay link)
 *   /claim      → Claim (register your username)
 */

import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useChain  } from "./hooks/useChain";
import { useWallet } from "./hooks/useWallet";
import NavBar   from "./components/NavBar";
import Home      from "./pages/Home";
import Pay       from "./pages/Pay";
import Profile   from "./pages/Profile";
import Claim     from "./pages/Claim";
import LockedPay from "./pages/LockedPay";
import Payroll   from "./pages/Payroll";
import Heir       from "./pages/Heir";

export default function App() {
  const chain  = useChain();
  const wallet = useWallet();

  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "system-ui, -apple-system, sans-serif" }}>

        <NavBar chainReady={chain.ready} wallet={wallet} />

        {/* Chain error banner */}
        {chain.error && (
          <div style={{
            background: "#fef2f2", borderBottom: "1px solid #fecaca",
            padding: "10px 24px", fontSize: 13, color: "#dc2626", textAlign: "center",
          }}>
            {chain.error} — Make sure the local node is running:{" "}
            <code style={{ fontFamily: "monospace" }}>./portaldot_dev --dev --alice</code>
          </div>
        )}

        {/* Connecting state */}
        {!chain.ready && !chain.error && (
          <div style={{ textAlign: "center", paddingTop: 80, color: "#9ca3af" }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>Connecting to Portaldot…</div>
            <div style={{ fontSize: 11, color: "#d1d5db" }}>
              ws://127.0.0.1:9944
            </div>
          </div>
        )}

        {/* Pages — only render once chain is ready */}
        {chain.ready && (
          <Routes>
            <Route path="/" element={<Home />} />

            <Route path="/pay" element={
              <Pay
                api={chain.api}
                getSigner={wallet.getSigner}
                isConnected={wallet.isConnected}
              />
            } />

            <Route path="/profile" element={
              <Profile
                api={chain.api}
                getSigner={wallet.getSigner}
                walletAddress={wallet.selected?.address}
              />
            } />

            <Route path="/profile/:username" element={
              <Profile
                api={chain.api}
                getSigner={wallet.getSigner}
                walletAddress={wallet.selected?.address}
              />
            } />

            <Route path="/claim" element={
              <Claim
                api={chain.api}
                getSigner={wallet.getSigner}
                isConnected={wallet.isConnected}
              />
            } />

            <Route path="/locked" element={
              <LockedPay
                api={chain.api}
                getSigner={wallet.getSigner}
                isConnected={wallet.isConnected}
                walletAddress={wallet.selected?.address}
              />
            } />

            <Route path="/payroll" element={
              <Payroll
                api={chain.api}
                getSigner={wallet.getSigner}
                isConnected={wallet.isConnected}
              />
            } />

            <Route path="/heir" element={
              <Heir
                api={chain.api}
                getSigner={wallet.getSigner}
                isConnected={wallet.isConnected}
                walletAddress={wallet.selected?.address}
              />
            } />
          </Routes>
        )}

      </div>
    </BrowserRouter>
  );
}
