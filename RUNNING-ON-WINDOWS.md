# Running PortalPay on Windows

The README's "Getting started" assumes Linux/macOS. On Windows the local dev node
ships only as a Linux/macOS binary, so the node runs **inside WSL2** while the
frontend and wallet run **on Windows**. WSL2 forwards `localhost`, so the app's
`ws://127.0.0.1:9944` reaches the node with no config change.

```
WSL2 Ubuntu                          Windows
┌─────────────────────┐             ┌──────────────────────────┐
│ portaldot_dev --dev │   ws://      │ Browser + Polkadot.js ext │
│  listens on :9944   │◄──127.0.0.1──┤ Vite frontend (npm dev)   │
└─────────────────────┘   :9944      └──────────────────────────┘
        (the node)         WSL2 mirrors the port to Windows localhost
```

`frontend/src/lib/chain.js` already points `ACTIVE_WS` at `ws://127.0.0.1:9944`,
so there is nothing to edit for local testing.

---

## Prerequisites

- **WSL2 with Ubuntu** — check with `wsl --list --verbose` (VERSION must be `2`).
  Install with `wsl --install` if missing, then reboot.
- **Node.js + npm on Windows** — for the frontend.
- **A Chromium/Firefox browser on Windows** — for the Polkadot.js extension.

---

## Step 1 — Download and run the local dev node (in WSL)

Run these inside WSL Ubuntu (`wsl -d Ubuntu` from PowerShell, or open the Ubuntu app):

```bash
cd ~
curl -L -o portaldot-testnet-ubuntu.tar.gz \
  https://github.com/portaldotVolunteer/Portaldot-node/raw/main/portaldot-testnet-ubuntu.tar.gz
tar -xzf portaldot-testnet-ubuntu.tar.gz
cd portaldot-testnet-ubuntu
chmod 755 portaldot_dev subkey
```

Start the node (kept running in the background, logging to `~/portaldot.log`):

```bash
nohup ./portaldot_dev --dev --alice --rpc-cors all --ws-external --rpc-external \
  > ~/portaldot.log 2>&1 &
```

Confirm it is producing blocks:

```bash
tail -f ~/portaldot.log      # look for "✨ Imported #N"; Ctrl-C to stop watching
```

`--dev` gives you pre-funded accounts (Alice ≈ 50,000 POT, Bob, Charlie) and `sudo`
access. `--rpc-cors all` lets the browser connect.

> **State is temporary.** Restarting the node wipes the chain back to genesis
> (Alice re-funded, identities/names erased). Re-run the seed script after a restart.

---

## Step 2 — Run the frontend (on Windows)

In PowerShell:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL it prints — usually <http://localhost:5173> (it falls back to `5174`
etc. if the port is taken).

---

## Step 3 — Install and set up the wallet (on Windows)

The only supported wallet is the **Polkadot.js browser extension**.

1. Install it: <https://polkadot.js.org/extension/>
2. Click the extension icon → **`+` → Import account from existing seed**.
3. The seed field needs a real **12-word mnemonic** — `//Alice` alone is rejected
   with *"Invalid mnemonic seed"* because it is only a *derivation path*, not a
   mnemonic. Substrate's well-known development phrase is:

   ```
   bottom drive obey lake curtain smoke basket hold race lonely fit walk
   ```

   To import each dev account, append the derivation suffix to that phrase:
   - Alice → `bottom drive obey lake curtain smoke basket hold race lonely fit walk//Alice`
   - Bob   → `bottom drive obey lake curtain smoke basket hold race lonely fit walk//Bob`

   Paste the whole string (phrase + `//Alice`) into the seed field. If the extension
   still complains, put the 12 words in the seed field and `//Alice` in the
   **Advanced → derivation path** field instead.
4. Name it, set any password (protects only the local keystore), and add it.
5. Verify the imported address: **Alice must show `5GrwvaEF…utQY`** — that is the
   account funded with ~50,000 POT on the dev node.
6. In the app, click **Connect wallet** and **allow** the site when the extension
   pops up.

> ⚠️ This dev phrase and `//Alice` / `//Bob` are public, well-known keys. **Use them
> only on a local node, never on mainnet.**

---

## Step 4 — Seed demo names (optional, recommended)

So you can pay `bob.portalpay` instead of a raw address. In PowerShell:

```powershell
cd scripts
pip install -r requirements.txt
python seed_demo.py
```

This registers `alice.portalpay`, `bob.portalpay`, `charlie.portalpay` on the node.

---

## Now test every feature (free, with fake POT)

| Page    | Feature                          | Pallet used                         |
|---------|----------------------------------|-------------------------------------|
| Pay     | Pay / Split / Memo / Token       | `balances`, `utility`, `assets`, `system` |
| Locked  | Locked payment, Recurring        | `vesting`, `scheduler`              |
| Payroll | Scheduled batch payroll          | `utility` + `scheduler`             |
| Heir    | Inheritance dead-man's switch    | `scheduler`                         |
| Claim   | Register your name               | `identity`                          |
| Profile | Public profile + pay link        | `identity` (read)                   |

Verify results independently at <https://polkadot.js.org/apps> → top-left network
switch → **Development → Local Node (127.0.0.1:9944)** → **Network → Explorer**.

---

## Troubleshooting

**App shows "Cannot connect to Portaldot. Is the local node running?"**
The node isn't up or Windows can't reach it. Check it's running:
```powershell
wsl -d Ubuntu -- bash -lc "pgrep -af portaldot_dev; tail -5 ~/portaldot.log"
```
Confirm Windows can reach the port: open <http://127.0.0.1:9944> — a Substrate node
returns "Used HTTP method is not allowed" for a plain GET, which means it's reachable.

**Wallet says "No accounts found. Create or import an account in the extension."**
The extension is installed but has no accounts visible to the site:
- Import `//Alice` (and `//Bob`) as in Step 3, then **refresh the page** and reconnect.
- In the extension settings → *Manage Website Access*, ensure `localhost` is allowed.
- Make sure accounts aren't hidden (the eye icon next to each account).
- Confirm you imported in the **same browser** that's showing the app.

**"Polkadot.js extension not found"**
The extension isn't installed/enabled in this browser, or the page loaded before the
extension initialized — install it, then hard-refresh.

---

## Managing the node

```powershell
# watch logs
wsl -d Ubuntu -- bash -lc "tail -f ~/portaldot.log"

# stop
wsl -d Ubuntu -- bash -lc "pkill -f portaldot_dev"

# restart (then re-run seed_demo.py)
wsl -d Ubuntu -- bash -lc "cd ~/portaldot-testnet-ubuntu && nohup ./portaldot_dev --dev --alice --rpc-cors all --ws-external --rpc-external > ~/portaldot.log 2>&1 &"
```

---

## Switching to mainnet

Reads (name resolution, profiles, balances, live feed) work for free against the live
chain. Writes cost real POT. To switch, edit `frontend/src/lib/chain.js`:

```js
export const ACTIVE_WS = PORTALDOT_WS_MAINNET;   // wss://mainnet.portaldot.io
```
