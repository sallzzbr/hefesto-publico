import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../../../', import.meta.url));
export const baseIds = ['Q-NAMES', 'Q-COMMENTS', 'Q-BOUNDARIES', 'Q-TESTABILITY', 'Q-COHESION', 'Q-ERRORS', 'Q-PROJECT'];
export const specialtyIds = { typescript: ['TS-TYPES', 'TS-IMPORTS', 'TS-ASYNC'], frontend: ['FE-STATE', 'FE-EFFECTS', 'FE-ACCESSIBILITY'], backend: ['BE-BOUNDARIES', 'BE-CONSISTENCY', 'BE-MIGRATIONS'] };
export function contract(profiles = ['base']) {
  return {
    version: 1, profiles,
    conventions: [{ source: 'AGENTS.md', decision: 'Use existing project boundaries and independent behavior tests.' }],
    checks: [...baseIds, ...profiles.flatMap(p => specialtyIds[p] || [])].map(id => ({ id, applicability: 'required', reason: 'Changed input boundary needs independent inspection.', paths: ['src/a.js'], verification: id === 'Q-TESTABILITY' ? 'command' : 'review', command: id === 'Q-TESTABILITY' ? 'node --test tests/a.test.js' : '' })),
    decomposition: [],
  };
}
export const specification = quality => '# SPEC\n## Critérios de aceite\n| # | Critério | Tipo | Teste |\n|---|---|---|---|\n| C1 | validates input | reprodução | tests/a.test.js |\n' + (quality === undefined ? '' : '\n## Contrato de qualidade\n```json\n' + JSON.stringify(quality) + '\n```\n');
export const inventory = (quality = contract()) => {
  const spec = specification(quality);
  return { files: [
    { path: 'src/a.js', lines: 12, bytes: 240, status: 'text' },
    { path: 'docs/plans/spec.md', lines: spec.split('\n').length - (spec.endsWith('\n') ? 1 : 0), bytes: Buffer.byteLength(spec), status: 'text' },
    { path: 'tests/a.test.js', lines: 2, bytes: 64, status: 'text' },
  ], uninspected: [], errors: [] };
};
export const executions = quality => quality.checks.filter(c => c.applicability === 'required' && c.verification === 'command').map(c => ({ id: c.id, command: c.command, paths: [...c.paths], exitCode: 0, output: 'tests/a.test.js: input boundary rejects malformed data; 3 cases passed.' }));
export const review = quality => quality.checks.map(c => ({ id: c.id, status: c.applicability === 'required' ? 'satisfied' : 'not-applicable', evidence: [{ path: c.applicability === 'required' ? 'src/a.js' : 'docs/plans/spec.md', line: 1, observation: c.applicability === 'required' ? 'Inspected input rejection and explicit error handling at the public boundary.' : c.reason }], finding: {} }));
export function legacyDefaults() {
  const source = readFileSync(new URL('../harness-dev-loop.test.mjs', import.meta.url), 'utf8');
  return new Function(source.slice(source.indexOf('const TESTE'), source.indexOf('function responder(label, overrides)')) + '\nreturn DEFAULTS;')();
}
export function responses(quality = contract()) {
  const defaults = legacyDefaults();
  return {
    ...defaults,
    'spec:ids': () => ({ ...defaults['spec:ids'](), quality: structuredClone(quality) }),
    'validar:': opts => ({ ...defaults['validar:'](opts), qualityExecutions: executions(quality), qualityInventory: inventory(quality) }),
    'ponytail:': opts => ({ ...defaults['ponytail:'](opts), qualityReview: review(quality) }),
  };
}
// Hash de apoio no formato `<sha256>-<conferência>`, com a conferência (CRC-32 de `path\nsha`)
// calculada pelo zlib do Node, fora do harness. O sha é uma letra repetida: serve de fixture, não
// de hash de arquivo real (os casos com scripts reais usam a saída do script).
export function hashDeApoio(path, letra = 'e') {
  const sha = letra.repeat(64);
  return `${sha}-${crc32(`${path}\n${sha}`).toString(16).padStart(8, '0')}`;
}
// Paths do comando de hashes que o harness emite no pedido (`hashes-testes.mjs '<json>'`); o modo
// `--impressao` não casa. null = o pedido não traz o comando.
export function pathsDoComandoDeHashes(prompt) {
  const achado = typeof prompt === 'string' ? /hashes-testes\.mjs' '(\[[^\n']*\])'/.exec(prompt) : null;
  return achado ? JSON.parse(achado[1]) : null;
}
// O harness 3.0.3 pede também o hash do apoio do portão. Os casos que declaram apoio mas não tratam
// de hash respondem só com os testes: este complemento acrescenta o apoio que o comando pediu e o
// mapa não trouxe. Com a lista de paths antiga (só testes) não acrescenta nada.
export function completarHashesDeApoio(prompt, resposta, apoio) {
  const mapa = resposta?.hashesDosTestes;
  const pedidos = pathsDoComandoDeHashes(prompt);
  if (!mapa || typeof mapa !== 'object' || Array.isArray(mapa) || !pedidos) return;
  const faltando = pedidos.filter(path => apoio.has(path) && !Object.hasOwn(mapa, path));
  if (faltando.length) resposta.hashesDosTestes = { ...mapa, ...Object.fromEntries(faltando.map(path => [path, hashDeApoio(path)])) };
}
export const args = { workspaceRoot: '/workspace', scriptsDir: '/plugin/scripts', specPath: 'docs/plans/spec.md', branch: 'feat/quality', perfil: 'economico', validacoes: ['npm test'], hoje: '2026-11-07' };
export async function runHarness({ quality = contract(), overrides = {}, options = {} } = {}) {
  const source = readFileSync(new URL('../../skills/dev-loop/harness/loop.mjs', import.meta.url), 'utf8');
  const lines = source.split('\n');
  const body = lines.slice(lines.findIndex(line => line === '}') + 1).join('\n');
  const calls = [];
  const apoio = new Set();
  const table = { ...responses(quality), ...overrides };
  const agent = async (prompt, opts) => {
    calls.push({ ...opts, prompt });
    const key = Object.keys(table).find(k => opts.label === k || (k.endsWith(':') && opts.label.startsWith(k)));
    assert.ok(key, `No response for ${opts.label}`);
    const response = table[key](opts, calls, prompt);
    if (opts.label === 'tdd:portao') for (const path of response?.apoio || []) apoio.add(path);
    completarHashesDeApoio(prompt, response, apoio);
    return response;
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const result = await new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', body)({ ...args, ...options }, agent, thunks => Promise.all(thunks.map(fn => Promise.resolve().then(fn).catch(() => null))), () => {}, () => {});
  return { result, calls };
}
export function assertQualityReport(result, quality) {
  assert.equal(result.status, 'verde', JSON.stringify(result));
  assert.ok(result.quality, 'Report must retain the quality evidence');
  const serialized = JSON.stringify(result.quality);
  for (const id of quality.checks.map(c => c.id)) assert.ok(serialized.includes(id), `Report missing ${id}`);
  assert.ok(serialized.includes('src/a.js'));
  assert.ok(serialized.includes('exitCode'));
  assert.ok(serialized.includes('observation'));
}
