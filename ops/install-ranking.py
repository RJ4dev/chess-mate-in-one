#!/usr/bin/env python3
"""Owner-run, fresh-install-only ranking service installer. Never run by tests.

Requires Linux/systemd, root, Node >=20 and distro /usr/bin/caddy already present.
Install the distro Caddy package separately, then stop/disable its default service
if it is unused. This installer never changes that service, packages or firewalls.
Use --backend-only --hostname <node.ts.net> for an existing Tailscale proxy.
That mode installs only the localhost backend; Funnel publication is a separate owner action.
All output is one JSON object; exit 2 means installed but HTTPS is still pending.
"""

import argparse
import errno
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import pwd
import queue
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass


REPOSITORY = "RJ4dev/chess-mate-in-one"
ORIGIN = "https://rj4dev.github.io"
APP_DIR = Path("/opt/chess-ranking")
CONFIG_DIR = Path("/etc/chess-ranking")
DATA_DIR = Path("/var/lib/chess-ranking")
TLS_DIR = Path("/var/lib/chess-ranking-https")
UNIT_DIR = Path("/etc/systemd/system")
UNITS = ("chess-ranking.service", "chess-ranking-https.service")
USERS = ("chess-ranking", "chess-ranking-https")
SOURCE_MAX_BYTES = 256 * 1024


class InstallError(Exception):
    def __init__(self, code, message, **details):
        super().__init__(message)
        self.code, self.details = code, details


class JsonArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        raise InstallError("invalid_arguments", message)


@dataclass(frozen=True)
class Plan:
    hostname: str
    node: str
    caddy: str
    systemctl: str
    useradd: str
    nologin: str
    runuser: str = "/usr/sbin/runuser"
    backend_only: bool = False


def arguments(argv=None):
    parser = JsonArgumentParser(description=__doc__)
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--source-sha256", required=True)
    parser.add_argument("--hostname", help="Public DNS hostname; otherwise use chess.<public-IPv4>.sslip.io")
    parser.add_argument("--backend-only", action="store_true", help="Install only localhost backend for a separate Tailscale Funnel on port 10000")
    parser.add_argument("--preflight-only", action="store_true", help="Check the host without downloading or changing anything")
    parser.add_argument("--allow-missing-caddy", action="store_true", help="With --preflight-only, complete other checks even if Caddy is absent")
    args = parser.parse_args(argv)
    if args.allow_missing_caddy and not args.preflight_only:
        raise InstallError("invalid_arguments", "--allow-missing-caddy requires --preflight-only.")
    if not re.fullmatch(r"[0-9a-fA-F]{40}", args.source_commit):
        raise InstallError("invalid_commit", "--source-commit must contain exactly 40 hexadecimal characters.")
    if not re.fullmatch(r"[0-9a-fA-F]{64}", args.source_sha256):
        raise InstallError("invalid_sha256", "--source-sha256 must contain exactly 64 hexadecimal characters.")
    args.source_commit = args.source_commit.lower()
    args.source_sha256 = args.source_sha256.lower()
    if args.hostname is not None:
        args.hostname = validate_hostname(args.hostname)
    if args.backend_only and (not args.hostname or not args.hostname.endswith(".ts.net")):
        raise InstallError("tailnet_hostname_required", "--backend-only requires --hostname with this node's .ts.net DNS name.")
    return args


def validate_hostname(value):
    value = value.lower()
    labels = value.split(".")
    if len(value) > 253 or len(labels) < 2 or any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in labels):
        raise InstallError("invalid_hostname", "Provide a public DNS hostname without a scheme, path, port or trailing dot.")
    try:
        ipaddress.ip_address(value)
    except ValueError:
        pass
    else:
        raise InstallError("invalid_hostname", "Use a public DNS hostname rather than an IP literal.")
    if labels[-1] in {"localhost", "local", "internal", "invalid", "test", "example"} or labels[-1].isdigit():
        raise InstallError("invalid_hostname", "A public DNS hostname is required for automatic HTTPS.")
    return value


def run(command, *, check=True, timeout=15):
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise InstallError("command_failed", f"Could not run {command[0]}: {error}") from error
    if check and result.returncode:
        raise InstallError("command_failed", f"Command failed: {' '.join(command)}", stderr=result.stderr[-2000:])
    return result


def secure_path(path, *, executable=False):
    """Reject executable paths writable by other users, including ancestors."""
    candidate = Path(path)
    if not candidate.is_absolute():
        raise InstallError("unsafe_executable", "Executable paths must be absolute.")
    try:
        candidate = candidate.resolve(strict=True)
        for current in (candidate, *candidate.parents):
            info = current.stat()
            if info.st_uid != 0 or info.st_mode & 0o022:
                raise InstallError("unsafe_executable", f"Not a root-owned, protected path: {current}")
        if executable and (not candidate.is_file() or not os.access(candidate, os.X_OK)):
            raise InstallError("unsafe_executable", f"Not an executable file: {candidate}")
    except OSError as error:
        raise InstallError("unsafe_executable", f"Cannot inspect {path}: {error}") from error
    value = str(candidate)
    if not re.fullmatch(r"/[A-Za-z0-9_./+-]+", value):
        raise InstallError("unsafe_executable", "Executable paths must contain only simple systemd-safe characters.")
    return value


def executable(name, code):
    found = shutil.which(name)
    if not found:
        raise InstallError(code, f"Required executable is missing: {name}. Install it separately, then rerun; nothing was changed.")
    return secure_path(found, executable=True)


def detect_hostname():
    ip = executable("ip", "missing_ip_command")
    try:
        interfaces = json.loads(run([ip, "-j", "addr", "show", "scope", "global"]).stdout)
        addresses = sorted({str(address) for interface in interfaces for item in interface.get("addr_info", [])
                            if item.get("family") == "inet"
                            and (address := ipaddress.ip_address(item.get("local", ""))).version == 4
                            and address.is_global})
    except (ValueError, TypeError, AttributeError) as error:
        raise InstallError("public_ipv4_required", "Could not detect a configured public IPv4. Supply --hostname pointing to this VPS.") from error
    if not addresses:
        raise InstallError("public_ipv4_required", "No configured public IPv4 was found. Provide the public IP or a DNS hostname before installation; NAT-only addresses are not guessed.")
    if len(addresses) > 1:
        raise InstallError("public_ipv4_ambiguous", "Several public IPv4 addresses are configured. Supply --hostname for the intended address.", addresses=addresses)
    return f"chess.{addresses[0]}.sslip.io"


def check_ports():
    for port in (80, 443, 8787):
        for family, bind_address in ((socket.AF_INET, "0.0.0.0"), (socket.AF_INET6, "::")):
            try:
                with socket.socket(family, socket.SOCK_STREAM) as probe:
                    if family == socket.AF_INET6:
                        probe.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
                    probe.bind((bind_address, port))
            except OSError as error:
                if family == socket.AF_INET6 and error.errno in {errno.EAFNOSUPPORT, errno.EPROTONOSUPPORT, errno.EADDRNOTAVAIL}:
                    continue
                raise InstallError("port_unavailable", f"TCP port {port} is unavailable; no firewall or service settings were changed.", port=port) from error


def check_backend_port():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind(("127.0.0.1", 8787))
    except OSError as error:
        raise InstallError("port_unavailable", "Local backend TCP port 8787 is unavailable; nothing was changed.", port=8787) from error


def preflight(args):
    if sys.platform != "linux" or os.geteuid() != 0:
        raise InstallError("linux_root_required", "Run this installer as root on the target Linux VPS.")
    if not Path("/run/systemd/system").is_dir():
        raise InstallError("systemd_required", "A running systemd host is required.")
    node = executable("node", "missing_node")
    version = run([node, "--version"]).stdout.strip()
    match = re.fullmatch(r"v(\d+)\.\d+\.\d+", version)
    if not match or int(match[1]) < 20:
        raise InstallError("unsupported_node", "Node >=20 must already be installed; nothing was changed.", version=version)
    caddy_present = not args.backend_only and Path("/usr/bin/caddy").exists()
    if not args.backend_only and not caddy_present and not (args.preflight_only and args.allow_missing_caddy):
        raise InstallError("missing_caddy", "Install the distro Caddy package separately. Stop/disable its default service only if unused, then rerun. Nothing was changed.")
    caddy = secure_path("/usr/bin/caddy", executable=True) if caddy_present else ""
    systemctl = executable("systemctl", "missing_systemctl")
    useradd = executable("useradd", "missing_useradd")
    nologin = executable("nologin", "missing_nologin")
    runuser = executable("runuser", "missing_runuser")
    for directory in (APP_DIR, CONFIG_DIR, DATA_DIR, TLS_DIR):
        if os.path.lexists(directory):
            raise InstallError("existing_installation", f"Fresh installation only: {directory} already exists.")
        secure_path(directory.parent)
    secure_path(UNIT_DIR)
    for unit in UNITS:
        state = run([systemctl, "show", unit, "--property=LoadState", "--value"], check=False).stdout.strip()
        if os.path.lexists(UNIT_DIR / unit) or state != "not-found":
            raise InstallError("existing_installation", f"Fresh installation only: {unit} already exists or its absence could not be verified.")
    for user in USERS:
        try:
            pwd.getpwnam(user)
        except KeyError:
            pass
        else:
            raise InstallError("existing_installation", f"Fresh installation only: user {user} already exists.")
    for unit in (() if args.backend_only else ("nginx.service", "apache2.service", "httpd.service", "caddy.service")):
        if run([systemctl, "is-active", unit], check=False).stdout.strip() in {"active", "activating", "reloading"}:
            raise InstallError("existing_web_server", f"{unit} is active. This installer does not replace existing web servers.")
    if args.backend_only:
        check_backend_port()
    else:
        check_ports()
    return Plan(args.hostname or detect_hostname(), node, caddy, systemctl, useradd, nologin, runuser, args.backend_only)


def bounded_network(operation, timeout):
    # urllib's socket timeout does not bound DNS resolution or a trickle response.
    # A daemon worker bounds the owner's overall wait as well as socket I/O.
    result = queue.Queue(maxsize=1)

    def work():
        try:
            result.put((True, operation()))
        except Exception as error:
            result.put((False, error))

    threading.Thread(target=work, daemon=True).start()
    try:
        ok, value = result.get(timeout=timeout)
    except queue.Empty as error:
        raise TimeoutError("Network deadline exceeded.") from error
    if not ok:
        raise value
    return value


def download_source(args):
    url = f"https://raw.githubusercontent.com/{REPOSITORY}/{args.source_commit}/backend/server.mjs"
    request = urllib.request.Request(url, headers={"User-Agent": "chess-ranking-owner-installer/1", "Accept": "text/plain"})
    def fetch():
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.read(SOURCE_MAX_BYTES + 1)
    try:
        source = bounded_network(fetch, 20)
    except (OSError, urllib.error.URLError) as error:
        raise InstallError("source_download_failed", f"Could not fetch the pinned backend source: {error}") from error
    if len(source) > SOURCE_MAX_BYTES:
        raise InstallError("source_too_large", "Pinned backend source exceeds the download limit.")
    actual = hashlib.sha256(source).hexdigest()
    if actual != args.source_sha256:
        raise InstallError("source_hash_mismatch", "Downloaded source did not match --source-sha256; nothing was changed.", actual_sha256=actual)
    try:
        text = source.decode("utf-8")
    except UnicodeDecodeError as error:
        raise InstallError("invalid_source", "Backend source must be UTF-8.") from error
    # The reviewed backend is one file and imports only Node's standard library.
    modules = re.findall(r"\bfrom\s*['\"]([^'\"]+)['\"]", text)
    # Optional SQLite is a built-in available on the reviewed Node24 host.
    # Keeping this import lazy preserves the existing JSON-only Node20 mode.
    without_sqlite = re.sub(r"\bimport\(\s*['\"]node:sqlite['\"]\s*\)", "", text)
    if not modules or any(not module.startswith("node:") for module in modules) or re.search(r"\bimport\s*(?:\(|['\"])", without_sqlite):
        raise InstallError("unsupported_source", "Expected the reviewed single-file backend with only node: imports.")
    return source


def backend_unit(plan):
    return f"""[Unit]
Description=Chess shared ranking backend
After=network.target

[Service]
Type=simple
User=chess-ranking
Group=chess-ranking
WorkingDirectory=/opt/chess-ranking
ExecStart={plan.node} /opt/chess-ranking/server.mjs
Environment=HOST=127.0.0.1
Environment=PORT=8787
Environment=DATA_FILE=/var/lib/chess-ranking/players.json
Environment=ALLOWED_ORIGIN={ORIGIN}
Environment=TRUST_PROXY_LOOPBACK={0 if plan.backend_only else 1}
StateDirectory=chess-ranking
StateDirectoryMode=0700
UMask=0077
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
RestrictSUIDSGID=true
LockPersonality=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
CapabilityBoundingSet=

[Install]
WantedBy=multi-user.target
"""


def https_unit(plan):
    return f"""[Unit]
Description=Chess ranking dedicated HTTPS proxy
After=network-online.target chess-ranking.service
Wants=network-online.target chess-ranking.service

[Service]
Type=simple
User=chess-ranking-https
Group=chess-ranking-https
ExecStart={plan.caddy} run --config /etc/chess-ranking/Caddyfile --adapter caddyfile
Environment=XDG_DATA_HOME=/var/lib/chess-ranking-https
Environment=XDG_CONFIG_HOME=/var/lib/chess-ranking-https
StateDirectory=chess-ranking-https
StateDirectoryMode=0700
UMask=0077
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
RestrictSUIDSGID=true
LockPersonality=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
"""


def caddy_config(plan):
    return f"""{{
    admin off
    persist_config off
    storage file_system /var/lib/chess-ranking-https
}}

{plan.hostname} {{
    reverse_proxy 127.0.0.1:8787 {{
        header_up X-Real-IP {{remote_host}}
    }}
}}
"""


def rollback_commands(backend_only=False):
    if backend_only:
        return ["systemctl disable --now chess-ranking.service",
                "rm -f /etc/systemd/system/chess-ranking.service", "systemctl daemon-reload"]
    return ["systemctl disable --now chess-ranking-https.service chess-ranking.service",
            "rm -f /etc/systemd/system/chess-ranking-https.service /etc/systemd/system/chess-ranking.service",
            "systemctl daemon-reload"]


def write_new(path, content, mode):
    # Exclusive creation also catches a competing install after the preflight.
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    with os.fdopen(descriptor, "wb") as handle:
        os.fchmod(handle.fileno(), mode)
        handle.write(content.encode("utf-8") if isinstance(content, str) else content)
        handle.flush()
        os.fsync(handle.fileno())


def install(plan, source):
    user_directories = ((USERS[0], DATA_DIR),) if plan.backend_only else tuple(zip(USERS, (DATA_DIR, TLS_DIR)))
    for user, directory in user_directories:
        run([plan.useradd, "--system", "--user-group", "--home-dir", str(directory), "--no-create-home", "--shell", plan.nologin, user])
    for directory in (APP_DIR, CONFIG_DIR):
        directory.mkdir(mode=0o755)
        directory.chmod(0o755)
    for user, directory in user_directories:
        directory.mkdir(mode=0o700)
        directory.chmod(0o700)
        account = pwd.getpwnam(user)
        os.chown(directory, account.pw_uid, account.pw_gid)
    write_new(APP_DIR / "server.mjs", source, 0o644)
    write_new(UNIT_DIR / UNITS[0], backend_unit(plan), 0o644)
    units = (UNITS[0],)
    if not plan.backend_only:
        write_new(CONFIG_DIR / "Caddyfile", caddy_config(plan), 0o644)
        write_new(UNIT_DIR / UNITS[1], https_unit(plan), 0o644)
        run([plan.runuser, "--user", "chess-ranking-https", "--", plan.caddy, "validate", "--config", str(CONFIG_DIR / "Caddyfile"), "--adapter", "caddyfile"])
        units = UNITS
    run([plan.systemctl, "daemon-reload"])
    run([plan.systemctl, "enable", "--now", *units], timeout=30)


def leaderboard_healthy(url, timeout):
    def fetch():
        with urllib.request.urlopen(url, timeout=timeout) as response:
            raw = response.read(1024 * 1024 + 1)
            return response.status == 200 and response.geturl() == url and len(raw) <= 1024 * 1024 and isinstance(json.loads(raw).get("players"), list)
    try:
        return bounded_network(fetch, timeout)
    except (OSError, urllib.error.URLError, ValueError, AttributeError):
        return False


def probe(plan):
    deadline = time.monotonic() + 55
    local_deadline = time.monotonic() + 10
    while not leaderboard_healthy("http://127.0.0.1:8787/leaderboard", min(2, max(0.1, local_deadline - time.monotonic()))):
        if time.monotonic() >= local_deadline:
            return "installed_backend_unhealthy", 1
        time.sleep(min(1, max(0, local_deadline - time.monotonic())))
    if plan.backend_only:
        return "backend_installed", 0
    while time.monotonic() < deadline:
        if leaderboard_healthy(f"https://{plan.hostname}/leaderboard", min(4, max(0.1, deadline - time.monotonic()))):
            return "installed", 0
        time.sleep(min(2, max(0, deadline - time.monotonic())))
    return "installed_tls_pending", 2


def main(argv=None):
    mutated = False
    try:
        args = arguments(argv)
        plan = preflight(args)
        if args.preflight_only:
            print(json.dumps({"status": "ready" if plan.caddy or plan.backend_only else "ready_except_caddy", "hostname": plan.hostname,
                              "api_base": f"https://{plan.hostname}" + (":10000" if plan.backend_only else ""), "node": plan.node, "caddy": plan.caddy or None,
                              "mutations_started": False, "firewall_changed": False}, sort_keys=True))
            return 0
        source = download_source(args)
        # Recheck after the network operation, before creating any users or files.
        if preflight(args) != plan:
            raise InstallError("preflight_changed", "Host configuration changed during download; nothing was changed.")
        mutated = True
        install(plan, source)
        status, exit_code = probe(plan)
        result = {"status": status, "hostname": plan.hostname, "api_base": f"https://{plan.hostname}" + (":10000" if plan.backend_only else ""),
                  "frontend_origin": ORIGIN, "source_commit": args.source_commit, "source_sha256": args.source_sha256,
                  "rollback_commands": rollback_commands(plan.backend_only), "rollback_keeps": [str(DATA_DIR), str(TLS_DIR)],
                  "firewall_changed": False}
        if plan.backend_only:
            result["public_https_verified"] = False
            result["next_step"] = "Publish only Funnel HTTPS port 10000 to http://127.0.0.1:8787; leave existing Serve routes intact. Verify public HTTPS before setting frontend RANKING_API."
        elif status != "installed":
            result["next_step"] = "Inspect journalctl -u chess-ranking -u chess-ranking-https. Check public DNS and inbound TCP 80/443; no firewall rules were changed. Recheck HTTPS /leaderboard after ACME issuance."
    except InstallError as error:
        result = {"status": error.code, "message": str(error), **error.details, "mutations_started": mutated}
        if mutated:
            result["rollback_commands"] = rollback_commands(plan.backend_only)
            result["rollback_keeps"] = [str(DATA_DIR), str(TLS_DIR)]
        exit_code = 1
    except (OSError, KeyError) as error:
        result = {"status": "installation_failed", "message": str(error), "mutations_started": mutated}
        if mutated:
            result["rollback_commands"] = rollback_commands(plan.backend_only)
            result["rollback_keeps"] = [str(DATA_DIR), str(TLS_DIR)]
        exit_code = 1
    print(json.dumps(result, sort_keys=True))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
