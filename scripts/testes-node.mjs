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
const PISO_ARQUIVOS = 17;
// Suítes da Forja e guards do repositório; arquivos complementam o piso de testes.
const PISO_ARQUIVOS_HEFESTO = 6;
// Piso EXATAMENTE na contagem atual (327 na distribuição pública desde 2026-10-02: +95 do hermes 1.4.0, entre eles a suíte de `analisar-produto` e os casos novos do harness do criativo-fluxo; 232 desde 2026-09-11 incluía 19 regressões do guard de mutantes; a constante foi de 352 a 368 em 2026-10-04 com os 16 casos do odin 2.4.12), não abaixo dela: diferente do mutation score, que
// tem ruído e por isso ganha folga, contagem de teste é determinística — qualquer queda é
// perda real. Um piso "com margem" reabriria o furo: com piso 25, esvaziar os dois arquivos
// do odin dava 23 reais + 2 passes de arquivo vazio = 25, e passava. Verificado.
// Ao adicionar teste, o piso continua satisfeito; ao remover de propósito, baixe aqui no
// mesmo commit e diga por quê.
const PISO_TESTES = 368;
// Publicador e suíte são privados. O package privado solicita a flag; o scrub a
// remove do package público. Path literal ausente falha, sem skip por existência.
const PISO_TESTES_PUBLICACAO = 21;
const argumentos = process.argv.slice(2);
if (argumentos.length > 1 || (argumentos.length === 1 && argumentos[0] !== '--publicacao')) morrer('uso: testes-node.mjs [--publicacao]');
const comPublicacao = argumentos.length === 1;
const pisoArquivos = PISO_ARQUIVOS + (comPublicacao ? 1 : 0);
const pisoTestes = PISO_TESTES + (comPublicacao ? PISO_TESTES_PUBLICACAO : 0);

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
if (comPublicacao) arquivos.push(join(RAIZ, 'scripts/tests/publicacao.test.mjs'));
const doHefesto = arquivos.filter((a) => a.includes(`${join('plugins', 'hefesto')}`));

if (arquivos.length < pisoArquivos) {
  morrer(
    `${arquivos.length} arquivo(s) de teste node encontrado(s), piso é ${pisoArquivos}. ` +
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
if (passaram < pisoTestes) {
  morrer(
    `${passaram} teste(s) passaram, piso é ${pisoTestes}. Arquivos de teste vazios ou ` +
    'esvaziados satisfazem qualquer contagem de arquivo e não executam asserção nenhuma.',
  );
}

console.log(`\n${arquivos.length} arquivo(s), ${passaram} teste(s) — pisos ${pisoArquivos}/${PISO_ARQUIVOS_HEFESTO}/${pisoTestes} ok.`);
