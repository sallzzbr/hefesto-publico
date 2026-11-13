import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import test from 'node:test';
import { fixture, harness, json, selected, successful } from './support/tracked-pending-fixtures.mjs';

function compatibility(workspace, mode = 'missing') {
  const lookup = spawnSync('which', ['git'], { env: workspace.env, encoding: 'utf8' });
  assert.equal(lookup.status, 0, lookup.stderr);
  const binary = lookup.stdout.trim();
  const bin = join(workspace.parent, 'compat-bin'); mkdirSync(bin);
  const script = join(bin, 'git');
  writeFileSync(script, `#!${process.execPath}\n` + `
const {spawnSync}=require('node:child_process');
const args=process.argv.slice(2);
const index=args.indexOf('sparse-checkout');
const mode=process.env.ODIN_COMPAT_MODE;
if(index>=0 && args[index+1]==='check-rules') {
  process.stderr.write(mode==='operational' ? 'fatal: index read failed\\n' : "error: unknown subcommand: \\x60check-rules'\\nusage: git sparse-checkout <subcommand>\\n");
  process.exit(129);
}
if(index>=0 && args[index+1]==='list' && mode==='list-error') {
  process.stderr.write('fatal: cannot read sparse patterns\\n');process.exit(1);
}
const result=spawnSync(${JSON.stringify(binary)},args,{env:process.env,input:require('node:fs').readFileSync(0)});
if(result.error) {process.stderr.write(String(result.error));process.exit(1);}
process.stdout.write(result.stdout);process.stderr.write(result.stderr);
if(index>=0 && args[index+1]==='list' && mode==='list-warning') process.stderr.write('warning: unrecognized pattern; disabling cone pattern matching\\n');
process.exit(result.status===null ? 1 : result.status);
`);
  chmodSync(script, 0o755);
  workspace.env.PATH = bin + delimiter + workspace.env.PATH;
  workspace.env.ODIN_COMPAT_MODE = mode;
}
function snapshot(workspace) {
  const index = readFileSync(join(workspace.root, '.git/index'));
  const bits = workspace.git('ls-files', '-v');
  const bytes = selected.map(path => readFileSync(join(workspace.root, path)));
  return () => {
    assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
    assert.equal(workspace.git('ls-files', '-v'), bits);
    selected.forEach((path, i) => assert.deepEqual(readFileSync(join(workspace.root, path)), bytes[i]));
  };
}
function setup(t, sparseIndex = false, dirs = ['src/included/nested', 'docs/plans', 'tests']) {
  const workspace = fixture(t);
  for (const path of ['other/outside.txt', 'root.txt', 'src/ancestor.txt', 'src/included/direct.txt', 'src/included/nested/deep.txt', 'src/included/sibling/foreign.txt']) workspace.write(path, 'original\n');
  workspace.commit();
  workspace.git('sparse-checkout', 'init', '--cone', sparseIndex ? '--sparse-index' : '--no-sparse-index');
  workspace.git('sparse-checkout', 'set', ...dirs);
  return workspace;
}
function refusal(execution) {
  const value = json(execution);
  assert.notEqual(execution.status, 0, 'unsafe or unprovable membership must refuse');
  assert.ok(value.errors.length, 'refusal must explain the failed membership proof');
}
for (const sparseIndex of [false, true]) {
  test(`compat cone ${sparseIndex ? 'sparse-index' : 'normal'} permits real harness`, async t => {
    const workspace = setup(t, sparseIndex);
    const unchanged = snapshot(workspace);
    compatibility(workspace);
    const outcome = await harness(workspace);
    assert.ok(outcome.measurements.length);
    for (const measurement of outcome.measurements) {
      const value = successful(measurement.execution);
      assert.ok(!value.files.some(file => ['other/outside.txt', 'src/included/sibling/foreign.txt'].includes(file.path)));
    }
    assert.equal(outcome.result.status, 'verde', JSON.stringify(outcome.result));
    unchanged();
  });
}
for (const path of ['root.txt', 'src/ancestor.txt', 'src/included/direct.txt', 'src/included/nested/deep.txt']) {
  test(`compat included ${path} hidden deletion refuses`, t => {
    const workspace = setup(t);
    workspace.git('update-index', '--skip-worktree', '--', path); rmSync(join(workspace.root, path));
    const unchanged = snapshot(workspace);
    compatibility(workspace);
    const execution = workspace.inspect(selected);
    const value = json(execution);
    if (execution.status !== 0) assert.ok(value.errors.length);
    else assert.ok(value.files.some(file => file.path === path && file.status === 'deleted'), 'included deletion must remain visible');
    unchanged();
  });
}
for (const mode of ['operational', 'list-error', 'list-warning']) {
  test(`compat ${mode} refuses without permissive fallback`, t => {
    const workspace = setup(t);
    const unchanged = snapshot(workspace);
    compatibility(workspace, mode);
    refusal(workspace.inspect(selected));
    unchanged();
  });
}
test('compat non-cone unavailable check-rules refuses', t => {
  const workspace = setup(t);
  workspace.git('sparse-checkout', 'set', '--no-cone', '/src/', '/docs/', '/tests/');
  const unchanged = snapshot(workspace);
  compatibility(workspace);
  refusal(workspace.inspect(selected));
  unchanged();
});
test('compat malformed cone configuration refuses', t => {
  const workspace = setup(t);
  workspace.git('config', 'core.sparseCheckoutCone', 'not-a-boolean');
  const index = readFileSync(join(workspace.root, '.git/index'));
  const config = readFileSync(join(workspace.root, '.git/config'));
  compatibility(workspace);
  refusal(workspace.inspect(selected));
  assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index);
  assert.deepEqual(readFileSync(join(workspace.root, '.git/config')), config);
});
test('compat noncanonical cone patterns refuse', t => {
  const workspace = setup(t);
  writeFileSync(join(workspace.root, '.git/info/sparse-checkout'), '/*\n!/*/\n/src/**/\n/docs/\n/tests/\n');
  const unchanged = snapshot(workspace);
  compatibility(workspace);
  refusal(workspace.inspect(selected));
  unchanged();
});
for (const full of [false, true]) {
  test(`compat ${full ? 'full-cone' : 'root-only'} never mistakes missing selected content`, t => {
    const workspace = setup(t, false, full ? ['.'] : []);
    if (full) {
      workspace.git('sparse-checkout', 'disable');
      workspace.git('config', 'core.sparseCheckout', 'true');
      workspace.git('config', 'core.sparseCheckoutCone', 'true');
      writeFileSync(join(workspace.root, '.git/info/sparse-checkout'), '/*\n');
    }
    // Explicit quality files must exist even in root-only sparse checkout.
    if (!full) {
      for (const path of selected) {
        workspace.git('update-index', '--no-skip-worktree', '--', path);
        const content = workspace.git('show', `HEAD:${path}`);
        mkdirSync(join(workspace.root, path, '..'), { recursive: true });
        writeFileSync(join(workspace.root, path), content + '\n');
      }
    }
    const path = full ? 'other/outside.txt' : 'root.txt';
    workspace.git('update-index', '--skip-worktree', '--', path); rmSync(join(workspace.root, path));
    const unchanged = snapshot(workspace);
    compatibility(workspace);
    const execution = workspace.inspect(selected);
    const value = json(execution);
    if (execution.status !== 0) assert.ok(value.errors.length);
    else assert.ok(value.files.some(file => file.path === path && file.status === 'deleted'));
    unchanged();
  });
}
test('compat literal spaces accents and component sibling permit inventory', t => {
  const workspace = fixture(t);
  for (const path of ['área com espaço/inside/a.txt', 'área com espaço/sibling/b.txt', 'Area/inside/c.txt', 'Area2/inside/d.txt']) workspace.write(path, 'original\n');
  workspace.commit();
  workspace.git('config', 'core.quotePath', 'false');
  workspace.git('config', 'core.ignoreCase', 'false');
  workspace.git('sparse-checkout', 'init', '--cone', '--no-sparse-index');
  workspace.git('sparse-checkout', 'set', 'src', 'docs', 'tests', 'área com espaço/inside', 'Area/inside');
  const unchanged = snapshot(workspace);
  compatibility(workspace);
  const value = successful(workspace.inspect(selected));
  assert.ok(!value.files.some(file => file.path === 'área com espaço/sibling/b.txt' || file.path === 'Area2/inside/d.txt'));
  unchanged();
});

test('compat ignoreCase included ancestor cannot disappear', t => {
  const workspace = setup(t);
  workspace.git('config', 'core.ignoreCase', 'true');
  const rules = join(workspace.root, '.git/info/sparse-checkout');
  writeFileSync(rules, readFileSync(rules, 'utf8').replaceAll('/src/', '/SRC/'));
  workspace.git('update-index', '--skip-worktree', '--', 'src/ancestor.txt');
  rmSync(join(workspace.root, 'src/ancestor.txt'));
  const unchanged = snapshot(workspace);
  compatibility(workspace);
  const execution = workspace.inspect(selected);
  const value = json(execution);
  if (execution.status !== 0) assert.ok(value.errors.length);
  else assert.ok(value.files.some(file => file.path === 'src/ancestor.txt' && file.status === 'deleted'));
  unchanged();
});
test('compat C-quoted selected directory cannot hide included deletion', t => {
  const workspace = fixture(t);
  const path = 'área "citada"/inside/a.txt';
  workspace.write(path, 'original\n'); workspace.write('other/outside.txt'); workspace.commit();
  workspace.git('config', 'core.quotePath', 'true');
  workspace.git('sparse-checkout', 'init', '--cone', '--no-sparse-index');
  workspace.git('sparse-checkout', 'set', 'src', 'docs', 'tests', 'área "citada"/inside');
  assert.match(workspace.git('sparse-checkout', 'list'), /\\[0-7]{3}/, 'fixture must exercise C-quoted output');
  workspace.git('update-index', '--skip-worktree', '--', path); rmSync(join(workspace.root, path));
  const unchanged = snapshot(workspace);
  compatibility(workspace);
  const execution = workspace.inspect(selected);
  const value = json(execution);
  if (execution.status !== 0) assert.ok(value.errors.length);
  else assert.ok(value.files.some(file => file.path === path && file.status === 'deleted'));
  unchanged();
});
