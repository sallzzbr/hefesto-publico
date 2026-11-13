// Controladores reais e fixtures das suítes Claude existentes, transportadas pelo bridge.
// Não executa modelos, comandos de workspace, conectores ou geração de imagem.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { iniciar, proximo, responder } from '../runtime/bridge.mjs';

const CODEX = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(CODEX, '..');

function fixturesExistentes(plugin, arquivo, marcador) {
  const fonte = readFileSync(join(REPO, 'plugins', plugin, 'tests', arquivo), 'utf8');
  const inicio = fonte.indexOf(marcador);
  const fim = fonte.indexOf('function responder(label, overrides)');
  assert.ok(inicio >= 0 && fim > inicio, `bloco de fixtures não encontrado: ${arquivo}`);
  // Avalia somente constantes/fábricas de fixture, sem importar ou disparar testes da origem.
  // Mudança do formato da suíte falha aqui; não cria uma segunda cópia silenciosamente divergente.
  return new Function(`${fonte.slice(inicio, fim)}\nreturn DEFAULTS;`)();
}

async function completar(t, { plugin, arquivo, marcador, args, overrides = {} }) {
  const dir = mkdtempSync(join(tmpdir(), `codex-controller-${plugin}-`));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const pacote = join(CODEX, 'plugins', plugin);
  const run = join(dir, 'run');
  const fixtures = { ...fixturesExistentes(plugin, arquivo, marcador), ...overrides };
  const chamadas = [];
  const idsRespondidos = new Set();
  const qualityPaths = new Set([args.specPath]);
  let saida = await iniciar(pacote, run, args);
  while (saida.status === 'aguardando') {
    assert.ok(chamadas.length < 100, 'replay não convergiu em 100 respostas de fixture');
    assert.ok(saida.solicitacoes.length > 0, 'aguardando sem solicitação');
    // Responde o último pedido para exercitar ordem inversa nos lotes paralelos.
    const pedido = saida.solicitacoes.at(-1);
    assert.ok(!idsRespondidos.has(pedido.id), `pedido já respondido reapareceu: ${pedido.label}`);
    const chave = Object.keys(fixtures).find(k => pedido.label === k || (k.endsWith(':') && pedido.label.startsWith(k)));
    assert.ok(chave, `fixture ausente para ${pedido.label}`);
    const resultado = fixtures[chave](pedido);
    if (plugin === 'odin') {
      if (pedido.label === 'spec:ids') {
        for (const check of resultado.quality.checks) for (const path of check.paths) qualityPaths.add(path);
      }
      if (pedido.label === 'tdd:portao') {
        for (const item of resultado.testes) qualityPaths.add(item.path);
        for (const path of resultado.apoio || []) qualityPaths.add(path);
      }
      if (pedido.label.startsWith('impl:')) for (const path of resultado.arquivosTocados || []) qualityPaths.add(path);
      if (pedido.label.startsWith('validar:') && !Object.hasOwn(overrides, chave)) {
        resultado.qualityInventory = { ...resultado.qualityInventory,
          files: [...qualityPaths].map(path => ({ path, lines: 12, bytes: 240, status: 'text' })) };
      }
    }
    chamadas.push(pedido);
    idsRespondidos.add(pedido.id);
    saida = await responder(pacote, run, pedido.id, { resultado, modeloEfetivo: 'fixture-sem-modelo' });
  }
  assert.equal(saida.status, 'concluido');
  assert.deepEqual(await proximo(pacote, run), saida, 'retomada terminal deve preservar o relatório');
  assert.equal(saida.resultado.modelos.runtime, 'codex');
  assert.equal(saida.resultado.modelos.execucoes.length, chamadas.length);
  assert.ok(saida.resultado.modelos.execucoes.every(e => e.modelo === 'fixture-sem-modelo'));
  return { resultado: saida.resultado, chamadas };
}

const DATA = '2026-09-06';

test('Odin real: SPEC → TDD → implementação → auditoria → três lentes → verde via replay', async t => {
  const { resultado, chamadas } = await completar(t, {
    plugin: 'odin', arquivo: 'harness-dev-loop.test.mjs', marcador: 'const TESTE',
    args: { workspaceRoot: '/workspace', scriptsDir: '/plugin/scripts', specPath: 'spec.md', branch: 'feat/x', perfil: 'maximo', validacoes: ['npm test'], hoje: DATA },
  });
  assert.equal(resultado.status, 'verde');
  assert.equal(chamadas.length, 10);
  assert.deepEqual(chamadas.slice(0, 4).map(c => c.label), ['spec:ids', 'spec:validar', 'tdd:portao', 'tdd:vermelho']);
  assert.equal(chamadas.filter(c => c.label.startsWith('rev:')).length, 3);
  assert.ok(chamadas.some(c => c.label.startsWith('ponytail:')));
});

test('Mimyr real: estrutura → capítulo → checks → três lentes → verde via replay', async t => {
  const { resultado, chamadas } = await completar(t, {
    plugin: 'mimyr', arquivo: 'harness-gerar-curso.test.mjs', marcador: 'const CAP',
    args: { cursoDir: './courses/x', estruturaPath: './courses/x/estrutura.md', perfil: 'maximo', scriptsDir: '/plugin/scripts', python: '.venv/bin/python', hoje: DATA },
  });
  assert.equal(resultado.status, 'verde');
  assert.equal(chamadas.length, 6);
  assert.equal(resultado.capitulos.length, 1);
  assert.equal(resultado.capitulos[0].vezesEscrito, 1);
  assert.equal(chamadas.filter(c => c.label.startsWith('rev:')).length, 3);
  assert.equal(chamadas[0].label, 'estrutura:validar');
});

test('Hermes real: produção → seleção → base no overlay → crítica → pacote via replay', async t => {
  const { resultado, chamadas } = await completar(t, {
    plugin: 'hermes', arquivo: 'harness-criativo-fluxo.test.mjs', marcador: 'const nomesT',
    args: { estagio: 'produzir', rotasPath: 'rotas.md', perfil: 'maximo', python: '.venv/bin/python', hoje: DATA },
  });
  assert.equal(resultado.status, 'verde');
  assert.equal(chamadas.length, 7);
  assert.equal(resultado.rodadasIa, 1);
  assert.equal(resultado.pacote, 'pacotes/slug1');
  const composicao = chamadas.find(c => c.label.startsWith('composicao:'));
  assert.match(composicao.prompt, /--base cand2\.png --saida marketing\/criativos\/renders\/segmento\/slug1\.png/);
  assert.ok(!composicao.prompt.includes('{{BASE}}'));
  assert.equal(chamadas.find(c => c.label.startsWith('selecao:')).papel, 'hermes:validador-de-criativo');
});

// HERMES-1 (decisão 14 do dono, 2026-11-03): o bridge valida o enum do schema; com o enum só
// A-J, a resposta do crit com verdade_comercial era recusada. Com a headline travada, verdade
// comercial confirmada na headline encerra bloqueado sem correção, nunca verde.
test('Hermes real: headline travada com verdade_comercial confirmada encerra bloqueado via replay', async t => {
  const promessa = { criterio: 'verdade_comercial', resumo: 'promete personalização que o catálogo não oferece', evidencia: 'headline do render', cenario: 'cliente compra esperando o próprio nome na peça', severidade: 'bloqueante', confianca: 'confirmado', custoCorrecao: 'copy', alvo: 'headline' };
  const { resultado, chamadas } = await completar(t, {
    plugin: 'hermes', arquivo: 'harness-criativo-fluxo.test.mjs', marcador: 'const nomesT',
    args: { estagio: 'produzir', rotasPath: 'rotas.md', perfil: 'maximo', python: '.venv/bin/python', hoje: DATA, headlineTravada: true },
    overrides: { 'crit:': () => ({ findings: [promessa] }) },
  });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'Crit');
  assert.match(resultado.detalhe, /personalização/);
  assert.equal(chamadas.filter(c => c.label.startsWith('crit:')).length, 1);
  assert.ok(!chamadas.some(c => c.label.startsWith('correcao:')));
  assert.equal(chamadas.at(-1).label, 'pacote:montar');
});

test('Hermes real: rotas e roughs param na escolha visual sem iniciar produção via replay', async t => {
  const { resultado, chamadas } = await completar(t, {
    plugin: 'hermes', arquivo: 'harness-criativo-fluxo.test.mjs', marcador: 'const nomesT',
    args: { estagio: 'rotas', briefPath: 'brief.md', perfil: 'maximo', python: '.venv/bin/python', hoje: DATA },
  });
  assert.equal(resultado.status, 'aguardando-rota');
  assert.equal(chamadas.length, 3);
  assert.equal(resultado.rotas.length, 2);
  assert.ok(resultado.rotas.every(r => r.rough));
  assert.ok(!chamadas.some(c => c.label.startsWith('producao:')));
  assert.deepEqual(chamadas.filter(c => c.label.startsWith('rough:')).map(c => c.label), ['rough:rota2', 'rough:rota1']);
});

// Decisões 17A e 18C do dono (2026-11-03): toda refutação traz porque, e com a headline travada
// o headline_tem_ideia da headline passa por uma confirmação de promessa própria antes de virar
// sinalização. O bridge valida a resposta contra o schema da solicitação: sem porque, recusa.
const IDEIA_NA_HEADLINE = { criterio: 'headline_tem_ideia', resumo: 'headline não tem ideia: só nomeia a personalização', evidencia: 'headline do render', cenario: 'leitor não reconhece verdade específica', severidade: 'bloqueante', confianca: 'confirmado', custoCorrecao: 'copy', alvo: 'headline' };
const ARGS_TRAVADA = { estagio: 'produzir', rotasPath: 'rotas.md', perfil: 'maximo', python: '.venv/bin/python', hoje: DATA, headlineTravada: true };
const HERMES = { plugin: 'hermes', arquivo: 'harness-criativo-fluxo.test.mjs', marcador: 'const nomesT' };

test('Hermes real: confirmação de promessa da headline travada passa pelo bridge com o schema novo', async t => {
  for (const [promessaFalsa, status] of [[false, 'verde'], [true, 'bloqueado']]) {
    const { resultado, chamadas } = await completar(t, {
      ...HERMES, args: ARGS_TRAVADA,
      overrides: {
        'crit:': () => ({ findings: [IDEIA_NA_HEADLINE] }),
        'promessa:': () => ({ promessaFalsa, porque: promessaFalsa ? 'o catálogo não tem personalização' : 'o catálogo tem personalização; a crítica é só de ideia' }),
      },
    });
    assert.equal(resultado.status, status, `promessaFalsa=${promessaFalsa}`);
    const pedidos = chamadas.filter(c => c.label.startsWith('promessa:'));
    assert.equal(pedidos.length, 1);
    assert.equal(pedidos[0].papel, 'hermes:validador-de-criativo');
    assert.deepEqual([...pedidos[0].schema.required].sort(), ['porque', 'promessaFalsa']);
    assert.equal(pedidos[0].schema.properties.porque.minLength, 20);
    assert.ok(!chamadas.some(c => c.label.startsWith('correcao:')));
    if (promessaFalsa) {
      assert.match(resultado.detalhe, /headline_tem_ideia reclassificado/);
      // Causa e evidência certas, não o motivo da falha fechada (os dois ramos terminam bloqueado).
      assert.match(resultado.detalhe, /confirmação de promessa apontou/);
      assert.doesNotMatch(resultado.detalhe, /sem porque/);
      assert.equal(resultado.findingsBloqueio[0].porquePromessa, 'o catálogo não tem personalização');
    } else assert.equal(resultado.sinalizacoes[0].criterio, 'headline_tem_ideia');
  }
});

// Avança o replay com as fixtures até a primeira solicitação cujo label começa com o prefixo.
async function ateSolicitacao(t, { plugin, arquivo, marcador, args, overrides = {} }, prefixo) {
  const dir = mkdtempSync(join(tmpdir(), `codex-controller-${plugin}-`));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const pacote = join(CODEX, 'plugins', plugin);
  const run = join(dir, 'run');
  const fixtures = { ...fixturesExistentes(plugin, arquivo, marcador), ...overrides };
  let saida = await iniciar(pacote, run, args);
  for (let i = 0; saida.status === 'aguardando' && i < 100; i++) {
    const alvo = saida.solicitacoes.find(s => s.label.startsWith(prefixo));
    if (alvo) return { pacote, run, pedido: alvo };
    const pedido = saida.solicitacoes.at(-1);
    const chave = Object.keys(fixtures).find(k => pedido.label === k || (k.endsWith(':') && pedido.label.startsWith(k)));
    assert.ok(chave, `fixture ausente para ${pedido.label}`);
    saida = await responder(pacote, run, pedido.id, { resultado: fixtures[chave](pedido), modeloEfetivo: 'fixture-sem-modelo' });
  }
  assert.fail(`o controlador não emitiu solicitação ${prefixo} (status ${saida.status})`);
}

test('Hermes real: o bridge recusa veredito e confirmação de promessa sem porque', async t => {
  const { alvo: _alvo, ...SEM_ALVO } = IDEIA_NA_HEADLINE;
  const casos = [
    ['confirmar:', { args: { ...ARGS_TRAVADA, headlineTravada: false }, overrides: { 'crit:': () => ({ findings: [{ ...SEM_ALVO, criterio: 'texto_correto', confianca: 'plausivel', custoCorrecao: 'overlay' }] }) } }, 'real', { real: false, porque: 'relido com zoom: a palavra está correta' }],
    ['promessa:', { args: ARGS_TRAVADA, overrides: { 'crit:': () => ({ findings: [IDEIA_NA_HEADLINE] }) } }, 'promessaFalsa', { promessaFalsa: false, porque: 'o catálogo tem personalização' }],
  ];
  for (const [prefixo, config, campo, valida] of casos) {
    const { pacote, run, pedido } = await ateSolicitacao(t, { ...HERMES, ...config }, prefixo);
    await assert.rejects(responder(pacote, run, pedido.id, { resultado: { [campo]: false } }), /campo obrigatório porque/, `${prefixo} sem porque`);
    await assert.rejects(responder(pacote, run, pedido.id, { resultado: { [campo]: false, porque: '' } }), /texto curto/, `${prefixo} com porque vazio`);
    await assert.rejects(responder(pacote, run, pedido.id, { resultado: { [campo]: false, porque: 'a'.repeat(19) } }), /texto curto/, `${prefixo} abaixo de 20`);
    const saida = await responder(pacote, run, pedido.id, { resultado: valida, modeloEfetivo: 'fixture-sem-modelo' });
    assert.ok(!saida.solicitacoes?.some(s => s.id === pedido.id), `${prefixo}: resposta válida aceita depois das recusas`);
  }
});

test('Hermes pelo bridge: espaços e pontuação não contornam o mínimo da refutação', async t => {
  const { alvo: _alvo, ...semAlvo } = IDEIA_NA_HEADLINE;
  for (const promessa of [false, true]) {
    for (const [porque, aceita] of [['.'.repeat(20), false], [('a ').repeat(19), false], ['a'.repeat(19) + '\u200b'.repeat(20), false], ['é'.repeat(20), true]]) {
      const { resultado } = await completar(t, { ...HERMES,
        args: promessa ? ARGS_TRAVADA : { ...ARGS_TRAVADA, headlineTravada: false },
        overrides: {
          'crit:': () => ({ findings: [promessa ? IDEIA_NA_HEADLINE : { ...semAlvo, criterio: 'texto_correto', confianca: 'plausivel', custoCorrecao: 'overlay' }] }),
          'confirmar:': () => ({ real: false, porque }),
          'promessa:': () => ({ promessaFalsa: false, porque }),
        },
      });
      if (aceita) assert.equal(resultado.status, 'verde');
      else if (promessa) {
        assert.equal(resultado.status, 'erro');
        assert.equal(resultado.natureza, 'resposta_invalida');
        assert.equal(resultado.solicitacao, 'promessa:i1');
        assert.equal(resultado.findingsBloqueio, undefined);
        assert.match(resultado.acao, /corrigir.*justificativa/);
      } else assert.notEqual(resultado.status, 'verde', `${promessa}/${JSON.stringify(porque)}`);
    }
  }
});

test('Hermes pelo bridge: campo extra no achado é recusado sem alterar o estado', async t => {
  const { pacote, run, pedido } = await ateSolicitacao(t, { ...HERMES, args: ARGS_TRAVADA }, 'crit:');
  const antes = readFileSync(join(run, 'state.json'), 'utf8');
  for (const campo of ['campoExtra', 'criterioOriginal', 'reclassificacao', 'porquePromessa']) {
    const findings = [{ ...IDEIA_NA_HEADLINE, [campo]: 'valor não previsto' }];
    await assert.rejects(responder(pacote, run, pedido.id, { resultado: { findings } }), new RegExp(`campo extra ${campo}`));
    assert.equal(readFileSync(join(run, 'state.json'), 'utf8'), antes, campo);
  }
  const valido = { ...IDEIA_NA_HEADLINE, acaoSugerida: 'rever a headline' };
  const depois = await responder(pacote, run, pedido.id, { resultado: { findings: [valido] } });
  assert.ok(!depois.solicitacoes?.some(s => s.id === pedido.id), 'alvo e acaoSugerida continuam permitidos');
  assert.equal(depois.status, 'aguardando');
  assert.ok(depois.solicitacoes.some(s => s.label.startsWith('promessa:')));
});
