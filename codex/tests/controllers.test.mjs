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

async function completar(t, { plugin, arquivo, marcador, args }) {
  const dir = mkdtempSync(join(tmpdir(), `codex-controller-${plugin}-`));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const pacote = join(CODEX, 'plugins', plugin);
  const run = join(dir, 'run');
  const fixtures = fixturesExistentes(plugin, arquivo, marcador);
  const chamadas = [];
  const idsRespondidos = new Set();
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
    plugin: 'hermes', arquivo: 'harness-criativo-fluxo.test.mjs', marcador: 'const ROTA',
    args: { estagio: 'produzir', rotasPath: 'rotas.md', perfil: 'maximo', python: '.venv/bin/python', hoje: DATA },
  });
  assert.equal(resultado.status, 'verde');
  assert.equal(chamadas.length, 7);
  assert.equal(resultado.rodadasIa, 1);
  assert.equal(resultado.pacote, 'pacotes/slug1');
  const composicao = chamadas.find(c => c.label.startsWith('composicao:'));
  assert.match(composicao.prompt, /--base cand2\.png out\.png/);
  assert.ok(!composicao.prompt.includes('{{BASE}}'));
  assert.equal(chamadas.find(c => c.label.startsWith('selecao:')).papel, 'hermes:validador-de-criativo');
});

test('Hermes real: rotas e roughs param na escolha visual sem iniciar produção via replay', async t => {
  const { resultado, chamadas } = await completar(t, {
    plugin: 'hermes', arquivo: 'harness-criativo-fluxo.test.mjs', marcador: 'const ROTA',
    args: { estagio: 'rotas', briefPath: 'brief.md', perfil: 'maximo', python: '.venv/bin/python', hoje: DATA },
  });
  assert.equal(resultado.status, 'aguardando-rota');
  assert.equal(chamadas.length, 3);
  assert.equal(resultado.rotas.length, 2);
  assert.ok(resultado.rotas.every(r => r.rough));
  assert.ok(!chamadas.some(c => c.label.startsWith('producao:')));
  assert.deepEqual(chamadas.filter(c => c.label.startsWith('rough:')).map(c => c.label), ['rough:rota2', 'rough:rota1']);
});
