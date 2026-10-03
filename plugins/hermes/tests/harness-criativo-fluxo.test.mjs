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
  resumo: "argument --arquetipo: invalid choice: 'produto-isolado' (choose from texto, cachorrotexto, gentecachorro, produtotexto)",
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
  ['corrigido fecha verde', { ok: true, artefatos: ['out.png'], falhas: [] }, 'verde'],
  ['com erro de script encerra antes de nova crítica', { ok: false, artefatos: ['out.png'], falhas: [FALHA_SCRIPT] }, 'erro'],
]) {
  test(`produzir: check visual permite recomposição e o pre-flight seguinte ${caso}`, async () => {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
      'preflight:': (opts) => opts.label === 'preflight:i1'
        ? { ok: false, artefatos: ['out.png'], falhas: [FALHA_VISUAL] }
        : structuredClone(segundoPreflight),
      'correcao:': () => ({ resumo: 'recompõe dimensão', comandoOverlay: 'fixture-compor --base {{BASE}} --v2 out.png', promptIa: null, copyCorrigida: null }),
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
        assert.equal(resultado.parcial.geracoes[0].comando, 'cmd1');
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
const ROTA_PRODUTO = { ...ROTA, arquetipo: 'produtotexto', promptIa: null, comandoOverlay: 'python compor_produto.py out.png', semGeracao: true };
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

test('A2: flagSobrescrever só entra na composição da iteração >= 2, uma única vez', async () => {
  const rota = { ...ROTA_TEXTO, flagSobrescrever: '--sobrescrever' };
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom(rota),
    'crit:': () => (vez++ === 0 ? { findings: [{ ...FINDING_BASE, criterio: 'legibilidade_thumbnail', resumo: 'ilegível', custoCorrecao: 'overlay' }] } : { findings: [] }),
    'correcao:': () => ({ resumo: 'recompõe', comandoOverlay: 'python compor_texto.py --v2 out.png', promptIa: null, copyCorrigida: null }),
  } });
  assert.equal(resultado.status, 'verde');
  const comps = labels(chamadas, 'composicao:');
  assert.equal(comps.length, 2);
  assert.ok(!comps[0].prompt.includes('--sobrescrever'), 'iteração 1 roda o comando como está');
  assert.equal(comps[1].prompt.split('--sobrescrever').length - 1, 1, 'iteração 2 leva a flag uma única vez');
});

test('A2: comando que já contém a flag não a duplica na iteração >= 2', async () => {
  const rota = { ...ROTA_TEXTO, flagSobrescrever: '--sobrescrever' };
  let vez = 0;
  const { chamadas } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom(rota),
    'crit:': () => (vez++ === 0 ? { findings: [{ ...FINDING_BASE, criterio: 'legibilidade_thumbnail', resumo: 'ilegível', custoCorrecao: 'overlay' }] } : { findings: [] }),
    'correcao:': () => ({ resumo: 'recompõe', comandoOverlay: 'python compor_texto.py --sobrescrever --v2 out.png', promptIa: null, copyCorrigida: null }),
  } });
  const comps = labels(chamadas, 'composicao:');
  assert.equal(comps.length, 2);
  assert.equal(comps[1].prompt.split('--sobrescrever').length - 1, 1);
});

test('A2: sem flagSobrescrever o comportamento é idêntico ao atual', async () => {
  let vez = 0;
  const { chamadas } = await rodar({ args: PRODUZIR, overrides: {
    ...portaoCom(ROTA_TEXTO),
    'crit:': () => (vez++ === 0 ? { findings: [{ ...FINDING_BASE, criterio: 'legibilidade_thumbnail', resumo: 'ilegível', custoCorrecao: 'overlay' }] } : { findings: [] }),
    'correcao:': () => ({ resumo: 'recompõe', comandoOverlay: 'python compor_texto.py --v2 out.png', promptIa: null, copyCorrigida: null }),
  } });
  const comps = labels(chamadas, 'composicao:');
  assert.equal(comps.length, 2);
  assert.ok(comps.every((c) => !c.prompt.includes('--sobrescrever')));
  assert.ok(comps[1].prompt.includes('python compor_texto.py --v2 out.png'));
});

test('A2: schemas aceitam flagSobrescrever', () => {
  assert.match(bloco('ROTAS_SCHEMA'), /flagSobrescrever/);
  assert.match(bloco('PORTAO_SCHEMA'), /flagSobrescrever/);
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
    'correcao:': () => ({ resumo: 'recompõe', comandoOverlay: 'python compor_texto.py --v2 out.png', promptIa: null, copyCorrigida: 'copy-reescrita-proibida' }),
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
    'correcao:': () => ({ resumo: 'r', comandoOverlay: 'python compor_texto.py --v2 out.png', promptIa: null, copyCorrigida: 'copy-reescrita-proibida' }),
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
    'correcao:': () => ({ resumo: 'só copy', comandoOverlay: null, promptIa: null, copyCorrigida: 'copy-reescrita-proibida' }),
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
    'correcao:': () => ({ resumo: 'recompõe', comandoOverlay: 'python compor_texto.py --v2 out.png', promptIa: null, copyCorrigida: null }),
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

// Item 4: flagSobrescrever validada, por token, sem pipe/redirect.
const REUSO = { renderJaExiste: true, reproduzir: true };
const tokensDe = (prompt, t) => prompt.split(/\s+/).filter((x) => x === t).length;

test('A2: no reuso (render existente liberado) a flag entra já na iteração 1', async () => {
  const rota = { ...ROTA_TEXTO, flagSobrescrever: '--sobrescrever' };
  const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: portaoCom(rota, REUSO) });
  assert.equal(resultado.status, 'verde');
  const comps = labels(chamadas, 'composicao:');
  assert.equal(comps.length, 1);
  assert.equal(tokensDe(comps[0].prompt, '--sobrescrever'), 1);
});

test('A2: flagSobrescrever fora do formato de flag bloqueia no Portão com mensagem, sem composição', async () => {
  for (const ruim of ['rm -rf x', '--x; rm y', '$(id)', 'sobrescrever', '--']) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: portaoCom({ ...ROTA_TEXTO, flagSobrescrever: ruim }, REUSO) });
    assert.equal(resultado.status, 'bloqueado', ruim);
    assert.equal(resultado.fase, 'Portão');
    assert.match(resultado.detalhe, /flagSobrescrever/);
    assert.equal(labels(chamadas, 'composicao:').length, 0);
  }
});

test('A2: "já contém a flag" é por token — --force-rgb não impede --force, --formato não impede -f', async () => {
  const a = await rodar({ args: PRODUZIR, overrides: portaoCom({ ...ROTA_TEXTO, comandoOverlay: 'python compor.py --force-rgb out.png', flagSobrescrever: '--force' }, REUSO) });
  assert.equal(tokensDe(labels(a.chamadas, 'composicao:')[0].prompt, '--force'), 1);
  const b = await rodar({ args: PRODUZIR, overrides: portaoCom({ ...ROTA_TEXTO, comandoOverlay: 'python compor.py --formato feed out.png', flagSobrescrever: '-f' }, REUSO) });
  assert.equal(tokensDe(labels(b.chamadas, 'composicao:')[0].prompt, '-f'), 1);
});

test('A2: comando com pipe/redirect/&& + flag a anexar é recusado (escalado com mensagem), sem composição', async () => {
  for (const cmd of ['python compor.py out.png | tee log.txt', 'python compor.py out.png > log.txt', 'cd x && python compor.py out.png']) {
    const { resultado, chamadas } = await rodar({ args: PRODUZIR, overrides: portaoCom({ ...ROTA_TEXTO, comandoOverlay: cmd, flagSobrescrever: '--sobrescrever' }, REUSO) });
    assert.equal(resultado.status, 'escalado', cmd);
    assert.match(JSON.stringify(resultado.detalhe), /pipe|redirect/i);
    assert.equal(labels(chamadas, 'composicao:').length, 0);
  }
});

// Item 5: rota semGeracao fora do arquétipo texto não pode pedir gerar_imagem.py no rough.
test('A1: prompt do diretor proíbe gerar_imagem.py no comandoRough de rota semGeracao', async () => {
  const { chamadas } = await rodar({ args: ROTAS });
  const prompt = labels(chamadas, 'rotas:dirigir')[0].prompt;
  assert.match(prompt, /semGeracao: true[^.]*comandoRough[^.]*NÃO pode chamar gerar_imagem\.py/);
});
