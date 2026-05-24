"""
send_payment.py — Send POT to a username on Portaldot.
-------------------------------------------------------
Linear flow:
  STEP 1  connect to chain
  STEP 2  load sender keypair
  STEP 3  resolve username → SS58 address  (identity.usernameInfoOf)
  STEP 4  send payment  (balances.transferKeepAlive)
  STEP 5  confirm via Balances.Transfer event

Pallet references from official docs:
  identity.usernameInfoOf  — storage lookup username → address
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/identity.html

  balances.transferKeepAlive — safe transfer, keeps sender account alive
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/balances.html

Usage:
  python send_payment.py --network local --mnemonic "//Alice" \
    --to "bob.portalpay" --amount 5
"""

import argparse
import chain
import logger as log


def resolve_username(portaldot, username_full: str) -> str:
    """
    Resolve a username to an SS58 address.
    Storage: identity.usernameInfoOf(username) → PalletIdentityUsernameInformation
    From: https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/identity.html
    """
    log.step(3, "Resolving username → address")
    log.info("Username", username_full)

    result = portaldot.query("Identity", "UsernameInfoOf", [username_full.encode()])

    if result.value is None:
        log.error(f"Username '{username_full}' not found on Portaldot")
        raise ValueError(f"Username '{username_full}' not registered")

    # UsernameInformation contains the owner AccountId
    address = result.value.get("owner") or result.value
    log.success(f"Resolved to: {address}")
    return address


def send_pot(portaldot, sender_keypair, dest_address: str, amount_pot: float):
    """
    Send POT using balances.transferKeepAlive.
    Interface: balances.transferKeepAlive(dest, value)
    From: https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/balances.html

    transferKeepAlive is preferred over Transfer because it guarantees
    the sender account is not killed (keeps existential deposit intact).
    """
    log.step(4, "Calling balances.transferKeepAlive")
    log.info("To",     dest_address)
    log.info("Amount", f"{amount_pot} POT")

    amount_planck = chain.pot_to_planck(amount_pot)
    log.info("Amount (planck)", str(amount_planck))

    call = portaldot.compose_call(
        call_module="Balances",
        call_function="transfer_keep_alive",
        call_params={
            "dest":  dest_address,
            "value": amount_planck,
        },
    )

    extrinsic = portaldot.create_signed_extrinsic(call=call, keypair=sender_keypair)
    receipt   = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=True)

    if receipt.is_success:
        log.success(f"Payment of {amount_pot} POT sent successfully")
        log.tx(receipt.extrinsic_hash)
        return receipt.extrinsic_hash
    else:
        log.error(f"Transfer failed: {receipt.error_message}")
        raise RuntimeError(receipt.error_message)


def main():
    log.banner("PortalPay — Send POT by Username")

    parser = argparse.ArgumentParser(description="Send POT to a PortalPay username")
    parser.add_argument("--network",  choices=["mainnet", "local"], default="local")
    parser.add_argument("--mnemonic", default="//Alice", help="Sender's keypair mnemonic")
    parser.add_argument("--to",       required=True,    help="Recipient username e.g. bob.portalpay")
    parser.add_argument("--amount",   type=float, required=True, help="Amount in POT")
    args = parser.parse_args()

    log.info("Sending",   f"{args.amount} POT")
    log.info("Recipient", args.to)
    log.divider()

    # STEP 1 — connect
    portaldot = chain.connect(args.network)

    # STEP 2 — load sender keypair
    log.step(2, "Loading sender keypair")
    sender = chain.get_keypair(args.mnemonic)
    log.info("Sender address", sender.ss58_address)
    balance = chain.get_balance_pot(portaldot, sender.ss58_address)
    log.info("Sender balance", f"{balance:.6f} POT")
    log.divider()

    # STEP 3 — resolve username to address
    dest_address = resolve_username(portaldot, args.to)
    log.divider()

    # STEP 4 — send payment
    tx_hash = send_pot(portaldot, sender, dest_address, args.amount)
    log.divider()

    # STEP 5 — confirm
    log.step(5, "Confirming payment")
    new_balance = chain.get_balance_pot(portaldot, sender.ss58_address)
    log.info("Sender new balance", f"{new_balance:.6f} POT")
    log.success(f"Done. {args.amount} POT sent to {args.to}")
    log.done()


if __name__ == "__main__":
    main()
