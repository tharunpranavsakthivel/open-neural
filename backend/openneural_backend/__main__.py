"""Command-line entry point for the OpenNeural backend service.

Parses local development host and port options, then delegates serving to
Uvicorn. Importing this module has no side effects until main() is called.
"""

import argparse

import uvicorn


def build_parser() -> argparse.ArgumentParser:
    """Build the backend CLI argument parser.

    Returns:
        argparse.ArgumentParser: Parser accepting host and port options.

    Raises:
        No application-level exceptions are expected.
    """
    parser = argparse.ArgumentParser(description="Run the OpenNeural backend.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host.")
    parser.add_argument("--port", default=8000, type=int, help="Bind port.")
    return parser


def main() -> None:
    """Run the OpenNeural backend with Uvicorn.

    Returns:
        None: The function blocks until Uvicorn exits.

    Raises:
        SystemExit: Raised by argparse for invalid CLI arguments.
        RuntimeError: Propagated by Uvicorn startup failures.
    """
    args = build_parser().parse_args()
    uvicorn.run("openneural_backend.app:app", host=args.host, port=args.port)


if __name__ == "__main__":
    main()
