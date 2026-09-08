#!/usr/bin/env node
// Preparação local do espelho: inventário do commit e varredura que reprova em erro.
// Não publica, não acessa serviços e não executa arquivos do snapshot.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

function caminhoSeguro(p) {
  return typeof p === 'string' && p.length > 0 && !p.startsWith('/') &&
    !p.includes('\\') && !p.includes('\0') && !p.split('/').some(c => c === '..' || c === '.' || c === '');
}
function politica(texto) {
  const p = JSON.parse(texto);
  if (!Array.isArray(p.arquivos) || !p.arquivos.length || !p.arquivos.every(caminhoSeguro) || new Set(p.arquivos).size !== p.arquivos.length) {
    throw new Error('inventário vazio, duplicado ou com caminho inválido');
  }
  p.gerados ??= [];
  if (!Array.isArray(p.gerados) || !p.gerados.every(caminhoSeguro) || new Set(p.gerados).size !== p.gerados.length || p.gerados.some(c => p.arquivos.includes(c))) throw new Error('inventário de arquivos gerados inválido');
  p.esperados = [...p.arquivos, ...p.gerados];
  if (!Array.isArray(p.internos) || !p.internos.every(i => caminhoSeguro(i.endsWith('/') ? i.slice(0, -1) : i))) throw new Error('caminho interno inválido');
  if (!Array.isArray(p.proibidos) || !p.proibidos.length || p.proibidos.some(r => typeof r !== 'string' || !r.length)) throw new Error('guard sem padrões');
  if (!p.excecoes || typeof p.excecoes !== 'object' || Array.isArray(p.excecoes)) throw new Error('exceções inválidas');
  p.regras = p.proibidos.map(r => ({ regex: new RegExp(r, 'i'), caminhos: [] }));
  for (const [r, caminhos] of Object.entries(p.excecoes)) {
    if (!r || !Array.isArray(caminhos) || !caminhos.every(c => p.esperados.includes(c))) throw new Error('exceção fora do inventário');
    p.regras.push({ regex: new RegExp(r, 'i'), caminhos });
  }
  return p;
}
function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { maxBuffer: 32 * 1024 * 1024 });
}
function exportar(repo, ref, stage) {
  if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error('snapshot exige SHA completo');
  if (existsSync(stage)) throw new Error('destino do stage já existe');
  const p = politica(git(repo, 'show', `${ref}:scripts/espelho-publico.json`).toString('utf8'));
  const entradas = git(repo, 'ls-tree', '-rz', ref).toString('utf8').split('\0').filter(Boolean).map(l => {
    const [meta, caminho] = l.split('\t');
    const [modo, tipo, sha] = meta.split(' ');
    return { modo, tipo, sha, caminho };
  });
  const porPath = new Map(entradas.map(e => [e.caminho, e]));
  for (const caminho of p.arquivos) {
    const e = porPath.get(caminho);
    if (!e) throw new Error(`inventário aponta para arquivo ausente: ${caminho}`);
    if (e.tipo !== 'blob' || !['100644', '100755'].includes(e.modo)) throw new Error(`arquivo não regular: ${caminho}`);
    if (p.internos.some(i => i.endsWith('/') ? caminho.startsWith(i) : caminho === i)) throw new Error(`caminho simultaneamente público e interno: ${caminho}`);
  }
  for (const { caminho } of entradas) {
    if (!p.arquivos.includes(caminho) && !p.internos.some(i => i.endsWith('/') ? caminho.startsWith(i) : caminho === i)) {
      throw new Error(`arquivo não classificado para publicação: ${caminho}`);
    }
  }
  // Ler todos os blobs antes de criar o destino: objeto ausente não deixa exportação parcial.
  const arquivos = p.arquivos.map(c => ({ ...porPath.get(c), conteudo: git(repo, 'cat-file', 'blob', porPath.get(c).sha) }));
  mkdirSync(stage, { recursive: true });
  for (const a of arquivos) {
    const destino = join(stage, a.caminho);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, a.conteudo, { flag: 'wx', mode: a.modo === '100755' ? 0o755 : 0o644 });
  }
  console.log(`${arquivos.length} arquivos exportados do commit ${ref.slice(0, 7)}.`);
}
function verificar(stage, config) {
  const p = politica(readFileSync(config, 'utf8'));
  const st = lstatSync(stage);
  if (st.isSymbolicLink() || !st.isDirectory()) throw new Error('stage deve ser diretório regular');
  const encontrados = [];
  function varrer(dir, prefixo = '') {
    for (const nome of readdirSync(dir)) {
      const rel = prefixo + nome;
      const path = join(dir, nome);
      const s = lstatSync(path);
      if (s.isSymbolicLink()) throw new Error(`arquivo não regular: ${rel}`);
      if (s.isDirectory()) { varrer(path, `${rel}/`); continue; }
      if (!s.isFile()) throw new Error(`arquivo não regular: ${rel}`);
      if (!p.esperados.includes(rel)) throw new Error(`arquivo fora do inventário: ${rel}`);
      encontrados.push(rel);
      const texto = readFileSync(path).toString('utf8');
      for (const [i, regra] of p.regras.entries()) {
        if (regra.regex.test(texto) && !regra.caminhos.includes(rel)) throw new Error(`conteúdo proibido em ${rel} (regra ${i + 1})`);
      }
    }
  }
  varrer(stage);
  const faltantes = p.esperados.filter(c => !encontrados.includes(c));
  if (faltantes.length) throw new Error(`inventário incompleto: ${faltantes.join(', ')}`);
  console.log(`Guard: ${encontrados.length} arquivos examinados, nenhum conteúdo proibido detectado.`);
}
try {
  const [modo, ...args] = process.argv.slice(2);
  if (modo === 'exportar' && args.length === 3) exportar(...args);
  else if (modo === 'verificar' && args.length === 2) verificar(...args);
  else throw new Error('uso: espelho.mjs exportar <repo> <SHA> <stage> | verificar <stage> <política.json>');
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exitCode = 1;
}
