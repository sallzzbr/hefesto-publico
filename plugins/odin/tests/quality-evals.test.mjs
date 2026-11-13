import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const directory = fileURLToPath(new URL('../evals/quality/', import.meta.url));
// Corpus interface: { version: 1, cases: [{ id, category, prompt, files: [{path, content}],
// expected: [{id, status, rationale}] }] }. Optional extra metadata is allowed.
test('A6 synthetic corpus provides traceable defect and legitimate-boundary controls', () => {
  const path = resolve(directory, 'cases.json');
  assert.ok(existsSync(path), 'Synthetic quality corpus cases.json must exist');
  const corpus = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(corpus.version, 1); assert.ok(Array.isArray(corpus.cases));
  assert.equal(new Set(corpus.cases.map(c => c.id)).size, corpus.cases.length);
  const categories = { boundaries: 'Q-BOUNDARIES', comments: 'Q-COMMENTS', decomposition: 'Q-COHESION', tests: 'Q-TESTABILITY' };
  for (const [category, rule] of Object.entries(categories)) {
    const cases = corpus.cases.filter(c => c.category === category);
    for (const status of ['issue', 'satisfied']) assert.ok(cases.some(c => c.expected.some(e => e.id === rule && e.status === status)), `${category}: needs ${status} oracle`);
  }
  for (const item of corpus.cases) {
    assert.match(item.id, /^[a-z0-9-]+$/); assert.ok(item.prompt.trim().length >= 30);
    assert.ok(item.files.length > 0); assert.ok(item.expected.length > 0);
    for (const file of item.files) {
      assert.equal(typeof file.content, 'string'); assert.ok(file.content.trim());
      assert.ok(!relative(directory, resolve(directory, file.path)).startsWith('..'));
      assert.ok(!file.path.startsWith('/'));
    }
    for (const expected of item.expected) {
      assert.match(expected.id, /^(Q|TS|FE|BE)-/);
      assert.ok(['issue', 'satisfied', 'not-applicable'].includes(expected.status));
      assert.ok(expected.rationale.trim().length >= 30, `${item.id}: independent oracle explains scenario`);
    }
  }
  assert.ok(corpus.cases.some(c => c.category === 'decomposition' && c.files.some(f => f.content.split('\n').length > 400) && c.expected.some(e => e.status === 'satisfied')), 'A cohesive >400-line control prevents blind splitting');
  const readmePath = resolve(directory, 'README.md');
  assert.ok(existsSync(readmePath));
  const readme = readFileSync(readmePath, 'utf8');
  assert.match(readme, /Canary/i); assert.match(readme, /roadmap|futuro|adiad/i);
  assert.match(readme, /mem[oó]ria/i); assert.match(readme, /decision model/i);
});
