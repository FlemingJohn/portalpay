"""
seed_demo.py — Seeds all demo data on local dev node.
-----------------------------------------------------
Run this once before recording your demo video.
Creates identities and usernames for Alice, Bob, and Charlie.

Uses:
  identity.setIdentity      — set display names
  identity.addUsernameAuthority — make Alice an authority (run once as sudo/root)
  identity.setUsernameFor   — authority grants usernames
  identity.acceptUsername   — users accept their usernames

Reads:
  identity.usernameOf  — verify each username is active

Linear flow:
  STEP 1  connect to local node
  STEP 2  Alice becomes username authority
  STEP 3  set identity for Alice, Bob, Charlie
  STEP 4  grant usernames: alice.portalpay, bob.portalpay, charlie.portalpay
  STEP 5  accept usernames
  STEP 6  verify all three usernames are live
  STEP 7  show balances
"""

import chain
import logger as log


SUFFIX     = "portalpay"
AUTHORITY  = "//Alice"
ALLOCATION = 100   # number of usernames the authority can grant

USERS = [
    {"mnemonic": "//Alice",   "display": "Alice",   "username": "alice"},
    {"mnemonic": "//Bob",     "display": "Bob",     "username": "bob"},
    {"mnemonic": "//Charlie", "display": "Charlie", "username": "charlie"},
]


def add_username_authority(portaldot, sudo_keypair, authority_address: str):
    """
    Register Alice as a username authority with the suffix 'portalpay'.
    Interface: identity.addUsernameAuthority
    This call requires the RegistrarOrigin — on local dev node use sudo.
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/identity.html
    """
    log.step(2, "Registering username authority")
    log.info("Authority",  authority_address)
    log.info("Suffix",     SUFFIX)
    log.info("Allocation", str(ALLOCATION))

    inner_call = portaldot.compose_call(
        call_module="Identity",
        call_function="add_username_authority",
        call_params={
            "authority":  authority_address,
            "suffix":     SUFFIX.encode(),
            "allocation": ALLOCATION,
        },
    )

    # Wrap in sudo on local dev node
    sudo_call = portaldot.compose_call(
        call_module="Sudo",
        call_function="sudo",
        call_params={"call": inner_call},
    )

    extrinsic = portaldot.create_signed_extrinsic(call=sudo_call, keypair=sudo_keypair)
    receipt   = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=True)

    if receipt.is_success:
        log.success(f"Authority registered with suffix '.{SUFFIX}'")
        log.tx(receipt.extrinsic_hash)
    else:
        log.warn(f"addUsernameAuthority: {receipt.error_message} (may already exist)")


def set_identity(portaldot, keypair, display_name: str):
    """identity.setIdentity — set display name onchain."""
    call = portaldot.compose_call(
        call_module="Identity",
        call_function="set_identity",
        call_params={
            "info": {
                "display":         {"Raw": display_name},
                "legal":           {"None": None},
                "web":             {"None": None},
                "matrix":          {"None": None},
                "email":           {"None": None},
                "pgp_fingerprint": None,
                "image":           {"None": None},
                "twitter":         {"None": None},
                "github":          {"None": None},
                "discord":         {"None": None},
            }
        },
    )
    extrinsic = portaldot.create_signed_extrinsic(call=call, keypair=keypair)
    receipt   = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=True)
    if receipt.is_success:
        log.success(f"Identity set for {display_name}")
        log.tx(receipt.extrinsic_hash)
    else:
        log.error(f"setIdentity failed for {display_name}: {receipt.error_message}")


def grant_username(portaldot, authority_keypair, target_address: str, username_full: str):
    """identity.setUsernameFor — authority grants username to target."""
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
        log.success(f"Username '{username_full}' granted")
        log.tx(receipt.extrinsic_hash)
    else:
        log.error(f"setUsernameFor failed: {receipt.error_message}")


def accept_username(portaldot, keypair, username_full: str):
    """identity.acceptUsername — user accepts their username."""
    call = portaldot.compose_call(
        call_module="Identity",
        call_function="accept_username",
        call_params={"username": username_full.encode()},
    )
    extrinsic = portaldot.create_signed_extrinsic(call=call, keypair=keypair)
    receipt   = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=True)
    if receipt.is_success:
        log.success(f"Username '{username_full}' accepted")
        log.tx(receipt.extrinsic_hash)
    else:
        log.error(f"acceptUsername failed: {receipt.error_message}")


def verify_all(portaldot, users):
    """Read identity.usernameOf for each user to confirm."""
    log.step(6, "Verifying all usernames are live")
    for u in users:
        keypair  = chain.get_keypair(u["mnemonic"])
        result   = portaldot.query("Identity", "UsernameOf", [keypair.ss58_address])
        username = result.value
        if username:
            log.success(f"{u['display']} → {username}")
        else:
            log.warn(f"{u['display']} — no username found")


def main():
    log.banner("PortalPay — Seed Demo Data")

    # STEP 1 — connect to local dev node
    portaldot = chain.connect("local")
    log.divider()

    # Load all keypairs
    alice   = chain.get_keypair("//Alice")
    keypairs = {u["mnemonic"]: chain.get_keypair(u["mnemonic"]) for u in USERS}

    # STEP 2 — register authority
    add_username_authority(portaldot, alice, alice.ss58_address)
    log.divider()

    # STEPS 3–5 — for each user: setIdentity → grant username → accept
    log.step(3, "Setting identities and usernames for all demo accounts")
    for u in USERS:
        log.divider()
        kp           = keypairs[u["mnemonic"]]
        username_full = f"{u['username']}.{SUFFIX}"
        log.info("Processing", f"{u['display']} ({kp.ss58_address})")

        set_identity(portaldot, kp, u["display"])
        grant_username(portaldot, alice, kp.ss58_address, username_full)
        accept_username(portaldot, kp, username_full)

    log.divider()

    # STEP 6 — verify
    verify_all(portaldot, USERS)
    log.divider()

    # STEP 7 — show balances
    log.step(7, "Account balances")
    for u in USERS:
        kp  = keypairs[u["mnemonic"]]
        bal = chain.get_balance_pot(portaldot, kp.ss58_address)
        log.info(f"{u['display']:10}", f"{bal:.4f} POT")

    log.done()
    log.info("Demo ready", "Run the frontend and use these usernames:")
    for u in USERS:
        log.info("  →", f"{u['username']}.{SUFFIX}")


if __name__ == "__main__":
    main()
