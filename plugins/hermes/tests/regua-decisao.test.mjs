// Teste COMPORTAMENTAL do script da skill regua-decisao (hermes 1.5.0, critérios A1, A2 e A3).
// O script roda de verdade como processo; entradas SINTÉTICAS (o plugin é espelhado em repo
// público): nenhum nome de pessoa, marca ou produto; segmento genérico; réguas sintéticas, que não
// são as de nenhuma conta (iteração 2: as réguas reais saíram daqui, precedente do hermes 1.3.2).
//
// Contrato de CLI fixado por estes testes (Apêndice 1 da SPEC; a skill o documenta):
//   node regua-decisao.mjs --entrada <entrada.json>
//   - stdout: JSON { decisao, gatilho, motivo, rotulo, metricas {gasto, conversoes, cpa, roas},
//     pisos_atingidos {diagnostico, opiniao_fadiga, veredito_pausa}, piso_veredito_pausa_efetivo,
//     reguas (eco), config (efetiva), entidade }; exit 0
//   - entrada inválida: exit 1, mensagem em stderr com o campo, stdout vazio
// Ordem (a primeira que casa decide): aprendizado-edicao, aprendizado-eventos, janela-minima,
//   janela-mista, piso-diagnostico, desempenho ruim (com degrau em avaliação: degrau-recente | piso-reversao |
//   reverter-degrau; sem degrau ou degrau consolidado: pausa | piso-pausa), sinais-divergentes
//   (nos dois sentidos), bom para escala (escala-sem-sinal | intervalo-degrau | escala),
//   dentro-da-regua. Dinheiro é comparado em centavos e ROAS em centésimos (iteração 2).

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'regua-decisao');
const SCRIPT = join(SKILL_DIR, 'scripts', 'regua-decisao.mjs');

// Réguas no formato do lookup do unit-economics: a fonte é citada, o número nunca é decorado.
const REGUAS = Object.freeze({
  fonte: 'financeiro/relatorios/unit-economics-2026-10.md',
  cac_breakeven: 100,
  cac_alvo: 80,
  roas_breakeven: 2,
});

const DECISOES = new Set(['pausar', 'manter', 'escalar', 'reverter-degrau']);
// gatilho do Apêndice 1 -> decisão que ele produz
const GATILHOS = new Map([
  ['aprendizado-edicao', 'manter'],
  ['aprendizado-eventos', 'manter'],
  ['janela-minima', 'manter'],
  ['janela-mista', 'manter'],
  ['piso-diagnostico', 'manter'],
  ['degrau-recente', 'manter'],
  ['piso-reversao', 'manter'],
  ['reverter-degrau', 'reverter-degrau'],
  ['pausa', 'pausar'],
  ['piso-pausa', 'manter'],
  ['sinais-divergentes', 'manter'],
  ['escala-sem-sinal', 'manter'],
  ['intervalo-degrau', 'manter'],
  ['escala', 'escalar'],
  ['dentro-da-regua', 'manter'],
]);

function executar(ent, { bruto } = {}) {
  assert.ok(existsSync(SCRIPT), `script ausente: ${SCRIPT} (regua-decisao não implementada)`);
  const dir = mkdtempSync(join(tmpdir(), 'hermes-regua-'));
  try {
    const arq = join(dir, 'entrada.json');
    writeFileSync(arq, bruto ?? JSON.stringify(ent));
    const r = spawnSync(process.execPath, [SCRIPT, '--entrada', arq], { encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Entrada válida mínima: janela de 7 dias, última edição há 10 dias, sem degrau, sem eventos,
// sem receita e sem config. Cada teste sobrescreve só o que importa ao caso.
const entrada = (extra = {}) => ({
  entidade: 'conjunto SEG-A (teste)',
  janela_dias: 7,
  gasto: 210,
  conversoes: 0,
  dias_desde_ultima_edicao: 10,
  reguas: { ...REGUAS },
  ...extra,
});
const sem = (obj, ...campos) => Object.fromEntries(Object.entries(obj).filter(([k]) => !campos.includes(k)));

// Moeda e heurísticas vêm do perfil do negócio: os casos de comportamento recebem os valores que o
// script usava como constante (C8). Os casos de recusa montam a entrada à mão, sem estes campos.
const comPerfil = (ent) => ent === null || typeof ent !== 'object' ? ent : ({ moeda: 'BRL', ...ent, config: { ...PARAMETROS_DE_HOJE, ...(ent.config ?? {}) } });

function decidir(extra) {
  const r = executar(comPerfil(entrada(extra)));
  assert.equal(r.status, 0, `entrada válida deveria sair 0 (veio ${r.status}); stderr: ${r.stderr}`);
  try {
    return JSON.parse(r.stdout);
  } catch {
    assert.fail(`stdout não é JSON: ${r.stdout.slice(0, 200)}`);
  }
}

function esperar(extra, decisao, gatilho, contexto) {
  const j = decidir(extra);
  assert.deepEqual([j.decisao, j.gatilho], [decisao, gatilho], `${contexto} (motivo: ${j.motivo})`);
  return j;
}

function recusada(ent, campo, contexto, opts) {
  const { semPerfil, ...resto } = opts ?? {};
  const r = executar(semPerfil ? ent : comPerfil(ent), resto);
  assert.equal(r.status, 1, `${contexto}: entrada inválida deveria sair 1 (veio ${r.status}); stdout: ${r.stdout.slice(0, 200)}`);
  assert.equal(r.stdout, '', `${contexto}: entrada inválida não escreve stdout`);
  assert.ok(r.stderr.trim().length > 0, `${contexto}: a recusa precisa de mensagem em stderr`);
  if (campo) assert.ok(r.stderr.includes(campo), `${contexto}: stderr deveria citar o campo "${campo}": ${r.stderr}`);
}

// ── A3: janela mínima e a heurística avaliada e rejeitada ────────────────────
test('janela-minima: pausar com gasto abaixo do breakeven em 3 dias fica rejeitado — manter, nunca pausar', () => {
  for (const gasto of [35, 40, 45]) {
    esperar({ gasto, janela_dias: 3, conversoes: 0, dias_desde_ultima_edicao: 10 }, 'manter', 'janela-minima', `R$${gasto} em 3 dias`);
  }
  // a janela trava o veredito mesmo com gasto acima do piso de pausa; 6 dias ainda é janela curta
  esperar({ gasto: 250, janela_dias: 3, conversoes: 0 }, 'manter', 'janela-minima', 'R$250 em 3 dias');
  esperar({ gasto: 250, janela_dias: 6, conversoes: 0 }, 'manter', 'janela-minima', 'R$250 em 6 dias');
});

test('janela-minima: janela_minima_veredito_dias abaixo de 7 é recusada (exit 1, sem stdout)', () => {
  for (const v of [3, 6]) {
    recusada(entrada({ config: { janela_minima_veredito_dias: v } }), 'janela_minima_veredito_dias', `janela mínima ${v}`);
  }
  // para cima o workspace pode endurecer: 8 dias de janela com mínimo 10 ainda não dá veredito
  esperar({ janela_dias: 8, gasto: 210, conversoes: 0, config: { janela_minima_veredito_dias: 10 } }, 'manter', 'janela-minima', 'mínimo 10');
});

// ── A2/A3: pausa e pisos ─────────────────────────────────────────────────────
test('pausa: gasto 210 em 7 dias, sem conversão, receita 0 e sem degrau — pausar', () => {
  esperar({ gasto: 210, janela_dias: 7, conversoes: 0, receita: 0, dias_desde_ultima_edicao: 10 }, 'pausar', 'pausa', 'sem degrau (campo ausente)');
  esperar({ gasto: 210, conversoes: 0, receita: 0, dias_desde_ultimo_degrau: null }, 'pausar', 'pausa', 'dias_desde_ultimo_degrau null = sem degrau');
});

test('piso-pausa: gasto 150 abaixo do piso de 200 mantém; com piso_veredito_pausa 120 no config, pausa', () => {
  const j = esperar({ gasto: 150, conversoes: 0 }, 'manter', 'piso-pausa', 'piso padrão 200');
  assert.equal(j.piso_veredito_pausa_efetivo, 200);
  esperar({ gasto: 200, conversoes: 0 }, 'pausar', 'pausa', 'gasto igual ao piso já pausa');
  const k = esperar({ gasto: 150, conversoes: 0, config: { piso_veredito_pausa: 120 } }, 'pausar', 'pausa', 'override 120');
  assert.equal(k.piso_veredito_pausa_efetivo, 120);
  assert.equal(k.config.piso_veredito_pausa, 120, 'a config efetiva ecoa o override');
});

test('piso-pausa: piso efetivo nunca fica abaixo do CAC breakeven (config 30 vira 100)', () => {
  const j = esperar({ gasto: 60, conversoes: 0, config: { piso_veredito_pausa: 30 } }, 'manter', 'piso-pausa', 'gasto 60 abaixo do breakeven 100');
  assert.equal(j.piso_veredito_pausa_efetivo, 100);
  const k = esperar({ gasto: 110, conversoes: 0, config: { piso_veredito_pausa: 30 } }, 'pausar', 'pausa', 'gasto 110 acima do piso efetivo 100');
  assert.equal(k.piso_veredito_pausa_efetivo, 100);
});

test('pisos_atingidos: gasto 120 atinge diagnóstico e opinião de fadiga, não o veredito de pausa', () => {
  assert.deepEqual(decidir({ gasto: 120, conversoes: 0 }).pisos_atingidos, { diagnostico: true, opiniao_fadiga: true, veredito_pausa: false });
  assert.deepEqual(decidir({ gasto: 40, conversoes: 0 }).pisos_atingidos, { diagnostico: false, opiniao_fadiga: false, veredito_pausa: false });
  // "abaixo do piso" é estrito: gasto igual ao piso já o atinge
  assert.deepEqual(decidir({ gasto: 50, conversoes: 0 }).pisos_atingidos, { diagnostico: true, opiniao_fadiga: false, veredito_pausa: false });
  assert.deepEqual(decidir({ gasto: 100, conversoes: 0 }).pisos_atingidos, { diagnostico: true, opiniao_fadiga: true, veredito_pausa: false });
  assert.deepEqual(decidir({ gasto: 200, conversoes: 0 }).pisos_atingidos, { diagnostico: true, opiniao_fadiga: true, veredito_pausa: true });
  // os pisos são sobrescrevíveis pelo workspace
  const k = decidir({ gasto: 120, conversoes: 0, config: { piso_diagnostico: 125, piso_opiniao_fadiga: 150 } });
  assert.deepEqual(k.pisos_atingidos, { diagnostico: false, opiniao_fadiga: false, veredito_pausa: false });
});

test('saída: ecoa entidade e réguas e traz a config efetiva com os defaults dos pisos (A2)', () => {
  const j = decidir({ gasto: 120, conversoes: 0 });
  assert.equal(j.entidade, 'conjunto SEG-A (teste)');
  for (const [k, v] of Object.entries(REGUAS)) assert.equal(j.reguas?.[k], v, `reguas.${k} ecoado`);
  const PADRAO = {
    piso_diagnostico: 50,
    piso_opiniao_fadiga: 100,
    piso_veredito_pausa: 200,
    janela_minima_veredito_dias: 7,
    dias_minimos_desde_edicao: 7,
    conversoes_minimas_escala: 10,
    intervalo_minimo_degrau_dias: 7,
  };
  for (const [k, v] of Object.entries(PADRAO)) assert.equal(j.config?.[k], v, `config.${k} padrão`);
  assert.equal(j.config?.eventos_minimos_aprendizado ?? null, null, 'eventos_minimos_aprendizado desligado por padrão');
  // sobrescrever um campo mantém os outros no padrão
  const k = decidir({ gasto: 120, conversoes: 0, config: { piso_veredito_pausa: 250 } });
  assert.equal(k.config.piso_veredito_pausa, 250);
  assert.equal(k.config.piso_diagnostico, 50);
  assert.equal(k.piso_veredito_pausa_efetivo, 250);
});

// ── A3: escala ───────────────────────────────────────────────────────────────
test('escala: CPA 50 abaixo do alvo, ROAS 3 e 10 conversões sem degrau — escalar', () => {
  esperar({ gasto: 500, conversoes: 10, receita: 1500 }, 'escalar', 'escala', 'CPA 50, ROAS 3');
  esperar({ gasto: 500, conversoes: 10 }, 'escalar', 'escala', 'ROAS desconhecido não impede a escala');
  esperar({ gasto: 500, conversoes: 10, receita: 1500, reguas: { ...REGUAS, roas_alvo: 4 } }, 'manter', 'dentro-da-regua', 'roas_alvo 4 vira a régua da escala');
});

test('escala-sem-sinal: CPA 50 e ROAS 3 com só 6 conversões — manter', () => {
  esperar({ gasto: 300, conversoes: 6, receita: 900 }, 'manter', 'escala-sem-sinal', '6 conversões, mínimo 10');
  esperar({ gasto: 300, conversoes: 6, receita: 900, config: { conversoes_minimas_escala: 5 } }, 'escalar', 'escala', 'conversoes_minimas_escala 5');
  // CPA igual ao alvo ainda é bom para escala; falta só sinal de conversões
  esperar({ gasto: 80, conversoes: 1 }, 'manter', 'escala-sem-sinal', 'CPA 80,00 igual ao alvo');
});

// ── A3: degrau ───────────────────────────────────────────────────────────────
test('degrau-recente: desempenho ruim 5 dias depois do degrau — manter, ainda sem reverter', () => {
  esperar({ gasto: 300, conversoes: 2, receita: 150, dias_desde_ultimo_degrau: 5 }, 'manter', 'degrau-recente', 'CPA 150, ROAS 0,5, degrau há 5 dias');
  esperar({ gasto: 500, conversoes: 10, receita: 1500, dias_desde_ultimo_degrau: 5 }, 'manter', 'intervalo-degrau', 'números de escala com degrau há 5 dias');
});

test('intervalo-degrau: intervalo_minimo_degrau_dias só aceita 3 a 7; com 3, degrau de 4 dias e números de escala escala', () => {
  for (const v of [2, 8]) {
    recusada(entrada({ config: { intervalo_minimo_degrau_dias: v } }), 'intervalo_minimo_degrau_dias', `intervalo ${v}`);
  }
  const escala = { gasto: 500, conversoes: 10, receita: 1500, dias_desde_ultimo_degrau: 4 };
  esperar(escala, 'manter', 'intervalo-degrau', 'intervalo padrão 7');
  esperar({ ...escala, dias_desde_ultimo_degrau: 7 }, 'escalar', 'escala', 'degrau igual ao intervalo padrão 7 já escala');
  esperar({ ...escala, config: { intervalo_minimo_degrau_dias: 3 } }, 'escalar', 'escala', 'intervalo 3');
});

test('reverter-degrau: CPA 120 acima do breakeven 8 dias depois do degrau — reverter-degrau', () => {
  const ruim = { gasto: 360, conversoes: 3, receita: 540 };
  const j = esperar({ ...ruim, dias_desde_ultimo_degrau: 8 }, 'reverter-degrau', 'reverter-degrau', 'degrau há 8 dias');
  assert.equal(j.metricas.gasto, 360);
  assert.equal(j.metricas.conversoes, 3);
  assert.equal(j.metricas.cpa, 120);
  assert.equal(j.metricas.roas, 1.5);
  esperar({ ...ruim, dias_desde_ultimo_degrau: 7 }, 'reverter-degrau', 'reverter-degrau', '7 dias já reverte');
  esperar({ ...ruim, dias_desde_ultimo_degrau: 6 }, 'manter', 'degrau-recente', '6 dias ainda espera');
  // a fronteira da reversão é 7 dias fixos: o intervalo de escala configurado não a antecipa
  esperar({ ...ruim, dias_desde_ultimo_degrau: 4, config: { intervalo_minimo_degrau_dias: 3 } }, 'manter', 'degrau-recente', 'intervalo 3 não antecipa a reversão');
});

test('reverter-degrau: degrau com 7 dias ou mais e CPA dentro da régua não reverte', () => {
  esperar({ gasto: 500, conversoes: 10, receita: 1500, dias_desde_ultimo_degrau: 8 }, 'escalar', 'escala', 'CPA 50 com degrau há 8 dias');
  esperar({ gasto: 360, conversoes: 4, receita: 900, dias_desde_ultimo_degrau: 10 }, 'manter', 'dentro-da-regua', 'CPA 90 com degrau há 10 dias');
});

// ── A3: sinais e régua ───────────────────────────────────────────────────────
test('sinais-divergentes: CPA 160 acima do breakeven com ROAS 3,75 — manter', () => {
  esperar({ gasto: 320, conversoes: 2, receita: 1200 }, 'manter', 'sinais-divergentes', 'CPA 160, ROAS 3,75');
  esperar({ gasto: 320, conversoes: 2, receita: 1200, dias_desde_ultimo_degrau: 8 }, 'manter', 'sinais-divergentes', 'ROAS bom segura o degrau antigo');
  // fronteira: ROAS igual ao breakeven não é ROAS ruim; logo abaixo vira desempenho ruim
  esperar({ gasto: 320, conversoes: 2, roas: 2 }, 'manter', 'sinais-divergentes', 'ROAS 2,00 igual ao breakeven');
  esperar({ gasto: 320, conversoes: 2, roas: 1.95 }, 'pausar', 'pausa', 'ROAS 1,95 abaixo do breakeven');
});

test('dentro-da-regua: CPA 90 entre o alvo e o breakeven com ROAS 2,5 — manter', () => {
  const j = esperar({ gasto: 360, conversoes: 4, receita: 900 }, 'manter', 'dentro-da-regua', 'CPA 90, ROAS 2,5');
  assert.equal(j.metricas.cpa, 90);
  // "CPA acima do breakeven" é estrito: CPA igual ao breakeven não é desempenho ruim
  esperar({ gasto: 100, conversoes: 1 }, 'manter', 'dentro-da-regua', 'CPA 100,00 igual ao breakeven');
});

test('roas explícito vence a receita na decisão e nas métricas', () => {
  const pelaReceita = esperar({ gasto: 320, conversoes: 2, receita: 1200 }, 'manter', 'sinais-divergentes', 'ROAS 3,75 pela receita');
  assert.equal(pelaReceita.metricas.roas, 3.75);
  const explicito = esperar({ gasto: 320, conversoes: 2, receita: 1200, roas: 1.2 }, 'pausar', 'pausa', 'roas 1,2 explícito vence a receita');
  assert.equal(explicito.metricas.roas, 1.2);
  const inverso = esperar({ gasto: 320, conversoes: 2, receita: 0, roas: 3.75 }, 'manter', 'sinais-divergentes', 'roas 3,75 explícito vence receita 0');
  assert.equal(inverso.metricas.roas, 3.75);
  assert.equal(decidir({ gasto: 320, conversoes: 2, receita: 1200, roas: null }).metricas.roas, 3.75, 'roas null cai para a receita');
  assert.equal(decidir({ gasto: 320, conversoes: 2 }).metricas.roas, null, 'sem receita e sem roas = ROAS desconhecido');
});

// ── A1/A3: aprendizado ───────────────────────────────────────────────────────
test('aprendizado-edicao: edição há 3 dias com números ótimos — manter', () => {
  esperar({ gasto: 500, conversoes: 10, receita: 1500, dias_desde_ultima_edicao: 3 }, 'manter', 'aprendizado-edicao', 'números de escala');
  esperar({ gasto: 210, conversoes: 0, receita: 0, dias_desde_ultima_edicao: 3 }, 'manter', 'aprendizado-edicao', 'números de pausa também esperam');
  esperar({ gasto: 500, conversoes: 10, receita: 1500, dias_desde_ultima_edicao: 7 }, 'escalar', 'escala', '7 dias desde a edição já decide');
});

test('aprendizado-eventos: conta pequena com 4 eventos e sem limiar recebe veredito; com limiar 50 fica em aprendizado (A1)', () => {
  const pequena = { gasto: 360, conversoes: 3, receita: 540, eventos_otimizacao: 4 };
  const j = decidir(pequena);
  assert.notEqual(j.gatilho, 'aprendizado-eventos', 'sem eventos_minimos_aprendizado a guarda de eventos fica desligada');
  assert.deepEqual([j.decisao, j.gatilho], ['pausar', 'pausa'], `decide pelo desempenho (motivo: ${j.motivo})`);
  assert.equal(j.config.eventos_minimos_aprendizado ?? null, null, 'limiar de eventos desligado por padrão');
  const k = esperar({ ...pequena, config: { eventos_minimos_aprendizado: 50 } }, 'manter', 'aprendizado-eventos', 'limiar 50 configurado');
  assert.equal(k.config.eventos_minimos_aprendizado, 50);
  esperar({ ...pequena, eventos_otimizacao: 50, config: { eventos_minimos_aprendizado: 50 } }, 'pausar', 'pausa', 'eventos iguais ao limiar 50 já decidem');
});

test('aprendizado-eventos: limiar configurado e eventos_otimizacao ausente — manter em aprendizado', () => {
  esperar({ gasto: 500, conversoes: 10, receita: 1500, config: { eventos_minimos_aprendizado: 50 } }, 'manter', 'aprendizado-eventos', 'eventos ausentes');
});

test('ordem: a primeira regra que casa decide (edição, eventos, janela, desempenho)', () => {
  const tudo = { gasto: 250, conversoes: 0, janela_dias: 3, eventos_otimizacao: 4, config: { eventos_minimos_aprendizado: 50 } };
  esperar({ ...tudo, dias_desde_ultima_edicao: 3 }, 'manter', 'aprendizado-edicao', 'edição recente antes de eventos e janela');
  esperar(tudo, 'manter', 'aprendizado-eventos', 'eventos antes da janela');
  esperar(sem(tudo, 'config'), 'manter', 'janela-minima', 'janela antes do desempenho');
  esperar({ ...sem(tudo, 'config'), janela_dias: 7 }, 'pausar', 'pausa', 'sem guarda ativa, decide o desempenho');
});

// ── A3: régua só por lookup e entrada inválida ───────────────────────────────
test('régua decorada não entra: reguas sem fonte ou sem cac_breakeven é recusada (exit 1, sem stdout)', () => {
  recusada(entrada({ reguas: sem(REGUAS, 'fonte') }), 'fonte', 'sem reguas.fonte');
  recusada(entrada({ reguas: { ...REGUAS, fonte: '' } }), 'fonte', 'reguas.fonte vazia');
  recusada(entrada({ reguas: sem(REGUAS, 'cac_breakeven') }), 'cac_breakeven', 'sem cac_breakeven');
  recusada(entrada({ reguas: sem(REGUAS, 'cac_alvo') }), 'cac_alvo', 'sem cac_alvo');
  recusada(entrada({ reguas: sem(REGUAS, 'roas_breakeven') }), 'roas_breakeven', 'sem roas_breakeven');
  recusada(entrada({ reguas: { ...REGUAS, cac_breakeven: 0 } }), 'cac_breakeven', 'cac_breakeven 0');
  recusada(entrada({ reguas: { ...REGUAS, roas_alvo: 0 } }), 'roas_alvo', 'roas_alvo 0');
  recusada(sem(entrada(), 'reguas'), 'reguas', 'sem reguas');
});

test('entrada inválida: gasto negativo, conversões fracionárias, campo desconhecido no config e edição ausente — exit 1, sem stdout', () => {
  recusada(entrada({ gasto: -1 }), 'gasto', 'gasto negativo');
  recusada(entrada({ conversoes: 1.5 }), 'conversoes', 'conversoes 1.5');
  recusada(entrada({ config: { piso_inventado: 10 } }), 'piso_inventado', 'campo desconhecido no config');
  recusada(sem(entrada(), 'dias_desde_ultima_edicao'), 'dias_desde_ultima_edicao', 'dias_desde_ultima_edicao ausente');
  recusada(entrada({ config: { piso_veredito_pausa: '250' } }), 'piso_veredito_pausa', 'valor não numérico no config');
  recusada(entrada({ gasto: '210' }), 'gasto', 'gasto em texto');
  recusada(entrada({ janela_dias: 0 }), 'janela_dias', 'janela 0');
  recusada(entrada({ dias_desde_ultimo_degrau: -1 }), 'dias_desde_ultimo_degrau', 'degrau negativo');
  recusada(entrada({ eventos_otimizacao: 2.5 }), 'eventos_otimizacao', 'eventos fracionários');
  recusada(entrada({ receita: -10 }), 'receita', 'receita negativa');
  recusada(entrada({ roas: -1 }), 'roas', 'roas negativo');
  recusada(null, null, 'JSON inválido', { bruto: '{ isto não é json' });
});

// ── A3: saída fechada ────────────────────────────────────────────────────────
test('saída fechada: grade de entradas válidas só produz decisão e gatilho do contrato, com motivo, rótulo e métricas', () => {
  const grade = [];
  for (const gasto of [0, 150, 360]) {
    for (const conversoes of [0, 4, 10]) {
      for (const receita of [undefined, 1500]) {
        for (const [janela_dias, dias_desde_ultimo_degrau] of [[7, null], [7, 8]]) {
          grade.push({ gasto, conversoes, receita, janela_dias, dias_desde_ultimo_degrau });
        }
      }
    }
  }
  // pontos avulsos para os ramos que a grade cartesiana não alcança
  grade.push({ gasto: 360, conversoes: 0, janela_dias: 7, dias_desde_ultimo_degrau: 4 });
  grade.push({ gasto: 360, conversoes: 10, receita: 1500, janela_dias: 7, dias_desde_ultimo_degrau: 4 });
  grade.push({ gasto: 360, conversoes: 10, receita: 540, janela_dias: 7, dias_desde_ultimo_degrau: null });
  for (const gasto of [150, 360]) for (const conversoes of [0, 10]) grade.push({ gasto, conversoes, janela_dias: 3 });
  grade.push({ gasto: 500, conversoes: 10, receita: 1500, dias_desde_ultima_edicao: 3 });
  grade.push({ gasto: 500, conversoes: 10, receita: 1500, eventos_otimizacao: 4, config: { eventos_minimos_aprendizado: 50 } });
  // iteração 2: CPA entre o alvo e o breakeven, cisco de gasto e reversão sem um CAC de gasto
  grade.push({ gasto: 360, conversoes: 4, receita: 900, janela_dias: 7 });
  grade.push({ gasto: 30, conversoes: 0, janela_dias: 7 });
  grade.push({ gasto: 60, conversoes: 0, janela_dias: 7, dias_desde_ultimo_degrau: 8 });
  grade.push({ gasto: 360, conversoes: 3, receita: 540, janela_dias: 14, dias_desde_ultima_edicao: 10 });

  const vistos = new Set();
  for (const ponto of grade) {
    const id = JSON.stringify(ponto);
    const j = decidir(ponto);
    assert.ok(DECISOES.has(j.decisao), `${id}: decisao fora do contrato: ${j.decisao}`);
    assert.ok(GATILHOS.has(j.gatilho), `${id}: gatilho fora do contrato: ${j.gatilho}`);
    assert.equal(j.decisao, GATILHOS.get(j.gatilho), `${id}: gatilho ${j.gatilho} com decisão ${j.decisao}`);
    assert.ok(typeof j.motivo === 'string' && j.motivo.trim().length > 0, `${id}: motivo vazio`);
    assert.ok(typeof j.rotulo === 'string' && j.rotulo.trim().length > 0, `${id}: rotulo vazio`);
    assert.ok(!/NaN|Infinity|undefined/.test(`${j.motivo} ${j.rotulo}`), `${id}: texto com valor indefinido: ${j.motivo}`);
    if (ponto.conversoes === 0) assert.equal(j.metricas.cpa, null, `${id}: CPA com 0 conversões é null`);
    else assert.ok(Math.abs(j.metricas.cpa - ponto.gasto / ponto.conversoes) < 0.01, `${id}: cpa=${j.metricas.cpa}`);
    if (ponto.receita === undefined || ponto.gasto === 0) assert.equal(j.metricas.roas, null, `${id}: ROAS desconhecido ou gasto 0 é null`);
    else assert.ok(Math.abs(j.metricas.roas - ponto.receita / ponto.gasto) < 0.01, `${id}: roas=${j.metricas.roas}`);
    // desempenho ruim exige gasto > 0: sem gasto não há pausa nem reversão
    if (ponto.gasto === 0) assert.ok(!['pausa', 'piso-pausa', 'piso-reversao', 'reverter-degrau'].includes(j.gatilho), `${id}: sem gasto não há desempenho ruim (${j.gatilho})`);
    vistos.add(j.gatilho);
  }
  // a grade só prova a saída fechada se de fato passa por todos os ramos
  assert.deepEqual([...GATILHOS.keys()].filter((g) => !vistos.has(g)), [], 'a grade precisa exercitar todos os gatilhos');
});

test('motivo: cita os números da regra que decidiu (gasto e piso, CPA e breakeven, janela)', () => {
  const piso = esperar({ gasto: 150, conversoes: 0 }, 'manter', 'piso-pausa', 'gasto 150');
  assert.match(piso.motivo, /150/, 'motivo cita o gasto');
  assert.match(piso.motivo, /200/, 'motivo cita o piso');
  const efetivo = esperar({ gasto: 60, conversoes: 0, config: { piso_veredito_pausa: 30 } }, 'manter', 'piso-pausa', 'piso efetivo');
  assert.match(efetivo.motivo, /60/, 'motivo cita o gasto');
  assert.match(efetivo.motivo, /100[.,]00/, 'motivo cita o piso efetivo (CAC breakeven)');
  const reverter = esperar({ gasto: 360, conversoes: 3, receita: 540, dias_desde_ultimo_degrau: 8 }, 'reverter-degrau', 'reverter-degrau', 'CPA 120');
  assert.match(reverter.motivo, /120/, 'motivo cita o CPA');
  assert.match(reverter.motivo, /100[.,]00/, 'motivo cita o CAC breakeven');
  const janela = esperar({ gasto: 40, janela_dias: 3, conversoes: 0 }, 'manter', 'janela-minima', 'janela 3');
  assert.match(janela.motivo, /\b3\b/, 'motivo cita a janela');
  assert.match(janela.motivo, /\b7\b/, 'motivo cita o mínimo');
});

// ── Iteração 2 (revisão adversarial de 2026-11-01) ───────────────────────────
// Cada teste reproduz um achado confirmado. A régua decidia em dinheiro com número que a
// própria regra não sustenta: fronteira quebrada por ponto flutuante, réguas trocadas aceitas,
// reversão sem dado e degrau antigo que nunca deixava pausar.

const reguas = (extra = {}) => ({ fonte: 'financeiro/relatorios/unit-economics-teste.md', ...extra });

test('fronteira em centavos: CPA igual ao breakeven pela divisão não é desempenho ruim', () => {
  // em ponto flutuante cru, 213.43 / 7 = 30.490000000000002 > 30.49: pausaria no CPA exato
  for (const [breakeven, conversoes, gasto] of [[30.49, 7, 213.43], [30.56, 3, 91.68], [30.04, 9, 270.36], [30.7, 9, 276.3]]) {
    const j = esperar(
      { gasto, conversoes, reguas: reguas({ cac_breakeven: breakeven, cac_alvo: 25, roas_breakeven: 1.5 }) },
      'manter', 'dentro-da-regua', `CPA ${breakeven} = ${gasto} / ${conversoes}`,
    );
    assert.equal(j.metricas.cpa, breakeven, 'a métrica sai no centavo que decidiu');
    assert.doesNotMatch(j.motivo, /acima/, `motivo afirma CPA acima do breakeven: ${j.motivo}`);
  }
});

test('fronteira em centésimos: ROAS igual ao breakeven pela divisão não é ROAS ruim', () => {
  // 172.89 / 113 = 1.5299999999999998 < 1.53: com CPA acima do breakeven, pausaria
  for (const [roasBreakeven, gasto, receita, conversoes] of [[1.53, 113, 172.89, 3], [1.56, 165, 257.4, 4], [1.51, 380, 573.8, 10]]) {
    const j = esperar(
      { gasto, conversoes, receita, reguas: reguas({ cac_breakeven: 30, cac_alvo: 25, roas_breakeven: roasBreakeven }) },
      'manter', 'sinais-divergentes', `ROAS ${roasBreakeven} = ${receita} / ${gasto}`,
    );
    assert.equal(j.metricas.roas, roasBreakeven);
  }
});

test('reguas fechadas: campo desconhecido em reguas é recusado (erro de digitação não vira escala)', () => {
  // com o erro de digitação aceito, roas_alvo some e a régua de escala cai para o breakeven
  recusada(entrada({ gasto: 500, conversoes: 10, receita: 1500, reguas: { ...REGUAS, roas_alvoo: 4 } }), 'roas_alvoo', 'roas_alvoo');
  recusada(entrada({ reguas: { ...REGUAS, cac_brekeven: 80 } }), 'cac_brekeven', 'cac_brekeven');
});

test('reguas coerentes: alvo de CAC acima do breakeven ou ROAS alvo abaixo do breakeven é recusado', () => {
  recusada(entrada({ reguas: { ...REGUAS, cac_alvo: 120 } }), 'cac_alvo', 'cac_alvo 120 acima do breakeven 100');
  recusada(entrada({ reguas: { ...REGUAS, roas_alvo: 1.5 } }), 'roas_alvo', 'roas_alvo 1,5 abaixo do breakeven 2,00');
  // igualdade não é incoerência: margem zero é escolha do unit-economics
  esperar({ gasto: 500, conversoes: 10, receita: 1500, reguas: { ...REGUAS, cac_alvo: 100, roas_alvo: 2 } }, 'escalar', 'escala', 'alvo igual ao breakeven');
});

test('rótulo: espera da reversão é decisão da metodologia; intervalo entre degraus da escala é heurística de mercado', () => {
  const escala = esperar({ gasto: 500, conversoes: 10, receita: 1500, dias_desde_ultimo_degrau: 4 }, 'manter', 'intervalo-degrau', 'escala com degrau há 4 dias');
  assert.match(escala.rotulo, /^heurística de mercado/);
  assert.match(escala.motivo, /intervalo mínimo 7/);
  const espera = esperar({ gasto: 360, conversoes: 3, receita: 540, dias_desde_ultimo_degrau: 5 }, 'manter', 'degrau-recente', 'ruim com degrau há 5 dias');
  assert.match(espera.rotulo, /^decisão da metodologia/);
});

test('sinais-divergentes nos dois sentidos: CPA no breakeven ou abaixo com ROAS abaixo do breakeven não é "dentro da régua"', () => {
  for (const [ponto, contexto] of [
    [{ gasto: 300, conversoes: 6, receita: 300 }, 'CPA 50 dentro do alvo, ROAS 1,00'],
    [{ gasto: 360, conversoes: 4, receita: 630 }, 'CPA 90 entre alvo e breakeven, ROAS 1,75'],
  ]) {
    const j = esperar(ponto, 'manter', 'sinais-divergentes', contexto);
    assert.match(j.motivo, /ROAS \d,\d\d abaixo do breakeven 2,00/, `${contexto}: ${j.motivo}`);
    assert.doesNotMatch(j.motivo, /entre o CAC alvo/, `${contexto}: ${j.motivo}`);
  }
});

test('dentro-da-regua: o motivo diz a relação verdadeira (CPA dentro do alvo, ROAS abaixo do ROAS alvo)', () => {
  const j = esperar({ gasto: 500, conversoes: 10, receita: 1500, reguas: { ...REGUAS, roas_alvo: 4 } }, 'manter', 'dentro-da-regua', 'ROAS 3 abaixo do alvo 4');
  assert.match(j.motivo, /dentro do CAC alvo BRL 80,00/);
  assert.match(j.motivo, /ROAS 3,00 abaixo da régua de escala 4,00/);
  assert.doesNotMatch(j.motivo, /entre o CAC alvo/);
});

test('piso-diagnostico: abaixo do piso de diagnóstico não há veredito (nem reversão, nem escala)', () => {
  const zero = esperar({ gasto: 0, conversoes: 0 }, 'manter', 'piso-diagnostico', 'gasto 0');
  assert.match(zero.rotulo, /^heurística de mercado/);
  assert.match(zero.motivo, /BRL 0,00/);
  assert.match(zero.motivo, /BRL 50,00/);
  esperar({ gasto: 30, conversoes: 0, dias_desde_ultimo_degrau: 8 }, 'manter', 'piso-diagnostico', 'reversão com R$30 de gasto');
  esperar({ gasto: 45, conversoes: 10, receita: 300 }, 'manter', 'piso-diagnostico', 'escala com R$45 de gasto');
  // o workspace pode baixar o piso; sem gasto, o motivo não inventa relação com a régua
  const semPiso = esperar({ gasto: 0, conversoes: 0, config: { piso_diagnostico: 0 } }, 'manter', 'dentro-da-regua', 'gasto 0 sem piso');
  assert.doesNotMatch(semPiso.motivo, /entre o CAC alvo|acima|abaixo do CAC/, semPiso.motivo);
});

test('piso-reversao: sem conversão, reverter exige gasto de pelo menos um CAC breakeven', () => {
  const cedo = esperar({ gasto: 60, conversoes: 0, dias_desde_ultimo_degrau: 8 }, 'manter', 'piso-reversao', 'R$60 sem venda, breakeven 100');
  assert.match(cedo.motivo, /BRL 60,00/);
  assert.match(cedo.motivo, /BRL 100,00/);
  assert.match(cedo.rotulo, /^decisão da metodologia/);
  const j = esperar({ gasto: 100, conversoes: 0, dias_desde_ultimo_degrau: 8 }, 'reverter-degrau', 'reverter-degrau', 'R$100 sem venda');
  assert.match(j.motivo, /0 conversões/);
  assert.doesNotMatch(j.motivo, /BRL 100,00 de gasto acima/, j.motivo);
});

test('degrau consolidado: com 14 dias ou mais desde o degrau, desempenho ruim segue a regra de pausa', () => {
  const ruim = { gasto: 360, conversoes: 3, receita: 540 };
  esperar({ ...ruim, dias_desde_ultimo_degrau: 13 }, 'reverter-degrau', 'reverter-degrau', 'degrau há 13 dias ainda em avaliação');
  esperar({ ...ruim, dias_desde_ultimo_degrau: 14 }, 'pausar', 'pausa', 'degrau há 14 dias está consolidado');
  esperar({ ...ruim, dias_desde_ultimo_degrau: 200 }, 'pausar', 'pausa', 'degrau antigo não impede a pausa');
  esperar({ gasto: 150, conversoes: 0, dias_desde_ultimo_degrau: 40 }, 'manter', 'piso-pausa', 'consolidado e abaixo do piso de pausa');
});

test('janela-mista: janela que começa antes do degrau em avaliação ainda não reverte', () => {
  const ruim = { gasto: 360, conversoes: 3, receita: 540 };
  const j = esperar({ ...ruim, janela_dias: 10, dias_desde_ultimo_degrau: 8 }, 'manter', 'janela-mista', 'janela de 10 dias, degrau há 8');
  assert.match(j.motivo, /janela de 10 dias/);
  assert.match(j.motivo, /8 dias/);
  assert.match(j.rotulo, /^decisão da metodologia/);
  esperar({ ...ruim, janela_dias: 8, dias_desde_ultimo_degrau: 8 }, 'reverter-degrau', 'reverter-degrau', 'janela de 8 dias, degrau há 8');
});

test('janela-mista: janela que começa antes da última edição não julga a configuração nova', () => {
  // 17 dos 25 dias são de antes da edição: o veredito julgaria a configuração antiga
  const j = esperar({ gasto: 400, conversoes: 2, receita: 300, janela_dias: 25, dias_desde_ultima_edicao: 8 }, 'manter', 'janela-mista', 'janela 25, edição há 8');
  assert.match(j.motivo, /janela de 25 dias/);
  assert.match(j.motivo, /8 dias/);
  esperar({ gasto: 180, conversoes: 2, receita: 450, janela_dias: 8, dias_desde_ultima_edicao: 8 }, 'manter', 'dentro-da-regua', 'só os dias depois da edição');
});

test('motivo nunca afirma relação falsa com a régua (varredura)', () => {
  for (const gasto of [60, 150, 260, 360, 500]) {
    for (const conversoes of [0, 1, 4, 10]) {
      for (const receita of [undefined, 300, 900, 1500]) {
        const j = decidir({ gasto, conversoes, receita });
        const cpa = conversoes > 0 ? gasto / conversoes : null;
        const id = JSON.stringify({ gasto, conversoes, receita, gatilho: j.gatilho, motivo: j.motivo });
        if (cpa !== null && cpa <= 100) assert.doesNotMatch(j.motivo, /acima do CAC breakeven/, id);
        if (cpa !== null && cpa > 100) assert.doesNotMatch(j.motivo, /no CAC breakeven .* ou abaixo|entre o CAC alvo/, id);
        if (/entre o CAC alvo/.test(j.motivo)) assert.ok(cpa > 80 && cpa <= 100, id);
        if (cpa === null && gasto < 100) assert.doesNotMatch(j.motivo, /acima do CAC breakeven/, id);
      }
    }
  }
});

// ── Iteração 3 (adendo: lucro absoluto do período) ───────────────────────────
// Além de CPA e ROAS, a saída traz o lucro operacional do período e o lucro por real investido.
// Retorno menor por real pode dar lucro total maior: os dois saem juntos, e a faixa de
// referência (R$0,70 a R$1,50 por real) é heurística de mercado que informa sem mudar a árvore.

const BASES_DE_LUCRO = new Set(['receita', 'roas', 'conversoes']);

// vermelho por asserção, nunca por TypeError: saída sem o bloco lucro reprova com mensagem
function comLucro(extra) {
  const j = decidir(extra);
  assert.ok(j.lucro !== null && typeof j.lucro === 'object', `saída sem o bloco lucro (motivo: ${j.motivo})`);
  return j;
}

test('lucro: margem de contribuição da receita (receita ÷ ROAS breakeven) menos o gasto, e o lucro por real', () => {
  const j = comLucro({ gasto: 100, conversoes: 3, receita: 440 });
  assert.equal(j.lucro.periodo, 120, 'R$440 ÷ 2,00 − R$100');
  assert.equal(j.lucro.por_real_investido, 1.2);
  assert.equal(j.lucro.base, 'receita');
  assert.equal(j.lucro.leitura, 'dentro da faixa');
  assert.match(j.lucro.texto, /BRL 120,00/);
  assert.match(j.lucro.texto, /BRL 1,20 por unidade de moeda investida/);
  assert.match(j.lucro.texto, /BRL 0,70 a BRL 1,50/);
  assert.match(j.lucro.rotulo, /^heurística de mercado/);
});

test('lucro: retorno menor por real pode dar lucro total maior, e os dois números saem', () => {
  const a = comLucro({ gasto: 100, conversoes: 3, receita: 440 });
  const b = comLucro({ gasto: 500, conversoes: 12, receita: 1600 });
  assert.ok(b.lucro.por_real_investido < a.lucro.por_real_investido, 'B rende menos por real');
  assert.ok(b.lucro.periodo > a.lucro.periodo, 'B lucra mais no total');
  assert.equal(b.lucro.periodo, 300);
  assert.equal(b.lucro.leitura, 'abaixo da faixa');
});

test('lucro: com ROAS explícito, a margem sai do ROAS que decidiu', () => {
  const j = comLucro({ gasto: 200, conversoes: 4, receita: 1200, roas: 3 });
  assert.equal(j.lucro.base, 'roas');
  assert.equal(j.lucro.periodo, 100, 'R$200 × 3 ÷ 2,00 − R$200');
});

test('lucro: sem receita nem ROAS, estimado pelas conversões × CAC breakeven', () => {
  const j = comLucro({ gasto: 300, conversoes: 6 });
  assert.equal(j.lucro.base, 'conversoes');
  assert.equal(j.lucro.periodo, 300, '6 × R$100 − R$300');
  assert.match(j.lucro.texto, /convers/);
});

test('lucro: prejuízo sai negativo e com a palavra prejuízo', () => {
  const j = comLucro({ gasto: 360, conversoes: 3, receita: 540 });
  assert.equal(j.lucro.periodo, -90);
  assert.match(j.lucro.texto, /prejuízo/);
  assert.doesNotMatch(j.lucro.texto, /R\$-/);
});

test('lucro: a faixa de referência é sobrescrevível e não muda a decisão', () => {
  const base = { gasto: 500, conversoes: 10, receita: 1500 };
  const padrao = comLucro(base);
  // lucro de R$250,00 em R$500 = R$0,50 por real: abaixo da faixa padrão, dentro de 0,10 a 0,60
  const outra = comLucro({ ...base, config: { lucro_por_real_referencia_min: 0.1, lucro_por_real_referencia_max: 0.6 } });
  assert.deepEqual([outra.decisao, outra.gatilho], [padrao.decisao, padrao.gatilho], 'a faixa só informa');
  assert.deepEqual([padrao.lucro.leitura, outra.lucro.leitura], ['abaixo da faixa', 'dentro da faixa']);
  assert.equal(outra.config.lucro_por_real_referencia_min, 0.1);
  recusada(entrada({ config: { lucro_por_real_referencia_min: 2, lucro_por_real_referencia_max: 1 } }), 'lucro_por_real_referencia_min', 'mínimo acima do máximo');
  recusada(entrada({ config: { lucro_por_real_referencia_max: -1 } }), 'lucro_por_real_referencia_max', 'máximo negativo');
});

test('lucro: sem gasto não há lucro por real investido', () => {
  const j = comLucro({ gasto: 0, conversoes: 0, config: { piso_diagnostico: 0 } });
  assert.equal(j.lucro.por_real_investido, null);
  assert.equal(j.lucro.leitura, null);
  assert.equal(j.lucro.periodo, 0);
});

test('lucro: toda saída válida traz o lucro do período, a base e o texto', () => {
  for (const gasto of [0, 60, 150, 360, 500]) {
    for (const conversoes of [0, 4, 10]) {
      for (const receita of [undefined, 300, 1500]) {
        const j = comLucro({ gasto, conversoes, receita, config: { piso_diagnostico: 0 } });
        const id = JSON.stringify({ gasto, conversoes, receita });
        assert.ok(j.lucro && typeof j.lucro.periodo === 'number', `${id}: sem lucro.periodo`);
        assert.ok(BASES_DE_LUCRO.has(j.lucro.base), `${id}: base ${j.lucro.base}`);
        assert.ok(typeof j.lucro.texto === 'string' && j.lucro.texto.length > 0, `${id}: texto vazio`);
        assert.ok(!/NaN|Infinity|undefined/.test(j.lucro.texto), `${id}: ${j.lucro.texto}`);
      }
    }
  }
});

// ── Iteração 3b (verificação adversarial das correções da iteração 2) ────────
// Degrau em avaliação: qualquer veredito (não só a reversão) usa só os dias depois dele, quando
// já existe uma janela mínima inteira depois dele; o teto de avaliação acompanha a janela
// mínima configurada; meio centavo arredonda igual nas réguas e nas métricas.

test('janela-mista geral: com degrau em avaliação e janela inteira disponível, janela que começa antes dele não escala', () => {
  // conjunto criado há 30 dias, degrau há 8: a janela da vida inteira mistura o antes e o depois
  const vida = { janela_dias: 30, dias_desde_ultima_edicao: 30, dias_desde_ultimo_degrau: 8 };
  esperar({ ...vida, gasto: 1710, conversoes: 31 }, 'manter', 'janela-mista', 'escala na janela mista');
  esperar({ ...vida, gasto: 2700, conversoes: 30 }, 'manter', 'janela-mista', 'manter na janela mista');
  // só o período depois do degrau decide: CPA 110,00 acima do breakeven reverte
  esperar({ janela_dias: 8, dias_desde_ultima_edicao: 30, dias_desde_ultimo_degrau: 8, gasto: 660, conversoes: 6 }, 'reverter-degrau', 'reverter-degrau', 'só depois do degrau');
});

test('teto do degrau em avaliação acompanha a janela mínima configurada', () => {
  const ruim = { gasto: 360, conversoes: 3, receita: 540, dias_desde_ultima_edicao: 40, config: { janela_minima_veredito_dias: 14 } };
  esperar({ ...ruim, janela_dias: 14, dias_desde_ultimo_degrau: 15 }, 'reverter-degrau', 'reverter-degrau', 'janela mínima 14, degrau há 15');
  esperar({ ...ruim, janela_dias: 14, dias_desde_ultimo_degrau: 20 }, 'reverter-degrau', 'reverter-degrau', 'degrau há 20 ainda em avaliação');
  esperar({ ...ruim, janela_dias: 14, dias_desde_ultimo_degrau: 21 }, 'pausar', 'pausa', 'consolidado em 14 + 7 dias');
  // padrão inalterado: janela mínima 7, consolidado em 14
  esperar({ gasto: 360, conversoes: 3, receita: 540, dias_desde_ultimo_degrau: 13 }, 'reverter-degrau', 'reverter-degrau', 'padrão: 13 dias');
  esperar({ gasto: 360, conversoes: 3, receita: 540, dias_desde_ultimo_degrau: 14 }, 'pausar', 'pausa', 'padrão: 14 dias');
});

test('meio centavo arredonda igual na régua e na métrica: CPA igual ao breakeven de 3 casas não é acima', () => {
  const j = esperar(
    { gasto: 256.28, conversoes: 8, reguas: reguas({ cac_breakeven: 32.035, cac_alvo: 25, roas_breakeven: 1.5 }) },
    'manter', 'dentro-da-regua', 'CPA 32,035 = breakeven 32,035',
  );
  assert.doesNotMatch(j.motivo, /acima/);
  // ROAS 2,425 informado ou pela receita decide igual contra o breakeven 2,43
  const r = reguas({ cac_breakeven: 30, cac_alvo: 25, roas_breakeven: 2.43 });
  const explicito = decidir({ gasto: 400, conversoes: 10, roas: 2.425, reguas: r });
  const pelaReceita = decidir({ gasto: 400, conversoes: 10, receita: 970, reguas: r });
  assert.deepEqual([explicito.decisao, explicito.gatilho], [pelaReceita.decisao, pelaReceita.gatilho], `${explicito.motivo} | ${pelaReceita.motivo}`);
  assert.equal(explicito.gatilho, 'sinais-divergentes');
});

// ── Iteração 3c (revisão adversarial do adendo) ──────────────────────────────
// A janela não pode começar antes do último degrau mais do que o necessário, nem depois da
// consolidação; o lucro diz de onde vêm os números (plataforma, por padrão); bordas do lucro.

test('janela-mista com degrau recente: janela maior que a mínima não escala sobre o degrau', () => {
  // janela mínima 8, degrau há 7: 23 dias antes do degrau e 7 depois (números de escala na janela inteira)
  esperar({ janela_dias: 30, dias_desde_ultima_edicao: 40, dias_desde_ultimo_degrau: 7, gasto: 670, conversoes: 14, config: { janela_minima_veredito_dias: 8 } }, 'manter', 'janela-mista', 'janela mínima 8, degrau há 7');
  esperar({ janela_dias: 30, dias_desde_ultima_edicao: 40, dias_desde_ultimo_degrau: 13, gasto: 670, conversoes: 14, config: { janela_minima_veredito_dias: 14 } }, 'manter', 'janela-mista', 'janela mínima 14, degrau há 13');
  // intervalo 3, degrau há 3, janela do mês inteiro
  esperar({ janela_dias: 30, dias_desde_ultima_edicao: 40, dias_desde_ultimo_degrau: 3, gasto: 1500, conversoes: 30, receita: 4500, config: { intervalo_minimo_degrau_dias: 3 } }, 'manter', 'janela-mista', 'degrau há 3 na janela de 30');
  // com a janela mínima mais recente, a escala segue a heurística de intervalo
  esperar({ janela_dias: 7, dias_desde_ultima_edicao: 40, dias_desde_ultimo_degrau: 3, gasto: 500, conversoes: 10, receita: 1500, config: { intervalo_minimo_degrau_dias: 3 } }, 'escalar', 'escala', 'janela mínima com degrau há 3');
});

test('janela-mista depois da consolidação: a janela do mês não julga os dias antes do degrau', () => {
  const mes = { janela_dias: 30, dias_desde_ultima_edicao: 40, gasto: 2280, conversoes: 19 };
  esperar({ ...mes, dias_desde_ultimo_degrau: 13 }, 'manter', 'janela-mista', 'degrau há 13');
  esperar({ ...mes, dias_desde_ultimo_degrau: 14 }, 'manter', 'janela-mista', 'degrau há 14, consolidado');
  esperar({ janela_dias: 14, dias_desde_ultima_edicao: 40, dias_desde_ultimo_degrau: 14, gasto: 1260, conversoes: 14 }, 'manter', 'dentro-da-regua', 'só os dias depois do degrau');
});

test('lucro de plataforma por padrão; com números de ledger, lucro operacional', () => {
  const plataforma = comLucro({ gasto: 100, conversoes: 3, receita: 440 });
  assert.equal(plataforma.lucro.numeros, 'plataforma');
  assert.match(plataforma.lucro.texto, /lucro de plataforma/);
  assert.match(plataforma.lucro.texto, /ledger ÷ plataforma/);
  const ledger = comLucro({ gasto: 100, conversoes: 3, receita: 440, numeros: 'ledger' });
  assert.equal(ledger.lucro.numeros, 'ledger');
  assert.match(ledger.lucro.texto, /^lucro operacional do período BRL 120,00/);
  assert.equal(ledger.lucro.periodo, plataforma.lucro.periodo, 'a conta é a mesma; muda o rótulo');
  const prejuizo = comLucro({ gasto: 360, conversoes: 3, receita: 540 });
  assert.match(prejuizo.lucro.texto, /^prejuízo de plataforma do período BRL 90,00/);
  recusada(entrada({ numeros: 'erp' }), 'numeros', 'origem desconhecida');
});

test('lucro: com receita e gasto 0, a margem sai da receita', () => {
  const j = comLucro({ gasto: 0, conversoes: 3, receita: 300 });
  assert.equal(j.lucro.base, 'receita');
  assert.equal(j.lucro.periodo, 150, 'R$300 ÷ 2,00 − R$0');
  assert.doesNotMatch(j.lucro.texto, /sem receita/);
});

test('lucro: na borda de arredondamento, o lucro segue o ROAS que decidiu', () => {
  const j = comLucro({ gasto: 10000, conversoes: 200, receita: 19960 });
  assert.deepEqual([j.decisao, j.gatilho], ['escalar', 'escala'], j.motivo);
  assert.equal(j.lucro.periodo, 0, 'ROAS 2,00 na régua: lucro zero, não prejuízo');
});

test('reguas: ROAS breakeven abaixo de 1 é recusado (margem acima de 100%)', () => {
  recusada(entrada({ reguas: { ...REGUAS, roas_breakeven: 0.2 } }), 'roas_breakeven', 'ROAS breakeven 0,20');
});

test('faixa de lucro incoerente: a recusa cita os dois limites do perfil', () => {
  const r = executar(comPerfil(entrada({ config: { lucro_por_real_referencia_min: 0.7, lucro_por_real_referencia_max: 0.5 } })));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /0,70|0\.7/);
  assert.match(r.stderr, /0,50|0\.5/);
});

// ═════════════════════════════════════════════════════════════════════════════
// E3 (hermes 2.0.0), C4 e C8: origem de cada regra, heurísticas como parâmetros do perfil,
// moeda do perfil e preservação dos vereditos.
//
// Contrato fixado por estes testes:
//  - `config` carrega TODA heurística (o perfil as fornece; a skill injeta). Heurística ausente
//    em `config` é recusa (exit 1, stderr cita a chave): o script não guarda mais constante.
//  - `moeda` (código, ex.: BRL, EUR) é campo obrigatório da entrada; o texto de `motivo` e de
//    `lucro.texto` usa a moeda informada. A saída ecoa `moeda`.
//  - a saída traz `regras_aplicadas`: [{ regra, origem: 'oficial' | 'heurística', fonte?, parametro? }].
//    `regra` é o gatilho; `oficial` carrega `fonte` não vazia; `heurística` carrega `parametro`,
//    a chave de `config` que a governa.
// Os casos de C8 não dependem do contrato novo: a moeda só entra na entrada quando o script a aceita.
// ═════════════════════════════════════════════════════════════════════════════
const PARAMETROS_DE_HOJE = Object.freeze({
  piso_diagnostico: 50,
  piso_opiniao_fadiga: 100,
  piso_veredito_pausa: 200,
  janela_minima_veredito_dias: 7,
  dias_minimos_desde_edicao: 7,
  eventos_minimos_aprendizado: null,
  conversoes_minimas_escala: 10,
  intervalo_minimo_degrau_dias: 7,
  lucro_por_real_referencia_min: 0.7,
  lucro_por_real_referencia_max: 1.5,
});
// As 7 heurísticas obrigatórias em config (a janela mínima e o aprendizado têm valor no script).
const HEURISTICAS = ['piso_diagnostico', 'piso_opiniao_fadiga', 'piso_veredito_pausa', 'conversoes_minimas_escala', 'intervalo_minimo_degrau_dias', 'lucro_por_real_referencia_min', 'lucro_por_real_referencia_max'];

// O script aceita `moeda`? Sondagem por comportamento (nunca pelo texto do arquivo).
const ACEITA_MOEDA = executar({ ...entrada({ config: { ...PARAMETROS_DE_HOJE } }), moeda: 'BRL' }).status === 0;
const completa = (extra = {}, { moeda = 'BRL' } = {}) => {
  const { config, ...resto } = extra;
  return entrada({ ...resto, config: { ...PARAMETROS_DE_HOJE, ...(config ?? {}) }, ...(ACEITA_MOEDA && moeda ? { moeda } : {}) });
};
const rodarCompleta = (extra, opcoes) => {
  const r = executar(completa(extra, opcoes));
  assert.equal(r.status, 0, `entrada completa deveria sair 0 (veio ${r.status}); stderr: ${r.stderr}`);
  return JSON.parse(r.stdout);
};

// Golden de hoje: um caso por gatilho, com os parâmetros que reproduzem as constantes atuais.
// Valores medidos no script de hoje (decisao, gatilho, métricas, piso efetivo de pausa).
const GOLDEN = [
  ['aprendizado-edicao', { dias_desde_ultima_edicao: 3 }, 'manter', { cpa: null, roas: null }, 200],
  ['aprendizado-eventos', { config: { eventos_minimos_aprendizado: 50 }, eventos_otimizacao: 10 }, 'manter', { cpa: null, roas: null }, 200],
  ['janela-minima', { janela_dias: 5 }, 'manter', { cpa: null, roas: null }, 200],
  ['janela-mista', { janela_dias: 14, dias_desde_ultima_edicao: 10 }, 'manter', { cpa: null, roas: null }, 200],
  ['piso-diagnostico', { gasto: 30 }, 'manter', { cpa: null, roas: null }, 200],
  ['degrau-recente', { dias_desde_ultimo_degrau: 3 }, 'manter', { cpa: null, roas: null }, 200],
  ['piso-reversao', { gasto: 90, dias_desde_ultimo_degrau: 8 }, 'manter', { cpa: null, roas: null }, 200],
  ['reverter-degrau', { dias_desde_ultimo_degrau: 8 }, 'reverter-degrau', { cpa: null, roas: null }, 200],
  ['pausa', { gasto: 250 }, 'pausar', { cpa: null, roas: null }, 200],
  ['piso-pausa', { gasto: 150 }, 'manter', { cpa: null, roas: null }, 200],
  ['sinais-divergentes', { gasto: 200, conversoes: 1, roas: 2.5 }, 'manter', { cpa: 200, roas: 2.5 }, 200],
  ['escala-sem-sinal', { gasto: 160, conversoes: 2, roas: 3 }, 'manter', { cpa: 80, roas: 3 }, 200],
  ['intervalo-degrau', { gasto: 800, conversoes: 10, roas: 3, dias_desde_ultimo_degrau: 5 }, 'manter', { cpa: 80, roas: 3 }, 200],
  ['escala', { gasto: 800, conversoes: 10, roas: 3 }, 'escalar', { cpa: 80, roas: 3 }, 200],
  ['dentro-da-regua', { gasto: 180, conversoes: 2, roas: 2.5 }, 'manter', { cpa: 90, roas: 2.5 }, 200],
];

test('C8: com os parâmetros que reproduzem as constantes de hoje, os 15 gatilhos devolvem os mesmos vereditos e números', () => {
  assert.deepEqual(GOLDEN.map(([g]) => g).sort(), [...GATILHOS.keys()].sort(), 'o golden cobre todo gatilho da árvore');
  const divergentes = [];
  for (const [gatilho, extra, decisao, metricas, pisoPausa] of GOLDEN) {
    const j = rodarCompleta(extra);
    const obtido = [j.decisao, j.gatilho, j.metricas.cpa, j.metricas.roas, j.piso_veredito_pausa_efetivo];
    const esperado = [decisao, gatilho, metricas.cpa, metricas.roas, pisoPausa];
    if (JSON.stringify(obtido) !== JSON.stringify(esperado)) divergentes.push(`${gatilho}: esperado ${JSON.stringify(esperado)}, obtido ${JSON.stringify(obtido)}`);
  }
  assert.deepEqual(divergentes, []);
});

test('C8: o piso de pausa nunca fica abaixo do CAC breakeven, com o piso configurado menor', () => {
  const j = rodarCompleta({ gasto: 150, config: { piso_veredito_pausa: 20 } });
  assert.equal(j.piso_veredito_pausa_efetivo, 100, 'max(piso configurado, CAC breakeven)');
  assert.deepEqual([j.decisao, j.gatilho], ['pausar', 'pausa'], j.motivo);
});

const ORIGENS = new Set(['oficial', 'heurística', 'metodologia']);

test('C4: a saída traz regras_aplicadas com a origem de cada regra, e a regra que decidiu está nela', () => {
  const erros = [];
  for (const [gatilho, extra] of GOLDEN) {
    const j = rodarCompleta(extra);
    if (!Array.isArray(j.regras_aplicadas) || j.regras_aplicadas.length === 0) { erros.push(`${gatilho}: regras_aplicadas ausente ou vazio`); continue; }
    for (const r of j.regras_aplicadas) {
      if (typeof r.regra !== 'string' || !r.regra) erros.push(`${gatilho}: entrada sem regra`);
      if (!ORIGENS.has(r.origem)) erros.push(`${gatilho}: origem inválida ${JSON.stringify(r.origem)} (aceitas: oficial, heurística, metodologia)`);
    }
    if (!j.regras_aplicadas.some((r) => r.regra === j.gatilho)) erros.push(`${gatilho}: a regra que decidiu não aparece em regras_aplicadas`);
  }
  assert.deepEqual(erros, []);
});

test('C4: regra oficial cita a fonte; heurística cita o parâmetro do perfil que a governa', () => {
  const base = rodarCompleta({ dias_desde_ultima_edicao: 3 });
  assert.ok(Array.isArray(base.regras_aplicadas), 'a saída traz regras_aplicadas');
  const edicao = base.regras_aplicadas.find((r) => r.regra === 'aprendizado-edicao');
  assert.ok(edicao, 'aprendizado-edicao aparece em regras_aplicadas');
  assert.equal(edicao.origem, 'oficial');
  assert.equal(typeof edicao.fonte, 'string');
  assert.ok(edicao.fonte.trim().length > 0, 'regra oficial exige fonte não vazia');

  const esperadas = [
    ['piso-diagnostico', { gasto: 30 }, 'piso_diagnostico'],
    ['piso-pausa', { gasto: 150 }, 'piso_veredito_pausa'],
    ['pausa', { gasto: 250 }, 'piso_veredito_pausa'],
    ['escala-sem-sinal', { gasto: 160, conversoes: 2, roas: 3 }, 'conversoes_minimas_escala'],
    ['intervalo-degrau', { gasto: 800, conversoes: 10, roas: 3, dias_desde_ultimo_degrau: 5 }, 'intervalo_minimo_degrau_dias'],
  ];
  const erros = [];
  for (const [gatilho, extra, parametro] of esperadas) {
    const j = rodarCompleta(extra);
    const r = j.regras_aplicadas?.find((x) => x.regra === gatilho);
    if (!r) { erros.push(`${gatilho}: ausente`); continue; }
    if (r.origem !== 'heurística') erros.push(`${gatilho}: origem ${r.origem}, esperada heurística`);
    if (r.parametro !== parametro) erros.push(`${gatilho}: parametro ${r.parametro}, esperado ${parametro}`);
    if (!Object.hasOwn(j.config, r.parametro ?? '')) erros.push(`${gatilho}: parametro não é chave de config`);
  }
  assert.deepEqual(erros, []);
});

test('C4: heurística é parâmetro do perfil, não constante: sem a chave em config a entrada é recusada citando a chave', () => {
  const erros = [];
  for (const chave of HEURISTICAS) {
    const { [chave]: _fora, ...resto } = PARAMETROS_DE_HOJE;
    const r = executar(entrada({ config: resto, ...(ACEITA_MOEDA ? { moeda: 'BRL' } : {}) }));
    if (r.status !== 1) erros.push(`${chave}: esperava exit 1, veio ${r.status}`);
    else if (!r.stderr.includes(chave)) erros.push(`${chave}: stderr não cita a chave (${r.stderr.trim()})`);
    else if (r.stdout !== '') erros.push(`${chave}: recusa não escreve stdout`);
  }
  assert.deepEqual(erros, []);
});

test('C4: sem config nenhuma, a entrada é recusada (não há padrão silencioso)', () => {
  recusada({ ...entrada(), ...(ACEITA_MOEDA ? { moeda: 'BRL' } : {}) }, 'config', 'entrada sem config', { semPerfil: true });
});

test('C4: pisos em moeda usam a moeda do perfil: motivo e lucro falam EUR, nunca R$, e a saída ecoa a moeda', () => {
  const j = rodarCompleta({ gasto: 30 }, { moeda: 'EUR' });
  assert.equal(j.gatilho, 'piso-diagnostico');
  assert.equal(j.moeda, 'EUR');
  assert.match(j.motivo, /EUR/);
  assert.doesNotMatch(j.motivo, /R\$/);
  const lucro = rodarCompleta({ gasto: 300, conversoes: 3, receita: 540 }, { moeda: 'EUR' });
  assert.match(lucro.lucro.texto, /EUR/);
  assert.doesNotMatch(lucro.lucro.texto, /R\$/);
});

test('C4: moeda ausente ou fora do formato é recusada citando o campo (nunca R$ por padrão)', () => {
  recusada(entrada({ config: { ...PARAMETROS_DE_HOJE } }), 'moeda', 'sem moeda', { semPerfil: true });
  recusada({ ...entrada({ config: { ...PARAMETROS_DE_HOJE } }), moeda: 'reais' }, 'moeda', 'moeda fora do formato', { semPerfil: true });
});


// ── Revisão do PR 20, item 10: origem das regras coerente com o que o script faz ─────────────────────
test('C4: a janela mínima tem valor no script e por isso a origem é metodologia, nas cinco regras que a usam', () => {
  const casos = [
    ['janela-minima', { janela_dias: 3 }],
    ['janela-mista', { janela_dias: 10, dias_desde_ultima_edicao: 8 }],
    ['degrau-recente', { gasto: 300, conversoes: 0, roas: 0.5, dias_desde_ultimo_degrau: 3 }],
    ['piso-reversao', { gasto: 80, conversoes: 0, roas: 0.5, dias_desde_ultimo_degrau: 8 }],
    ['reverter-degrau', { gasto: 600, conversoes: 1, roas: 0.5, dias_desde_ultimo_degrau: 8 }],
  ];
  const erros = [];
  for (const [gatilho, extra] of casos) {
    const j = rodarCompleta(extra);
    const r = j.regras_aplicadas.find((x) => x.regra === gatilho);
    if (!r) { erros.push(`${gatilho}: não apareceu (decidiu ${j.gatilho})`); continue; }
    if (r.origem !== 'metodologia') erros.push(`${gatilho}: origem ${r.origem}`);
    if (r.parametro !== 'janela_minima_veredito_dias') erros.push(`${gatilho}: parametro ${r.parametro}`);
  }
  assert.deepEqual(erros, []);
});

test('C4: a pausa cita o piso efetivo; quando o CAC breakeven passa o piso configurado, o parâmetro citado é o breakeven', () => {
  const comPisoBaixo = rodarCompleta({ gasto: 400, conversoes: 0, roas: 0.5, config: { piso_veredito_pausa: 50 } });
  const reguaBreakeven = comPisoBaixo.reguas.cac_breakeven;
  assert.ok(reguaBreakeven > 50, 'o cenário precisa de um CAC breakeven acima do piso configurado');
  const piso = comPisoBaixo.regras_aplicadas.find((x) => x.regra === comPisoBaixo.gatilho);
  assert.equal(comPisoBaixo.gatilho, 'pausa');
  assert.equal(piso.piso_efetivo, comPisoBaixo.piso_veredito_pausa_efetivo);
  assert.equal(piso.piso_efetivo, reguaBreakeven);
  assert.equal(piso.parametro, 'reguas.cac_breakeven');
  const configuradoVence = rodarCompleta({ gasto: 600, conversoes: 0, roas: 0.5, config: { piso_veredito_pausa: reguaBreakeven + 100 } });
  const normal = configuradoVence.regras_aplicadas.find((x) => x.regra === configuradoVence.gatilho);
  assert.equal(normal.parametro, 'piso_veredito_pausa');
  assert.equal(normal.piso_efetivo, reguaBreakeven + 100);
});
