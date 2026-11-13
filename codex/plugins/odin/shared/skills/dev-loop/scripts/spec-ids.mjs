#!/usr/bin/env node
// Lê a tabela canônica original, antes de o modelo extrair/interpretar a SPEC.
import { readFileSync } from 'node:fs';
import { parseQualityContract } from './quality-contract.mjs';

const ids = [], erros = [];
const includeQuality = process.argv.includes('--quality');
let quality;
const verificacoesComplementares = {};
// Tipo do critério decidido pela SPEC aprovada, nunca pelo agente que escreve os testes:
// reprodução (default) falha antes e passa depois; preservação começa verde e continua verde.
// Só a coluna Tipo conta: sufixo "(R)"/"(P)" ou legenda no texto do critério não é lido.
const tipos = {};
const TIPOS = { reproducao: 'reproducao', preservacao: 'preservacao' };
try {
  const texto = readFileSync(process.argv[2], 'utf8');
  if (includeQuality) {
    if (process.argv.length !== 4 || process.argv[3] !== '--quality') throw new Error('uso: spec-ids.mjs <spec> --quality');
    quality = parseQualityContract(texto);
  }
  let ativa = false, cerca = false, secoes = 0, tabela = null;
  const tabelas = [];
  const celulas = linha => linha.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim());
  const identidade = celula => celula.replace(/^[`*]+|[`*]+$/g, '').trim();
  for (const linha of texto.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(linha)) { cerca = !cerca; tabela = null; continue; }
    if (cerca) continue;
    const heading = /^(#{1,6})\s+(.+)/.exec(linha);
    if (heading) {
      const titulo = heading[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      ativa = /^criterios de aceite\b/.test(titulo);
      if (ativa) secoes++;
      tabela = null;
      continue;
    }
    if (!ativa || !/^\s*\|/.test(linha)) { tabela = null; continue; }
    if (!tabela) { tabela = []; tabelas.push(tabela); }
    tabela.push(celulas(linha));
  }
  if (secoes !== 1 || tabelas.length !== 1) erros.push('SPEC exige uma seção e uma tabela inequívocas de Critérios de aceite');
  for (const linhas of tabelas) {
    if (!['#', 'id'].includes(identidade(linhas[0][0]).toLowerCase()) ||
        !linhas[1]?.every(c => /^:?-{3,}:?$/.test(c))) {
      erros.push('tabela exige cabeçalho # ou ID e linha separadora Markdown');
      continue;
    }
    // Só as duas primeiras linhas são estrutura. Um critério chamado ID é um ID real.
    const semAcento = c => identidade(c).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const ehColunaManual = c => semAcento(c) === 'verificacao complementar';
    const ehColunaTipo = c => semAcento(c) === 'tipo';
    if (linhas[0].filter(ehColunaManual).length > 1) erros.push('coluna Verificação complementar duplicada');
    if (linhas[0].filter(ehColunaTipo).length > 1) erros.push('coluna Tipo duplicada');
    const colunaManual = linhas[0].findIndex(ehColunaManual);
    const colunaTipo = linhas[0].findIndex(ehColunaTipo);
    for (const linha of linhas.slice(2)) {
      const id = identidade(linha[0]);
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) erros.push(`ID vazio ou inválido na tabela: ${id || '(vazio)'}`);
      else ids.push(id);
      const manual = colunaManual < 0 ? '' : linha[colunaManual];
      if (manual === undefined) erros.push(`coluna Verificação complementar ausente na linha ${id}`);
      else if (manual.trim()) verificacoesComplementares[id] = manual.trim();
      const tipo = colunaTipo < 0 ? '' : linha[colunaTipo];
      if (tipo === undefined) erros.push(`coluna Tipo ausente na linha ${id}`);
      else if (!tipo.trim()) tipos[id] = TIPOS.reproducao;
      else if (Object.hasOwn(TIPOS, semAcento(tipo))) tipos[id] = TIPOS[semAcento(tipo)];
      else erros.push(`Tipo inválido na linha ${id}: ${tipo.trim()} (use reprodução ou preservação)`);
    }
  }
  if (!ids.length) erros.push('tabela de critérios vazia ou ausente');
  for (const id of new Set(ids)) if (ids.filter(x => x === id).length > 1) erros.push(`ID repetido: ${id}`);
} catch (e) { erros.push(e.message); }
console.log(JSON.stringify({ ok: erros.length === 0, ids, erros, verificacoesComplementares, tipos, ...(includeQuality && quality ? { quality } : {}) }));
if (erros.length) process.exitCode = 1;
