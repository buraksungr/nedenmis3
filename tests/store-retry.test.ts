import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { atomic } from '../server/store';

function directory(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-atomic-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const diskError = (code: string) => Object.assign(new Error(`simulated ${code}`), { code });

test('atomic replacement retries Windows EPERM and EBUSY before preserving the complete new file', (t) => {
  const dir = directory(t),
    file = path.join(dir, 'project.json');
  fs.writeFileSync(file, 'old');
  const rename = fs.renameSync.bind(fs),
    attempts: string[] = [];
  t.mock.method(fs, 'renameSync', (from: fs.PathLike, to: fs.PathLike) => {
    attempts.push(String(from));
    assert.equal(String(to), file);
    if (attempts.length <= 2) throw diskError(attempts.length === 1 ? 'EPERM' : 'EBUSY');
    return rename(from, to);
  });
  atomic(file, JSON.stringify({ revision: 42, text: 'Göz' }));
  assert.equal(attempts.length, 3);
  assert.equal(new Set(attempts).size, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { revision: 42, text: 'Göz' });
  assert.deepEqual(fs.readdirSync(dir), ['project.json']);
});

test('exhausted EACCES renames fall back to copying and clean up the temporary file', (t) => {
  const dir = directory(t),
    file = path.join(dir, 'project.json');
  fs.writeFileSync(file, 'old');
  let attempts = 0,
    copies = 0;
  const copy = fs.copyFileSync.bind(fs);
  t.mock.method(fs, 'renameSync', () => {
    attempts++;
    throw diskError('EACCES');
  });
  t.mock.method(fs, 'copyFileSync', (from: fs.PathLike, to: fs.PathLike, flags?: number) => {
    copies++;
    assert.equal(String(to), file);
    return copy(from, to, flags);
  });
  t.mock.method(console, 'warn', () => {});
  atomic(file, Buffer.from('replacement'));
  assert.equal(attempts, 6);
  assert.equal(copies, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), 'replacement');
  assert.deepEqual(fs.readdirSync(dir), ['project.json']);
});

test('non-sharing errors and failed fallback propagate while temporary files are cleaned', (t) => {
  const dir = directory(t),
    file = path.join(dir, 'project.json');
  fs.writeFileSync(file, 'old');
  let attempts = 0,
    copies = 0;
  const rename = t.mock.method(fs, 'renameSync', () => {
    attempts++;
    throw diskError('ENOSPC');
  });
  t.mock.method(fs, 'copyFileSync', () => {
    copies++;
    throw diskError('ENOSPC');
  });
  assert.throws(() => atomic(file, 'new'), /ENOSPC/);
  assert.equal(attempts, 1);
  assert.equal(copies, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), 'old');
  assert.deepEqual(fs.readdirSync(dir), ['project.json']);
  rename.mock.mockImplementation(() => {
    attempts++;
    throw diskError('EPERM');
  });
  assert.throws(() => atomic(file, 'new'), /ENOSPC/);
  assert.equal(attempts, 7);
  assert.equal(copies, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), 'old');
  assert.deepEqual(fs.readdirSync(dir), ['project.json']);
});
