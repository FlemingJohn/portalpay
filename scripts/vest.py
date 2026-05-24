"""
vest.py — Claim all unlocked (matured) vested POT for an account.
-----------------------------------------------------------------
After a vesting schedule's blocks have passed, the recipient calls
vest() to move the unlocked POT into their spendable balance.

Pallet references:
  vesting.vest()
    — Unlock any vested funds for the caller.
    — Emits vesting.VestingUpdated or vesting.VestingCompleted
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/vesting.html

  vesting.vesting(AccountId32) — read schedules before and after
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/vesting.html

Events fired (from docs):
  vesting.VestingUpdated(account, unvested)  — partial unlock
  vesting.VestingCompleted(account)          — fully unlocked
  https://portaldot-dev.readthedocs.io/en/latest/module-interface/events/vesting.html

Linear flow:
  STEP 1  connect
  STEP 2  load keypair
  STEP 3  read vesting.vesting — show current schedule
  STEP 4  call vesting.vest()
  STEP 5  read vesting.vesting again — show updated state
  STEP 6  show new spendable balance

Usage:
  python vest.py --network local --mnemonic "//Bob"
"""

import argparse
import chain
import logger as log


def read_schedules(portaldot, address: str, label: str = ""):
    """Read vesting.vesting storage for an address."""
    result    = portaldot.query("Vesting", "Vesting", [address])
    schedules = result.value or []

    if label:
        log.info(label, f"{len(schedules)} schedule(s)")

    header        = portaldot.rpc.chain.get_header()
    current_block = header['number']

    for i, s in enumerate(schedules):
        locked    = s["locked"]
        per_block = s["per_block"]
        start     = s["starting_block"]
        end_block = start + (locked // per_block)
        elapsed   = max(0, current_block - start)
        unlocked  = min(locked, per_block * elapsed)
        still     = locked - unlocked

        log.info(f"  Schedule {i}",
                 f"locked={still / 10**14:.6f} POT  "
                 f"unlocked={unlocked / 10**14:.6f} POT  "
                 f"end_block={end_block}")

    return schedules


def main():
    log.banner("PortalPay — Claim Vested POT")

    parser = argparse.ArgumentParser(description="Claim unlocked vested POT")
    parser.add_argument("--network",  choices=["mainnet", "local"], default="local")
    parser.add_argument("--mnemonic", default="//Bob", help="Recipient keypair mnemonic")
    args = parser.parse_args()

    # STEP 1 — connect
    portaldot = chain.connect(args.network)

    # STEP 2 — load keypair
    log.step(2, "Loading keypair")
    keypair = chain.get_keypair(args.mnemonic)
    log.info("Address", keypair.ss58_address)
    balance_before = chain.get_balance_pot(portaldot, keypair.ss58_address)
    log.info("Balance before", f"{balance_before:.6f} POT")
    log.divider()

    # STEP 3 — read before
    log.step(3, "Reading vesting schedules before vest()")
    schedules_before = read_schedules(portaldot, keypair.ss58_address, "Schedules found")

    if not schedules_before:
        log.warn("No vesting schedules found for this account")
        log.info("Hint", "Use locked_pay.py to create a locked payment first")
        return

    log.divider()

    # STEP 4 — call vesting.vest()
    log.step(4, "Calling vesting.vest()")

    call = portaldot.compose_call(
        call_module="Vesting",
        call_function="vest",
        call_params={},
    )

    extrinsic = portaldot.create_signed_extrinsic(call=call, keypair=keypair)
    receipt   = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=True)

    if receipt.is_success:
        log.success("vesting.vest() confirmed")
        log.tx(receipt.extrinsic_hash)
        # Show which event was emitted
        for event in (receipt.contract_events or []):
            log.info("Event", str(event))
    else:
        log.error(f"vest() failed: {receipt.error_message}")
        return

    log.divider()

    # STEP 5 — read after
    log.step(5, "Reading vesting schedules after vest()")
    read_schedules(portaldot, keypair.ss58_address, "Updated schedules")
    log.divider()

    # STEP 6 — show new balance
    log.step(6, "Checking new spendable balance")
    balance_after = chain.get_balance_pot(portaldot, keypair.ss58_address)
    log.info("Balance before", f"{balance_before:.6f} POT")
    log.info("Balance after",  f"{balance_after:.6f} POT")
    gained = balance_after - balance_before
    if gained > 0:
        log.success(f"+{gained:.6f} POT is now spendable")
    log.done()


if __name__ == "__main__":
    main()
