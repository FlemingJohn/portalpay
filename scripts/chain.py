"""
chain.py — Portaldot chain connection.

All values from the official docs:
  https://portaldot-dev.readthedocs.io/en/latest/chain-info.html
    websocket   : wss://mainnet.portaldot.io
    ss58_format : 42
    token       : POT  (14 decimals)

  https://portaldot-dev.readthedocs.io/en/latest/python-sdk/Install.html
    SubstrateInterface initialisation pattern

  https://portaldot-dev.readthedocs.io/en/latest/extension.html
    SubstrateNodeExtension for event filtering
"""

from substrateinterface import SubstrateInterface, Keypair
from substrateinterface import SubstrateNodeExtension
import logger as log

# ── Official chain values from docs ──────────────────────────────────────────
MAINNET_WS    = "wss://mainnet.portaldot.io"
LOCAL_WS      = "ws://127.0.0.1:9944"
SS58_FORMAT   = 42
POT_DECIMALS  = 14        # 1 POT = 10^14 planck


def connect(network: str = "local") -> SubstrateInterface:
    """
    Connect to Portaldot.
    Exact initialisation from:
    https://portaldot-dev.readthedocs.io/en/latest/python-sdk/Install.html
    """
    url = MAINNET_WS if network == "mainnet" else LOCAL_WS

    log.step(1, f"Connecting to Portaldot ({network})")
    log.info("URL", url)

    # Exact pattern from Install docs
    portaldot = SubstrateInterface(
        url=url,
        ss58_format=SS58_FORMAT,
        type_registry_preset="default",
    )

    log.success(f"Connected  |  chain: {portaldot.chain}")
    return portaldot


def connect_with_extension(network: str = "local") -> SubstrateInterface:
    """
    Connect with the SDK Extension for event filtering.
    From: https://portaldot-dev.readthedocs.io/en/latest/extension.html
    """
    portaldot = connect(network)

    log.step(2, "Registering SDK extension for event filtering")
    # Exact pattern from extension docs
    portaldot.register_extension(SubstrateNodeExtension(max_block_range=100))
    log.success("Extension registered")

    return portaldot


def get_keypair(mnemonic: str) -> Keypair:
    """
    Create a keypair from mnemonic or dev shortcut (//Alice, //Bob).
    From: https://portaldot-dev.readthedocs.io/en/latest/python-sdk/Examples.html
    """
    return Keypair.create_from_uri(mnemonic)


def get_balance_pot(portaldot: SubstrateInterface, address: str) -> float:
    """
    Read account balance and convert from planck to POT.
    From Install docs Quick Usage section.
    POT has 14 decimals per Chain Info docs.
    """
    result  = portaldot.query("System", "Account", [address])
    free    = result.value["data"]["free"]
    return free / 10 ** POT_DECIMALS


def pot_to_planck(amount_pot: float) -> int:
    """Convert human-readable POT to planck (smallest unit)."""
    return int(amount_pot * 10 ** POT_DECIMALS)
