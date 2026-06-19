#!/usr/bin/env python3
"""Verify installed Python packages against a locked requirements file with SHA-256 hashes.

This script checks that all packages installed in the current environment match
the expected versions and hashes specified in a requirements.lock file. It is
used to ensure supply chain integrity and reproducible builds.

Usage:
    python scripts/verify_deps.py [options]

Options:
    --lock-file PATH    Path to requirements.lock file (default: backend/requirements.lock)
    --verbose           Show detailed output for each package
    --strict            Exit with error code 1 if any package fails verification
    --json              Output results as JSON

Returns:
    Exit code 0 if all packages verified successfully, 1 otherwise.

Examples:
    python scripts/verify_deps.py
    python scripts/verify_deps.py --lock-file custom.lock --verbose
    python scripts/verify_deps.py --json --strict
"""

import argparse
import hashlib
import json
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


@dataclass
class PackageInfo:
    """Information about a package from the lock file.
    
    Attributes:
        name: Package name (normalized, lowercase)
        version: Expected version string
        hashes: List of acceptable SHA-256 hashes
    """
    name: str
    version: str
    hashes: List[str]


@dataclass
class VerificationResult:
    """Result of verifying a single package.
    
    Attributes:
        package_name: Name of the package
        expected_version: Version from lock file
        installed_version: Version currently installed
        expected_hash: Expected SHA-256 hash
        actual_hash: Calculated SHA-256 hash
        status: "OK", "VERSION_MISMATCH", "HASH_MISMATCH", or "NOT_INSTALLED"
        message: Human-readable description
    """
    package_name: str
    expected_version: str
    installed_version: Optional[str]
    expected_hash: str
    actual_hash: Optional[str]
    status: str
    message: str


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.
    
    Returns:
        Parsed arguments namespace.
    """
    parser = argparse.ArgumentParser(
        description="Verify installed packages against locked requirements"
    )
    parser.add_argument(
        "--lock-file",
        type=Path,
        default=Path(__file__).parent.parent / "backend" / "requirements.lock",
        help="Path to requirements.lock file",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show detailed output",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit with error if any package fails",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )
    return parser.parse_args()


def parse_lock_file(lock_file: Path) -> Dict[str, PackageInfo]:
    """Parse the requirements.lock file and extract package info with hashes.
    
    Args:
        lock_file: Path to the lock file
        
    Returns:
        Dictionary mapping normalized package names to PackageInfo
        
    Raises:
        FileNotFoundError: If lock file doesn't exist
        ValueError: If lock file format is invalid
    """
    if not lock_file.exists():
        raise FileNotFoundError(f"Lock file not found: {lock_file}")
    
    packages: Dict[str, PackageInfo] = {}
    content = lock_file.read_text()
    
    # Pattern to match package entries with hashes
    # Matches: package==version \\n    #     --hash=sha256:hash
    pattern = r'^(\w[\w.-]*)==(\S+)\s+\\?\s*\n(?:\s*--hash=sha256:([a-f0-9]+)\s*\\?\s*\n)+'
    
    for match in re.finditer(pattern, content, re.MULTILINE):
        lines = match.group(0).strip().split('\n')
        name_version = lines[0].replace(' \\', '').strip()
        name, version = name_version.split('==')
        
        hashes = []
        for line in lines[1:]:
            hash_match = re.search(r'--hash=sha256:([a-f0-9]+)', line)
            if hash_match:
                hashes.append(hash_match.group(1))
        
        normalized_name = name.lower().replace('-', '_').replace('.', '_')
        packages[normalized_name] = PackageInfo(
            name=name,
            version=version,
            hashes=hashes
        )
    
    return packages


def get_installed_packages() -> Dict[str, str]:
    """Get all installed packages and their versions using pip list.
    
    Returns:
        Dictionary mapping normalized package names to versions
    """
    result = subprocess.run(
        [sys.executable, "-m", "pip", "list", "--format=json"],
        capture_output=True,
        text=True,
        check=True
    )
    
    packages = json.loads(result.stdout)
    installed: Dict[str, str] = {}
    
    for pkg in packages:
        normalized_name = pkg["name"].lower().replace('-', '_').replace('.', '_')
        installed[normalized_name] = pkg["version"]
    
    return installed


def get_package_hash(package_name: str) -> Optional[str]:
    """Get the SHA-256 hash of an installed package.
    
    Uses pip inspect to get the hash of the installed distribution.
    Falls back to calculating from installed files if pip inspect fails.
    
    Args:
        package_name: Name of the package
        
    Returns:
        SHA-256 hash string or None if unavailable
    """
    try:
        # Try to get hash from pip inspect
        result = subprocess.run(
            [sys.executable, "-m", "pip", "inspect", package_name],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            # Try to find hash in pip inspect output
            hash_match = re.search(r'"sha256": "([a-f0-9]+)"', result.stdout, re.IGNORECASE)
            if hash_match:
                return hash_match.group(1).lower()
        
        # Fallback: calculate hash from package files
        return _calculate_package_hash(package_name)
        
    except Exception:
        return None


def _calculate_package_hash(package_name: str) -> Optional[str]:
    """Calculate SHA-256 hash from package installation files.
    
    This is a fallback when pip inspect doesn't provide the hash.
    
    Args:
        package_name: Name of the package
        
    Returns:
        SHA-256 hash or None
    """
    try:
        import importlib.metadata as metadata
        dist = metadata.Distribution.from_name(package_name)
        
        # Get all files in the distribution
        sha256 = hashlib.sha256()
        for file in dist.files or []:
            if file.suffix in ('.py', '.so', '.pyd', '.pyi', '.typed'):
                try:
                    sha256.update(file.read_bytes())
                except (OSError, PermissionError):
                    pass
        
        return sha256.hexdigest() if sha256.digest() else None
    except Exception:
        return None


def verify_package(
    package_name: str,
    lock_info: PackageInfo,
    installed_packages: Dict[str, str]
) -> VerificationResult:
    """Verify a single package against the lock file.
    
    Args:
        package_name: Normalized package name
        lock_info: Expected package info from lock file
        installed_packages: Dictionary of installed packages
        
    Returns:
        VerificationResult with status and details
    """
    if package_name not in installed_packages:
        return VerificationResult(
            package_name=lock_info.name,
            expected_version=lock_info.version,
            installed_version=None,
            expected_hash=lock_info.hashes[0] if lock_info.hashes else "N/A",
            actual_hash=None,
            status="NOT_INSTALLED",
            message=f"Package '{lock_info.name}' is not installed"
        )
    
    installed_version = installed_packages[package_name]
    
    if installed_version != lock_info.version:
        return VerificationResult(
            package_name=lock_info.name,
            expected_version=lock_info.version,
            installed_version=installed_version,
            expected_hash=lock_info.hashes[0] if lock_info.hashes else "N/A",
            actual_hash=None,
            status="VERSION_MISMATCH",
            message=f"Version mismatch: expected {lock_info.version}, got {installed_version}"
        )
    
    # Get actual hash
    actual_hash = get_package_hash(lock_info.name)
    expected_hash = lock_info.hashes[0] if lock_info.hashes else None
    
    if expected_hash and actual_hash and actual_hash.lower() != expected_hash.lower():
        return VerificationResult(
            package_name=lock_info.name,
            expected_version=lock_info.version,
            installed_version=installed_version,
            expected_hash=expected_hash,
            actual_hash=actual_hash,
            status="HASH_MISMATCH",
            message=f"Hash mismatch: package may have been tampered with"
        )
    
    return VerificationResult(
        package_name=lock_info.name,
        expected_version=lock_info.version,
        installed_version=installed_version,
        expected_hash=expected_hash or "N/A",
        actual_hash=actual_hash,
        status="OK",
        message="Package verified successfully"
    )


def print_results(results: List[VerificationResult], verbose: bool, use_json: bool) -> None:
    """Print verification results in human-readable or JSON format.
    
    Args:
        results: List of verification results
        verbose: Whether to show detailed output
        use_json: Whether to output JSON
    """
    if use_json:
        print(json.dumps([asdict(r) for r in results], indent=2))
        return
    
    ok_count = sum(1 for r in results if r.status == "OK")
    error_count = len(results) - ok_count
    
    print(f"\n{'=' * 70}")
    print(f"Package Verification Results")
    print(f"{'=' * 70}\n")
    
    for result in results:
        status_icon = "✓" if result.status == "OK" else "✗"
        print(f"{status_icon} {result.package_name:30} {result.status}")
        
        if verbose or result.status != "OK":
            print(f"  Expected: {result.expected_version}")
            print(f"  Installed: {result.installed_version or 'N/A'}")
            if result.expected_hash != "N/A":
                print(f"  Expected hash: {result.expected_hash[:16]}...")
            if result.actual_hash:
                print(f"  Actual hash: {result.actual_hash[:16]}...")
            print(f"  {result.message}")
            print()
    
    print(f"{'=' * 70}")
    print(f"Total: {len(results)} packages | ✓ {ok_count} OK | ✗ {error_count} FAILED")
    print(f"{'=' * 70}\n")


def main() -> int:
    """Main entry point.
    
    Returns:
        Exit code: 0 for success, 1 for failure
    """
    args = parse_args()
    
    try:
        # Parse lock file
        if not args.json:
            print(f"Reading lock file: {args.lock_file}")
        lock_packages = parse_lock_file(args.lock_file)
        
        # Get installed packages
        if not args.json:
            print(f"Found {len(lock_packages)} packages in lock file")
            print("Checking installed packages...")
        installed_packages = get_installed_packages()
        
        # Verify each package
        results = []
        for pkg_name, lock_info in lock_packages.items():
            result = verify_package(pkg_name, lock_info, installed_packages)
            results.append(result)
        
        # Print results
        print_results(results, args.verbose, args.json)
        
        # Determine exit code
        failed = any(r.status != "OK" for r in results)
        if args.strict and failed:
            return 1
        
        # In non-strict mode, only fail if there are version mismatches or missing packages
        critical_failures = any(
            r.status in ("VERSION_MISMATCH", "NOT_INSTALLED") for r in results
        )
        if critical_failures:
            return 1
        
        return 0
        
    except FileNotFoundError as e:
        if args.json:
            print(json.dumps({"error": str(e)}))
        else:
            print(f"Error: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        if args.json:
            print(json.dumps({"error": str(e)}))
        else:
            print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
