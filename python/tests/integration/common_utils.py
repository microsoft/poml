# ANSI color codes for colorized output
class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    ENDC = "\033[0m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"


def print_separator(title="", color=Colors.CYAN):
    """Print a colorized separator with optional title"""
    separator = "=" * 80
    if title:
        print(f"{color}{Colors.BOLD}{separator}{Colors.ENDC}")
        print(f"{color}{Colors.BOLD}    {title}{Colors.ENDC}")
        print(f"{color}{Colors.BOLD}{separator}{Colors.ENDC}")
    else:
        print(f"{color}{separator}{Colors.ENDC}")


def print_section(title, content):
    """Print a section with colored title and uncolored content"""
    print(f"{Colors.BLUE}{Colors.BOLD}{title}:{Colors.ENDC}")
    print(content)
    print()
