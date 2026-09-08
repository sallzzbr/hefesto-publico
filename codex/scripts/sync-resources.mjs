#!/usr/bin/env node
// Materializa recursos de distribuição; nunca roda durante instalação de plugin.
import { readFileSync, writeFileSync, readdirSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const codex = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(codex, '..');
const dentro = (base, path) => { const r = relative(base, path); return r !== '..' && !r.startsWith('../') && !isAbsolute(r); };
function caminho(base, p) {
  if (typeof p !== 'string' || !p || p.startsWith('/') || p.includes('\\') || p.split('/').some(x => !x || x === '..' || x === '.')) throw new Error(`caminho inválido: ${p}`);
  const dest = resolve(base, p);
  // Validar cada ancestral já existente: um symlink não pode redirecionar a escrita.
  for (let d = dest; d !== base; d = dirname(d)) {
    try { if (lstatSync(d).isSymbolicLink()) throw new Error(`symlink não permitido: ${p}`); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return dest;
}
export function sincronizar({ escrever = false } = {}) {
  const entradas = JSON.parse(readFileSync(resolve(codex, 'resources.json'), 'utf8')).arquivos;
  if (!Array.isArray(entradas) || !entradas.length) throw new Error('inventário de recursos vazio');
  const vistos = new Set();
  const plano = entradas.map(e => {
    if (vistos.has(e.target)) throw new Error(`destino duplicado: ${e.target}`);
    vistos.add(e.target);
    const source = caminho(repo, e.source), target = caminho(codex, e.target);
    if (!lstatSync(source).isFile() || !dentro(repo, realpathSync(source))) throw new Error(`fonte não regular: ${e.source}`);
    return { ...e, targetPath: target, bytes: readFileSync(source) };
  });
  const erros = [];
  for (const e of plano) {
    if (escrever) { mkdirSync(dirname(e.targetPath), { recursive: true }); writeFileSync(e.targetPath, e.bytes); }
    else {
      try { if (!readFileSync(e.targetPath).equals(e.bytes)) erros.push(`recurso divergente: ${e.target}`); }
      catch (err) { if (err.code === 'ENOENT') erros.push(`recurso ausente: ${e.target}`); else throw err; }
    }
  }
  // Nenhum recurso extra pode esconder uma cópia obsoleta removida da lista.
  function varrer(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) varrer(p);
      else if (!vistos.has(relative(codex, p))) erros.push(`recurso não inventariado: ${relative(codex, p)}`);
    }
  }
  for (const plugin of readdirSync(resolve(codex, 'plugins'))) {
    for (const sub of ['shared', 'runtime']) {
      const d = resolve(codex, 'plugins', plugin, sub);
      try { if (lstatSync(d).isDirectory()) varrer(d); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
  }
  if (erros.length) throw new Error(erros.join('\n'));
  return plano.length;
}
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!['--write', '--check'].includes(process.argv[2])) throw new Error('uso: sync-resources.mjs --write | --check');
    console.log(`${sincronizar({ escrever: process.argv[2] === '--write' })} recursos sincronizados/verificados.`);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
