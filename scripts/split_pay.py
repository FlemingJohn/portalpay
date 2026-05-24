"""
split_pay.py — Send POT to multiple usernames in ONE transaction.
-----------------------------------------------------------------
Uses utility.batchAll for atomic multi-transfer.
If any transfer fails, ALL are rolled back.

Pallet references:
  utility.batchAll(calls: Vec<Call>)
    — Atomic batch. All succeed or all fail.
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/utility.html

  balances.transferKeepAlive(dest, value)
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/balances.html

  identity.usernameInfoOf  — resolve username → address
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/identity.html

Linear flow:
  STEP 1  connect
  STEP 2  load sender keypair
  STEP 3  resolve all usernames → addresses
  STEP 4  build one batchAll call
  STEP 5  submit — all transfers land in same block
  STEP 6  confirm

Usage:
  python split_pay.py --network local --mnemonic "//Alice" \
    --recipients "bob.portalpay:3" "charlie.portalpay:2" "dave.portalpay:5"
"""

import argparse
import chain
import logger as log


def resolve_username(portaldot, username_full: str) -> str:
    """
    Resolve username to SS58 address.
    Storage: identity.usernameInfoOf
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/identity.html
    """
    result = portaldot.query("Identity", "UsernameInfoOf", [username_full.encode()])
    if result.value is None:
        log.error(f"Username not found: {username_full}")
        raise ValueError(f"Username '{username_full}' not registered")
    address = result.value.get("owner") or result.value
    return address


def build_transfer_call(portaldot, dest_address: str, amount_pot: float):
    """Build a single balances.transferKeepAlive call (not yet submitted)."""
    return portaldot.compose_call(
        call_module="Balances",
        call_function="transfer_keep_alive",
        call_params={
            "dest":  dest_address,
            "value": chain.pot_to_planck(amount_pot),
        },
    )


def batch_send(portaldot, sender_keypair, recipients: list):
    """
    Resolve all usernames then submit one utility.batchAll transaction.

    utility.batchAll — atomic: all succeed or all roll back
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/utility.html
    """
    # STEP 3 — resolve all usernames
    log.step(3, f"Resolving {len(recipients)} usernames")
    calls = []
    total_pot = 0.0

    for username, amount_pot in recipients:
        address = resolve_username(portaldot, username)
        log.info(f"  {username}", f"→ {address}  ({amount_pot} POT)")
        calls.append(build_transfer_call(portaldot, address, amount_pot))
        total_pot += amount_pot

    log.info("Total POT", f"{total_pot}")
    log.divider()

    # STEP 4 — build batchAll
    log.step(4, "Building utility.batchAll call")
    log.info("Calls in batch", str(len(calls)))

    batch_call = portaldot.compose_call(
        call_module="Utility",
        call_function="batch_all",       # batchAll — atomic
        call_params={"calls": calls},
    )

    # STEP 5 — submit
    log.step(5, "Submitting batch transaction")
    extrinsic = portaldot.create_signed_extrinsic(call=batch_call, keypair=sender_keypair)
    receipt   = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=True)

    if receipt.is_success:
        log.success(f"All {len(recipients)} transfers confirmed in one block")
        log.tx(receipt.extrinsic_hash)
    else:
        log.error(f"Batch failed — all transfers rolled back: {receipt.error_message}")
        raise RuntimeError(receipt.error_message)

    return receipt.extrinsic_hash


def main():
    log.banner("PortalPay — Split Pay (batch)")

    parser = argparse.ArgumentParser(description="Send POT to multiple usernames in one transaction")
    parser.add_argument("--network",    choices=["mainnet", "local"], default="local")
    parser.add_argument("--mnemonic",   default="//Alice")
    parser.add_argument("--recipients", nargs="+", required=True,
                        help='Format: "username.suffix:amount"  e.g. "bob.portalpay:5"')
    args = parser.parse_args()

    # Parse recipients
    recipients = []
    for r in args.recipients:
        parts = r.split(":")
        if len(parts) != 2:
            log.error(f"Bad format: '{r}'. Use username.suffix:amount")
            return
        recipients.append((parts[0], float(parts[1])))

    log.info("Recipients", str(len(recipients)))
    for username, amount in recipients:
        log.info(f"  {username}", f"{amount} POT")
    log.divider()

    # STEP 1 — connect
    portaldot = chain.connect(args.network)

    # STEP 2 — load sender
    log.step(2, "Loading sender keypair")
    sender = chain.get_keypair(args.mnemonic)
    log.info("Sender", sender.ss58_address)
    balance = chain.get_balance_pot(portaldot, sender.ss58_address)
    log.info("Balance", f"{balance:.6f} POT")
    log.divider()

    # STEP 3–5 — resolve + batch + submit
    batch_send(portaldot, sender, recipients)
    log.divider()

    # STEP 6 — confirm
    log.step(6, "Verifying sender balance after batch")
    new_balance = chain.get_balance_pot(portaldot, sender.ss58_address)
    log.info("New balance", f"{new_balance:.6f} POT")
    log.done()


if __name__ == "__main__":
    main()
