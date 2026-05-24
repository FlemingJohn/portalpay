/**
 * hooks/useWallet.js
 * Manages Polkadot.js browser extension connection.
 *
 * Wallet: Polkadot.js browser extension
 *   Install: https://polkadot.js.org/extension/
 *   This is the standard wallet for all Substrate/Portaldot chains.
 *   SS58 format 42 — addresses start with "5..."
 *
 * HOW IT WORKS (plain English):
 *   1. User installs the extension — like MetaMask but for Portaldot
 *   2. User clicks "Connect wallet" — extension popup asks for permission
 *   3. App gets the user's SS58 address (never the private key)
 *   4. Every transaction shows an extension popup for approval
 */

import { useState, useCallback } from "react";
import {
  web3Enable,
  web3Accounts,
  web3FromSource,
} from "@polkadot/extension-dapp";
import { log } from "../lib/logger";

export function useWallet() {
  const [accounts,    setAccounts]    = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [connecting,  setConnecting]  = useState(false);
  const [error,       setError]       = useState(null);

  /**
   * Called when user clicks "Connect wallet".
   * Triggers the Polkadot.js extension permission popup.
   */
  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);

    try {
      log.step(1, "Requesting wallet permission");
      log.info("Extension", "Polkadot.js");

      // web3Enable — asks the extension "allow this site to see your accounts?"
      const extensions = await web3Enable("PortalPay");

      if (extensions.length === 0) {
        const msg =
          "Polkadot.js extension not found. " +
          "Install it from polkadot.js.org/extension and refresh.";
        log.error(msg);
        setError(msg);
        setConnecting(false);
        return;
      }

      log.success(`Extension found: ${extensions.map(e => e.name).join(", ")}`);

      // web3Accounts — get all accounts the user has in the extension
      const all = await web3Accounts();

      if (all.length === 0) {
        const msg = "No accounts found. Create or import an account in the extension.";
        log.warn(msg);
        setError(msg);
        setConnecting(false);
        return;
      }

      log.success(`${all.length} account(s) found`);
      all.forEach((a, i) =>
        log.info(`  Account ${i + 1}`, `${a.meta.name || "unnamed"}  (${a.address})`)
      );

      setAccounts(all);
      setSelected(all[0]);
      log.info("Active account", all[0].meta.name || all[0].address);

    } catch (err) {
      log.error(`Wallet error: ${err.message}`);
      setError(`Wallet connection failed: ${err.message}`);
    }

    setConnecting(false);
  }, []);

  /**
   * Returns a signer for the selected account.
   * Used by send functions to sign transactions before submission.
   */
  const getSigner = useCallback(async () => {
    if (!selected) throw new Error("No account selected");
    const injector = await web3FromSource(selected.meta.source);
    return { signer: injector.signer, address: selected.address };
  }, [selected]);

  return {
    accounts,
    selected,
    setSelected,
    connecting,
    error,
    connect,
    getSigner,
    isConnected: accounts.length > 0,
  };
}
