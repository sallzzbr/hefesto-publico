#!/usr/bin/env node
// Runner das suítes da distribuição Codex — descobre recursivamente e cobra piso de testes
// executados, no mesmo molde de ../../scripts/testes-node.mjs.
//
// Por que existe: o script `test` listava `tests/*.test.mjs plugins/hefesto/tests/*.test.mjs`.
// Esvaziar bridge.test.mjs ou criar `plugins/<outro>/tests/x.test.mjs` com teste quebrado deixava
// o job verde (achado INFRA-2 da revisão de 2026-11-01, reproduzido: 34 de 48 testes, exit 0).
// Medir o efeito: conta testes que passaram, lida do `# pass N` do TAP; não conta arquivos.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CODEX = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Contrato de qualidade Odin 2026-11-07: 156 casos medidos em 14 arquivos. Reporter TAP explícito entre versões Node.
// Histórico: piso EXATAMENTE na contagem anterior (123 testes em 11 arquivos desde a junção das decisões 17A/18C, 19A e 24 na branch, 2026-11-03: 122 mais +1 do odin. Decisão 24: 103 testes em 10 arquivos desde a decisão 24 do dono, 2026-11-03: +1 replay do erro de Args da baseRef que não é SHA completo, antes de qualquer pedido de trabalho. Decisão 14: Anteriores: 122 testes em 11 arquivos desde a junção das decisões 17A/18C e 19A na branch, 2026-11-03: 102 mais +3 do hermes e +17 do RUNTIME (incluindo o arquivo novo). Decisão 19A: 119 testes em 11 arquivos desde a revisão da decisão 19A, 2026-11-03: +8 de runtime-pergunta.test.mjs sobre 111, 1 por pacote listado no marketplace Codex, exigindo que a regra de pergunta restrinja o fim do turno à pergunta direta e diga que pela ferramenta de interação a resposta volta no mesmo turno; 111 testes em 11 arquivos desde a decisão 19A do dono, 2026-11-03: +9 de runtime-pergunta.test.mjs sobre 102, 1 que amarra a cobrança à lista do marketplace Codex e 1 por pacote listado, hoje 8, exigindo a regra de pergunta no RUNTIME.md; Decisões 17A e 18C: 105 testes em 10 arquivos desde as decisões 17A e 18C do dono no hermes Codex 0.3.2, 2026-11-03: +2 replays em controllers.test.mjs (confirmação de promessa pelo bridge, recusa de veredito e de confirmação de promessa sem porque) e +1 contrato dos resumos nativos e da execução do criativo-fluxo e do validar-criativo; 102 testes em 10 arquivos desde a junção da decisão 14 na branch, 2026-11-03: 99 das decisões 12 e 13 mais +3 do HERMES-1 sobre 94. HERMES-1: 97 testes em 10 arquivos desde a revisão do HERMES-1 no hermes Codex 0.3.2, 2026-11-03: +2 dos resumos nativos do criativo-fluxo e do validar-criativo (render da headline travada no fluxo normal, K e O sinalizados, promessa da headline em verdade_comercial); 95 testes em 10 arquivos desde o hermes Codex 0.3.2, 2026-11-03: +1 replay da headline travada com verdade_comercial confirmada, que o bridge recusava como fora do enum; Decisões 12 e 13: 99 testes em 10 arquivos desde a revisão da decisão 12, 2026-11-03: +1 que prova a heurística de docs do odin-portao-tdd reprovando a exceção que segue no Solo; 98 testes em 10 arquivos desde a decisão do dono de 2026-11-03: +4 de contratos de documentação do odin-portao-tdd (no Solo, a exceção passa para o Loop no perfil máximo); 94 testes em 10 arquivos desde o porte do odin 2.6.0 / Codex odin 0.3.0, 2026-11-02: +5 replays do odin-portao-tdd (perfil máximo da exceção, schema novo do preflight e da execução, vermelho na base, campos novos pelo bridge, parada por ambiente); 2026-11-02, decisões do dono: 89 testes em 10 arquivos, +4 da confirmação antes de gravar na agenda do bragir Codex e +6 do perfil de voz pessoal no bragir Codex; 79 em 8 arquivos desde o merge do master 3.24.0). Ao acrescentar teste o piso continua
// satisfeito; ao remover de propósito, baixe aqui no mesmo commit e diga por quê.
const PISO_TESTES = 161; // contagem do pacote público (hermes 2.0.0; +4 da revisão do PR 20: skills nativas no contrato 2.0 e referência do pacote)
// Casos que só existem onde há pacote excluído da distribuição (um por pacote, iterando o marketplace). O
// script de teste local passa `--privado`; o publicador tira a opção do package.json
// do stage, que mede só o piso público. Medido por efeito (o `# pass` do TAP), nunca pela existência de arquivo ou de diretório.
const PISO_TESTES_PRIVADO = 2;
const PISO_ARQUIVOS = 14;

const morrer = msg => { console.error(`ERRO: ${msg}`); process.exit(1); };
const argumentos = process.argv.slice(2);
if (argumentos.length > 1 || (argumentos.length === 1 && argumentos[0] !== '--privado')) morrer('uso: testes.mjs [--privado]');
const comPrivado = argumentos.length === 1;
const pisoTestes = PISO_TESTES + (comPrivado ? PISO_TESTES_PRIVADO : 0);
function varrer(dir) {
  let entradas;
  try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entradas.flatMap(e => {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) return varrer(caminho);
    return e.isFile() && e.name.endsWith('.test.mjs') ? [caminho] : [];
  });
}
const plugins = readdirSync(join(CODEX, 'plugins'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
const arquivos = [...varrer(join(CODEX, 'tests')), ...plugins.flatMap(p => varrer(join(CODEX, 'plugins', p, 'tests')))].sort();
if (arquivos.length < PISO_ARQUIVOS) morrer(`${arquivos.length} arquivo(s) de teste Codex, piso é ${PISO_ARQUIVOS}: descoberta reduzida faria o job passar sem as suítes.`);

const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...arquivos], { cwd: CODEX, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
process.stdout.write(r.stdout ?? '');
process.stderr.write(r.stderr ?? '');
if (r.error) morrer(`falha ao executar node --test: ${r.error.message}`);
if (r.status !== 0) process.exit(r.status ?? 1);
const m = /^# pass (\d+)$/m.exec(r.stdout ?? '');
if (!m) morrer('saída TAP sem `# pass N`: sem contagem não dá para afirmar que algum teste rodou.');
if (Number(m[1]) < pisoTestes) morrer(`${m[1]} teste(s) passaram, piso é ${pisoTestes}. Arquivo esvaziado satisfaz contagem de arquivo e não executa asserção.`);
console.log(`\n${arquivos.length} arquivo(s), ${m[1]} teste(s) Codex — pisos ${PISO_ARQUIVOS}/${pisoTestes} ok.`);
