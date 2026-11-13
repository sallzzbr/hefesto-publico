// Teste COMPORTAMENTAL do harness do criativo-fluxo — o script roda de verdade, com agentes
// SIMULADOS: comandos dos prompts, arquivos alegados, imagens e APIs não são executados.
// Molde: plugins/odin/tests/harness-dev-loop.test.mjs. O `test_harness_contracts.py`
// trava marcadores; aqui cada fix da revisão 1.0.1 é visto rodando.

import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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

const nomesT = Array.from({ length: 13 }, (_, i) => `t${i}`);
const MANIFESTO = { scripts: [
  { nome: 'compor_x', executavel: 'compor_x.py',
    campos: {
      base: { flag: '--base' }, saida: { flag: '--saida' }, formato: { flag: '--formato' },
      textos: { titulo: { flag: '--titulo' }, ...Object.fromEntries(nomesT.map((n) => [n, { flag: `--${n}` }])) },
      opcoes: { fonte: { flag: '--fonte' }, peso: { flag: '--peso' } },
    },
    sobrescrever: '--sobrescrever', logRender: 'logs/render.jsonl' },
  { nome: 'compor_pos', executavel: 'compor_pos.py',
    campos: { saida: { posicao: 0 }, formato: { flag: '--formato' }, textos: { titulo: { flag: '--titulo' } }, opcoes: { fonte: { flag: '--fonte' } } },
    sobrescrever: '--sobrescrever', logRender: 'logs/render.jsonl' },
] };
const SAIDA = 'marketing/criativos/renders/segmento/slug1.png';
const COMPOR = { op: 'compor', compositor: 'compor_x', base: '{{BASE}}', saida: SAIDA, textos: { titulo: 'Oferta de verão' }, formato: 'feed', opcoes: { fonte: 'Inter' }, sobrescrever: false };
const GERAR = { op: 'gerar', prompt: 'foto realista', saida: 'marketing/criativos/base/slug1__rota1_rough.png' };
const COMPOR_TEXTO = { op: 'compor', compositor: 'compor_x', saida: SAIDA, textos: { titulo: 'Oferta' }, formato: 'feed', opcoes: {}, sobrescrever: false };
const ACOES_V2 = [{ ...COMPOR, opcoes: { fonte: 'v2' } }];
const ACOES_V2_TEXTO = [{ ...COMPOR_TEXTO, opcoes: { fonte: 'v2' } }];
const ROTA = { n: 1, nome: 'cena', arquetipo: 'foto', slug: 'slug1', segmento: 'segmento', formato: 'feed', promptIa: 'foto realista', acoes: [COMPOR], textoEsperado: 'Oferta', copy: 'headline', baselinePath: null, mockupPath: null, briefPath: 'brief.md', briefResumo: 'resumo' };
const ROTA_TEXTO = { ...ROTA, arquetipo: 'texto', promptIa: null, acoes: [COMPOR_TEXTO] };
const DEFAULTS = {
  'rotas:dirigir': () => ({ ok: true, slug: 'slug1', artefatoPath: 'rotas.md', rotas: [{ n: 1, nome: 'a', arquetipo: 'foto', segmento: 'segmento', acoes: [GERAR, COMPOR] }, { n: 2, nome: 'b', arquetipo: 'texto', segmento: 'segmento', acoes: [{ ...GERAR, saida: 'marketing/criativos/base/slug1__rota2_rough.png' }, COMPOR_TEXTO] }] }),
  'rough:': (opts) => ({ ok: true, artefatos: [`${opts.label}.png`], falhas: [] }),
  'portao:validar': () => ({ ok: true, aprovada: true, renderJaExiste: false, reproduzir: false, roughExiste: true, manifesto: MANIFESTO, rota: ROTA }),
  'producao:': () => ({ ok: true, candidatos: ['cand1.png', 'cand2.png'], falhas: [] }),
  'selecao:': () => ({ escolhido: 'cand2.png', ranking: [] }),
  'composicao:': () => ({ ok: true, artefatos: [SAIDA], falhas: [] }),
  'preflight:': () => ({ ok: true, artefatos: [SAIDA], falhas: [], checks: [{ nome: 'texto_fiel', status: 'pass' }] }),
  'crit:': () => ({ findings: [] }),
  'confirmar:': () => ({ real: true, porque: 'a evidência da região confirma o defeito apontado' }),
  'promessa:': () => ({ promessaFalsa: false, porque: 'o catálogo em contexto/ oferece o que a headline diz; a crítica é só de ideia' }),
  'correcao:': () => ({ resumo: 'nada', promptIa: null, copyCorrigida: null }),
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
    return fn(opts, chamadas, prompt);
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

test('rotas: nenhum rough gerado interrompe — sem reconciliação não há escolha visual', async () => {
  const { resultado } = await rodar({ args: ROTAS, overrides: { 'rough:': () => ({ ok: false, artefatos: [], falhas: [{ comando: 'x', resumo: 'API caiu' }] }) } });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.requerReconciliacao, true);
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
  const r1 = await rodar({ args: PRODUZIR, overrides: { 'portao:validar': () => ({ ...DEFAULTS['portao:validar'](), rota: { ...ROTA, acoes: [{ ...COMPOR, base: 'base.png' }] } }) } });
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
  assert.ok(composicao.includes('--base cand2.png'), 'o candidato selecionado substitui {{BASE}}');
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
  for (const { resultado, chamadas } of [r1, r2, r3]) {
    assert.equal(resultado.status, 'erro');
    assert.equal(labels(chamadas, 'crit:').length, 0);
    assert.equal(labels(chamadas, 'correcao:').length, 0);
    assert.equal(labels(chamadas, 'pacote:').length, 0);
  }
});

// Fixtures do pre-flight: o controlador é real; o retorno do mecânico é SIMULADO.
const FALHA_SCRIPT = {
  comando: 'fixture-python fixture-validar.py out.png --arquetipo produto-isolado',
  criterio: 'script',
  resumo: "argument --arquetipo: invalid choice: 'produto-isolado' (choose from texto, fototexto, produtotexto)",
};
const FALHA_VISUAL = { comando: 'fixture-validar.py out.png', criterio: 'dimensao', resumo: 'dimensão diferente do formato' };

for (const [caso, preflight] of [
  ['flag inválida', { ok: false, artefatos: ['out.png'], falhas: [FALHA_SCRIPT] }],
  ['ok=true contraditório', { ok: true, artefatos: ['out.png'], falhas: [FALHA_SCRIPT] }],
  ['check visual misturado com erro operacional', { ok: false, artefatos: ['out.png'], falhas: [FALHA_VISUAL, FALHA_SCRIPT] }],
  ['erro operacional sem artefato', { ok: false, artefatos: [], falhas: [FALHA_SCRIPT] }],
]) {
  test(`produzir: pre-flight com ${caso} encerra erro e preserva evidência antes da crítica`, async () => {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: { 'preflight:': () => structuredClone(preflight) } });
    assert.equal(resultado.status, 'erro');
    assert.equal(resultado.fase, 'Produzir');
    assert.equal(resultado.iteracao, 1);
    assert.deepEqual(resultado.preflight, preflight);
    assert.equal(labels(chamadas, 'preflight:').length, 1);
    assert.equal(chamadas.at(-1).label, 'preflight:i1', 'nenhum agente deve ser chamado após a falha operacional');
    for (const prefixo of ['crit:', 'confirmar:', 'correcao:', 'pacote:']) {
      assert.equal(labels(chamadas, prefixo).length, 0, `${prefixo} não deve tratar erro de script`);
    }
  });
}

test('produzir: falha visual de pre-flight segue para crítica e correção sem receber verde', async () => {
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    'preflight:': () => ({ ok: false, artefatos: ['out.png'], falhas: [FALHA_VISUAL] }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(labels(chamadas, 'crit:').length, 1);
  assert.equal(labels(chamadas, 'correcao:').length, 1);
  assert.ok(labels(chamadas, 'correcao:')[0].prompt.includes(JSON.stringify([FALHA_VISUAL])));
  assert.equal(labels(chamadas, 'pacote:').length, 1);
});

for (const [caso, segundoPreflight, status] of [
  ['corrigido fecha verde', { ok: true, artefatos: ['out.png'], falhas: [], checks: [{ nome: 'texto_fiel', status: 'pass' }] }, 'verde'],
  ['com erro de script encerra antes de nova crítica', { ok: false, artefatos: ['out.png'], falhas: [FALHA_SCRIPT] }, 'erro'],
]) {
  test(`produzir: check visual permite recomposição e o pre-flight seguinte ${caso}`, async () => {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      'preflight:': (opts) => opts.label === 'preflight:i1'
        ? { ok: false, artefatos: ['out.png'], falhas: [FALHA_VISUAL] }
        : structuredClone(segundoPreflight),
      'correcao:': () => ({ resumo: 'recompõe dimensão', acoes: ACOES_V2, promptIa: null, copyCorrigida: null }),
    } });
    assert.equal(resultado.status, status);
    assert.deepEqual(resultado.preflight, segundoPreflight);
    assert.equal(labels(chamadas, 'preflight:').length, 2);
    assert.equal(labels(chamadas, 'composicao:').length, 2);
    assert.equal(labels(chamadas, 'correcao:').length, 1);
    assert.equal(labels(chamadas, 'producao:').length, 1, 'overlay reutiliza a imagem-base');
    if (status === 'erro') {
      assert.equal(resultado.iteracao, 2);
      assert.equal(chamadas.at(-1).label, 'preflight:i2');
      assert.equal(labels(chamadas, 'crit:').length, 1);
      assert.equal(labels(chamadas, 'pacote:').length, 0);
    } else {
      assert.equal(resultado.iteracoes, 2);
      assert.equal(labels(chamadas, 'crit:').length, 2);
      assert.equal(labels(chamadas, 'pacote:').length, 1);
    }
  });
}

test('produzir: finding plausível passa pelo confirmador; refutado não vira retrabalho', async () => {
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    'crit:': () => ({ findings: [{ criterio: 'texto_correto', resumo: 'erro de concordância', evidencia: 'e', cenario: 'c', severidade: 'bloqueante', confianca: 'plausivel', custoCorrecao: 'overlay' }] }),
    'confirmar:': () => ({ real: false, porque: 'a região foi relida e o texto está correto' }),
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
    'correcao:': () => ({ resumo: 'recompõe', acoes: ACOES_V2_TEXTO, promptIa: null, copyCorrigida: null }),
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

// HH-03: o controlador real despacha um executor técnico que grava recibo no disco
// ANTES de perder a resposta. O recibo é efeito local; não há modelo, API ou imagem.
for (const estagio of ['rough', 'producao']) {
  for (const retorno of ['null', 'excecao']) {
    test(`${estagio}: efeito com ${retorno} não dispara fallback e exige reconciliação`, async t => {
      const dir = mkdtempSync(join(tmpdir(), 'hermes-efeito-incerto-'));
      t.after(() => rmSync(dir, { recursive: true, force: true }));
      const recibo = join(dir, 'recibos.jsonl');
      const chave = estagio === 'rough' ? 'rough:' : 'producao:';
      const chamada = estagio === 'rough' ? 'rough:rota1' : 'producao:i1';
      const { resultado, chamadas } = await rodar({
        args: estagio === 'rough' ? ROTAS : { ...PRODUZIR, tiering: { modelos: { producao: 'opus' } } },
        overrides: { [chave]: (opts) => {
          if (opts.label !== chamada) return DEFAULTS[chave](opts);
          appendFileSync(recibo, JSON.stringify({ chamada: opts.label, efeito: 'fixture-local' }) + '\n');
          if (retorno === 'excecao') throw new Error('fixture: resposta perdida depois do efeito');
          return null;
        } },
      });
      assert.equal(readFileSync(recibo, 'utf8').trim().split('\n').length, 1, 'a perda de resposta não autoriza repetir um efeito');
      assert.equal(resultado.status, 'erro');
      assert.equal(resultado.requerReconciliacao, true);
      assert.match(resultado.acao, /reconciliar/i);
      assert.equal(chamadas.filter(c => c.label === chamada).length, 1);
      assert.equal(labels(chamadas, 'selecao:').length, 0);
      assert.equal(labels(chamadas, 'composicao:').length, 0);
      assert.equal(labels(chamadas, 'pacote:').length, 0);
      if (estagio === 'rough') {
        assert.equal(resultado.parcial.geracoes[0].chamada, 'rough:rota1');
        assert.ok(resultado.parcial.geracoes[0].comando.includes('gerar_imagem.py'), 'o comando é montado em código a partir da ação gerar');
        assert.equal(resultado.parcial.geracoes[0].resultado, null);
        assert.deepEqual(resultado.parcial.geracoes[1].resultado.artefatos, ['rough:rota2.png']);
      } else {
        assert.equal(resultado.parcial.geracao.chamada, 'producao:i1');
        assert.equal(resultado.parcial.geracao.resultado, null);
        assert.equal(resultado.parcial.rodadasIa, 1);
      }
    });
  }
}

for (const estagio of ['rough', 'producao']) {
  test(`${estagio}: falha declarada preserva saídas parciais e interrompe antes da seleção`, async () => {
    const falhas = [{ comando: 'fixture-gerar saida.png', resumo: 'resultado incerto após timeout' }];
    const parcial = estagio === 'rough'
      ? { ok: true, artefatos: ['rough-parcial.png'], falhas }
      : { ok: true, candidatos: ['candidato-parcial.png'], falhas };
    const { resultado, chamadas } = await rodar({
      args: estagio === 'rough' ? ROTAS : PRODUZIR,
      overrides: { [estagio === 'rough' ? 'rough:' : 'producao:']: () => parcial },
    });
    assert.equal(resultado.status, 'erro');
    assert.equal(resultado.requerReconciliacao, true);
    assert.deepEqual(estagio === 'rough' ? resultado.parcial.geracoes[0].resultado : resultado.parcial.geracao.resultado, parcial);
    assert.equal(labels(chamadas, 'selecao:').length, 0);
    assert.equal(labels(chamadas, 'composicao:').length, 0);
  });

  test(`${estagio}: falha conhecida sem efeito também não autoriza tentativa extra`, async () => {
    const parcial = estagio === 'rough'
      ? { ok: false, artefatos: [], falhas: [{ comando: 'fixture', resumo: 'executável ausente; nenhum processo iniciado' }] }
      : { ok: false, candidatos: [], falhas: [{ comando: 'fixture', resumo: 'executável ausente; nenhum processo iniciado' }] };
    const { resultado, chamadas } = await rodar({ args: estagio === 'rough' ? ROTAS : PRODUZIR, overrides: { [estagio === 'rough' ? 'rough:' : 'producao:']: () => parcial } });
    assert.equal(resultado.status, 'erro');
    assert.equal(resultado.requerReconciliacao, true);
    assert.equal(labels(chamadas, estagio === 'rough' ? 'rough:' : 'producao:').length, estagio === 'rough' ? 2 : 1);
  });

  test(`${estagio}: instrução emitida limita cada comando a uma tentativa, inclusive falha`, async () => {
    const { chamadas } = await rodar({ args: estagio === 'rough' ? ROTAS : PRODUZIR });
    for (const chamada of labels(chamadas, estagio === 'rough' ? 'rough:' : 'producao:')) {
      assert.doesNotMatch(chamada.prompt, /segunda vez|falhar 2x/);
      assert.match(chamada.prompt, /não repita/i);
      assert.match(chamada.prompt, /reconcili/i);
    }
  });
}

test('preflight: indisponibilidade mantém fallback seguro sem repetir produção de imagem', async () => {
  let primeira = true;
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    'preflight:': () => primeira ? (primeira = false, null) : DEFAULTS['preflight:'](),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(labels(chamadas, 'preflight:').length, 2);
  assert.equal(labels(chamadas, 'producao:').length, 1);
  assert.ok(resultado.fallbacks.some(f => f.step === 'preflight'));
});

// ── hermes 1.4.0 (A1-A4): semGeracao, flagSobrescrever, reproduzir/headline, headlineTravada ──
// Comportamento via agente falso por label; marcador de schema só onde o contrato é o schema.

const bloco = (nome) => {
  const m = FONTE.match(new RegExp(`const ${nome} = [\\s\\S]*?\\n\\n`));
  assert.ok(m, `${nome} não encontrado no harness`);
  return m[0];
};
const ROTA_PRODUTO = { ...ROTA, arquetipo: 'produtotexto', promptIa: null, acoes: [COMPOR_TEXTO], semGeracao: true };
const portaoCom = (rota, extra = {}) => ({ 'portao:validar': () => ({ ...DEFAULTS['portao:validar'](), rota, ...extra }) });
const FINDING_BASE = { evidencia: 'e', cenario: 'c', severidade: 'bloqueante', confianca: 'confirmado' };

test('A1: produtotexto com semGeracao:true chega a verde sem producao e o pre-flight recebe --arquetipo produtotexto', async () => {
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: portaoCom(ROTA_PRODUTO) });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.rodadasIa, 0);
  assert.equal(labels(chamadas, 'producao:').length, 0);
  assert.equal(labels(chamadas, 'selecao:').length, 0);
  assert.ok(labels(chamadas, 'preflight:')[0].prompt.includes('--arquetipo produtotexto'));
});

test('A1: rota não-texto sem semGeracao e sem {{BASE}} continua bloqueada', async () => {
  const { semGeracao, ...semFlag } = ROTA_PRODUTO;
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: portaoCom(semFlag) });
  assert.equal(resultado.status, 'bloqueado');
  assert.match(resultado.detalhe, /\{\{BASE\}\}/);
  assert.equal(labels(chamadas, 'producao:').length, 0);
});

test('A1: schema de rota do diretor e o do portão aceitam semGeracao', () => {
  assert.match(bloco('ROTAS_SCHEMA'), /semGeracao/);
  assert.match(bloco('PORTAO_SCHEMA'), /semGeracao/);
});

test('A2: sobrescrever do compositor só entra na composição da iteração >= 2, uma única vez', async () => {
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom(ROTA_TEXTO),
    'crit:': () => (vez++ === 0 ? { findings: [{ ...FINDING_BASE, criterio: 'legibilidade_thumbnail', resumo: 'ilegível', custoCorrecao: 'overlay' }] } : { findings: [] }),
    'correcao:': () => ({ resumo: 'recompõe', acoes: ACOES_V2_TEXTO, promptIa: null, copyCorrigida: null }),
  } });
  assert.equal(resultado.status, 'verde');
  const comps = labels(chamadas, 'composicao:');
  assert.equal(comps.length, 2);
  assert.ok(!comps[0].prompt.includes('--sobrescrever'), 'iteração 1 roda o comando como está');
  assert.equal(comps[1].prompt.split('--sobrescrever').length - 1, 1, 'iteração 2 leva a flag uma única vez');
  assert.ok(comps[1].prompt.includes('--fonte v2'), 'a correção troca a opção na ação compor');
});

const RENDER_EXISTE = { renderJaExiste: true, reproduzir: false };

test('A3: args.reproduzir:true libera render existente; sem ele segue bloqueando', async () => {
  const com = await rodar({ args: { ...PRODUZIR, reproduzir: true }, overrides: portaoCom(ROTA, RENDER_EXISTE) });
  assert.equal(com.resultado.status, 'verde');
  const sem = await rodar({ args: PRODUZIR, overrides: portaoCom(ROTA, RENDER_EXISTE) });
  assert.equal(sem.resultado.status, 'bloqueado');
  assert.match(sem.resultado.detalhe, /reproduzir/);
});

test('A3: args.headline substitui a copy do run (crit, pacote e resultado)', async () => {
  const rota = { ...ROTA, copy: 'copy-original-xyz' };
  const { resultado, chamadas } = await rodar({ args: { ...PRODUZIR, headline: 'headline-nova-abc' }, overrides: portaoCom(rota) });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.copy, 'headline-nova-abc');
  assert.ok(labels(chamadas, 'crit:')[0].prompt.includes('headline-nova-abc'));
  assert.ok(!labels(chamadas, 'crit:')[0].prompt.includes('copy-original-xyz'));
  assert.ok(labels(chamadas, 'pacote:')[0].prompt.includes('headline-nova-abc'));
});

test('A3: sem args.headline a copy da rota é mantida', async () => {
  const rota = { ...ROTA, copy: 'copy-original-xyz' };
  const { resultado } = await rodar({ args: PRODUZIR, overrides: portaoCom(rota) });
  assert.equal(resultado.copy, 'copy-original-xyz');
});

const F_HEADLINE = { ...FINDING_BASE, criterio: 'voz_da_marca', resumo: 'headline-fraca-marcador', alvo: 'headline', custoCorrecao: 'copy' };

test('A4: finding alvo headline com headlineTravada na rota não bloqueia; vai a sinalizacoes (resultado e pacote)', async () => {
  const rota = { ...ROTA, copy: 'copy-travada', headlineTravada: true };
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom(rota),
    'crit:': () => ({ findings: [F_HEADLINE] }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.iteracoes, 1);
  assert.equal(labels(chamadas, 'correcao:').length, 0);
  assert.ok(Array.isArray(resultado.sinalizacoes) && resultado.sinalizacoes.length === 1);
  assert.ok(JSON.stringify(resultado.sinalizacoes).includes('headline-fraca-marcador'));
  assert.ok(labels(chamadas, 'pacote:')[0].prompt.includes('headline-fraca-marcador'));
});

test('A4: headlineTravada via args tem o mesmo efeito', async () => {
  const { resultado } = await rodar({ args: { ...PRODUZIR, headlineTravada: true }, overrides: { 'crit:': () => ({ findings: [F_HEADLINE] }) } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.sinalizacoes.length, 1);
});

test('A4: copyCorrigida devolvida com a trava é descartada com registro; copy final inalterada', async () => {
  const rota = { ...ROTA_TEXTO, copy: 'copy-travada', headlineTravada: true };
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom(rota),
    'crit:': () => (vez++ === 0
      ? { findings: [F_HEADLINE, { ...FINDING_BASE, criterio: 'legibilidade_thumbnail', resumo: 'ilegível', custoCorrecao: 'overlay' }] }
      : { findings: [] }),
    'correcao:': () => ({ resumo: 'recompõe', acoes: ACOES_V2_TEXTO, promptIa: null, copyCorrigida: 'copy-reescrita-proibida' }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.copy, 'copy-travada');
  assert.equal(resultado.copyFoiCorrigida, false);
  assert.ok(!labels(chamadas, 'pacote:')[0].prompt.includes('Copy final: copy-reescrita-proibida'));
  const registro = JSON.stringify(resultado) + labels(chamadas, 'pacote:')[0].prompt;
  assert.match(registro, /descartad/i);
});

test('A4: sem a trava, finding de headline bloqueia como hoje', async () => {
  const { resultado } = await rodar({ args: PRODUZIR, overrides: { 'crit:': () => ({ findings: [F_HEADLINE] }) } });
  assert.notEqual(resultado.status, 'verde');
  assert.ok(!resultado.sinalizacoes || resultado.sinalizacoes.length === 0);
});

test('A4: schema de finding aceita alvo e o portão aceita headlineTravada', () => {
  assert.match(bloco('CRIT_SCHEMA'), /alvo/);
  assert.match(bloco('PORTAO_SCHEMA'), /headlineTravada/);
});

// ── hermes 1.4.0 (correção pós-revisão da U1) ────────────────────────────────

// Item 1: args.headline troca SÓ o valor do rótulo Headline, ancorado, preservando o resto.
const copiaFinal = async (copy, headline = 'NOVA') => {
  const { resultado } = await rodar({ args: { ...PRODUZIR, headline }, overrides: portaoCom({ ...ROTA, copy }) });
  assert.equal(resultado.status, 'verde');
  return resultado.copy;
};

test('A3: args.headline em copy estruturada preserva body e descricao (4 formatos)', async () => {
  assert.equal(await copiaFinal('Headline: Velho. Body: corpo. Descricao: frete'), 'Headline: NOVA. Body: corpo. Descricao: frete');
  assert.equal(await copiaFinal('Headline: Velho / Body: corpo / Descricao: desc'), 'Headline: NOVA / Body: corpo / Descricao: desc');
  assert.equal(await copiaFinal('Headline: Velho | Body: corpo | Descrição: desc'), 'Headline: NOVA | Body: corpo | Descrição: desc');
  assert.equal(await copiaFinal('Headline: Velho\nBody: corpo\nCTA: Compre'), 'Headline: NOVA\nBody: corpo\nCTA: Compre');
});

test('A3: args.headline nunca troca a Subheadline e não deixa espaço sobrando', async () => {
  assert.equal(await copiaFinal('Subheadline: Sub | Headline: Velha | CTA: Compre'), 'Subheadline: Sub | Headline: NOVA | CTA: Compre');
  assert.equal(await copiaFinal('Subheadline: Sub\nHeadline: Velha\nBody: x'), 'Subheadline: Sub\nHeadline: NOVA\nBody: x');
  assert.equal(await copiaFinal('Headline: Velha   \nBody: x'), 'Headline: NOVA\nBody: x');
});

test('A3: args.headline em copy sem rótulo reconhecido substitui tudo; com rótulos mas sem Headline, antepõe', async () => {
  assert.equal(await copiaFinal('frase solta. Com ponto e / barra'), 'NOVA');
  assert.equal(await copiaFinal('Body: corpo | CTA: Compre'), 'Headline: NOVA | Body: corpo | CTA: Compre');
});

// Item 2: o descarte da copyCorrigida precisa deixar registro CONCRETO (não texto fixo do prompt).
const CRIT_OVERLAY = { ...FINDING_BASE, criterio: 'legibilidade_thumbnail', resumo: 'ilegível', custoCorrecao: 'overlay' };

test('A4: descarte da copyCorrigida registra a entrada concreta em sinalizacoes do resultado', async () => {
  const rota = { ...ROTA_TEXTO, copy: 'copy-travada', headlineTravada: true };
  let vez = 0;
  const { resultado } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom(rota),
    'crit:': () => (vez++ === 0 ? { findings: [CRIT_OVERLAY] } : { findings: [] }),
    'correcao:': () => ({ resumo: 'r', acoes: ACOES_V2_TEXTO, promptIa: null, copyCorrigida: 'copy-reescrita-proibida' }),
  } });
  const entrada = resultado.sinalizacoes.find((s) => s.tipo === 'copyCorrigida');
  assert.ok(entrada, 'sinalizacoes deve conter a entrada do descarte');
  assert.equal(entrada.descartada, 'copy-reescrita-proibida');
  assert.equal(entrada.iteracao, 1);
});

test('A4: descarte da copyCorrigida entra nos avisos da correção (visíveis no escalado)', async () => {
  const rota = { ...ROTA_TEXTO, copy: 'copy-travada', headlineTravada: true };
  const { resultado } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom(rota),
    'crit:': () => ({ findings: [CRIT_OVERLAY] }),
    'correcao:': () => ({ resumo: 'só copy', promptIa: null, copyCorrigida: 'copy-reescrita-proibida' }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.ok(resultado.detalhe.avisos.some((a) => /copyCorrigida descartada/.test(a)));
});

// Item 3: a trava protege a REDAÇÃO; defeito de render com alvo headline continua entrando no fluxo.
test('A4: com a trava, finding de render (overlay) com alvo headline segue bloqueante e corrigível', async () => {
  const rota = { ...ROTA_TEXTO, copy: 'copy-travada', headlineTravada: true };
  const F_RENDER = { ...FINDING_BASE, criterio: 'texto_correto', resumo: 'headline cortada no render', alvo: 'headline', custoCorrecao: 'overlay' };
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom(rota),
    'crit:': () => (vez++ === 0 ? { findings: [F_RENDER] } : { findings: [] }),
    'correcao:': () => ({ resumo: 'recompõe', acoes: ACOES_V2_TEXTO, promptIa: null, copyCorrigida: null }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.iteracoes, 2, 'o defeito de render forçou correção');
  assert.equal(labels(chamadas, 'correcao:').length, 1);
  assert.equal(resultado.sinalizacoes.length, 0);
});

test('A4: com a trava, finding de redação (criterio mensagem_completa) com alvo headline é só sinalizado', async () => {
  const rota = { ...ROTA, copy: 'copy-travada', headlineTravada: true };
  const { resultado } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom(rota),
    'crit:': () => ({ findings: [{ ...FINDING_BASE, criterio: 'mensagem_completa', resumo: 'msg-incompleta', alvo: 'headline', custoCorrecao: 'overlay' }] }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.sinalizacoes.length, 1);
});

// Reuso de render existente liberado: a flag de sobrescrever do manifesto entra já na iteração 1.
const REUSO = { renderJaExiste: true, reproduzir: true };
const tokensDe = (prompt, t) => prompt.split(/\s+/).filter((x) => x === t).length;

test('A2: no reuso (render existente liberado) a flag do manifesto entra já na iteração 1', async () => {
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: portaoCom(ROTA_TEXTO, REUSO) });
  assert.equal(resultado.status, 'verde');
  const comps = labels(chamadas, 'composicao:');
  assert.equal(comps.length, 1);
  assert.equal(tokensDe(comps[0].prompt, '--sobrescrever'), 1);
});

// Item 5: rota semGeracao fora do arquétipo texto não pode pedir gerar_imagem.py no rough.
test('A1: prompt do diretor diz que rota semGeracao não tem ação gerar', async () => {
  const { chamadas } = await rodar({ args: ROTAS });
  const prompt = labels(chamadas, 'rotas:dirigir')[0].prompt;
  assert.match(prompt, /semGeracao: true[^.]*não tem ação gerar/);
});

// Mesmo padrão do MIMYR-01 (revisão de 2026-11-01): perfil fora do enum caía no balanceado.
test('perfil desconhecido é erro de args antes de qualquer agente; acento é normalizado; ausente usa o default', async () => {
  for (const perfil of ['maximum', 'constructor', 7]) {
    const { resultado, chamadas } = await rodar({ args: { ...ROTAS, perfil } });
    assert.equal(resultado.status, 'erro', String(perfil));
    assert.equal(resultado.fase, 'Args');
    assert.equal(chamadas.length, 0);
  }
  for (const perfil of ['Máximo', undefined]) {
    const { resultado } = await rodar({ args: { ...ROTAS, perfil } });
    assert.notEqual(resultado.fase, 'Args', String(perfil));
  }
});

// ── hermes 1.5.2 (HERMES-1, decisão 14 do dono, 2026-11-03) ─────────────────
// K-Q são contrato executável: enum do CRIT_SCHEMA e prompt do crit, cada critério com o slug
// próprio. Com a headline travada, só verdade_comercial na headline continua bloqueando;
// confirmada, o run para como bloqueado, porque a copy não se reescreve no run. O caso real:
// "promete personalização que o catálogo não oferece" virava sinalização e o run fechava verde.
const CRITERIOS_A_J = ['arquetipo_correto', 'rosto_nao_coberto', 'principios_duros', 'fidelidade_referencia', 'fidelidade_mockup', 'naturalidade_ia', 'texto_correto', 'legibilidade_thumbnail', 'mensagem_completa', 'voz_da_marca'];
const CRITERIOS_K_Q = ['tres_segundos', 'miniatura', 'desfoque', 'exclusao', 'coerencia_imagem_copy', 'verdade_comercial', 'headline_tem_ideia'];
const ROTA_TRAVADA = { ...ROTA, copy: 'Headline: Produto personalizado com o seu nome', headlineTravada: true };
const F_PROMESSA = { ...FINDING_BASE, criterio: 'verdade_comercial', resumo: 'promessa-falsa-marcador: promete personalização que o catálogo não oferece', alvo: 'headline', custoCorrecao: 'copy', acaoSugerida: 'trocar a headline' };

test('HERMES-1 (a): headline travada + verdade_comercial confirmada na headline encerra bloqueado, sem correção e nunca verde', async () => {
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom(ROTA_TRAVADA),
    'crit:': () => ({ findings: [F_PROMESSA] }),
    'correcao:': () => ({ resumo: 'recompõe', acoes: ACOES_V2, promptIa: null, copyCorrigida: 'copy-verdadeira' }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'Crit');
  assert.equal(resultado.iteracao, 1);
  assert.match(resultado.detalhe, /promessa-falsa-marcador/);
  assert.match(resultado.acao, /destravar/);
  assert.match(resultado.acao, /args\.headline/);
  assert.equal(labels(chamadas, 'correcao:').length, 0, 'sem correção possível: a copy travada não se reescreve');
  assert.equal(labels(chamadas, 'crit:').length, 1, 'nenhuma iteração queimada');
  assert.equal(labels(chamadas, 'composicao:').length, 1);
  assert.equal(labels(chamadas, 'confirmar:').length, 0, 'confirmado pelo crit não gasta confirmação');
  assert.equal(resultado.sinalizacoes.length, 0, 'verdade comercial na headline nunca vira sinalização');
  assert.ok(resultado.findingsJulgados.some((f) => f.criterio === 'verdade_comercial' && f.confirmado === true));
  assert.equal(labels(chamadas, 'pacote:').length, 1, 'trabalho julgado grava reports');
  assert.ok(labels(chamadas, 'pacote:')[0].prompt.includes('promessa-falsa-marcador'));
  assert.match(labels(chamadas, 'pacote:')[0].prompt, /veredito_final bloqueado/);
  assert.equal(resultado.pacote, 'pacotes/slug1');
});

test('HERMES-1 (b): verdade_comercial plausível na headline travada passa pelo confirmador; confirmada bloqueia, refutada não', async () => {
  for (const [real, status] of [[true, 'bloqueado'], [false, 'verde']]) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      ...portaoCom(ROTA_TRAVADA),
      'crit:': () => ({ findings: [{ ...F_PROMESSA, confianca: 'plausivel' }] }),
      'confirmar:': () => ({ real, porque: real ? 'o catálogo não tem personalização' : 'o catálogo tem personalização' }),
    } });
    assert.equal(resultado.status, status, `real=${real}`);
    assert.equal(labels(chamadas, 'confirmar:').length, 1, 'plausível gasta confirmação, nunca vira sinalização direto');
    assert.ok(labels(chamadas, 'confirmar:')[0].prompt.includes('verdade_comercial'));
    assert.equal(labels(chamadas, 'correcao:').length, 0);
    assert.equal(resultado.sinalizacoes.length, 0);
    assert.equal(resultado.findingsJulgados[0].confirmado, real);
  }
});

test('HERMES-1 (c): headline travada + headline_tem_ideia na headline vira sinalização com motivo visível e o run fecha verde', async () => {
  const F_IDEIA = { ...FINDING_BASE, criterio: 'headline_tem_ideia', resumo: 'sem-ideia-marcador', alvo: 'headline', custoCorrecao: 'overlay' };
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: { ...portaoCom(ROTA_TRAVADA), 'crit:': () => ({ findings: [F_IDEIA] }) } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.iteracoes, 1);
  assert.equal(labels(chamadas, 'correcao:').length, 0);
  assert.equal(labels(chamadas, 'confirmar:').length, 0);
  assert.equal(resultado.sinalizacoes.length, 1);
  assert.equal(resultado.sinalizacoes[0].criterio, 'headline_tem_ideia');
  assert.match(resultado.sinalizacoes[0].motivo, /headline travada/);
  assert.match(resultado.sinalizacoes[0].motivo, /headline_tem_ideia/);
  assert.ok(labels(chamadas, 'pacote:')[0].prompt.includes('sem-ideia-marcador'));
});

test('HERMES-1 (d) controle: com a trava, redação da headline (voz_da_marca, ou K-Q com custo copy) continua sinalização', async () => {
  for (const f of [
    { ...FINDING_BASE, criterio: 'voz_da_marca', resumo: 'voz-marcador', alvo: 'headline', custoCorrecao: 'overlay' },
    { ...FINDING_BASE, criterio: 'coerencia_imagem_copy', resumo: 'coerencia-marcador', alvo: 'headline', custoCorrecao: 'copy' },
  ]) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: { ...portaoCom(ROTA_TRAVADA), 'crit:': () => ({ findings: [f] }) } });
    assert.equal(resultado.status, 'verde', f.criterio);
    assert.equal(resultado.sinalizacoes.length, 1);
    assert.equal(resultado.sinalizacoes[0].criterio, f.criterio);
    assert.match(resultado.sinalizacoes[0].motivo, /headline travada/);
    assert.equal(labels(chamadas, 'correcao:').length, 0);
  }
});

test('HERMES-1 (e) controle: com a trava, defeito de render na headline (texto_correto, custo overlay ou ia) segue o fluxo normal', async () => {
  for (const custo of ['overlay', 'ia']) {
    const F_RENDER = { ...FINDING_BASE, criterio: 'texto_correto', resumo: 'render-errou-a-palavra', alvo: 'headline', custoCorrecao: custo };
    let vez = 0;
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      ...portaoCom(ROTA_TRAVADA),
      'crit:': () => (vez++ === 0 ? { findings: [F_RENDER] } : { findings: [] }),
      'correcao:': () => ({ resumo: 'corrige o render', acoes: ACOES_V2, promptIa: null, copyCorrigida: null }),
    } });
    assert.equal(resultado.status, 'verde', custo);
    assert.equal(resultado.iteracoes, 2, 'o defeito de render forçou correção');
    assert.equal(labels(chamadas, 'correcao:').length, 1);
    assert.equal(labels(chamadas, 'producao:').length, custo === 'ia' ? 2 : 1);
    assert.equal(resultado.sinalizacoes.length, 0);
    assert.equal(resultado.copy, ROTA_TRAVADA.copy);
  }
});

test('HERMES-1 (f): sem a trava, verdade_comercial na headline segue o fluxo normal de correção (copy corrigida aceita)', async () => {
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom({ ...ROTA_TRAVADA, headlineTravada: false }),
    'crit:': () => (vez++ === 0 ? { findings: [F_PROMESSA] } : { findings: [] }),
    'correcao:': () => ({ resumo: 'troca a promessa', promptIa: null, copyCorrigida: 'Headline: Produto com acabamento exclusivo' }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.iteracoes, 2);
  assert.equal(resultado.copy, 'Headline: Produto com acabamento exclusivo');
  assert.equal(resultado.copyFoiCorrigida, true);
  assert.equal(labels(chamadas, 'correcao:').length, 1);
  assert.equal(labels(chamadas, 'producao:').length, 1, 'correção de copy não regenera imagem');
  assert.equal(resultado.sinalizacoes.length, 0);
});

test('HERMES-1 (f): com a trava, verdade_comercial na imagem (sem alvo headline) segue bloqueante e corrigível', async () => {
  const F_IMAGEM = { ...FINDING_BASE, criterio: 'verdade_comercial', resumo: 'imagem-mostra-variacao-inexistente', custoCorrecao: 'ia' };
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom(ROTA_TRAVADA),
    'crit:': () => (vez++ === 0 ? { findings: [F_IMAGEM] } : { findings: [] }),
    'correcao:': () => ({ resumo: 'tira a variação do prompt', promptIa: 'foto realista sem a variação', copyCorrigida: null }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.iteracoes, 2);
  assert.equal(labels(chamadas, 'producao:').length, 2);
  assert.ok(labels(chamadas, 'producao:')[1].prompt.includes('foto realista sem a variação'));
  assert.equal(resultado.sinalizacoes.length, 0);
});

test('HERMES-1 (g): o crit pede os 16 critérios A-Q pelo slug próprio e o schema enviado aceita exatamente esses 16', async () => {
  const { chamadas } = await rodar({ args: PRODUZIR });
  const crit = labels(chamadas, 'crit:')[0];
  for (const slug of [...CRITERIOS_A_J, ...CRITERIOS_K_Q]) assert.ok(crit.prompt.includes(slug), `prompt do crit sem ${slug}`);
  assert.ok(!crit.prompt.includes('(A-J)'), 'o prompt não restringe o contrato a A-J');
  assert.match(crit.prompt, /\(A-Q\)/);
  const enumCriterio = crit.opts.schema.properties.findings.items.properties.criterio.enum;
  assert.deepEqual([...enumCriterio].sort(), [...CRITERIOS_A_J, ...CRITERIOS_K_Q].sort());
});

// ── revisão do HERMES-1 (decisão 14, 2026-11-03) ─────────────────────────────
// O contrato de Q listava "verdade comercial" entre os 4 testes de copy: a promessa falsa da
// headline podia sair como headline_tem_ideia, que a trava rebaixa. O prompt do crit precisa
// mandar a falha de verdade comercial, inclusive o 4º teste de Q, para o slug verdade_comercial.
test('HERMES-1 (h): o prompt do crit manda a promessa falsa da headline para verdade_comercial, nunca headline_tem_ideia', async () => {
  const { chamadas } = await rodar({ args: PRODUZIR });
  const prompt = labels(chamadas, 'crit:')[0].prompt.replace(/\s+/g, ' ');
  assert.match(prompt, /4º teste de copy de Q[^.]*verdade_comercial, nunca headline_tem_ideia/);
});

test('HERMES-1 (i): com a trava, verdade_comercial na headline declarada nao-bloqueante é coagida a bloqueante, com registro', async () => {
  for (const [confianca, confirmacoes] of [['confirmado', 0], ['plausivel', 1]]) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      ...portaoCom(ROTA_TRAVADA),
      'crit:': () => ({ findings: [{ ...F_PROMESSA, severidade: 'nao-bloqueante', confianca }] }),
    } });
    assert.equal(resultado.status, 'bloqueado', confianca);
    assert.equal(resultado.fase, 'Crit');
    assert.equal(labels(chamadas, 'crit:').length, 1);
    assert.equal(labels(chamadas, 'confirmar:').length, confirmacoes);
    assert.equal(labels(chamadas, 'correcao:').length, 0);
    const iter = resultado.historico[0];
    assert.equal(iter.naoBloqueantes.length, 0, 'a promessa não fica entre os não-bloqueantes');
    assert.equal(iter.severidadeCoagida.length, 1, 'a coerção fica registrada no histórico');
    assert.equal(iter.severidadeCoagida[0].criterio, 'verdade_comercial');
    assert.equal(iter.severidadeCoagida[0].severidadeDeclarada, 'nao-bloqueante');
  }
});

test('R6a: fidelidade_mockup bloqueia mesmo sem baseline de vencedora quando há mockup; sem mockup a severidade declarada vale', async () => {
  const F = { ...FINDING_BASE, criterio: 'fidelidade_mockup', resumo: 'o produto do render difere do mockup', custoCorrecao: 'ia', severidade: 'nao-bloqueante' };
  const comMockup = { ...ROTA, baselinePath: null, mockupPath: 'mockup.png' };
  const a = await rodar({ args: PRODUZIR, overrides: { ...portaoCom(comMockup), 'crit:': () => ({ findings: [F] }) } });
  assert.notEqual(a.resultado.status, 'verde', textoJson(a.resultado));
  const iter = a.resultado.historico[0];
  assert.equal(iter.severidadeCoagida[0].criterio, 'fidelidade_mockup');
  assert.equal(iter.naoBloqueantes.length, 0);
  const sem = await rodar({ args: PRODUZIR, overrides: { ...portaoCom({ ...ROTA, mockupPath: null }), 'crit:': () => ({ findings: [F] }) } });
  assert.equal(sem.resultado.status, 'verde', textoJson(sem.resultado));
  const crit = labels(a.chamadas, 'crit:')[0];
  assert.match(crit.prompt, /fidelidade_mockup \(bloqueante mesmo sem baseline/);
});

test('HERMES-1 (j): alvo headline com caixa ou espaço diferentes vale para a trava e para o bloqueio', async () => {
  for (const alvo of ['Headline', 'headline ', ' HEADLINE']) {
    const promessa = await rodar({ args: PRODUZIR, overrides: { ...portaoCom(ROTA_TRAVADA), 'crit:': () => ({ findings: [{ ...F_PROMESSA, alvo }] }) } });
    assert.equal(promessa.resultado.status, 'bloqueado', JSON.stringify(alvo));
    assert.equal(promessa.resultado.fase, 'Crit');
    assert.equal(labels(promessa.chamadas, 'crit:').length, 1);
    assert.equal(labels(promessa.chamadas, 'correcao:').length, 0);
    assert.match(promessa.resultado.acao, /destravar/);
    const voz = await rodar({ args: PRODUZIR, overrides: { ...portaoCom(ROTA_TRAVADA), 'crit:': () => ({ findings: [{ ...F_HEADLINE, alvo }] }) } });
    assert.equal(voz.resultado.status, 'verde', JSON.stringify(alvo));
    assert.equal(voz.resultado.sinalizacoes.length, 1);
  }
});

test('HERMES-1 (k): crit e confirmação de verdade_comercial recebem o contexto resolvido e o lookup do catálogo', async () => {
  const { chamadas } = await rodar({ args: { ...PRODUZIR, dirs: { contexto: 'ws/ctx-custom' } }, overrides: {
    ...portaoCom(ROTA_TRAVADA),
    'crit:': () => ({ findings: [{ ...F_PROMESSA, confianca: 'plausivel' }] }),
    'confirmar:': () => ({ real: false, porque: 'o catálogo tem personalização' }),
  } });
  for (const p of ['crit:', 'confirmar:']) {
    const prompt = labels(chamadas, p)[0].prompt.replace(/\s+/g, ' ');
    assert.ok(prompt.includes('ws/ctx-custom'), `${p} sem o contexto resolvido`);
    assert.match(prompt, /lookup do catálogo/, `${p} sem a instrução de lookup`);
  }
});

// Leitura literal da regra 2 da decisão 14: o que a trava rebaixava continua sinalização. Antes
// o validador remapeava K e O para mensagem_completa (rebaixado com qualquer custo) e L, M e N
// para legibilidade_thumbnail (rebaixado só com custo copy; overlay ou ia seguiam o fluxo normal).
test('HERMES-1 (l): com a trava, K e O na headline viram sinalização com qualquer custo; L, M e N com overlay ou ia seguem o fluxo normal', async () => {
  for (const criterio of ['tres_segundos', 'coerencia_imagem_copy', 'miniatura', 'desfoque', 'exclusao']) {
    for (const custo of ['overlay', 'ia']) {
      const caso = `${criterio}/${custo}`;
      const f = { ...FINDING_BASE, criterio, resumo: `${criterio}-marcador`, alvo: 'headline', custoCorrecao: custo };
      let vez = 0;
      const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
        ...portaoCom(ROTA_TRAVADA),
        'crit:': () => (vez++ === 0 ? { findings: [f] } : { findings: [] }),
        'correcao:': () => ({ resumo: 'recompõe', acoes: ACOES_V2, promptIa: null, copyCorrigida: null }),
      } });
      assert.equal(resultado.status, 'verde', caso);
      if (['tres_segundos', 'coerencia_imagem_copy'].includes(criterio)) {
        assert.equal(resultado.iteracoes, 1, caso);
        assert.equal(labels(chamadas, 'correcao:').length, 0, caso);
        assert.equal(resultado.sinalizacoes.length, 1, caso);
        assert.equal(resultado.sinalizacoes[0].criterio, criterio, caso);
        assert.match(resultado.sinalizacoes[0].motivo, /headline travada/, caso);
      } else {
        assert.equal(resultado.iteracoes, 2, caso);
        assert.equal(labels(chamadas, 'correcao:').length, 1, caso);
        assert.equal(labels(chamadas, 'producao:').length, custo === 'ia' ? 2 : 1, caso);
        assert.equal(resultado.sinalizacoes.length, 0, caso);
      }
    }
  }
});

// ── decisão 17A do dono (2026-11-03): justificativa em toda refutação ─────────
// O VEREDITO_SCHEMA aceitava {real:false} sem porque e a refutação descartava o finding. Agora o
// schema exige porque não vazio, e o controlador, como segunda camada, recusa refutação com porque
// vazio ou só espaços: o finding segue bloqueante (falha fechada), com o motivo em findingsJulgados.
const CRITERIOS_A_Q = [...CRITERIOS_A_J, ...CRITERIOS_K_Q];
const plausivelDe = (criterio) => ({ ...FINDING_BASE, criterio, resumo: `${criterio}-plausivel-marcador`, confianca: 'plausivel', custoCorrecao: 'overlay' });
// U+200B e U+2060 passam no minLength do schema e no trim, mas não justificam nada: aparecem em
// branco no report (revisão da 17A). U+3164 só é ignorável por padrão e U+FFF9 só é formatação
// (Cf): o par cobre as duas classes que o controlador tira além dos espaços.
const INVISIVEIS = [['só U+200B', '​'], ['U+2060, espaço e U+FEFF', '⁠ ﻿'], ['U+3164 e U+FFF9', 'ㅤ￹']];
const REFUTACOES_SEM_PORQUE = [['ausente', { real: false }], ['vazio', { real: false, porque: '' }], ['só espaços', { real: false, porque: '  \n\t ' }],
  ...INVISIVEIS.map(([caso, porque]) => [caso, { real: false, porque }])];

test('17A: refutação sem porque (ausente, vazio, só espaços ou só caracteres invisíveis) não descarta o finding nos 17 critérios', async () => {
  for (const criterio of CRITERIOS_A_Q) {
    for (const [caso, veredito] of REFUTACOES_SEM_PORQUE) {
      const rotulo = `${criterio}/${caso}`;
      const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
        'crit:': () => ({ findings: [plausivelDe(criterio)] }),
        'confirmar:': () => ({ ...veredito }),
      } });
      assert.notEqual(resultado.status, 'verde', rotulo);
      assert.equal(labels(chamadas, 'confirmar:').length, 1, rotulo);
      assert.equal(labels(chamadas, 'correcao:').length, 1, `${rotulo}: o finding virou retrabalho`);
      assert.ok(labels(chamadas, 'correcao:')[0].prompt.includes(`${criterio}-plausivel-marcador`), rotulo);
      assert.equal(resultado.historico[0].bloqueantesConfirmados.length, 1, rotulo);
      const julgado = resultado.findingsJulgados[0];
      assert.equal(julgado.criterio, criterio, rotulo);
      assert.equal(julgado.confirmado, true, `${rotulo}: segue bloqueante`);
      assert.equal(julgado.refutacaoRecusada, true, rotulo);
      assert.match(julgado.motivo, /refutação sem porque/, rotulo);
    }
  }
});

test('17A controle: refutação com porque descarta o finding nos 16 critérios e o run fecha verde', async () => {
  for (const criterio of CRITERIOS_A_Q) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      'crit:': () => ({ findings: [plausivelDe(criterio)] }),
      'confirmar:': () => ({ real: false, porque: 'relido com zoom: a região citada está correta' }),
    } });
    assert.equal(resultado.status, 'verde', criterio);
    assert.equal(labels(chamadas, 'correcao:').length, 0, criterio);
    assert.equal(resultado.findingsJulgados[0].confirmado, false, criterio);
    assert.equal(resultado.findingsJulgados[0].refutacaoRecusada, undefined, criterio);
    assert.equal(resultado.findingsJulgados[0].porqueVeredito, 'relido com zoom: a região citada está correta', criterio);
  }
});

test('17A: o schema enviado à confirmação exige porque não vazio em todo veredito', async () => {
  const { chamadas } = await rodar({ args: PRODUZIR, overrides: { 'crit:': () => ({ findings: [plausivelDe('texto_correto')] }) } });
  const schema = labels(chamadas, 'confirmar:')[0].opts.schema;
  assert.deepEqual([...schema.required].sort(), ['porque', 'real']);
  assert.equal(schema.properties.porque.type, 'string');
  assert.equal(schema.properties.porque.minLength, 20);
  assert.match(labels(chamadas, 'confirmar:')[0].prompt, /porque é obrigatório/);
});

test('17A: com a trava, verdade_comercial plausível na headline refutada sem porque encerra bloqueado (falha fechada)', async () => {
  for (const [caso, veredito] of REFUTACOES_SEM_PORQUE) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      ...portaoCom(ROTA_TRAVADA),
      'crit:': () => ({ findings: [{ ...F_PROMESSA, confianca: 'plausivel' }] }),
      'confirmar:': () => ({ ...veredito }),
    } });
    assert.equal(resultado.status, 'bloqueado', caso);
    assert.equal(resultado.fase, 'Crit', caso);
    assert.equal(labels(chamadas, 'correcao:').length, 0, caso);
    assert.equal(resultado.findingsJulgados[0].refutacaoRecusada, true, caso);
  }
});

// ── decisão 18C do dono (2026-11-03): headline_tem_ideia na trava passa pela confirmação de promessa ──
// Com a trava, todo headline_tem_ideia com alvo headline (qualquer severidade e confiança) passa por
// uma confirmação própria antes de virar sinalização: a crítica aponta promessa de produto, variação,
// serviço ou condição que o negócio não oferece? Se sim, é verdade comercial confirmada na headline
// travada e o run para bloqueado; se não, com porque, segue a sinalização de hoje.
const F_IDEIA_TRAVA = { ...FINDING_BASE, criterio: 'headline_tem_ideia', resumo: 'ideia-ou-promessa-marcador', alvo: 'headline', custoCorrecao: 'copy' };
const COMBINACOES = [['bloqueante', 'confirmado'], ['bloqueante', 'plausivel'], ['nao-bloqueante', 'confirmado'], ['nao-bloqueante', 'plausivel']];

// alvo é string livre: 'Headline' ou 'headline ' ainda é a headline e não pode pular a confirmação
// de promessa (com igualdade exata no filtro, a promessa falsa virava sinalização e fechava verde).
const ALVOS_HEADLINE = ['headline', 'Headline', 'headline ', ' HEADLINE'];
const PORQUE_PROMESSA = 'contexto/catalogo.md não tem personalização';

test('18C: headline_tem_ideia na trava com promessaFalsa=true encerra bloqueado sem iteração de correção, em qualquer severidade, confiança e grafia do alvo', async () => {
  for (const alvo of ALVOS_HEADLINE) for (const [severidade, confianca] of COMBINACOES) {
    const caso = `${JSON.stringify(alvo)}/${severidade}/${confianca}`;
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      ...portaoCom(ROTA_TRAVADA),
      'crit:': () => ({ findings: [{ ...F_IDEIA_TRAVA, alvo, severidade, confianca }] }),
      'promessa:': () => ({ promessaFalsa: true, porque: PORQUE_PROMESSA }),
    } });
    assert.equal(resultado.status, 'bloqueado', caso);
    assert.equal(resultado.fase, 'Crit', caso);
    assert.equal(resultado.iteracao, 1, caso);
    assert.match(resultado.detalhe, /ideia-ou-promessa-marcador/, caso);
    assert.match(resultado.detalhe, /headline_tem_ideia reclassificado/, caso);
    assert.match(resultado.acao, /destravar/, caso);
    assert.equal(labels(chamadas, 'promessa:').length, 1, caso);
    assert.equal(labels(chamadas, 'confirmar:').length, 0, `${caso}: a confirmação de promessa substitui a T3`);
    assert.equal(labels(chamadas, 'correcao:').length, 0, caso);
    assert.equal(labels(chamadas, 'crit:').length, 1, `${caso}: nenhuma iteração queimada`);
    assert.equal(resultado.sinalizacoes.length, 0, caso);
    assert.equal(resultado.findingsBloqueio.length, 1, caso);
    assert.equal(resultado.findingsBloqueio[0].criterio, 'verdade_comercial', caso);
    assert.equal(resultado.findingsBloqueio[0].criterioOriginal, 'headline_tem_ideia', caso);
    // O dono recebe a causa certa e a evidência do catálogo: não o motivo da falha fechada da 17A
    // (os dois ramos terminam bloqueado) nem um porque perdido no caminho.
    assert.match(resultado.findingsBloqueio[0].reclassificacao, /confirmação de promessa apontou/, caso);
    assert.doesNotMatch(resultado.findingsBloqueio[0].reclassificacao, /sem porque/, caso);
    assert.match(resultado.detalhe, /confirmação de promessa apontou/, caso);
    assert.equal(resultado.findingsBloqueio[0].porquePromessa, PORQUE_PROMESSA, caso);
    assert.equal(resultado.historico[0].naoBloqueantes.length, 0, `${caso}: a promessa não fica entre os não-bloqueantes`);
    assert.deepEqual(resultado.historico[0].reclassificados.map((r) => [r.de, r.para, r.severidadeDeclarada, r.confiancaDeclarada]), [['headline_tem_ideia', 'verdade_comercial', severidade, confianca]], caso);
    assert.match(resultado.historico[0].reclassificados[0].motivo, /confirmação de promessa apontou/, caso);
    const julgados = resultado.findingsJulgados.filter((f) => f.criterioOriginal === 'headline_tem_ideia');
    assert.equal(julgados.length, 1, caso);
    assert.equal(julgados[0].confirmado, true, caso);
    assert.equal(julgados[0].porqueVeredito, PORQUE_PROMESSA, caso);
    assert.equal(labels(chamadas, 'pacote:').length, 1, `${caso}: trabalho julgado grava reports`);
    assert.match(labels(chamadas, 'pacote:')[0].prompt, /veredito_final bloqueado/, caso);
  }
});

test('18C: com promessaFalsa=false e porque, headline_tem_ideia segue a sinalização de hoje e o run fecha verde', async () => {
  for (const [severidade, confianca] of COMBINACOES) {
    const caso = `${severidade}/${confianca}`;
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      ...portaoCom(ROTA_TRAVADA),
      'crit:': () => ({ findings: [{ ...F_IDEIA_TRAVA, severidade, confianca }] }),
    } });
    assert.equal(resultado.status, 'verde', caso);
    assert.equal(resultado.iteracoes, 1, caso);
    assert.equal(labels(chamadas, 'promessa:').length, 1, caso);
    assert.equal(labels(chamadas, 'confirmar:').length, 0, caso);
    assert.equal(labels(chamadas, 'correcao:').length, 0, caso);
    if (severidade === 'bloqueante') {
      assert.equal(resultado.sinalizacoes.length, 1, caso);
      assert.equal(resultado.sinalizacoes[0].criterio, 'headline_tem_ideia', caso);
      assert.match(resultado.sinalizacoes[0].motivo, /headline travada/, caso);
      assert.match(resultado.sinalizacoes[0].porquePromessa, /catálogo/, caso);
    } else {
      assert.equal(resultado.sinalizacoes.length, 0, caso);
      assert.equal(resultado.findingsNaoBloqueantes.length, 1, caso);
      assert.equal(resultado.findingsNaoBloqueantes[0].criterio, 'headline_tem_ideia', caso);
    }
  }
});

test('18C: promessaFalsa=false sem porque (ausente, vazio, só espaços ou só caracteres invisíveis) encerra com erro de resposta, sem afirmar promessa falsa', async () => {
  for (const [caso, resposta] of [['ausente', { promessaFalsa: false }], ['vazio', { promessaFalsa: false, porque: '' }], ['só espaços', { promessaFalsa: false, porque: '   ' }],
    ...INVISIVEIS.map(([caso, porque]) => [caso, { promessaFalsa: false, porque }])]) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      ...portaoCom(ROTA_TRAVADA),
      'crit:': () => ({ findings: [F_IDEIA_TRAVA] }),
      'promessa:': () => ({ ...resposta }),
    } });
    assert.equal(resultado.status, 'erro', caso);
    assert.equal(resultado.fase, 'Crit', caso);
    assert.equal(resultado.natureza, 'resposta_invalida', caso);
    assert.equal(resultado.solicitacao, 'promessa:i1', caso);
    assert.match(resultado.detalhe, /justificativa inválida/, caso);
    assert.match(resultado.acao, /corrigir.*justificativa/, caso);
    assert.equal(resultado.findingsBloqueio, undefined, caso);
    assert.equal(resultado.historico, undefined, caso);
    assert.equal(resultado.sinalizacoes, undefined, caso);
    assert.equal(chamadas.at(-1).label, 'promessa:i1', caso);
    assert.equal(labels(chamadas, 'correcao:').length, 0, caso);
    assert.equal(labels(chamadas, 'pacote:').length, 0, caso);
  }
});

test('18C: o prompt da confirmação de promessa traz o contexto resolvido, o lookup do catálogo e o schema com promessaFalsa e porque obrigatórios', async () => {
  const { chamadas } = await rodar({ args: { ...PRODUZIR, dirs: { contexto: 'ws/ctx-custom' } }, overrides: {
    ...portaoCom(ROTA_TRAVADA),
    'crit:': () => ({ findings: [F_IDEIA_TRAVA] }),
  } });
  const pedido = labels(chamadas, 'promessa:')[0];
  assert.equal(pedido.label, 'promessa:i1');
  assert.equal(pedido.opts.agentType, 'hermes:validador-de-criativo');
  const prompt = pedido.prompt.replace(/\s+/g, ' ');
  assert.ok(prompt.includes('ws/ctx-custom'), 'sem o contexto resolvido');
  assert.match(prompt, /lookup do catálogo/);
  assert.match(prompt, /produto, variação, serviço ou condição/);
  assert.ok(prompt.includes('ideia-ou-promessa-marcador'), 'sem a crítica a confirmar');
  assert.ok(prompt.includes(ROTA_TRAVADA.copy), 'sem a copy travada');
  const schema = pedido.opts.schema;
  assert.deepEqual([...schema.required].sort(), ['porque', 'promessaFalsa']);
  assert.equal(schema.properties.promessaFalsa.type, 'boolean');
  assert.equal(schema.properties.porque.minLength, 20);
  assert.equal(schema.additionalProperties, false);
});

test('18C: confirmador de promessa que não retorna (null ou exceção) é erro, sem sinalização, correção nem pacote', async () => {
  for (const falha of [() => null, () => { throw new Error('fixture: confirmador caiu'); }]) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      ...portaoCom(ROTA_TRAVADA),
      'crit:': () => ({ findings: [F_IDEIA_TRAVA] }),
      'promessa:': falha,
    } });
    assert.equal(resultado.status, 'erro');
    assert.equal(resultado.fase, 'Crit');
    assert.equal(resultado.iteracao, 1);
    assert.match(resultado.detalhe, /promessa/);
    assert.match(resultado.acao, /resumeFromRunId/);
    assert.equal(chamadas.at(-1).label, 'promessa:i1');
    assert.equal(labels(chamadas, 'correcao:').length, 0);
    assert.equal(labels(chamadas, 'pacote:').length, 0);
  }
});

test('18C: sem a trava, headline_tem_ideia na headline não chama a confirmação de promessa e segue o fluxo normal', async () => {
  for (const rota of [ROTA, { ...ROTA_TRAVADA, headlineTravada: false }]) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      ...portaoCom(rota),
      'crit:': () => ({ findings: [F_IDEIA_TRAVA] }),
      'promessa:': () => ({ promessaFalsa: true, porque: 'não deveria ser chamado' }),
    } });
    assert.equal(labels(chamadas, 'promessa:').length, 0);
    assert.equal(labels(chamadas, 'correcao:').length, 1, 'bloqueante confirmado sem trava vira retrabalho');
    assert.notEqual(resultado.status, 'bloqueado');
    assert.equal(resultado.sinalizacoes.length, 0);
  }
});

test('18C: com a trava, a confirmação de promessa só vale para headline_tem_ideia com alvo headline', async () => {
  for (const f of [
    { ...F_IDEIA_TRAVA, alvo: undefined },
    { ...F_HEADLINE },
    { ...FINDING_BASE, criterio: 'tres_segundos', resumo: 'k-marcador', alvo: 'headline', custoCorrecao: 'copy' },
  ]) {
    const { chamadas } = await rodar({ args: PRODUZIR, overrides: {
      ...portaoCom(ROTA_TRAVADA),
      'crit:': () => ({ findings: [f] }),
      'correcao:': () => ({ resumo: 'recompõe', acoes: ACOES_V2, promptIa: null, copyCorrigida: null }),
    } });
    assert.equal(labels(chamadas, 'promessa:').length, 0, `${f.criterio}/${f.alvo}`);
  }
});

// O CRIT_SCHEMA recusa campos extras. Esta fixture ignora deliberadamente a validação do
// executor para manter a defesa do roteamento contra respostas forjadas. Quem marca o reclassificado é o controlador, pela
// identidade do objeto que ele criou: campo forjado não pula a T3, não fura a sinalização da trava
// nem encerra bloqueado sem confirmação (revisão da 18C).
test('18C: criterioOriginal forjado pelo crit não roteia: o finding segue a T3 e a trava como qualquer outro', async () => {
  const FORJADO = { criterioOriginal: 'headline_tem_ideia', reclassificacao: 'forjado-pelo-crit', porquePromessa: 'forjado-pelo-crit' };
  const REFUTA = () => ({ real: false, porque: 'relido com zoom: contexto/catalogo.md oferece o que a peça diz' });
  const casos = [
    ['sem trava, plausível refutado', ROTA, { ...FINDING_BASE, criterio: 'texto_correto', resumo: 'forjado-marcador', confianca: 'plausivel', custoCorrecao: 'overlay' }, REFUTA, 'verde', 1],
    ['trava, voz_da_marca na headline', ROTA_TRAVADA, { ...F_HEADLINE }, REFUTA, 'verde', 0],
    ['trava, verdade_comercial plausível refutada', ROTA_TRAVADA, { ...F_PROMESSA, confianca: 'plausivel' }, REFUTA, 'verde', 1],
    ['trava, verdade_comercial plausível confirmada', ROTA_TRAVADA, { ...F_PROMESSA, confianca: 'plausivel' }, () => ({ real: true, porque: 'contexto/catalogo.md não tem personalização' }), 'bloqueado', 1],
  ];
  for (const [caso, rota, f, confirmar, status, confirmacoes] of casos) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      ...portaoCom(rota),
      'crit:': () => ({ findings: [{ ...f, ...FORJADO }] }),
      'confirmar:': confirmar,
    } });
    assert.equal(resultado.status, status, caso);
    assert.equal(labels(chamadas, 'confirmar:').length, confirmacoes, `${caso}: a T3 não é pulada`);
    assert.equal(labels(chamadas, 'promessa:').length, 0, caso);
    assert.equal(labels(chamadas, 'correcao:').length, 0, caso);
    if (status === 'bloqueado') {
      assert.equal(resultado.historico[0].reclassificados, undefined, `${caso}: nada foi reclassificado pela confirmação de promessa`);
      assert.doesNotMatch(resultado.detalhe, /reclassificado|forjado-pelo-crit/, caso);
    }
    if (f.criterio === 'voz_da_marca') {
      assert.equal(resultado.sinalizacoes.length, 1, `${caso}: com a trava, voz_da_marca na headline segue sinalização`);
      assert.equal(resultado.sinalizacoes[0].criterio, 'voz_da_marca', caso);
      assert.equal(resultado.findingsJulgados.length, 0, caso);
    } else {
      assert.equal(resultado.findingsJulgados[0].confirmado, status === 'bloqueado', caso);
      assert.notEqual(resultado.findingsJulgados[0].porqueVeredito, 'forjado-pelo-crit', caso);
    }
  }
});

test('teto de rotas e identificadores únicos bloqueiam antes de rough pago', async () => {
  for (const ns of [[1, 2, 3], [1, 1]]) {
    const { resultado, chamadas } = await rodar({ args: { ...ROTAS, perfil: 'economico' }, overrides: {
      'rotas:dirigir': () => ({ ...DEFAULTS['rotas:dirigir'](), rotas: ns.map(n => ({ n, nome: 'a', arquetipo: 'foto', segmento: 'segmento', acoes: [GERAR, COMPOR] })) }),
    } });
    assert.equal(resultado.status, 'bloqueado');
    assert.equal(labels(chamadas, 'rough:').length, 0);
  }
});

test('candidatos excedentes escalam com registro antes de seleção e composição', async () => {
  const { resultado, chamadas } = await rodar({ args: { ...PRODUZIR, perfil: 'economico' }, overrides: {
    'producao:': () => ({ ok: true, candidatos: ['a', 'b', 'c', 'd', 'e'], falhas: [] }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.match(JSON.stringify(resultado), /5.*2|2.*5/);
  assert.equal(labels(chamadas, 'selecao:').length, 0);
  assert.equal(labels(chamadas, 'composicao:').length, 0);
});

test('justificativa: refutação exige 20 caracteres sem espaços/invisíveis e letra ou número', async () => {
  const invalidas = ['.', '.'.repeat(20), 'a'.repeat(19), ('a \t\n').repeat(19), 'a'.repeat(19) + '\u200b'.repeat(30), '𐐀'.repeat(19)];
  for (const porque of invalidas) {
    const { resultado } = await rodar({ args: PRODUZIR, overrides: {
      'crit:': () => ({ findings: [plausivelDe('texto_correto')] }),
      'confirmar:': () => ({ real: false, porque }),
    } });
    assert.notEqual(resultado.status, 'verde', JSON.stringify(porque));
    assert.equal(resultado.findingsJulgados[0].refutacaoRecusada, true);
  }
  for (const porque of ['a'.repeat(20), 'é'.repeat(20), '𐐀'.repeat(20), '1'.repeat(20), ('a ').repeat(20)]) {
    const { resultado } = await rodar({ args: PRODUZIR, overrides: {
      'crit:': () => ({ findings: [plausivelDe('texto_correto')] }),
      'confirmar:': () => ({ real: false, porque }),
    } });
    assert.equal(resultado.status, 'verde', JSON.stringify(porque));
    assert.equal(resultado.findingsJulgados[0].porqueVeredito, porque);
  }
});

test('justificativa: promessaFalsa=false segue o mesmo mínimo e não rebaixa texto inválido', async () => {
  for (const [porque, aceita] of [['.'.repeat(20), false], ['a'.repeat(19) + ' '.repeat(20), false], ['a'.repeat(19) + '\u3164'.repeat(20), false], ['a'.repeat(20), true]]) {
    const { resultado } = await rodar({ args: { ...PRODUZIR, headlineTravada: true }, overrides: {
      ...portaoCom(ROTA_TRAVADA),
      'crit:': () => ({ findings: [{ ...FINDING_BASE, criterio: 'headline_tem_ideia', alvo: 'headline' }] }),
      'promessa:': () => ({ promessaFalsa: false, porque }),
    } });
    assert.equal(resultado.status, aceita ? 'verde' : 'erro', JSON.stringify(porque));
  }
});

test('crítica exige achados sem propriedades extras e preserva os campos opcionais previstos', async () => {
  const { chamadas } = await rodar({ args: PRODUZIR });
  const schema = labels(chamadas, 'crit:')[0].opts.schema;
  assert.equal(schema.properties.findings.items.additionalProperties, false);
  assert.equal(schema.properties.findings.items.properties.alvo.type, 'string');
  assert.equal(schema.properties.findings.items.properties.acaoSugerida.type, 'string');
  assert.equal(schema.properties.findings.items.required.includes('alvo'), false);
  assert.equal(schema.properties.findings.items.required.includes('acaoSugerida'), false);
});

// ═════════════════════════════════════════════════════════════════════════════
// E1 (hermes 1.5.9): segurança do harness — ações estruturadas, manifesto de scripts,
// quoting, validação de entrada, --log-render e compat legado.
//
// Convenções do contrato que estes testes fixam:
//  - o comando entregue ao mecânico aparece no prompt num ÚNICO bloco cercado ```sh ... ```;
//  - o manifesto (conteúdo já lido pelo operário) volta na resposta do portão, campo `manifesto`;
//  - a rota do portão traz `acoes` (array); a rota do diretor também (op `gerar`);
//  - o pre-flight devolve `checks: [{nome, status}]`; `texto_fiel` com `skip` quando há texto
//    esperado não fecha verde (vira `unknown` e o run escala);
//  - o operário informa symlink que sai do cwd em `symlinksForaDoCwd` (portão).
// Quoting é verificado por EFEITO: o comando montado roda num /bin/sh real contra um script
// que imprime o argv. Dado fictício; nenhum comando de produção é executado.
// ═════════════════════════════════════════════════════════════════════════════
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

const COMANDO_FENCE = /```sh\n([\s\S]*?)\n```/;
function comandoDe(prompt) {
  const m = prompt.match(COMANDO_FENCE);
  assert.ok(m, `o prompt do mecânico deve trazer o comando montado num bloco \`\`\`sh ... \`\`\``);
  assert.equal(prompt.match(/```sh\n/g).length, 1, 'um único bloco de comando por prompt');
  return m[1];
}
function oficina(t, { scripts = 'scripts', pythonDir = 'py', executaveis = [] } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'hermes-e1-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, scripts), { recursive: true });
  for (const nome of executaveis) writeFileSync(join(cwd, scripts, nome), 'console.log(JSON.stringify(process.argv.slice(2)))\n');
  mkdirSync(join(cwd, pythonDir), { recursive: true });
  const python = join(cwd, pythonDir, 'py');
  writeFileSync(python, `#!/bin/sh\nexec '${process.execPath}' "$@"\n`);
  chmodSync(python, 0o755);
  return { cwd, python, scripts };
}
const argvDoComando = (cmd, cwd) => JSON.parse(execFileSync('/bin/sh', ['-c', cmd], { cwd, encoding: 'utf8' }));
// posicionais antes da primeira flag; flag seguida de valor (ou true quando seguida de flag/fim)
function paraMapa(argv) {
  const pos = [];
  const flags = {};
  let i = 0;
  while (i < argv.length && !argv[i].startsWith('--')) pos.push(argv[i++]);
  while (i < argv.length) {
    const k = argv[i++];
    if (i < argv.length && !argv[i].startsWith('--')) flags[k] = argv[i++];
    else flags[k] = true;
  }
  return { pos, flags };
}

const rotaAcoes = (extra = {}, acoes = [COMPOR]) => ({ ...ROTA, formato: 'feed', acoes, ...extra });
const portaoAcoes = (rota, extra = {}) => portaoCom(rota, { manifesto: MANIFESTO, ...extra });
const compSaida = (saida = SAIDA) => ({ 'composicao:': () => ({ ok: true, artefatos: [saida], falhas: [] }) });
const textoJson = (o) => JSON.stringify(o);

// ── A1 ───────────────────────────────────────────────────────────────────────
test('E1A1T1: rota com acoes monta o argv a partir dos campos; o mecânico recebe o comando montado, nunca o texto livre do diretor', async (t) => {
  const o = oficina(t, { executaveis: ['compor_x.py', 'validar_criativo.py'] });
  const rota = rotaAcoes({ comandoOverlay: 'rm -rf INJETADO-NO-OVERLAY', textoEsperado: 'Oferta de verão' });
  const { resultado, chamadas } = await rodar({
    args: { ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts } },
    overrides: { ...portaoAcoes(rota), ...compSaida() },
  });
  assert.equal(resultado.status, 'verde', textoJson(resultado));
  const comp = labels(chamadas, 'composicao:')[0].prompt;
  assert.ok(!comp.includes('INJETADO'), 'texto livre do diretor não chega ao mecânico');
  const { pos, flags } = paraMapa(argvDoComando(comandoDe(comp), o.cwd));
  assert.deepEqual(pos, []);
  assert.equal(flags['--base'], 'cand2.png', '{{BASE}} é trocado em código pelo candidato selecionado');
  assert.equal(flags['--saida'], SAIDA);
  assert.equal(flags['--formato'], 'feed');
  assert.equal(flags['--titulo'], 'Oferta de verão');
  assert.equal(flags['--fonte'], 'Inter');
  assert.equal(flags['--sobrescrever'], undefined, 'sobrescrever:false não anexa a flag');
  const pre = labels(chamadas, 'preflight:')[0].prompt;
  assert.ok(!pre.includes('INJETADO'));
  assert.equal(paraMapa(argvDoComando(comandoDe(pre), o.cwd)).pos[0], SAIDA, 'o pre-flight valida a saída declarada');
});

test('E1A1T2: sobrescrever:true anexa a flag declarada no manifesto', async (t) => {
  const o = oficina(t, { executaveis: ['compor_x.py', 'validar_criativo.py'] });
  const { resultado, chamadas } = await rodar({
    args: { ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts } },
    overrides: { ...portaoAcoes(rotaAcoes({}, [{ ...COMPOR, sobrescrever: true }])), ...compSaida() },
  });
  assert.equal(resultado.status, 'verde', textoJson(resultado));
  const { flags } = paraMapa(argvDoComando(comandoDe(labels(chamadas, 'composicao:')[0].prompt), o.cwd));
  assert.equal(flags['--sobrescrever'], true);
});

test('E1A1T3: rough da rota vem de campos estruturados da ação gerar, montado em código', async (t) => {
  const o = oficina(t, { executaveis: ['gerar_imagem.py'] });
  const gerar = { op: 'gerar', prompt: 'foto realista de um produto', saida: 'marketing/criativos/base/slug1__rota1_rough.png', referencias: ['referencias/banco visual/a.png'], tamanho: '1024x1024' };
  const rotasDir = { ok: true, slug: 'slug1', artefatoPath: 'rotas.md', rotas: [{ n: 1, nome: 'a', arquetipo: 'foto', segmento: 'segmento', acoes: [gerar] }] };
  const { resultado, chamadas } = await rodar({
    args: { ...ROTAS, python: o.python, dirs: { scripts: o.scripts } },
    overrides: { 'rotas:dirigir': () => rotasDir },
  });
  assert.equal(resultado.status, 'aguardando-rota', textoJson(resultado));
  const prompt = labels(chamadas, 'rough:')[0].prompt;
  assert.ok(!prompt.includes('INJETADO'));
  const argv = argvDoComando(comandoDe(prompt), o.cwd);
  for (const v of [gerar.prompt, gerar.saida, gerar.referencias[0], gerar.tamanho]) assert.ok(argv.includes(v), `argv deve conter ${v}: ${textoJson(argv)}`);
});

test('E1A1T4: os schemas do diretor e do portão aceitam acoes; o portão aceita manifesto', async () => {
  const { chamadas } = await rodar({ args: ROTAS });
  const rotaDir = labels(chamadas, 'rotas:dirigir')[0].opts.schema.properties.rotas.items.properties;
  assert.ok(rotaDir.acoes, 'rota do diretor aceita acoes');
  const { chamadas: c2 } = await rodar({ args: PRODUZIR });
  const props = labels(c2, 'portao:validar')[0].opts.schema.properties;
  assert.ok(props.manifesto, 'portão devolve o manifesto lido pelo operário');
  assert.ok(props.rota.properties.acoes, 'rota do portão aceita acoes');
});

// ── A2 ───────────────────────────────────────────────────────────────────────
const bloqueadoSemCusto = (r, nome) => {
  assert.equal(r.resultado.status, 'bloqueado', textoJson(r.resultado));
  assert.ok(textoJson(r.resultado).includes(nome), `o motivo deve nomear ${nome}`);
  assert.equal(labels(r.chamadas, 'composicao:').length, 0);
  assert.equal(labels(r.chamadas, 'producao:').length, 0, 'bloqueio antes de gastar geração de imagem');
};

test('E1A2T1: compositor fora do manifesto bloqueia com o nome do compositor', async () => {
  const r = await rodar({ args: PRODUZIR, overrides: portaoAcoes(rotaAcoes({}, [{ ...COMPOR, compositor: 'compor_inexistente' }])) });
  bloqueadoSemCusto(r, 'compor_inexistente');
});

test('E1A2T2: opção não declarada no manifesto bloqueia com o nome da opção', async () => {
  const r = await rodar({ args: PRODUZIR, overrides: portaoAcoes(rotaAcoes({}, [{ ...COMPOR, opcoes: { fonte: 'Inter', fundo_secreto: 'x' } }])) });
  bloqueadoSemCusto(r, 'fundo_secreto');
});

test('E1A2T3: chave de texto não declarada no manifesto bloqueia com o nome da chave', async () => {
  const r = await rodar({ args: PRODUZIR, overrides: portaoAcoes(rotaAcoes({}, [{ ...COMPOR, textos: { titulo: 'a', rodape_secreto: 'b' } }])) });
  bloqueadoSemCusto(r, 'rodape_secreto');
});

test('E1A2T4: ação compor sem manifesto devolvido pelo portão bloqueia citando o manifesto', async () => {
  const r = await rodar({ args: PRODUZIR, overrides: portaoCom(rotaAcoes(), { manifesto: undefined }) });
  bloqueadoSemCusto(r, 'manifesto');
});

// ── A3 ───────────────────────────────────────────────────────────────────────
const NASTY = ['com espaço', "aspas ' simples", 'aspas "duplas"', 'ponto;e;virgula', '$(echo PWNED)', '`echo PWNED`', 'a|b', 'a>b', 'linha1\nlinha2', "mix ' \" ; $(x) `y` | > \n fim", '$HOME', '*', 'barra\\invertida'];

test('E1A3T1: valores de texto com metacaracteres de shell chegam como UM argumento cada ao executável', async (t) => {
  const o = oficina(t, { executaveis: ['compor_x.py', 'validar_criativo.py'] });
  const textos = Object.fromEntries(NASTY.map((v, i) => [`t${i}`, v]));
  const { resultado, chamadas } = await rodar({
    args: { ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts } },
    overrides: { ...portaoAcoes(rotaAcoes({}, [{ ...COMPOR, textos }])), ...compSaida() },
  });
  assert.equal(resultado.status, 'verde', textoJson(resultado));
  const argv = argvDoComando(comandoDe(labels(chamadas, 'composicao:')[0].prompt), o.cwd);
  const { flags } = paraMapa(argv);
  NASTY.forEach((v, i) => assert.equal(flags[`--t${i}`], v, `texto t${i}`));
  assert.equal(existsSync(join(o.cwd, 'b')), false, 'o ">" não pode redirecionar saída');
  assert.ok(!argv.includes('PWNED'), 'nada foi executado por substituição de comando');
});

test('E1A3T2: prompt e referências do comando gerar com metacaracteres chegam como UM argumento cada', async (t) => {
  const o = oficina(t, { executaveis: ['gerar_imagem.py'] });
  const prompt = "foto de 'produto' \"azul\"; $(echo PWNED) `id` | tee x > y\nsegunda linha";
  const ref = "referencias/it's a;b.png";
  const gerar = { op: 'gerar', prompt, saida: 'marketing/criativos/base/s__rota1_rough.png', referencias: [ref], tamanho: '1024x1024' };
  const { resultado, chamadas } = await rodar({
    args: { ...ROTAS, python: o.python, dirs: { scripts: o.scripts } },
    overrides: { 'rotas:dirigir': () => ({ ok: true, slug: 'slug1', artefatoPath: 'rotas.md', rotas: [{ n: 1, nome: 'a', arquetipo: 'foto', segmento: 'segmento', acoes: [gerar] }] }) },
  });
  assert.equal(resultado.status, 'aguardando-rota', textoJson(resultado));
  const argv = argvDoComando(comandoDe(labels(chamadas, 'rough:')[0].prompt), o.cwd);
  assert.ok(argv.includes(prompt), 'o prompt é um único argumento');
  assert.ok(argv.includes(ref), 'a referência é um único argumento');
  assert.equal(existsSync(join(o.cwd, 'y')), false);
});

// ── A4 ───────────────────────────────────────────────────────────────────────
test('E1A4T1: python com espaço, DIR.scripts, {{BASE}}, saída, baseline e texto esperado passam por quoting na composição e no pre-flight', async (t) => {
  const scripts = 'scripts x;y z';
  const o = oficina(t, { scripts, pythonDir: 'py thon', executaveis: ['compor_x.py', 'validar_criativo.py'] });
  const baseEsc = "cands/cand 2;$(x)'.png";
  const marketing = 'mkt dir;`y`';
  const saida = `${marketing}/criativos/renders/segmento/slug1.png`;
  const baseline = "baselines/v1 a;'b'.png";
  const texto = 'Oferta; "do mês" $(z)';
  const rota = rotaAcoes({ baselinePath: baseline, textoEsperado: texto }, [{ ...COMPOR, saida }]);
  const { resultado, chamadas } = await rodar({
    args: { ...PRODUZIR, python: o.python, dirs: { scripts, marketing } },
    overrides: { ...portaoAcoes(rota), ...compSaida(saida),
      'producao:': () => ({ ok: true, candidatos: ['cands/cand 1.png', baseEsc], falhas: [] }),
      'selecao:': () => ({ escolhido: baseEsc, ranking: [] }) },
  });
  assert.equal(resultado.status, 'verde', textoJson(resultado));
  const comp = paraMapa(argvDoComando(comandoDe(labels(chamadas, 'composicao:')[0].prompt), o.cwd));
  assert.equal(comp.flags['--base'], baseEsc);
  assert.equal(comp.flags['--saida'], saida);
  const pre = paraMapa(argvDoComando(comandoDe(labels(chamadas, 'preflight:')[0].prompt), o.cwd));
  assert.equal(pre.pos[0] ?? pre.flags['--render'], saida);
  assert.equal(pre.flags['--baseline'], baseline);
  assert.equal(pre.flags['--texto-esperado'], texto);
});

test('E1A4T2: formato e arquétipo com metacaracteres chegam como UM argumento ao validador', async (t) => {
  const o = oficina(t, { executaveis: ['compor_x.py', 'validar_criativo.py'] });
  const formato = "feed 1'x;y";
  const arquetipo = 'arq $(z) b';
  const marketing = 'mkt o"f erta;y';
  const saida = `${marketing}/criativos/renders/segmento/slug1.png`;
  const rota = rotaAcoes({ arquetipo, semGeracao: true, formato, promptIa: null }, [{ op: 'compor', compositor: 'compor_x', saida, textos: { titulo: 'a' }, formato, opcoes: {}, sobrescrever: false }]);
  const { resultado, chamadas } = await rodar({
    args: { ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts, marketing } },
    overrides: { ...portaoAcoes(rota), ...compSaida(saida) },
  });
  assert.equal(resultado.status, 'verde', textoJson(resultado));
  const pre = paraMapa(argvDoComando(comandoDe(labels(chamadas, 'preflight:')[0].prompt), o.cwd));
  assert.equal(pre.pos[0] ?? pre.flags['--render'], saida);
  assert.equal(pre.flags['--formato'], formato);
  assert.equal(pre.flags['--arquetipo'], arquetipo);
  const comp = paraMapa(argvDoComando(comandoDe(labels(chamadas, 'composicao:')[0].prompt), o.cwd));
  assert.equal(comp.flags['--formato'], formato);
  assert.equal(comp.flags['--saida'], saida);
});

// ── A5 ───────────────────────────────────────────────────────────────────────
const ERRO_ARGS_SEM_AGENTE = async (args, rotulo) => {
  const { resultado, chamadas } = await rodar({ args });
  assert.equal(resultado.status, 'erro', `${rotulo}: ${textoJson(resultado)}`);
  assert.equal(chamadas.length, 0, `${rotulo}: nenhum agente antes da validação`);
};

test('E1A5T1: hoje só aceita AAAA-MM-DD de calendário real', async () => {
  for (const hoje of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '2026-09-31', '26-09-02', '2026-9-2', '2026-09-02T00:00', '2026/09/02', '20260902']) {
    await ERRO_ARGS_SEM_AGENTE({ ...ROTAS, hoje }, `hoje=${hoje}`);
  }
  const ok = await rodar({ args: { ...ROTAS, hoje: '2024-02-29' } });
  assert.equal(ok.resultado.status, 'aguardando-rota', 'ano bissexto real é aceito');
});

test('E1A5T2: briefPath, rotasPath e dirs.* rejeitam .. e caminho absoluto antes de qualquer agente', async () => {
  const ruins = ['../brief.md', '/etc/brief.md', 'a/../../b.md', '..', 'x/../../y'];
  for (const p of ruins) {
    await ERRO_ARGS_SEM_AGENTE({ ...ROTAS, briefPath: p }, `briefPath=${p}`);
    await ERRO_ARGS_SEM_AGENTE({ ...PRODUZIR, rotasPath: p }, `rotasPath=${p}`);
    for (const k of ['marketing', 'branding', 'contexto', 'scripts', 'manifesto']) {
      await ERRO_ARGS_SEM_AGENTE({ ...ROTAS, dirs: { [k]: p } }, `dirs.${k}=${p}`);
    }
  }
});

test('E1A5T3: slug devolvido pelo diretor só passa por ^[a-z0-9][a-z0-9_-]{0,80}$ e a violação para antes do rough', async () => {
  for (const slug of ['Slug', '-ab', '_ab', 'a b', 'a;b', 'a/b', '../x', '', 'a'.repeat(82), 'ação']) {
    const { resultado, chamadas } = await rodar({ args: ROTAS, overrides: { 'rotas:dirigir': () => ({ ...DEFAULTS['rotas:dirigir'](), slug }) } });
    assert.equal(resultado.status, 'erro', `slug=${JSON.stringify(slug)}: ${textoJson(resultado)}`);
    assert.equal(labels(chamadas, 'rough:').length, 0, `slug=${JSON.stringify(slug)}`);
  }
  const ok = await rodar({ args: ROTAS, overrides: { 'rotas:dirigir': () => ({ ...DEFAULTS['rotas:dirigir'](), slug: 'a'.repeat(81) }) } });
  assert.equal(ok.resultado.status, 'aguardando-rota', 'limite de 81 caracteres é aceito');
});

test('E1A5T4: slug da rota aprovada inválido encerra em erro antes da geração e da composição', async () => {
  for (const slug of ['Slug', 'a b', 'a;rm -rf x', '../x', 'a'.repeat(82)]) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: portaoCom({ ...ROTA, slug }) });
    assert.equal(resultado.status, 'erro', `slug=${slug}: ${textoJson(resultado)}`);
    for (const p of ['producao:', 'composicao:', 'preflight:', 'pacote:']) assert.equal(labels(chamadas, p).length, 0, `${slug}: ${p}`);
  }
});

test('E1A5T5: saída da ação fora do cwd (.. ou absoluta) encerra em erro antes de gerar ou compor', async () => {
  for (const saida of ['../fora.png', '/tmp/fora.png', 'a/../../fora.png']) {
    const r = await rodar({ args: PRODUZIR, overrides: portaoAcoes(rotaAcoes({}, [{ ...COMPOR, saida }])) });
    assert.equal(r.resultado.status, 'erro', `compor saida=${saida}: ${textoJson(r.resultado)}`);
    assert.equal(labels(r.chamadas, 'producao:').length, 0);
    assert.equal(labels(r.chamadas, 'composicao:').length, 0);
    const g = await rodar({ args: ROTAS, overrides: { 'rotas:dirigir': () => ({ ok: true, slug: 'slug1', artefatoPath: 'rotas.md', rotas: [{ n: 1, nome: 'a', arquetipo: 'foto', segmento: 'segmento', acoes: [{ op: 'gerar', prompt: 'p', saida, referencias: [], tamanho: '1024x1024' }] }] }) } });
    assert.equal(g.resultado.status, 'erro', `gerar saida=${saida}: ${textoJson(g.resultado)}`);
    assert.equal(labels(g.chamadas, 'rough:').length, 0);
  }
});

test('E1A5T6: symlink que sai do cwd, informado pelo operário no portão, encerra em erro antes de produzir', async () => {
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: portaoCom(ROTA, { symlinksForaDoCwd: ['marketing/criativos/base'] }) });
  assert.equal(resultado.status, 'erro', textoJson(resultado));
  assert.ok(textoJson(resultado).includes('marketing/criativos/base'));
  for (const p of ['producao:', 'composicao:', 'pacote:']) assert.equal(labels(chamadas, p).length, 0);
});

test('E1A5T7 controle: paths relativos dentro do cwd e slugs válidos seguem aceitos', async () => {
  const r = await rodar({ args: { ...ROTAS, briefPath: './docs/brief.md', dirs: { marketing: 'ws/marketing', scripts: './ws/scripts' } } });
  assert.equal(r.resultado.status, 'aguardando-rota', textoJson(r.resultado));
  const p = await rodar({ args: { ...PRODUZIR, rotasPath: 'docs/rotas.md' } });
  assert.equal(p.resultado.status, 'verde', textoJson(p.resultado));
});

// ── A6 ───────────────────────────────────────────────────────────────────────
const COMPOR_POS = { op: 'compor', compositor: 'compor_pos', saida: SAIDA, textos: { titulo: 'a' }, formato: 'feed', opcoes: { fonte: 'Inter' }, sobrescrever: false };

test('E1A6T1: a saída vem do campo saida, não do último argumento que não seja flag', async (t) => {
  const o = oficina(t, { executaveis: ['compor_pos.py', 'validar_criativo.py'] });
  const rota = rotaAcoes({ arquetipo: 'texto', promptIa: null }, [COMPOR_POS]);
  const { resultado, chamadas } = await rodar({
    args: { ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts } },
    overrides: { ...portaoAcoes(rota), ...compSaida() },
  });
  assert.equal(resultado.status, 'verde', textoJson(resultado));
  const comp = labels(chamadas, 'composicao:')[0].prompt;
  assert.doesNotMatch(comp, /último argumento que não seja flag/);
  const argv = argvDoComando(comandoDe(comp), o.cwd);
  assert.equal(argv[0], SAIDA, 'saída posicional declarada no manifesto');
  assert.equal(argv.at(-1), 'Inter', 'o último não-flag do comando NÃO é a saída');
  assert.equal(resultado.render, SAIDA);
  assert.equal(paraMapa(argvDoComando(comandoDe(labels(chamadas, 'preflight:')[0].prompt), o.cwd)).pos[0], SAIDA);
});

// ── A7 ───────────────────────────────────────────────────────────────────────
const PF_OK = { ok: true, artefatos: ['out.png'], falhas: [], checks: [{ nome: 'texto_fiel', status: 'pass' }] };

test('E1A7T1: com texto esperado o validador recebe --log-render com o log declarado no manifesto', async (t) => {
  const o = oficina(t, { executaveis: ['compor_x.py', 'validar_criativo.py'] });
  const rota = rotaAcoes({ textoEsperado: 'Oferta de verão' });
  const { resultado, chamadas } = await rodar({
    args: { ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts } },
    overrides: { ...portaoAcoes(rota), ...compSaida() },
  });
  assert.equal(resultado.status, 'verde', textoJson(resultado));
  const { flags } = paraMapa(argvDoComando(comandoDe(labels(chamadas, 'preflight:')[0].prompt), o.cwd));
  assert.equal(flags['--log-render'], 'logs/render.jsonl');
  assert.equal(flags['--texto-esperado'], 'Oferta de verão');
});

test('E1A7T2: logRender da ação validar prevalece sobre o do manifesto', async (t) => {
  const o = oficina(t, { executaveis: ['compor_x.py', 'validar_criativo.py'] });
  const validar = { op: 'validar', formato: 'feed', arquetipo: 'foto', textoEsperado: 'Oferta de verão', logRender: 'logs/meu log.jsonl' };
  const rota = rotaAcoes({ textoEsperado: 'Oferta de verão' }, [COMPOR, validar]);
  const { resultado, chamadas } = await rodar({
    args: { ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts } },
    overrides: { ...portaoAcoes(rota), ...compSaida() },
  });
  assert.equal(resultado.status, 'verde', textoJson(resultado));
  const { flags } = paraMapa(argvDoComando(comandoDe(labels(chamadas, 'preflight:')[0].prompt), o.cwd));
  assert.equal(flags['--log-render'], 'logs/meu log.jsonl');
});

test('R6c: logRender com {slug}, {segmento} e {hoje} (log datado por peça) é expandido em código, no manifesto e na ação validar', async (t) => {
  const o = oficina(t, { executaveis: ['compor_x.py', 'validar_criativo.py'] });
  const manifesto = { scripts: [{ ...MANIFESTO.scripts[0], logRender: 'logs/{segmento}/{hoje}-{slug}.jsonl' }] };
  const rota = rotaAcoes({ textoEsperado: 'Oferta de verão' });
  const a = await rodar({ args: { ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts } }, overrides: { ...portaoCom(rota, { manifesto }), ...compSaida() } });
  assert.equal(a.resultado.status, 'verde', textoJson(a.resultado));
  const { flags } = paraMapa(argvDoComando(comandoDe(labels(a.chamadas, 'preflight:')[0].prompt), o.cwd));
  assert.equal(flags['--log-render'], `logs/segmento/${PRODUZIR.hoje}-slug1.jsonl`);
  const validar = { op: 'validar', formato: 'feed', arquetipo: 'foto', textoEsperado: 'Oferta de verão', logRender: 'logs/{slug}.jsonl' };
  const b = await rodar({ args: { ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts } }, overrides: { ...portaoAcoes(rotaAcoes({ textoEsperado: 'Oferta de verão' }, [COMPOR, validar])), ...compSaida() } });
  assert.equal(b.resultado.status, 'verde', textoJson(b.resultado));
  assert.equal(paraMapa(argvDoComando(comandoDe(labels(b.chamadas, 'preflight:')[0].prompt), o.cwd)).flags['--log-render'], 'logs/slug1.jsonl');
});

test('E1A7T3: sem texto esperado o validador não recebe --log-render', async (t) => {
  const o = oficina(t, { executaveis: ['compor_x.py', 'validar_criativo.py'] });
  const { resultado, chamadas } = await rodar({
    args: { ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts } },
    overrides: { ...portaoAcoes(rotaAcoes({ textoEsperado: undefined })), ...compSaida() },
  });
  assert.equal(resultado.status, 'verde', textoJson(resultado));
  const { flags } = paraMapa(argvDoComando(comandoDe(labels(chamadas, 'preflight:')[0].prompt), o.cwd));
  assert.equal(flags['--log-render'], undefined);
});

test('E1A7T4: rota com acoes: pass com skip no check de texto fiel NÃO fecha verde: vira unknown e o run escala', async () => {
  const pfSkip = { ...PF_OK, checks: [{ nome: 'texto_fiel', status: 'skip' }, { nome: 'dimensao', status: 'pass' }] };
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: { ...portaoAcoes(rotaAcoes({ textoEsperado: 'Oferta de verão' })), ...compSaida(), 'preflight:': () => structuredClone(pfSkip) } });
  assert.equal(resultado.status, 'escalado', textoJson(resultado));
  assert.ok(textoJson(resultado).includes('unknown'), 'o veredito do pre-flight vira unknown');
  assert.equal(labels(chamadas, 'pacote:').length, 1, 'reports gravados mesmo sem verde');
  assert.ok(labels(chamadas, 'preflight:')[0].opts.schema.properties.checks, 'o schema do pre-flight aceita checks');
});

test('E1A7T5 controle: skip em outro check, ou texto_fiel pass, segue fechando verde', async () => {
  for (const checks of [[{ nome: 'baseline', status: 'skip' }, { nome: 'texto_fiel', status: 'pass' }], [{ nome: 'texto_fiel', status: 'pass' }]]) {
    const { resultado } = await rodar({ args: PRODUZIR, overrides: { 'preflight:': () => ({ ...PF_OK, checks: structuredClone(checks) }) } });
    assert.equal(resultado.status, 'verde', textoJson(checks));
  }
});

test('E1A7T6: rota com acoes e texto esperado: pre-flight sem checks também não fecha verde (fail-closed)', async () => {
  const { resultado } = await rodar({ args: PRODUZIR, overrides: { ...portaoAcoes(rotaAcoes({ textoEsperado: 'Oferta de verão' })), ...compSaida(), 'preflight:': () => ({ ok: true, artefatos: ['out.png'], falhas: [] }) } });
  assert.equal(resultado.status, 'escalado', textoJson(resultado));
  assert.ok(textoJson(resultado).includes('unknown'));
});

// ═════════════════════════════════════════════════════════════════════════════
// E3 (hermes 2.0.0): generalização do harness e remoção do comando legado.
//  - C2: `segmento` substitui a chave histórica do schema de rotas e o diretório
//    `renders/<segmento>/<slug>.png`; sem alias (a ausência da chave antiga é cobrada em
//    scripts/tests/publicacao.test.mjs, que varre o harness inteiro).
//  - C10: comando em string (comandoRough/comandoOverlay), marca de legado, args.rejeitarLegado e a
//    recusa de operadores de shell deixam de existir; toda rota traz `acoes`; rota sem `acoes`
//    encerra em erro com motivo nomeado antes de qualquer rough ou composição.
//  - C7: o critério de fidelidade específico de arte aplicada sai do enum da crítica, sem substituto.
// ═════════════════════════════════════════════════════════════════════════════
const ARGS_OFICINA = (o) => ({ ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts } });
const ROTAS_DIRETOR_SEM_ACOES = () => ({ ok: true, slug: 'slug1', artefatoPath: 'rotas.md', rotas: [
  { n: 1, nome: 'a', arquetipo: 'foto', segmento: 'segmento', comandoRough: 'cmd1' },
  { n: 2, nome: 'b', arquetipo: 'texto', segmento: 'segmento', comandoRough: 'cmd2' },
] });

test('C2: o schema de rota do diretor declara segmento e exige segmento e acoes', async () => {
  const { chamadas } = await rodar({ args: ROTAS });
  const rota = labels(chamadas, 'rotas:dirigir')[0].opts.schema.properties.rotas.items;
  assert.ok(rota.properties.segmento, 'a rota do diretor declara segmento');
  assert.ok(rota.required.includes('segmento'));
  assert.ok(rota.required.includes('acoes'));
});

test('C2: o schema da rota do portão declara segmento', async () => {
  const { chamadas } = await rodar({ args: PRODUZIR });
  const rota = labels(chamadas, 'portao:validar')[0].opts.schema.properties.rota;
  assert.ok(rota.properties.segmento, 'a rota do portão declara segmento');
});

test('C2: os prompts do diretor e do portão fixam a convenção renders/<segmento>/<slug>.png', async () => {
  const rotas = await rodar({ args: ROTAS });
  const produzir = await rodar({ args: PRODUZIR });
  for (const [nome, prompt] of [['diretor', labels(rotas.chamadas, 'rotas:dirigir')[0].prompt], ['portão', labels(produzir.chamadas, 'portao:validar')[0].prompt]]) {
    assert.ok(prompt.includes('renders/<segmento>/<slug>.png'), `${nome}: convenção de render ausente`);
  }
});

test('C2: rota aprovada sem segmento encerra em erro no Portão, citando o campo, antes de produzir ou compor', async (t) => {
  const o = oficina(t, { executaveis: ['compor_x.py', 'validar_criativo.py'] });
  const { segmento: _fora, ...semSegmento } = rotaAcoes();
  const { resultado, chamadas } = await rodar({ args: ARGS_OFICINA(o), overrides: { ...portaoAcoes(semSegmento), ...compSaida() } });
  assert.equal(resultado.status, 'erro', textoJson(resultado));
  assert.equal(resultado.fase, 'Portão');
  assert.match(resultado.detalhe, /segmento/);
  assert.equal(labels(chamadas, 'producao:').length, 0);
  assert.equal(labels(chamadas, 'composicao:').length, 0);
});

test('C10: nem o schema do diretor nem o do portão aceitam mais comando em string', async () => {
  const rotas = await rodar({ args: ROTAS });
  const produzir = await rodar({ args: PRODUZIR });
  const doDiretor = labels(rotas.chamadas, 'rotas:dirigir')[0].opts.schema.properties.rotas.items;
  const doPortao = labels(produzir.chamadas, 'portao:validar')[0].opts.schema.properties.rota;
  for (const campo of ['comandoRough', 'comandoOverlay']) {
    assert.equal(doDiretor.properties[campo], undefined, `diretor ainda aceita ${campo}`);
    assert.ok(!doDiretor.required.includes(campo), `diretor ainda exige ${campo}`);
    assert.equal(doPortao.properties[campo], undefined, `portão ainda aceita ${campo}`);
  }
});

test('C10: rota do diretor sem acoes encerra em erro nomeando acoes, antes de qualquer rough', async () => {
  const { resultado, chamadas } = await rodar({ args: ROTAS, overrides: { 'rotas:dirigir': ROTAS_DIRETOR_SEM_ACOES } });
  assert.equal(resultado.status, 'erro', textoJson(resultado));
  assert.match(resultado.detalhe, /acoes/);
  assert.equal(labels(chamadas, 'rough:').length, 0, 'nenhum rough gerado');
});

test('C10: rota do portão com comando em string e sem acoes encerra em erro nomeando acoes, sem produzir nem compor', async () => {
  const comComando = { ...ROTA, segmento: 'segmento', comandoOverlay: 'python compor.py --base {{BASE}} out.png' };
  delete comComando.acoes;
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: portaoCom(comComando) });
  assert.equal(resultado.status, 'erro', textoJson(resultado));
  assert.equal(resultado.fase, 'Portão');
  assert.match(resultado.detalhe, /acoes/);
  assert.equal(labels(chamadas, 'producao:').length, 0);
  assert.equal(labels(chamadas, 'composicao:').length, 0);
});

test('C10: o caminho legado deixou de existir no harness: sem marca legado, sem args.rejeitarLegado, sem recusa por operador', () => {
  assert.ok(!/legad[oa]/i.test(FONTE), `o harness ainda cita o caminho legado: ${(FONTE.match(/.*legad[oa].*/i) ?? [])[0]}`);
  assert.ok(!/OPERADOR_SHELL/.test(FONTE), 'a recusa de operador de shell não faz mais sentido sem comando em string');
});

test('C7: o enum de critérios da crítica tem os 17 slugs (a fidelidade ao mockup é critério próprio) e o prompt os pede todos', async () => {
  const { chamadas } = await rodar({ args: PRODUZIR });
  const crit = labels(chamadas, 'crit:')[0];
  const esperados = [
    'arquetipo_correto', 'rosto_nao_coberto', 'principios_duros', 'fidelidade_referencia', 'fidelidade_mockup', 'naturalidade_ia', 'texto_correto',
    'legibilidade_thumbnail', 'mensagem_completa', 'voz_da_marca', 'tres_segundos', 'miniatura', 'desfoque', 'exclusao',
    'coerencia_imagem_copy', 'verdade_comercial', 'headline_tem_ideia',
  ];
  const enumCriterio = crit.opts.schema.properties.findings.items.properties.criterio.enum;
  assert.deepEqual([...enumCriterio].sort(), [...esperados].sort(), 'o critério de fidelidade à arte do negócio original saiu; o do mockup é próprio');
  for (const slug of esperados) assert.ok(crit.prompt.includes(slug), `prompt do crit sem ${slug}`);
});

test('C2: args.segmentos inválido (não é lista de slugs sem repetição) encerra em erro de Args antes de qualquer agente', async () => {
  for (const segmentos of ['segmento', [], ['Com Espaço'], ['a/b'], ['..'], [''], [7], [null], ['a', 'a'], {}, null]) {
    const { resultado, chamadas } = await rodar({ args: { ...ROTAS, segmentos } });
    assert.equal(resultado.status, 'erro', JSON.stringify(segmentos));
    assert.equal(resultado.fase, 'Args');
    assert.match(resultado.detalhe, /segmentos/);
    assert.equal(chamadas.length, 0);
  }
});

test('C2: args.segmento (valor único da 2.0 inicial) deixou de existir e é recusado sem alias', async () => {
  const { resultado, chamadas } = await rodar({ args: { ...ROTAS, segmento: 'segmento' } });
  assert.equal(resultado.status, 'erro', textoJson(resultado));
  assert.equal(resultado.fase, 'Args');
  assert.match(resultado.detalhe, /args\.segmento deixou de existir/);
  assert.equal(chamadas.length, 0);
});

test('C2: com args.segmentos, o diretor recebe a lista e rota com segmento fora dela encerra em erro antes de qualquer rough', async () => {
  const ok = await rodar({ args: { ...ROTAS, segmentos: ['segmento', 'outro'] } });
  assert.equal(ok.resultado.status, 'aguardando-rota', textoJson(ok.resultado));
  assert.ok(labels(ok.chamadas, 'rotas:dirigir')[0].prompt.includes('["segmento","outro"]'));
  const { resultado, chamadas } = await rodar({ args: { ...ROTAS, segmentos: ['outro'] } });
  assert.equal(resultado.status, 'erro', textoJson(resultado));
  assert.match(resultado.detalhe, /segmento/);
  assert.equal(labels(chamadas, 'rough:').length, 0);
});

test('C2: rotas de segmentos diferentes na mesma execução passam quando todos estão na lista (o segmento é por rota)', async () => {
  const rotas = [{ n: 1, nome: 'a', arquetipo: 'foto', segmento: 'segmento', acoes: [GERAR, COMPOR] }, { n: 2, nome: 'b', arquetipo: 'texto', segmento: 'outro', acoes: [GERAR, COMPOR] }];
  const overrides = { 'rotas:dirigir': () => ({ ...DEFAULTS['rotas:dirigir'](), rotas }) };
  const ok = await rodar({ args: { ...ROTAS, segmentos: ['segmento', 'outro'] }, overrides });
  assert.equal(ok.resultado.status, 'aguardando-rota', textoJson(ok.resultado));
  const fora = await rodar({ args: { ...ROTAS, segmentos: ['segmento', 'terceiro'] }, overrides });
  assert.equal(fora.resultado.status, 'erro', textoJson(fora.resultado));
  assert.match(fora.resultado.detalhe, /rota 2.*outro/);
});

test('C2: no estágio B a rota aprovada de um segmento da lista produz sob a pasta do próprio segmento; fora da lista encerra no Portão', async () => {
  const saida = `${PASTA.replace('/segmento/', '/outro/')}slug1.png`;
  const rota = rotaAcoes({ segmento: 'outro' }, [{ ...COMPOR, saida }]);
  const bom = await rodar({ args: { ...PRODUZIR, segmentos: ['segmento', 'outro'] }, overrides: { ...portaoAcoes(rota), ...compSaida(saida) } });
  assert.equal(bom.resultado.status, 'verde', textoJson(bom.resultado));
  const { resultado, chamadas } = await rodar({ args: { ...PRODUZIR, segmentos: ['segmento'] }, overrides: { ...portaoAcoes(rota), ...compSaida(saida) } });
  assert.equal(resultado.status, 'erro', textoJson(resultado));
  assert.equal(resultado.fase, 'Portão');
  assert.match(resultado.detalhe, /segmento/);
  assert.equal(labels(chamadas, 'producao:').length, 0);
  assert.equal(labels(chamadas, 'composicao:').length, 0);
  // a saída sob a pasta de OUTRO segmento da lista (que não é o da rota) continua bloqueada
  const cruzada = await rodar({ args: { ...PRODUZIR, segmentos: ['segmento', 'outro'] }, overrides: { ...portaoAcoes(rotaAcoes({ segmento: 'segmento' }, [{ ...COMPOR, saida }])), ...compSaida(saida) } });
  assert.equal(cruzada.resultado.status, 'bloqueado', textoJson(cruzada.resultado));
});

// ── Revisão independente do PR 18 ────────────────────────────────────────────
// Cada guarda do caminho estruturado e do legado tem pelo menos um caso que falha sem ela; o
// legado mantém o veredito da 1.5.8 onde a revisão apontou regressão de compatibilidade.
const ROTAS_COM_ROUGH = (comandoRough, extra = {}) => ({ 'rotas:dirigir': () => ({ ok: true, slug: 'slug1', artefatoPath: 'rotas.md', rotas: [{ n: 1, nome: 'a', arquetipo: 'foto', segmento: 'segmento', comandoRough, ...extra }] }) });

const RECUSADOS = [
  'out.png | tee x', 'out.png > x', 'out.png < x', 'out.png ; rm x', 'out.png & rm x', 'out.png && rm x',
  '"ok" | tee x', "'ok' ; rm x", '"ok"> x', '"$(echo x)"', '"a `id` b"', '"${HOME}"', '"$HOME"', '"x $1"', '$HOME/o', '${HOME}', '$(id)', '`id`',
  '"aberta', "'aberta", '"a\\"; rm x', 'out.png\nrm x', '"a\nb"', "'a\nb'", 'out.png\\\nrm x',
];

test('E1R7T1: args.python com espaço no caminho funciona quando é caminho (relativo ou absoluto) e é recusado quando é lançador com argumentos', async () => {
  for (const python of ['meu venv/bin/python', '.venv dir/bin/python', 'venv novo\\Scripts\\python.exe', '/dir com espaço/venv/bin/python', './meu venv/bin/python']) {
    const { resultado } = await rodar({ args: { ...PRODUZIR, python } });
    assert.equal(resultado.status, 'verde', `python=${python}: ${textoJson(resultado)}`);
  }
  for (const python of ['uv run .venv/bin/python', 'poetry run bin/python', 'env FOO=1 python', 'FOO=1 .venv/bin/python', 'meu venv/bin/python -m x', 'python -m x']) {
    await ERRO_ARGS_SEM_AGENTE({ ...PRODUZIR, python }, `python=${JSON.stringify(python)}`);
  }
});

test('E1R7T2: o comando montado com python de caminho relativo com espaço executa como UM argv[0]', async (t) => {
  const o = oficina(t, { executaveis: ['compor_x.py', 'validar_criativo.py'], pythonDir: 'meu venv/bin' });
  const python = 'meu venv/bin/py';
  const saida = SAIDA;
  const { resultado, chamadas } = await rodar({
    args: { ...PRODUZIR, python, dirs: { scripts: o.scripts } },
    overrides: { ...portaoAcoes(rotaAcoes({}, [{ ...COMPOR, saida }])), ...compSaida(saida) },
  });
  assert.equal(resultado.status, 'verde', textoJson(resultado));
  const argv = argvDoComando(comandoDe(labels(chamadas, 'composicao:')[0].prompt), o.cwd);
  assert.ok(Array.isArray(argv));
});

// ── Rota legada: veredito da 1.5.8 preservado ────────────────────────────────
// ── Manifesto presente exige acoes ───────────────────────────────────────────
// ── Legado: render e baseline passam por pathSeguro ──────────────────────────
test('E1R6T2: baselinePath inválido é erro no portão; baseline válida segue', async () => {
  for (const baselinePath of ['../../../etc/passwd', '/abs/base.png', '-base.png', ' base.png', 'base.png ', '$HOME/base.png', 'a\nb.png']) {
    for (const [nome, ov] of [['acoes', { ...portaoAcoes(rotaAcoes({ baselinePath })), ...compSaida() }]]) {
      const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: ov });
      assert.equal(resultado.status, 'erro', `${nome} ${JSON.stringify(baselinePath)}: ${textoJson(resultado)}`);
      assert.match(resultado.detalhe, /baselinePath/);
      for (const p of ['producao:', 'composicao:', 'preflight:']) assert.equal(labels(chamadas, p).length, 0, `${nome} ${p}`);
    }
  }
  const ok = await rodar({ args: PRODUZIR, overrides: { ...portaoAcoes(rotaAcoes({ baselinePath: 'branding/base lines/v1.png' })), ...compSaida() } });
  assert.equal(ok.resultado.status, 'verde', textoJson(ok.resultado));
});

// ── Menores do caminho estruturado ───────────────────────────────────────────
const manifestoCom = (campos, extra = {}) => ({ scripts: [{ nome: 'compor_y', executavel: 'compor_y.py', campos, logRender: 'logs/render.jsonl', sobrescrever: '--sobrescrever', ...extra }] });
const composY = (extra = {}) => ({ op: 'compor', compositor: 'compor_y', saida: SAIDA, sobrescrever: false, ...extra });
const rotaTexto = (acoes) => rotaAcoes({ arquetipo: 'texto', promptIa: null }, acoes);

test('E1R10T1: posição repetida ou com buraco no manifesto bloqueia nomeando a posição', async () => {
  const repetida = manifestoCom({ saida: { posicao: 0 }, formato: { posicao: 0 } });
  const a = await rodar({ args: PRODUZIR, overrides: portaoCom(rotaTexto([composY()]), { manifesto: repetida }) });
  bloqueadoSemCusto(a, 'posição 0 repetida');
  const buraco = manifestoCom({ saida: { posicao: 0 }, textos: { titulo: { posicao: 2 } } });
  const b = await rodar({ args: PRODUZIR, overrides: portaoCom(rotaTexto([composY()]), { manifesto: buraco }) });
  bloqueadoSemCusto(b, 'posição 1 ausente');
  const comeco = manifestoCom({ saida: { posicao: 1 } });
  const c = await rodar({ args: PRODUZIR, overrides: portaoCom(rotaTexto([composY()]), { manifesto: comeco }) });
  bloqueadoSemCusto(c, 'posição 0 ausente');
});

test('E1R10T2: ação que omite um posicional do meio desloca os argumentos: erro nomeado; omitir só os últimos segue', async () => {
  const manifesto = manifestoCom({ saida: { posicao: 0 }, formato: { posicao: 1 }, textos: { titulo: { posicao: 2 } } });
  const ruim = await rodar({ args: PRODUZIR, overrides: { ...portaoCom(rotaTexto([composY({ textos: { titulo: 'a' } })]), { manifesto }), ...compSaida() } });
  assert.equal(ruim.resultado.status, 'erro', textoJson(ruim.resultado));
  assert.match(ruim.resultado.detalhe, /posicional 1/);
  assert.equal(labels(ruim.chamadas, 'composicao:').length, 0);
  const bom = await rodar({ args: PRODUZIR, overrides: { ...portaoCom(rotaTexto([composY({ formato: 'feed' })]), { manifesto }), ...compSaida() } });
  assert.equal(bom.resultado.status, 'verde', textoJson(bom.resultado));
});

test('E1R10T3: args.python é UM executável: comando composto, espaço de borda, "-" inicial e quebra de linha são erro de Args', async () => {
  for (const python of ['uv run python', 'python -m venv_x', ' .venv/bin/python', '.venv/bin/python ', '-python', '.venv/bin/python\nrm', 123]) {
    await ERRO_ARGS_SEM_AGENTE({ ...PRODUZIR, python }, `python=${JSON.stringify(python)}`);
  }
  for (const python of ['.venv/bin/python', '/dir com espaço/venv/bin/python', 'C:\\Program Files\\Py\\python.exe', './meu venv/bin/python', 'python3']) {
    const { resultado } = await rodar({ args: { ...PRODUZIR, python } });
    assert.equal(resultado.status, 'verde', `python=${python}: ${textoJson(resultado)}`);
  }
  const msg = await rodar({ args: { ...PRODUZIR, python: 'uv run python' } });
  assert.match(msg.resultado.detalhe, /uv run python/);
});

test('E1R10T4: path com espaço de borda ou "$" não entra cru na prosa: rotasPath, briefPath, dirs.* e artefatoPath do diretor', async () => {
  for (const p of [' /etc/passwd', 'rotas.md ', '$HOME/rotas.md', 'a/$B/x.md', '\trotas.md']) {
    await ERRO_ARGS_SEM_AGENTE({ ...PRODUZIR, rotasPath: p }, `rotasPath=${JSON.stringify(p)}`);
    await ERRO_ARGS_SEM_AGENTE({ ...ROTAS, briefPath: p }, `briefPath=${JSON.stringify(p)}`);
    for (const k of ['marketing', 'branding', 'contexto', 'scripts', 'manifesto']) await ERRO_ARGS_SEM_AGENTE({ ...ROTAS, dirs: { [k]: p } }, `dirs.${k}=${JSON.stringify(p)}`);
    const { resultado, chamadas } = await rodar({ args: ROTAS, overrides: { 'rotas:dirigir': () => ({ ...DEFAULTS['rotas:dirigir'](), artefatoPath: p }) } });
    assert.equal(resultado.status, 'erro', `artefatoPath=${JSON.stringify(p)}`);
    assert.equal(labels(chamadas, 'rough:').length, 0);
  }
});

// ── Cada guarda do caminho estruturado tem o seu caso ────────────────────────
test('E1R1-a: valor com "-" inicial em flag longa vai como --flag=valor (texto, gerar, tamanho, provedor, pre-flight)', async (t) => {
  const o = oficina(t, { executaveis: ['compor_x.py', 'validar_criativo.py', 'gerar_imagem.py'] });
  const rota = rotaAcoes({ formato: '-largo', arquetipo: 'foto', textoEsperado: '-30% hoje' }, [{ ...COMPOR, textos: { titulo: '-x' }, formato: '-feed' }]);
  const { resultado, chamadas } = await rodar({ args: { ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts } }, overrides: { ...portaoAcoes(rota), ...compSaida() } });
  assert.equal(resultado.status, 'verde', textoJson(resultado));
  const comp = argvDoComando(comandoDe(labels(chamadas, 'composicao:')[0].prompt), o.cwd);
  assert.ok(comp.includes('--titulo=-x'), textoJson(comp));
  assert.ok(comp.includes('--formato=-feed'), textoJson(comp));
  const pre = argvDoComando(comandoDe(labels(chamadas, 'preflight:')[0].prompt), o.cwd);
  assert.ok(pre.includes('--formato=-largo'), textoJson(pre));
  assert.ok(pre.includes('--texto-esperado=-30% hoje'), textoJson(pre));
  const g = { op: 'gerar', prompt: '-rm -rf x', saida: 'marketing/criativos/base/s__rota1_rough.png', tamanho: '-1x1', provedor: '-p' };
  const r = await rodar({ args: { ...ROTAS, python: o.python, dirs: { scripts: o.scripts } }, overrides: ROTAS_COM_ROUGH('x', { acoes: [g] }) });
  const argv = argvDoComando(comandoDe(labels(r.chamadas, 'rough:')[0].prompt), o.cwd);
  assert.equal(argv[0], ' -rm -rf x', 'prompt posicional ganha espaço à frente e não vira opção');
  assert.ok(argv.includes('--tamanho=-1x1') && argv.includes('--provedor=-p'), textoJson(argv));
  const arq = await rodar({ args: { ...PRODUZIR, python: o.python, dirs: { scripts: o.scripts } }, overrides: { ...portaoAcoes(rotaAcoes({ arquetipo: '-foto' })), ...compSaida() } });
  assert.ok(argvDoComando(comandoDe(labels(arq.chamadas, 'preflight:')[0].prompt), o.cwd).includes('--arquetipo=-foto'));
});

const MANIFESTO_CURTO = manifestoCom({ saida: { posicao: 0 }, formato: { flag: '-f' }, textos: { titulo: { flag: '-t' } }, opcoes: { fonte: { posicao: 1 } } });
const composCurto = (extra) => composY({ formato: 'feed', textos: { titulo: 'a' }, opcoes: { fonte: 'Inter' }, ...extra });

test('E1R1-b: valor com "-" inicial em flag curta ou posicional é erro nomeado; flag longa aceita', async () => {
  for (const [campo, extra] of [['compor.textos.titulo', { textos: { titulo: '-x' } }], ['compor.opcoes.fonte', { opcoes: { fonte: '-x' } }], ['compor.formato', { formato: '-x' }]]) {
    const r = await rodar({ args: PRODUZIR, overrides: { ...portaoCom(rotaTexto([composCurto(extra)]), { manifesto: MANIFESTO_CURTO }), ...compSaida() } });
    assert.equal(r.resultado.status, 'erro', `${campo}: ${textoJson(r.resultado)}`);
    assert.ok(textoJson(r.resultado).includes(campo), campo);
    assert.equal(labels(r.chamadas, 'composicao:').length, 0);
  }
  const ok = await rodar({ args: PRODUZIR, overrides: { ...portaoCom(rotaTexto([composCurto()]), { manifesto: MANIFESTO_CURTO }), ...compSaida() } });
  assert.equal(ok.resultado.status, 'verde', textoJson(ok.resultado));
});

test('E1R1-c: cada cláusula do pathSeguro recusa a sua entrada (saída da ação compor)', async () => {
  const ruins = ['-x.png', 'a\nb.png', '~/x.png', 'C:\\x.png', 'c:x.png', '\\x.png', 'a\\..\\x.png', 'a/../x.png', ' x.png', 'x.png ', '..', '', '/x.png'];
  for (const saida of ruins) {
    const r = await rodar({ args: PRODUZIR, overrides: portaoAcoes(rotaAcoes({}, [{ ...COMPOR, saida }])) });
    assert.equal(r.resultado.status, 'erro', `saida=${JSON.stringify(saida)}: ${textoJson(r.resultado)}`);
    assert.equal(labels(r.chamadas, 'composicao:').length, 0);
  }
  const ref = await rodar({ args: ROTAS, overrides: ROTAS_COM_ROUGH('x', { acoes: [{ op: 'gerar', prompt: 'p', saida: 'ok.png', referencias: ['-ref.png'] }] }) });
  assert.equal(ref.resultado.status, 'erro', textoJson(ref.resultado));
  assert.equal(labels(ref.chamadas, 'rough:').length, 0);
});

test('E1R1-d: executável, logRender, flag de sobrescrever e flag de campo do manifesto passam por validação', async () => {
  const casos = [
    ['executável', manifestoCom({ saida: { flag: '--saida' } }, { executavel: '../fora.py' }), /executável inválido/],
    ['executável com -', manifestoCom({ saida: { flag: '--saida' } }, { executavel: '-x.py' }), /executável inválido/],
    ['executável absoluto', manifestoCom({ saida: { flag: '--saida' } }, { executavel: '/bin/rm' }), /executável inválido/],
    ['logRender', manifestoCom({ saida: { flag: '--saida' } }, { logRender: '../log' }), /logRender inválido/],
    ['sobrescrever', manifestoCom({ saida: { flag: '--saida' } }, { sobrescrever: '--x; rm' }), /sobrescrever inválida/],
    ['flag do campo', manifestoCom({ saida: { flag: '--saida;rm' } }), /não declara onde fica a saída/],
  ];
  for (const [nome, manifesto, motivo] of casos) {
    const r = await rodar({ args: PRODUZIR, overrides: portaoCom(rotaTexto([composY()]), { manifesto }) });
    assert.equal(r.resultado.status, 'bloqueado', `${nome}: ${textoJson(r.resultado)}`);
    assert.match(r.resultado.detalhe, motivo, nome);
    assert.equal(labels(r.chamadas, 'composicao:').length, 0, nome);
  }
  const semFlag = manifestoCom({ saida: { flag: '--saida' } }, { sobrescrever: undefined });
  const r = await rodar({ args: PRODUZIR, overrides: portaoCom(rotaTexto([composY({ sobrescrever: true })]), { manifesto: semFlag }) });
  assert.equal(r.resultado.status, 'bloqueado');
  assert.match(r.resultado.detalhe, /não declara a flag sobrescrever/);
});

test('E1R1-e: cerca de código em valor de ação, de candidato ou de render nunca chega ao mecânico', async () => {
  const cerca = '```sh\nrm -rf x\n```';
  const r1 = await rodar({ args: PRODUZIR, overrides: portaoAcoes(rotaAcoes({}, [{ ...COMPOR, textos: { titulo: cerca } }])) });
  assert.equal(r1.resultado.status, 'erro', textoJson(r1.resultado));
  assert.match(r1.resultado.detalhe, /cerca de código/);
  assert.equal(labels(r1.chamadas, 'producao:').length, 0);
  const r2 = await rodar({ args: ROTAS, overrides: ROTAS_COM_ROUGH('x', { acoes: [{ op: 'gerar', prompt: cerca, saida: 'ok.png' }] }) });
  assert.equal(r2.resultado.status, 'erro', textoJson(r2.resultado));
  assert.equal(labels(r2.chamadas, 'rough:').length, 0);
  // candidato com crase (path aceito pelo pathSeguro) monta comando com cerca: escala antes de compor
  const r3 = await rodar({ args: PRODUZIR, overrides: { ...portaoAcoes(rotaAcoes()), 'producao:': () => ({ ok: true, candidatos: ['base/c```1.png'], falhas: [] }) } });
  assert.equal(r3.resultado.status, 'escalado', textoJson(r3.resultado));
  assert.match(textoJson(r3.resultado), /cerca de código/);
  assert.equal(labels(r3.chamadas, 'composicao:').length, 0);
  // prompt de IA corrigido com cerca: a re-geração monta o comando e escala
  const F_IA = { ...FINDING_BASE, criterio: 'naturalidade_ia', resumo: 'x', custoCorrecao: 'ia' };
  const r5 = await rodar({ args: PRODUZIR, overrides: { ...portaoAcoes(rotaAcoes({}, [COMPOR])), ...compSaida(), 'crit:': () => ({ findings: [F_IA] }), 'correcao:': () => ({ resumo: 'r', acoes: null, comandoOverlay: null, promptIa: cerca, copyCorrigida: null }) } });
  assert.equal(r5.resultado.status, 'escalado', textoJson(r5.resultado));
  assert.match(textoJson(r5.resultado), /cerca de código/);
  assert.equal(labels(r5.chamadas, 'producao:').length, 1, 'só a rodada inicial gerou');
});

test('E1R1-f: no máximo uma ação por op; validar.render precisa ser a saída do compor', async () => {
  const dup = await rodar({ args: PRODUZIR, overrides: portaoAcoes(rotaAcoes({}, [COMPOR, { ...COMPOR, saida: 'renders/segmento/outro.png' }])) });
  assert.equal(dup.resultado.status, 'erro', textoJson(dup.resultado));
  assert.match(dup.resultado.detalhe, /mais de uma ação compor/);
  const render = await rodar({ args: PRODUZIR, overrides: portaoAcoes(rotaAcoes({}, [COMPOR, { op: 'validar', render: 'renders/segmento/outro.png' }])) });
  assert.equal(render.resultado.status, 'erro', textoJson(render.resultado));
  assert.match(render.resultado.detalhe, /validar\.render difere/);
  const ok = await rodar({ args: PRODUZIR, overrides: { ...portaoAcoes(rotaAcoes({}, [COMPOR, { op: 'validar', render: SAIDA }])), ...compSaida() } });
  assert.equal(ok.resultado.status, 'verde', textoJson(ok.resultado));
});

test('E1R1-g: texto esperado sem logRender bloqueia no portão (ação validar ou rota); candidato com path inválido escala', async () => {
  const semLog = manifestoCom({ saida: { flag: '--saida' } }, { logRender: undefined });
  const a = await rodar({ args: PRODUZIR, overrides: portaoCom(rotaTexto([composY()]), { manifesto: semLog }) });
  assert.equal(a.resultado.status, 'bloqueado');
  const b = await rodar({ args: PRODUZIR, overrides: portaoCom({ ...rotaTexto([composY(), { op: 'validar', textoEsperado: 'Oferta' }]) }, { manifesto: semLog }) });
  assert.equal(b.resultado.status, 'bloqueado', textoJson(b.resultado));
  assert.match(b.resultado.detalhe, /logRender/);
  assert.equal(labels(b.chamadas, 'producao:').length + labels(b.chamadas, 'composicao:').length, 0);
  const c = await rodar({ args: PRODUZIR, overrides: portaoCom(rotaTexto([composY(), { op: 'validar', textoEsperado: 'Oferta', logRender: 'logs/a.jsonl' }]), { manifesto: semLog }) });
  assert.notEqual(c.resultado.status, 'bloqueado', 'logRender na ação validar libera');
  for (const candidato of ['../fora.png', '-opcao.png', '/abs.png']) {
    const r = await rodar({ args: PRODUZIR, overrides: { ...portaoAcoes(rotaAcoes()), 'producao:': () => ({ ok: true, candidatos: [candidato], falhas: [] }) } });
    assert.equal(r.resultado.status, 'escalado', `${candidato}: ${textoJson(r.resultado)}`);
    assert.equal(labels(r.chamadas, 'composicao:').length, 0, candidato);
  }
});

test('E1R1-h: a saída declarada na ação compor precisa ser a confirmada pelo mecânico', async () => {
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: { ...portaoAcoes(rotaAcoes()), ...compSaida('renders/segmento/outra.png') } });
  assert.equal(resultado.status, 'escalado', textoJson(resultado));
  assert.match(textoJson(resultado), /não confirmou a saída declarada/);
  assert.equal(labels(chamadas, 'preflight:').length, 0);
  const ok = await rodar({ args: PRODUZIR, overrides: { ...portaoAcoes(rotaAcoes()), ...compSaida(`./${SAIDA}`) } });
  assert.equal(ok.resultado.status, 'verde', 'prefixo ./ é normalizado');
});

test('E1R1-i: acoes corrigidas passam pela mesma validação do plano inicial; correção válida é aceita', async () => {
  const comporMud = { ...COMPOR, textos: { titulo: 'Novo título' } };
  const casos = [
    ['compositor fora do manifesto', [{ ...COMPOR, compositor: 'nao_existe' }], /acoes corrigidas recusadas: compositor fora do manifesto/],
    ['sem ação compor', [{ op: 'validar', formato: 'feed' }], /sem ação compor/],
    ['sem base {{BASE}}', [{ ...COMPOR, base: undefined }], /sem base \{\{BASE\}\}/],
    ['texto esperado sem logRender', [{ ...comporMud, compositor: 'compor_sem_log' }], /texto esperado sem logRender/],
    ['saída muda', [{ ...comporMud, saida: 'renders/segmento/mudou.png' }], /a saída da ação compor não muda/],
  ];
  const manifesto = { scripts: [...MANIFESTO.scripts, { ...MANIFESTO.scripts[0], nome: 'compor_sem_log', logRender: undefined }] };
  for (const [nome, acoes, aviso] of casos) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      ...portaoCom(rotaAcoes({ textoEsperado: 'Oferta de verão' }), { manifesto }), ...compSaida(),
      'crit:': () => ({ findings: [CRIT_OVERLAY] }),
      'correcao:': () => ({ resumo: 'r', acoes, comandoOverlay: null, promptIa: null, copyCorrigida: null }),
    } });
    assert.equal(resultado.status, 'escalado', `${nome}: ${textoJson(resultado)}`);
    assert.ok(resultado.detalhe.avisos.some((a) => aviso.test(a)), `${nome}: ${textoJson(resultado.detalhe.avisos)}`);
    assert.equal(labels(chamadas, 'composicao:').length, 1, `${nome}: a composição não é refeita com ação recusada`);
  }
  let vez = 0;
  const ok = await rodar({ args: PRODUZIR, overrides: {
    ...portaoAcoes(rotaAcoes()), ...compSaida(),
    'crit:': () => (vez++ === 0 ? { findings: [CRIT_OVERLAY] } : { findings: [] }),
    'correcao:': () => ({ resumo: 'r', acoes: [comporMud], comandoOverlay: null, promptIa: null, copyCorrigida: null }),
  } });
  assert.equal(ok.resultado.status, 'verde', textoJson(ok.resultado));
  assert.ok(labels(ok.chamadas, 'composicao:')[1].prompt.includes('Novo título'));
});

test('E1R1-j: no estágio de rotas, acoes sem ação gerar em rota com imagem IA bloqueia; arquétipo texto e semGeracao seguem sem rough', async () => {
  const gerarSem = [{ op: 'compor', compositor: 'compor_x', saida: SAIDA }];
  const ruim = await rodar({ args: ROTAS, overrides: ROTAS_COM_ROUGH('x', { acoes: gerarSem }) });
  assert.equal(ruim.resultado.status, 'bloqueado', textoJson(ruim.resultado));
  assert.match(ruim.resultado.detalhe, /sem ação gerar/);
  assert.equal(labels(ruim.chamadas, 'rough:').length, 0);
  for (const extra of [{ arquetipo: 'texto' }, { semGeracao: true }]) {
    const ok = await rodar({ args: ROTAS, overrides: ROTAS_COM_ROUGH('x', { acoes: gerarSem, ...extra }) });
    assert.equal(ok.resultado.status, 'aguardando-rota', textoJson(extra));
    assert.equal(labels(ok.chamadas, 'rough:').length, 0, 'sem geração não há rough');
  }
});

// ── Revisão do PR 20, item 4: o segmento e a saída do compor amarram o diretório de render ──────────
const PASTA = 'marketing/criativos/renders/segmento/';

test('H1: segmento da rota que não é slug encerra em erro com ou sem args.segmentos, antes de produzir ou compor', async () => {
  for (const segmento of ['../../fora', '/abs', 'Com Espaço', 'a/b', '..', '']) {
    for (const args of [PRODUZIR, { ...PRODUZIR, segmentos: ['segmento'] }]) {
      const { resultado, chamadas } = await rodar({ args, overrides: { ...portaoAcoes(rotaAcoes({ segmento })), ...compSaida() } });
      assert.equal(resultado.status, 'erro', `${JSON.stringify(segmento)} ${JSON.stringify(args.segmentos)}: ${textoJson(resultado)}`);
      assert.match(resultado.detalhe, /segmento/);
      assert.equal(labels(chamadas, 'producao:').length + labels(chamadas, 'composicao:').length, 0, JSON.stringify(segmento));
    }
  }
});

test('H2: compor.saida fora de <marketing>/criativos/renders/<segmento>/ bloqueia, com e sem args.segmentos', async () => {
  const fora = ['branding/principios-criativos.png', 'marketing/criativos/renders/outro/slug1.png', 'marketing/criativos/base/slug1.png', 'renders/segmento/slug1.png', 'marketing/criativos/renders/segmentox/slug1.png'];
  for (const saida of fora) {
    for (const args of [PRODUZIR, { ...PRODUZIR, segmentos: ['segmento'] }]) {
      const rota = rotaAcoes({}, [{ ...COMPOR, saida }]);
      const { resultado, chamadas } = await rodar({ args, overrides: { ...portaoAcoes(rota), ...compSaida(saida) } });
      assert.equal(resultado.status, 'bloqueado', `${saida} ${JSON.stringify(args.segmentos)}: ${textoJson(resultado)}`);
      assert.equal(resultado.fase, 'Portão');
      assert.ok(resultado.detalhe.includes(PASTA), saida);
      assert.equal(labels(chamadas, 'producao:').length + labels(chamadas, 'composicao:').length, 0, saida);
    }
  }
});

test('H2b: compor.saida sob a pasta do segmento mas com outro slug, subpasta ou extensão diferente de png bloqueia antes de gerar', async () => {
  const fora = [`${PASTA}outro-slug.png`, `${PASTA}sub/slug1.png`, `${PASTA}slug1.jpg`, `${PASTA}slug1.png.bak`, `${PASTA}slug1`, `${PASTA}Slug1.png`];
  for (const saida of fora) {
    const rota = rotaAcoes({}, [{ ...COMPOR, saida }]);
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: { ...portaoAcoes(rota), ...compSaida(saida) } });
    assert.equal(resultado.status, 'bloqueado', `${saida}: ${textoJson(resultado)}`);
    assert.equal(resultado.fase, 'Portão');
    assert.equal(labels(chamadas, 'producao:').length + labels(chamadas, 'composicao:').length, 0, saida);
  }
  const certo = await rodar({ args: PRODUZIR, overrides: { ...portaoAcoes(rotaAcoes({}, [{ ...COMPOR, saida: `${PASTA}slug1.png` }])), ...compSaida(`${PASTA}slug1.png`) } });
  assert.equal(certo.resultado.status, 'verde', textoJson(certo.resultado));
});

test('H3: saída sob a pasta do segmento passa, com ./ na frente e com dirs.marketing próprio', async () => {
  const dentro = await rodar({ args: PRODUZIR, overrides: { ...portaoAcoes(rotaAcoes({}, [{ ...COMPOR, saida: `./${PASTA}slug1.png` }])), ...compSaida(`./${PASTA}slug1.png`) } });
  assert.equal(dentro.resultado.status, 'verde', textoJson(dentro.resultado));
  const saida = 'mkt/criativos/renders/segmento/slug1.png';
  const proprio = await rodar({ args: { ...PRODUZIR, dirs: { marketing: 'mkt' } }, overrides: { ...portaoAcoes(rotaAcoes({}, [{ ...COMPOR, saida }])), ...compSaida(saida) } });
  assert.equal(proprio.resultado.status, 'verde', textoJson(proprio.resultado));
});

test('H4: o portão pergunta pelo arquivo da saída da ação compor (o que será sobrescrito), não por um path inferido', async () => {
  const { chamadas } = await rodar({ args: PRODUZIR });
  const prompt = labels(chamadas, 'portao:validar')[0].prompt;
  assert.match(prompt.replace(/\s+/g, ' '), /renderJaExiste: o arquivo da SAÍDA da ação compor/);
});
