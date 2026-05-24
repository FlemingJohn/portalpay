/**
 * hooks/useIdentity.js
 * All identity pallet interactions.
 *
 * Pallet references from official docs:
 * https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/identity.html
 *   identity.setIdentity       — set display name onchain
 *   identity.setUsernameFor    — authority grants username
 *   identity.acceptUsername    — user accepts username
 *   identity.provideJudgement  — registrar verifies identity
 *
 * https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/identity.html
 *   identity.identityOf        — get identity + primary username for an address
 *   identity.usernameInfoOf    — resolve username → address
 *   identity.usernameOf        — get primary username for address
 */

import { useState, useCallback } from "react";
import { log } from "../lib/logger";
import { planckToPot } from "../lib/chain";

export function useIdentity(api) {

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // ── READS (free, no wallet) ─────────────────────────────────────────────

  /**
   * Resolve a username to an SS58 address.
   * Storage: identity.usernameInfoOf
   * https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/identity.html
   */
  const resolveUsername = useCallback(async (usernameFull) => {
    if (!api) throw new Error("Chain not connected");

    log.step(1, "Resolving username → address");
    log.info("Username", usernameFull);

    const result = await api.query.identity.usernameInfoOf(
      new TextEncoder().encode(usernameFull)
    );

    const raw = result.toJSON();
    if (!raw) {
      log.warn(`Username '${usernameFull}' not found`);
      return null;
    }

    const address = raw.owner || raw;
    log.success(`Resolved: ${usernameFull} → ${address}`);
    return address;
  }, [api]);

  /**
   * Get identity info + username for an address.
   * Storage: identity.identityOf
   * Returns { display, username, isVerified }
   */
  const getIdentity = useCallback(async (address) => {
    if (!api) throw new Error("Chain not connected");

    log.step(1, "Reading identity.identityOf");
    log.info("Address", address);

    const [identityResult, usernameResult] = await Promise.all([
      api.query.identity.identityOf(address),
      api.query.identity.usernameOf(address),
    ]);

    const identity = identityResult.toJSON();
    const username = usernameResult.toHuman();

    if (!identity) {
      log.warn("No identity found for this address");
      return null;
    }

    // Extract display name from identity info
    const info       = identity[0]?.info || identity?.info || {};
    const displayRaw = info.display?.Raw || info.display?.raw || null;
    const judgements = identity[0]?.judgements || identity?.judgements || [];

    // Check if any judgement is KnownGood or Reasonable
    const isVerified = judgements.some(([, j]) =>
      j?.KnownGood !== undefined || j?.Reasonable !== undefined
    );

    const result = {
      display:    displayRaw,
      username:   username || null,
      isVerified,
      address,
    };

    log.success(`Identity: ${result.display} | username: ${result.username} | verified: ${result.isVerified}`);
    return result;
  }, [api]);

  /**
   * Get balance for an address.
   * Storage: system.account
   */
  const getBalance = useCallback(async (address) => {
    if (!api) return 0;
    const { data } = await api.query.system.account(address);
    return planckToPot(data.free.toString());
  }, [api]);

  // ── WRITES (require wallet signature + POT gas) ──────────────────────────

  /**
   * Set identity display name onchain.
   * Extrinsic: identity.setIdentity
   * https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/identity.html
   */
  const setIdentity = useCallback(async (displayName, getSigner) => {
    if (!api) throw new Error("Chain not connected");
    setLoading(true);
    setError(null);

    try {
      log.step(2, "identity.setIdentity");
      log.info("Display name", displayName);

      const { signer, address } = await getSigner();

      await new Promise((resolve, reject) => {
        api.tx.identity
          .setIdentity({
            display:        { Raw: displayName },
            legal:          { None: null },
            web:            { None: null },
            matrix:         { None: null },
            email:          { None: null },
            pgpFingerprint: null,
            image:          { None: null },
            twitter:        { None: null },
            github:         { None: null },
            discord:        { None: null },
          })
          .signAndSend(address, { signer }, ({ status, dispatchError }) => {
            if (dispatchError) return reject(new Error(dispatchError.toString()));
            if (status.isInBlock || status.isFinalized) {
              log.success("identity.setIdentity confirmed");
              log.tx(status.hash.toString());
              resolve(status.hash.toString());
            }
          });
      });

    } catch (err) {
      log.error(`setIdentity failed: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  /**
   * Accept a username granted by an authority.
   * Extrinsic: identity.acceptUsername
   * https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/identity.html
   */
  const acceptUsername = useCallback(async (usernameFull, getSigner) => {
    if (!api) throw new Error("Chain not connected");
    setLoading(true);
    setError(null);

    try {
      log.step(3, "identity.acceptUsername");
      log.info("Username", usernameFull);

      const { signer, address } = await getSigner();

      await new Promise((resolve, reject) => {
        api.tx.identity
          .acceptUsername(new TextEncoder().encode(usernameFull))
          .signAndSend(address, { signer }, ({ status, dispatchError }) => {
            if (dispatchError) return reject(new Error(dispatchError.toString()));
            if (status.isInBlock || status.isFinalized) {
              log.success(`Username '${usernameFull}' accepted`);
              log.tx(status.hash.toString());
              resolve(status.hash.toString());
            }
          });
      });

    } catch (err) {
      log.error(`acceptUsername failed: ${err.message}`);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  return {
    resolveUsername,
    getIdentity,
    getBalance,
    setIdentity,
    acceptUsername,
    loading,
    error,
  };
}
