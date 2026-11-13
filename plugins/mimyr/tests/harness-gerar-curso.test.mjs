// Teste COMPORTAMENTAL do harness do gerar-curso — o script roda de verdade, com agentes falsos.
// Molde: plugins/odin/tests/harness-dev-loop.test.mjs. O `test_harness_contracts.py` continua
// travando marcadores e sintaxe; aqui cada invariante "em código" é visto rodando.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HARNESS = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'gerar-curso', 'harness', 'curso.mjs');
const FONTE = readFileSync(HARNESS, 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function corpoDoScript(src) {
  const linhas = src.split('\n');
  const fimMeta = linhas.findIndex((l) => l === '}');
  assert.ok(fimMeta > 0);
  return linhas.slice(fimMeta + 1).join('\n');
}

const CAP = (id, arquivo) => ({ id, titulo: `Cap ${id}`, arquivo, objetivo: `ensinar ${id}`, criterios: ['explica X'], preRequisitos: '', naoCobre: '' });
const DEFAULTS = {
  'estrutura:validar': () => ({ ok: true, aprovada: true, capitulos: [CAP('c1', 'modulo-1/a.html')], capitulosComArquivoExistente: [] }),
  'escrever:': (opts) => ({ status: 'concluido', resumo: 'ok', arquivosTocados: [`./courses/x/${/escrever:(\S+)/.exec(opts.label)[1] === 'c1' ? 'modulo-1/a.html' : 'modulo-1/outro.html'}`] }),
  'checks:': () => ({ verde: true, arquivosAnalisados: 1, falhas: [] }),
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
  let ativos = 0; let maxAtivos = 0;
  const agent = async (prompt, opts) => {
    chamadas.push({ label: opts.label, opts, prompt });
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

const ARGS = { cursoDir: './courses/x', estruturaPath: './courses/x/estrutura.md', perfil: 'economico', scriptsDir: '/plugin/scripts', python: '.venv/bin/python', hoje: '2026-09-02' };
const capitulos = (n) => Array.from({ length: n }, (_, i) => CAP(`c${i + 1}`, `modulo-1/c${i + 1}.html`));

test('args sem os campos obrigatórios morrem antes de qualquer agente', async () => {
  const { resultado, chamadas } = await rodar({ args: { cursoDir: './courses/x' } });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.fase, 'Args');
  assert.match(resultado.detalhe, /estruturaPath, perfil, scriptsDir, python/);
  assert.equal(chamadas.length, 0);
});

test('estrutura sem marca de aprovação humana bloqueia antes de escrever uma linha', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'estrutura:validar': () => ({ ok: true, aprovada: false, capitulos: [CAP('c1', 'a.html')], capitulosComArquivoExistente: [] }) } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'Estrutura');
  assert.ok(!chamadas.some((c) => c.label.startsWith('escrever:')));
});

test('capítulo com arquivo já existente sem reescrever:true bloqueia — o run não sobrescreve conteúdo publicado', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'estrutura:validar': () => ({ ...DEFAULTS['estrutura:validar'](), capitulosComArquivoExistente: ['c1'] }) } });
  assert.equal(resultado.status, 'bloqueado');
  assert.match(resultado.detalhe, /c1/);
});

test('escritor que toca arquivo fora do próprio capítulo é bloqueante automático, sem confirmação', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'escrever:': () => ({ status: 'concluido', resumo: 'ok', arquivosTocados: ['./courses/x/modulo-1/a.html', './courses/x/index.html'] }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.fase, 'Loop');
  assert.match(resultado.historico[0].findings[0].resumo, /escopo estrito/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('confirmar:')));
});

test('checks que não retornam abortam; checks cegos (0 arquivos com trabalho) também', async () => {
  const r1 = await rodar({ args: ARGS, overrides: { 'checks:': () => null } });
  assert.equal(r1.resultado.status, 'erro');
  assert.equal(r1.resultado.fase, 'Checks');
  const r2 = await rodar({ args: ARGS, overrides: { 'checks:': () => ({ verde: true, arquivosAnalisados: 0, falhas: [] }) } });
  assert.equal(r2.resultado.status, 'erro');
  assert.match(r2.resultado.acao, /cegos/);
});

test('falha de check fora dos capítulos do run escala pro humano em vez de queimar o teto', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'checks:': () => ({ verde: false, arquivosAnalisados: 3, falhas: [{ comando: 'corrigir_acentos', arquivo: './courses/x/index.html', resumo: 'acento' }] }) } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.fase, 'Checks');
});

test('falha de check num capítulo do run reescreve só esse capítulo na iteração seguinte', async () => {
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: { ...ARGS, perfil: 'balanceado' }, overrides: {
    'estrutura:validar': () => ({ ok: true, aprovada: true, capitulos: capitulos(3), capitulosComArquivoExistente: [] }),
    'escrever:': (opts) => ({ status: 'concluido', resumo: 'ok', arquivosTocados: [`./courses/x/modulo-1/${/escrever:(\S+)/.exec(opts.label)[1]}.html`] }),
    'checks:': () => (vez++ === 0
      ? { verde: false, arquivosAnalisados: 3, falhas: [{ comando: 'remover_travessao', arquivo: './courses/x/modulo-1/c2.html:12', resumo: 'travessão' }] }
      : { verde: true, arquivosAnalisados: 3, falhas: [] }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.iteracoes, 2);
  const escritas = chamadas.filter((c) => c.label.startsWith('escrever:')).map((c) => c.label);
  assert.deepEqual(escritas, ['escrever:c1', 'escrever:c2', 'escrever:c3', 'escrever:c2']);
});

test('lente que não retorna aborta o run — no perfil econômico seria verde sem revisão', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'rev:': () => null } });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.fase, 'Revisar');
});

test('finding bloqueante confirmado sem capítulo mapeável é furo de estrutura: escala', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'rev:': () => ({ findings: [{ arquivo: './courses/x/estrutura.md', resumo: 'progressão quebrada', cenario: 'c', severidade: 'bloqueante', confianca: 'confirmado' }] }) } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.fase, 'Revisar');
});

test('caminho verde: checks no haiku, relatório por capítulo e modelo efetivo por execução', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.capitulos.length, 1);
  assert.equal(resultado.capitulos[0].vezesEscrito, 1);
  assert.equal(resultado.modelos.porStep.checks.modelo, 'haiku');
  assert.equal(resultado.modelos.porStep.escrever.modelo, 'sonnet');
  assert.equal(chamadas.find((c) => c.label === 'checks:i1').opts.agentType, 'mimyr:mecanico-de-curso');
});

test('escritor promovido a opus que não retorna cai pro sonnet e o relatório registra a execução real', async () => {
  const { resultado } = await rodar({ args: { ...ARGS, tiering: { modelos: { escrever: 'opus' } } }, overrides: {
    'escrever:': (opts) => (opts.model === 'opus' ? null : DEFAULTS['escrever:'](opts)),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.fallbacks.length, 1);
  assert.match(resultado.modelos.porStep.escrever.modelo, /^sonnet/);
});

test('perfil balanceado escreve em paralelo com teto de 4 escritores simultâneos', async () => {
  const { resultado, maxAtivos } = await rodar({ args: { ...ARGS, perfil: 'balanceado' }, atraso: 5, overrides: {
    'estrutura:validar': () => ({ ok: true, aprovada: true, capitulos: capitulos(7), capitulosComArquivoExistente: [] }),
    'escrever:': (opts) => ({ status: 'concluido', resumo: 'ok', arquivosTocados: [`./courses/x/modulo-1/${/escrever:(\S+)/.exec(opts.label)[1]}.html`] }),
    'checks:': () => ({ verde: true, arquivosAnalisados: 7, falhas: [] }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.ok(maxAtivos > 1 && maxAtivos <= 4, `concorrência observada: ${maxAtivos}`);
});

// OM-03: ok/aprovada não substituem a consistência dos dados extraídos.
const ESTRUTURA = (caps) => ({ ok: true, aprovada: true, capitulos: caps, capitulosComArquivoExistente: [] });
for (const [nome, caps] of [
  ['objetivo vazio', [{ ...CAP('c1', 'a.html'), objetivo: '' }]],
  ['objetivo em branco', [{ ...CAP('c1', 'a.html'), objetivo: ' \t ' }]],
  ['critérios vazios', [{ ...CAP('c1', 'a.html'), criterios: [] }]],
  ['critério em branco', [{ ...CAP('c1', 'a.html'), criterios: ['explica X', '  '] }]],
  ['id vazio', [CAP(' ', 'a.html')]],
  ['ids repetidos', [CAP('c1', 'a.html'), CAP('c1', 'b.html')]],
  ['ids equivalentes após trim', [CAP('c1', 'a.html'), CAP(' c1 ', 'b.html')]],
  ['arquivos iguais', [CAP('c1', 'a.html'), CAP('c2', 'a.html')]],
  ['arquivos equivalentes', [CAP('c1', 'modulo-1/a.html'), CAP('c2', './modulo-1//a.html')]],
  ['arquivo vazio', [CAP('c1', '')]],
  ['arquivo absoluto', [CAP('c1', '/courses/fora/a.html')]],
  ['escape de arquivo', [CAP('c1', '../fora/a.html')]],
  ['traversal mesmo dentro do curso', [CAP('c1', 'modulo-1/../a.html')]],
]) {
  test(`OM-03: ${nome} bloqueia antes de despachar qualquer escritor`, async () => {
    const { resultado, chamadas } = await rodar({ args: { ...ARGS, perfil: 'balanceado' }, overrides: {
      'estrutura:validar': () => ESTRUTURA(caps),
    } });
    assert.equal(resultado.status, 'bloqueado');
    assert.equal(resultado.fase, 'Estrutura');
    assert.ok(!chamadas.some(c => c.label.startsWith('escrever:')));
  });
}

test('OM-03: dois capítulos disjuntos preservam seus destinos e critérios', async () => {
  const caps = [CAP('c1', 'modulo-1/a.html'), CAP('c2', 'modulo-1/b.html')];
  const { resultado, chamadas } = await rodar({ args: { ...ARGS, perfil: 'balanceado' }, overrides: {
    'estrutura:validar': () => ESTRUTURA(caps),
    'escrever:': (opts) => ({ status: 'concluido', resumo: 'ok', arquivosTocados: [`./courses/x/${caps.find(c => `escrever:${c.id}` === opts.label).arquivo}`] }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.deepEqual(resultado.capitulos.map(c => c.arquivo), caps.map(c => `./courses/x/${c.arquivo}`));
  assert.equal(chamadas.filter(c => c.label.startsWith('escrever:')).length, 2);
});

// OM-02: identidade lexical completa, sem fingir acesso a filesystem do Workflow.
for (const [nome, arquivo] of [
  ['outro curso', './courses/outro/modulo-1/a.html'],
  ['prefixo enganoso', './courses/x/evilmodulo-1/a.html'],
  ['traversal para outro curso', './courses/x/../outro/modulo-1/a.html'],
  ['relato absoluto sem base conhecida', '/outro/workspace/courses/x/modulo-1/a.html'],
]) {
  test(`OM-02: ${nome} não é o capítulo autorizado`, async () => {
    const { resultado } = await rodar({ args: ARGS, overrides: {
      'escrever:': () => ({ status: 'concluido', resumo: 'ok', arquivosTocados: [arquivo] }),
    } });
    assert.equal(resultado.status, 'escalado');
    assert.equal(resultado.fase, 'Loop');
    assert.ok(resultado.historico.every(h => h.findings.some(f => f.origem === 'escopo-estrito')));
  });
}
for (const [nome, args, arquivo, baseArquivosTocados] of [
  ['relativo ao curso', ARGS, 'modulo-1/a.html', 'curso'],
  ['relativo ao workspace', ARGS, 'courses/x/modulo-1/a.html'],
  ['absoluto no curso absoluto', { ...ARGS, cursoDir: '/workspace/courses/x' }, '/workspace/courses/x/modulo-1/a.html'],
  ['absoluto com workspace explícito', { ...ARGS, workspaceRoot: '/workspace' }, '/workspace/courses/x/modulo-1/a.html'],
  ['relativo com curso absoluto e workspace explícito', { ...ARGS, cursoDir: '/workspace/courses/x', workspaceRoot: '/workspace' }, './courses/x/modulo-1/a.html'],
  ['Windows absoluto', { ...ARGS, cursoDir: 'C:\\workspace\\courses\\x' }, 'C:\\workspace\\courses\\x\\modulo-1\\a.html'],
]) {
  test(`OM-02: aceita identidade inequívoca ${nome}`, async () => {
    const { resultado } = await rodar({ args, overrides: {
      'escrever:': () => ({ status: 'concluido', resumo: 'ok', arquivosTocados: [arquivo], ...(baseArquivosTocados ? { baseArquivosTocados } : {}) }),
    } });
    assert.equal(resultado.status, 'verde');
  });
}

test('OM-02: relato relativo não troca de base para coincidir com outro arquivo', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'estrutura:validar': () => ESTRUTURA([CAP('c1', 'courses/x/a.html')]),
    'escrever:': () => ({ status: 'concluido', resumo: 'ok', arquivosTocados: ['courses/x/a.html'] }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.fase, 'Loop');
});

test('OM-02: base curso explícita resolve o mesmo relato dentro do curso', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'estrutura:validar': () => ESTRUTURA([CAP('c1', 'courses/x/a.html')]),
    'escrever:': () => ({ status: 'concluido', resumo: 'ok', arquivosTocados: ['courses/x/a.html'], baseArquivosTocados: 'curso' }),
  } });
  assert.equal(resultado.status, 'verde');
});

// Achado MIMYR-01 da revisão de 2026-11-01: perfil fora do enum caía em silêncio no econômico.
test('perfil com acento é normalizado; perfil desconhecido é erro de args antes de qualquer agente', async () => {
  const ok = await rodar({ args: { ...ARGS, perfil: 'Máximo' } });
  assert.ok(ok.chamadas.some(c => /precisao-tecnica/.test(c.label)), 'máximo roda a lente de precisão técnica');
  for (const perfil of ['maximum', 'constructor', 7]) {
    const { resultado, chamadas } = await rodar({ args: { ...ARGS, perfil } });
    assert.equal(resultado.status, 'erro', String(perfil));
    assert.equal(resultado.fase, 'Args');
    assert.equal(chamadas.length, 0);
  }
  const semPerfil = await rodar({ args: { ...ARGS, perfil: undefined } });
  assert.equal(semPerfil.resultado.fase, 'Args', 'perfil continua obrigatório');
});

test('correções ficam no capítulo exato mesmo com nomes sobrepostos e linha/coluna', async () => {
  let rodada = 0;
  const { resultado, chamadas } = await rodar({ args: { ...ARGS, perfil: 'balanceado', templatesDir: './site/templates' }, overrides: {
    'estrutura:validar': () => ({ ok: true, aprovada: true, capitulos: [CAP('c1', 'intro.html'), CAP('c2', 'pre-intro.html')], capitulosComArquivoExistente: [] }),
    'escrever:': () => ({ status: 'concluido', resumo: 'ok', arquivosTocados: [] }),
    'checks:': () => ++rodada === 1 ? { verde: false, arquivosAnalisados: 2, falhas: [{ arquivo: './courses/x/pre-intro.html:12:3', comando: 'check', resumo: 'FALHA_EXCLUSIVA_C2' }] } : { verde: true, arquivosAnalisados: 2, falhas: [] },
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(chamadas.filter(c => c.label === 'escrever:c1').length, 1);
  assert.equal(chamadas.filter(c => c.label === 'escrever:c2').length, 2);
  assert.match(chamadas.find(c => c.label === 'escrever:c1').prompt, /site\/templates\/subpage.html/);
  assert.match(chamadas.find(c => c.label === 'escrever:c1').prompt, /checar_svg_overflow.py/);
});

test('reescritores paralelos recebem somente suas falhas e verde declarado não apaga falha', async () => {
  let rodada = 0;
  const { resultado, chamadas } = await rodar({ args: { ...ARGS, perfil: 'balanceado' }, overrides: {
    'estrutura:validar': () => ({ ok: true, aprovada: true, capitulos: [CAP('c1', 'a.html'), CAP('c2', 'b.html')], capitulosComArquivoExistente: [] }),
    'escrever:': () => ({ status: 'concluido', resumo: 'ok', arquivosTocados: [] }),
    'checks:': () => ({ verde: true, arquivosAnalisados: 2, falhas: ++rodada === 1 ? ['a', 'b'].map(x => ({ arquivo: `./courses/x/${x}.html`, comando: 'check', resumo: `EXCLUSIVA_${x}` })) : [] }),
  } });
  assert.equal(resultado.status, 'verde');
  const escritas = chamadas.filter(c => c.label === 'escrever:c1');
  assert.equal(escritas.length, 2);
  assert.match(escritas[1].prompt, /EXCLUSIVA_a/);
  assert.doesNotMatch(escritas[1].prompt, /EXCLUSIVA_b/);
});

test('comando de checks preserva espaço, apóstrofo e expansão shell como argumentos literais POSIX', async () => {
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'mimyr-shell-'));
  try {
    const scripts = join(dir, "scripts com ' e $(false)");
    mkdirSync(scripts);
    const script = join(scripts, 'corrigir_acentos.py');
    writeFileSync(script, 'console.log(JSON.stringify(process.argv.slice(2)))');
    const cursoDir = join(dir, "curso com ' e $(false)");
    const { chamadas } = await rodar({ args: { ...ARGS, cursoDir, scriptsDir: scripts, python: process.execPath }, overrides: {
      'escrever:': () => ({ status: 'concluido', resumo: 'ok', arquivosTocados: [] }),
    } });
    const comando = chamadas.find(c => c.label === 'checks:i1').prompt.match(/1\. (.+)/)[1];
    assert.deepEqual(JSON.parse(execFileSync('/bin/sh', ['-c', comando], { encoding: 'utf8' })), [cursoDir, '--dry-run']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('campo capitulo extra em falha mecânica não roteia arquivo fora do curso', async () => {
  let rodada = 0;
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'checks:': () => ++rodada === 1
      ? { verde: false, arquivosAnalisados: 2, falhas: [{ arquivo: './shell.html', capitulo: 'c1', comando: 'check', resumo: 'falha fora dos capítulos' }] }
      : { verde: true, arquivosAnalisados: 2, falhas: [] },
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.fase, 'Checks');
  assert.equal(chamadas.filter(c => c.label.startsWith('checks:')).length, 1);
});
