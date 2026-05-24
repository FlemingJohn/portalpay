"""
schedule_payment.py — Schedule a recurring payment using scheduler.scheduleNamed.
----------------------------------------------------------------------------------
The Portaldot chain will automatically send POT at the specified block
and repeat every N blocks for M times — with zero human intervention.

Pallet references:
  scheduler.scheduleNamed(id, when, maybe_periodic, priority, call)
    id             = [u8;32] unique task identifier
    when           = block number to first execute
    maybe_periodic = (period: u32, repetitions: u32) | None
    priority       = u8 (0 = normal)
    call           = the call to execute (balances.transferKeepAlive)
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/scheduler.html

  scheduler.cancelNamed(id)
    — Cancel a named scheduled task.
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/scheduler.html

  scheduler.lookup([u8;32]) → Option<(u32, u32)>
    — Verify the task exists (block_number, agenda_index)
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/scheduler.html

  identity.usernameInfoOf — resolve username → address
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/identity.html

  balances.transferKeepAlive — the inner call that gets scheduled
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/balances.html

Linear flow:
  STEP 1  connect
  STEP 2  load sender keypair
  STEP 3  resolve username → address
  STEP 4  get current block, calculate start block
  STEP 5  build inner balances.transferKeepAlive call
  STEP 6  build [u8;32] task ID
  STEP 7  call scheduler.scheduleNamed
  STEP 8  verify: scheduler.lookup confirms task exists

Usage:
  # Schedule 10 POT to bob.portalpay every 100 blocks, 5 times
  python schedule_payment.py --network local --mnemonic "//Alice" \\
    --to "bob.portalpay" --amount 10 --period 100 --reps 5

  # Cancel a scheduled task
  python schedule_payment.py --network local --mnemonic "//Alice" --cancel TASK_ID
"""

import argparse
import hashlib
import time
import chain
import logger as log


def make_task_id(username: str) -> list:
    """
    Generate a deterministic [u8;32] task ID from username + timestamp.
    scheduler.lookup uses [u8;32] as the task identifier.
    Blake2-256 hash ensures it fits in 32 bytes.
    """
    raw = f"portalpay:{username}:{int(time.time())}".encode()
    return list(hashlib.blake2b(raw, digest_size=32).digest())


def build_transfer_call(portaldot, dest_address: str, amount_pot: float):
    """
    Build a balances.transferKeepAlive call to embed in the scheduler.
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/balances.html
    """
    return portaldot.compose_call(
        call_module="Balances",
        call_function="transfer_keep_alive",
        call_params={
            "dest":  dest_address,
            "value": chain.pot_to_planck(amount_pot),
        },
    )


def schedule_recurring(portaldot, sender_keypair, dest_address: str,
                        amount_pot: float, period_blocks: int,
                        repetitions: int, task_id: list):
    """
    Call scheduler.scheduleNamed with a periodic transfer.
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/scheduler.html
    """
    header        = portaldot.rpc.chain.get_header()
    current_block = header['number']
    start_block   = current_block + 5   # start in 5 blocks

    log.step(7, "Calling scheduler.scheduleNamed")
    log.info("Start block",   str(start_block))
    log.info("Period",        f"{period_blocks} blocks")
    log.info("Repetitions",   str(repetitions))
    log.info("Total blocks",  str(period_blocks * repetitions))
    log.info("Total POT",     f"{amount_pot * repetitions:.4f} POT")

    inner_call = build_transfer_call(portaldot, dest_address, amount_pot)

    call = portaldot.compose_call(
        call_module="Scheduler",
        call_function="schedule_named",
        call_params={
            "id":             task_id,
            "when":           start_block,
            "maybe_periodic": (period_blocks, repetitions),
            "priority":       0,
            "call":           inner_call,
        },
    )

    extrinsic = portaldot.create_signed_extrinsic(call=call, keypair=sender_keypair)
    receipt   = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=True)

    if receipt.is_success:
        log.success(f"Recurring payment scheduled — fires every {period_blocks} blocks × {repetitions}")
        log.tx(receipt.extrinsic_hash)
    else:
        log.error(f"scheduleNamed failed: {receipt.error_message}")
        raise RuntimeError(receipt.error_message)

    return receipt.extrinsic_hash


def verify_scheduled(portaldot, task_id: list):
    """
    Verify the task exists using scheduler.lookup.
    Storage: scheduler.lookup([u8;32]) → Option<(u32,u32)>
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/storage/scheduler.html
    """
    log.step(8, "Verifying: scheduler.lookup")
    result = portaldot.query("Scheduler", "Lookup", [bytes(task_id)])
    value  = result.value

    if value:
        block_num, agenda_idx = value
        log.success(f"Task confirmed in scheduler at block {block_num}, index {agenda_idx}")
    else:
        log.warn("Task not found in lookup yet — may appear next block")

    return value


def cancel_task(portaldot, sender_keypair, task_id_hex: str):
    """
    Cancel a scheduled task by its hex ID.
    scheduler.cancelNamed(id: [u8;32])
    https://portaldot-dev.readthedocs.io/en/latest/module-interface/extrinsics/scheduler.html
    """
    log.step(2, "Calling scheduler.cancelNamed")
    task_id = list(bytes.fromhex(task_id_hex))

    call = portaldot.compose_call(
        call_module="Scheduler",
        call_function="cancel_named",
        call_params={"id": task_id},
    )

    extrinsic = portaldot.create_signed_extrinsic(call=call, keypair=sender_keypair)
    receipt   = portaldot.submit_extrinsic(extrinsic, wait_for_inclusion=True)

    if receipt.is_success:
        log.success("Task cancelled")
        log.tx(receipt.extrinsic_hash)
    else:
        log.error(f"cancelNamed failed: {receipt.error_message}")


def main():
    log.banner("PortalPay — Recurring Payment Scheduler")

    parser = argparse.ArgumentParser(description="Schedule recurring POT payments on Portaldot")
    parser.add_argument("--network",  choices=["mainnet", "local"], default="local")
    parser.add_argument("--mnemonic", default="//Alice")
    parser.add_argument("--to",       help="Recipient username e.g. bob.portalpay")
    parser.add_argument("--amount",   type=float, help="Amount per payment in POT")
    parser.add_argument("--period",   type=int, default=100, help="Blocks between payments")
    parser.add_argument("--reps",     type=int, default=5,   help="Number of payments")
    parser.add_argument("--cancel",   help="Cancel task by hex ID")
    args = parser.parse_args()

    # STEP 1 — connect
    portaldot = chain.connect(args.network)

    # STEP 2 — load keypair
    log.step(2, "Loading sender keypair")
    sender = chain.get_keypair(args.mnemonic)
    log.info("Sender",  sender.ss58_address)
    balance = chain.get_balance_pot(portaldot, sender.ss58_address)
    log.info("Balance", f"{balance:.6f} POT")
    log.divider()

    # Cancel mode
    if args.cancel:
        log.info("Mode", "Cancel task")
        cancel_task(portaldot, sender, args.cancel)
        log.done()
        return

    # Schedule mode
    if not args.to or not args.amount:
        log.error("--to and --amount are required for scheduling")
        return

    log.info("To",     args.to)
    log.info("Amount", f"{args.amount} POT × {args.reps} payments")
    log.info("Period", f"every {args.period} blocks")
    log.divider()

    # STEP 3 — resolve username
    log.step(3, "Resolving username → address")
    result = portaldot.query("Identity", "UsernameInfoOf", [args.to.encode()])
    if result.value is None:
        log.error(f"Username '{args.to}' not found")
        return
    dest_address = result.value.get("owner") or result.value
    log.success(f"Resolved: {dest_address}")
    log.divider()

    # STEP 4 — current block
    log.step(4, "Getting current block")
    header = portaldot.rpc.chain.get_header()
    log.info("Current block", str(header['number']))
    log.divider()

    # STEP 5+6 — build inner call and task ID
    log.step(5, "Building inner balances.transferKeepAlive call")
    log.step(6, "Generating [u8;32] task ID")
    task_id = make_task_id(args.to)
    task_id_hex = bytes(task_id).hex()
    log.info("Task ID (hex)", task_id_hex)
    log.divider()

    # STEP 7 — schedule
    schedule_recurring(portaldot, sender, dest_address,
                       args.amount, args.period, args.reps, task_id)
    log.divider()

    # STEP 8 — verify
    verify_scheduled(portaldot, task_id)

    log.done()
    log.info("To cancel this task later:", f"python schedule_payment.py --cancel {task_id_hex}")


if __name__ == "__main__":
    main()
