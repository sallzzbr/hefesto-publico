// Módulos comuns dos scripts do dev-loop (odin 3.1.2): `crc32.mjs` e `copia-descartavel.mjs`.
// O CRC é conferido contra um oráculo que não usa o módulo (vetor padrão e `node:zlib` sobre os bytes
// montados aqui), e a cópia que o harness carrega (`loop.mjs` não importa módulos) é comparada com o
// módulo por comportamento. Os módulos são importados dentro de cada caso para cada um falhar sozinho
// enquanto o módulo não existe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crc32 as zlibCrc32 } from 'node:zlib';

const SCRIPTS = resolve(import.meta.dirname, '../skills/dev-loop/scripts');
const LOOP = resolve(import.meta.dirname, '../skills/dev-loop/harness/loop.mjs');
const VETORES = ['', '123456789', 'ação é útil, ç', 'Ω≈ 漢字 x', 'par 😀 fim', 'worktree\nabc'];

// Bytes como o contrato define: unidade UTF-16 abaixo de 256 vale um byte, as demais byte baixo e byte alto.
const bytesDoContrato = texto => {
  const bytes = [];
  for (let i = 0; i < texto.length; i++) {
    const u = texto.charCodeAt(i);
    if (u < 256) bytes.push(u); else bytes.push(u & 0xFF, u >>> 8);
  }
  return Buffer.from(bytes);
};
const oraculo = texto => (zlibCrc32(bytesDoContrato(texto)) >>> 0).toString(16).padStart(8, '0');

test('312-R1: crc32 do módulo bate com o vetor padrão e com zlib sobre os bytes do contrato', async () => {
  const { crc32 } = await import(resolve(SCRIPTS, 'crc32.mjs'));
  assert.equal(crc32(''), '00000000');
  assert.equal(crc32('123456789'), 'cbf43926');
  for (const v of VETORES) {
    const r = crc32(v);
    assert.match(r, /^[0-9a-f]{8}$/, JSON.stringify(v));
    assert.equal(r, oraculo(v), JSON.stringify(v));
  }
});

test('312-R2: a cópia do crc32 em loop.mjs devolve o mesmo que o módulo', async () => {
  const { crc32 } = await import(resolve(SCRIPTS, 'crc32.mjs'));
  const linhas = readFileSync(LOOP, 'utf8').split('\n');
  const inicio = linhas.indexOf('function crc32(texto) {');
  assert.ok(inicio >= 0, 'loop.mjs perdeu a função crc32');
  const fim = linhas.indexOf('}', inicio);
  const daCopia = new Function(`${linhas.slice(inicio, fim + 1).join('\n')}\nreturn crc32;`)();
  for (const v of VETORES) assert.equal(daCopia(v), crc32(v), JSON.stringify(v));
});

test('312-R3: relativoSeguro, dentro e parseOptionPairs de copia-descartavel', async () => {
  const { relativoSeguro, dentro, parseOptionPairs } = await import(resolve(SCRIPTS, 'copia-descartavel.mjs'));
  for (const p of ['src/a.js', '.odin-copia-base/x', 'a b/c.py']) assert.ok(relativoSeguro(p), p);
  for (const p of ['/abs/a.js', '../a.js', 'a/../b', '.git/config', 'x/.GIT/y', 'c:/a', 'a\\b', 'a\nb', ' a', '', 3]) assert.ok(!relativoSeguro(p), JSON.stringify(p));
  assert.ok(['src/a.js', 'b.js'].every(relativoSeguro), 'serve como callback de every');
  assert.ok(dentro('/r', '/r') && dentro('/r', '/r/a/b'));
  assert.ok(!dentro('/r', '/rx') && !dentro('/r', '/') && !dentro('/r/a', '/r/b'));
  assert.deepEqual(parseOptionPairs(['--pai', '/t', '--max', '3'], ['--pai', '--max']), { pai: '/t', max: '3' });
  assert.deepEqual(parseOptionPairs([], ['--pai']), {});
  assert.throws(() => parseOptionPairs(['--outra', 'x'], ['--pai']), /^Error: opção inválida: --outra$/);
  assert.throws(() => parseOptionPairs(['--pai'], ['--pai']), /^Error: opção inválida: --pai$/);
});
