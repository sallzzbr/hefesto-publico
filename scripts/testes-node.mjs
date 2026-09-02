#!/usr/bin/env node
// Runner das suítes node do repo — descobre, executa e cobra piso.
//
// Por que existe, em vez de `node --test <glob>` direto no package.json: o glob do shell
// falhava aberto em duas direções que a revisão do Codex provou rodando.
//
//   1. `plugins/*/tests/*.test.mjs` NÃO desce em subdiretório. Teste quebrado em
//      `plugins/odin/tests/integracao/x.test.mjs` saía 0 — o job ficava verde sem ter visto o
//      arquivo. Aqui a descoberta é recursiva.
//   2. Piso que conta NOME DE ARQUIVO não mede nada. Esvaziar os dois `.test.mjs` do odin
//      mantinha o piso satisfeito (4 arquivos, 2 no hefesto) e o `node --test` considerava
//      cada arquivo vazio um passe: `# tests 25`, exit 0, com todos os contratos do odin
//      desligados. Por isso o piso que vale aqui é de TESTES EXECUTADOS, lido da saída TAP.
//
// A regra geral que os dois furos ensinam: gate deve medir o efeito (teste rodou e passou),
// não o indício (arquivo existe). Mesma lição do mutation score sobre coverage.
//
// Explicação de contrato em AGENTS.md > "Verificação antes de commitar".

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGINS = join(RAIZ, 'plugins');

// Pisos anti-regressão, não metas. Suba junto ao adicionar suíte.
const PISO_ARQUIVOS = 5;
// hefesto nominalmente: é a suíte comportamental que sustenta o mutation score, e o
// stryker.conf.json já a nomeia por path literal. Mesma enumeração, não uma segunda.
const PISO_ARQUIVOS_HEFESTO = 2;
// Piso EXATAMENTE na contagem atual (37 desde 2026-09-02: +10 do teste comportamental do
// harness do odin), não abaixo dela: diferente do mutation score, que
// tem ruído e por isso ganha folga, contagem de teste é determinística — qualquer queda é
// perda real. Um piso "com margem" reabriria o furo: com piso 25, esvaziar os dois arquivos
// do odin dava 23 reais + 2 passes de arquivo vazio = 25, e passava. Verificado.
// Ao adicionar teste, o piso continua satisfeito; ao remover de propósito, baixe aqui no
// mesmo commit e diga por quê.
const PISO_TESTES = 37;

function varrer(dir) {
  let achados = [];
  let entradas;
  try {
    entradas = readdirSync(dir, { withFileTypes: true });
  } catch {
    return achados;
  }
  for (const e of entradas) {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) achados = achados.concat(varrer(caminho));
    else if (e.isFile() && e.name.endsWith('.test.mjs')) achados.push(caminho);
  }
  return achados;
}

function morrer(msg) {
  console.error(`ERRO: ${msg}`);
  process.exit(1);
}

const plugins = readdirSync(PLUGINS, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const arquivos = plugins.flatMap((p) => varrer(join(PLUGINS, p, 'tests'))).sort();
const doHefesto = arquivos.filter((a) => a.includes(`${join('plugins', 'hefesto')}`));

if (arquivos.length < PISO_ARQUIVOS) {
  morrer(
    `${arquivos.length} arquivo(s) de teste node encontrado(s), piso é ${PISO_ARQUIVOS}. ` +
    'Descoberta vazia ou reduzida faria o job passar sem executar as suítes.',
  );
}
if (doHefesto.length < PISO_ARQUIVOS_HEFESTO) {
  morrer(
    `${doHefesto.length} arquivo(s) de teste no hefesto, piso é ${PISO_ARQUIVOS_HEFESTO}. ` +
    'É a suíte comportamental que o mutation testing mede; sem ela o score vira teatro.',
  );
}

const r = spawnSync(process.execPath, ['--test', ...arquivos], {
  cwd: RAIZ,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

process.stdout.write(r.stdout ?? '');
process.stderr.write(r.stderr ?? '');

if (r.error) morrer(`falha ao executar node --test: ${r.error.message}`);
if (r.status !== 0) process.exit(r.status ?? 1);

// Exit 0 do `node --test` não basta: arquivo vazio "passa". O piso abaixo é o que separa
// "a suíte rodou" de "o processo terminou".
const m = /^# pass (\d+)$/m.exec(r.stdout ?? '');
if (!m) {
  morrer(
    'não achei a linha `# pass N` na saída TAP. Sem ela não dá para afirmar que algum teste ' +
    'rodou, e verde sem contagem é o verde mentiroso que este runner existe para impedir.',
  );
}
const passaram = Number(m[1]);
if (passaram < PISO_TESTES) {
  morrer(
    `${passaram} teste(s) passaram, piso é ${PISO_TESTES}. Arquivos de teste vazios ou ` +
    'esvaziados satisfazem qualquer contagem de arquivo e não executam asserção nenhuma.',
  );
}

console.log(`\n${arquivos.length} arquivo(s), ${passaram} teste(s) — pisos ${PISO_ARQUIVOS}/${PISO_ARQUIVOS_HEFESTO}/${PISO_TESTES} ok.`);
