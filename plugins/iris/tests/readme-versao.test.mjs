// O README raiz cita a versão da Iris; ela precisa acompanhar o plugin.json (achado da revisão do PR 15).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

test('README raiz cita a versão da Iris igual à do plugin.json', () => {
  const { version } = JSON.parse(readFileSync(join(RAIZ, 'plugins/iris/.claude-plugin/plugin.json'), 'utf8'));
  const readme = readFileSync(join(RAIZ, 'README.md'), 'utf8');
  const citadas = [...readme.matchAll(/\bIris\s+(\d+\.\d+\.\d+)/g)].map(m => m[1]);
  assert.ok(citadas.length > 0, 'README sem versão da Iris');
  for (const v of citadas) assert.equal(v, version, `README cita Iris ${v}, plugin.json está em ${version}`);
});

// Os dois READMEs de instalação citam a versão do marketplace no snapshot e na tag do clone.
// A v3.24.0 ficou no README Codex por três releases sem nenhum gate reprovar (revisão do PR 17).
test('READMEs de instalação citam a versão do marketplace no snapshot e na tag do clone', () => {
  const { metadata } = JSON.parse(readFileSync(join(RAIZ, '.claude-plugin/marketplace.json'), 'utf8'));
  for (const arquivo of ['README.md', 'codex/README.md']) {
    const texto = readFileSync(join(RAIZ, arquivo), 'utf8');
    const tags = [...texto.matchAll(/git clone --branch v(\d+\.\d+\.\d+)/g)].map(m => m[1]);
    const snapshots = [...texto.matchAll(/^> Snapshot (\d+\.\d+\.\d+):/gm)].map(m => m[1]);
    assert.ok(tags.length > 0, `${arquivo} sem git clone por tag`);
    assert.ok(snapshots.length > 0, `${arquivo} sem linha de snapshot`);
    for (const v of [...tags, ...snapshots]) assert.equal(v, metadata.version, `${arquivo} cita ${v}, marketplace está em ${metadata.version}`);
  }
});
