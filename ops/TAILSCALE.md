# Ranking behind NAT with Tailscale

Use `install-ranking.py --source-commit <40hex> --source-sha256 <64hex> --backend-only --hostname <this-node.ts.net>` as root. Add `--preflight-only` for a read-only host check. Node >=20 is required on a root-owned protected path. Pin and verify the installer download separately, too.

This mode creates only chess-ranking.service, its non-login system user, code/config directories, and private JSON state in /var/lib/chess-ranking (0700). Backend listens on 127.0.0.1:8787. It does not install Caddy, detect a public IPv4, bind public ports, configure a firewall, or modify Tailscale. Existing ranking files/users/services cause a refusal rather than an overwrite. Rerunning after a partial installation requires inspecting the reported state first.

The successful status `backend_installed` means local backend health only; `public_https_verified` is false. Do not configure the game API until external HTTPS works.

Inspect `sudo tailscale serve status --json` before publication. If port10000 is already present in TCP, Web, AllowFunnel, or foreground configuration, do not overwrite it. Preserve the existing configuration. Only if10000 is unused, publish the new backend:

```sh
sudo tailscale funnel --bg --https=10000 --set-path=/ http://127.0.0.1:8787
```

Funnel may require owner approval via a Tailscale link. Do not enable Funnel for the existing private Council/wiki ports. Confirm the new configuration contains only the intended additional port10000 and that existing routes are unchanged. The intended API base is `https://<this-node.ts.net>:10000`; verify `/leaderboard` from outside the tailnet with valid TLS. Publication and persistence survive restart with --bg. Tailscale requirements, permission and bandwidth restrictions apply.

References: https://tailscale.com/docs/reference/tailscale-cli/funnel and https://tailscale.com/docs/features/tailscale-funnel.

Tailscale proxy mode does not provide a verified X-Real-IP contract for this backend. TRUST_PROXY_LOOPBACK=0 deliberately ignores forwarded headers. All Funnel clients share the proxy IP rate bucket; this limits simultaneous registration/login and is suitable for a small family game. Per-name PIN cooldown still applies. Scores remain client reported; this is an informal ranking.

Rollback of the backend is printed by the installer and retains player data. Separately remove ONLY the route you actually created, after checking its current ownership:

```sh
sudo tailscale funnel --https=10000 --set-path=/ off
```

Do not use `tailscale serve reset` or `tailscale funnel reset`: they would affect other routes.
