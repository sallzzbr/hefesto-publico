#!/usr/bin/env node
// analisar-produto: o estilo ou a raça explica a venda? Cálculo determinístico, Node puro, sem dependência.
// Uso: node analisar-produto.mjs --entrada <entrada.json> --saida <dir>
// Contrato de entrada/saída e fórmulas: references/contrato.md. Grava analise-produto.md e .csv; stdout = JSON.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Constantes estatísticas fixas (documentadas no SKILL): alfa 0,05 bicaudal, poder 80%.
const ALFA = 0.05;
const Z_ALFA_2 = 1.959964; // quantil normal para alfa 0,05 bicaudal
const Z_PODER = 0.841621; // quantil normal para poder 80%

// Limiares de vitrine e junção: parâmetros nomeados, sobrescrevíveis em entrada.parametros.
const PARAMETROS_PADRAO = {
  fatiaAlta: 0.15, // fatia de impressões a partir da qual a estampa "domina" a vitrine
  fatiaBaixa: 0.03, // fatia de impressões até a qual a estampa está "escondida"
  razaoConversaoBaixa: 0.7, // taxa da estampa / taxa média: abaixo disso converte pouco
  razaoConversaoAlta: 1.3, // taxa da estampa / taxa média: acima disso converte muito
  minViewsSinal: 200, // views mínimas para uma estampa receber sinal (evita taxa de amostra minúscula)
  jaccardMinimo: 0.5, // similaridade mínima de tokens na junção de nomes
};

const CSV_CABECALHO = 'estampa,raca,estilo,impressoes,cliques,views,compras,taxa_compra,fatia_impressoes,sinal_vitrine,bloco';

// Guard de PII: varre SÓ valores string já decodificados (escapes \uXXXX não escondem nada), após NFKC,
// sem caracteres invisíveis e com [at]/(at)/[dot] desofuscados. Falso positivo aceito (renomear a estampa).
const INVISIVEIS = /[­​-‍⁠﻿]/g;
const normalizarPII = (s) => s.normalize('NFKC').replace(INVISIVEIS, '')
  .replace(/\s*[[(]\s*(?:at|arroba)\s*[\])]\s*/gi, '@').replace(/\s*[[(]\s*(?:dot|ponto)\s*[\])]\s*/gi, '.');
function cpfValido(d) {
  if (/^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    if ((soma * 10) % 11 % 10 !== Number(d[n])) return false;
  }
  return true;
}
const SEM_DIGITO_ANTES = '(?<!\\d)(?<!\\d[.,])'; // não começa no meio de número nem na fração de um decimal
const PII = [
  ['e-mail', (t) => /[\w.+-]+@[\w-]+\.[\w.-]+/.test(t)],
  ['CPF', (t) => /(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)/.test(t) || [...t.matchAll(new RegExp(`${SEM_DIGITO_ANTES}\\d{11}(?!\\d)`, 'g'))].some((m) => cpfValido(m[0]))],
  ['telefone', (t) => new RegExp(`${SEM_DIGITO_ANTES}(?:\\+?55[ \\t-]?)?\\(?[1-9]\\d\\)?[ \\t-]?9?\\d{4}[ \\t-]?\\d{4}(?!\\d)`).test(t)],
  ['endereço', (t) => /(?<![\p{L}\p{N}])(?:r|av|rua|avenida|travessa|alameda|estrada|rodovia|pra[cç]a)\.?[ \t]+[^\n]{1,60}?[,\s]\s*\d+/iu.test(t)],
];
const tipoPII = (texto) => { const t = normalizarPII(texto); return PII.find(([, teste]) => teste(t))?.[0] ?? null; };
function* strings(v, caminho = '') { // [caminho, valor] só de strings; chave fora de \w{1,40} vira "?" (a chave também pode ser PII)
  if (typeof v === 'string') yield [caminho, v];
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      const kk = /^\w{1,40}$/.test(k) ? k : '?';
      yield* strings(x, Array.isArray(v) ? `${caminho}[${k}]` : caminho ? `${caminho}.${kk}` : kk);
    }
  }
}
const COMO_PROCEDER = 'Renomeie a estampa/campo (ou agregue antes de chamar o script) e rode de novo.';
const recusarPIIEntrada = (e) => {
  for (const [caminho, valor] of strings(e)) {
    const tipo = tipoPII(valor);
    if (tipo) falhar(`entrada recusada: padrão de ${tipo} (PII) no campo ${caminho}. ${COMO_PROCEDER}`);
  }
};
const recusarPIISaida = (partes) => { // partes: [rótulo, texto]; texto de md/csv ou valores string do stdout
  for (const [rotulo, texto] of partes) {
    const tipo = tipoPII(texto);
    if (tipo) falhar(`saída bloqueada: padrão de ${tipo} (PII) em ${rotulo}. ${COMO_PROCEDER}`);
  }
};
const falhar = (msg, codigo = 1) => { process.stderr.write(`analisar-produto: ${msg}\n`); process.exit(codigo); };

// ── estatística ──────────────────────────────────────────────────────────────
function erfc(x) { // Numerical Recipes erfcc, erro relativo < 1,2e-7
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806
    + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

function comparar(escopo, a, b, A, B) {
  if (A.views <= 0 || B.views <= 0) return null;
  if (A.compras > A.views || B.compras > B.views) { // taxa > 100%: GA4 conta unidades; não há teste válido
    return { escopo, a, b, viewsA: A.views, viewsB: B.views, comprasA: A.compras, comprasB: B.compras, taxaA: A.compras / A.views, taxaB: B.compras / B.views, z: 0, p: 1, nMinimo: null, semPoder: false, rotulo: 'dados inconsistentes (compras > views)' };
  }
  const p1 = A.compras / A.views, p2 = B.compras / B.views;
  const pool = (A.compras + B.compras) / (A.views + B.views);
  const se = Math.sqrt(pool * (1 - pool) * (1 / A.views + 1 / B.views));
  const z = se > 0 ? (p1 - p2) / se : 0;
  const p = Math.min(1, erfc(Math.abs(z) / Math.SQRT2));
  const d = Math.abs(p1 - p2);
  const pm = (p1 + p2) / 2;
  const nMinimo = d > 0
    ? (Z_ALFA_2 * Math.sqrt(2 * pm * (1 - pm)) + Z_PODER * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (d * d)
    : null;
  const semPoder = nMinimo !== null && Math.min(A.views, B.views) < nMinimo;
  const rotulo = p < ALFA ? (semPoder ? 'sem poder para afirmar' : 'comprovado') : 'não comprovado';
  return { escopo, a, b, viewsA: A.views, viewsB: B.views, comprasA: A.compras, comprasB: B.compras, taxaA: p1, taxaB: p2, z, p, nMinimo, semPoder, rotulo };
}

// ── junção de nomes ──────────────────────────────────────────────────────────
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter(Boolean));
function jaccard(x, y) {
  let inter = 0;
  for (const t of x) if (y.has(t)) inter++;
  return inter / (x.size + y.size - inter);
}

// ── entrada ──────────────────────────────────────────────────────────────────
function lerEntrada(argv) {
  const arg = (nome) => { const i = argv.indexOf(nome); return i >= 0 ? argv[i + 1] : undefined; };
  const entrada = arg('--entrada'), saida = arg('--saida');
  if (!entrada || !saida) falhar('uso: analisar-produto.mjs --entrada <entrada.json> --saida <dir>', 2);
  let bruto;
  try { bruto = readFileSync(entrada, 'utf8'); } catch (e) { falhar(`não consegui ler a entrada: ${e.message}`); }
  let e;
  try { e = JSON.parse(bruto); } catch { falhar('entrada não é JSON válido'); } // sem eco: a mensagem do parser cita trecho da entrada
  recusarPIIEntrada(e);
  return { e, saida };
}

function validar(e) {
  if (!e || typeof e !== 'object') falhar('entrada deve ser um objeto JSON');
  if (typeof e.periodo !== 'string' || !e.periodo) falhar('campo "periodo" (string) obrigatório');
  if (typeof e.casa_excluida !== 'number' || !Number.isFinite(e.casa_excluida) || e.casa_excluida < 0) falhar('campo "casa_excluida" deve ser um número >= 0 (contagem, nunca dados da família)');
  if (!Array.isArray(e.estampas)) falhar('campo "estampas" deve ser um array');
  if (!Array.isArray(e.catalogo) || e.catalogo.length === 0) falhar('campo "catalogo" deve ser um array não vazio (raça e estilo vêm só do catálogo)');
  const vistos = new Set();
  for (const c of e.catalogo) {
    for (const k of ['estampa', 'raca', 'estilo']) if (typeof c?.[k] !== 'string' || !c[k]) falhar(`catalogo: item sem "${k}"`);
    if (vistos.has(norm(c.estampa))) falhar(`catalogo: estampa duplicada "${c.estampa}"`);
    vistos.add(norm(c.estampa));
  }
  if (e.excecoes != null && !Array.isArray(e.excecoes)) falhar('campo "excecoes" deve ser um array de { de, para }');
  for (const x of e.excecoes ?? []) {
    if (typeof x?.de !== 'string' || !vistos.has(norm(x?.para ?? ''))) falhar(`excecoes: "para" precisa ser uma estampa do catálogo (${JSON.stringify(x)})`);
  }
  const CAMPOS = ['meta_impressoes', 'meta_cliques', 'ga4_views', 'ga4_compras'];
  for (const l of e.estampas) {
    if (typeof l?.estampa !== 'string' || !l.estampa) falhar('estampas: linha sem "estampa"');
    if (!CAMPOS.some((k) => l[k] != null)) falhar(`estampas: linha sem dados de nenhuma fonte ("${l.estampa}")`);
    for (const k of CAMPOS) if (l[k] != null && (typeof l[k] !== 'number' || !Number.isFinite(l[k]) || l[k] < 0)) falhar(`estampas: "${k}" inválido em "${l.estampa}"`);
    // funil coerente por fonte: taxa > 100% quebra nMinimo (raiz negativa) e o ajuste por estilo
    for (const [num, den] of [['ga4_compras', 'ga4_views'], ['meta_cliques', 'meta_impressoes']]) {
      if (l[num] != null && l[den] == null) falhar(`estampas: "${num}" sem "${den}" em "${l.estampa}"`);
      if (l[num] != null && l[num] > l[den]) falhar(`estampas: "${num}" (${l[num]}) maior que "${den}" (${l[den]}) em "${l.estampa}"`);
    }
  }
  if (e.conjuntos != null) {
    if (!Array.isArray(e.conjuntos)) falhar('campo "conjuntos" deve ser um array de { conjunto, status, estampas }');
    e.conjuntos.forEach((c, i) => {
      if (!c || typeof c !== 'object' || Array.isArray(c)) falhar(`conjuntos[${i}] deve ser um objeto { conjunto, status, estampas }`);
      if (typeof c.conjunto !== 'string' || !c.conjunto.trim()) falhar(`conjuntos[${i}]: "conjunto" deve ser uma string não vazia`);
      if (c.status != null && typeof c.status !== 'string') falhar(`conjuntos[${i}]: "status" deve ser uma string`);
      if (!Array.isArray(c.estampas) || c.estampas.some((x) => typeof x !== 'string')) falhar(`conjuntos[${i}]: "estampas" deve ser um array de strings`);
    });
  }
  const parametros = { ...PARAMETROS_PADRAO };
  if (e.parametros != null && (typeof e.parametros !== 'object' || Array.isArray(e.parametros))) falhar('campo "parametros" deve ser um objeto');
  for (const [k, v] of Object.entries(e.parametros ?? {})) {
    if (!Object.hasOwn(PARAMETROS_PADRAO, k) || typeof v !== 'number' || !Number.isFinite(v)) falhar(`parametros: "${k}" desconhecido ou não numérico`);
    parametros[k] = v;
  }
  return parametros;
}

// ── análise ──────────────────────────────────────────────────────────────────
function juntar(e, parametros) {
  const porNorm = new Map(e.catalogo.map((c) => [norm(c.estampa), c]));
  const excecoes = new Map((e.excecoes ?? []).map((x) => [norm(x.de), porNorm.get(norm(x.para))]));
  const catTokens = e.catalogo.map((c) => [c, tokens(c.estampa)]);
  const casar = (nome) => { // { alvo, aprox, jaccard } | null; aprox = nem exato nem exceção
    const n = norm(nome);
    if (excecoes.has(n)) return { alvo: excecoes.get(n), aprox: false };
    if (porNorm.has(n)) return { alvo: porNorm.get(n), aprox: false };
    const t = tokens(nome);
    let melhor = [], max = 0;
    for (const [c, tc] of catTokens) {
      const j = jaccard(t, tc);
      if (j > max) { max = j; melhor = [c]; } else if (j === max && j > 0) melhor.push(c);
    }
    return max >= parametros.jaccardMinimo && melhor.length === 1 ? { alvo: melhor[0], aprox: true, jaccard: max } : null;
  };
  const soma = new Map(e.catalogo.map((c) => [c.estampa, { impressoes: 0, cliques: 0, views: 0, compras: 0 }]));
  const naoCasou = [];
  const aprox = new Map(); // `${norm}|${alvo}` -> { de, para, jaccard }
  const nomesPorAlvo = new Map(); // `${fonte}|${alvo}` -> Map(norm -> nome cru)
  const grafiasPorAlvo = new Map(); // alvo -> Map(norm -> { nome, aprox })
  for (const l of e.estampas) {
    const m = casar(l.estampa);
    const fontes = [(l.meta_impressoes != null || l.meta_cliques != null) && 'meta', (l.ga4_views != null || l.ga4_compras != null) && 'ga4'].filter(Boolean);
    if (!m) { for (const fonte of fontes) naoCasou.push({ estampa: l.estampa, fonte }); continue; }
    const { alvo } = m, n = norm(l.estampa);
    const s = soma.get(alvo.estampa);
    s.impressoes += l.meta_impressoes ?? 0; s.cliques += l.meta_cliques ?? 0;
    s.views += l.ga4_views ?? 0; s.compras += l.ga4_compras ?? 0;
    if (m.aprox) aprox.set(`${n}|${alvo.estampa}`, { de: l.estampa, para: alvo.estampa, jaccard: m.jaccard });
    if (!grafiasPorAlvo.has(alvo.estampa)) grafiasPorAlvo.set(alvo.estampa, new Map());
    grafiasPorAlvo.get(alvo.estampa).set(n, { nome: l.estampa, aprox: m.aprox });
    for (const fonte of fontes) {
      const k = `${fonte}|${alvo.estampa}`;
      if (!nomesPorAlvo.has(k)) nomesPorAlvo.set(k, new Map());
      nomesPorAlvo.get(k).set(n, l.estampa);
    }
  }
  const col = new Map(); // auditoria de colisões
  const marca = (alvo, nomes) => { if (!col.has(alvo)) col.set(alvo, new Set()); for (const n of nomes) col.get(alvo).add(n); };
  for (const [k, nomes] of nomesPorAlvo) { // >1 nome distinto na MESMA fonte
    if (nomes.size >= 2) marca(k.slice(k.indexOf('|') + 1), nomes.values());
  }
  for (const [alvo, grafias] of grafiasPorAlvo) { // duas grafias APROXIMADAS (mesmo de fontes diferentes) com tokens diferentes: variante v1/v2/neon
    const ap = [...grafias].filter(([, g]) => g.aprox);
    const difere = ap.some(([n1], i) => ap.slice(i + 1).some(([n2]) => [...tokens(n1)].sort().join(' ') !== [...tokens(n2)].sort().join(' ')));
    if (difere) marca(alvo, ap.map(([, g]) => g.nome));
  }
  const colisoes = [...col].map(([alvo, o]) => ({ alvo, origens: [...o] }));
  return { soma, juncao: { naoCasou, colisoes, aproximados: [...aprox.values()] } };
}

const somar = (itens) => itens.reduce((t, i) => ({ views: t.views + i.views, compras: t.compras + i.compras }), { views: 0, compras: 0 });

// Controle de confusão por Cochran-Mantel-Haenszel nos estratos que os dois grupos compartilham
// (`dim` = dimensão controlada: "estilo" ao comparar raças, "raça" ao comparar estilos):
// - sem estrato compartilhado: grupo e dimensão são inseparáveis nesse dado (nada a controlar);
// - o total só fica afirmado se o efeito ajustado for significativo E no MESMO sentido do total:
//   ajustado não significativo = o estrato explica o total (inversão de Simpson); ajustado significativo
//   em sentido oposto = não comprovado após o ajuste. Estrato isolado sem poder NÃO é confusão.
function ajustarPorEstilo(dentro, total, dim) {
  const inseparavel = { confundida: false, inseparavel: true, pAjustado: null, motivo: null, dim };
  if (dentro.length === 0) return inseparavel;
  let dif = 0, variancia = 0;
  for (const c of dentro) {
    const nA = c.viewsA, nB = c.viewsB, n = nA + nB, m1 = c.comprasA + c.comprasB;
    if (n < 2) continue;
    dif += c.comprasA - (nA * m1) / n; // > 0: A converte mais que B dentro dos estratos
    variancia += (nA * nB * m1 * (n - m1)) / (n * n * (n - 1));
  }
  if (variancia <= 0) return inseparavel;
  const pAjustado = Math.min(1, erfc(Math.abs(dif) / Math.sqrt(variancia) / Math.SQRT2));
  const oposto = Math.sign(dif) !== Math.sign(total.taxaA - total.taxaB);
  const motivo = pAjustado >= ALFA ? 'estrato-explica-total' : oposto ? 'efeito-oposto' : null;
  return { confundida: motivo !== null, inseparavel: false, pAjustado, motivo, dim };
}

function analisar(e, parametros) {
  const { soma, juncao } = juntar(e, parametros);
  const linhas = e.catalogo.map((c) => ({ ...c, ...soma.get(c.estampa) }));
  const racas = [...new Set(linhas.map((l) => l.raca))].sort();
  const estilos = [...new Set(linhas.map((l) => l.estilo))].sort();
  const comparacoes = [];
  const pares = (xs, fn) => { for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) fn(xs[i], xs[j]); };
  const grupo = (f) => somar(linhas.filter(f));
  const empurra = (c) => { if (c) comparacoes.push(c); return c; };
  pares(racas, (a, b) => {
    const t = empurra(comparar('total', a, b, grupo((l) => l.raca === a), grupo((l) => l.raca === b)));
    const dentro = estilos.map((s) => empurra(comparar(`estilo:${s}`, a, b, grupo((l) => l.raca === a && l.estilo === s), grupo((l) => l.raca === b && l.estilo === s)))).filter(Boolean);
    if (t && t.rotulo === 'comprovado') Object.assign(t, ajustarPorEstilo(dentro, t, 'estilo'));
  });
  pares(estilos, (a, b) => {
    const t = empurra(comparar('estilos', a, b, grupo((l) => l.estilo === a), grupo((l) => l.estilo === b)));
    const dentro = racas.map((r) => comparar(`raca:${r}`, a, b, grupo((l) => l.estilo === a && l.raca === r), grupo((l) => l.estilo === b && l.raca === r))).filter(Boolean);
    if (t && t.rotulo === 'comprovado') Object.assign(t, ajustarPorEstilo(dentro, t, 'raça')); // simétrico: estilo controlado por raça
  });

  const totImp = linhas.reduce((t, l) => t + l.impressoes, 0);
  const tot = somar(linhas);
  const media = tot.views > 0 ? tot.compras / tot.views : 0;
  const vitrine = linhas.map((l) => {
    const fatia = totImp > 0 ? l.impressoes / totImp : 0;
    const taxaCompra = l.views > 0 ? l.compras / l.views : null;
    const razao = taxaCompra !== null && taxaCompra <= 1 && media > 0 ? taxaCompra / media : null;
    let sinal = '';
    if (razao !== null && l.views >= parametros.minViewsSinal) {
      if (fatia >= parametros.fatiaAlta && razao <= parametros.razaoConversaoBaixa) sinal = 'fatia-alta-conversao-baixa';
      else if (fatia <= parametros.fatiaBaixa && razao >= parametros.razaoConversaoAlta) sinal = 'fatia-baixa-conversao-alta';
    }
    const candidato = sinal === 'fatia-alta-conversao-baixa' ? 'rever'
      : sinal === 'fatia-baixa-conversao-alta' ? 'investir'
      : razao !== null && l.views >= parametros.minViewsSinal && razao >= parametros.razaoConversaoAlta ? 'produzir' : '';
    // ação só com evidência: estampa vs resto, p < 0,05 COM poder (mesma regra do rótulo "comprovado")
    const teste = taxaCompra !== null && taxaCompra <= 1 ? comparar('estampa', l.estampa, 'resto', { views: l.views, compras: l.compras }, { views: tot.views - l.views, compras: tot.compras - l.compras }) : null;
    const evidencia = teste ? teste.rotulo : null;
    const bloco = evidencia === 'comprovado' ? candidato : '';
    return { estampa: l.estampa, raca: l.raca, estilo: l.estilo, impressoes: l.impressoes, cliques: l.cliques, views: l.views, compras: l.compras, fatia, taxaCompra, sinal, bloco, candidato, evidencia, pEvidencia: teste ? teste.p : null };
  });
  return { comparacoes, juncao, vitrine, media };
}

// Sugestão de conjunto (Fase 1: SÓ sugestão; nada é criado). Casa o nome do conjunto com o catálogo pela
// mesma `norm` da junção, igualdade exata. "Com evidência" = as estampas dos blocos Produzir e Investir.
const AVISO_CONJUNTO = 'Isto é só sugestão: a skill não cria nada. Antes de criar, avalie usar um conjunto existente compatível; cada conjunto novo reinicia o aprendizado da plataforma e divide a verba.';
function sugerirConjunto(e, vitrine) {
  const informado = Array.isArray(e.conjuntos);
  const doCatalogo = new Set(e.catalogo.map((c) => norm(c.estampa)));
  const cobertura = new Map(); // norm(estampa) -> [{ conjunto, status }]
  const fora = new Map(); // norm -> nome cru
  for (const c of e.conjuntos ?? []) {
    for (const nome of c.estampas) {
      const n = norm(nome);
      if (!doCatalogo.has(n)) { if (!fora.has(n)) fora.set(n, nome); continue; }
      if (!cobertura.has(n)) cobertura.set(n, []);
      const lista = cobertura.get(n);
      if (!lista.some((x) => x.conjunto === c.conjunto)) lista.push({ conjunto: c.conjunto, status: c.status ?? '' });
    }
  }
  const comEvidencia = vitrine.filter((v) => v.bloco === 'produzir' || v.bloco === 'investir');
  const reusar = [], candidatas = [];
  for (const v of comEvidencia) {
    const conj = cobertura.get(norm(v.estampa));
    if (conj) reusar.push({ estampa: v.estampa, conjuntos: conj }); else candidatas.push(v.estampa);
  }
  return { checou_conta: informado, reusar, candidatas_novo: candidatas, fora_do_catalogo: [...fora.values()], aviso: AVISO_CONJUNTO, temEvidencia: comEvidencia.length > 0 };
}

function secaoConjunto(sc) {
  const out = ['## Sugestão de conjunto', ''];
  if (!sc.temEvidencia) out.push('Nenhuma estampa tem evidência estatística para conjunto próprio. Não criar conjunto agora.');
  else if (!sc.checou_conta) {
    out.push('Não foi informada a lista de conjuntos existentes: não dá para checar se algum já serve. Confira na conta antes de criar qualquer um.', '',
      `- Com evidência: candidatas a conjunto próprio: ${sc.candidatas_novo.map(linha1).join(', ')}`);
  } else {
    for (const r of sc.reusar) out.push(`- ${linha1(r.estampa)}: reusar: ${r.conjuntos.map((c) => `${linha1(c.conjunto)}${c.status ? ` (${linha1(c.status)})` : ''}`).join(', ')}`);
    if (sc.candidatas_novo.length) out.push(`- Sem conjunto existente que cubra: candidatas a um conjunto novo: ${sc.candidatas_novo.map(linha1).join(', ')}`);
  }
  if (sc.checou_conta) out.push('', `- Lista de estampas de conjunto fora do catálogo: ${sc.fora_do_catalogo.length ? sc.fora_do_catalogo.map(linha1).join(', ') : 'nenhuma'}`);
  out.push('', sc.aviso, '');
  return out;
}

// ── saída ────────────────────────────────────────────────────────────────────
const fx = (x, d = 2) => x.toFixed(d).replace('.', ',');
const pct = (x) => `${fx(x * 100)}%`;
const fp = (p) => (p < 0.001 ? p.toExponential(2).replace('.', ',') : fx(p, 4));
const linha1 = (v) => String(v ?? '').replace(/[\r\n\u2028\u2029]+/g, ' '); // nome ecoado no md nunca abre linha/seção nova
const csvCel = (v) => { // células = + - @ viram texto (apóstrofo); CR/LF/aspas/vírgula aspeiam
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function linhaComparacao(c) {
  const rot = c.escopo === 'total' ? 'Total' : c.escopo === 'estilos' ? 'Entre estilos' : `Dentro do estilo ${linha1(c.escopo.slice(7))}`;
  const n = c.nMinimo === null ? '' : `, n mínimo ${Math.ceil(c.nMinimo)} por grupo (menor grupo: ${Math.min(c.viewsA, c.viewsB)})`;
  return `- ${rot}: ${linha1(c.a)} ${pct(c.taxaA)} (${c.comprasA}/${c.viewsA}) vs ${linha1(c.b)} ${pct(c.taxaB)} (${c.comprasB}/${c.viewsB}); z=${fx(c.z)}, p=${fp(c.p)}${n}`;
}

const motivoConfusao = (c) => {
  if (c.inseparavel) return `não separável ${c.dim === 'raça' ? 'da raça' : 'do estilo'} (os dois grupos não compartilham ${c.dim === 'raça' ? 'raça' : 'estilo'} no catálogo)`;
  if (c.motivo === 'estrato-explica-total') return `inversão (paradoxo de Simpson): ${c.dim === 'raça' ? 'a raça' : 'o estilo'} explica o total (p ajustado ${fp(c.pAjustado)})`;
  return `não comprovado após ajuste por ${c.dim} (efeito ajustado em sentido oposto ao total, p ajustado ${fp(c.pAjustado)})`;
};

function relatorio(e, r, parametros) {
  const ressalva = (c) => c.confundida || c.inseparavel;
  const afirmado = r.comparacoes.filter((c) => c.rotulo === 'comprovado' && !ressalva(c));
  const nao = r.comparacoes.filter((c) => c.rotulo !== 'comprovado' || ressalva(c));
  const bloco = (nome, criterio) => {
    const itens = r.vitrine.filter((v) => v.bloco === nome);
    return [criterio, '', ...(itens.length ? itens.map((v) => `- ${linha1(v.estampa)} (${linha1(v.raca)}, ${linha1(v.estilo)}): conversão ${pct(v.taxaCompra)} (média ${pct(r.media)}), fatia de impressões ${pct(v.fatia)}`) : ['- Nenhuma estampa com evidência.']), ''];
  };
  const obs = r.vitrine.filter((v) => v.candidato && !v.bloco);
  const out = [
    `# Análise de produto ${linha1(e.periodo)}`, '',
    `Estampas do catálogo: ${e.catalogo.length}. Compras da casa retiradas das vendas do ERP: ${e.casa_excluida} unidades. O GA4 não separa família: as taxas de compra abaixo (GA4) podem incluir compras da casa.`, '',
    '> Aviso: o canal "sem anúncio" do GA4 vem contaminado pela família (pedidos de casa e conhecidos entram como tráfego sem anúncio). Leia esse canal como piso de contaminação, nunca como demanda orgânica pura.', '',
    '## Leitura estatística: afirmado (p < 0,05)', '',
    ...(afirmado.length ? afirmado.map(linhaComparacao) : ['- Nenhuma diferença atingiu p < 0,05 com amostra suficiente.']), '',
    '## Leitura estatística: não comprovado', '',
    ...(nao.length ? nao.map((c) => linhaComparacao(c) + ` => ${ressalva(c) ? motivoConfusao(c) : c.rotulo}`) : ['- Nada nesta categoria.']), '',
    '## Produzir', ...bloco('produzir', `Só entra com p < 0,05 e poder (estampa contra o resto); conversão >= ${parametros.razaoConversaoAlta}x a média com pelo menos ${parametros.minViewsSinal} views, sem sinal de vitrine.`),
    '## Investir', ...bloco('investir', `Só entra com p < 0,05 e poder; fatia de impressões <= ${pct(parametros.fatiaBaixa)} e conversão >= ${parametros.razaoConversaoAlta}x a média: converte e quase não aparece.`),
    '## Rever', ...bloco('rever', `Só entra com p < 0,05 e poder; fatia de impressões >= ${pct(parametros.fatiaAlta)} e conversão <= ${parametros.razaoConversaoBaixa}x a média: ocupa a vitrine e converte pouco.`),
    '## Observações (não comprovado)', '',
    'Passaram o corte de conversão ou vitrine, mas sem p < 0,05 com poder contra o resto. Leitura apenas, sem recomendação.', '',
    ...(obs.length ? obs.map((v) => `- ${linha1(v.estampa)} (${linha1(v.raca)}, ${linha1(v.estilo)}): conversão ${pct(v.taxaCompra)} (média ${pct(r.media)}), fatia de impressões ${pct(v.fatia)}; evidência: ${v.evidencia ?? 'sem teste'}${v.pEvidencia === null ? '' : `, p=${fp(v.pEvidencia)}`}`) : ['- Nenhuma observação.']), '',
    ...secaoConjunto(r.sugestao),
    '## Qualidade da junção de nomes', '',
    `- Colisões (grafias distintas no mesmo alvo): ${r.juncao.colisoes.length ? '' : 'nenhuma'}`,
    ...r.juncao.colisoes.map((c) => `  - colisão em "${linha1(c.alvo)}": ${c.origens.map(linha1).join(' + ')}; confira se são variantes (v1/v2) que deveriam ser somadas ou estampas diferentes`),
    `- Casamentos aproximados (nem exatos nem por exceção; somados no alvo, confira): ${r.juncao.aproximados.length ? '' : 'nenhum'}`,
    ...r.juncao.aproximados.map((a) => `  - "${linha1(a.de)}" => "${linha1(a.para)}" (jaccard ${fx(a.jaccard)})`),
    `- Não casaram com o catálogo: ${r.juncao.naoCasou.length ? '' : 'nenhuma'}`,
    ...r.juncao.naoCasou.map((n) => `  - ${linha1(n.estampa)} (fonte ${n.fonte})`), '',
  ];
  return out.join('\n');
}

function csv(r) {
  const f6 = (x) => (x === null ? '' : x.toFixed(6));
  return [CSV_CABECALHO, ...r.vitrine.map((v) => [v.estampa, v.raca, v.estilo, v.impressoes, v.cliques, v.views, v.compras, f6(v.taxaCompra), f6(v.fatia), v.sinal, v.bloco].map(csvCel).join(','))].join('\n') + '\n';
}

function principal() {
  const { e, saida } = lerEntrada(process.argv.slice(2));
  const parametros = validar(e);
  const r = analisar(e, parametros);
  r.sugestao = sugerirConjunto(e, r.vitrine);
  const md = relatorio(e, r, parametros), tabela = csv(r);
  const json = {
    parametros,
    comparacoes: r.comparacoes,
    juncao: r.juncao,
    aproximados: r.juncao.aproximados,
    vitrine: r.vitrine.map(({ estampa, fatia, taxaCompra, sinal, bloco, evidencia }) => ({ estampa, fatia, taxaCompra, sinal, bloco, evidencia })),
    sugestao_conjunto: (({ temEvidencia, ...resto }) => resto)(r.sugestao),
  };
  // nada com PII (nem eco de nome de estampa/raça/estilo/período) chega ao disco ou ao stdout
  recusarPIISaida([['analise-produto.md', md], ['analise-produto.csv', tabela], ...[...strings(json)].map(([c, v]) => [`stdout (${c})`, v])]);
  mkdirSync(saida, { recursive: true });
  for (const [nome, conteudo] of [['analise-produto.md', md], ['analise-produto.csv', tabela]]) {
    const alvo = join(saida, nome);
    if (existsSync(alvo)) process.stderr.write(`analisar-produto: sobrescrevendo ${alvo}\n`);
    writeFileSync(alvo, conteudo);
  }
  process.stdout.write(JSON.stringify(json) + '\n');
}

try { principal(); } catch (err) { falhar(`erro inesperado (${err?.name ?? 'Error'}); verifique o formato da entrada em references/contrato.md`); }
