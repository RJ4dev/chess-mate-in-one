import hashlib
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('upgrade', Path(__file__).parents[1] / 'ops/upgrade-learning.py')
upgrade = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upgrade)

class UpgradeChecks(unittest.TestCase):
    def test_refuses_wrong_download_before_mutation(self):
        source = b'// reviewed backend\n'
        self.assertEqual(upgrade.verify_digest(source, hashlib.sha256(source).hexdigest()), source)
        with self.assertRaises(ValueError):
            upgrade.verify_digest(source + b'bad', hashlib.sha256(source).hexdigest())

    def test_refuses_different_service_or_injected_environment(self):
        unit = '''[Service]
User=chess-ranking
Group=chess-ranking
WorkingDirectory=/opt/chess-ranking
ExecStart=/opt/roma-autonomy/node-runtime/bin/node /opt/chess-ranking/server.mjs
Environment=HOST=127.0.0.1
Environment=PORT=8787
Environment=DATA_FILE=/var/lib/chess-ranking/players.json
Environment=ALLOWED_ORIGIN=https://rj4dev.github.io
Environment=TRUST_PROXY_LOOPBACK=0
UMask=0077
'''
        upgrade.verify_unit(unit)
        for bad in [unit.replace('User=chess-ranking', 'User=root'), unit.replace('PORT=8787', 'PORT=3000'), unit + '\nEnvironmentFile=/etc/another-service\n']:
            with self.assertRaises(ValueError):
                upgrade.verify_unit(bad)

if __name__ == '__main__': unittest.main()
