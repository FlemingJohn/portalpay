# PortalPay — Feature Test Plan

Manual end-to-end tests for every feature in the app, against a local Portaldot
dev node. Each test lists **Do** (steps), **Expect** (UI result), and **Verify**
(how to confirm it really hit the chain).

Every feature maps to a native pallet — there are no smart contracts. The full
on-chain flow of each feature below has been verified headless against the live
runtime.

---

## Prerequisites

1. **Local dev node running** (`ws://127.0.0.1:9944`). On Windows this runs inside
   WSL2 — see [`RUNNING-ON-WINDOWS.md`](RUNNING-ON-WINDOWS.md).
   ```bash
   # in WSL, from the node folder:
   nohup ./portaldot_dev --dev --alice --rpc-cors all --ws-external --rpc-external > ~/portaldot.log 2>&1 &
   ```
2. **Frontend running:**
   ```bash
   cd frontend && npm run dev -- --port 5173 --strictPort
   ```
   Open http://localhost:5173 and confirm the **top-left status dot is green**.
3. **Polkadot.js extension** with the dev accounts imported (see
   `RUNNING-ON-WINDOWS.md` for the exact seed — `//Alice` alone is rejected).
4. Click **Connect wallet** and, in the authorization popup, **tick both Alice and
   Bob** so the in-app account dropdown can switch between them.

> A `--dev` node is temporary: restarting it wipes all state (handles, tokens,
> balances reset; Alice/Bob/Charlie re-funded). Re-run the tests from scratch
> after a restart.

### Reference

| Account | Address |
|---|---|
| Alice | `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY` |
| Bob | `5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty` |
| Charlie | `5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y` |

**Switching accounts:** use the **dropdown next to your account chip** (top-right).
No second tab is needed. Every write opens the extension to sign.

---

## Checklist

- [ ] 0. Connect wallet (Alice)
- [ ] 1. Claim a `#handle`
- [ ] 2. Pay — single (by handle / address)
- [ ] 3. Pay — split (atomic)
- [ ] 4. Pay — with memo
- [ ] 5. Token — launch your own
- [ ] 6. Pay — a token
- [ ] 7. Locked — vesting (≥100 POT)
- [ ] 8. Shared — M-of-N wallet
- [ ] 9. Profile — lookup
- [ ] 10. Live feed

---

## 0. Connect wallet
- **Do:** Confirm the top-left dot is green → click **Connect wallet** → approve.
- **Expect:** the button is replaced by an **Alice (5Grwva…utQY)** chip, with an
  account dropdown if Bob is also exposed.
- **Verify:** chip shows the address starting `5Grwva`.

## 1. Claim a `#handle`  — `indices.claim` (+ `identity.setIdentity`)
- **Do:** **Claim** → enter `42`, optionally name `Alice` → **Claim #42** → sign.
- **Expect:** "🎉 #42 is yours" with a copyable pay link.
- **Then:** switch the dropdown to **Bob**, Claim **#7** for Bob, switch back to Alice.
- **Verify:** **Profile** → look up `#42` → resolves to Alice's address & name.

## 2. Pay — single  — `balances.transferKeepAlive`
- **Do:** **Pay** → **Send to one** → recipient `#7` (or paste Bob's address),
  amount `5` → **Send POT** → sign.
- **Expect:** success screen with a transaction hash.
- **Verify:** **Profile** → `#7` → Bob's balance increased by ~5 POT.

## 3. Pay — split  — `utility.batchAll`
- **Do:** **Pay** → **Split pay** → row 1 `#7` → `3`, row 2 (paste an address) →
  `2` → **Send to 2 people** → sign.
- **Expect:** one transaction; both transfers confirm together.
- **Verify:** both recipients' balances rise; in Explorer it is a single block with
  a `utility.BatchCompleted` event. Atomicity: if one recipient is invalid the
  whole batch rolls back.

## 4. Pay — with memo  — `utility.batchAll([transfer, system.remarkWithEvent])`
- **Do:** **Pay** → **With memo** → `#7`, `5`, note `Invoice 1024` → send → sign.
- **Expect:** success; transfer + note recorded together.
- **Verify:** Explorer shows both `balances.Transfer` and `system.Remarked` in the
  same transaction.

## 5. Token — launch your own  — `utility.batchAll([assets.create, setMetadata, mint])`
- **Do:** **Token** → name `Coffee Token`, symbol `COFFEE`, supply `1000`,
  decimals `2` → **Create token** → sign.
- **Expect:** "✓ COFFEE created"; it appears under **Tokens on this chain** with
  your balance `1000 COFFEE`.
- **Verify:** note the asset **id** shown (used in the next test).

## 6. Pay — a token  — `assets.transferKeepAlive`
- **Do:** **Pay** → **Pay a token** → asset id from step 5 → it auto-reads
  "COFFEE, 2 decimals" → recipient `#7`, amount `5` → send → sign.
- **Expect:** success.
- **Verify:** back on **Token**, the COFFEE supply/holders reflect the transfer
  (switch to Bob to see his 5 COFFEE).

## 7. Locked — vesting  — `vesting.vestedTransfer` / `vesting.vest`
- **Do:** **Locked** → recipient `#7`, amount `200`, unlock over `100` blocks →
  **Lock payment** → sign.
- **Expect:** "🔒 Payment locked" + recipient vesting status.
- **Guard check:** try amount `50` first → it must **block with a "min 100 POT"
  error** (the chain's `minVestedTransfer`).
- **Verify:** recipient sees the locked amount; spendable portion grows each block.

## 8. Shared — M-of-N wallet  — `multisig.asMulti`
- **Do:** **Shared** → keep pre-filled Alice/Bob/Charlie at **2 of 3** → **Create
  shared wallet** → **Fund** `20` → sign. Propose: recipient `#7`, amount `5` →
  **Propose & approve** → sign (shows **1/2**).
- **Then:** switch the dropdown to **Bob** → the pending payment is still listed →
  **Approve & execute** → sign.
- **Expect:** status flips to **✓ executed**; the shared balance drops by 5.
- **Verify:** Explorer shows `multisig.MultisigExecuted` and a `balances.Transfer`
  from the shared address.
- **Note:** repeating the *exact* same recipient+amount reuses the same call hash —
  vary the amount (or cancel the old pending one) between runs.

## 9. Profile — lookup  — `indices.accounts`, `identity.identityOf`, `system.account`
- **Do:** **Profile** → enter `#42` (or `#7`, or a raw address).
- **Expect:** shows the display name and balance. Works without signing (read-only).

## 10. Live feed  — `system.events` subscription
- **Do:** perform any payment (e.g. step 2) and watch the transaction feed.
- **Expect:** the new transfer appears within ~one block (~6s).

---

## Independent verification (recommended)

Open **https://polkadot.js.org/apps** → top-left network switch →
**Development → Local Node (127.0.0.1:9944)** → **Network → Explorer**.

Each feature emits a characteristic event you can confirm there:

| Feature | Event to look for |
|---|---|
| Claim handle | `indices.IndexAssigned` |
| Pay / Split / Memo | `balances.Transfer` (+ `utility.BatchCompleted`, `system.Remarked`) |
| Token launch | `assets.Created`, `assets.MetadataSet`, `assets.Issued` |
| Token pay | `assets.Transferred` |
| Locked | `vesting.VestingUpdated` |
| Shared wallet | `multisig.MultisigExecuted` |

---

## Known constraints

- **Pay-by-handle requires the handle to exist** — claim it first (step 1), or pay
  by raw address.
- **Locked payments minimum 100 POT** — the runtime's `minVestedTransfer`.
- **Usernames and scheduler are not used** — this runtime has no username pallet,
  and scheduling is Root-only, so there are no recurring/payroll/inheritance
  features. Short `#handles` replace usernames; vesting and multisig cover the
  "advanced payment" cases natively.
- **Local dev node is single-machine** — `127.0.0.1:9944` is only reachable on the
  host running the node. For a public demo, point `ACTIVE_WS` in
  `frontend/src/lib/chain.js` at `wss://mainnet.portaldot.io` (reads are free;
  writes cost real POT).
