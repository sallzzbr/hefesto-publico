#!/usr/bin/env node
// Guard pós-mutation: confere que o Stryker realmente MUTILOU alguma coisa.
//
// Por que existe: `thresholds.break` protege contra score BAIXO, nunca contra score AUSENTE.
// Com zero mutantes contabilizáveis o score vira `NaN`, e `NaN < 28` é `false` — o Stryker
// sai 0. O guard `premutation` fechava só uma das portas (o arquivo-alvo sumir). O Codex
// achou a outra, e foi verificado rodando:
//
//     // Stryker disable all      <- uma linha no topo do validar.mjs
//     Final mutation score of NaN is greater than or equal to break threshold 28
//     npm run mutation -> exit 0
//
// O comentário é feature oficial do Stryker, o `validar.mjs` continua funcionando, o
// `premutation` passa (o arquivo existe) e o gate central do repo fica desligado sem que nada
// reprove. Um agente otimizando contra o gate acha isso antes de melhorar a suíte — que é
// exatamente o comportamento que o mutation testing existe para tornar inútil.
//
// Este script lê o relatório JSON e cobra o efeito, não o indício: mutantes contabilizáveis
// existem, e são pelo menos o piso. Explicação de contrato em AGENTS.md.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RELATORIO = resolve(RAIZ, 'reports/mutation/mutation.json');

// Baseline 2026-07-28: 1154 mutantes. Piso anti-regressão com folga para refactor honesto do
// validar.mjs; o que ele barra é a queda para perto de zero, que é como o gate morre calado.
const PISO_MUTANTES = 900;
// Mesma população válida do mutation-testing-metrics usado pelo Stryker. Uma lista
// positiva impede que erro operacional, estado novo ou resultado pendente infle o piso.
const CONTABILIZAVEIS = new Set(['Killed', 'Timeout', 'Survived', 'NoCoverage']);
const EXCLUIDOS = new Set(['Ignored', 'CompileError', 'RuntimeError']);

function morrer(msg) {
  console.error(`ERRO: ${msg}`);
  process.exit(1);
}

let relatorio;
try {
  relatorio = JSON.parse(readFileSync(RELATORIO, 'utf8'));
} catch (e) {
  morrer(
    `não consegui ler ${RELATORIO}: ${e.message}. Sem relatório não há como afirmar que o ` +
    'mutation testing mediu alguma coisa, e o exit 0 do Stryker sozinho não prova isso.',
  );
}

const objeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
if (!objeto(relatorio) || !objeto(relatorio.files)) morrer('estrutura inválida: files precisa ser um objeto.');
const arquivos = Object.entries(relatorio.files);
if (arquivos.length === 0) morrer('o relatório não tem nenhum arquivo mutado.');

let contabilizaveis = 0;
let excluidos = 0;
let detectados = 0;
for (const [, dados] of arquivos) {
  if (!objeto(dados) || !Array.isArray(dados.mutants)) morrer('estrutura inválida: cada arquivo precisa de uma lista mutants.');
  for (const mutante of dados.mutants) {
    if (CONTABILIZAVEIS.has(mutante?.status)) {
      contabilizaveis += 1;
      if (mutante.status === 'Killed' || mutante.status === 'Timeout') detectados += 1;
    } else if (EXCLUIDOS.has(mutante?.status)) {
      excluidos += 1;
    } else {
      morrer('relatório incompleto ou inválido: status de mutante ausente, desconhecido ou pendente.');
    }
  }
}

// Não repetir thresholds.break: aqui se exige medição finita e volume; score baixo
// continua sendo responsabilidade do Stryker. Sem mutantes detectados, 0% ainda é finito.
const score = contabilizaveis > 0 ? 100 * detectados / contabilizaveis : NaN;
if (!Number.isFinite(score)) morrer(`score ausente: ${contabilizaveis} mutantes válidos (${excluidos} excluídos).`);

if (contabilizaveis < PISO_MUTANTES) {
  morrer(
    `${contabilizaveis} mutante(s) contabilizável(is), piso é ${PISO_MUTANTES} ` +
    `(${excluidos} excluído(s)). Com poucos ou nenhum mutante o score perde sentido — em ` +
    'zero ele vira NaN, e `NaN < break` é falso, então o Stryker sairia 0 sem ter medido ' +
    'nada. Se a queda for legítima (o validar.mjs encolheu de verdade), ajuste o piso no ' +
    'mesmo commit que a causou, e diga por quê.',
  );
}

console.log(`mutantes contabilizáveis: ${contabilizaveis} (excluídos: ${excluidos}; score: ${score.toFixed(2)}%) — piso ${PISO_MUTANTES} ok.`);
