// Teste COMPORTAMENTAL do harness do criativo-fluxo — o script roda de verdade, com agentes
// falsos. Molde: plugins/odin/tests/harness-dev-loop.test.mjs. O `test_harness_contracts.py`
// trava marcadores; aqui cada fix da revisão 1.0.1 é visto rodando.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HARNESS = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'criativo-fluxo', 'harness', 'criativo.mjs');
const FONTE = readFileSync(HARNESS, 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function corpoDoScript(src) {
  const linhas = src.split('\n');
  const fimMeta = linhas.findIndex((l) => l === '}');
  assert.ok(fimMeta > 0);
  return linhas.slice(fimMeta + 1).join('\n');
}

const ROTA = { n: 1, nome: 'cena', arquetipo: 'foto', slug: 'slug1', raca: 'segmento', formato: 'feed', promptIa: 'foto realista', comandoOverlay: 'python compor.py --base {{BASE}} out.png', textoEsperado: 'Oferta', copy: 'headline', baselinePath: null, mockupPath: null, briefPath: 'brief.md', briefResumo: 'resumo' };
const ROTA_TEXTO = { ...ROTA, arquetipo: 'texto', promptIa: null, comandoOverlay: 'python compor_texto.py out.png' };
const DEFAULTS = {
  'rotas:dirigir': () => ({ ok: true, slug: 'slug1', artefatoPath: 'rotas.md', rotas: [{ n: 1, nome: 'a', arquetipo: 'foto', raca: 'segmento', comandoRough: 'cmd1' }, { n: 2, nome: 'b', arquetipo: 'texto', raca: 'segmento', comandoRough: 'cmd2' }] }),
  'rough:': (opts) => ({ ok: true, artefatos: [`${opts.label}.png`], falhas: [] }),
  'portao:validar': () => ({ ok: true, aprovada: true, renderJaExiste: false, reproduzir: false, roughExiste: true, rota: ROTA }),
  'producao:': () => ({ ok: true, candidatos: ['cand1.png', 'cand2.png'], falhas: [] }),
  'selecao:': () => ({ escolhido: 'cand2.png', ranking: [] }),
  'composicao:': () => ({ ok: true, artefatos: ['out.png'], falhas: [] }),
  'preflight:': () => ({ ok: true, artefatos: ['out.png'], falhas: [] }),
  'crit:': () => ({ findings: [] }),
  'confirmar:': () => ({ real: true, porque: 'evidência' }),
  'correcao:': () => ({ resumo: 'nada', comandoOverlay: null, promptIa: null, copyCorrigida: null }),
  'pacote:montar': () => ({ ok: true, pacotePath: 'pacotes/slug1', gravados: ['a.md'], falhas: [] }),
};

function responder(label, overrides) {
  const tabela = { ...DEFAULTS, ...overrides };
  const chave = Object.keys(tabela).find((k) => label === k || (k.endsWith(':') && label.startsWith(k)));
  return chave ? tabela[chave] : null;
}

async function rodar({ args, overrides = {} }) {
  const chamadas = [];
  const agent = async (prompt, opts) => {
    chamadas.push({ label: opts.label, opts, prompt });
    const fn = responder(opts.label, overrides);
    if (!fn) throw new Error(`label sem resposta no teste: ${opts.label}`);
    return fn(opts, chamadas);
  };
  const parallel = async (thunks) => Promise.all(thunks.map((t) => Promise.resolve().then(t).catch(() => null)));
  const fn = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', corpoDoScript(FONTE));
  const resultado = await fn(args, agent, parallel, () => {}, () => {});
  return { resultado, chamadas };
}

const ROTAS = { estagio: 'rotas', briefPath: 'brief.md', python: '.venv/bin/python', hoje: '2026-09-02' };
const PRODUZIR = { estagio: 'produzir', rotasPath: 'rotas.md', python: '.venv/bin/python', hoje: '2026-09-02' };
const labels = (chamadas, prefixo) => chamadas.filter((c) => c.label.startsWith(prefixo));

test('estagio inválido e args faltando morrem antes de qualquer agente', async () => {
  const r1 = await rodar({ args: { estagio: 'voar' } });
  assert.equal(r1.resultado.status, 'erro');
  assert.equal(r1.resultado.fase, 'Args');
  const r2 = await rodar({ args: { estagio: 'produzir', python: 'p' } });
  assert.match(r2.resultado.detalhe, /rotasPath/);
  assert.equal(r2.chamadas.length, 0);
});

test('rotas: brief recusado no briefing interrogado bloqueia com custo zero — nenhum rough', async () => {
  const { resultado, chamadas } = await rodar({ args: ROTAS, overrides: { 'rotas:dirigir': () => ({ ok: false, motivo: 'sem headline aprovada' }) } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'Rotas');
  assert.match(resultado.detalhe, /headline/);
  assert.equal(labels(chamadas, 'rough:').length, 0);
});

test('rotas: um rough por rota, no mecânico, e o run para em aguardando-rota (quem aprova é o humano)', async () => {
  const { resultado, chamadas } = await rodar({ args: ROTAS });
  assert.equal(resultado.status, 'aguardando-rota');
  assert.equal(labels(chamadas, 'rough:').length, 2);
  assert.ok(labels(chamadas, 'rough:').every((c) => c.opts.agentType === 'hermes:mecanico-de-criativo'));
  assert.ok(resultado.rotas.every((r) => r.rough));
  assert.equal(resultado.modelos.porStep.rotas.modelo, 'fable');
});

test('rotas: diretor promovido a fable que não retorna cai pro opus e desliga a promoção', async () => {
  const { resultado } = await rodar({ args: ROTAS, overrides: { 'rotas:dirigir': (opts) => (opts.model === 'fable' ? null : DEFAULTS['rotas:dirigir']()) } });
  assert.equal(resultado.status, 'aguardando-rota');
  assert.equal(resultado.fallbacks[0].de, 'fable (promoção)');
  assert.match(resultado.modelos.porStep.rotas.modelo, /^opus/);
});

test('rotas: nenhum rough gerado escala — sem rough não há escolha visual', async () => {
  const { resultado } = await rodar({ args: ROTAS, overrides: { 'rough:': () => ({ ok: false, artefatos: [], falhas: [{ comando: 'x', resumo: 'API caiu' }] }) } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.fase, 'Roughs');
});

test('produzir: portão sem rota_aprovada bloqueia e nenhuma API de imagem é gasta', async () => {
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: { 'portao:validar': () => ({ ok: true, aprovada: false, renderJaExiste: false, reproduzir: false, roughExiste: false }) } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'Portão');
  assert.equal(labels(chamadas, 'producao:').length, 0);
});

test('produzir: rota aprovada sem rough no disco bloqueia — a escolha é visual', async () => {
  const { resultado } = await rodar({ args: PRODUZIR, overrides: { 'portao:validar': () => ({ ...DEFAULTS['portao:validar'](), roughExiste: false }) } });
  assert.equal(resultado.status, 'bloqueado');
  assert.match(resultado.detalhe, /rough/);
});

test('produzir: render já existente sem reproduzir:true bloqueia; com reproduzir:true segue', async () => {
  const r1 = await rodar({ args: PRODUZIR, overrides: { 'portao:validar': () => ({ ...DEFAULTS['portao:validar'](), renderJaExiste: true }) } });
  assert.equal(r1.resultado.status, 'bloqueado');
  assert.match(r1.resultado.detalhe, /reproduzir/);
  const r2 = await rodar({ args: PRODUZIR, overrides: { 'portao:validar': () => ({ ...DEFAULTS['portao:validar'](), renderJaExiste: true, reproduzir: true }) } });
  assert.equal(r2.resultado.status, 'verde');
});

test('produzir: comando de overlay sem {{BASE}} em arquétipo IA bloqueia; portão aprovado sem rota completa é erro', async () => {
  const r1 = await rodar({ args: PRODUZIR, overrides: { 'portao:validar': () => ({ ...DEFAULTS['portao:validar'](), rota: { ...ROTA, comandoOverlay: 'python compor.py base.png out.png' } }) } });
  assert.equal(r1.resultado.status, 'bloqueado');
  assert.match(r1.resultado.detalhe, /\{\{BASE\}\}/);
  const r2 = await rodar({ args: PRODUZIR, overrides: { 'portao:validar': () => ({ ...DEFAULTS['portao:validar'](), rota: { n: 1 } }) } });
  assert.equal(r2.resultado.status, 'erro');
  assert.equal(r2.resultado.fase, 'Portão');
});

test('produzir (IA): candidatos → seleção pelo validador → a base escolhida entra no comando de composição em código', async () => {
  const { resultado, chamadas } = await rodar({ args: PRODUZIR });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.rodadasIa, 1);
  assert.equal(labels(chamadas, 'selecao:')[0].opts.agentType, 'hermes:validador-de-criativo');
  const composicao = labels(chamadas, 'composicao:')[0].prompt;
  assert.ok(composicao.includes('--base cand2.png out.png'), 'o candidato selecionado substitui {{BASE}}');
  assert.ok(!composicao.includes('{{BASE}}'));
  assert.equal(resultado.pacote, 'pacotes/slug1');
});

test('produzir (IA): seleção que aponta path fora dos candidatos é erro', async () => {
  const { resultado } = await rodar({ args: PRODUZIR, overrides: { 'selecao:': () => ({ escolhido: 'inventado.png', ranking: [] }) } });
  assert.equal(resultado.status, 'erro');
  assert.match(resultado.detalhe, /fora dos candidatos/);
});

test('produzir (texto): zero chamadas de geração de imagem, composição direta, verde', async () => {
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: { 'portao:validar': () => ({ ...DEFAULTS['portao:validar'](), rota: ROTA_TEXTO }) } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.rodadasIa, 0);
  assert.equal(labels(chamadas, 'producao:').length, 0);
  assert.equal(labels(chamadas, 'selecao:').length, 0);
});

test('produzir: pre-flight que não retorna, cego, ou que reprova sem falha nomeada — três erros fail-closed', async () => {
  const r1 = await rodar({ args: PRODUZIR, overrides: { 'preflight:': () => null } });
  assert.equal(r1.resultado.status, 'erro');
  const r2 = await rodar({ args: PRODUZIR, overrides: { 'preflight:': () => ({ ok: true, artefatos: [], falhas: [] }) } });
  assert.match(r2.resultado.detalhe, /cego/);
  const r3 = await rodar({ args: PRODUZIR, overrides: { 'preflight:': () => ({ ok: false, artefatos: ['out.png'], falhas: [] }) } });
  assert.match(r3.resultado.detalhe, /sem reportar falha nomeada/);
});

test('produzir: finding plausível passa pelo confirmador; refutado não vira retrabalho', async () => {
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    'crit:': () => ({ findings: [{ criterio: 'texto_correto', resumo: 'erro de concordância', evidencia: 'e', cenario: 'c', severidade: 'bloqueante', confianca: 'plausivel', custoCorrecao: 'overlay' }] }),
    'confirmar:': () => ({ real: false, porque: 'está correto' }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(labels(chamadas, 'confirmar:').length, 1);
  assert.equal(resultado.findingsJulgados[0].confirmado, false);
});

test('produzir: correção sem mudança executável escala com pacote gravado (reports SEMPRE)', async () => {
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    'crit:': () => ({ findings: [{ criterio: 'legibilidade_thumbnail', resumo: 'ilegível', evidencia: 'e', cenario: 'c', severidade: 'bloqueante', confianca: 'confirmado', custoCorrecao: 'overlay' }] }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.fase, 'Crit');
  assert.match(resultado.detalhe.motivo, /não produziu mudança executável/);
  assert.equal(labels(chamadas, 'pacote:').length, 1);
  assert.equal(resultado.pacote, 'pacotes/slug1');
});

test('produzir (texto): finding com custo "ia" é coergido a overlay — nunca liga geração de imagem', async () => {
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    'portao:validar': () => ({ ...DEFAULTS['portao:validar'](), rota: ROTA_TEXTO }),
    'crit:': () => (vez++ === 0 ? { findings: [{ criterio: 'naturalidade_ia', resumo: 'x', evidencia: 'e', cenario: 'c', severidade: 'bloqueante', confianca: 'confirmado', custoCorrecao: 'ia' }] } : { findings: [] }),
    'correcao:': () => ({ resumo: 'recompõe', comandoOverlay: 'python compor_texto.py --v2 out.png', promptIa: null, copyCorrigida: null }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.iteracoes, 2);
  assert.equal(labels(chamadas, 'producao:').length, 0);
  assert.match(resultado.findingsJulgados[0].criterio, /naturalidade_ia/);
});

test('produzir: pacote que não grava é erro reinvocável com o parcial no relatório', async () => {
  const { resultado } = await rodar({ args: PRODUZIR, overrides: { 'pacote:montar': () => ({ ok: false, pacotePath: '', gravados: [], falhas: [{ comando: 'w', resumo: 'disco cheio' }] }) } });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.fase, 'Pacote');
  assert.equal(resultado.parcial.desfecho, 'verde');
});
