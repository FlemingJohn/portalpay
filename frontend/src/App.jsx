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
import Multisig   from "./pages/Multisig";
import Token       from "./pages/Token";

export default function App() {
  const chain  = useChain();
  const wallet = useWallet();

  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#050505", color: "#ffffff", fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif' }}>

        <NavBar chainReady={chain.ready} wallet={wallet} />

        {/* Chain error banner */}
        {chain.error && (
          <div style={{
            background: "#0A0A0A", borderBottom: "1px solid #1A1A1A",
            padding: "10px 24px", fontSize: 13, color: "#f87171", textAlign: "center",
          }}>
            {chain.error} — Make sure the local node is running:{" "}
            <code style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: "#00FF00" }}>./portaldot_dev --dev --alice</code>
          </div>
        )}

        {/* Connecting state */}
        {!chain.ready && !chain.error && (
          <div style={{ textAlign: "center", paddingTop: 80, color: "rgba(255,255,255,0.55)" }}>
            <div style={{ fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.2em" }}>Connecting to Portaldot…</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: '"JetBrains Mono", ui-monospace, monospace' }}>
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
                walletAddress={wallet.selected?.address}
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

            <Route path="/multisig" element={
              <Multisig
                api={chain.api}
                getSigner={wallet.getSigner}
                isConnected={wallet.isConnected}
                walletAddress={wallet.selected?.address}
              />
            } />

            <Route path="/token" element={
              <Token
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
