"""Read-only installer tests: privileged installation is always mocked."""

import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import threading
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("ranking_installer", Path(__file__).resolve().parents[1] / "ops" / "install-ranking.py")
installer = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = installer
spec.loader.exec_module(installer)
VALID_ARGS = ["--source-commit", "a" * 40, "--source-sha256", "b" * 64]
PLAN = installer.Plan("chess.example.org", "/usr/bin/node", "/usr/bin/caddy", "/usr/bin/systemctl", "/usr/sbin/useradd", "/usr/sbin/nologin")


class ArgumentsTests(unittest.TestCase):
    def result(self, args):
        output = io.StringIO()
        with patch.object(installer, "install") as install, patch.object(installer, "download_source") as download, contextlib.redirect_stdout(output):
            code = installer.main(args)
        install.assert_not_called()
        download.assert_not_called()
        self.assertEqual(code, 1)
        return json.loads(output.getvalue())

    def test_missing_required_arguments_have_machine_readable_error(self):
        self.assertEqual(self.result([])["status"], "invalid_arguments")

    def test_rejects_non_pinned_commit_and_hash_before_preflight(self):
        with patch.object(installer, "preflight") as preflight:
            self.assertEqual(self.result(["--source-commit", "main", "--source-sha256", "b" * 64])["status"], "invalid_commit")
            self.assertEqual(self.result(["--source-commit", "a" * 40, "--source-sha256", "oops"])["status"], "invalid_sha256")
        preflight.assert_not_called()

    def test_rejects_hostname_injection_private_names_and_ip_literals(self):
        for hostname in ("https://chess.example.org", "chess.example.org\n:2019", "127.0.0.1", "chess.local", "chess.example.org:443", "*.example.org"):
            with self.subTest(hostname=hostname):
                self.assertEqual(self.result(VALID_ARGS + ["--hostname", hostname])["status"], "invalid_hostname")

    def test_allow_missing_caddy_requires_preflight_only(self):
        self.assertEqual(self.result(VALID_ARGS + ["--allow-missing-caddy"])["status"], "invalid_arguments")


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.args = installer.arguments(VALID_ARGS + ["--hostname", "chess.example.org"])
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(installer.sys, "platform", "linux"))
        self.uid = self.stack.enter_context(patch.object(installer.os, "geteuid", return_value=0))
        self.stack.enter_context(patch.object(Path, "is_dir", return_value=True))
        self.exists = self.stack.enter_context(patch.object(Path, "exists", return_value=True))
        self.lexists = self.stack.enter_context(patch.object(installer.os.path, "lexists", return_value=False))
        self.stack.enter_context(patch.object(installer, "secure_path", side_effect=lambda value, **kwargs: str(value)))
        self.stack.enter_context(patch.object(installer, "executable", side_effect=lambda name, code: f"/usr/bin/{name}"))
        self.stack.enter_context(patch.object(installer.pwd, "getpwnam", side_effect=KeyError))
        self.run = self.stack.enter_context(patch.object(installer, "run", side_effect=self.fake_run))
        self.ports = self.stack.enter_context(patch.object(installer, "check_ports"))
        self.install = self.stack.enter_context(patch.object(installer, "install"))
        self.download = self.stack.enter_context(patch.object(installer, "download_source"))

    @staticmethod
    def fake_run(command, **kwargs):
        if command[-1] == "--version":
            return SimpleNamespace(stdout="v22.1.0\n")
        if "show" in command:
            return SimpleNamespace(stdout="not-found\n")
        return SimpleNamespace(stdout="inactive\n")

    def failure(self, expected):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = installer.main(VALID_ARGS + ["--hostname", "chess.example.org"])
        result = json.loads(output.getvalue())
        self.assertEqual(code, 1)
        self.assertEqual(result["status"], expected)
        self.assertFalse(result["mutations_started"])
        self.install.assert_not_called()
        self.download.assert_not_called()

    def test_root_required_before_any_external_command(self):
        self.uid.return_value = 1000
        self.failure("linux_root_required")
        self.run.assert_not_called()

    def test_missing_caddy_stops_before_download_and_writes(self):
        self.exists.return_value = False
        self.failure("missing_caddy")

    def test_old_node_stops_before_download_and_writes(self):
        self.run.side_effect = lambda command, **kwargs: SimpleNamespace(stdout="v18.20.0")
        self.failure("unsupported_node")

    def test_existing_installation_stops_before_download_and_writes(self):
        self.lexists.side_effect = lambda candidate: candidate == installer.DATA_DIR
        self.failure("existing_installation")

    def test_active_existing_proxy_stops_without_taking_over(self):
        def active_caddy(command, **kwargs):
            return SimpleNamespace(stdout="active\n") if command[-1] == "caddy.service" else self.fake_run(command, **kwargs)
        self.run.side_effect = active_caddy
        self.failure("existing_web_server")

    def test_occupied_port_stops_before_download_and_writes(self):
        self.ports.side_effect = installer.InstallError("port_unavailable", "TCP port 443 is occupied", port=443)
        self.failure("port_unavailable")

    def test_clean_host_preflight_is_read_only(self):
        plan = installer.preflight(self.args)
        self.assertEqual(plan.hostname, "chess.example.org")
        self.install.assert_not_called()
        self.download.assert_not_called()
        self.assertFalse(any("enable" in command.args[0] for command in self.run.call_args_list))

    def test_preflight_only_never_downloads_or_installs(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = installer.main(VALID_ARGS + ["--hostname", "chess.example.org", "--preflight-only"])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output.getvalue())["status"], "ready")
        self.install.assert_not_called()
        self.download.assert_not_called()

    def test_missing_caddy_allowed_preflight_still_checks_ports(self):
        self.exists.return_value = False
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = installer.main(VALID_ARGS + ["--hostname", "chess.example.org", "--preflight-only", "--allow-missing-caddy"])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output.getvalue())["status"], "ready_except_caddy")
        self.ports.assert_called_once()
        self.install.assert_not_called()
        self.download.assert_not_called()

    def test_missing_caddy_allowed_still_refuses_existing_web_server(self):
        self.exists.return_value = False
        self.run.side_effect = lambda command, **kwargs: SimpleNamespace(stdout="active\n") if command[-1] == "nginx.service" else self.fake_run(command, **kwargs)
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = installer.main(VALID_ARGS + ["--hostname", "chess.example.org", "--preflight-only", "--allow-missing-caddy"])
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(output.getvalue())["status"], "existing_web_server")
        self.install.assert_not_called()
        self.download.assert_not_called()


class BackendOnlyTests(unittest.TestCase):
    setUp = PreflightTests.setUp
    fake_run = staticmethod(PreflightTests.fake_run)
    def backend_args(self):
        return VALID_ARGS + ["--hostname", "roma-vps.tailcc6aea.ts.net", "--backend-only"]

    def test_backend_only_requires_tailnet_hostname(self):
        for extra in ([], ["--hostname", "chess.example.org"]):
            with self.assertRaises(installer.InstallError):
                installer.arguments(VALID_ARGS + ["--backend-only"] + extra)

    def test_backend_only_does_not_require_caddy_public_ip_or_https_ports(self):
        self.exists.return_value = False
        with patch.object(installer, "check_backend_port") as local, patch.object(installer, "detect_hostname", side_effect=AssertionError("No public-IP lookup")):
            plan = installer.preflight(installer.arguments(self.backend_args()))
        self.assertTrue(plan.backend_only)
        self.assertEqual(plan.caddy, "")
        local.assert_called_once()
        self.ports.assert_not_called()
        self.assertFalse(any("is-active" in call.args[0] for call in self.run.call_args_list))

    def test_backend_only_still_refuses_occupied_loopback_port(self):
        output = io.StringIO()
        with patch.object(installer, "check_backend_port", side_effect=installer.InstallError("port_unavailable", "8787 occupied", port=8787)), contextlib.redirect_stdout(output):
            code = installer.main(self.backend_args())
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(output.getvalue())["status"], "port_unavailable")
        self.install.assert_not_called()
        self.download.assert_not_called()

    def test_backend_only_preflight_reports_ready_without_caddy(self):
        self.exists.return_value = False
        output = io.StringIO()
        with patch.object(installer, "check_backend_port"), contextlib.redirect_stdout(output):
            code = installer.main(self.backend_args() + ["--preflight-only"])
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output.getvalue())["status"], "ready")
        self.install.assert_not_called()

    def test_backend_only_never_claims_public_https_is_ready(self):
        from dataclasses import replace
        plan = replace(PLAN, backend_only=True, caddy="")
        with patch.object(installer, "leaderboard_healthy", return_value=True) as healthy:
            self.assertEqual(installer.probe(plan), ("backend_installed", 0))
        self.assertTrue(all(call.args[0].startswith("http://127.0.0.1:") for call in healthy.call_args_list))
        self.assertIn("TRUST_PROXY_LOOPBACK=0", installer.backend_unit(plan))

    def test_install_creates_only_backend_user_unit_and_private_data(self):
        self.stack.close()
        import tempfile, os
        from dataclasses import replace
        plan = replace(PLAN, backend_only=True, caddy="")
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with contextlib.ExitStack() as stack:
                for key, value in {"APP_DIR":root/"app", "CONFIG_DIR":root/"config", "DATA_DIR":root/"data", "TLS_DIR":root/"tls", "UNIT_DIR":root}.items():
                    stack.enter_context(patch.object(installer, key, value))
                command = stack.enter_context(patch.object(installer, "run"))
                stack.enter_context(patch.object(installer.pwd, "getpwnam", return_value=SimpleNamespace(pw_uid=os.getuid(), pw_gid=os.getgid())))
                installer.install(plan, b"server source")
            self.assertTrue((root/"chess-ranking.service").is_file())
            self.assertFalse((root/"chess-ranking-https.service").exists())
            self.assertFalse((root/"config"/"Caddyfile").exists())
            self.assertFalse((root/"tls").exists())
            self.assertEqual((root/"data").stat().st_mode & 0o777, 0o700)
            self.assertEqual((root/"app"/"server.mjs").read_bytes(), b"server source")
            commands = [call.args[0] for call in command.call_args_list]
            self.assertEqual(sum("--system" in cmd for cmd in commands), 1)
            self.assertTrue(any(cmd == [plan.systemctl,"enable","--now","chess-ranking.service"] for cmd in commands))
            self.assertFalse(any("caddy" in " ".join(cmd) for cmd in commands))

    def test_backend_rollback_does_not_disable_unowned_funnel(self):
        commands = installer.rollback_commands(True)
        self.assertTrue(any("chess-ranking.service" in cmd for cmd in commands))
        self.assertFalse(any("tailscale" in cmd for cmd in commands))

    def test_backend_only_result_has_port_and_explicit_public_pending(self):
        from dataclasses import replace
        plan = replace(PLAN, hostname="roma-vps.tailcc6aea.ts.net", caddy="", backend_only=True)
        output = io.StringIO()
        with patch.object(installer, "preflight", return_value=plan), patch.object(installer, "probe", return_value=("backend_installed",0)), contextlib.redirect_stdout(output):
            code = installer.main(self.backend_args())
        result = json.loads(output.getvalue())
        self.assertEqual(code, 0)
        self.assertEqual(result["api_base"], "https://roma-vps.tailcc6aea.ts.net:10000")
        self.assertEqual(result["status"], "backend_installed")
        self.assertFalse(result["public_https_verified"])



class SourceAndProbeTests(unittest.TestCase):
    def test_network_deadline_bounds_even_blocked_dns(self):
        release = threading.Event()
        try:
            with self.assertRaises(TimeoutError):
                installer.bounded_network(lambda: release.wait(), 0.01)
        finally:
            release.set()

    def test_mismatched_source_checksum_prevents_mutations(self):
        output = io.StringIO()
        with patch.object(installer, "preflight", return_value=PLAN), patch.object(installer.urllib.request, "urlopen", return_value=io.BytesIO(b"bad source")), patch.object(installer, "install") as install, contextlib.redirect_stdout(output):
            code = installer.main(VALID_ARGS)
        install.assert_not_called()
        self.assertEqual(code, 1)
        self.assertEqual(json.loads(output.getvalue())["status"], "source_hash_mismatch")

    def test_verified_current_backend_is_self_contained(self):
        source = (Path(__file__).resolve().parents[1] / "backend" / "server.mjs").read_bytes()
        args = installer.arguments(["--source-commit", "a" * 40, "--source-sha256", hashlib.sha256(source).hexdigest()])
        with patch.object(installer.urllib.request, "urlopen", return_value=io.BytesIO(source)) as request:
            self.assertEqual(installer.download_source(args), source)
        self.assertEqual(request.call_args.kwargs["timeout"], 20)
        self.assertIn("/" + "a" * 40 + "/backend/server.mjs", request.call_args.args[0].full_url)

    def test_optional_builtin_sqlite_does_not_allow_external_or_computed_imports(self):
        for module in ["import('other-package')", "import('https://example.com/code.js')", "import(variable)"]:
            source = ("import http from 'node:http';\n" + module).encode()
            args = installer.arguments(["--source-commit", "a" * 40, "--source-sha256", hashlib.sha256(source).hexdigest()])
            with patch.object(installer.urllib.request, "urlopen", return_value=io.BytesIO(source)):
                with self.assertRaises(installer.InstallError) as raised:
                    installer.download_source(args)
            self.assertEqual(raised.exception.code, "unsupported_source")

    def test_missing_global_ipv4_does_not_guess_nat_public_address(self):
        with patch.object(installer, "executable", return_value="/usr/sbin/ip"), patch.object(installer, "run", return_value=SimpleNamespace(stdout='[{"addr_info": [{"family":"inet","local":"10.0.0.5"}]}]')):
            with self.assertRaises(installer.InstallError) as raised:
                installer.detect_hostname()
        self.assertEqual(raised.exception.code, "public_ipv4_required")

    def test_public_ipv4_builds_concrete_free_dns_hostname(self):
        with patch.object(installer, "executable", return_value="/usr/sbin/ip"), patch.object(installer, "run", return_value=SimpleNamespace(stdout='[{"addr_info": [{"family":"inet","local":"8.8.4.4"}]}]')):
            self.assertEqual(installer.detect_hostname(), "chess.8.8.4.4.sslip.io")

    def test_tls_pending_is_not_reported_as_success(self):
        output = io.StringIO()
        with patch.object(installer, "preflight", return_value=PLAN), patch.object(installer, "download_source", return_value=b"verified"), patch.object(installer, "install"), patch.object(installer, "probe", return_value=("installed_tls_pending", 2)), contextlib.redirect_stdout(output):
            code = installer.main(VALID_ARGS)
        result = json.loads(output.getvalue())
        self.assertEqual(code, 2)
        self.assertEqual(result["status"], "installed_tls_pending")
        self.assertFalse(result["firewall_changed"])
        self.assertTrue(all("chess-ranking" in command or command == "systemctl daemon-reload" for command in result["rollback_commands"]))
        self.assertNotIn("rm -rf", " ".join(result["rollback_commands"]))

    def test_caddy_validation_uses_proxy_identity_and_units_do_not_override_home(self):
        with patch.object(Path, "mkdir"), patch.object(Path, "chmod"), patch.object(installer.os, "chown"), patch.object(installer.pwd, "getpwnam", return_value=SimpleNamespace(pw_uid=999, pw_gid=999)), patch.object(installer, "write_new"), patch.object(installer, "run") as run:
            installer.install(PLAN, b"verified source")
        validations = [call.args[0] for call in run.call_args_list if "validate" in call.args[0]]
        self.assertEqual(len(validations), 1)
        self.assertEqual(validations[0][:5], [PLAN.runuser, "--user", "chess-ranking-https", "--", PLAN.caddy])
        self.assertNotIn("Environment=HOME=", installer.https_unit(PLAN))


if __name__ == "__main__":
    unittest.main()
