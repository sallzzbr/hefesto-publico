#!/usr/bin/env node
// O Workflow não tem filesystem. O operário executa este CLI no cwd do projeto
// e transporta o JSON sem reformatar chaves; crypto calcula os hashes, não o modelo.
// Cada valor sai como `<sha256>-<conferência>`: quem leva o JSON ao controlador é um modelo
// copiando 64 caracteres, e sem a conferência uma troca de dois deles é indistinguível de
// "teste alterado". O controlador recalcula a conferência e recusa a transcrição errada.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, posix } from 'node:path';
// CRC-32 (IEEE) de `path\nsha`. Mesmo algoritmo, byte a byte, do `crc32` de `harness/loop.mjs`
// (o harness não importa nada): unidade UTF-16 abaixo de 256 entra como um byte, as demais
// como byte baixo e byte alto. `tests/harness-dev-loop.test.mjs` roda os dois juntos.
function crc32(texto) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < texto.length; i++) {
    const u = texto.charCodeAt(i);
    for (const b of u < 256 ? [u] : [u & 0xFF, u >>> 8]) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
  }
  return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}
try {
  const paths = JSON.parse(process.argv[2]);
  if (!Array.isArray(paths) || paths.some(p => typeof p !== 'string')) throw new Error('esperado array JSON de paths');
  const root = realpathSync(process.cwd());
  const entries = paths.map(p => {
    if (!p.trim() || p !== p.trim() || isAbsolute(p) || /[:\\]/.test(p) || p.split('/').includes('..')) throw new Error(`path de teste inválido: ${p}`);
    const canonical = posix.normalize(p);
    const real = realpathSync(resolve(root, canonical));
    const rel = relative(root, real);
    if (rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel) || !statSync(real).isFile()) throw new Error(`teste fora do projeto ou não regular: ${p}`);
    const sha = createHash('sha256').update(readFileSync(real)).digest('hex');
    return [canonical, `${sha}-${crc32(`${canonical}\n${sha}`)}`];
  });
  console.log(JSON.stringify(Object.fromEntries(entries)));
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exitCode = 1;
}
