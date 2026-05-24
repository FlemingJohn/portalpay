"""
locked_pay.py — Send a locked (vested) payment to a username.
--------------------------------------------------------------
The recipient can see the POT immediately but cannot spend it
until the unlock blocks have passed. Then they call vest() to claim it.

Pallet references:
  vesting.vestedTransfer(target, schedule: PalletVestingVestingInfo)
    schedule = { locked: u128, per_block: u128, starting_block: u32 }
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/vesting.html

  identity.usernameInfoOf — resolve username → address
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/identity.html

  vesting.vesting — read schedules to confirm
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/vesting.html

Linear flow:
  STEP 1  connect
  STEP 2  load sender keypair
  STEP 3  resolve username → address
  STEP 4  get current block number
  STEP 5  calculate vesting schedule (locked, per_block, starting_block)
  STEP 6  call vesting.vestedTransfer
  STEP 7  read back vesting.vesting to confirm

Usage:
  python locked_pay.py --network local --mnemonic "//Alice" \
    --to "bob.portalpay" --amount 10 --unlock-blocks 50
"""

import argparse
import chain
import logger as log


def get_current_block(portaldot) -> int:
    header = portaldot.rpc.chain.get_header()
    return header['number']


def vested_transfer(portaldot, sender_keypair, dest_address: str,
                    amount_pot: float, unlock_blocks: int):
    """
    Call vesting.vestedTransfer with a computed schedule.
    Interface: vesting.vestedTransfer(target, schedule)
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/vesting.html

    Schedule fields:
      locked        = total amount in planck
      per_block     = planck unlocked per block (locked / unlock_blocks)
      starting_block = current block + 1
    """
    current_block  = get_current_block(portaldot)
    starting_block = current_block + 1
    locked_planck  = chain.pot_to_planck(amount_pot)
    # per_block rounded up by 1 to guarantee full unlock
    per_block      = (locked_planck // unlock_blocks) + 1

    log.step(6, "Calling vesting.vestedTransfer")
    log.info("To",             dest_address)
    log.info("Amount",         f"{amount_pot} POT")
    log.info("Locked planck",  str(locked_planck))
    log.info("Per block",      f"{per_block} planck")
    log.info("Starting block", str(starting_block))
    log.info("End block ~",    str(starting_block + unlock_blocks))

    call = portaldot.compose_call(
        call_module="Vesting",
        call_function="vested_transfer",
        call_params={
            "target": dest_address,
            "schedule": {
                "locked":         locked_planck,
                "per_block":      per_block,
                "starting_block": starting_block,
            },
        },
    )

    extrinsic = portaldot.create_signed_extrinsic(call=call, keypair=sender_keypair)
    receipt   = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=True)

    if receipt.is_success:
        log.success(f"Locked payment created — {amount_pot} POT locked for {unlock_blocks} blocks")
        log.tx(receipt.extrinsic_hash)
    else:
        log.error(f"vestedTransfer failed: {receipt.error_message}")
        raise RuntimeError(receipt.error_message)

    return receipt.extrinsic_hash


def read_vesting_schedule(portaldot, address: str):
    """
    Read vesting.vesting to confirm the schedule was created.
    Storage: vesting.vesting(AccountId32) → Vec<PalletVestingVestingInfo>
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/vesting.html
    """
    log.step(7, "Reading vesting.vesting to confirm")
    result = portaldot.query("Vesting", "Vesting", [address])

    schedules = result.value
    if not schedules:
        log.warn("No vesting schedules found (may not be indexed yet)")
        return

    current_block = get_current_block(portaldot)
    for i, s in enumerate(schedules):
        locked     = s["locked"]
        per_block  = s["per_block"]
        start      = s["starting_block"]
        end_block  = start + (locked // per_block)
        locked_pot = locked / 10 ** 14

        log.info(f"Schedule {i}", f"{locked_pot:.6f} POT locked")
        log.info("  Start block", str(start))
        log.info("  End block",   str(end_block))
        log.info("  Blocks left", str(max(0, end_block - current_block)))

    log.success("Vesting schedule confirmed onchain")


def main():
    log.banner("PortalPay — Locked Payment")

    parser = argparse.ArgumentParser(description="Send a locked payment to a PortalPay username")
    parser.add_argument("--network",       choices=["mainnet", "local"], default="local")
    parser.add_argument("--mnemonic",      default="//Alice")
    parser.add_argument("--to",            required=True, help="Recipient username e.g. bob.portalpay")
    parser.add_argument("--amount",        type=float, required=True, help="Amount in POT")
    parser.add_argument("--unlock-blocks", type=int, default=50,
                        help="Number of blocks until fully unlocked (default: 50)")
    args = parser.parse_args()

    log.info("Recipient",     args.to)
    log.info("Amount",        f"{args.amount} POT")
    log.info("Unlock blocks", str(args.unlock_blocks))
    log.divider()

    # STEP 1 — connect
    portaldot = chain.connect(args.network)

    # STEP 2 — load keypair
    log.step(2, "Loading sender keypair")
    sender = chain.get_keypair(args.mnemonic)
    log.info("Sender",  sender.ss58_address)
    balance = chain.get_balance_pot(portaldot, sender.ss58_address)
    log.info("Balance", f"{balance:.6f} POT")
    log.divider()

    # STEP 3 — resolve username
    log.step(3, "Resolving username → address")
    log.info("Username", args.to)
    result = portaldot.query("Identity", "UsernameInfoOf", [args.to.encode()])
    if result.value is None:
        log.error(f"Username '{args.to}' not found")
        return
    dest_address = result.value.get("owner") or result.value
    log.success(f"Resolved: {dest_address}")
    log.divider()

    # STEP 4 — current block
    log.step(4, "Getting current block number")
    current = get_current_block(portaldot)
    log.info("Current block", str(current))
    log.divider()

    # STEP 5 — calculate schedule
    log.step(5, "Calculating vesting schedule")
    locked_planck = chain.pot_to_planck(args.amount)
    per_block     = (locked_planck // args.unlock_blocks) + 1
    log.info("locked",         f"{locked_planck} planck")
    log.info("per_block",      f"{per_block} planck")
    log.info("starting_block", str(current + 1))
    log.divider()

    # STEP 6 — send
    vested_transfer(portaldot, sender, dest_address, args.amount, args.unlock_blocks)
    log.divider()

    # STEP 7 — confirm
    read_vesting_schedule(portaldot, dest_address)
    log.done()


if __name__ == "__main__":
    main()
