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
// Mutantes que não contam para o score. `Ignored` é o efeito de `// Stryker disable`.
const NAO_CONTABILIZAVEIS = new Set(['Ignored', 'CompileError']);

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

const arquivos = Object.entries(relatorio.files ?? {});
if (arquivos.length === 0) morrer('o relatório não tem nenhum arquivo mutado.');

let contabilizaveis = 0;
let ignorados = 0;
for (const [, dados] of arquivos) {
  for (const mutante of dados.mutants ?? []) {
    if (NAO_CONTABILIZAVEIS.has(mutante.status)) ignorados += 1;
    else contabilizaveis += 1;
  }
}

if (contabilizaveis < PISO_MUTANTES) {
  morrer(
    `${contabilizaveis} mutante(s) contabilizável(is), piso é ${PISO_MUTANTES} ` +
    `(${ignorados} ignorado(s)). Com poucos ou nenhum mutante o score perde sentido — em ` +
    'zero ele vira NaN, e `NaN < break` é falso, então o Stryker sairia 0 sem ter medido ' +
    'nada. Se a queda for legítima (o validar.mjs encolheu de verdade), ajuste o piso no ' +
    'mesmo commit que a causou, e diga por quê.',
  );
}

console.log(`mutantes contabilizáveis: ${contabilizaveis} (ignorados: ${ignorados}) — piso ${PISO_MUTANTES} ok.`);
