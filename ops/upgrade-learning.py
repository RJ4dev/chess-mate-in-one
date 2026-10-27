#!/usr/bin/env python3
"""Owner-run upgrade of the existing Funnel backend. Never changes Tailscale.

Default is preflight only. Requires the known original service and backend,
backs up code/account JSON while stopped, then adds one owned systemd drop-in.
Account data is never rewritten by this updater. SQLite is created by the
existing unprivileged service. Failed health checks restore code and drop-in.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import tempfile
import time
import urllib.request

SERVICE = 'chess-ranking.service'
NODE = '/opt/roma-autonomy/node-runtime/bin/node'
CODE = Path('/opt/chess-ranking/server.mjs')
DATA = Path('/var/lib/chess-ranking/players.json')
UNIT = Path('/etc/systemd/system/chess-ranking.service')
DROP = Path('/etc/systemd/system/chess-ranking.service.d/50-learning.conf')
DROP_TEXT = '[Service]\nEnvironment=LEARNING_FILE=/var/lib/chess-ranking/learning.sqlite\n'
OLD_HASH = '2af42af390e485d0188f7fefa845c9ac97d304b1a3a43e83a62f4af667d9a876'
LOCAL = urllib.request.build_opener(urllib.request.ProxyHandler({}))

def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=45).stdout.strip()

def verify_digest(source, digest):
    if not re.fullmatch('[0-9a-f]{64}', digest) or len(source) > 131072 or hashlib.sha256(source).hexdigest() != digest:
        raise ValueError('Backend digest/size mismatch; no service changes.')
    return source

def verify_unit(text):
    lines = set(text.splitlines())
    required = {'User=chess-ranking', 'Group=chess-ranking', 'WorkingDirectory=/opt/chess-ranking',
                f'ExecStart={NODE} /opt/chess-ranking/server.mjs', 'Environment=HOST=127.0.0.1',
                'Environment=PORT=8787', 'Environment=DATA_FILE=/var/lib/chess-ranking/players.json',
                'Environment=ALLOWED_ORIGIN=https://rj4dev.github.io', 'Environment=TRUST_PROXY_LOOPBACK=0', 'UMask=0077'}
    if not required <= lines:
        raise ValueError('Existing service differs from the reviewed Funnel installation.')
    singleton = ('User=', 'Group=', 'WorkingDirectory=', 'ExecStart=', 'EnvironmentFile=', 'Environment=HOST=', 'Environment=PORT=', 'Environment=DATA_FILE=', 'Environment=ALLOWED_ORIGIN=', 'Environment=TRUST_PROXY_LOOPBACK=')
    if any(line.startswith(singleton) and line not in required for line in lines):
        raise ValueError('Unexpected service override; inspect it before upgrade.')

def private_file(file, owner=None):
    info = file.lstat()
    if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode) or (owner is not None and info.st_uid != owner):
        raise ValueError(f'Unsafe file: {file}')
    return info

def atomic_code(content):
    handle, temporary = tempfile.mkstemp(prefix='.learning-', dir=CODE.parent)
    try:
        os.fchmod(handle, 0o644)
        with os.fdopen(handle, 'wb') as output:
            output.write(content); output.flush(); os.fsync(output.fileno())
        os.replace(temporary, CODE)
        directory = os.open(CODE.parent, os.O_DIRECTORY)
        try: os.fsync(directory)
        finally: os.close(directory)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)

def leaderboard():
    with LOCAL.open('http://127.0.0.1:8787/leaderboard', timeout=5) as response:
        return json.load(response)['players']

def wait_healthy():
    for _ in range(12):
        try: return leaderboard()
        except (OSError, ValueError, KeyError): time.sleep(0.5)
    raise ValueError('Backend did not become healthy.')

def learning_healthy():
    with LOCAL.open('http://127.0.0.1:8787/capabilities', timeout=5) as response:
        if json.load(response).get('learning') != {'enabled':True,'contentVersion':1}:
            raise ValueError('SQLite learning capability is not enabled.')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-commit', required=True)
    parser.add_argument('--source-sha256', required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if os.geteuid() != 0 or not re.fullmatch('[0-9a-f]{40}', args.source_commit):
        raise ValueError('Run as root with a pinned full commit.')
    # No host mutation precedes all download, identity and runtime checks.
    private_file(UNIT, 0)
    verify_unit(UNIT.read_text())
    if private_file(CODE, 0).st_mode & 0o022: raise ValueError('Backend is writable by another user.')
    if private_file(DATA).st_mode & 0o077: raise ValueError('Account JSON must be private.')
    if DATA.parent.stat().st_mode & 0o077: raise ValueError('Data directory must be private.')
    old = CODE.read_bytes(); current = hashlib.sha256(old).hexdigest()
    if current not in (OLD_HASH, args.source_sha256): raise ValueError('Unexpected backend version; refusing to overwrite.')
    dropins = run('systemctl', 'show', SERVICE, '--property=DropInPaths', '--value')
    if dropins not in ('', str(DROP)): raise ValueError('Unreviewed service drop-ins are present.')
    if DROP.exists():
        private_file(DROP, 0)
        if DROP.read_text() != DROP_TEXT: raise ValueError('Learning drop-in conflict.')
    if current == args.source_sha256 and DROP.exists():
        run('systemctl', 'is-active', '--quiet', SERVICE); leaderboard(); learning_healthy()
        print(json.dumps({'status': 'already_updated', 'public_https_verified': False})); return
    if DROP.exists(): raise ValueError('Partial update: inspect the existing learning drop-in.')
    for parent in (CODE.parent, DROP.parent.parent, Path(NODE).parent):
        if parent.is_symlink() or parent.stat().st_uid != 0 or parent.stat().st_mode & 0o022: raise ValueError('Unsafe root-owned installation directory.')
    if DROP.parent.exists() and (DROP.parent.is_symlink() or DROP.parent.stat().st_uid != 0 or DROP.parent.stat().st_mode & 0o022): raise ValueError('Unsafe drop-in directory.')
    run(NODE, '--input-type=module', '-e', "import {DatabaseSync} from 'node:sqlite';const d=new DatabaseSync(':memory:');d.close();")
    url = f'https://raw.githubusercontent.com/RJ4dev/chess-mate-in-one/{args.source_commit}/backend/server.mjs'
    with urllib.request.urlopen(url, timeout=20) as response: source = verify_digest(response.read(131073), args.source_sha256)
    # Syntax check from stdin executes no downloaded code.
    subprocess.run([NODE, '--check', '--input-type=module'], input=source, check=True, capture_output=True, timeout=15)
    run('systemctl', 'is-active', '--quiet', SERVICE); leaderboard()
    if not args.apply:
        print(json.dumps({'status':'ready', 'mutations_started':False, 'storage':'SQLite learning + existing JSON ranking'})); return
    backup = Path('/var/backups/chess-ranking') / time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
    backup.mkdir(mode=0o700, parents=True, exist_ok=False)
    backup.parent.chmod(0o700)
    stopped = False
    try:
        run('systemctl', 'stop', SERVICE); stopped = True
        if Path(str(DATA)+'.lock').exists(): raise ValueError('Ranking lock remains after stop; refusing to delete it.')
        shutil.copy2(DATA, backup/'players.json'); (backup/'players.json').chmod(0o600)
        (backup/'server.mjs').write_bytes(old); (backup/'server.mjs').chmod(0o600)
        (backup/'service.unit').write_bytes(UNIT.read_bytes()); (backup/'service.unit').chmod(0o600)
        atomic_code(source)
        DROP.parent.mkdir(mode=0o755, exist_ok=True)
        # Exclusive creation prevents overwriting an operator-created override.
        with DROP.open('x') as output: output.write(DROP_TEXT)
        DROP.chmod(0o644)
        run('systemctl', 'daemon-reload'); run('systemctl', 'start', SERVICE)
        wait_healthy()
        learning_healthy()
        private_file(DATA.parent/'learning.sqlite')
    except BaseException:
        if stopped:
            run('systemctl', 'stop', SERVICE)
            atomic_code(old)
            if DROP.exists() and DROP.read_text() == DROP_TEXT: DROP.unlink()
            run('systemctl', 'daemon-reload'); run('systemctl', 'start', SERVICE)
            wait_healthy()
        raise
    print(json.dumps({'status':'learning_backend_updated','storage':'SQLite','account_json_migrated':False,'backup':str(backup),'public_https_verified':False,'frontend_sync':'capability-gated'}))

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'status':'stopped','message':str(error),'public_https_verified':False})); raise SystemExit(1)
