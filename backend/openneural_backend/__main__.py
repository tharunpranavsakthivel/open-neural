"""Command-line entry point for the OpenNeural backend service.

Parses local development host, port, and data directory options, then delegates
serving to Uvicorn. When port is 0, an OS-assigned ephemeral port is used and
printed to stdout as "OPENNEURAL_PORT=<actual_port>" for the parent process.
Importing this module has no side effects until main() is called.
"""

import argparse
import os
import socket
import sys

import uvicorn


def find_free_port() -> int:
    """Find a free ephemeral port by binding to port 0.

    Returns:
        int: An available ephemeral port number assigned by the OS.

    Raises:
        RuntimeError: If unable to bind to find a free port.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            sock.listen(1)
            port = sock.getsockname()[1]
            return port
    except OSError as e:
        raise RuntimeError(f"Failed to find a free ephemeral port: {e}") from e


def build_parser() -> argparse.ArgumentParser:
    """Build the backend CLI argument parser.

    Returns:
        argparse.ArgumentParser: Parser accepting host, port, and data-dir options.

    Raises:
        No application-level exceptions are expected.
    """
    parser = argparse.ArgumentParser(description="Run the OpenNeural backend.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1).")
    parser.add_argument(
        "--port",
        default=0,
        type=int,
        help="Bind port. Use 0 for OS-assigned ephemeral port (default: 0).",
    )
    parser.add_argument(
        "--data-dir",
        default="~/openneural",
        help="Data directory path for snapshots, pipelines, models, etc. (default: ~/openneural).",
    )
    return parser


def main() -> None:
    """Run the OpenNeural backend with Uvicorn.

    Binds to the specified host and port. If port is 0, an ephemeral port is
    assigned by the OS and printed to stdout as "OPENNEURAL_PORT=<port>" for
    the parent process to parse. The data directory is set via environment
    variable so the app can access it.

    Returns:
        None: The function blocks until Uvicorn exits.

    Raises:
        SystemExit: Raised by argparse for invalid CLI arguments or invalid host.
        RuntimeError: Propagated by Uvicorn startup failures or port binding issues.
    """
    args = build_parser().parse_args()

    # Validate that the app binds exclusively to localhost (refuse 0.0.0.0)
    # This is a security requirement to prevent external network access
    if args.host in ("0.0.0.0", "::", "::0"):
        print(
            f"Error: Binding to '{args.host}' is not allowed. "
            "OpenNeural must bind to 127.0.0.1 (localhost) only.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Resolve and set the data directory environment variable
    data_dir = os.path.expanduser(args.data_dir)
    os.environ["OPENNEURAL_DATA_DIR"] = data_dir

    # Determine the port to use
    port = args.port
    if port == 0:
        port = find_free_port()

    # Print the port for the parent process to parse
    # This must happen before Uvicorn starts, as it blocks
    print(f"OPENNEURAL_PORT={port}", flush=True)

    # Run Uvicorn with the resolved port
    uvicorn.run(
        "openneural_backend.app:app",
        host=args.host,
        port=port,
    )


if __name__ == "__main__":
    main()
