import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
const ROOT = resolve(import.meta.dirname, '..');
for (const [label, reference, kind, expected] of [
  ['missing-bare', '[manual](missing.md)', 'missing', 1],
  ['missing-dot', '[manual](./references/missing.md)', 'missing', 1],
  ['symlink-file', '[manual](reference.md)', 'symlink', 1],
  ['symlink-directory', '[manual](references/manual.md)', 'directory-symlink', 1],
  ['encoded-escape', '[manual](%2e%2e/%2e%2e/%2e%2e/outside.md)', 'missing', 1],
  ['reference-style', '[manual][ref]\n\n[ref]: missing.md', 'missing', 1],
  ['parenthesized-file', '[manual](reference(copy).md)', 'valid-parens', 0],
  ['parenthesized-title', '[manual](missing.md (Guide))', 'missing', 1],
  ['nested-file', '[manual](reference(copy(v2)).md)', 'valid-nested', 0],
  ['valid-local', '[manual](reference.md#section "Title")', 'valid', 0],
  ['external-fragment', '[web](https://example.test/not-present) and [section](#section)', 'external', 0],
]) {
  test(`validator checks Markdown resources: ${label}`, async t => {
    const parent = await mkdtemp(join(tmpdir(), 'hefesto-links-'));
    t.after(() => rm(parent, { recursive: true, force: true }));
    const plugin = join(parent, 'example');
    const scaffold = spawnSync(process.execPath, [join(ROOT, 'skills/criar-plugin/scripts/scaffold-plugin.mjs'), '--path', parent, '--name', 'example', '--description', 'Local resource validation fixture.'], { encoding: 'utf8' });
    assert.equal(scaffold.status, 0, scaffold.stderr);
    const skill = join(plugin, 'skills/example'); await mkdir(skill);
    await writeFile(join(skill, 'SKILL.md'), `---\nname: example\ndescription: "Use when validating local resource references."\n---\n\n${reference}\n`);
    if (kind === 'valid-parens') await writeFile(join(skill, 'reference(copy).md'), '# Section\n');
    if (kind === 'valid-nested') await writeFile(join(skill, 'reference(copy(v2)).md'), '# Section\n');
    if (kind === 'valid') await writeFile(join(skill, 'reference.md'), '# Section\n');
    if (kind === 'symlink') { await writeFile(join(parent, 'outside.md'), '# Outside\n'); await symlink(join(parent, 'outside.md'), join(skill, 'reference.md')); }
    if (kind === 'directory-symlink') { await mkdir(join(parent, 'outside')); await writeFile(join(parent, 'outside/manual.md'), '# Outside\n'); await symlink(join(parent, 'outside'), join(skill, 'references')); }
    const result = spawnSync(process.execPath, [join(ROOT, 'skills/validar-plugin/scripts/validar.mjs'), plugin], { encoding: 'utf8' });
    assert.equal(result.status, expected, result.stdout + result.stderr);
    if (expected === 1) assert.match(result.stderr, /recurso|escapa/);
  });
}
