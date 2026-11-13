#!/usr/bin/env node
// Régua de decisão do hermes: fonte ÚNICA da árvore pausar / manter / escalar / reverter-degrau.
//
// Por que é script e não prosa: a árvore tem números e ORDEM de checagem, e regra numérica
// aplicada de cabeça erra a ordem. No histórico de conta, vereditos tomados em janela curta
// foram revertidos depois; a janela mínima de 7 dias e o piso que nunca fica abaixo de um
// CAC breakeven são as travas que impedem isso de voltar por configuração.
//
// Uso: node regua-decisao.mjs --entrada <entrada.json>
// stdout: JSON com { decisao, gatilho, motivo, rotulo, metricas, pisos_atingidos,
// piso_veredito_pausa_efetivo, reguas, config, entidade, moeda, regras_aplicadas }; exit 0.
// Métricas na moeda do perfil e ROAS com 2 casas: os mesmos números que decidiram.
// Heurística não tem valor aqui: `config` a traz do perfil do negócio (a skill injeta) e a
// saída diz, em `regras_aplicadas`, se cada regra é oficial (com fonte), heurística (com o
// parâmetro que a governa) ou metodologia (decisão fixa do plugin). `moeda` (código de 3 letras) também vem do perfil.
// Entrada inválida: exit 1, mensagem em stderr com o campo, nada em stdout.
// Sem dependências. Réguas de CAC/ROAS chegam do unit-economics citado (`reguas.fonte`):
// este script nunca carrega número de régua próprio.

import { readFileSync } from 'node:fs';

// Defaults só do que NÃO é heurística: janela mínima (metodologia, piso 7) e aprendizado
// (regra de plataforma). Heurística não tem default: o perfil a fornece em `config`.
const PADRAO = {
  janela_minima_veredito_dias: 7, // decisão da metodologia: não aceita valor menor
  dias_minimos_desde_edicao: 7, // regra de plataforma: edição significativa reinicia o aprendizado
  eventos_minimos_aprendizado: null, // regra de plataforma, guarda opcional (desligada)
};
// Parâmetros de heurística de mercado: obrigatórios em `config`.
// A faixa de lucro por unidade de moeda informa, não decide: retorno menor por unidade pode dar
// lucro total maior.
const HEURISTICAS = [
  'piso_diagnostico', // abaixo, "dados insuficientes" para diagnóstico
  'piso_opiniao_fadiga', // abaixo, a fadiga não opina
  'piso_veredito_pausa', // gasto mínimo para pausar (nunca abaixo de um CAC breakeven)
  'conversoes_minimas_escala',
  'intervalo_minimo_degrau_dias', // aceita 3 a 7
  'lucro_por_real_referencia_min',
  'lucro_por_real_referencia_max',
];
const CHAVES_DE_CONFIG = new Set([...Object.keys(PADRAO), ...HEURISTICAS]);
// Reverter um degrau exige janela pós-degrau completa: fixo, não configurável.
const DIAS_PARA_REVERTER = 7;
// O degrau fica em avaliação por uma semana depois da primeira janela mínima inteira depois
// dele: com os defaults, de 7 a 13 dias; consolidado com max(7, janela mínima) + 7. Desempenho
// ruim de degrau consolidado segue a regra de pausa: sem o teto, conjunto que já subiu de verba
// nunca recebia pausar, só reverter. O teto acompanha a janela mínima configurada, senão uma
// janela mínima de 14 dias tornaria a reversão impossível.
const diasParaAvaliarDegrau = (config) => Math.max(DIAS_PARA_REVERTER, config.janela_minima_veredito_dias);

const ROTULO = {
  'aprendizado-edicao': 'regra de plataforma',
  'aprendizado-eventos': 'regra de plataforma',
  'janela-minima': 'decisão da metodologia',
  'janela-mista': 'decisão da metodologia',
  'piso-diagnostico': 'heurística de mercado',
  'degrau-recente': 'decisão da metodologia',
  'piso-reversao': 'decisão da metodologia',
  'reverter-degrau': 'decisão da metodologia',
  pausa: 'heurística de mercado (piso de gasto) sobre a régua do unit-economics',
  'piso-pausa': 'heurística de mercado',
  'sinais-divergentes': 'decisão da metodologia',
  'escala-sem-sinal': 'heurística de mercado',
  'intervalo-degrau': 'heurística de mercado',
  escala: 'heurística de mercado sobre a régua do unit-economics',
  'dentro-da-regua': 'régua do unit-economics',
};

// Origem de cada regra (espelha references/regras-origem.md): `oficial` cita a fonte; `heurística` cita o
// parâmetro de `config` que a governa, quando há; `metodologia` é decisão fixa do plugin (a janela mínima tem
// piso e valor no script, não é heurística de mercado) e o parâmetro só a ajusta para cima.
const FONTE_APRENDIZADO = 'https://www.facebook.com/business/help/112167992830700';
const REGRAS = {
  'aprendizado-edicao': { origem: 'oficial', fonte: FONTE_APRENDIZADO },
  'aprendizado-eventos': { origem: 'oficial', fonte: FONTE_APRENDIZADO },
  'janela-minima': { origem: 'metodologia', parametro: 'janela_minima_veredito_dias' },
  'janela-mista': { origem: 'metodologia', parametro: 'janela_minima_veredito_dias' },
  'piso-diagnostico': { origem: 'heurística', parametro: 'piso_diagnostico' },
  'degrau-recente': { origem: 'metodologia', parametro: 'janela_minima_veredito_dias' },
  'piso-reversao': { origem: 'metodologia', parametro: 'janela_minima_veredito_dias' },
  'reverter-degrau': { origem: 'metodologia', parametro: 'janela_minima_veredito_dias' },
  pausa: { origem: 'heurística', parametro: 'piso_veredito_pausa' },
  'piso-pausa': { origem: 'heurística', parametro: 'piso_veredito_pausa' },
  'sinais-divergentes': { origem: 'heurística' },
  'escala-sem-sinal': { origem: 'heurística', parametro: 'conversoes_minimas_escala' },
  'intervalo-degrau': { origem: 'heurística', parametro: 'intervalo_minimo_degrau_dias' },
  escala: { origem: 'heurística', parametro: 'conversoes_minimas_escala' },
  'dentro-da-regua': { origem: 'heurística' },
  'faixa-lucro': { origem: 'heurística', parametro: 'lucro_por_real_referencia_min' },
};

class EntradaInvalida extends Error {}
const recusar = (msg) => { throw new EntradaInvalida(msg); };
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const numero = (v) => typeof v === 'number' && Number.isFinite(v);
const inteiro = (v) => Number.isInteger(v);
// Dinheiro em centavos e ROAS em centésimos, inteiros: a decisão compara exatamente o número
// que o motivo mostra. Em ponto flutuante cru, 213,43 / 7 dá 30,490000000000002 e um CPA
// igual ao breakeven contava como acima dele. O toPrecision tira o ruído binário antes do
// arredondamento (32,035 × 100 dá 3203,4999999999995): meio centavo sobe, igual à divisão
// inteira do CPA e do ROAS.
const cent = (v) => Math.round(Number((v * 100).toPrecision(15)));

const CAMPOS_REGUAS = new Set(['fonte', 'cac_breakeven', 'cac_alvo', 'roas_breakeven', 'roas_alvo']);
// De onde vêm gasto, conversões e receita: atribuição da plataforma de anúncios (padrão) ou
// ledger. Muda só o rótulo do lucro: número de plataforma não é lucro de ledger.
const ORIGENS_DOS_NUMEROS = new Set(['plataforma', 'ledger']);

function lerArgs(argv) {
  const i = argv.indexOf('--entrada');
  if (i < 0 || !argv[i + 1]) recusar('uso: regua-decisao.mjs --entrada <entrada.json>');
  return argv[i + 1];
}

function validar(e) {
  if (!ehObjeto(e)) recusar('a entrada deve ser um objeto JSON');
  const conhecidos = new Set(['entidade', 'moeda', 'janela_dias', 'gasto', 'conversoes', 'receita', 'roas', 'numeros', 'dias_desde_ultima_edicao', 'dias_desde_ultimo_degrau', 'eventos_otimizacao', 'reguas', 'config']);
  for (const k of Object.keys(e)) if (!conhecidos.has(k)) recusar(`campo desconhecido na entrada: "${k}"`);
  if (e.entidade !== undefined && typeof e.entidade !== 'string') recusar('campo "entidade" deve ser texto');
  if (typeof e.moeda !== 'string' || !/^[A-Z]{3}$/.test(e.moeda)) recusar('campo "moeda" é obrigatório: código de 3 letras maiúsculas (ex.: BRL, EUR) vindo do perfil do negócio');
  if (!inteiro(e.janela_dias) || e.janela_dias < 1) recusar('campo "janela_dias" deve ser inteiro >= 1');
  if (!numero(e.gasto) || e.gasto < 0) recusar('campo "gasto" deve ser número >= 0');
  if (!inteiro(e.conversoes) || e.conversoes < 0) recusar('campo "conversoes" deve ser inteiro >= 0');
  if (!inteiro(e.dias_desde_ultima_edicao) || e.dias_desde_ultima_edicao < 0) recusar('campo "dias_desde_ultima_edicao" é obrigatório: inteiro >= 0 (sem ele não há como saber se o aprendizado acabou)');
  for (const k of ['receita', 'roas']) if (e[k] != null && (!numero(e[k]) || e[k] < 0)) recusar(`campo "${k}" deve ser número >= 0`);
  if (e.numeros != null && !ORIGENS_DOS_NUMEROS.has(e.numeros)) recusar('campo "numeros" aceita "plataforma" (padrão: atribuição da plataforma de anúncios) ou "ledger"');
  for (const k of ['dias_desde_ultimo_degrau', 'eventos_otimizacao']) if (e[k] != null && (!inteiro(e[k]) || e[k] < 0)) recusar(`campo "${k}" deve ser inteiro >= 0`);

  // Régua decorada não entra: CAC e ROAS vêm do unit-economics citado, com a fonte. Lista
  // fechada e réguas coerentes: erro de digitação (roas_alvoo) ou réguas trocadas virariam
  // escala calada.
  if (!ehObjeto(e.reguas)) recusar('campo "reguas" é obrigatório: as réguas vêm do unit-economics mais recente, com a fonte');
  const r = e.reguas;
  for (const k of Object.keys(r)) if (!CAMPOS_REGUAS.has(k)) recusar(`reguas: campo desconhecido "${k}" (aceitos: ${[...CAMPOS_REGUAS].join(', ')})`);
  if (typeof r.fonte !== 'string' || !r.fonte.trim()) recusar('campo "reguas.fonte" é obrigatório: cite o arquivo do unit-economics usado');
  for (const k of ['cac_breakeven', 'cac_alvo', 'roas_breakeven']) if (!numero(r[k]) || r[k] <= 0) recusar(`campo "reguas.${k}" deve ser número > 0`);
  if (r.roas_alvo != null && (!numero(r.roas_alvo) || r.roas_alvo <= 0)) recusar('campo "reguas.roas_alvo" deve ser número > 0');
  if (cent(r.roas_breakeven) < 100) recusar('reguas: "roas_breakeven" abaixo de 1 significa margem acima de 100% da receita: confira as réguas do unit-economics');
  if (cent(r.cac_alvo) > cent(r.cac_breakeven)) recusar('reguas: "cac_alvo" acima do "cac_breakeven"; o alvo é o teto mais exigente: confira as réguas do unit-economics');
  if (r.roas_alvo != null && cent(r.roas_alvo) < cent(r.roas_breakeven)) recusar('reguas: "roas_alvo" abaixo do "roas_breakeven"; o alvo é o piso mais exigente: confira as réguas do unit-economics');

  if (!ehObjeto(e.config)) recusar('campo "config" é obrigatório: os parâmetros de heurística vêm do perfil do negócio');
  for (const k of Object.keys(e.config)) if (!CHAVES_DE_CONFIG.has(k)) recusar(`config: campo desconhecido "${k}"`);
  for (const k of HEURISTICAS) if (!Object.hasOwn(e.config, k)) recusar(`config: "${k}" é obrigatório (heurística: vem do perfil do negócio, o script não guarda valor)`);
  const config = { ...PADRAO };
  for (const [k, v] of Object.entries(e.config)) {
    if (k === 'eventos_minimos_aprendizado' && v === null) { config[k] = null; continue; }
    if (!numero(v) || v < 0) recusar(`config: "${k}" deve ser número >= 0`);
    config[k] = v;
  }
  if (!inteiro(config.janela_minima_veredito_dias) || config.janela_minima_veredito_dias < 7) recusar('config: "janela_minima_veredito_dias" não aceita menos de 7 dias (a heurística de janela curta foi rejeitada)');
  if (!inteiro(config.intervalo_minimo_degrau_dias) || config.intervalo_minimo_degrau_dias < 3 || config.intervalo_minimo_degrau_dias > 7) recusar('config: "intervalo_minimo_degrau_dias" aceita inteiro de 3 a 7');
  for (const k of ['dias_minimos_desde_edicao', 'conversoes_minimas_escala']) if (!inteiro(config[k])) recusar(`config: "${k}" deve ser inteiro`);
  if (config.lucro_por_real_referencia_min > config.lucro_por_real_referencia_max) {
    recusar(`config: faixa de lucro por real incoerente: "lucro_por_real_referencia_min" ${dec(cent(config.lucro_por_real_referencia_min))} acima do "lucro_por_real_referencia_max" ${dec(cent(config.lucro_por_real_referencia_max))}`);
  }
  if (config.eventos_minimos_aprendizado !== null && !inteiro(config.eventos_minimos_aprendizado)) recusar('config: "eventos_minimos_aprendizado" deve ser inteiro ou null');
  return config;
}

// Formatação a partir dos inteiros: o texto mostra exatamente o número que decidiu.
// ponytail: a moeda é global do processo (CLI de uma entrada por execução); várias moedas numa
// chamada exigiriam passar a moeda a cada formatação.
let MOEDA = '';
const din = (c) => `${c < 0 ? '-' : ''}${MOEDA} ${(Math.abs(c) / 100).toFixed(2).replace('.', ',')}`;
const dec = (c) => (c / 100).toFixed(2).replace('.', ',');

// Números da entrada, uma vez só: decisão, métricas e pisos da saída leem os mesmos inteiros.
function medir(e, config) {
  const r = e.reguas;
  const gasto = cent(e.gasto);
  const roasDeclarado = e.roas != null ? cent(e.roas) : null;
  const be = cent(r.cac_breakeven);
  return {
    gasto,
    cpa: e.conversoes > 0 ? Math.round(gasto / e.conversoes) : null,
    roas: roasDeclarado ?? (e.receita != null && gasto > 0 ? Math.round((cent(e.receita) * 100) / gasto) : null),
    be,
    alvo: cent(r.cac_alvo),
    roasBe: cent(r.roas_breakeven),
    roasEscala: cent(r.roas_alvo ?? r.roas_breakeven),
    diagnostico: cent(config.piso_diagnostico),
    fadiga: cent(config.piso_opiniao_fadiga),
    pausa: Math.max(cent(config.piso_veredito_pausa), be),
  };
}

// Lucro operacional do período: margem de contribuição da receita menos o gasto, sem custo fixo
// (custo fixo é do mês, não da campanha). A margem sai da régua do unit-economics: ROAS da
// janela × gasto ÷ ROAS breakeven, com o ROAS em centésimos que decidiu (pela receita ou o
// `roas` explícito); com receita e sem gasto, receita ÷ ROAS breakeven; sem receita nem ROAS,
// conversões × CAC breakeven (a margem de contribuição por pedido). Informa, não muda a árvore.
function lucro(e, config, m) {
  const r = e.reguas;
  let margem;
  let base;
  if (m.roas !== null) {
    // o mesmo ROAS (em centésimos) que decidiu: na borda de arredondamento, lucro e veredito
    // contam a mesma história
    margem = Math.round((m.roas * m.gasto) / m.roasBe);
    base = e.roas != null ? 'roas' : 'receita';
  } else if (e.receita != null) {
    // gasto 0: não há ROAS, mas a receita ainda dá a margem
    margem = Math.round((cent(e.receita) * 100) / m.roasBe);
    base = 'receita';
  } else {
    margem = e.conversoes * m.be;
    base = 'conversoes';
  }
  const periodo = margem - m.gasto;
  const porReal = m.gasto > 0 ? Math.round((periodo * 100) / m.gasto) : null;
  const min = cent(config.lucro_por_real_referencia_min);
  const max = cent(config.lucro_por_real_referencia_max);
  const leitura = porReal === null ? null : porReal < min ? 'abaixo da faixa' : porReal > max ? 'acima da faixa' : 'dentro da faixa';
  const numeros = e.numeros ?? 'plataforma';
  const origem = {
    roas: 'margem pelo ROAS informado (em centésimos, como no veredito) × gasto ÷ ROAS breakeven',
    receita: m.roas !== null
      ? 'margem pelo ROAS da receita (em centésimos, como no veredito) × gasto ÷ ROAS breakeven'
      : 'margem pela receita ÷ ROAS breakeven',
    conversoes: 'margem estimada pelas conversões × CAC breakeven, sem receita',
  }[base];
  const nome = numeros === 'ledger' ? 'operacional' : 'de plataforma';
  const valorTexto = periodo < 0 ? `prejuízo ${nome} do período ${din(-periodo)}` : `lucro ${nome} do período ${din(periodo)}`;
  const ressalva = numeros === 'ledger' ? '' : ' (atribuição da plataforma, não é lucro de ledger: aplique o fator ledger ÷ plataforma do pnl-mensal)';
  const porRealTexto = porReal === null
    ? 'sem gasto, sem lucro por real investido'
    : `${din(porReal)} por unidade de moeda investida (referência de mercado ${din(min)} a ${din(max)}: ${leitura})`;
  return {
    periodo: periodo / 100,
    por_real_investido: porReal === null ? null : porReal / 100,
    base,
    numeros,
    referencia_por_real: [min / 100, max / 100],
    leitura,
    rotulo: 'heurística de mercado (faixa de referência) sobre a régua do unit-economics',
    texto: `${valorTexto}${ressalva}, ${porRealTexto}; ${origem}, sem custo fixo`,
    fonte: r.fonte,
  };
}

function decidir(e, config, m) {
  const degrau = e.dias_desde_ultimo_degrau ?? null;
  const paraAvaliar = diasParaAvaliarDegrau(config);
  const emAvaliacao = degrau !== null && degrau < paraAvaliar + DIAS_PARA_REVERTER;
  // com uma janela mínima inteira depois do degrau já disponível, qualquer veredito usa só ela
  const degrauPronto = emAvaliacao && degrau >= paraAvaliar;
  const resultado = (decisao, gatilho, motivo) => ({ decisao, gatilho, motivo });

  if (e.dias_desde_ultima_edicao < config.dias_minimos_desde_edicao) {
    return resultado('manter', 'aprendizado-edicao', `em aprendizado: ${e.dias_desde_ultima_edicao} dia(s) desde a última edição significativa, mínimo ${config.dias_minimos_desde_edicao}`);
  }
  if (config.eventos_minimos_aprendizado !== null && (e.eventos_otimizacao == null || e.eventos_otimizacao < config.eventos_minimos_aprendizado)) {
    return resultado('manter', 'aprendizado-eventos', e.eventos_otimizacao == null
      ? `em aprendizado: limiar de ${config.eventos_minimos_aprendizado} eventos configurado e eventos de otimização não informados`
      : `em aprendizado: ${e.eventos_otimizacao} evento(s) de otimização, limiar configurado ${config.eventos_minimos_aprendizado}`);
  }
  if (e.janela_dias < config.janela_minima_veredito_dias) {
    return resultado('manter', 'janela-minima', `janela de ${e.janela_dias} dia(s) abaixo da janela mínima de veredito (${config.janela_minima_veredito_dias} dias): sem veredito`);
  }
  if (e.janela_dias > e.dias_desde_ultima_edicao) {
    return resultado('manter', 'janela-mista', `a janela de ${e.janela_dias} dias começa antes da última edição significativa (há ${e.dias_desde_ultima_edicao} dias): sem veredito; avalie só os dias depois dela`);
  }
  // A janela não começa antes do último degrau (em avaliação ou consolidado) mais do que a janela
  // mínima obriga: com degrau mais recente que ela, a janela mínima mais recente; senão, só os
  // dias depois dele. Janela maior mistura a verba de antes com a de depois.
  if (degrau !== null && e.janela_dias > Math.max(degrau, paraAvaliar)) {
    return resultado('manter', 'janela-mista', degrau >= paraAvaliar
      ? `a janela de ${e.janela_dias} dias começa antes do último degrau (há ${degrau} dias): sem veredito; avalie só os dias depois dele`
      : `a janela de ${e.janela_dias} dias começa antes do último degrau (há ${degrau} dias) e passa da janela mínima de ${paraAvaliar}: sem veredito; avalie com a janela mínima mais recente`);
  }
  if (m.gasto < m.diagnostico) {
    return resultado('manter', 'piso-diagnostico', `gasto ${din(m.gasto)} abaixo do piso de diagnóstico ${din(m.diagnostico)}: dados insuficientes para veredito`);
  }

  const cpaRuim = (m.cpa === null && m.gasto > 0) || (m.cpa !== null && m.cpa > m.be);
  const roasBom = m.roas !== null && m.roas >= m.roasBe;
  const roasTexto = m.roas === null ? 'ROAS desconhecido' : `ROAS ${dec(m.roas)}`;
  if (cpaRuim && !roasBom) {
    const ruim = `${m.cpa === null ? '0 conversões' : `CPA ${din(m.cpa)} acima do CAC breakeven ${din(m.be)}`} e ${m.roas === null ? 'ROAS desconhecido' : `ROAS ${dec(m.roas)} abaixo do breakeven ${dec(m.roasBe)}`}`;
    if (emAvaliacao) {
      if (!degrauPronto) {
        return resultado('manter', 'degrau-recente', `desempenho ruim (${ruim}) só ${degrau} dia(s) depois do último degrau: reverter exige ${paraAvaliar} dias, uma janela mínima inteira depois dele`);
      }
      if (m.cpa === null && m.gasto < m.be) {
        return resultado('manter', 'piso-reversao', `0 conversões ${degrau} dia(s) depois do último degrau, mas o gasto ${din(m.gasto)} ainda não chegou a um CAC breakeven (${din(m.be)}): sem veredito de reversão`);
      }
      const gastoTexto = m.cpa === null ? ` com gasto ${din(m.gasto)}, no CAC breakeven ${din(m.be)} ou acima,` : '';
      return resultado('reverter-degrau', 'reverter-degrau', `${ruim}${gastoTexto} ${degrau} dia(s) depois do último degrau: voltar ao degrau anterior`);
    }
    const consolidado = degrau !== null ? ` (último degrau há ${degrau} dias, consolidado)` : '';
    if (m.gasto >= m.pausa) {
      return resultado('pausar', 'pausa', `${ruim}, com gasto ${din(m.gasto)} no piso de veredito de pausa ${din(m.pausa)} ou acima em ${e.janela_dias} dias${consolidado}`);
    }
    return resultado('manter', 'piso-pausa', `desempenho ruim (${ruim}), mas gasto ${din(m.gasto)} abaixo do piso de veredito de pausa ${din(m.pausa)}: ainda sem veredito${consolidado}`);
  }
  if (cpaRuim && roasBom) {
    const cpaTexto = m.cpa === null ? '0 conversões' : `CPA ${din(m.cpa)} acima do CAC breakeven ${din(m.be)}`;
    return resultado('manter', 'sinais-divergentes', `sinais divergentes: ${cpaTexto}, mas ROAS ${dec(m.roas)} no breakeven ${dec(m.roasBe)} ou acima: observar`);
  }
  if (m.cpa !== null && m.roas !== null && m.roas < m.roasBe) {
    return resultado('manter', 'sinais-divergentes', `sinais divergentes: CPA ${din(m.cpa)} no CAC breakeven ${din(m.be)} ou abaixo, mas ROAS ${dec(m.roas)} abaixo do breakeven ${dec(m.roasBe)}: observar`);
  }
  const bomParaEscala = m.cpa !== null && m.cpa <= m.alvo && (m.roas === null || m.roas >= m.roasEscala);
  if (bomParaEscala) {
    if (e.conversoes < config.conversoes_minimas_escala) {
      return resultado('manter', 'escala-sem-sinal', `CPA ${din(m.cpa)} dentro do CAC alvo ${din(m.alvo)}, mas só ${e.conversoes} conversão(ões); escalar exige ${config.conversoes_minimas_escala}`);
    }
    if (degrau !== null && degrau < config.intervalo_minimo_degrau_dias) {
      return resultado('manter', 'intervalo-degrau', `números de escala (CPA ${din(m.cpa)}, ${roasTexto}), mas o último degrau foi há ${degrau} dia(s); intervalo mínimo ${config.intervalo_minimo_degrau_dias}`);
    }
    return resultado('escalar', 'escala', `CPA ${din(m.cpa)} dentro do CAC alvo ${din(m.alvo)}, ${roasTexto} (régua ${dec(m.roasEscala)}) e ${e.conversoes} conversões: subir um degrau`);
  }
  if (m.cpa === null) {
    return resultado('manter', 'dentro-da-regua', 'sem gasto e sem conversão na janela: nada a decidir');
  }
  if (m.cpa <= m.alvo) {
    return resultado('manter', 'dentro-da-regua', `CPA ${din(m.cpa)} dentro do CAC alvo ${din(m.alvo)}, mas ROAS ${dec(m.roas)} abaixo da régua de escala ${dec(m.roasEscala)}: manter`);
  }
  return resultado('manter', 'dentro-da-regua', `CPA ${din(m.cpa)} entre o CAC alvo ${din(m.alvo)} e o breakeven ${din(m.be)} (${roasTexto}): manter`);
}

// pausa e piso-pausa citam o piso EFETIVO: quando o CAC breakeven da régua passa o piso configurado, é ele que
// governa, e dizer que foi `piso_veredito_pausa` mentiria sobre o número que decidiu.
function pisoEfetivoDaRegra(regra, m, config) {
  if (regra !== 'pausa' && regra !== 'piso-pausa') return {};
  const doBreakeven = m.pausa > cent(config.piso_veredito_pausa);
  return { piso_efetivo: m.pausa / 100, ...(doBreakeven ? { parametro: 'reguas.cac_breakeven' } : {}) };
}

function principal() {
  let entrada;
  const arquivo = lerArgs(process.argv.slice(2));
  try { entrada = JSON.parse(readFileSync(arquivo, 'utf8')); }
  catch (err) { recusar(`não foi possível ler a entrada como JSON: ${err.message}`); }
  const config = validar(entrada);
  MOEDA = entrada.moeda;
  const m = medir(entrada, config);
  const d = decidir(entrada, config, m);
  const valor = (c) => (c === null ? null : c / 100);
  const lucroPeriodo = lucro(entrada, config, m);
  const regras = [d.gatilho, ...(lucroPeriodo.leitura !== null ? ['faixa-lucro'] : [])];
  return {
    decisao: d.decisao,
    gatilho: d.gatilho,
    motivo: d.motivo,
    rotulo: ROTULO[d.gatilho],
    metricas: { gasto: valor(m.gasto), conversoes: entrada.conversoes, cpa: valor(m.cpa), roas: valor(m.roas) },
    pisos_atingidos: {
      diagnostico: m.gasto >= m.diagnostico,
      opiniao_fadiga: m.gasto >= m.fadiga,
      veredito_pausa: m.gasto >= m.pausa,
    },
    piso_veredito_pausa_efetivo: valor(m.pausa),
    lucro: lucroPeriodo,
    reguas: { ...entrada.reguas },
    config,
    entidade: entrada.entidade ?? null,
    moeda: entrada.moeda,
    regras_aplicadas: regras.map((regra) => ({ regra, ...REGRAS[regra], ...pisoEfetivoDaRegra(regra, m, config) })),
  };
}

try {
  process.stdout.write(`${JSON.stringify(principal(), null, 2)}\n`);
} catch (err) {
  if (!(err instanceof EntradaInvalida)) throw err;
  process.stderr.write(`regua-decisao: ${err.message}\n`);
  process.exitCode = 1;
}
