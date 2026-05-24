/**
 * hooks/useChain.js
 * Manages the Portaldot chain connection.
 * One connection shared across the whole app.
 */

import { useState, useEffect } from "react";
import { connectChain, ACTIVE_WS } from "../lib/chain";
import { log } from "../lib/logger";

export function useChain() {
  const [api,     setApi]     = useState(null);
  const [ready,   setReady]   = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        log.banner("PortalPay — Connecting to Portaldot");
        log.step(1, "Opening WebSocket connection");
        log.info("URL", ACTIVE_WS);

        const api = await connectChain();

        if (!mounted) return;

        log.success(`Chain connected: ${await api.rpc.system.chain()}`);
        setApi(api);
        setReady(true);
      } catch (err) {
        if (!mounted) return;
        log.error(`Chain connection failed: ${err.message}`);
        setError("Cannot connect to Portaldot. Is the local node running?");
      }
    })();

    return () => { mounted = false; };
  }, []);

  return { api, ready, error };
}
