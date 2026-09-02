// Teste COMPORTAMENTAL do harness do dev-loop — o script roda de verdade, com agentes falsos.
//
// Por que este arquivo existe: até 2026-09-02 os "invariantes em código" do `loop.mjs` (portão
// TDD, teto de iterações, P10 barrada em código, fail-closed em auditoria/lente nulas) nunca
// tinham sido vistos rodando por teste nenhum. O que havia era grep de marcador no texto do
// script e um `node --check` de sintaxe — travam DECLARAÇÃO, não efeito. A auditoria adversarial
// de 2026-09-01 apontou isso como o mesmo defeito que o cerco combate: prosa afirmando
// enforcement. Aqui o efeito é medido: cada desfecho (erro/bloqueado/escalado/verde) sai de uma
// execução real do corpo do script.
//
// Como: o corpo do script (sem o `export const meta`) é embrulhado num AsyncFunction com os
// globals que o Workflow injeta — `args`, `agent`, `parallel`, `phase`, `log` — e `agent` é um
// respondedor por `label`. O `parallel` imita o do runtime: thunk que lança vira null.
//
// O que NÃO garante: que a tool Workflow injete exatamente esses globals com essa semântica.
// Isso é contrato do runtime; aqui se testa a lógica do script sob esse contrato.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HARNESS = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'dev-loop', 'harness', 'loop.mjs');
const FONTE = readFileSync(HARNESS, 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function corpoDoScript(src) {
  const linhas = src.split('\n');
  const fimMeta = linhas.findIndex((l) => l === '}');
  assert.ok(fimMeta > 0, 'o script começa com `export const meta = {` fechado por uma linha `}`');
  return linhas.slice(fimMeta + 1).join('\n');
}

// Respostas default: um run que fecha verde na primeira iteração. Cada teste sobrescreve só o
// label que quer quebrar.
const TESTE = 'tests/a.test.js';
const DEFAULTS = {
  'spec:validar': () => ({
    ok: true, pendenciasBloqueadoras: [], validacoesDaSpec: ['npm test'],
    criterios: [{ id: 'C1', texto: 'faz X' }],
    unidades: [{ id: 'U1', titulo: 'unidade 1', arquivos: 'src/a.js', criterios: ['C1'] }],
  }),
  'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [{ criterio: 'C1', path: TESTE, motivoFalha: 'falta implementação' }] }),
  'tdd:vermelho': () => ({ exitZero: false, hashesDosTestes: { [TESTE]: 'h1' } }),
  'impl:': () => ({ status: 'concluida', resumo: 'ok', escada: [{ item: 'fn', degrau: 7, porque: 'nada reusável' }], arquivosTocados: ['src/a.js'] }),
  'consulta:': () => ({ decisao: 'use A', porque: 'mais simples' }),
  'validar:': () => ({ verde: true, falhas: [], hashesDosTestes: { [TESTE]: 'h1' } }),
  'ponytail:': () => ({ dependenciasNovas: [], duplicacoes: [], abstracoesUsoUnico: [], forasDeEscopo: [], linhasAdicionadasAcumuladas: 12 }),
  'rev:': () => ({ findings: [] }),
  'confirmar:': () => ({ real: false, porque: 'não reproduz' }),
};

function responder(label, overrides) {
  const tabela = { ...DEFAULTS, ...overrides };
  const chave = Object.keys(tabela).find((k) => label === k || (k.endsWith(':') && label.startsWith(k)));
  return chave ? tabela[chave] : null;
}

async function rodar({ args, overrides = {}, atraso = 0 }) {
  const chamadas = [];
  let ativos = 0;
  let maxAtivos = 0;
  const agent = async (prompt, opts) => {
    chamadas.push({ label: opts.label, opts });
    const fn = responder(opts.label, overrides);
    if (!fn) throw new Error(`label sem resposta no teste: ${opts.label}`);
    ativos++; maxAtivos = Math.max(maxAtivos, ativos);
    if (atraso) await new Promise((r) => setTimeout(r, atraso));
    ativos--;
    return fn(opts, chamadas);
  };
  const parallel = async (thunks) => Promise.all(thunks.map((t) => Promise.resolve().then(t).catch(() => null)));
  const fn = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', corpoDoScript(FONTE));
  const resultado = await fn(args, agent, parallel, () => {}, () => {});
  return { resultado, chamadas, maxAtivos };
}

const ARGS = { specPath: 'docs/plans/spec.md', branch: 'feat/x', perfil: 'economico', validacoes: ['npm test'], hoje: '2026-09-02' };
const label = (c) => c.label;

test('args que não são objeto JSON válido morrem baratos, antes de qualquer agente', async () => {
  const { resultado, chamadas } = await rodar({ args: '{nao é json' });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.fase, 'Args');
  assert.equal(chamadas.length, 0);
});

test('spec com formato que impede o loop bloqueia na fase Spec', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'spec:validar': () => ({ ok: false, motivo: 'critério sem teste', criterios: [], unidades: [], pendenciasBloqueadoras: [] }) } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'Spec');
  assert.match(resultado.detalhe, /critério sem teste/);
});

test('operário que não confirma o vermelho bloqueia o TDD', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [], problemas: ['teste nasceu verde'] }) } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'TDD');
});

test('vermelho auto-declarado não basta: o mecânico roda os testes e um exit 0 bloqueia o TDD', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'tdd:vermelho': () => ({ exitZero: true, hashesDosTestes: { [TESTE]: 'h1' } }) } });
  assert.ok(chamadas.some((c) => c.label === 'tdd:vermelho'), 'o harness despacha uma execução independente dos testes da SPEC');
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'TDD');
  assert.match(resultado.detalhe, /passaram/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')), 'nada implementa com o vermelho não confirmado');
});

test('teste da SPEC alterado durante a implementação é bloqueante automático, sem confirmação', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'validar:': () => ({ verde: true, falhas: [], hashesDosTestes: { [TESTE]: 'h2-mudou' } }) } });
  assert.equal(resultado.status, 'escalado');
  const findings = resultado.historico.flatMap((h) => h.findings);
  assert.ok(findings.some((f) => /alterad/i.test(f.resumo) && f.arquivo.includes(TESTE)), `esperava finding de teste alterado, veio ${JSON.stringify(findings)}`);
  assert.ok(!chamadas.some((c) => c.label.startsWith('confirmar:')), 'bloqueante automático não passa pelo confirmador');
});

test('auditoria ponytail que não retorna aborta o run em vez de virar "nada encontrado"', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'ponytail:': () => null } });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.fase, 'Auditar');
  assert.match(resultado.acao, /resumeFromRunId/);
});

test('dependência nova sem justificativa no diff (P10) não fecha verde e escala no teto', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ dependenciasNovas: [{ nome: 'left-pad', justificativaEncontrada: false, onde: 'package.json' }], duplicacoes: [], abstracoesUsoUnico: [], forasDeEscopo: [], linhasAdicionadasAcumuladas: 5 }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.historico.length, 3, 'o loop insiste até o teto de 3 iterações');
  assert.equal(resultado.ponytail.dependencias[0].decisao, 'barrada');
  assert.ok(!chamadas.some((c) => c.label.startsWith('confirmar:')), 'P10 é decidida em código, não pelo confirmador');
});

test('caminho verde: uma iteração, relatório com modelo efetivo por step e testes intactos', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.iteracoes, 1);
  assert.deepEqual(resultado.tdd.paths, [TESTE]);
  const rotulos = chamadas.map(label);
  for (const esperado of ['spec:validar', 'tdd:portao', 'tdd:vermelho', 'impl:U1', 'validar:i1', 'ponytail:i1', 'rev:corretude:i1']) {
    assert.ok(rotulos.includes(esperado), `faltou a chamada ${esperado} em ${rotulos.join(', ')}`);
  }
  assert.equal(resultado.modelos.porStep.validar.modelo, 'haiku');
  assert.equal(resultado.modelos.porStep.consulta.modelo, 'fable', 'step que não rodou reporta o modelo configurado');
});

test('consulta promovida a fable que não retorna cai pro opus, desliga a promoção e o relatório registra a execução real', async () => {
  let vezes = 0;
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'impl:': (opts) => (vezes++ === 0
      ? { status: 'bloqueada', resumo: 'decisão', escada: [], consulta: { contexto: 'c', decisaoNecessaria: 'd', opcoes: ['a', 'b'] } }
      : { status: 'concluida', resumo: 'ok', escada: [{ item: 'fn', degrau: 7, porque: 'x' }], arquivosTocados: ['src/a.js'] }),
    'consulta:': (opts) => (opts.model === 'fable' ? null : { decisao: 'use A', porque: 'p' }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.fallbacks.length, 1);
  assert.equal(resultado.fallbacks[0].de, 'fable');
  assert.match(resultado.modelos.porStep.consulta.modelo, /^opus/);
});

test('perfil balanceado despacha operários em paralelo com teto de concorrência', async () => {
  const unidades = Array.from({ length: 6 }, (_, i) => ({ id: `U${i + 1}`, titulo: `u${i + 1}`, arquivos: `src/${i}.js`, criterios: ['C1'] }));
  const { resultado, maxAtivos } = await rodar({ args: { ...ARGS, perfil: 'balanceado' }, atraso: 5, overrides: {
    'spec:validar': () => ({ ...DEFAULTS['spec:validar'](), unidades }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.ok(maxAtivos > 1, 'balanceado é paralelo de verdade');
  assert.ok(maxAtivos <= 4, `teto de concorrência: ${maxAtivos} agentes simultâneos`);
});
