const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const root = path.resolve(__dirname, '..');

test('PDF test exits with a failure when Chrome cannot start', { timeout: 15000 }, () => {
  const env = { ...process.env, CHROME_EXECUTABLE_PATH: path.join(root, 'tmp', 'missing-browser', 'chrome.exe') };
  // O processo filho precisa iniciar uma execução independente do test runner.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', '--test-name-pattern=real PDF', 'tests/pdf.test.cjs'], {
    cwd: root,
    env,
    encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /real PDF/);
});

test('busy default port reports only the actual listening address', { timeout: 15000 }, async () => {
  const blocker = http.createServer();
  let child;
  try {
    await new Promise((resolve, reject) => {
      blocker.once('error', error => error.code === 'EADDRINUSE' ? resolve() : reject(error));
      blocker.listen(3000, '127.0.0.1', resolve);
    });
    child = spawn(process.execPath, ['scripts/dev.cjs'], {
      cwd: root, env: { ...process.env, PORT: '' }, windowsHide: true,
    });
    let output = '';
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Servidor não iniciou: ' + output)), 10000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Servidor encerrou (${code}): ${output}`)); });
      child.stderr.on('data', data => { output += data; });
      child.stdout.on('data', data => {
        output += data;
        if (output.includes('Currículo SIDY:')) { clearTimeout(timeout); resolve(); }
      });
    });
    await delay(200);
    const addresses = [...output.matchAll(/Currículo SIDY: http:\/\/localhost:(\d+)/g)];
    assert.equal(addresses.length, 1, output);
    const port = Number(addresses[0][1]);
    assert.ok(port > 3000 && port <= 3010, output);
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    await response.text();
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    if (blocker.listening) await new Promise(resolve => blocker.close(resolve));
  }
});
