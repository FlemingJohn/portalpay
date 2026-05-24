"""
setup_identity.py — Register a Portaldot identity and claim a username.
-----------------------------------------------------------------------
Uses native identity pallet calls from:
  https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/identity.html

  identity.setIdentity(info: PalletIdentityLegacyIdentityInfo)
    — Set an account's identity information onchain.

  identity.setUsernameFor(who, username, signature, use_allocation)
    — Authority sets a username for a target account.

  identity.acceptUsername(username: Bytes)
    — User accepts a username an authority granted them.

Linear flow:
  STEP 1  connect to chain
  STEP 2  load keypair
  STEP 3  call identity.setIdentity  → identity is onchain
  STEP 4  authority calls setUsernameFor  → username pending
  STEP 5  user calls acceptUsername  → username active
  STEP 6  verify: read identity.usernameOf  → confirm

Usage:
  python setup_identity.py --network local --mnemonic "//Bob" --display "Bob" --username "bob"
"""

import argparse
import chain
import logger as log


def set_identity(portaldot, keypair, display_name: str):
    """
    Call identity.setIdentity with a display name.
    Interface: identity.setIdentity
    From: https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/identity.html
    """
    log.step(3, "Calling identity.setIdentity")
    log.info("Display name", display_name)
    log.info("Address", keypair.ss58_address)

    call = portaldot.compose_call(
        call_module="Identity",
        call_function="set_identity",
        call_params={
            "info": {
                "display":  {"Raw": display_name},
                "legal":    {"None": None},
                "web":      {"None": None},
                "matrix":   {"None": None},
                "email":    {"None": None},
                "pgp_fingerprint": None,
                "image":    {"None": None},
                "twitter":  {"None": None},
                "github":   {"None": None},
                "discord":  {"None": None},
            }
        },
    )

    extrinsic = portaldot.create_signed_extrinsic(call=call, keypair=keypair)
    receipt   = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=True)

    if receipt.is_success:
        log.success("identity.setIdentity confirmed")
        log.tx(receipt.extrinsic_hash)
    else:
        log.error(f"setIdentity failed: {receipt.error_message}")
        raise RuntimeError(receipt.error_message)


def set_username_for(portaldot, authority_keypair, target_address: str, username_full: str):
    """
    Authority grants a username to a target account.
    Interface: identity.setUsernameFor
    From: https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/identity.html
    username_full must include the suffix e.g. "bob.portalpay"
    """
    log.step(4, "Calling identity.setUsernameFor (authority grants username)")
    log.info("Target",   target_address)
    log.info("Username", username_full)

    call = portaldot.compose_call(
        call_module="Identity",
        call_function="set_username_for",
        call_params={
            "who":            target_address,
            "username":       username_full.encode(),
            "signature":      None,
            "use_allocation": True,
        },
    )

    extrinsic = portaldot.create_signed_extrinsic(call=call, keypair=authority_keypair)
    receipt   = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=True)

    if receipt.is_success:
        log.success(f"Username '{username_full}' granted — pending acceptance")
        log.tx(receipt.extrinsic_hash)
    else:
        log.error(f"setUsernameFor failed: {receipt.error_message}")
        raise RuntimeError(receipt.error_message)


def accept_username(portaldot, keypair, username_full: str):
    """
    User accepts a username that was granted to them.
    Interface: identity.acceptUsername
    From: https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/identity.html
    """
    log.step(5, "Calling identity.acceptUsername")
    log.info("Username", username_full)

    call = portaldot.compose_call(
        call_module="Identity",
        call_function="accept_username",
        call_params={"username": username_full.encode()},
    )

    extrinsic = portaldot.create_signed_extrinsic(call=call, keypair=keypair)
    receipt   = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=True)

    if receipt.is_success:
        log.success(f"Username '{username_full}' accepted and active")
        log.tx(receipt.extrinsic_hash)
    else:
        log.error(f"acceptUsername failed: {receipt.error_message}")
        raise RuntimeError(receipt.error_message)


def verify_username(portaldot, address: str):
    """
    Read identity.usernameOf to confirm the username is active.
    Storage: identity.usernameOf
    From: https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/identity.html
    """
    log.step(6, "Reading identity.usernameOf to verify")

    result = portaldot.query("Identity", "UsernameOf", [address])
    username = result.value

    if username:
        log.success(f"Verified onchain username: {username}")
    else:
        log.warn("No username found for this address yet")

    return username


def main():
    log.banner("PortalPay — Setup Identity + Username")

    parser = argparse.ArgumentParser(description="Register identity and claim username on Portaldot")
    parser.add_argument("--network",   choices=["mainnet", "local"], default="local")
    parser.add_argument("--mnemonic",  default="//Bob",  help="User's keypair mnemonic or dev shortcut")
    parser.add_argument("--authority", default="//Alice", help="Username authority keypair (has allocation)")
    parser.add_argument("--display",   default="Bob",    help="Display name for identity")
    parser.add_argument("--username",  default="bob",    help="Username (without suffix)")
    parser.add_argument("--suffix",    default="portalpay", help="Username suffix (e.g. portalpay)")
    args = parser.parse_args()

    username_full = f"{args.username}.{args.suffix}"
    log.info("Username will be", username_full)
    log.divider()

    # STEP 1 — connect
    portaldot = chain.connect(args.network)

    # STEP 2 — load keypairs
    log.step(2, "Loading keypairs")
    user_keypair      = chain.get_keypair(args.mnemonic)
    authority_keypair = chain.get_keypair(args.authority)
    log.info("User address",      user_keypair.ss58_address)
    log.info("Authority address", authority_keypair.ss58_address)

    # Check balance
    balance = chain.get_balance_pot(portaldot, user_keypair.ss58_address)
    log.info("User balance", f"{balance:.6f} POT")
    log.divider()

    # STEP 3 — set identity
    set_identity(portaldot, user_keypair, args.display)
    log.divider()

    # STEP 4 — authority grants username
    set_username_for(portaldot, authority_keypair, user_keypair.ss58_address, username_full)
    log.divider()

    # STEP 5 — user accepts username
    accept_username(portaldot, user_keypair, username_full)
    log.divider()

    # STEP 6 — verify
    verify_username(portaldot, user_keypair.ss58_address)
    log.done()


if __name__ == "__main__":
    main()
