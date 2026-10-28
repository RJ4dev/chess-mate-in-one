import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('beginner_upgrade', Path(__file__).parents[1]/'ops/upgrade-beginner.py')
u = importlib.util.module_from_spec(spec)
spec.loader.exec_module(u)

class ExistingSQLiteUpgrade(unittest.TestCase):
    def fixture(self, root):
        code=root/'code/server.mjs';code.parent.mkdir();code.write_bytes(b'// existing reviewed code\n')
        data=root/'data/players.json';data.parent.mkdir(mode=0o700);data.write_text('{"players":[{"name":"Keep me","stars":3600}]}');data.chmod(0o600)
        db=data.parent/'learning.sqlite'
        with sqlite3.connect(db) as c:
            c.execute('CREATE TABLE achievements (exercise TEXT)');c.execute("INSERT INTO achievements VALUES ('check-rook-w')")
        db.chmod(0o600)
        unit=root/'unit';unit.write_text('\n'.join(['[Service]','User=chess-ranking','Group=chess-ranking','WorkingDirectory=/opt/chess-ranking',f'ExecStart={u.NODE} /opt/chess-ranking/server.mjs','Environment=HOST=127.0.0.1','Environment=PORT=8787','Environment=DATA_FILE=/var/lib/chess-ranking/players.json','Environment=ALLOWED_ORIGIN=https://rj4dev.github.io','Environment=TRUST_PROXY_LOOPBACK=0','UMask=0077']))
        drop=root/'drop/50-learning.conf';drop.parent.mkdir();drop.write_text(u.DROP_TEXT)
        return code,data,db,unit,drop

    def execute(self, root, fail=False, apply=True, locked=False, stop_fail=False):
        code,data,db,unit,drop=self.fixture(root)
        node=root/'runtime/node';node.parent.mkdir();node.write_text('fixture');unit.write_text(unit.read_text().replace(u.NODE,str(node)))
        old=code.read_bytes();original=[p.read_bytes() for p in [data,db,unit,drop]]
        if locked:Path(str(db)+'.lock').write_text('999999')
        source=b'// new reviewed catalogue\n';commands=[]
        def run(*args):
            commands.append(args)
            if stop_fail and args[:2]==('systemctl','stop') and sum(c[:2]==('systemctl','stop') for c in commands)==1:raise TimeoutError('stop timeout')
            return str(drop) if 'DropInPaths' in ' '.join(args) else ''
        def health(*args):
            if fail and code.read_bytes()==source:raise ValueError('new backend failed')
        patches={'NODE':str(node),'CODE':code,'DATA':data,'LEARNING':db,'UNIT':unit,'DROP':drop,'OLD_HASH':hashlib.sha256(old).hexdigest(),'BACKUP_ROOT':root/'backups'}
        import contextlib
        with contextlib.ExitStack() as stack:
            for name,value in patches.items():stack.enter_context(patch.object(u,name,value,create=True))
            stack.enter_context(patch.object(u,'run',side_effect=run))
            stack.enter_context(patch.object(u,'leaderboard',return_value=[]))
            stack.enter_context(patch.object(u,'wait_healthy',return_value=[]))
            stack.enter_context(patch.object(u,'learning_healthy',side_effect=health))
            stack.enter_context(patch.object(u.urllib.request,'urlopen',return_value=io.BytesIO(source)))
            stack.enter_context(patch.object(u.subprocess,'run'))
            stack.enter_context(patch.object(u.os,'geteuid',return_value=0))
            argv=['upgrade','--source-commit','a'*40,'--source-sha256',hashlib.sha256(source).hexdigest()]+(['--apply'] if apply else [])
            stack.enter_context(patch('sys.argv',argv))
            if fail or locked or stop_fail:
                with self.assertRaisesRegex((ValueError,TimeoutError),'new backend failed|lock remains|stop timeout'):u.main()
                self.assertEqual(code.read_bytes(),old)
            else:u.main();self.assertEqual(code.read_bytes(),source if apply else old)
        self.assertEqual([p.read_bytes() for p in [data,db,unit,drop]],original)
        self.assertFalse(any('daemon-reload' in c for c in commands))
        if stop_fail:self.assertIn(('systemctl','start',u.SERVICE),commands)
        if apply and not locked and not stop_fail:
            backups=list((root/'backups').iterdir());self.assertEqual(len(backups),1)
            self.assertEqual((backups[0]/'learning.sqlite').read_bytes(),original[1])
            self.assertEqual((backups[0]/'players.json').read_bytes(),original[0])
            self.assertEqual((backups[0]/'server.mjs').read_bytes(),old)
            self.assertEqual(backups[0].stat().st_mode & 0o777,0o700)
        if not apply:self.assertFalse(any('stop' in c for c in commands));self.assertFalse((root/'backups').exists())

    def test_refuses_quoted_combined_and_continued_environment_overrides(self):
        with tempfile.TemporaryDirectory() as d:
            *_,unit,drop=self.fixture(Path(d))
            canonical=unit.read_text();u.verify_unit(canonical)
            overrides=[
                'Environment="DATA_FILE=/var/lib/chess-other/players.json"',
                'Environment=EXTRA=1 DATA_FILE=/var/lib/chess-other/players.json',
                '  Environment="LEARNING_FILE=/var/lib/chess-other/learning.sqlite"',
                'EnvironmentFile=-/tmp/extra.env',
                'Environment=EXTRA=1 '+chr(92)+'\n DATA_FILE=/var/lib/chess-other/players.json',
                '  User=root',
                'UMask=0000',
            ]
            for override in overrides:
                with self.subTest(override=override),self.assertRaises(ValueError):u.verify_unit(canonical+'\n'+override+'\n')

    def test_updates_existing_sqlite_without_reinstalling_service(self):
        with tempfile.TemporaryDirectory() as d:self.execute(Path(d))
    def test_failed_health_restores_code_and_keeps_data(self):
        with tempfile.TemporaryDirectory() as d:self.execute(Path(d),fail=True)
    def test_preflight_never_stops_service(self):
        with tempfile.TemporaryDirectory() as d:self.execute(Path(d),apply=False)
    def test_failed_stop_attempt_still_recovers_service(self):
        with tempfile.TemporaryDirectory() as d:self.execute(Path(d),stop_fail=True)
    def test_stale_sqlite_lock_is_not_removed_or_overwritten(self):
        with tempfile.TemporaryDirectory() as d:self.execute(Path(d),locked=True)

if __name__=='__main__':unittest.main()
