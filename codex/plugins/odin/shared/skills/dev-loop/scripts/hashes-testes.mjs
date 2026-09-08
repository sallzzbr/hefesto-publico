#!/usr/bin/env node
// O Workflow não tem filesystem. O operário executa este CLI no cwd do projeto
// e transporta o JSON sem reformatar chaves; crypto calcula os hashes, não o modelo.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, posix } from 'node:path';
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
    return [canonical, createHash('sha256').update(readFileSync(real)).digest('hex')];
  });
  console.log(JSON.stringify(Object.fromEntries(entries)));
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exitCode = 1;
}
