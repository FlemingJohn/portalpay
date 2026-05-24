/**
 * components/TransactionFeed.jsx
 * Live transaction feed — updates on every new block automatically.
 *
 * Uses useFeed hook which subscribes to:
 *   api.query.system.events  — fires every block
 *   Filters: balances.Transfer, vesting.VestingUpdated, vesting.VestingCompleted
 *
 * Can be used in two modes:
 *   global  — shows all transfers on the chain
 *   filtered — shows only transfers involving a specific address
 */

import React from "react";
import { useFeed    } from "../hooks/useFeed";
import { shortAddress } from "../lib/chain";

// Map event type to display config
const EVENT_CONFIG = {
  transfer: {
    icon:  "↗",
    color: "#16a34a",
    bg:    "#f0fdf4",
    label: (e, myAddress) => {
      if (myAddress && e.to === myAddress)   return { dir: "Received", color: "#16a34a" };
      if (myAddress && e.from === myAddress) return { dir: "Sent",     color: "#dc2626" };
      return { dir: "Transfer", color: "#374151" };
    },
  },
  vesting_updated: {
    icon:  "🔒",
    color: "#7c3aed",
    bg:    "#f5f3ff",
    label: () => ({ dir: "Locked POT updated", color: "#7c3aed" }),
  },
  vesting_completed: {
    icon:  "✓",
    color: "#0891b2",
    bg:    "#ecfeff",
    label: () => ({ dir: "Fully unlocked", color: "#0891b2" }),
  },
};

function FeedItem({ event, myAddress }) {
  const cfg   = EVENT_CONFIG[event.type] || EVENT_CONFIG.transfer;
  const label = cfg.label(event, myAddress);

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "12px 16px", borderBottom: "1px solid #f3f4f6",
      background: "#fff", animation: "fadeIn 0.3s ease",
    }}>
      {/* Icon */}
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: cfg.bg, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 16, flexShrink: 0,
      }}>
        {cfg.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: label.color }}>
            {label.dir}
          </span>
          <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>
            block {event.block}
          </span>
        </div>

        {event.type === "transfer" && (
          <>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: "2px 0" }}>
              {event.amount.toFixed(4)} POT
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>
              {shortAddress(event.from)} → {shortAddress(event.to)}
            </div>
          </>
        )}

        {event.type === "vesting_updated" && (
          <div style={{ fontSize: 13, color: "#7c3aed", marginTop: 2 }}>
            {event.unvested.toFixed(4)} POT still locked
          </div>
        )}

        {event.type === "vesting_completed" && (
          <div style={{ fontSize: 13, color: "#0891b2", marginTop: 2 }}>
            {shortAddress(event.account)} — all POT unlocked
          </div>
        )}
      </div>
    </div>
  );
}

export default function TransactionFeed({ api, filterAddress = null, maxHeight = 400 }) {
  const { events, currentBlock, listening, clearFeed } = useFeed(api, filterAddress);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", background: "#f9fafb",
        borderBottom: "1px solid #e5e7eb",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Live indicator */}
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: listening ? "#22c55e" : "#d1d5db",
            boxShadow: listening ? "0 0 6px #22c55e" : "none",
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            Live feed
          </span>
          {currentBlock && (
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              block #{currentBlock}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
          {events.length > 0 && (
            <button
              onClick={clearFeed}
              style={{
                fontSize: 11, color: "#9ca3af", background: "none",
                border: "none", cursor: "pointer", padding: "2px 6px",
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Feed list */}
      <div style={{ maxHeight, overflowY: "auto" }}>
        {events.length === 0 ? (
          <div style={{
            padding: "32px 16px", textAlign: "center",
            color: "#9ca3af", fontSize: 13,
          }}>
            {listening
              ? "Watching for transactions… Send some POT to see them appear here."
              : "Connecting to chain…"}
          </div>
        ) : (
          events.map(event => (
            <FeedItem key={event.id} event={event} myAddress={filterAddress} />
          ))
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
