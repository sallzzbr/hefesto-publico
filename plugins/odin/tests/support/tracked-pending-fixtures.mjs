import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contract, responses, runHarness, specification } from './quality-fixtures.mjs';

const scripts = fileURLToPath(new URL('../../skills/dev-loop/scripts/', import.meta.url));
const inspector = join(scripts, 'inspecionar-git.mjs');
const pending = 'notes/local pending.md';
const selected = ['src/a.js', 'tests/a.test.js', 'docs/plans/spec.md'];
function fixture(t) {
  const parent = realpathSync(mkdtempSync(join(tmpdir(), 'odin-review-pending-')));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, "repo with ' quote"); mkdirSync(root);
  const env = { ...process.env, GIT_CONFIG_GLOBAL: join(parent, 'absent-config'), GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
  const git = (...args) => {
    const execution = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
    assert.equal(execution.error, undefined); assert.equal(execution.status, 0, execution.stderr);
    return execution.stdout.trim();
  };
  const write = (path, text = 'private local note\n') => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  const commit = () => { git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', `core.hooksPath=${join(parent, 'absent-hooks')}`, 'commit', '-qm', 'fixture'); };
  git('init', '-q');
  write(selected[0], 'export const value = 1;\n');
  write(selected[1], 'import test from "node:test";\ntest("fixture", () => {});\n');
  write(selected[2], specification(contract())); commit();
  const base = git('rev-parse', 'HEAD');
  const inspect = (paths = selected, excluded, ref = 'HEAD', extra = []) => spawnSync(process.execPath, [inspector, 'quality', JSON.stringify(paths), ref, ...(excluded === undefined ? [] : [excluded]), ...extra], { cwd: root, env, encoding: 'utf8' });
  return { parent, root, env, git, write, commit, base, inspect };
}
function json(execution) {
  assert.equal(execution.error, undefined);
  return JSON.parse(execution.stdout);
}
function successful(execution) {
  const value = json(execution);
  assert.equal(execution.status, 0, execution.stderr);
  assert.deepEqual(value.errors, []);
  return value;
}
// Só o inventário é real aqui; respostas controladas exercitam a orquestração do harness
// sem representar revisão com modelo ou execução do TDD da fixture interna.
async function harness(workspace, { excluded = pending, perfil = 'economico', withBase = false, unit = 'src/a.js', touched = ['src/a.js'], support = [] } = {}) {
  const table = responses(); const measurements = [];
  const outcome = await runHarness({ options: {
    workspaceRoot: workspace.root, scriptsDir: scripts, perfil,
    ...(excluded === null ? {} : { pendenciasPath: excluded }),
    ...(withBase ? { baseRef: workspace.base } : {}),
  }, overrides: {
    'spec:validar': () => { const value = table['spec:validar'](); value.unidades[0].arquivos = unit; return value; },
    'tdd:portao': () => ({ ...table['tdd:portao'](), apoio: support }),
    'tdd:vermelho': options => {
      const value = table['tdd:vermelho'](options);
      if (withBase) value.alteracoes = { ...value.alteracoes, comparadoCom: workspace.base, sha: workspace.base };
      return value;
    },
    'impl:': () => ({ ...table['impl:'](), arquivosTocados: touched }),
    'validar:': (options, calls, prompt) => {
      const commands = [...prompt.matchAll(/```bash\n([\s\S]*?)```/g)].map(match => match[1].trim()).filter(command => /inspecionar-git\.mjs.* quality /.test(command));
      assert.equal(commands.length, 1, 'One literal inventory command must be emitted');
      const execution = spawnSync('sh', ['-c', commands[0]], { cwd: workspace.root, env: workspace.env, encoding: 'utf8' });
      const inventory = json(execution);
      measurements.push({ command: commands[0], execution, inventory });
      return { ...table['validar:'](options), qualityInventory: inventory };
    },
  } });
  return { ...outcome, measurements };
}


export { fixture, harness, json, successful, pending, selected };
