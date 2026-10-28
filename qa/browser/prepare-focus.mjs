import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

// Playwright deliberately keeps every page visible through a per-CDP-session
// capturer. Disabling focus in a second session cannot release the first one.
// For this disposable, pinned test dependency only, opt out at its original
// initialization site. No application file, browser visibility API or event is
// replaced. Fail closed if the dependency/version/source shape changes.
const require = createRequire(import.meta.url);
const packageFile = require.resolve('playwright-core/package.json');
assert.equal(JSON.parse(await readFile(packageFile, 'utf8')).version, '1.58.2');
const file = path.join(path.dirname(packageFile), 'lib/server/chromium/crPage.js');
const original = 'this._client.send("Emulation.setFocusEmulationEnabled", { enabled: true })';
const native = 'this._client.send("Emulation.setFocusEmulationEnabled", { enabled: false })';
const source = await readFile(file, 'utf8');
const count = needle => source.split(needle).length - 1;
if (count(original) === 1 && count(native) === 0) {
  await writeFile(file, source.replace(original, native));
} else {
  assert.equal(count(original), 0, 'Unexpected focus-emulation initialization');
  assert.equal(count(native), 1, 'Pinned Playwright source changed; inspect before testing');
}
console.log('Browser test environment: native focus/visibility; only disposable Playwright dependency adjusted');
