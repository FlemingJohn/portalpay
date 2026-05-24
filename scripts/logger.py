"""
logger.py — Colorful, structured terminal logs for all PortalPay scripts.
Every step in the flow is visible at a glance.
"""

# ANSI color codes
RESET  = "\033[0m"
BOLD   = "\033[1m"
CYAN   = "\033[96m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
BLUE   = "\033[94m"
MAGENTA= "\033[95m"
WHITE  = "\033[97m"
DIM    = "\033[2m"

def banner(title: str):
    line = "═" * 54
    print(f"\n{BOLD}{CYAN}{line}{RESET}")
    print(f"{BOLD}{CYAN}  {title}{RESET}")
    print(f"{BOLD}{CYAN}{line}{RESET}\n")

def step(number: int, description: str):
    print(f"{BOLD}{BLUE}  [{number}]{RESET} {WHITE}{description}{RESET}")

def success(message: str):
    print(f"  {GREEN}✓{RESET}  {GREEN}{message}{RESET}")

def info(label: str, value: str = ""):
    if value:
        print(f"  {DIM}│{RESET}  {YELLOW}{label}:{RESET} {WHITE}{value}{RESET}")
    else:
        print(f"  {DIM}│{RESET}  {YELLOW}{label}{RESET}")

def warn(message: str):
    print(f"  {YELLOW}⚠{RESET}  {YELLOW}{message}{RESET}")

def error(message: str):
    print(f"  {RED}✗{RESET}  {RED}{message}{RESET}")

def divider():
    print(f"  {DIM}{'─' * 50}{RESET}")

def tx(hash_str: str):
    print(f"  {MAGENTA}⛓{RESET}  {DIM}tx:{RESET} {MAGENTA}{hash_str}{RESET}")

def done():
    print(f"\n  {BOLD}{GREEN}All steps complete.{RESET}\n")
