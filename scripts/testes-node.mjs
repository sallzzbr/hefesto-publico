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
// Correção batch/links Odin 2026-11-08: 47 arquivos públicos descobertos recursivamente.
const PISO_ARQUIVOS = 47;
// Suítes da Forja e guards do repositório; arquivos complementam o piso de testes.
const PISO_ARQUIVOS_HEFESTO = 8;
// Contagem medida em 2026-11-13 (odin 3.0.1): 1158 testes públicos e 126 da publicação. Sobre 1156: +2 do harness do dev-loop (o pedido do portão TDD declara a exigência do caminho do arquivo no comando, com exemplo de unittest, e unittest por arquivo com -k chega à medição).
// Contagem medida em 2026-11-11 (decisões do dono, segunda rodada do PR 20): 1156 testes públicos e 126 da publicação. Sobre 1152: +4 do harness (segmentos por rota na mesma execução, lista de segmentos recusada quando inválida, fidelidade_mockup coagida a bloqueante e logRender com marcadores); a publicação segue com 126 (casos reescritos, não somados). Os casos novos de preflight são Python.
// Contagem medida em 2026-11-11 (segunda rodada da revisão do PR 20): 1152 testes públicos e 126 da publicação. Sobre a rodada anterior (1149 e 121): +3 do harness (args.python com espaço no caminho estruturado, execução com argv[0] único e saída do compor presa ao slug e à extensão); a publicação ganha os casos das regras novas do guard de vocabulário, dos controles de sigla, tamanho e cor hexadecimal, e do limite do mapa de migração. Os casos novos do preflight de manifesto são Python e não entram aqui.
// Contagem medida em 2026-11-11 (revisão do PR 20, hermes 2.0.0 sobre o merge da E2): 1149 testes públicos e 121 da publicação. Do merge: o harness do criativo-fluxo perde os casos do comando legado e ganha os da saída presa ao segmento (H1 a H4); analisar-produto ganha lacunas por par de eixos, eixos recusados e chave desconhecida; regua-decisao ganha origem de metodologia e piso efetivo; a publicação ganha os casos do plugin excluído fictício, dos contornos de vocabulário e do resíduo semântico.
// Contagem medida em 2026-11-11: 1137 testes públicos (+27 do harness do criativo-fluxo na revisão do PR 18: um caso por guarda nova, legado preservado, manifesto presente e entradas do caminho estruturado; a suíte privada de publicação desta branch segue com 31).
// Anterior, 2026-11-10: 1073 testes públicos (+1: versão do marketplace nos READMEs de instalação, revisão do PR 17).
// Anterior, 2026-11-08: 1072 testes públicos e 27 privados, 1099 no total (base 1036 + 36 batch/links).
// Histórico: piso EXATAMENTE na contagem anterior (801 desde a junção das decisões 17A/18C, 19A e 24 na branch, 2026-11-03: 784 mais +12 do hermes e +5 do odin. Decisão 24: 789 desde a revisão da decisão 24, 2026-11-03: +1 de contrato de documentação do odin (toda doc das duas distribuições que cita baseRef diz que é o SHA completo, varredura que pegou o README fora da lista fechada); 788 desde a decisão 24 do dono, 2026-11-03: +3 do harness do dev-loop (baseRef que não é SHA completo é erro de Args antes de qualquer agente, SHA completo de 40 ou 64 passa com maiúsculas normalizadas, sha de alteracoes diferente da baseRef é erro TDD; os casos d13 de prefixo e de ref só com hex viraram casos d24) e +1 de contrato de documentação do odin (SHA completo do merge-base nas duas distribuições). Decisão 14: Anteriores: 796 desde a revisão das decisões 17A e 18C no hermes 1.5.2, 2026-11-03: +1 do harness do criativo-fluxo (criterioOriginal forjado pelo crit não roteia, com e sem trava); 795 desde as decisões 17A e 18C do dono no hermes 1.5.2, 2026-11-03: +11 do harness do criativo-fluxo, 4 da 17A (refutação sem porque nos 17 critérios, controle com porque, schema do veredito, verdade comercial plausível na trava refutada sem porque) e 7 da 18C (promessa falsa e verdadeira nas quatro combinações de severidade e confiança, false sem porque, prompt com o contexto, confirmador nulo, sem trava, alvo fora da headline); 784 desde a junção da decisão 14 na branch, 2026-11-03: 771 das decisões 12 e 13 mais +13 do HERMES-1 sobre 750. HERMES-1: 763 desde a revisão do HERMES-1 no hermes 1.5.2, 2026-11-03: +5 do harness do criativo-fluxo (promessa da headline no slug verdade_comercial, severidade coagida com a trava, alvo headline sem diferença de caixa ou espaço, contexto e lookup do catálogo no crit e na confirmação, K e O sinalizados e L, M e N no fluxo normal); 758 desde o hermes 1.5.2, 2026-11-03: +8 do harness do criativo-fluxo (HERMES-1, decisão 14: verdade comercial na headline travada encerra bloqueado, headline_tem_ideia sinalizada, controles de voz, render e imagem, e os 17 slugs A-Q no prompt e no enum do crit); Decisões 12 e 13: 771 desde a junção das decisões 12 e 13 na branch, 2026-11-03: +6 da decisão 12 e +15 da decisão 13 sobre 750. Decisão 13: 765 desde a revisão da decisão 13, 2026-11-03: +3 do harness do dev-loop (alteracoes medida contra outra ref, baseRef só com hex lida como SHA e bytes de teste da cópia conferidos antes dos bloqueios); 762 desde a decisão 13 do dono, 2026-11-03: +12 do harness do dev-loop (finding de lente sem campo de roteamento forjado, validação verde com falha listada, sha da cópia da base conferido com a baseRef); Decisão 12: 756 desde a revisão da decisão 12, 2026-11-03: +1 caso comportamental do harness (entrega que chega do Solo com fase implementada só fecha com vermelhoNaBase) e +1 que prova a heurística de docs reprovando a exceção que segue no Solo; 754 desde a decisão do dono de 2026-11-03, no Solo a exceção passa para o Loop no perfil máximo: +4 de contratos de documentação do odin; 750 desde os achados baixos da revisão do porte, 2026-11-03: +1 da impressão com fsmonitor que perde evento; 749 desde a correção da revisão adversarial do porte do odin 2.6.0, 2026-11-03: +3 da impressão com as pendências só entre os não rastreados e +4 do harness (pendências rastreadas na impressão e na detecção, o "não" do operário na base e o prompt do portão na base); 742 desde o porte do odin 2.6.0, 2026-11-02: +24 dos scripts do dev-loop (copia-base, impressão com exclusões, inspecionar-git com base), +94 do harness e do spec-ids (Tipo da SPEC, exceção no perfil máximo, retomada na base, ambiente, semCriacao, revisão que reconta), +33 de contratos de documentação e +7 de consistência entre args, motivos e scripts do código e as docs; 584 desde as decisões do dono de 2026-11-02: +7 do titbits 0.2.1 (GDD nasce em rascunho), +4 do campo dependencies no validador da forja 4.1.0 e +8 de contratos do bragir 1.5.0 (perfil pessoal na cadeia de local_voz e guarda de negação); 565 desde o merge do master 3.24.0 na branch do iris, 2026-11-01: 553 do master, +9 contratos do iris, +2 de perfil nos harnesses do mimyr e do hermes e +1 remoção no gate de bump; 522 desde 2026-11-01: +100 do hermes 1.5.0 e do odin 2.5.0 — régua de decisão, lacunas e re-estética do analisar-produto, portão TDD classificado, impressão da worktree e contratos de documentação; 327 na distribuição pública desde 2026-10-02: +95 do hermes 1.4.0, entre eles a suíte de `analisar-produto` e os casos novos do harness do criativo-fluxo; 232 desde 2026-09-11 incluía 19 regressões do guard de mutantes; a constante foi de 352 a 368 em 2026-10-04 com os 16 casos do odin 2.4.12), não abaixo dela: diferente do mutation score, que
// tem ruído e por isso ganha folga, contagem de teste é determinística — qualquer queda é
// perda real. Um piso "com margem" reabriria o furo: com piso 25, esvaziar os dois arquivos
// do odin dava 23 reais + 2 passes de arquivo vazio = 25, e passava. Verificado.
// Ao adicionar teste, o piso continua satisfeito; ao remover de propósito, baixe aqui no
// mesmo commit e diga por quê.
const PISO_TESTES = 1158;
// Publicador e suíte são privados. O package privado solicita a flag; o scrub a
// remove do package público. Path literal ausente falha, sem skip por existência.
const PISO_TESTES_PUBLICACAO = 126;
const argumentos = process.argv.slice(2);
if (argumentos.length > 1 || (argumentos.length === 1 && argumentos[0] !== '--publicacao')) await morrer('uso: testes-node.mjs [--publicacao]');
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

// process.exit logo após escrever em pipe corta a saída (o log do CI terminava no meio do TAP, sem
// `not ok` nem resumo): sair só depois que o stream confirma o flush.
// Devolve uma promessa que nunca resolve: quem chama usa `await` e o fluxo para até o exit.
function sair(codigo) {
  process.stderr.write('', () => process.stdout.write('', () => process.exit(codigo)));
  return new Promise(() => {});
}

function morrer(msg) {
  process.stderr.write(`ERRO: ${msg}\n`);
  return sair(1);
}

const plugins = readdirSync(PLUGINS, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const arquivos = plugins.flatMap((p) => varrer(join(PLUGINS, p, 'tests'))).sort();
if (comPublicacao) arquivos.push(join(RAIZ, 'scripts/tests/publicacao.test.mjs'));
const doHefesto = arquivos.filter((a) => a.includes(`${join('plugins', 'hefesto')}`));

if (arquivos.length < pisoArquivos) {
  await morrer(
    `${arquivos.length} arquivo(s) de teste node encontrado(s), piso é ${pisoArquivos}. ` +
    'Descoberta vazia ou reduzida faria o job passar sem executar as suítes.',
  );
}
if (doHefesto.length < PISO_ARQUIVOS_HEFESTO) {
  await morrer(
    `${doHefesto.length} arquivo(s) de teste no hefesto, piso é ${PISO_ARQUIVOS_HEFESTO}. ` +
    'É a suíte comportamental que o mutation testing mede; sem ela o score vira teatro.',
  );
}

const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...arquivos], {
  cwd: RAIZ,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

process.stdout.write(r.stdout ?? '');
process.stderr.write(r.stderr ?? '');

if (r.error) await morrer(`falha ao executar node --test: ${r.error.message}`);
if (r.status !== 0) {
  const falhas = (r.stdout ?? '').split('\n').filter((l) => /^\s*not ok /.test(l));
  process.stderr.write(`\nERRO: node --test saiu com status ${r.status}${r.signal ? ` (sinal ${r.signal})` : ''}; ${falhas.length} linha(s) 'not ok':\n${falhas.join('\n')}\n`);
  await sair(r.status ?? 1);
}

// Exit 0 do `node --test` não basta: arquivo vazio "passa". O piso abaixo é o que separa
// "a suíte rodou" de "o processo terminou".
const m = /^# pass (\d+)$/m.exec(r.stdout ?? '');
if (!m) {
  await morrer(
    'não achei a linha `# pass N` na saída TAP. Sem ela não dá para afirmar que algum teste ' +
    'rodou, e verde sem contagem é o verde mentiroso que este runner existe para impedir.',
  );
}
const passaram = Number(m[1]);
if (passaram < pisoTestes) {
  await morrer(
    `${passaram} teste(s) passaram, piso é ${pisoTestes}. Arquivos de teste vazios ou ` +
    'esvaziados satisfazem qualquer contagem de arquivo e não executam asserção nenhuma.',
  );
}

console.log(`\n${arquivos.length} arquivo(s), ${passaram} teste(s) — pisos ${pisoArquivos}/${PISO_ARQUIVOS_HEFESTO}/${pisoTestes} ok.`);
