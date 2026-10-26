# Shared chess ranking API

Small, single-process Node.js service using only the standard library. Use a maintained Node.js release, version 22 or newer. Nothing in this folder deploys to a VPS automatically.

This is an informal children's ranking: the browser reports the score. Authentication protects a player's identity and retries cannot double-count a round, but a modified browser can invent new rounds or scores up to 650. It is **not cheatproof**. A trusted game engine would be required for competitive verification. Use nicknames rather than children's full names. Everyone who can access the API can read nicknames and scores.

## Run locally

```bash
install -d -m 700 /tmp/mate-ranking-dev
DATA_FILE=/tmp/mate-ranking-dev/ranking.json \
ALLOWED_ORIGIN=http://localhost:8000 \
node backend/server.mjs
```

Serve the frontend from the exact allowed origin and configure its API base to `http://127.0.0.1:8787`. Browser loopback rules may require serving both from localhost. For production use HTTPS for both the game and API.

Configuration:

| Variable | Meaning |
| --- | --- |
| `DATA_FILE` | Required absolute JSON path **outside the repository and any web root**, e.g. `/var/lib/mate-ranking/ranking.json`. Parent directory must have mode 0700; files have mode 0600. |
| `ALLOWED_ORIGIN` | Required single exact HTTPS game origin, e.g. `https://game.example.com`; no trailing slash. Localhost HTTP is allowed for development. |
| `HOST` | Defaults to `127.0.0.1`. Keep this behind a reverse proxy. |
| `PORT` | Defaults to `8787`. |
| `TRUST_PROXY_LOOPBACK` | Default off. Set `1` only with the supplied local nginx proxy, which overwrites `X-Real-IP`. Requires `HOST=127.0.0.1`. Never uses `X-Forwarded-For`. |

The repo-path guard cannot identify a separate web root; keeping state outside **all** served directories is the operator's responsibility. No token, PIN, request body or database content is logged by the application.

## API

POST bodies use `Content-Type: application/json`; maximum 4096 bytes, no compression. Protected requests send `Authorization: Bearer <token>`. The token is returned only at registration/login; keep it private. Every public player object contains exactly `{id,name,stars}`. Responses use `Cache-Control: no-store`.

| Method and route | Request | Success |
| --- | --- | --- |
| `POST /players` | `{name,pin}` | 201 `{player,token}` |
| `POST /sessions` | `{name,pin}` | 200 `{player,token}` |
| `GET /leaderboard` | None | 200 `{players:[...]}` ordered by stars descending, name, then ID |
| `GET /me` | Bearer token | 200 `{player}` |
| `POST /results` | Bearer token; `{roundId,score}` | 200 `{player,duplicate}` |

PIN is a **string of exactly six ASCII digits**, including leading zeroes. Names are NFKC normalized, trimmed, repeated whitespace collapsed and compared case-insensitively using Unicode uppercase then lowercase. They must be 2–24 Unicode characters after normalization; controls, invisible formatting characters and angle brackets are refused. A name belongs to the first registration that commits. Registering another spelling/case does not create another identity.

`roundId` must contain 8–80 ASCII letters, digits, `_` or `-`; `crypto.randomUUID()` is suitable. Generate one at the start of a round and reuse it for every retry. `score` must be an integer from 0 through 650. A duplicate round with the same score returns `duplicate:true`; a different score returns 409. Retries return the **current total**, so later rounds do not disappear from the displayed total. A result with score zero also consumes its round ID.

Errors are `{error:{code,message}}`:

| Status | Codes |
| --- | --- |
| 400 | `invalid_input`, `invalid_json` |
| 401 | `unauthorized` (wrong credentials, missing/invalid/expired bearer) |
| 403 | `origin_forbidden` |
| 404 | `not_found` |
| 409 | `name_taken`, `player_limit`, `result_limit`, `result_conflict`, `storage_limit` |
| 413 | `body_too_large` |
| 415 | `unsupported_media_type` |
| 429 | `rate_limited` with conservative `Retry-After: 900` |
| 500 | `internal_error` |
| 503 | `busy`, `storage_unavailable` |

An absent Origin header is allowed for command-line clients; any supplied Origin must equal the configured origin. CORS is a browser policy, not authentication. OPTIONS responds with only GET/POST/OPTIONS and Authorization/Content-Type allowed. Reverse-proxy errors such as nginx's 413/429 can be HTML; clients must tolerate non-JSON error bodies.

## Bounds and storage

PINs use unique random 16-byte salts and scrypt (`N=16384,r=8,p=1`, 64-byte hash), checked with `timingSafeEqual`. Six digits are suitable only for this low-stakes use: protect database backups, use HTTPS and keep rate limits enabled. Tokens contain 32 random bytes, are stored only as SHA-256 hashes and expire after 30 days. At most eight active tokens remain per player; signing in again can revoke the oldest token. There is no PIN-reset or account-deletion endpoint in this initial service; an organiser must handle those requests privately.

The database supports at most 1000 players, **10000 durable round records per player**, and a total JSON size of 64 MiB. It stops accepting new rounds when a bound is reached. Records are never automatically evicted, because deleting old IDs would permit old submissions to count again. Do not clear a ledger while keeping that identity active: move to a separately named season/database with new identities, or migrate to a database retaining all deduplication records. At the 64 MiB global cap even login/session writes may fail until the operator migrates the store.

All mutations are serialized in one process; registration uniqueness and result idempotency are checked inside that queue. Every commit writes and fsyncs a 0600 temporary file, atomically renames it, and fsyncs the directory. `ranking.json.bak` keeps the previous committed snapshot. A filesystem error makes further writes fail closed until restart. The server acknowledges a mutation only after its commit completes; if a connection fails, retry the same round ID.

An exclusive `ranking.json.lock` prevents two instances using the same resolved path. It is intentionally **not auto-stolen after a crash**. Do not point instances at hard-linked copies or run this design on network filesystems. After SIGKILL/power loss, stop the systemd unit, verify no service process remains (check the PID recorded in the lock and process command), then remove only the stale lock and start the service. Graceful SIGTERM/SIGINT releases it after requests finish. Never run multiple workers or `pm2 -i` against this store.

Malformed, oversized, permissively readable or inconsistent state stops startup. A missing primary with an existing backup also stops startup. Backups are not automatically restored: an older snapshot can lose a previously acknowledged round and its replay protection. Before an operator restore, stop the service, preserve primary/backup/lock privately, verify their contents and reconcile any lost rounds. Restore the reviewed snapshot as a 0600 file in its 0700 directory, remove the verified stale lock and restart. Keep encrypted off-machine backups; the `.bak` is only one previous state and not a disaster-recovery plan.

In-memory rate limits: five registration attempts per IP/hour; eight failed PIN attempts per normalized name **and** IP per 15 minutes; 20 failed attempts per normalized name across all IPs per 15 minutes; 60 total login attempts per IP/minute; 240 API requests per IP/minute. A successful login clears its name/IP and global name failure counters. After either cooldown is reached, login for that bucket waits until expiry, including the correct PIN. This reduces distributed PIN guessing but permits a temporary targeted account lockout; the organiser can wait 15 minutes. At most 10000 live rate buckets and 32 in-flight application requests are retained. With local proxy mode disabled, all nginx requests share its IP and limits; enable the supplied opt-in configuration for real client separation. A school sharing one public IP also shares the IP limits. Limits reset on restart; they reduce guessing and load, not determined distributed abuse across many names or repeated service restarts.

## Candidate VPS setup

These are reviewable examples, not a deployment performed by this project. Replace both example hostnames. Install a maintained Node.js version, nginx and a valid TLS certificate using your distribution's supported process. Do not use placeholder certificate paths without issuing the certificate first.

Place the reviewed application at `/opt/mate-in-one`, root-owned and read-only to the service user. Create a dedicated system user/group named `mate-ranking` with no login shell. Copy `mate-ranking.service` to `/etc/systemd/system/` and `nginx.conf.example` to an included nginx configuration location. The nginx `limit_req_zone` must be in its `http` context. Keep only ports 80/443 public; port 8787 stays on loopback. Do not expose the data directory through nginx.

After adjusting `ALLOWED_ORIGIN`, hostnames and certificates:

```bash
sudo systemd-analyze verify /etc/systemd/system/mate-ranking.service
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now mate-ranking
sudo systemctl reload nginx
```

Review `systemctl status mate-ranking` and `journalctl -u mate-ranking` if startup fails. Verify HTTPS leaderboard access from the game origin, register a throwaway nickname, submit one round twice, restart the service and confirm the score persists. Verify that HTTP redirects to HTTPS and that port 8787 cannot be reached remotely. Do not include real PINs or tokens in shell history or screenshots.

Run automated tests with `node --test tests/backend.test.mjs` or the complete repo suite with `npm test`. Proxy/systemd examples still require validation on the actual VPS; they are not exercised by Node's integration tests.

Reference documentation: [Node crypto](https://nodejs.org/api/crypto.html), [nginx proxy headers](https://nginx.org/en/docs/http/ngx_http_proxy_module.html), [nginx request limiting](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html).
