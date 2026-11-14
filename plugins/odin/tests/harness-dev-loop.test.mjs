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
import { readFileSync, mkdtempSync, writeFileSync, rmSync, realpathSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
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
// Evidência no formato do script de hashes: `<sha256>-<conferência>`. As conferências (CRC-32 de
// `path\nsha`) foram calculadas FORA do harness, com o zlib do Python — são vetores conhecidos,
// não eco do algoritmo sob teste. Literais porque `codex/tests/controllers.test.mjs` avalia este
// bloco sem os imports do arquivo.
const HASH_A = `${'a'.repeat(64)}-e411bb3e`;
const HASH_B = `${'b'.repeat(64)}-66d1a195`;
// Impressões da worktree no formato de `hashes-testes.mjs --impressao`: `<sha256>-<conferência>`,
// conferência = CRC-32 de `worktree\n<sha>`, também calculada com o zlib do Python.
const IMP_C = `${'c'.repeat(64)}-5ab00257`;
const IMP_D = `${'d'.repeat(64)}-fa0138d9`;
// Teste da SPEC no contrato do portão 2.5.0: tipo (reprodução ou preservação) e comando próprio,
// porque a execução independente roda um teste por vez. O controlador numera T1..Tn.
const repro = (criterio, path = TESTE, caso = criterio) => ({ criterio, path, tipo: 'reproducao', comando: `node --test --test-name-pattern=${caso} ${path}`, motivoFalha: 'falta implementação' });
const controle = (criterio, path = TESTE, caso = criterio) => ({ criterio, path, tipo: 'preservacao', comando: `node --test --test-name-pattern=${caso} ${path}`, motivoFalha: 'protege o comportamento atual' });
// IDs que o controlador pôs no schema da execução (T1..Tn); chamada direta, sem schema, só T1.
const idsDoSchema = (o) => o?.schema?.properties?.execucoes?.items?.properties?.teste?.enum ?? ['T1'];
const execucao = (teste, exitZero, tipoFalha = exitZero ? 'nenhuma' : 'assercao', casos = 1) => ({ teste, exitZero, tipoFalha, casos, resumo: exitZero ? 'ok' : (tipoFalha === 'infra' ? 'Cannot find module' : 'AssertionError: falta implementação') });
// Alterações antes da implementação no formato de `inspecionar-git.mjs alteracoes` (2.6.0): no run
// normal só o teste da SPEC mudou, então não há implementação anterior detectada.
const ALTERACOES = { comparadoCom: 'HEAD', alterados: [TESTE], adicionados: [TESTE] };
const LEGACY_QUALITY = {
  version: 1, profiles: ['base'],
  conventions: [{ source: 'AGENTS.md', decision: 'Preserve legacy fixture behavior and inspect the existing project boundary.' }],
  checks: ['Q-NAMES', 'Q-COMMENTS', 'Q-BOUNDARIES', 'Q-TESTABILITY', 'Q-COHESION', 'Q-ERRORS', 'Q-PROJECT'].map(id => ({ id, applicability: 'required', reason: 'The changed unit needs independent review.', paths: ['src/a.js'], verification: 'review', command: '' })),
  decomposition: [],
};
const LEGACY_INVENTORY = { files: ['src/a.js', TESTE, 'docs/plans/spec.md'].map(path => ({ path, lines: 12, bytes: 240, status: 'text' })), uninspected: [], errors: [] };
const LEGACY_REVIEW = LEGACY_QUALITY.checks.map(c => ({ id: c.id, status: 'satisfied', evidence: [{ path: 'src/a.js', line: 1, observation: 'Inspected the unit and its input validation against the project conventions.' }], finding: {} }));
const DEFAULTS = {
  'spec:ids': () => ({quality:structuredClone(LEGACY_QUALITY),ok:true,ids:['C1'],erros:[],verificacoesComplementares:{},tipos:{C1:'reproducao'}}),
  'spec:validar': () => ({
    ok: true, pendenciasBloqueadoras: [], validacoesDaSpec: ['npm test'],
    criterios: [{ id: 'C1', texto: 'faz X' }],
    unidades: [{ id: 'U1', titulo: 'unidade 1', arquivos: 'src/a.js', criterios: ['C1'] }],
  }),
  'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1')] }),
  'tdd:vermelho': (o) => ({ execucoes: idsDoSchema(o).map((t) => execucao(t, false)), hashesDosTestes: { [TESTE]: HASH_A }, alteracoes: ALTERACOES }),
  'impl:': () => ({ status: 'concluida', resumo: 'ok', escada: [{ item: 'fn', degrau: 7, porque: 'nada reusável' }], arquivosTocados: ['src/a.js'] }),
  'consulta:': () => ({ decisao: 'use A', porque: 'mais simples' }),
  'impressao:': () => ({ impressao: IMP_C }),
  'validar:': (o) => ({ qualityExecutions: [], qualityInventory: structuredClone(LEGACY_INVENTORY), verde: true, falhas: [], execucoes: idsDoSchema(o).map((t) => execucao(t, true)), hashesDosTestes: { [TESTE]: HASH_A } }),
  'ponytail:': () => ({ qualityReview: structuredClone(LEGACY_REVIEW), dependenciasNovas: [], duplicacoes: [], abstracoesUsoUnico: [], forasDeEscopo: [], linhasAdicionadasAcumuladas: 12 }),
  'rev:': () => ({ findings: [] }),
  'confirmar:': () => ({ real: false, porque: 'não reproduz' }),
};

function responder(label, overrides) {
  const tabela = { ...DEFAULTS, ...overrides };
  const chave = Object.keys(tabela).find((k) => label === k || (k.endsWith(':') && label.startsWith(k)));
  if (!chave) return null;
  // Legacy cases exercise unrelated guards; only their fixture gains complete quality evidence.
  return (...parameters) => {
    const value = tabela[chave](...parameters);
    if (!value || typeof value !== 'object') return value;
    if (label === 'spec:ids') return { quality: structuredClone(LEGACY_QUALITY), ...value };
    if (label.startsWith('validar:')) return { qualityExecutions: [], qualityInventory: structuredClone(LEGACY_INVENTORY), ...value };
    if (label.startsWith('ponytail:')) return { qualityReview: structuredClone(LEGACY_REVIEW), ...value };
    return value;
  };
}

// Inventário que o teste entrega como o script real o devolveria: o agente falso não o reescreve.
const INVENTARIO_LITERAL = new WeakSet();
const inventarioLiteral = inv => { INVENTARIO_LITERAL.add(inv); return inv; };

async function rodar({ args, overrides = {}, atraso = 0 }) {
  const chamadas = [];
  const logs = [];
  let ativos = 0;
  let maxAtivos = 0;
  const qualityPaths = new Set(['src/a.js']);
  const addQualityPath = path => {
    if (typeof path !== 'string') return;
    const rootPrefix = `${args?.workspaceRoot || ''}/`;
    const relativePath = (path.startsWith(rootPrefix) ? path.slice(rootPrefix.length) : path).replace(/^\.\//, '');
    if (relativePath && !relativePath.startsWith('/') && !relativePath.split('/').includes('..')) {
      qualityPaths.add(relativePath.split('/').filter(part => part && part !== '.').join('/'));
    }
  };
  addQualityPath(args?.specPath);
  const agent = async (prompt, opts) => {
    chamadas.push({ label: opts.label, opts, prompt });
    const fn = responder(opts.label, overrides);
    if (!fn) throw new Error(`label sem resposta no teste: ${opts.label}`);
    ativos++; maxAtivos = Math.max(maxAtivos, ativos);
    if (atraso) await new Promise((r) => setTimeout(r, atraso));
    ativos--;
    const response = fn(opts, chamadas, prompt);
    if (opts.label === 'tdd:portao') {
      for (const item of response?.testes || []) addQualityPath(item.path);
      for (const path of response?.apoio || []) addQualityPath(path);
    }
    if (opts.label.startsWith('impl:') && response?.arquivosTocados) {
      for (const path of response.arquivosTocados) addQualityPath(path);
    }
    if (opts.label.startsWith('validar:') && response?.qualityInventory && !INVENTARIO_LITERAL.has(response.qualityInventory)) {
      response.qualityInventory = { ...response.qualityInventory, files: [...qualityPaths].map(path => ({ path, lines: 12, bytes: 240, status: 'text' })) };
    }
    return response;
  };
  const parallel = async (thunks) => Promise.all(thunks.map((t) => Promise.resolve().then(t).catch(() => null)));
  const fn = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', corpoDoScript(FONTE));
  const resultado = await fn(args, agent, parallel, () => {}, (m) => logs.push(m));
  return { resultado, chamadas, maxAtivos, logs };
}

const ARGS = { workspaceRoot: '/workspace', scriptsDir: '/plugin/scripts', specPath: 'docs/plans/spec.md', branch: 'feat/x', perfil: 'economico', validacoes: ['npm test'], hoje: '2026-09-02' };
// baseRef dos casos com base: o SHA completo do commit, a única forma aceita desde a decisão 24 do
// dono (2026-11-03). É também o sha para o qual a base resolve numa execução real:
// `copia-base.mjs criar` e `inspecionar-git.mjs alteracoes` devolvem esse mesmo `sha`.
const SHA_BASE = `abc1234${'f'.repeat(33)}`;
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

test('spec funcional vazia bloqueia antes do TDD e da implementação', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'spec:validar': () => ({ ok: true, criterios: [], unidades: [], pendenciasBloqueadoras: [], validacoesDaSpec: ['npm test'] }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'Spec');
  assert.ok(!chamadas.some((c) => c.label === 'tdd:portao'));
});

test('ids de critério repetidos não deixam um teste provar dois critérios', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'spec:validar': () => ({
      ok: true, pendenciasBloqueadoras: [], validacoesDaSpec: ['npm test'],
      criterios: [{ id: 'C1', texto: 'faz X' }, { id: 'C1', texto: 'faz Y' }],
      unidades: [{ id: 'U1', titulo: 'unidade 1', arquivos: 'src/a.js', criterios: ['C1'] }],
    }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'Spec');
  assert.match(resultado.detalhe, /C1/);
  assert.ok(!chamadas.some((c) => c.label === 'tdd:portao'));
});

test('critério manual não isenta critério funcional com o mesmo id', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'spec:validar': () => ({
      ok: true, pendenciasBloqueadoras: [], validacoesDaSpec: ['npm test'],
      criterios: [{ id: 'C1', texto: 'visual', verificacaoComplementar: 'revisar tela' }, { id: 'C1', texto: 'salva dados' }],
      unidades: [{ id: 'U1', titulo: 'unidade 1', arquivos: 'src/a.js', criterios: ['C1'] }],
    }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'Spec');
});

test('ids de unidade repetidos bloqueiam antes de gerar labels de implementação', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'spec:validar': () => ({
      ...DEFAULTS['spec:validar'](),
      unidades: [
        { id: 'U1', titulo: 'primeira', arquivos: 'src/a.js', criterios: ['C1'] },
        { id: 'U1', titulo: 'segunda', arquivos: 'src/b.js', criterios: ['C1'] },
      ],
    }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'Spec');
  assert.match(resultado.detalhe, /U1/);
  assert.ok(!chamadas.some((c) => c.label === 'tdd:portao'));
});

test('unidade referindo critério inexistente bloqueia antes do TDD', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'spec:validar': () => ({ ...DEFAULTS['spec:validar'](), unidades: [{ id: 'U1', titulo: 'unidade 1', arquivos: 'src/a.js', criterios: ['C404'] }] }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'Spec');
  assert.match(resultado.detalhe, /C404/);
  assert.ok(!chamadas.some((c) => c.label === 'tdd:portao'));
});

test('critério funcional sem teste não usa validação genérica como prova', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [] }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'TDD');
  assert.match(resultado.detalhe, /C1/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
});

for (const path of ['', '/tmp/a.test.js', '../a.test.js', 'https://example.com/a.test.js']) {
  test(`referência de teste inválida bloqueia antes da implementação: ${path || '(vazia)'}`, async () => {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
      'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1', path)] }),
    } });
    assert.equal(resultado.status, 'bloqueado');
    assert.equal(resultado.fase, 'TDD');
    assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
  });
}

test('operário que não confirma o vermelho bloqueia o TDD', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [], problemas: ['teste nasceu verde'] }) } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'TDD');
});

test('vermelho auto-declarado não basta: o mecânico roda os testes e um exit 0 bloqueia o TDD', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'tdd:vermelho': (o) => ({ execucoes: idsDoSchema(o).map((t) => execucao(t, true)), hashesDosTestes: { [TESTE]: HASH_A } }) } });
  assert.ok(chamadas.some((c) => c.label === 'tdd:vermelho'), 'o harness despacha uma execução independente dos testes da SPEC');
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'TDD');
  assert.match(resultado.detalhe, /passaram/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')), 'nada implementa com o vermelho não confirmado');
});

test('erro de sintaxe/import/infra no vermelho independente bloqueia como evidência inválida, antes da implementação', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'tdd:vermelho': (o) => ({ execucoes: idsDoSchema(o).map((t) => execucao(t, false, 'infra')), hashesDosTestes: { [TESTE]: HASH_A } }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'TDD');
  assert.equal(resultado.motivo, 'evidencia-invalida');
  assert.match(resultado.detalhe, /Cannot find module/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
});

test('verificação manual explícita não vira alegação de critério verificado', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'spec:ids': () => ({ok:true,ids:['C1','C2'],erros:[],verificacoesComplementares:{C2:'inspecionar a tela no Claude'},tipos:{C1:'reproducao',C2:'reproducao'}}),
    'spec:validar': () => ({
      ok: true, pendenciasBloqueadoras: [], validacoesDaSpec: ['npm test'],
      criterios: [{ id: 'C1', texto: 'faz X' }, { id: 'C2', texto: 'aparência aprovada', verificacaoComplementar: 'inspecionar a tela no Claude' }],
      unidades: [{ id: 'U1', titulo: 'unidade 1', arquivos: 'src/a.js', criterios: ['C1', 'C2'] }],
    }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'VerificacaoManual');
  assert.deepEqual(resultado.verificacoesManuaisPendentes, [{ criterio: 'C2', verificacao: 'inspecionar a tela no Claude' }]);
});

test('teste da SPEC alterado durante a implementação é bloqueante automático, sem confirmação', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'validar:': (o) => ({ ...DEFAULTS['validar:'](o), hashesDosTestes: { [TESTE]: HASH_B } }) } });
  assert.equal(resultado.status, 'escalado');
  const findings = resultado.historico.flatMap((h) => h.findings);
  assert.ok(findings.some((f) => /alterad/i.test(f.resumo) && f.arquivo.includes(TESTE)), `esperava finding de teste alterado, veio ${JSON.stringify(findings)}`);
  assert.ok(!chamadas.some((c) => c.label.startsWith('confirmar:')), 'bloqueante automático não passa pelo confirmador');
  assert.ok(!chamadas.some((c) => c.label.startsWith('hashes:')), 'evidência que confere e diverge da base não ganha recoleta: é mudança de conteúdo');
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

test('caminho verde: uma iteração, relatório com modelo pedido por step e testes intactos', async () => {
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
  assert.match(resultado.modelos.nota, /pedido ao runtime/, 'o modelo registrado é o pedido, não o observado');
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

for (const chave of ['/workspace/tests/a.test.js', './tests/a.test.js:8', '/workspace/tests/a.test.js:8-10 ("caso")']) {
  test(`hash intacto aceita referência equivalente: ${chave}`, async () => {
    const { resultado } = await rodar({ args: ARGS, overrides: {
      'tdd:vermelho': (o) => ({...DEFAULTS['tdd:vermelho'](o), hashesDosTestes:{[chave]:HASH_A}}),
    }});
    assert.equal(resultado.status,'verde',JSON.stringify(resultado));
  });
}
test('dois hashes conflitantes para o mesmo arquivo reprovam como erro de evidência', async () => {
 const {resultado}=await rodar({args:ARGS,overrides:{'tdd:vermelho':(o)=>({...DEFAULTS['tdd:vermelho'](o),hashesDosTestes:{[TESTE]:HASH_A,['/workspace/'+TESTE]:HASH_B}})}});
 assert.equal(resultado.status,'erro'); assert.equal(resultado.fase,'TDD');
});
test('arquivo externo com mesmo sufixo não equivale ao teste do workspace', async () => {
 const {resultado}=await rodar({args:ARGS,overrides:{'validar:':(o)=>({...DEFAULTS['validar:'](o),hashesDosTestes:{['/outro/'+TESTE]:HASH_A}})}});
 assert.notEqual(resultado.status,'verde');
});

test('SPEC original duplicada bloqueia antes do agente que poderia reinterpretá-la',async()=>{
 const {resultado,chamadas}=await rodar({args:ARGS,overrides:{'spec:ids':()=>({ok:false,ids:['C1','C1'],erros:['ID repetido: C1']})}});
 assert.equal(resultado.status,'bloqueado');assert.equal(resultado.fase,'Spec');
 assert.ok(!chamadas.some(c=>c.label==='spec:validar'));
});
test('agente que troca identidade de critério original bloqueia antes do TDD',async()=>{
 const {resultado}=await rodar({args:ARGS,overrides:{'spec:ids':()=>({ok:true,ids:['A1'],erros:[],verificacoesComplementares:{},tipos:{A1:'reproducao'}})}});
 assert.equal(resultado.status,'bloqueado');assert.equal(resultado.fase,'Spec');
});

test('argumentos de caminho malformados retornam erro antes de chamar agentes', async () => {
  for (const campo of ['workspaceRoot', 'scriptsDir', 'specPath']) {
    for (const valor of [42, {}, '   ']) {
      const { resultado, chamadas } = await rodar({ args: { ...ARGS, [campo]: valor } });
      assert.equal(resultado.status, 'erro');
      assert.equal(resultado.fase, 'Args');
      assert.equal(chamadas.length, 0);
    }
  }
});

test('agente não inventa nem remove verificação manual da tabela original',async()=>{
 for(const manual of [false,true]){
  const {resultado}=await rodar({args:ARGS,overrides:{
   'spec:ids':()=>({ok:true,ids:['C1'],erros:[],verificacoesComplementares:manual?{C1:'revisar contraste'}:{},tipos:{C1:'reproducao'}}),
   'spec:validar':()=>({...DEFAULTS['spec:validar'](),criterios:[{id:'C1',texto:'faz X',verificacaoComplementar:manual?'':'soma.test.js a escrever'}]}),
  }});
  assert.equal(resultado.status,manual?'bloqueado':'verde',JSON.stringify(resultado));
  if(manual) assert.equal(resultado.fase,'VerificacaoManual');
 }
});

test('ID constructor não herda uma verificação manual do protótipo',async()=>{
 const {resultado}=await rodar({args:ARGS,overrides:{
  'spec:ids':()=>({ok:true,ids:['constructor'],erros:[],verificacoesComplementares:{},tipos:{constructor:'reproducao'}}),
  'spec:validar':()=>({...DEFAULTS['spec:validar'](),criterios:[{id:'constructor',texto:'faz X'}],unidades:[{id:'U1',titulo:'unidade',arquivos:'src/a.js',criterios:['constructor']}]}),
  'tdd:portao':()=>({vermelhoConfirmado:true,testes:[repro('constructor')]}),
 }});
 assert.equal(resultado.status,'verde',JSON.stringify(resultado));
});

for (const path of ['tests/./a.test.js', 'tests//a.test.js']) {
  test(`path do TDD usa a mesma identidade do helper: ${path}`, async () => {
    const { resultado } = await rodar({ args: ARGS, overrides: {
      'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1', path)] }),
    } });
    assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  });
}

test('comandos transportados executam os helpers reais com espaços e aspas no caminho', async t => {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), "odin comando ' ")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const specPath = "spec ' teste.md";
  // 'á' (unidade UTF-16 < 256) e '✓' (> 255) exercitam os dois ramos da conferência: o script
  // real e o controlador têm cada um a sua cópia do CRC, e é aqui que os dois precisam concordar.
  const path = "teste ' somá ✓.js";
  writeFileSync(resolve(root, specPath), '# SPEC\n## Critérios de aceite\n| # | Critério | Teste |\n|---|---|---|\n| C1 | soma | teste |\n' + '\n## Contrato de qualidade\n```json\n' + JSON.stringify(LEGACY_QUALITY) + '\n```\n');
  writeFileSync(resolve(root, path), 'abc');
  let comandos = 0;
  function executar(prompt) {
    const command = /```bash\s*\n([\s\S]*?)```/.exec(prompt)?.[1].trim();
    assert.ok(command, 'o prompt fornece o comando isolado da pontuação da prosa');
    const r = spawnSync('/bin/sh', ['-c', command], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    comandos++;
    return JSON.parse(r.stdout);
  }
  const { resultado } = await rodar({ args: { ...ARGS, workspaceRoot: root, scriptsDir: resolve(dirname(HARNESS), '../scripts'), specPath }, overrides: {
    'spec:ids': (_opts, _chamadas, prompt) => executar(prompt),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1', path)] }),
    'tdd:vermelho': (o, _chamadas, prompt) => ({ execucoes: idsDoSchema(o).map((t) => execucao(t, false)), hashesDosTestes: executar(prompt) }),
    'validar:': (o, _chamadas, prompt) => ({ verde: true, falhas: [], execucoes: idsDoSchema(o).map((t) => execucao(t, true)), hashesDosTestes: executar(prompt) }),
  } });
  assert.equal(comandos, 3);
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
});

// OM-01: o cache reaproveita o veredito, não apaga bloqueante ainda observado.
for (const [tipo, sinal] of [
  ['duplicacoes', { arquivo: 'src/a.js', linha: 12, oQue: 'calculo', ondeJaExiste: 'src/base.js' }],
  ['abstracoesUsoUnico', { arquivo: 'src/a.js', linha: 12, oQue: 'Wrapper', unicoChamador: 'src/cliente.js' }],
]) {
  test(`OM-01: ${tipo} confirmada e persistente continua bloqueante até o teto`, async () => {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
      'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), [tipo]: [sinal] }),
      'confirmar:': () => ({ real: true, bloqueante: true, porque: 'cenário reproduzido' }),
    } });
    assert.equal(resultado.status, 'escalado');
    assert.equal(resultado.fase, 'Loop');
    assert.equal(resultado.historico.length, 3);
    assert.ok(resultado.historico.every(h => h.findings.some(f => f.origem === 'auditoria-ponytail')));
    assert.equal(chamadas.filter(c => c.label.startsWith('confirmar:')).length, 1);
  });

  test(`OM-01: ${tipo} confirmada deixa de bloquear quando desaparece da auditoria`, async () => {
    let vez = 0;
    const { resultado } = await rodar({ args: ARGS, overrides: {
      'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), [tipo]: vez++ === 0 ? [sinal] : [] }),
      'confirmar:': () => ({ real: true, bloqueante: true, porque: 'cenário reproduzido' }),
    } });
    assert.equal(resultado.status, 'verde');
    assert.equal(resultado.iteracoes, 2);
  });

  test(`OM-01: ${tipo} refutada reaproveita o veredito na mesma evidência`, async () => {
    let vez = 0;
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
      'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), [tipo]: [sinal] }),
      'validar:': () => ({ ...DEFAULTS['validar:'](), verde: vez++ > 0 }),
    } });
    assert.equal(resultado.status, 'verde');
    assert.equal(resultado.iteracoes, 2);
    assert.equal(chamadas.filter(c => c.label.startsWith('confirmar:')).length, 1);
  });
}

test('OM-01: cenário de abstração alterado exige novo veredito', async () => {
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), abstracoesUsoUnico: [{ arquivo: 'src/a.js', oQue: 'Wrapper', unicoChamador: vez++ === 0 ? 'src/antigo.js' : 'src/novo.js' }] }),
    'validar:': () => ({ ...DEFAULTS['validar:'](), verde: vez > 0 }),
    'confirmar:': (opts, chamadas) => ({ real: chamadas.filter(c => c.label.startsWith('confirmar:')).length > 1, bloqueante: true, porque: 'cenário mudou' }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(chamadas.filter(c => c.label.startsWith('confirmar:')).length, 2);
});

// OM-07: executar a receita emitida contra Git real, sem simular o índice.
// O executor abaixo é uma fixture técnica; não mede obediência de modelo.
test('OM-07: revisão inclui arquivo novo relatado sem encenar notas ou alterar índice', async () => {
  const dir = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-review-index-')));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, env, encoding: 'utf8', timeout: 10000 });
    assert.equal(r.status, 0, r.stderr); return r.stdout;
  };
  try {
    git('init', '-q'); mkdirSync(resolve(dir, 'src')); mkdirSync(resolve(dir, 'docs'));
    writeFileSync(resolve(dir, 'src/a.js'), 'export const a = 1;\n');
    git('add', '--', 'src/a.js');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'baseline fixture');
    writeFileSync(resolve(dir, 'src/a.js'), 'export const a = 2;\n');
    writeFileSync(resolve(dir, 'src/new.js'), 'export const novoAutorizado = 3;\n');
    writeFileSync(resolve(dir, 'docs/pendencias.md'), 'NOTA_LOCAL_FORA_DO_ESCOPO\n');
    const before = readFileSync(resolve(dir, '.git/index'));
    let observed = '';
    const { resultado } = await rodar({ args: { ...ARGS, workspaceRoot: dir, scriptsDir: resolve(HARNESS, '../../scripts') }, overrides: {
      'impl:': () => ({ ...DEFAULTS['impl:'](), arquivosTocados: ['src/a.js', 'src/new.js'] }),
      'ponytail:': (opts, calls, prompt) => {
        // Receita antiga: duas chamadas literais que causavam o vazamento.
        // Receita corrigida: único bloco sh, produzido pelo harness com argumentos concretos.
        const block = prompt.match(/```sh\n([\s\S]*?)\n```/);
        const commands = block ? block[1] : [...prompt.matchAll(/`([^`]+)`/g)].slice(0, 2).map(x => x[1]).join('\n');
        const r = spawnSync('sh', ['-c', commands], { cwd: dir, env, encoding: 'utf8', timeout: 10000 });
        assert.equal(r.status, 0, r.stderr); observed = r.stdout;
        return DEFAULTS['ponytail:']();
      },
    } });
    assert.equal(resultado.status, 'verde');
    assert.deepEqual(readFileSync(resolve(dir, '.git/index')), before, 'auditoria não pode modificar o índice');
    assert.match(observed, /novoAutorizado/);
    assert.ok(!observed.includes('NOTA_LOCAL_FORA_DO_ESCOPO'));
    git('add', '--', 'src/a.js');
    assert.equal(git('diff', '--cached', '--name-only').trim(), 'src/a.js');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── 2026-10-04: achado que ninguém pode consertar, e hash copiado errado ─────────────────────
// Duas rodadas reais do dev-loop (perfil máximo) terminaram escaladas sem defeito de
// comportamento em aberto. Na última iteração, 9 dos 12 bloqueantes eram sinais P2/P11 da
// auditoria dentro dos testes da SPEC — que a regra dos testes intactos proíbe de editar — e os
// 27 sinais confirmados nas duas rodadas traziam "não bloqueante" no texto de um veredito que só
// tinha o campo `real`. Numa iteração anterior, um hash copiado com dois caracteres trocados
// virou "teste alterado" num arquivo que nunca mudou. Os casos abaixo travam as três correções e
// os portões que elas NÃO podem abrir.

const SINAL_EM_PRODUCAO = { arquivo: 'src/a.js', linha: 12, oQue: 'Wrapper', unicoChamador: 'src/cliente.js' };

for (const arquivo of [TESTE, `/workspace/${TESTE}`, `./${TESTE}:54`]) {
  test(`sinal P2/P11 da auditoria em teste da SPEC vira pendência, sem confirmador e sem bloquear: ${arquivo}`, async () => {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
      'ponytail:': () => ({ ...DEFAULTS['ponytail:'](),
        duplicacoes: [{ arquivo, linha: 54, oQue: 'travessia por fila', ondeJaExiste: `${TESTE}:39` }],
        abstracoesUsoUnico: [{ arquivo, linha: 35, oQue: 'helper de teste', unicoChamador: `${TESTE}:84` }],
      }),
      // Se o sinal chegasse ao confirmador, este veredito o faria bloquear até o teto.
      'confirmar:': () => ({ real: true, bloqueante: true, porque: 'o fato existe' }),
    } });
    assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
    assert.equal(resultado.iteracoes, 1);
    assert.ok(!chamadas.some((c) => c.label.startsWith('confirmar:')), 'teste congelado não paga confirmador');
    assert.deepEqual(resultado.ponytail.pendenciasEmTestesDaSpec.map((p) => p.resumo.slice(0, 3)), ['P2:', 'P11']);
    assert.ok(resultado.ponytail.pendenciasEmTestesDaSpec.every((p) => p.arquivo === arquivo && p.iteracao === 1));
    assert.deepEqual(resultado.ponytail.duplicacoesEAbstracoes, [], 'pendência não julgada não se passa por veredito');
  });
}

test('pendência em teste da SPEC não solta o sinal em arquivo de produção nem manda o operário editar o teste', async () => {
  const prompts = [];
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'impl:': (_opts, _chamadas, prompt) => { prompts.push(prompt); return DEFAULTS['impl:'](); },
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), abstracoesUsoUnico: [
      { arquivo: TESTE, linha: 35, oQue: 'helper de teste', unicoChamador: `${TESTE}:84` },
      SINAL_EM_PRODUCAO,
    ] }),
    'confirmar:': () => ({ real: true, bloqueante: true, porque: 'esconde o contrato da unidade' }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.historico.length, 3);
  assert.ok(resultado.historico.every((h) => h.findings.length === 1 && h.findings[0].arquivo === 'src/a.js'));
  assert.equal(chamadas.filter((c) => c.label.startsWith('confirmar:')).length, 1, 'só o sinal de produção é julgado');
  assert.equal(resultado.ponytail.pendenciasEmTestesDaSpec.length, 1, 'a auditoria revê a branch inteira: o mesmo sinal não vira três pendências');
  assert.match(prompts[1], /CORREÇÕES DESTA ITERAÇÃO/);
  assert.ok(prompts[1].includes('src/a.js') && !prompts[1].includes(TESTE), 'a correção obrigatória não aponta pro teste que o operário é proibido de editar');
});

for (const arquivo of [undefined, `/outro/${TESTE}`, `pacote/${TESTE}`]) {
  test(`sinal da auditoria fora da lista de testes da SPEC segue o fluxo normal: ${arquivo ?? '(sem arquivo)'}`, async () => {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
      'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), abstracoesUsoUnico: [{ ...SINAL_EM_PRODUCAO, arquivo }] }),
      'confirmar:': () => ({ real: true, bloqueante: true, porque: 'cenário reproduzido' }),
    } });
    assert.equal(resultado.status, 'escalado', 'mesmo sufixo em outra raiz, ou arquivo não informado, não é teste congelado');
    assert.equal(chamadas.filter((c) => c.label.startsWith('confirmar:')).length, 1);
    assert.deepEqual(resultado.ponytail.pendenciasEmTestesDaSpec, []);
  });
}

test('sinal da auditoria confirmado como real e não bloqueante não vira retrabalho, e o relatório guarda o veredito', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), abstracoesUsoUnico: [SINAL_EM_PRODUCAO] }),
    'confirmar:': () => ({ real: true, bloqueante: false, porque: 'Confirmado, mas é nao-bloqueante: só peso de diff.' }),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.iteracoes, 1);
  const confirmadores = chamadas.filter((c) => c.label.startsWith('confirmar:'));
  assert.equal(confirmadores.length, 1);
  assert.deepEqual(confirmadores[0].opts.schema.required, ['real', 'bloqueante'], 'fato e severidade são campos separados e obrigatórios');
  assert.equal(resultado.ponytail.duplicacoesEAbstracoes.length, 1);
  const [julgado] = resultado.ponytail.duplicacoesEAbstracoes;
  assert.equal(julgado.confirmado, true, 'o fato continua registrado como real');
  assert.equal(julgado.severidade, 'nao-bloqueante');
  assert.match(julgado.porqueVeredito, /nao-bloqueante/);
});

test('veredito "real, não bloqueante" é reaproveitado: o sinal reaparece sem novo confirmador e sem bloquear', async () => {
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), abstracoesUsoUnico: [SINAL_EM_PRODUCAO] }),
    'validar:': () => ({ ...DEFAULTS['validar:'](), verde: vez++ > 0 }),
    'confirmar:': () => ({ real: true, bloqueante: false, porque: 'peso de diff' }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.equal(resultado.iteracoes, 2);
  assert.equal(chamadas.filter((c) => c.label.startsWith('confirmar:')).length, 1);
});

test('veredito da auditoria sem o campo de severidade bloqueia: só "bloqueante: false" explícito libera', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), abstracoesUsoUnico: [SINAL_EM_PRODUCAO] }),
    'confirmar:': () => ({ real: true, porque: 'cenário reproduzido' }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.ponytail.duplicacoesEAbstracoes[0].severidade, 'bloqueante');
});

test('confirmador não rebaixa finding de lente: a severidade é da lente e o schema nem oferece o campo', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'rev:': () => ({ findings: [{ arquivo: 'src/a.js', linha: 3, resumo: 'critério C1 não atendido', cenario: 'entrada vazia devolve 0', severidade: 'bloqueante', confianca: 'plausivel' }] }),
    'confirmar:': () => ({ real: true, bloqueante: false, porque: 'existe; eu não bloquearia' }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.historico.length, 3);
  const confirmadores = chamadas.filter((c) => c.label.startsWith('confirmar:'));
  assert.equal(confirmadores.length, 3);
  assert.ok(confirmadores.every((c) => !Object.hasOwn(c.opts.schema.properties, 'bloqueante') && c.opts.schema.additionalProperties === false));
});

// Hash de fixture com vizinhos distintos, pra reproduzir a troca observada ("c3d" lido como
// "d3c": dois caracteres a distância 2, invertidos). Conferência do valor CORRETO calculada com
// o zlib do Python, como as de HASH_A e HASH_B.
const SHA_C = '0123456789abcdef'.repeat(4);
const HASH_C = `${SHA_C}-cad97208`;
const HASH_C_TROCADO = HASH_C.replace('cde', 'edc');
const BASE_C = { 'tdd:vermelho': (o) => ({ ...DEFAULTS['tdd:vermelho'](o), hashesDosTestes: { [TESTE]: HASH_C } }) };

test('hash copiado com dois caracteres trocados na validação não vira "teste alterado": recoleta única no piso do papel', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...BASE_C,
    'validar:': (o) => ({ ...DEFAULTS['validar:'](o), hashesDosTestes: { [TESTE]: HASH_C_TROCADO } }),
    'hashes:': () => ({ hashesDosTestes: { [TESTE]: HASH_C } }),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.iteracoes, 1, 'o arquivo nunca mudou: a cópia errada não custa uma iteração');
  const recoletas = chamadas.filter((c) => c.label.startsWith('hashes:'));
  assert.deepEqual(recoletas.map(label), ['hashes:i1']);
  assert.equal(recoletas[0].opts.agentType, 'odin:operario', 'a recoleta sobe pro piso do papel em vez de repetir no tier que errou');
  assert.equal(resultado.fallbacks.length, 1, 'a recoleta fica registrada no relatório');
  assert.equal(resultado.fallbacks[0].chamada, 'hashes:i1');
  assert.match(resultado.fallbacks[0].causa, /erro de transcrição/);
});

test('hash copiado errado na BASE do portão TDD é recolhido antes de qualquer implementação', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'tdd:vermelho': (o) => ({ ...DEFAULTS['tdd:vermelho'](o), hashesDosTestes: { [TESTE]: HASH_C_TROCADO } }),
    'tdd:hashes': () => ({ hashesDosTestes: { [TESTE]: HASH_C } }),
    'validar:': (o) => ({ ...DEFAULTS['validar:'](o), hashesDosTestes: { [TESTE]: HASH_C } }),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.iteracoes, 1, 'base corrompida fazia toda validação correta divergir até o teto');
  const rotulos = chamadas.map(label);
  assert.ok(rotulos.includes('tdd:hashes') && rotulos.indexOf('tdd:hashes') < rotulos.indexOf('impl:U1'), rotulos.join(', '));
});

test('evidência que não confere nem na recoleta é erro de evidência, nunca "teste alterado"', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...BASE_C,
    // Primeiro o SHA puro, sem conferência (formato anterior à 2.4.12); na recoleta, a troca de caracteres.
    'validar:': (o) => ({ ...DEFAULTS['validar:'](o), hashesDosTestes: { [TESTE]: SHA_C } }),
    'hashes:': () => ({ hashesDosTestes: { [TESTE]: HASH_C_TROCADO } }),
  } });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.fase, 'Validar');
  assert.match(resultado.detalhe, /fora do formato/);
  assert.match(resultado.detalhe, /recoleta: .*erro de transcrição/);
  assert.match(resultado.acao, /não prova alteração/);
  assert.equal(chamadas.filter((c) => c.label.startsWith('hashes:')).length, 1, 'a recoleta é uma só');
  assert.ok(!chamadas.some((c) => c.label.startsWith('ponytail:')), 'sem evidência conferida o run não segue pra auditoria');
});

test('recoleta não é apelação: coleta conferida que diverge da base é teste alterado e bloqueia', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'validar:': (o) => ({ ...DEFAULTS['validar:'](o), hashesDosTestes: { [TESTE]: HASH_A.replace('-e411bb3e', '-00000000') } }),
    'hashes:': () => ({ hashesDosTestes: { [TESTE]: HASH_B } }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.historico.length, 3);
  assert.ok(resultado.historico.every((h) => h.findings.some((f) => f.origem === 'testes-intactos')));
  assert.ok(!chamadas.some((c) => c.label.startsWith('confirmar:')), 'bloqueante automático não passa pelo confirmador');
});

// ── 2026-11-01 (2.5.0): reprodução × preservação, exceção humana, retomada tardia ─────────────
// Caso real: 4 regressões vermelhas e 6 controles verdes travaram no portão antigo, que exigia
// que TODO teste novo falhasse. Outro: uma retomada reabriu o portão com a implementação já na
// worktree; os testes verdes bloquearam e o fluxo pediu reversão. Os casos abaixo travam a
// separação, a exceção registrada, o rebaseline explícito e o reuso de validação, e os portões
// que nada disso abre: evidência inválida, controle vermelho, execução independente e hashes.

// Tipo de cada critério na coluna Tipo da SPEC (2.6.0): reprodução por default, preservação onde
// o mapa disser. Critério com controle precisa ser de preservação na SPEC.
const specCom = (ids, tipos = {}) => ({
  'spec:ids': () => ({ ok: true, ids, erros: [], verificacoesComplementares: {}, tipos: Object.fromEntries(ids.map((id) => [id, tipos[id] || 'reproducao'])) }),
  'spec:validar': () => ({ ...DEFAULTS['spec:validar'](), criterios: ids.map((id) => ({ id, texto: `faz ${id}` })), unidades: [{ id: 'U1', titulo: 'unidade 1', arquivos: 'src/a.js', criterios: ids }] }),
});
// Execução independente com resultado por índice do teste: `[exitZero, tipoFalha?]`.
const vermelhoCom = (...resultados) => (o) => ({ execucoes: idsDoSchema(o).map((t, i) => execucao(t, ...resultados[i])), hashesDosTestes: { [TESTE]: HASH_A }, alteracoes: ALTERACOES });
const preserva = (...ids) => Object.fromEntries(ids.map((id) => [id, 'preservacao']));
// Exceção humana exige perfil máximo (decisão do dono, 2026-11-02): a continuidade sem vermelho é
// compensada pelas três lentes.
const MAX = { ...ARGS, perfil: 'maximo' };
const validarCom = (...resultados) => (o) => ({ ...DEFAULTS['validar:'](o), execucoes: idsDoSchema(o).map((t, i) => execucao(t, ...resultados[i])) });
const AUT = { criterios: ['C1'], evidencia: 'relatório bloqueado do run anterior: C1 só preserva comportamento que já existe', autorizacao: 'pode seguir sem vermelho em C1, mantendo as três lentes e o CI', autorizadoPor: 'dono do projeto', registradaEm: '2026-11-01' };
const REB = { criteriosAprovados: ['C1'], motivo: 'retomada com a implementação já na worktree', autorizadoPor: 'dono do projeto', registradaEm: '2026-11-01' };

test('C1a: portão separa reprodução, preservação e complementares, e a execução independente roda cada teste pelo próprio comando', async () => {
  const prompts = {};
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2'], preserva('C2')),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), controle('C2')], complementares: [{ criterio: 'C2', verificacao: 'npm run lint', motivo: 'estilo do módulo' }] }),
    'tdd:vermelho': (o, _c, prompt) => { prompts.vermelho = prompt; return vermelhoCom([false], [true])(o); },
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  const portao = chamadas.find((c) => c.label === 'tdd:portao');
  const item = portao.opts.schema.properties.testes.items;
  assert.deepEqual(item.properties.tipo.enum, ['reproducao', 'preservacao']);
  for (const campo of ['criterio', 'path', 'tipo', 'comando', 'motivoFalha']) assert.ok(item.required.includes(campo), `testes[].${campo} é obrigatório`);
  assert.ok(portao.opts.schema.properties.complementares, 'verificações complementares têm campo próprio');
  assert.deepEqual(portao.opts.schema.properties.complementares.items.properties.criterio.enum, ['C1', 'C2']);
  const vermelho = chamadas.find((c) => c.label === 'tdd:vermelho');
  assert.deepEqual(idsDoSchema(vermelho.opts), ['T1', 'T2']);
  assert.deepEqual(vermelho.opts.schema.properties.execucoes.items.properties.tipoFalha.enum, ['assercao', 'infra', 'nenhuma']);
  assert.match(prompts.vermelho, /T1[^\n]*--test-name-pattern=C1/);
  assert.match(prompts.vermelho, /T2[^\n]*--test-name-pattern=C2/);
  assert.equal(resultado.tdd.vermelhoConfirmado, true);
  assert.deepEqual(resultado.tdd.reproducoes.map((t) => [t.teste, t.criterio]), [['T1', 'C1']]);
  assert.deepEqual(resultado.tdd.preservacoes.map((t) => [t.teste, t.criterio]), [['T2', 'C2']]);
  assert.deepEqual(resultado.tdd.complementares, [{ criterio: 'C2', verificacao: 'npm run lint', motivo: 'estilo do módulo' }]);
});

test('C1a: teste sem tipo válido ou sem comando próprio bloqueia antes da execução independente', async () => {
  const { tipo: _sem, ...semTipo } = repro('C1');
  for (const ruim of [{ ...repro('C1'), tipo: 'controle' }, { ...repro('C1'), comando: '   ' }, semTipo]) {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [ruim] }) } });
    assert.equal(resultado.status, 'bloqueado', JSON.stringify(ruim));
    assert.equal(resultado.fase, 'TDD');
    assert.ok(!chamadas.some((c) => c.label === 'tdd:vermelho'));
  }
});

test('C1b: suíte toda verde só com controles, sem reprodução, bloqueia antes da implementação', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2'], preserva('C1', 'C2')),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [controle('C1'), controle('C2')] }),
    'tdd:vermelho': vermelhoCom([true], [true]),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'TDD');
  assert.equal(resultado.motivo, 'sem-vermelho');
  assert.match(resultado.detalhe, /C1/);
  assert.match(resultado.detalhe, /C2/);
  assert.match(resultado.acao, /autorizacoesTdd/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
});

test('C1b: reprodução que nasce verde bloqueia mesmo ao lado de outra reprodução vermelha', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2']),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), repro('C2')] }),
    'tdd:vermelho': vermelhoCom([false], [true]),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.motivo, 'sem-vermelho');
  assert.ok(resultado.tdd.violacoes.some((v) => v.tipo === 'reproducao-verde' && v.criterio === 'C2'), JSON.stringify(resultado.tdd));
  assert.ok(!resultado.tdd.violacoes.some((v) => v.criterio === 'C1'));
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
});

test('C1c: suíte mista do caso real, 4 regressões vermelhas e 6 controles verdes, abre o portão e fecha verde', async () => {
  const ids = Array.from({ length: 10 }, (_, i) => `C${i + 1}`);
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...specCom(ids, preserva(...ids.slice(4))),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: ids.map((id, i) => (i < 4 ? repro(id) : controle(id))) }),
    'tdd:vermelho': (o) => ({ execucoes: idsDoSchema(o).map((t, i) => execucao(t, i >= 4)), hashesDosTestes: { [TESTE]: HASH_A } }),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.tdd.vermelhoConfirmado, true);
  assert.equal(resultado.tdd.reproducoes.length, 4);
  assert.equal(resultado.tdd.preservacoes.length, 6);
  assert.deepEqual(resultado.tdd.violacoes, []);
  assert.ok(chamadas.some((c) => c.label === 'impl:U1'));
});

test('C1d: erro de import em teste de reprodução é evidência inválida: bloqueia e nunca conta como vermelho', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2'], preserva('C2')),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), controle('C2')] }),
    'tdd:vermelho': vermelhoCom([false, 'infra'], [true]),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.motivo, 'evidencia-invalida');
  assert.match(resultado.detalhe, /Cannot find module/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
});

test('C1d: controle de preservação vermelho antes da implementação bloqueia o portão', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2'], preserva('C2')),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), controle('C2')] }),
    'tdd:vermelho': vermelhoCom([false], [false]),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.motivo, 'controle-vermelho');
  assert.match(resultado.detalhe, /C2/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
});

test('C1d: resultado incoerente (exit 0 com falha de asserção) é evidência inválida', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'tdd:vermelho': vermelhoCom([true, 'assercao']) } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.motivo, 'evidencia-invalida');
});

test('C1d: execução independente faltando ou repetida é erro de evidência, não vermelho', async () => {
  for (const [execucoes, esperado] of [
    [[execucao('T1', false)], /sem execução independente[^\n]*T2/],
    [[execucao('T1', false), execucao('T1', false), execucao('T2', false)], /execução repetida[^\n]*T1/],
  ]) {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
      ...specCom(['C1', 'C2']),
      'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), repro('C2')] }),
      'tdd:vermelho': () => ({ execucoes, hashesDosTestes: { [TESTE]: HASH_A } }),
    } });
    assert.equal(resultado.status, 'erro', JSON.stringify(resultado));
    assert.equal(resultado.fase, 'TDD');
    assert.match(resultado.detalhe, esperado);
    assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
  }
});

test('C1e: regressão que continua vermelha após a implementação não fecha verde e vira bloqueante nomeado', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'validar:': validarCom([false]) } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.historico.length, 3);
  const findings = resultado.historico.flatMap((h) => h.findings);
  assert.ok(findings.some((f) => f.origem === 'portao-tdd' && /reprodução/i.test(f.resumo) && /T1/.test(f.resumo)), JSON.stringify(findings));
  assert.ok(!chamadas.some((c) => c.label.startsWith('confirmar:')), 'bloqueante automático não passa pelo confirmador');
});

test('C1e: controle de preservação que fica vermelho após a implementação bloqueia', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2'], preserva('C2')),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), controle('C2')] }),
    'tdd:vermelho': vermelhoCom([false], [true]),
    'validar:': validarCom([true], [false]),
  } });
  assert.equal(resultado.status, 'escalado');
  const findings = resultado.historico.flatMap((h) => h.findings);
  assert.ok(findings.some((f) => f.origem === 'portao-tdd' && /controle de preservação ficou vermelho/i.test(f.resumo) && /C2/.test(f.resumo)), JSON.stringify(findings));
});

test('C1e: validação que declara verde sem execução por teste não fecha', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'validar:': () => ({ verde: true, falhas: [], hashesDosTestes: { [TESTE]: HASH_A } }) } });
  assert.equal(resultado.status, 'escalado');
  const findings = resultado.historico.flatMap((h) => h.findings);
  assert.ok(findings.some((f) => f.origem === 'portao-tdd' && /sem execução/i.test(f.resumo)), JSON.stringify(findings));
});

test('C1f: autorização com escopo e evidência permite continuidade explícita sem falsificar vermelhoConfirmado', async () => {
  const { resultado, chamadas } = await rodar({ args: { ...MAX, autorizacoesTdd: [AUT] }, overrides: {
    ...specCom(['C1'], preserva('C1')),
    'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [controle('C1')], problemas: ['C1 só preserva comportamento existente'] }),
    'tdd:vermelho': vermelhoCom([true]),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.tdd.vermelhoConfirmado, false, 'a autorização não reescreve o que foi medido');
  assert.ok(resultado.tdd.violacoes.some((v) => v.criterio === 'C1'), 'a violação original fica no relatório');
  const [aut] = resultado.tdd.continuidade.autorizacoes;
  assert.deepEqual(aut.criteriosCobertos, ['C1']);
  assert.equal(aut.evidencia, AUT.evidencia);
  assert.equal(aut.autorizacao, AUT.autorizacao, 'a citação literal do dono vai para o relatório');
  assert.equal(aut.autorizadoPor, AUT.autorizadoPor);
  assert.equal(aut.registradaEm, AUT.registradaEm);
  assert.equal(aut.aplicadaEm, ARGS.hoje);
  assert.ok(chamadas.some((c) => c.label === 'tdd:vermelho'), 'a execução independente continua acontecendo');
});

test('C1f: sem autorização registrada o harness não presume exceção, e a autorização não vale para outro run', async () => {
  const comum = { ...specCom(['C1'], preserva('C1')), 'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [controle('C1')] }), 'tdd:vermelho': vermelhoCom([true]) };
  const antes = await rodar({ args: ARGS, overrides: comum });
  const autorizado = await rodar({ args: { ...MAX, autorizacoesTdd: [AUT] }, overrides: comum });
  const depois = await rodar({ args: ARGS, overrides: comum });
  assert.equal(antes.resultado.status, 'bloqueado');
  assert.equal(autorizado.resultado.status, 'verde');
  assert.deepEqual(depois.resultado, antes.resultado, 'a autorização não altera nem se estende a outro relatório');
});

test('C1f: autorização que não cobre todo o escopo bloqueia, listando o critério descoberto', async () => {
  const { resultado, chamadas } = await rodar({ args: { ...MAX, autorizacoesTdd: [AUT] }, overrides: {
    ...specCom(['C1', 'C2'], preserva('C1', 'C2')),
    'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [controle('C1'), controle('C2')] }),
    'tdd:vermelho': vermelhoCom([true], [true]),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.motivo, 'sem-vermelho');
  assert.match(resultado.detalhe, /C2/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
});

test('C1f: autorização malformada é erro de args antes de qualquer agente', async () => {
  const { autorizacao: _semCitacao, ...semCitacao } = AUT;
  for (const ruim of ['C1', AUT, [{ ...AUT, evidencia: '  ' }], [{ ...AUT, criterios: [] }], [{ ...AUT, registradaEm: 'ontem' }], [{ ...AUT, autorizadoPor: '' }], [{ ...AUT, criterios: [''] }],
    [semCitacao], [{ ...AUT, autorizacao: '  ' }], [{ ...AUT, motivo: '' }], [{ ...AUT, aprovadoRetroativamente: true }], [{ ...AUT, cobreEvidenciaInvalida: true }]]) {
    const { resultado, chamadas } = await rodar({ args: { ...MAX, autorizacoesTdd: ruim } });
    assert.equal(resultado.status, 'erro', JSON.stringify(ruim));
    assert.equal(resultado.fase, 'Args');
    assert.match(resultado.detalhe, /malformado/, 'erro de forma, não de perfil');
    assert.equal(chamadas.length, 0);
  }
});

test('C1f: autorização que cita critério inexistente bloqueia antes do portão', async () => {
  const { resultado, chamadas } = await rodar({ args: { ...MAX, autorizacoesTdd: [{ ...AUT, criterios: ['C9'] }] } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'Spec');
  assert.match(resultado.detalhe, /C9/);
  assert.ok(!chamadas.some((c) => c.label === 'tdd:portao'));
});

test('C1f: autorização não cobre evidência inválida nem controle vermelho', async () => {
  const infra = await rodar({ args: { ...MAX, autorizacoesTdd: [AUT] }, overrides: { 'tdd:vermelho': vermelhoCom([false, 'infra']) } });
  assert.equal(infra.resultado.status, 'bloqueado');
  assert.equal(infra.resultado.motivo, 'evidencia-invalida');
  const controleVermelho = await rodar({ args: { ...MAX, autorizacoesTdd: [AUT] }, overrides: {
    ...specCom(['C1'], preserva('C1')),
    'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [controle('C1')] }),
    'tdd:vermelho': vermelhoCom([false]),
  } });
  assert.equal(controleVermelho.resultado.status, 'bloqueado');
  assert.equal(controleVermelho.resultado.motivo, 'controle-vermelho');
});

test('C1g: rebaseline explícito aceita reprodução já verde como implementação anterior declarada, sem pedir reversão', async () => {
  const prompts = {};
  const { resultado, chamadas } = await rodar({ args: { ...ARGS, rebaselineTdd: REB }, overrides: {
    'tdd:portao': (_o, _c, prompt) => { prompts.portao = prompt; return { vermelhoConfirmado: false, testes: [repro('C1')], implementacaoAnterior: { detectada: true, evidencias: ['src/a.js já implementa C1'] } }; },
    'tdd:vermelho': vermelhoCom([true]),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.tdd.vermelhoConfirmado, false);
  const reb = resultado.tdd.continuidade.rebaseline;
  assert.deepEqual(reb.implementacaoAnterior.criterios, ['C1']);
  assert.equal(reb.implementacaoAnterior.declaradaPeloOperario, true);
  assert.deepEqual(reb.implementacaoAnterior.evidencias, ['src/a.js já implementa C1']);
  assert.equal(reb.motivo, REB.motivo);
  assert.match(prompts.portao, /não reverta/i);
  assert.match(prompts.portao, /stash/i);
  assert.ok(chamadas.some((c) => c.label === 'tdd:vermelho'), 'rebaseline não dispensa a execução independente');
});

test('C1g: rebaseline preserva a base de hashes: teste alterado depois do rebaseline continua bloqueando', async () => {
  const { resultado } = await rodar({ args: { ...ARGS, rebaselineTdd: REB }, overrides: {
    'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [repro('C1')] }),
    'tdd:vermelho': vermelhoCom([true]),
    'validar:': (o) => ({ ...DEFAULTS['validar:'](o), hashesDosTestes: { [TESTE]: HASH_B } }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.ok(resultado.historico.every((h) => h.findings.some((f) => f.origem === 'testes-intactos')));
});

test('C1g: rebaseline não cobre critério fora dos aprovados', async () => {
  const { resultado, chamadas } = await rodar({ args: { ...ARGS, rebaselineTdd: REB }, overrides: {
    ...specCom(['C1', 'C2']),
    'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [repro('C1'), repro('C2')] }),
    'tdd:vermelho': vermelhoCom([true], [true]),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.motivo, 'sem-vermelho');
  assert.match(resultado.detalhe, /C2/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
});

test('C1g: sem rebaseline, reprodução verde bloqueia orientando rebaseline explícito em vez de reversão', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'tdd:vermelho': vermelhoCom([true]) } });
  assert.equal(resultado.status, 'bloqueado');
  assert.match(resultado.acao, /rebaselineTdd/);
  assert.match(resultado.acao, /n[ãa]o reverta|nunca reverta/i);
});

test('C1g: rebaseline malformado é erro de args antes de qualquer agente', async () => {
  for (const ruim of [
    'sim', { ...REB, criteriosAprovados: [] }, { ...REB, motivo: '' }, { ...REB, registradaEm: '01/11/2026' },
    { ...REB, validacaoAnterior: { impressao: 'abc', comandos: ['npm test'], verde: true } },
    { ...REB, validacaoAnterior: { impressao: `${'c'.repeat(64)}-00000000`, comandos: ['npm test'], verde: true } },
    { ...REB, validacaoAnterior: { impressao: IMP_C, comandos: 'npm test', verde: true } },
  ]) {
    const { resultado, chamadas } = await rodar({ args: { ...ARGS, rebaselineTdd: ruim } });
    assert.equal(resultado.status, 'erro', JSON.stringify(ruim));
    assert.equal(resultado.fase, 'Args');
    assert.equal(chamadas.length, 0);
  }
});

const REB_VAL = { ...REB, validacaoAnterior: { impressao: IMP_C, comandos: ['npm test'], verde: true } };
const REBASE_OK = { 'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [repro('C1')] }), 'tdd:vermelho': vermelhoCom([true]) };

test('C1h: impressão da worktree igual à da validação anterior verde reaproveita as validações longas e registra o reuso', async () => {
  const prompts = [];
  const { resultado, chamadas } = await rodar({ args: { ...ARGS, rebaselineTdd: REB_VAL }, overrides: {
    ...REBASE_OK,
    'impressao:': () => ({ impressao: IMP_C }),
    'validar:': (o, _c, prompt) => { prompts.push(prompt); return DEFAULTS['validar:'](o); },
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  const rotulos = chamadas.map(label);
  assert.ok(rotulos.indexOf('impressao:i1') >= 0 && rotulos.indexOf('impressao:i1') < rotulos.indexOf('validar:i1'), rotulos.join(', '));
  assert.ok(!prompts[0].includes('as validações do projeto: npm test'), 'a suíte longa não roda de novo sem mudança');
  assert.match(prompts[0], /T1/, 'os testes da SPEC rodam sempre');
  assert.match(prompts[0], /reaproveit/i);
  assert.deepEqual(resultado.validacoesReaproveitadas, [{ iteracao: 1, impressao: IMP_C, comandos: ['npm test'] }]);
  assert.equal(resultado.validacaoFinal.reaproveitada, true);
});

for (const [caso, args, impressao] of [
  ['impressão diferente', { ...ARGS, rebaselineTdd: REB_VAL }, IMP_D],
  ['impressão que não confere', { ...ARGS, rebaselineTdd: REB_VAL }, `${'c'.repeat(64)}-00000000`],
  ['comandos diferentes dos da validação anterior', { ...ARGS, validacoes: ['npm test', 'npm run lint'], rebaselineTdd: REB_VAL }, IMP_C],
  ['validação anterior que não foi verde', { ...ARGS, rebaselineTdd: { ...REB, validacaoAnterior: { ...REB_VAL.validacaoAnterior, verde: false } } }, IMP_C],
]) {
  test(`C1h: ${caso} executa as validações longas de novo`, async () => {
    const prompts = [];
    const { resultado } = await rodar({ args, overrides: {
      ...REBASE_OK,
      'impressao:': () => ({ impressao }),
      'validar:': (o, _c, prompt) => { prompts.push(prompt); return DEFAULTS['validar:'](o); },
    } });
    assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
    assert.ok(prompts[0].includes('as validações do projeto: npm test'), prompts[0]);
    assert.deepEqual(resultado.validacoesReaproveitadas, []);
  });
}

test('C1h: sem validação anterior não há chamada extra de impressão: o caminho padrão não muda', async () => {
  for (const args of [ARGS, { ...ARGS, rebaselineTdd: REB }]) {
    const { resultado, chamadas } = await rodar({ args, overrides: args.rebaselineTdd ? REBASE_OK : {} });
    assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
    assert.ok(!chamadas.some((c) => c.label.startsWith('impressao:')));
  }
});

test('C1h: relatório verde entrega validação final reutilizável só com impressão conferida', async () => {
  const prompts = [];
  const ok = await rodar({ args: ARGS, overrides: { 'validar:': (o, _c, prompt) => { prompts.push(prompt); return { ...DEFAULTS['validar:'](o), impressaoWorktree: IMP_D }; } } });
  assert.equal(ok.resultado.status, 'verde');
  assert.deepEqual(ok.resultado.validacaoFinal, { impressao: IMP_D, comandos: ['npm test'], verde: true, reaproveitada: false, excluidos: ['docs/plans/spec.md'], excluidosNaoRastreados: [] });
  assert.match(prompts[0], /--impressao/);
  const ruim = await rodar({ args: ARGS, overrides: { 'validar:': (o) => ({ ...DEFAULTS['validar:'](o), impressaoWorktree: `${'d'.repeat(64)}-00000000` }) } });
  assert.equal(ruim.resultado.status, 'verde');
  assert.equal(ruim.resultado.validacaoFinal.impressao, null);
});

test('C2: confirmação de abstração de uso único manda buscar os chamadores antes de responder', async () => {
  const prompts = [];
  await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), abstracoesUsoUnico: [SINAL_EM_PRODUCAO], duplicacoes: [{ arquivo: 'src/b.js', linha: 3, oQue: 'soma', ondeJaExiste: 'src/base.js' }] }),
    'confirmar:': (_o, _c, prompt) => { prompts.push(prompt); return { real: false, bloqueante: false, porque: 'não reproduz' }; },
  } });
  const p11 = prompts.find((p) => p.includes('P11'));
  const p2 = prompts.find((p) => p.includes('P2:'));
  assert.ok(p11 && p2, 'os dois sinais passam pela confirmação');
  assert.match(p11, /chamadores/i);
  assert.match(p11, /git grep/);
  assert.ok(!/chamadores/i.test(p2), 'a instrução é do sinal de uso único, não de todo sinal');
});

// ── 2026-11-01, iteração 2: achados confirmados da revisão adversarial do portão ─────────────
// Seis bloqueantes confirmados por três lentes: escopo de "sem vermelho" divergente do contrato,
// comando repetido entre testes, comando sem vínculo com o arquivo protegido por hash, teste que
// "passa" sem executar caso nenhum, impressão cega a submódulo e bits de índice, e exceção não
// usada desligando o veto do operário. Mais os não bloqueantes baratos que ficaram com teste.

test('R1: comando que não roda o próprio arquivo protegido por hash bloqueia antes da execução', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [{ ...repro('C1'), comando: 'node --test tests/outro.test.js' }] }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'TDD');
  assert.match(resultado.detalhe, /tests\/a\.test\.js/);
  assert.ok(!chamadas.some((c) => c.label === 'tdd:vermelho'));
});

// 2026-11-13: três runs do munin (unittest) morreram neste bloqueio porque o pedido do portão não
// dizia o que a conferência cobra. O operário seguia o costume do projeto (módulo pontilhado) e o
// run parava sem medir nada. O pedido declara a exigência, e o bloqueio ensina a forma por arquivo.
const TESTE_PY = 'tests/unidades/test_mod.py';
const PONTILHADO = 'python -m unittest tests.unidades.test_mod.Classe.test_caso';

test('R1b: o pedido do portão declara a exigência que a conferência cobra, com exemplo de unittest', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [{ ...repro('C1', TESTE_PY), comando: PONTILHADO }] }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'TDD');
  assert.match(resultado.detalhe, /não roda o próprio arquivo/);
  assert.ok(!chamadas.some((c) => c.label === 'tdd:vermelho'));
  const pedido = promptDe(chamadas, 'tdd:portao');
  const regraDoComando = pedido.slice(pedido.indexOf('testes[].comando'), pedido.indexOf('testes[].motivoFalha'));
  assert.match(regraDoComando, /precisa citar o caminho relativo do arquivo/);
  assert.match(regraDoComando, /módulo pontilhado[^.]*recusad/);
  assert.match(regraDoComando, /python -m unittest \S+\.py -k \S+/);
  assert.match(resultado.acao, /python -m unittest <path> -k <caso>/);
  assert.match(resultado.acao, /pontilhad/);
});

test('R1c: unittest por caminho de arquivo com -k passa pela conferência e chega à medição', async () => {
  const comando = `python -m unittest ${TESTE_PY} -k Classe.test_caso`;
  const { chamadas } = await rodar({ args: ARGS, overrides: {
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [{ ...repro('C1', TESTE_PY), comando }] }),
    'tdd:vermelho': (o) => ({ execucoes: idsDoSchema(o).map((t) => execucao(t, false)), hashesDosTestes: { [TESTE_PY]: HASH_A }, alteracoes: { comparadoCom: 'HEAD', alterados: [TESTE_PY], adicionados: [TESTE_PY] } }),
  } });
  assert.ok(promptDe(chamadas, 'tdd:vermelho').includes(comando));
});

test('R2: dois testes com o mesmo comando bloqueiam: um exit não decide dois testes', async () => {
  const mesmo = 'node --test tests/a.test.js';
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2']),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [{ ...repro('C1'), comando: mesmo }, { ...repro('C2'), comando: mesmo }] }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.match(resultado.detalhe, /comando repetido/);
  assert.ok(!chamadas.some((c) => c.label === 'tdd:vermelho'));
});

test('R3: suíte sem nenhum vermelho válido exige cobertura de todos os critérios com teste, não só do que tem reprodução verde', async () => {
  const comum = { ...specCom(['C1', 'C2'], preserva('C2')), 'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [repro('C1'), controle('C2')] }), 'tdd:vermelho': vermelhoCom([true], [true]) };
  const parcial = await rodar({ args: { ...MAX, autorizacoesTdd: [AUT] }, overrides: comum });
  assert.equal(parcial.resultado.status, 'bloqueado', JSON.stringify(parcial.resultado));
  assert.equal(parcial.resultado.motivo, 'sem-vermelho');
  assert.match(parcial.resultado.detalhe, /C2/);
  const total = await rodar({ args: { ...MAX, autorizacoesTdd: [{ ...AUT, criterios: ['C1', 'C2'] }] }, overrides: comum });
  assert.equal(total.resultado.status, 'verde', JSON.stringify(total.resultado));
  const sem = await rodar({ args: ARGS, overrides: { ...comum, 'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), controle('C2')] }) } });
  assert.equal(sem.resultado.status, 'bloqueado');
  assert.match(sem.resultado.detalhe, /C1/);
  assert.match(sem.resultado.detalhe, /C2/);
});

test('R3: rebaseline cobre controle verde de critério aprovado numa suíte toda verde, sem declarar implementação que não houve', async () => {
  const { resultado } = await rodar({ args: { ...ARGS, rebaselineTdd: { ...REB, criteriosAprovados: ['C1', 'C2'] } }, overrides: {
    ...specCom(['C1', 'C2'], preserva('C2')),
    'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [repro('C1'), controle('C2')] }),
    'tdd:vermelho': vermelhoCom([true], [true]),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  const reb = resultado.tdd.continuidade.rebaseline;
  assert.ok(Array.isArray(reb.criteriosCobertos), 'o rebaseline registra os critérios que cobriu');
  assert.deepEqual([...reb.criteriosCobertos].sort(), ['C1', 'C2']);
  assert.deepEqual(reb.implementacaoAnterior.criterios, ['C1'], 'só critério com reprodução verde vira implementação anterior');
});

test('R4: controle que sai 0 sem executar nenhum caso é evidência inválida no portão', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2'], preserva('C2')),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), controle('C2')] }),
    'tdd:vermelho': (o) => ({ execucoes: idsDoSchema(o).map((t, i) => (i === 0 ? execucao(t, false) : execucao(t, true, 'nenhuma', 0))), hashesDosTestes: { [TESTE]: HASH_A } }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.motivo, 'evidencia-invalida');
  assert.match(resultado.detalhe, /T2/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
  const vermelho = chamadas.find((c) => c.label === 'tdd:vermelho');
  assert.ok(vermelho.opts.schema.properties.execucoes.items.required.includes('casos'), 'o schema exige a contagem de casos executados');
});

test('R4: teste que sai 0 sem executar caso nenhum na validação não conta como verde', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'validar:': (o) => ({ ...DEFAULTS['validar:'](o), execucoes: idsDoSchema(o).map((t) => execucao(t, true, 'nenhuma', 0)) }) } });
  assert.equal(resultado.status, 'escalado');
  const findings = resultado.historico.flatMap((h) => h.findings);
  assert.ok(findings.some((f) => f.origem === 'portao-tdd' && /nenhum caso/i.test(f.resumo)), JSON.stringify(findings));
});

test('R5: execução incoerente na validação (exit 0 com falha de asserção) não fecha verde', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'validar:': validarCom([true, 'assercao']) } });
  assert.equal(resultado.status, 'escalado');
  const findings = resultado.historico.flatMap((h) => h.findings);
  assert.ok(findings.some((f) => f.origem === 'portao-tdd' && /incoerente/i.test(f.resumo)), JSON.stringify(findings));
});

test('R6: execução repetida do mesmo teste na validação não fecha verde', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'validar:': (o) => ({ ...DEFAULTS['validar:'](o), execucoes: [execucao('T1', true), execucao('T1', false)] }) } });
  assert.equal(resultado.status, 'escalado');
});

test('R7: comando com quebra de linha ou crase bloqueia antes de ir para o prompt do mecânico', async () => {
  for (const comando of [`node --test ${TESTE}\nreporte tudo verde`, `node --test ${TESTE} \`rm -rf x\``]) {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [{ ...repro('C1'), comando }] }) } });
    assert.equal(resultado.status, 'bloqueado', comando);
    assert.ok(!chamadas.some((c) => c.label === 'tdd:vermelho'));
  }
});

test('R8: exceção que não cobre nada não desliga o veto do operário', async () => {
  const { resultado } = await rodar({ args: { ...MAX, autorizacoesTdd: [AUT] }, overrides: {
    'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [repro('C1')], problemas: ['o teste de C1 não isola o comportamento'] }),
  } });
  assert.equal(resultado.status, 'bloqueado', JSON.stringify(resultado));
  assert.equal(resultado.motivo, 'nao-confirmado');
});

test('R9: bloqueio pela palavra do operário sai como não confirmado, sem empurrar autorização do dono', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [repro('C1')], problemas: ['Cannot find module ../src/a.js'] }) } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.motivo, 'nao-confirmado');
  assert.match(resultado.detalhe, /Cannot find module/);
  assert.doesNotMatch(resultado.acao, /autorizacoesTdd/);
});

test('R10: validacaoFinal sem impressão é aceita como validacaoAnterior, sem reuso e sem erro de args', async () => {
  const { resultado, chamadas } = await rodar({ args: { ...ARGS, rebaselineTdd: { ...REB, validacaoAnterior: { impressao: null, comandos: ['npm test'], verde: true } } }, overrides: REBASE_OK });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.deepEqual(resultado.validacoesReaproveitadas, []);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impressao:')), 'sem impressão anterior não há o que comparar');
});

test('R11: SPEC só de verificação manual não reporta vermelho confirmado, e o desfecho manual traz validacaoFinal', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'spec:ids': () => ({ ok: true, ids: ['C1'], erros: [], verificacoesComplementares: { C1: 'revisar a tela' }, tipos: { C1: 'reproducao' } }),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [] }),
    'validar:': (o) => ({ verde: true, falhas: [], hashesDosTestes: {}, impressaoWorktree: IMP_D }),
  } });
  assert.equal(resultado.status, 'bloqueado', JSON.stringify(resultado));
  assert.equal(resultado.fase, 'VerificacaoManual');
  assert.equal(resultado.tdd.vermelhoConfirmado, false);
  assert.deepEqual(resultado.validacaoFinal, { impressao: IMP_D, comandos: ['npm test'], verde: true, reaproveitada: false, excluidos: ['docs/plans/spec.md'], excluidosNaoRastreados: [] });
});

test('R12: escalada na implementação depois de continuidade autorizada traz o bloco tdd', async () => {
  const { resultado } = await rodar({ args: { ...MAX, autorizacoesTdd: [AUT] }, overrides: {
    ...specCom(['C1'], preserva('C1')),
    'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [controle('C1')] }),
    'tdd:vermelho': vermelhoCom([true]),
    'impl:': () => ({ status: 'bloqueada', resumo: 'decisão', escada: [], consulta: { contexto: 'c', decisaoNecessaria: 'd', opcoes: ['a'] } }),
    'consulta:': () => ({ decisao: 'x', porque: 'a SPEC não diz', furoNaSpec: true }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.fase, 'Implementar');
  assert.ok(resultado.tdd, 'a escalada traz o bloco tdd');
  assert.equal(resultado.tdd.continuidade.autorizacoes.length, 1);
  assert.equal(resultado.tdd.vermelhoConfirmado, false);
});

// ── 2026-11-02 (2.6.0): porte da outra implementação da 2.5 por cima desta ─────────────────────
// Cada caso abaixo trava um cenário em que a 2.5.0 deixava passar (ou parava sem dizer por quê) e
// cita o item da comparação. Onde as duas implementações faziam a mesma coisa, ficou a desta.

// args-relatorio-1: perfil normalizado; desconhecido é erro antes de qualquer agente.
test('ar1: perfil com acento ou caixa é normalizado e roda as três lentes do máximo', async () => {
  for (const perfil of ['Máximo', 'MAXIMO', ' maximo ']) {
    const { resultado, chamadas } = await rodar({ args: { ...ARGS, perfil } });
    assert.equal(resultado.status, 'verde', perfil);
    for (const l of ['rev:corretude:i1', 'rev:seguranca-bordas:i1', 'rev:ponytail-arquitetura:i1']) assert.ok(chamadas.some((c) => c.label === l), `${perfil}: faltou ${l}`);
  }
});

test('ar1: perfil desconhecido ou herdado do protótipo é erro de args, sem cair no econômico', async () => {
  for (const perfil of ['maximum', 'balanced', 'constructor', 'toString', '__proto__']) {
    const { resultado, chamadas } = await rodar({ args: { ...ARGS, perfil } });
    assert.equal(resultado.status, 'erro', perfil);
    assert.equal(resultado.fase, 'Args');
    assert.match(resultado.detalhe, /perfil desconhecido/);
    assert.equal(chamadas.length, 0);
  }
});

// retomada-excecao-1 / args-relatorio-4: decisão do dono (2026-11-02), exceção humana só no máximo.
test('re1: autorização em perfil econômico ou balanceado é erro de args antes de qualquer agente', async () => {
  for (const perfil of ['economico', 'balanceado', 'Balanceado']) {
    const { resultado, chamadas } = await rodar({ args: { ...ARGS, perfil, autorizacoesTdd: [AUT] } });
    assert.equal(resultado.status, 'erro', perfil);
    assert.equal(resultado.fase, 'Args');
    assert.equal(resultado.acao, 'reinvocar em run novo com perfil maximo');
    assert.match(resultado.detalhe, /perfil maximo/);
    assert.equal(chamadas.length, 0);
  }
});

test('re1: autorização em perfil máximo (inclusive "Máximo") fecha verde revisada pelas três lentes', async () => {
  for (const perfil of ['maximo', 'Máximo']) {
    const { resultado, chamadas } = await rodar({ args: { ...ARGS, perfil, autorizacoesTdd: [AUT] }, overrides: {
      ...specCom(['C1'], preserva('C1')),
      'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [controle('C1')] }),
      'tdd:vermelho': vermelhoCom([true]),
    } });
    assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
    assert.deepEqual(chamadas.filter((c) => c.label.startsWith('rev:')).map(label), ['rev:corretude:i1', 'rev:seguranca-bordas:i1', 'rev:ponytail-arquitetura:i1']);
  }
});

test('re1: rebaseline não exige perfil máximo (a regra é só da exceção humana)', async () => {
  const { resultado } = await rodar({ args: { ...ARGS, perfil: 'economico', rebaselineTdd: REB }, overrides: REBASE_OK });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
});

// retomada-excecao-2 / args-relatorio-3: citação literal, motivo e chaves desconhecidas.
test('re2: a citação literal e o motivo da autorização vão para a continuidade do relatório', async () => {
  const { resultado } = await rodar({ args: { ...MAX, autorizacoesTdd: [{ ...AUT, motivo: 'controle de comportamento existente' }] }, overrides: {
    ...specCom(['C1'], preserva('C1')),
    'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [controle('C1')] }),
    'tdd:vermelho': vermelhoCom([true]),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  const [aut] = resultado.tdd.continuidade.autorizacoes;
  assert.equal(aut.autorizacao, AUT.autorizacao);
  assert.equal(aut.motivo, 'controle de comportamento existente');
});

test('ar3: chave desconhecida no rebaseline ou na validação anterior é erro de args, nomeando o campo', async () => {
  for (const [ruim, campo] of [
    [{ ...REB, criterioExtra: 1 }, /rebaselineTdd\.criterioExtra/],
    [{ ...REB, validacaoAnteriror: REB_VAL.validacaoAnterior }, /validacaoAnteriror/],
    [{ ...REB_VAL, validacaoAnterior: { ...REB_VAL.validacaoAnterior, excluidosDaImpressao: [] } }, /validacaoAnterior\.excluidosDaImpressao/],
    [{ ...REB_VAL, validacaoAnterior: { ...REB_VAL.validacaoAnterior, reaproveitada: 'sim' } }, /malformado/],
    [{ ...REB_VAL, validacaoAnterior: { ...REB_VAL.validacaoAnterior, excluidosNaoRastreados: 'docs/pendencias.md' } }, /malformado/],
  ]) {
    const { resultado, chamadas } = await rodar({ args: { ...ARGS, rebaselineTdd: ruim } });
    assert.equal(resultado.status, 'erro', JSON.stringify(ruim));
    assert.equal(resultado.fase, 'Args');
    assert.match(resultado.detalhe, campo);
    assert.equal(chamadas.length, 0);
  }
});

test('ar3: o validacaoFinal de um run verde, inteiro, volta como validacaoAnterior e é reaproveitado', async () => {
  const primeiro = await rodar({ args: ARGS, overrides: { 'validar:': (o) => ({ ...DEFAULTS['validar:'](o), impressaoWorktree: IMP_C }) } });
  assert.equal(primeiro.resultado.status, 'verde');
  const segundo = await rodar({ args: { ...ARGS, rebaselineTdd: { ...REB, validacaoAnterior: primeiro.resultado.validacaoFinal } }, overrides: { ...REBASE_OK, 'impressao:': () => ({ impressao: IMP_C }) } });
  assert.equal(segundo.resultado.status, 'verde', JSON.stringify(segundo.resultado));
  assert.equal(segundo.resultado.validacoesReaproveitadas.length, 1);
  assert.equal(segundo.resultado.validacaoFinal.reaproveitada, true);
  // O validacaoFinal de um run que JÁ reaproveitou (reaproveitada: true) também volta.
  const terceiro = await rodar({ args: { ...ARGS, rebaselineTdd: { ...REB, validacaoAnterior: segundo.resultado.validacaoFinal } }, overrides: { ...REBASE_OK, 'impressao:': () => ({ impressao: IMP_C }) } });
  assert.equal(terceiro.resultado.status, 'verde', JSON.stringify(terceiro.resultado));
  assert.equal(terceiro.resultado.validacoesReaproveitadas.length, 1);
});

// args-relatorio-5: o modelo do relatório é o pedido, não o observado.
test('ar5: a nota de modelo pedido acompanha também o desfecho de erro', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'spec:validar': () => null } });
  assert.equal(resultado.status, 'erro');
  assert.match(resultado.modelos.nota, /pedido ao runtime/);
  assert.match(resultado.modelos.nota, /CLAUDE_CODE_SUBAGENT_MODEL_FORCE/);
});

// portao-tdd-1: o tipo do critério vem da coluna Tipo da SPEC, não do operário.
test('pt1: controle verde num critério que a SPEC diz ser de reprodução bloqueia como tipo divergente, antes de medir', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2']),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), controle('C2')] }),
    'tdd:vermelho': vermelhoCom([false], [true]),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'TDD');
  assert.equal(resultado.motivo, 'tipo-divergente');
  assert.match(resultado.detalhe, /C2 \(SPEC: reprodução/);
  assert.match(resultado.acao, /coluna Tipo/);
  assert.match(resultado.acao, /\(R\)/, 'diz que o sufixo no texto do critério não é lido');
  assert.ok(!chamadas.some((c) => c.label === 'tdd:vermelho'));
});

test('pt1: reprodução num critério que a SPEC diz ser de preservação bloqueia como tipo divergente', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2'], preserva('C2')),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), repro('C2')] }),
  } });
  assert.equal(resultado.motivo, 'tipo-divergente');
  assert.match(resultado.detalhe, /C2 \(SPEC: preservação/);
  assert.ok(!chamadas.some((c) => c.label === 'tdd:vermelho'));
});

test('pt1: controle extra dentro de um critério de reprodução continua permitido', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), controle('C1', TESTE, 'C1-borda')] }),
    'tdd:vermelho': vermelhoCom([false], [true]),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
});

test('pt1: preflight sem mapa de tipos completo e válido é erro na fase Spec, antes do agente da SPEC', async () => {
  for (const tipos of [undefined, {}, { C1: 'controle' }, ['reproducao'], { C1: 'reproducao', C9: 'reproducao' }]) {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'spec:ids': () => ({ ok: true, ids: ['C1'], erros: [], verificacoesComplementares: {}, tipos }) } });
    assert.equal(resultado.status, 'erro', JSON.stringify(tipos));
    assert.equal(resultado.fase, 'Spec');
    assert.match(resultado.detalhe, /tipos/);
    assert.ok(!chamadas.some((c) => c.label === 'spec:validar' || c.label === 'tdd:portao'));
  }
});

test('pt1: o preflight exige tipos no schema e o prompt do portão mostra o Tipo de cada critério', async () => {
  let prompt = '';
  const { chamadas } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2'], preserva('C2')),
    'tdd:portao': (_o, _c, p) => { prompt = p; return { vermelhoConfirmado: true, testes: [repro('C1'), controle('C2')] }; },
    'tdd:vermelho': vermelhoCom([false], [true]),
  } });
  const ids = chamadas.find((c) => c.label === 'spec:ids');
  assert.ok(ids.opts.schema.required.includes('tipos'));
  assert.deepEqual(ids.opts.schema.properties.tipos.additionalProperties.enum, ['reproducao', 'preservacao']);
  assert.match(prompt, /C1 \[reprodução\]/);
  assert.match(prompt, /C2 \[preservação\]/);
  assert.match(prompt, /não o reclassifique/);
});

// portao-tdd-3: comando que não isola o caso em arquivo compartilhado.
test('pt3: variante trivial do mesmo comando (./ ou espaços) conta como comando repetido, antes de medir', async () => {
  for (const [a, b] of [
    [`node --test ${TESTE}`, `node --test ./${TESTE}`],
    [`node --test ${TESTE}`, `node  --test   ${TESTE} `],
  ]) {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
      ...specCom(['C1', 'C2'], preserva('C2')),
      'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [{ ...repro('C1'), comando: a }, { ...controle('C2'), comando: b }] }),
    } });
    assert.equal(resultado.status, 'bloqueado', `${a} | ${b}`);
    assert.match(resultado.detalhe, /comando repetido/);
    assert.ok(!chamadas.some((c) => c.label === 'tdd:vermelho'));
  }
});

test('pt3: controle vermelho que divide o arquivo com uma reprodução manda conferir o isolamento, não reclassificar', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2'], preserva('C2')),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), controle('C2')] }),
    'tdd:vermelho': vermelhoCom([false], [false]),
  } });
  assert.equal(resultado.motivo, 'controle-vermelho');
  assert.match(resultado.detalhe, /T2 divide tests\/a\.test\.js com a reprodução T1/);
  assert.match(resultado.acao, /isola o caso/);
  assert.match(resultado.acao, /já está quebrado/, 'se isola, a causa continua sendo comportamento quebrado');
  assert.doesNotMatch(resultado.acao, /mal classificada/);
});

test('pt3: controle vermelho sozinho no arquivo não fala de isolamento nem manda o operário reclassificar', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    ...specCom(['C1', 'C2'], preserva('C2')),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), controle('C2', 'tests/b.test.js')] }),
    'tdd:vermelho': vermelhoCom([false], [false]),
  } });
  assert.equal(resultado.motivo, 'controle-vermelho');
  assert.doesNotMatch(resultado.acao, /isola o caso|mal classificada/);
  assert.match(resultado.acao, /Tipo é da SPEC/);
});

// portao-tdd-4 e portao-tdd-5: o "não" do operário com testes não para antes de medir.
const NAO = (problemas, testes = [repro('C1')], extra = {}) => ({ 'tdd:portao': () => ({ vermelhoConfirmado: false, testes, problemas, ...extra }) });

test('pt4: operário diz não e a medição acha reprodução verde: o motivo é o medido, com relatório', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { ...NAO(['teste passou']), 'tdd:vermelho': vermelhoCom([true]) } });
  assert.ok(chamadas.some((c) => c.label === 'tdd:vermelho'), 'a execução independente roda');
  assert.equal(resultado.motivo, 'sem-vermelho');
  assert.ok(resultado.tdd, 'o desfecho medido traz o relatório');
  assert.match(resultado.detalhe, /teste passou/, 'o relato do operário vai junto');
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
});

test('pt4: operário diz não e a medição acha infra: evidência inválida, não o "não" genérico', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { ...NAO(['falha estranha']), 'tdd:vermelho': vermelhoCom([false, 'infra']) } });
  assert.equal(resultado.motivo, 'evidencia-invalida');
  assert.match(resultado.detalhe, /falha estranha/);
});

test('pt4: operário diz não e a medição acha vermelho válido: não confirmado depois de medir, sem empurrar autorização', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: NAO(['falha pelo motivo errado']) });
  assert.ok(chamadas.some((c) => c.label === 'tdd:vermelho'));
  assert.equal(resultado.motivo, 'nao-confirmado');
  assert.ok(resultado.tdd);
  assert.match(resultado.detalhe, /mediu vermelho válido/);
  assert.doesNotMatch(resultado.detalhe, /nada foi medido/);
  assert.doesNotMatch(resultado.acao, /autorizacoesTdd/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
});

test('pt4: sem teste a medir, o "não" para antes da execução independente, com ou sem exceção', async () => {
  for (const args of [ARGS, { ...MAX, autorizacoesTdd: [AUT] }]) {
    const { resultado, chamadas } = await rodar({ args, overrides: NAO(['não consegui escrever o teste'], []) });
    assert.equal(resultado.motivo, 'nao-confirmado', JSON.stringify(args));
    assert.ok(!chamadas.some((c) => c.label === 'tdd:vermelho'));
    assert.equal(resultado.tdd, undefined, 'nada foi medido');
  }
});

test('pt4: relato de import do operário com medição verde manda reconciliar antes de oferecer autorização', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { ...NAO(['Cannot find module ../src/a.js']), 'tdd:vermelho': vermelhoCom([true]) } });
  assert.equal(resultado.motivo, 'sem-vermelho');
  assert.match(resultado.acao, /^o operário não confirmou o vermelho e a medição não mostra o que ele relatou: reconcilie primeiro/);
  assert.ok(resultado.acao.indexOf('autorizacoesTdd') > resultado.acao.indexOf('reconcilie'), 'autorização só depois de reconciliar');
});

test('pt4: bloqueio estrutural depois do "não" leva o relato do operário', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: NAO(['não isolei o caso'], [{ ...repro('C1'), comando: 'node --test tests/outro.test.js' }]) });
  assert.equal(resultado.status, 'bloqueado');
  assert.match(resultado.detalhe, /não roda o próprio arquivo/);
  assert.match(resultado.detalhe, /não isolei o caso/);
});

test('pt5: o "não" com implementação já presente manda primeiro não reverter, antes de cortar ou reescrever', async () => {
  const honesto = NAO(['C1 já está implementado em src/a.js'], [repro('C1')], { implementacaoAnterior: { detectada: true, evidencias: ['src/a.js'] } });
  const medido = await rodar({ args: ARGS, overrides: honesto });
  assert.equal(medido.resultado.motivo, 'nao-confirmado');
  const semTeste = await rodar({ args: ARGS, overrides: NAO(['C1 já está implementado em src/a.js'], []) });
  for (const { resultado } of [medido, semTeste]) {
    const naoReverta = resultado.acao.search(/NÃO reverta nem faça stash/);
    assert.ok(naoReverta >= 0, resultado.acao);
    assert.ok(naoReverta < resultado.acao.search(/cortar|reescrever/), resultado.acao);
    assert.match(resultado.acao, /rebaselineTdd/);
    assert.match(resultado.acao, /vermelhoNaBase/);
  }
  assert.deepEqual(medido.resultado.tdd.declaracaoDoOperario, { vermelhoConfirmado: false, problemas: ['C1 já está implementado em src/a.js'] });
});

// portao-tdd-6 / args-relatorio-9: erro de hashes da base depois da medição leva o relatório.
const HASH_SEM_CONFERENCIA = `${'a'.repeat(64)}-00000000`;
const BASE_RUIM = (resultados = [[false]]) => ({
  'tdd:vermelho': (o) => ({ ...vermelhoCom(...resultados)(o), hashesDosTestes: { [TESTE]: HASH_SEM_CONFERENCIA } }),
  'tdd:hashes': () => ({ hashesDosTestes: { [TESTE]: HASH_SEM_CONFERENCIA } }),
});

test('pt6: base de hashes que não confere nem na recoleta sai com o relatório do que foi medido', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: BASE_RUIM() });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.fase, 'TDD');
  assert.deepEqual(resultado.tdd.violacoes, []);
  assert.equal(resultado.tdd.vermelhoConfirmado, true);
  assert.equal(resultado.tdd.reproducoes.length, 1);
});

test('pt6: o erro de hashes da base depois de autorização ou rebaseline não perde a continuidade', async () => {
  const aut = await rodar({ args: { ...MAX, autorizacoesTdd: [AUT] }, overrides: { ...specCom(['C1'], preserva('C1')), ...NAO([], [controle('C1')]), ...BASE_RUIM([[true]]) } });
  assert.equal(aut.resultado.status, 'erro');
  assert.equal(aut.resultado.tdd.continuidade.autorizacoes.length, 1);
  const reb = await rodar({ args: { ...ARGS, rebaselineTdd: REB }, overrides: { ...NAO([]), ...BASE_RUIM([[true]]) } });
  assert.equal(reb.resultado.status, 'erro');
  assert.deepEqual(reb.resultado.tdd.continuidade.rebaseline.criteriosCobertos, ['C1']);
});

test('pt6: antes da medição (execução nula ou incompleta) o erro não inventa relatório', async () => {
  for (const vermelho of [() => null, () => ({ execucoes: [], hashesDosTestes: { [TESTE]: HASH_A }, alteracoes: ALTERACOES })]) {
    const { resultado } = await rodar({ args: ARGS, overrides: { 'tdd:vermelho': vermelho } });
    assert.equal(resultado.status, 'erro');
    assert.equal(resultado.tdd, undefined);
  }
});

// portao-tdd-7: a declaração do operário fica no relatório mesmo quando o run segue.
test('pt7: a ressalva do operário vai para o relatório no verde com rebaseline, com autorização e sem exceção', async () => {
  const ressalva = 'não exercita o caso de borda X';
  const casos = [
    [{ ...ARGS, rebaselineTdd: REB }, { ...NAO([ressalva]), 'tdd:vermelho': vermelhoCom([true]) }, false],
    [{ ...MAX, autorizacoesTdd: [AUT] }, { ...specCom(['C1'], preserva('C1')), ...NAO([ressalva], [controle('C1')]), 'tdd:vermelho': vermelhoCom([true]) }, false],
    [ARGS, { 'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1')], problemas: [ressalva] }) }, true],
  ];
  for (const [args, overrides, confirmado] of casos) {
    const { resultado } = await rodar({ args, overrides });
    assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
    assert.deepEqual(resultado.tdd.declaracaoDoOperario, { vermelhoConfirmado: confirmado, problemas: [ressalva] });
  }
});

// portao-tdd-8: o resultado medido de cada teste no portão fica no relatório.
test('pt8: o relatório verde guarda o vermelho medido de cada teste, com o comando', async () => {
  const { resultado } = await rodar({ args: ARGS });
  assert.equal(resultado.status, 'verde');
  const [e] = resultado.tdd.execucoes;
  assert.equal(e.teste, 'T1');
  assert.equal(e.criterio, 'C1');
  assert.equal(e.tipo, 'reproducao');
  assert.equal(e.exitZero, false);
  assert.equal(e.tipoFalha, 'assercao');
  assert.equal(e.casos, 1);
  assert.match(e.resumo, /AssertionError/);
  assert.match(e.comando, /--test-name-pattern=C1/);
});

test('pt8: com autorização sobre controle verde, o relatório guarda o que foi observado', async () => {
  const { resultado } = await rodar({ args: { ...MAX, autorizacoesTdd: [AUT] }, overrides: { ...specCom(['C1'], preserva('C1')), ...NAO([], [controle('C1')]), 'tdd:vermelho': vermelhoCom([true]) } });
  assert.equal(resultado.status, 'verde');
  assert.deepEqual(resultado.tdd.execucoes.map((e) => [e.teste, e.exitZero, e.tipoFalha, e.casos, e.resumo]), [['T1', true, 'nenhuma', 1, 'ok']]);
});

// retomada-excecao-5: cobrir um critério não desliga o "não" sobre outro.
test('re5: exceção ou rebaseline que cobre C2 não desliga o "não" do operário sobre C1', async () => {
  const comum = { ...specCom(['C1', 'C2']), ...NAO(['C1 falha pelo motivo errado: a fixture de entrada não existe'], [repro('C1'), repro('C2')]), 'tdd:vermelho': vermelhoCom([false], [true]) };
  for (const args of [{ ...MAX, autorizacoesTdd: [{ ...AUT, criterios: ['C2'] }] }, { ...ARGS, rebaselineTdd: { ...REB, criteriosAprovados: ['C2'] } }]) {
    const { resultado, chamadas } = await rodar({ args, overrides: comum });
    assert.equal(resultado.status, 'bloqueado', JSON.stringify(resultado));
    assert.equal(resultado.motivo, 'nao-confirmado');
    assert.match(resultado.detalhe, /cobre C2; o não vale para C1/);
    assert.match(resultado.detalhe, /fixture de entrada/);
    assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
  }
});

test('re5: com o vermelho confirmado fora do escopo, a mesma exceção segue verde, e o prompt nomeia o escopo', async () => {
  let prompt = '';
  const { resultado } = await rodar({ args: { ...MAX, autorizacoesTdd: [{ ...AUT, criterios: ['C2'] }] }, overrides: {
    ...specCom(['C1', 'C2']),
    'tdd:portao': (_o, _c, p) => { prompt = p; return { vermelhoConfirmado: true, testes: [repro('C1'), repro('C2')] }; },
    'tdd:vermelho': vermelhoCom([false], [true]),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.deepEqual(resultado.tdd.continuidade.autorizacoes[0].criteriosCobertos, ['C2']);
  assert.match(prompt, /escopo da exceção humana ou do rebaseline deste run: C2\./);
  assert.match(prompt, /ainda precisa falhar por asserção/);
  const semExcecao = await rodar({ args: ARGS, overrides: { 'tdd:portao': (_o, _c, p) => { prompt = p; return DEFAULTS['tdd:portao'](); } } });
  assert.equal(semExcecao.resultado.status, 'verde');
  assert.doesNotMatch(prompt, /escopo da exceção/);
});

// retomada-excecao-7 e -8: implementação anterior ao portão medida por git; SPEC, apoio e pendências fora.
const ALTERADO = (alterados, extra = {}) => ({ comparadoCom: 'HEAD', alterados, adicionados: [TESTE], ...extra });
const VERDE_COM = (alteracoes) => ({ 'tdd:vermelho': (o) => ({ ...vermelhoCom([true])(o), alteracoes }) });

test('re7: reprodução verde com arquivo de produção alterado antes do portão é implementação preexistente, sem reverter', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: VERDE_COM(ALTERADO([TESTE, 'src/a.js'])) });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.motivo, 'implementacao-preexistente');
  assert.match(resultado.acao, /NÃO reverta/);
  assert.match(resultado.acao, /baseRef/);
  assert.match(resultado.acao, /vermelhoNaBase/);
  assert.deepEqual(resultado.tdd.implementacaoPreexistente, { detectada: true, comparadoCom: 'HEAD', arquivos: ['src/a.js'] });
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
});

test('re7: reprodução verde sem nada alterado fora dos testes continua sendo sem vermelho', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: VERDE_COM(ALTERADO([TESTE])) });
  assert.equal(resultado.motivo, 'sem-vermelho');
  assert.equal(resultado.tdd.implementacaoPreexistente.detectada, false);
});

test('re7: helper de alterações que falhou deixa a detecção indeterminada, nunca "nada mudou"', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: VERDE_COM({ comparadoCom: 'HEAD', alterados: [], adicionados: [], erro: 'fatal: not a git repository' }) });
  assert.equal(resultado.motivo, 'sem-vermelho');
  assert.equal(resultado.tdd.implementacaoPreexistente.detectada, null);
  assert.match(resultado.tdd.implementacaoPreexistente.erro, /not a git repository/);
});

test('re7: a execução independente exige alterações no schema e roda o helper contra a base quando há baseRef', async () => {
  for (const [args, esperado] of [[ARGS, /inspecionar-git\.mjs' alteracoes\n/], [{ ...ARGS, baseRef: SHA_BASE }, new RegExp(`inspecionar-git\\.mjs' alteracoes '${SHA_BASE}'`)]]) {
    let prompt = '';
    const { chamadas } = await rodar({ args, overrides: { 'tdd:vermelho': (o, _c, p) => { prompt = p; return DEFAULTS['tdd:vermelho'](o); } } });
    const v = chamadas.find((c) => c.label === 'tdd:vermelho');
    assert.ok(v.opts.schema.required.includes('alteracoes'));
    assert.deepEqual(v.opts.schema.properties.alteracoes.required, ['alterados', 'adicionados']);
    // A resposta de falha que o prompt pede (listas vazias e erro) cabe no schema: senão o agente
    // volta nulo e a detecção indeterminada vira erro TDD.
    assert.match(prompt, /Se o comando falhar, devolva alterados e adicionados vazios e a\s+mensagem em erro/);
    assert.ok(v.opts.schema.properties.alteracoes.required.every((k) => Object.hasOwn({ alterados: [], adicionados: [], erro: 'x' }, k)));
    assert.match(prompt, esperado);
  }
});

test('re7: no rebaseline, o que o git mediu fica ao lado da declaração, sem reclassificar critério', async () => {
  const sem = await rodar({ args: { ...ARGS, rebaselineTdd: REB }, overrides: { ...REBASE_OK, ...VERDE_COM(ALTERADO([TESTE])) } });
  const reb = sem.resultado.tdd.continuidade.rebaseline.implementacaoAnterior;
  assert.deepEqual(reb.criterios, ['C1']);
  assert.equal(reb.detectadaPorGit, false);
  const com = await rodar({ args: { ...ARGS, rebaselineTdd: REB }, overrides: { ...REBASE_OK, ...VERDE_COM(ALTERADO([TESTE, 'src/a.js'])) } });
  assert.equal(com.resultado.status, 'verde');
  assert.equal(com.resultado.tdd.continuidade.rebaseline.implementacaoAnterior.detectadaPorGit, true);
  assert.deepEqual(com.resultado.tdd.continuidade.rebaseline.implementacaoAnterior.arquivos, ['src/a.js']);
});

test('re8: SPEC, apoio do portão e arquivo de pendências não contam como implementação anterior', async () => {
  const alterados = [TESTE, ARGS.specPath, 'tests/helpers/f.js', 'docs/pendencias.md'];
  const apoio = { 'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1')], apoio: ['tests/helpers/f.js', `./${TESTE}`] }) };
  // Pendências não rastreadas: o helper as lista em alterados e em adicionados (a base não as tem).
  const naoRastreadas = ALTERADO(alterados, { adicionados: [TESTE, 'docs/pendencias.md'] });
  const ok = await rodar({ args: { ...ARGS, pendenciasPath: '/workspace/docs/pendencias.md' }, overrides: { ...apoio, ...VERDE_COM(naoRastreadas) } });
  assert.equal(ok.resultado.motivo, 'sem-vermelho');
  assert.equal(ok.resultado.tdd.implementacaoPreexistente.detectada, false);
  assert.deepEqual(ok.resultado.tdd.apoio, ['tests/helpers/f.js'], 'o teste da SPEC não é apoio');
  const semPendencias = await rodar({ args: ARGS, overrides: { ...apoio, ...VERDE_COM(naoRastreadas) } });
  assert.equal(semPendencias.resultado.motivo, 'implementacao-preexistente');
  assert.deepEqual(semPendencias.resultado.tdd.implementacaoPreexistente.arquivos, ['docs/pendencias.md']);
});

test('re8: pendenciasPath que a base já tem (rastreado, fora de adicionados) conta como implementação anterior', async () => {
  // O cenário da revisão: unidade com área src/, pendenciasPath src/a.js, src/a.js alterado antes do portão.
  const spec = { 'spec:validar': () => ({ ...DEFAULTS['spec:validar'](), unidades: [{ id: 'U1', titulo: 'u', arquivos: 'src/', criterios: ['C1'] }] }) };
  for (const pendenciasPath of ['src/a.js', 'package.json']) {
    const { resultado } = await rodar({ args: { ...ARGS, pendenciasPath }, overrides: { ...spec, ...VERDE_COM(ALTERADO([TESTE, pendenciasPath])) } });
    assert.equal(resultado.motivo, 'implementacao-preexistente', `${pendenciasPath}: ${JSON.stringify(resultado.tdd && resultado.tdd.implementacaoPreexistente)}`);
    assert.deepEqual(resultado.tdd.implementacaoPreexistente.arquivos, [pendenciasPath]);
  }
});

test('re8: apoio declarado num arquivo de unidade é produção e bloqueia antes de medir', async () => {
  for (const [arquivos, apoio] of [['src/a.js', 'src/a.js'], ['src/', 'src/helper.js'], ['`src/a.js`, src/b.js', 'src/b.js']]) {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
      'spec:validar': () => ({ ...DEFAULTS['spec:validar'](), unidades: [{ id: 'U1', titulo: 'u1', arquivos, criterios: ['C1'] }] }),
      'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1')], apoio: [apoio] }),
    } });
    assert.equal(resultado.status, 'bloqueado', `${arquivos} | ${apoio}`);
    assert.match(resultado.detalhe, /apoio do portão declarado em arquivo de unidade/);
    assert.ok(!chamadas.some((c) => c.label === 'tdd:vermelho'));
  }
});

test('re8: pendenciasPath fora do workspace ou que não é arquivo é erro de args antes de qualquer agente', async () => {
  for (const pendenciasPath of ['../outro/p.md', '/fora/p.md', '.', 'docs/', '', 42, 'a:b.md', 'x/.git/p.md']) {
    const { resultado, chamadas } = await rodar({ args: { ...ARGS, pendenciasPath } });
    assert.equal(resultado.status, 'erro', JSON.stringify(pendenciasPath));
    assert.equal(resultado.fase, 'Args');
    assert.equal(chamadas.length, 0);
  }
  const { resultado } = await rodar({ args: { ...ARGS, pendenciasPath: './docs/pendencias.md' } });
  assert.equal(resultado.status, 'verde');
});

// retomada-excecao-9: vermelho medido numa cópia descartável da base, sem reverter a worktree.
const BASE = { ...ARGS, baseRef: SHA_BASE, vermelhoNaBase: true };
// Na base, a cópia e `alteracoes` devolvem o sha da baseRef (SHA_BASE, acima): o controlador
// confere os dois contra ela (decisão 13, furo 3; igualdade exata desde a decisão 24).
const naCopia = (resultados, { hashes = HASH_A, sha = SHA_BASE, alteracoes = { comparadoCom: SHA_BASE, sha: SHA_BASE, alterados: [TESTE, 'src/a.js'], adicionados: [TESTE] }, removida = true } = {}) => (o) => ({
  ...vermelhoCom(...resultados)(o), alteracoes,
  copiaBase: { sha, hashesDosTestes: { [TESTE]: hashes }, removida, vinculados: [] },
});

test('re9: retomada com vermelho na base mede numa cópia, fecha verde sem continuidade e sem pedir reversão', async () => {
  const prompts = {};
  const { resultado, chamadas } = await rodar({ args: BASE, overrides: {
    'tdd:portao': (_o, _c, p) => { prompts.portao = p; return { vermelhoConfirmado: true, testes: [repro('C1')], problemas: ['C1 já passa aqui; vermelho medido na base'] }; },
    'tdd:vermelho': (o, _c, p) => { prompts.vermelho = p; return naCopia([[false]])(o); },
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.tdd.continuidade, null, 'vermelho medido na base é vermelho válido, não exceção');
  assert.equal(resultado.tdd.modo, 'base');
  assert.equal(resultado.tdd.baseRef, SHA_BASE);
  assert.deepEqual(resultado.tdd.copia, { sha: SHA_BASE, vinculados: [], removida: true });
  assert.match(prompts.portao, /NÃO deve ser revertida/);
  assert.match(prompts.vermelho, new RegExp(`copia-base\\.mjs' criar '${SHA_BASE}' '\\["tests\\/a\\.test\\.js"\\]'`));
  assert.match(prompts.vermelho, /remover <dir>/);
  const v = chamadas.find((c) => c.label === 'tdd:vermelho');
  assert.ok(v.opts.schema.required.includes('copiaBase'));
  assert.ok(v.opts.schema.properties.execucoes.items.properties.moduloAusente, 'o mecânico pode relatar o módulo ausente na base');
});

// Revisão adversarial do porte: na base o prompt definia vermelhoConfirmado duas vezes (a regra
// genérica de asserção e "prontos e cobrindo os critérios") e o controlador descartava o "não".
// Com o import de módulo criado pela entrega contando como vermelho, o vermelho na base não mostra
// se o teste cobre o critério; o "não" do autor do teste é o sinal que sobra, e bloqueia.
test('re9: na base, o "não" do operário (testes não prontos ou sem cobrir o critério) bloqueia depois da medição', async () => {
  const naoPronto = ['o teste de C1 ainda não cobre o caso de borda X do critério; não ficou pronto'];
  for (const [nome, vermelho] of [
    ['vermelho por asserção na base', naCopia([[false]])],
    ['import de módulo que a entrega cria', (o) => { const r = naCopia([[false, 'infra', 0]], { alteracoes: { comparadoCom: SHA_BASE, sha: SHA_BASE, alterados: [TESTE, 'src/novo.js'], adicionados: [TESTE, 'src/novo.js'] } })(o); r.execucoes[0].moduloAusente = 'src/novo.js'; return r; }],
  ]) {
    const { resultado, chamadas } = await rodar({ args: BASE, overrides: { ...NAO(naoPronto), 'tdd:vermelho': vermelho } });
    assert.equal(resultado.status, 'bloqueado', `${nome}: ${JSON.stringify(resultado)}`);
    assert.equal(resultado.motivo, 'nao-confirmado', nome);
    assert.match(resultado.detalhe, /caso de borda X/, nome);
    assert.equal(resultado.tdd.modo, 'base', nome);
    assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')), nome);
  }
  // Exceção humana que cobre o critério continua desligando o "não" sobre ele, também na base.
  const coberto = await rodar({ args: { ...BASE, perfil: 'maximo', autorizacoesTdd: [AUT] }, overrides: { ...NAO(naoPronto), 'tdd:vermelho': naCopia([[true]]) } });
  assert.equal(coberto.resultado.status, 'verde', JSON.stringify(coberto.resultado));
});

test('re9: na base, o prompt do portão define vermelhoConfirmado uma vez só: testes prontos e cobrindo os critérios', async () => {
  const prompts = {};
  for (const [modo, args] of [['base', BASE], ['worktree', ARGS]]) {
    await rodar({ args, overrides: { 'tdd:portao': (_o, _c, p) => { prompts[modo] = p; return { vermelhoConfirmado: true, testes: [repro('C1')] }; }, ...(modo === 'base' ? { 'tdd:vermelho': naCopia([[false]]) } : {}) } });
  }
  assert.equal((prompts.base.match(/vermelhoConfirmado=true/g) || []).length, 1, prompts.base);
  assert.match(prompts.base, /vermelhoConfirmado=true quando estiverem prontos e cobrirem os critérios/);
  assert.doesNotMatch(prompts.base, /SOMENTE se todas as reproduções falharam/);
  assert.doesNotMatch(prompts.base, /confirme: reprodução falha por asserção/);
  assert.match(prompts.worktree, /vermelhoConfirmado=true SOMENTE se todas as reproduções falharam por asserção/);
  assert.doesNotMatch(prompts.worktree, /quando estiverem prontos e cobrirem/);
});

test('re9: sem vermelhoNaBase o portão não fala de cópia nem aceita moduloAusente', async () => {
  let prompt = '';
  const { chamadas } = await rodar({ args: { ...ARGS, baseRef: SHA_BASE }, overrides: { 'tdd:vermelho': (o, _c, p) => { prompt = p; return DEFAULTS['tdd:vermelho'](o); } } });
  const v = chamadas.find((c) => c.label === 'tdd:vermelho');
  assert.ok(!v.opts.schema.required.includes('copiaBase'));
  assert.equal(v.opts.schema.properties.execucoes.items.properties.moduloAusente, undefined);
  assert.doesNotMatch(prompt, /copia-base/);
});

test('re9: cópia da base que executou outros bytes de teste, ou sem hashes, é erro antes de implementar', async () => {
  for (const vermelho of [naCopia([[false]], { hashes: HASH_B }), (o) => { const r = naCopia([[false]])(o); delete r.copiaBase; return r; }]) {
    const { resultado, chamadas } = await rodar({ args: BASE, overrides: { 'tdd:vermelho': vermelho } });
    assert.equal(resultado.status, 'erro', JSON.stringify(resultado));
    assert.equal(resultado.fase, 'TDD');
    assert.ok(resultado.tdd, 'o erro leva o que foi medido');
    assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
  }
});

// decisao-13, furo 3: no modo base o schema exigia copiaBase.sha, mas o controlador nunca o
// comparava com a base pedida. Uma cópia feita de outro commit era aceita, e o vermelho (ou a
// ausência dele) medido nela valia como medido na base. Decisão 24 do dono (2026-11-03): a
// baseRef é sempre o SHA completo, e o sha da cópia e o de `alteracoes`, quando vem, são IGUAIS a
// ela, sem diferença de caixa. A leitura por prefixo, que não separava dois commits com o mesmo
// prefixo quando `alteracoes` vinha sem sha, deixou de existir.
const SHA_OUTRO = `abc1234${'e'.repeat(33)}`; // mesmo prefixo de 7 caracteres da baseRef, outro commit
const altNaBase = (extra = {}) => ({ comparadoCom: SHA_BASE, alterados: [TESTE, 'src/a.js'], adicionados: [TESTE], ...extra });
const erroDeCopia = (resultado, chamadas, nome) => {
  assert.equal(resultado.status, 'erro', `${nome}: ${JSON.stringify(resultado)}`);
  assert.equal(resultado.fase, 'TDD', nome);
  assert.ok(resultado.tdd, `${nome}: o erro leva o relatório do que foi medido`);
  assert.equal(resultado.tdd.modo, 'base', nome);
  assert.equal(resultado.tdd.execucoes.length, 1, `${nome}: a execução medida na cópia fica no relatório`);
  assert.match(resultado.acao, /run novo com a mesma baseRef/, nome);
  assert.match(resultado.acao, /conferindo a cópia/, nome);
  assert.match(resultado.acao, /NÃO é revertida/, nome);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')), `${nome}: nada implementado`);
};

test('d13: na base, copiaBase.sha diferente do sha que alteracoes mediu para a mesma base é erro TDD, antes de qualquer diagnóstico', async () => {
  for (const [nome, resultados] of [['vermelho medido na cópia de outro commit', [[false]]], ['reprodução verde na cópia de outro commit', [[true]]]]) {
    const { resultado, chamadas } = await rodar({ args: BASE, overrides: { 'tdd:vermelho': naCopia(resultados, { sha: SHA_OUTRO }) } });
    erroDeCopia(resultado, chamadas, nome);
    assert.equal(resultado.tdd.copia.sha, SHA_OUTRO, nome);
    assert.match(resultado.detalhe, new RegExp(`${SHA_OUTRO}.*${SHA_BASE}`), nome);
  }
});

test('d24: na base, copiaBase.sha diferente da baseRef completa é erro TDD, mesmo com alteracoes concordando com a cópia', async () => {
  const outro = 'f'.repeat(40);
  // A variante em maiúsculas trava a normalização: a baseRef chega em maiúsculas, vale em
  // minúsculas, e a cópia de outro commit continua parando.
  for (const [nome, args, alteracoes] of [
    ['alteracoes com o mesmo sha da cópia', BASE, altNaBase({ sha: outro })],
    ['alteracoes sem sha', BASE, altNaBase()],
    ['baseRef em maiúsculas e alteracoes com o mesmo sha da cópia', { ...BASE, baseRef: SHA_BASE.toUpperCase() }, altNaBase({ sha: outro })],
  ]) {
    const { resultado, chamadas } = await rodar({ args, overrides: { 'tdd:vermelho': naCopia([[false]], { sha: outro, alteracoes }) } });
    erroDeCopia(resultado, chamadas, nome);
    assert.match(resultado.detalhe, new RegExp(`copiaBase\\.sha ${outro} não é a baseRef ${SHA_BASE}`), nome);
  }
});

// Decisão 24: o sha que `alteracoes` resolveu, quando vem, também precisa ser a baseRef. A cópia
// certa não salva a medição de implementação anterior feita contra outro commit. A igualdade é
// exata, sem diferença de caixa: os helpers devolvem o sha em minúsculas e os comandos levam a
// baseRef já em minúsculas, então outra caixa é transcrição alterada, não o mesmo valor.
test('d24: na base, alteracoes com sha diferente da baseRef completa é erro TDD, mesmo com a cópia igual a ela', async () => {
  for (const [nome, sha, texto] of [['outro commit com o mesmo prefixo', SHA_OUTRO, SHA_OUTRO], ['sha vazio', '', '\\(vazio\\)'], ['sha em maiúsculas', SHA_BASE.toUpperCase(), SHA_BASE.toUpperCase()]]) {
    const { resultado, chamadas } = await rodar({ args: BASE, overrides: { 'tdd:vermelho': naCopia([[false]], { alteracoes: altNaBase({ sha }) }) } });
    erroDeCopia(resultado, chamadas, nome);
    assert.equal(resultado.tdd.copia.sha, SHA_BASE, nome);
    assert.match(resultado.detalhe, new RegExp(`alteracoes resolveu a base para ${texto}, não para a baseRef ${SHA_BASE}`), nome);
    assert.doesNotMatch(resultado.detalhe, /copiaBase\.sha/, `${nome}: a cópia confere; a razão é só a de alteracoes`);
  }
});

// Revisão da decisão 13 (furo 3): alteracoes só confere a cópia se mediu a MESMA baseRef. O helper
// devolve em comparadoCom a ref que recebeu; com outra ref no comando (origin/main, HEAD ou a
// baseRef abreviada), a detecção de implementação anterior foi medida contra outra base, mesmo
// que os shas concordem.
test('d13: na base, alteracoes que mediu outra ref (comparadoCom diferente da baseRef) é erro TDD, mesmo com os shas concordando', async () => {
  for (const [nome, alteracoes] of [
    ['alteracoes com origin/main', altNaBase({ comparadoCom: 'origin/main', sha: SHA_BASE })],
    ['alteracoes com HEAD', altNaBase({ comparadoCom: 'HEAD', sha: SHA_BASE })],
    ['alteracoes com a baseRef abreviada', altNaBase({ comparadoCom: SHA_BASE.slice(0, 7), sha: SHA_BASE })],
    ['alteracoes com a baseRef em maiúsculas', altNaBase({ comparadoCom: SHA_BASE.toUpperCase(), sha: SHA_BASE })],
    ['alteracoes sem comparadoCom', { sha: SHA_BASE, alterados: [TESTE, 'src/a.js'], adicionados: [TESTE] }],
  ]) {
    const { resultado, chamadas } = await rodar({ args: BASE, overrides: { 'tdd:vermelho': naCopia([[false]], { alteracoes }) } });
    erroDeCopia(resultado, chamadas, nome);
    assert.match(resultado.detalhe, /alteracoes mediu outra base/, nome);
    assert.match(resultado.detalhe, new RegExp(`não a baseRef ${SHA_BASE}`), nome);
    assert.equal(resultado.tdd.implementacaoPreexistente.comparadoCom, alteracoes.comparadoCom ?? null, `${nome}: a medição fica no relatório como foi feita`);
  }
});

// Decisão 24: 40 ou 64 hex o git sempre lê como nome de objeto, então nome de ref só com hex (a
// tag de data 20261103) não chega aqui: é erro de Args (caso d24 de Args, abaixo). Resta o SHA de
// uma tag anotada, que o git descasca até o commit: os dois helpers concordam num sha que não é a
// baseRef, e o run para com o comando que dá o SHA do commit. Saídas reais de copia-base.mjs e
// inspecionar-git.mjs num repositório com a tag anotada v1 (objeto 032d4277...) no commit 0ec11158...
test('d24: na base, baseRef que é SHA de tag anotada (o git resolve para o commit) é erro TDD com o comando do SHA do commit', async () => {
  const commit = '0ec11158ac62a8879a59e6f196900c38f4bb974a';
  const tag = '032d42774f78ab5d3e9b6947f6238fe3ae7cced5';
  const { resultado, chamadas } = await rodar({ args: { ...BASE, baseRef: tag }, overrides: { 'tdd:vermelho': naCopia([[false]], { sha: commit, alteracoes: altNaBase({ comparadoCom: tag, sha: commit }) }) } });
  erroDeCopia(resultado, chamadas, tag);
  assert.match(resultado.detalhe, new RegExp(`copiaBase\\.sha ${commit} não é a baseRef ${tag}`));
  assert.match(resultado.detalhe, new RegExp(`alteracoes resolveu a base para ${commit}, não para a baseRef ${tag}`));
  assert.match(resultado.detalhe, /tag anotada/);
  assert.ok(resultado.detalhe.includes(`git rev-parse --verify '${tag}^{commit}'`), 'o detalhe traz o comando que dá o SHA do commit');
  assert.match(resultado.acao, /SHA do commit/);
});

// Revisão da decisão 13 (furo 3): a outra prova de que a cópia é a certa, os bytes de teste que ela
// executou, era conferida só depois dos bloqueios. Cópia com o sha certo e outros bytes que mediu a
// reprodução verde saía "sem vermelho na base" e mandava cortar o critério ou pedir autorização.
test('d13: na base, cópia com o sha certo que executou outros bytes de teste é erro TDD antes de qualquer bloqueio', async () => {
  const semHashes = (resultados) => (o) => { const r = naCopia(resultados)(o); r.copiaBase.hashesDosTestes = {}; return r; };
  const divergiu = /a cópia da base não executou os testes atuais da worktree: tests\/a\.test\.js/;
  for (const [nome, overrides, motivo] of [
    ['reprodução verde (seria sem-vermelho)', { 'tdd:vermelho': naCopia([[true]], { hashes: HASH_B }) }, divergiu],
    ['"não" do operário (seria nao-confirmado)', { ...NAO(['o teste de C1 não cobre o caso de borda']), 'tdd:vermelho': naCopia([[false]], { hashes: HASH_B }) }, divergiu],
    ['falha de infraestrutura (seria evidência inválida)', { 'tdd:vermelho': naCopia([[false, 'infra', 0]], { hashes: HASH_B }) }, divergiu],
    ['cópia sem hashes e reprodução verde', { 'tdd:vermelho': semHashes([[true]]) }, /evidência da cópia da base não conferiu/],
  ]) {
    const { resultado, chamadas } = await rodar({ args: BASE, overrides });
    assert.equal(resultado.status, 'erro', `${nome}: ${JSON.stringify(resultado)}`);
    assert.equal(resultado.fase, 'TDD', nome);
    assert.equal(resultado.motivo, undefined, `${nome}: não é bloqueio`);
    assert.match(resultado.detalhe, motivo, nome);
    assert.equal(resultado.tdd.modo, 'base', nome);
    assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')), `${nome}: nada implementado`);
  }
});

// Decisão 24: sem o sha de `alteracoes` (veio sem sha ou com erro), a cópia confere pela igualdade
// com a baseRef completa. Com a baseRef abreviada, a única conferência era o prefixo, e a cópia de
// outro commit com o mesmo prefixo passava; a forma abreviada é erro de Args, e a cópia de
// SHA_OUTRO para aqui. SHA da cópia malformado continua com diagnóstico próprio (transcrição).
test('d24: na base, sem o sha de alteracoes, a cópia de outro commit com o mesmo prefixo é erro TDD, e SHA da cópia malformado também', async () => {
  const outroCommit = new RegExp(`copiaBase\\.sha ${SHA_OUTRO} não é a baseRef ${SHA_BASE}`);
  for (const [nome, opcoes, motivo] of [
    ['alteracoes sem sha e cópia de outro commit com o mesmo prefixo', { sha: SHA_OUTRO, alteracoes: altNaBase() }, outroCommit],
    ['alteracoes com erro e cópia de outro commit com o mesmo prefixo', { sha: SHA_OUTRO, alteracoes: { alterados: [], adicionados: [], erro: 'fatal: not a git repository' } }, outroCommit],
    ['SHA da cópia abreviado', { sha: SHA_BASE.slice(0, 7) }, /hex de 40 ou 64/],
    ['SHA da cópia vazio', { sha: '' }, /hex de 40 ou 64/],
    ['SHA da cópia que não é hex', { sha: `abc1234${'z'.repeat(33)}`, alteracoes: altNaBase() }, /hex de 40 ou 64/],
    ['SHA da cópia em maiúsculas', { sha: SHA_BASE.toUpperCase() }, /hex de 40 ou 64 caracteres minúsculos/],
  ]) {
    const { resultado, chamadas } = await rodar({ args: BASE, overrides: { 'tdd:vermelho': naCopia([[false]], opcoes) } });
    erroDeCopia(resultado, chamadas, nome);
    assert.match(resultado.detalhe, motivo, nome);
  }
});

test('d24: controle: na base, cópia e alteracoes iguais à baseRef completa fecham verde como hoje', async () => {
  const sha256 = `abc1234${'0'.repeat(57)}`;
  const maiusculo = SHA_BASE.toUpperCase();
  for (const [nome, args, opcoes] of [
    ['alteracoes com o mesmo sha', BASE, {}],
    ['alteracoes sem sha: a cópia confere pela igualdade com a baseRef', BASE, { alteracoes: altNaBase() }],
    ['alteracoes com erro: a cópia confere pela igualdade com a baseRef', BASE, { alteracoes: { alterados: [], adicionados: [], erro: 'timeout' } }],
    ['baseRef em maiúsculas: vale a forma minúscula', { ...BASE, baseRef: maiusculo }, {}],
    ['repositório SHA-256 com a baseRef completa', { ...BASE, baseRef: sha256 }, { sha: sha256, alteracoes: altNaBase({ comparadoCom: sha256, sha: sha256 }) }],
  ]) {
    const { resultado } = await rodar({ args, overrides: { 'tdd:vermelho': naCopia([[false]], opcoes) } });
    assert.equal(resultado.status, 'verde', `${nome}: ${JSON.stringify(resultado)}`);
    assert.equal(resultado.tdd.continuidade, null, nome);
    assert.equal(resultado.tdd.copia.sha, opcoes.sha ?? SHA_BASE, nome);
  }
});

test('re9: reprodução verde na base não é coberta por rebaseline: lá a implementação não existe', async () => {
  const { resultado } = await rodar({ args: { ...BASE, rebaselineTdd: REB }, overrides: { ...NAO([]), 'tdd:vermelho': naCopia([[true]]) } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.motivo, 'sem-vermelho');
  assert.match(resultado.acao, new RegExp(`na base ${SHA_BASE}`));
  assert.match(resultado.acao, /rebaselineTdd não cobre/);
});

test('re9: na base, import de arquivo que a entrega cria é vermelho válido; outro import continua evidência inválida', async () => {
  const comModulo = (modulo, adicionados) => (o) => {
    const r = naCopia([[false, 'infra', 0]], { alteracoes: { comparadoCom: SHA_BASE, sha: SHA_BASE, alterados: [TESTE, 'src/novo.js'], adicionados } })(o);
    r.execucoes[0].moduloAusente = modulo;
    return r;
  };
  const criado = await rodar({ args: BASE, overrides: { 'tdd:vermelho': comModulo('src/novo.js', [TESTE, 'src/novo.js']) } });
  assert.equal(criado.resultado.status, 'verde', JSON.stringify(criado.resultado));
  assert.equal(criado.resultado.tdd.execucoes[0].moduloCriadoPelaEntrega, true);
  for (const [modulo, adicionados, args] of [
    ['src/novo.js', [TESTE], BASE],                                   // a base já tem o arquivo: não é da entrega
    ['node_modules/lib/x.js', [TESTE, 'src/novo.js'], BASE],          // dependência externa ausente
    [TESTE, [TESTE, 'src/novo.js'], BASE],                            // o próprio teste não é o módulo ausente
  ]) {
    const { resultado } = await rodar({ args, overrides: { ...NAO([]), 'tdd:vermelho': comModulo(modulo, adicionados) } });
    assert.equal(resultado.motivo, 'evidencia-invalida', `${modulo} ${JSON.stringify(adicionados)}`);
  }
  const naWorktree = await rodar({ args: { ...ARGS, baseRef: SHA_BASE }, overrides: { 'tdd:vermelho': comModulo('src/novo.js', [TESTE, 'src/novo.js']) } });
  assert.equal(naWorktree.resultado.motivo, 'evidencia-invalida', 'fora do modo base a regra não vale (C1d)');
});

test('re9: apoio do portão vai para a cópia da base', async () => {
  let prompt = '';
  await rodar({ args: BASE, overrides: {
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1')], apoio: ['tests/helpers/f.js'] }),
    'tdd:vermelho': (o, _c, p) => { prompt = p; return naCopia([[false]])(o); },
  } });
  assert.match(prompt, /--apoio '\["tests\/helpers\/f\.js"\]'/);
});

test('re9: vermelhoNaBase sem baseRef ou não booleano é erro de args antes de qualquer agente', async () => {
  for (const args of [{ ...ARGS, vermelhoNaBase: true }, { ...ARGS, baseRef: SHA_BASE, vermelhoNaBase: 'sim' }]) {
    const { resultado, chamadas } = await rodar({ args });
    assert.equal(resultado.status, 'erro', JSON.stringify(args));
    assert.equal(resultado.fase, 'Args');
    assert.equal(chamadas.length, 0);
  }
});

// Decisão do dono de 2026-11-03: no Solo, a exceção passa para o Loop no perfil máximo. A forma
// natural do Solo é por fases: a fase 1 (C1) teve vermelho e foi implementada, a fase 2 (C2) não
// tem reprodução vermelha. O run só com `autorizacoesTdd` gasta um run máximo e bloqueia, porque
// C1 já passa na worktree; com `baseRef` + `vermelhoNaBase`, C1 é vermelho na cópia da base e a
// autorização cobre só C2. As docs (escada-ponytail.md, entregar) mandam o segundo caminho.
test('re-solo: entrega que chega do Solo com fase implementada só fecha com vermelhoNaBase e a autorização restrita ao critério sem vermelho', async () => {
  const AUT_C2 = { ...AUT, criterios: ['C2'], evidencia: 'Solo, fase 2: a reprodução de C2 nasceu verde' };
  const literal = await rodar({ args: { ...MAX, baseRef: SHA_BASE, autorizacoesTdd: [AUT_C2] }, overrides: {
    ...specCom(['C1', 'C2']),
    'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [repro('C1'), repro('C2')] }),
    'tdd:vermelho': (o) => ({ ...vermelhoCom([true], [true])(o), alteracoes: { comparadoCom: SHA_BASE, alterados: [TESTE, 'src/fase1.js'], adicionados: [TESTE] } }),
  } });
  assert.equal(literal.resultado.status, 'bloqueado', JSON.stringify(literal.resultado));
  assert.equal(literal.resultado.motivo, 'implementacao-preexistente');
  assert.match(literal.resultado.acao, /vermelhoNaBase=true/);
  assert.ok(!literal.chamadas.some((c) => c.label.startsWith('impl:')));
  const naBase = await rodar({ args: { ...BASE, perfil: 'maximo', autorizacoesTdd: [AUT_C2] }, overrides: {
    ...specCom(['C1', 'C2']),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1'), repro('C2')] }),
    'tdd:vermelho': naCopia([[false], [true]]),
  } });
  assert.equal(naBase.resultado.status, 'verde', JSON.stringify(naBase.resultado));
  assert.equal(naBase.resultado.tdd.modo, 'base');
  assert.equal(naBase.resultado.tdd.continuidade.rebaseline, null);
  assert.deepEqual(naBase.resultado.tdd.continuidade.autorizacoes.map((a) => a.criteriosCobertos), [['C2']]);
  assert.ok(naBase.chamadas.some((c) => c.label.startsWith('impl:')));
});

// retomada-excecao-12 e -13: baseRef validada em Args; revisão e auditoria leem o diff contra a base.
test('re12: baseRef malformada é erro de args antes de qualquer agente', async () => {
  for (const baseRef of ['--upload-pack=x', 'a..b', 'HEAD~1..HEAD', 'a b', 42, '', '-x']) {
    const { resultado, chamadas } = await rodar({ args: { ...ARGS, baseRef } });
    assert.equal(resultado.status, 'erro', JSON.stringify(baseRef));
    assert.equal(resultado.fase, 'Args');
    assert.equal(chamadas.length, 0);
  }
});

// Decisão 24 do dono (2026-11-03): "Exigir SHA completo na baseRef. Fora disso, erro de argumentos
// antes de qualquer agente." Uma tag de data como 20261103 era lida como SHA abreviado e o run
// parava por engano na conferência da cópia; um SHA abreviado, sem o sha de alteracoes, não
// separava dois commits com o mesmo prefixo. Vale para todo uso da baseRef: a revisão contra a base
// e o vermelhoNaBase.
test('d24: baseRef que não é SHA completo é erro de Args antes de qualquer agente, com o valor recebido e como obter o SHA', async () => {
  const valores = ['main', 'v3.24.0', '20261103', SHA_BASE.slice(0, 7), SHA_BASE.slice(0, 39), `${SHA_BASE}0`, 'g'.repeat(40), 'HEAD~1', 'origin/main', 42];
  for (const baseRef of valores) {
    for (const extra of [{}, { vermelhoNaBase: true }]) {
      const nome = `${JSON.stringify(baseRef)}${extra.vermelhoNaBase ? ' com vermelhoNaBase' : ''}`;
      const { resultado, chamadas } = await rodar({ args: { ...ARGS, baseRef, ...extra } });
      assert.equal(resultado.status, 'erro', `${nome}: ${JSON.stringify(resultado)}`);
      assert.equal(resultado.fase, 'Args', nome);
      assert.equal(chamadas.length, 0, `${nome}: nenhum agente`);
      assert.ok(resultado.detalhe.includes(`recebi ${JSON.stringify(baseRef)}`), `${nome}: o detalhe nomeia o valor recebido (${resultado.detalhe})`);
      assert.match(resultado.detalhe, /SHA completo/, nome);
      assert.ok(resultado.acao.includes("git rev-parse --verify '<ref>^{commit}'"), `${nome}: a ação dá o comando do SHA (${resultado.acao})`);
      assert.ok(resultado.acao.includes('git merge-base <branchBase> HEAD'), nome);
      assert.match(resultado.acao, /run novo/, nome);
    }
  }
});

test('d24: baseRef SHA completo de 40 ou 64 caracteres passa, e maiúsculas valem em minúsculas nos comandos e no relatório', async () => {
  const sha256 = '0123456789abcdef'.repeat(4);
  for (const [nome, baseRef, esperado] of [['SHA-1', SHA_BASE, SHA_BASE], ['SHA-256', sha256, sha256], ['SHA-1 em maiúsculas', SHA_BASE.toUpperCase(), SHA_BASE], ['SHA-256 em maiúsculas', sha256.toUpperCase(), sha256]]) {
    let prompt = '';
    const { resultado } = await rodar({ args: { ...ARGS, baseRef }, overrides: { 'tdd:vermelho': (o, _c, p) => { prompt = p; return DEFAULTS['tdd:vermelho'](o); } } });
    assert.equal(resultado.status, 'verde', `${nome}: ${JSON.stringify(resultado)}`);
    assert.equal(resultado.tdd.baseRef, esperado, nome);
    assert.ok(prompt.includes(`alteracoes '${esperado}'`), `${nome}: o comando de alteracoes leva a forma minúscula`);
    assert.ok(!prompt.includes(esperado.toUpperCase()), `${nome}: nenhuma forma maiúscula no prompt`);
  }
  let promptBase = '';
  const naBase = await rodar({ args: { ...BASE, baseRef: SHA_BASE.toUpperCase() }, overrides: { 'tdd:vermelho': (o, _c, p) => { promptBase = p; return naCopia([[false]])(o); } } });
  assert.equal(naBase.resultado.status, 'verde', JSON.stringify(naBase.resultado));
  assert.ok(promptBase.includes(`criar '${SHA_BASE}'`), 'a cópia da base é criada com a forma minúscula');
});

test('re12: reprodução verde sem baseRef avisa que implementação commitada não aparece', async () => {
  const sem = await rodar({ args: ARGS, overrides: { 'tdd:vermelho': vermelhoCom([true]) } });
  assert.match(sem.resultado.acao, /Sem baseRef, implementação já commitada/);
  const com = await rodar({ args: { ...ARGS, baseRef: SHA_BASE }, overrides: { 'tdd:vermelho': vermelhoCom([true]) } });
  assert.doesNotMatch(com.resultado.acao, /Sem baseRef/);
  assert.match(com.resultado.acao, /rebaselineTdd/);
});

test('re13: com baseRef, auditoria e as três lentes leem o diff contra a base, inclusive commits', async () => {
  const prompts = {};
  const guardar = (rotulo, padrao) => (o, _c, p) => { prompts[o.label] = p; return DEFAULTS[padrao](o); };
  for (const args of [{ ...MAX, baseRef: SHA_BASE }, MAX]) {
    await rodar({ args, overrides: { 'ponytail:': guardar('ponytail', 'ponytail:'), 'rev:': guardar('rev', 'rev:') } });
    for (const l of ['ponytail:i1', 'rev:corretude:i1', 'rev:seguranca-bordas:i1', 'rev:ponytail-arquitetura:i1']) {
      if (args.baseRef) {
        assert.match(prompts[l], new RegExp(`inspecionar-git\\.mjs' diff '\\[.*\\]' '${SHA_BASE}'`), l);
        assert.match(prompts[l], /inclusive commits da entrega/, l);
      } else {
        assert.doesNotMatch(prompts[l], new RegExp(SHA_BASE), l);
        assert.match(prompts[l], /working tree contra HEAD/, l);
      }
    }
    assert.match(prompts['ponytail:i1'], args.baseRef ? new RegExp(`toda a entrega desde a base ${SHA_BASE}`) : /trabalho já commitado na branch não aparece/);
  }
});

test('re13: Git real: com baseRef, a receita da revisão mostra a implementação já commitada que contra HEAD some', async () => {
  const dir = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-base-')));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
  const git = (...a) => { const r = spawnSync('git', a, { cwd: dir, env, encoding: 'utf8', timeout: 10000 }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  const commit = (m) => git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', m);
  try {
    git('init', '-q'); mkdirSync(resolve(dir, 'src'));
    writeFileSync(resolve(dir, 'src/a.js'), 'export const a = 1;\n');
    git('add', '--', 'src/a.js'); commit('base');
    const base = git('rev-parse', 'HEAD');
    writeFileSync(resolve(dir, 'src/a.js'), 'export const a = 1;\nexport const IMPLEMENTADO_COMMITADO = 2;\n');
    git('add', '--', 'src/a.js'); commit('checkpoint do Solo');
    const vistos = {};
    for (const baseRef of [undefined, base]) {
      await rodar({ args: { ...ARGS, workspaceRoot: dir, scriptsDir: resolve(HARNESS, '../../scripts'), ...(baseRef ? { baseRef } : {}) }, overrides: {
        'ponytail:': (_o, _c, prompt) => {
          const r = spawnSync('sh', ['-c', prompt.match(/```sh\n([\s\S]*?)\n```/)[1]], { cwd: dir, env, encoding: 'utf8', timeout: 10000 });
          assert.equal(r.status, 0, r.stderr);
          vistos[baseRef ? 'base' : 'head'] = r.stdout;
          return DEFAULTS['ponytail:']();
        },
      } });
    }
    assert.ok(!vistos.head.includes('IMPLEMENTADO_COMMITADO'), 'contra HEAD o commit da entrega some');
    assert.ok(vistos.base.includes('IMPLEMENTADO_COMMITADO'), 'contra a base a revisão vê o que já foi commitado');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── 2026-11-02 (2.6.0), parte 2: validação × ambiente, impressão, escada e revisão ───────────
// Porte da outra 2.5 nas áreas de validação e reuso, escada e revisão. Cada caso cita o item da
// comparação (vrN = validacao-reuso-N, erN = escada-revisao-N, arN = args-relatorio-N).

// Falha de ambiente típica: cache do uv sem escrita. `T1_CMD` é o comando do teste da SPEC default.
const EPERM = { comando: 'uv run pytest', resumo: 'PermissionError: [Errno 13] Permission denied: ~/.cache/uv', natureza: 'ambiente', evidencia: 'UV_CACHE_DIR não gravável (EACCES em ~/.cache/uv)' };
const T1_CMD = repro('C1').comando;
const validarAmbiente = (extra = {}) => (o) => ({ ...DEFAULTS['validar:'](o), verde: false, falhas: [EPERM], ...extra });
const promptDe = (chamadas, rotulo, n = 0) => chamadas.filter((c) => c.label === rotulo)[n].prompt;

// validacao-reuso-1 / escada-revisao-4: natureza da falha de validação, distinta de tipoFalha.
test('vr1: a validação pede a natureza de cada falha, campo distinto de tipoFalha, e o schema só aceita os três valores', async () => {
  const { chamadas } = await rodar({ args: ARGS });
  const v = chamadas.find((c) => c.label === 'validar:i1');
  assert.match(v.prompt, /inclusive de teste da SPEC/);
  assert.match(v.prompt, /DISTINTO de tipoFalha/);
  assert.match(v.prompt, /UV_CACHE_DIR/);
  assert.match(v.prompt, /Não reescreva comandos para contornar ambiente/);
  const item = v.opts.schema.properties.falhas.items;
  assert.deepEqual(item.properties.natureza.enum, ['funcional', 'ambiente', 'indeterminada']);
  assert.equal(item.properties.evidencia.type, 'string');
  assert.deepEqual(item.required, ['comando', 'resumo'], 'natureza é opcional: ausente vira indeterminada');
});

test('vr1: falha sem natureza (ou fora do enum) vira indeterminada no histórico e no resumo da escalada', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'validar:': (o) => ({ ...DEFAULTS['validar:'](o), verde: false, falhas: [{ comando: 'npm test', resumo: 'soma errada', natureza: 'funcional' }, { comando: 'npm run lint', resumo: 'falhou' }, { comando: 'npm run build', resumo: 'x', natureza: 'AMBIENTE' }] }),
  } });
  assert.equal(resultado.status, 'escalado', JSON.stringify(resultado));
  assert.deepEqual(resultado.historico[0].validacoes.map((f) => f.natureza), ['funcional', 'indeterminada', 'indeterminada']);
  assert.deepEqual(resultado.resumoDaEscalada.falhasDeValidacaoPorNatureza, { funcional: 1, indeterminada: 2 });
});

// validacao-reuso-2 / validacao-reuso-11: falha só de ambiente para o run em vez de virar correção.
test('vr2: falha só de ambiente com os testes da SPEC verdes encerra na iteração 1, sem devolver correção nem revisar', async () => {
  const { resultado, chamadas } = await rodar({ args: { ...ARGS, validacoes: ['uv run pytest'] }, overrides: { 'validar:': validarAmbiente() } });
  assert.equal(resultado.status, 'erro', JSON.stringify(resultado));
  assert.equal(resultado.fase, 'Validar');
  assert.equal(resultado.motivo, 'ambiente');
  assert.equal(resultado.iteracao, 1);
  assert.equal(resultado.detalhe[0].evidencia, EPERM.evidencia);
  assert.equal(chamadas.filter((c) => c.label.startsWith('impl:')).length, 1);
  assert.ok(!chamadas.some((c) => c.label.startsWith('ponytail:') || c.label.startsWith('rev:')), 'parada antes da auditoria e das lentes');
  assert.equal(resultado.tdd.execucoes.length, 1, 'a parada leva o relatório do portão');
  assert.deepEqual(resultado.historico, [{ iteracao: 1, validacaoVerde: false, validacoes: [EPERM], findings: [] }]);
  assert.deepEqual(resultado.validacoesReaproveitadas, []);
  assert.match(resultado.acao, /NÃO reverta/);
  assert.match(resultado.acao, /rebaselineTdd/);
  assert.match(resultado.acao, /vermelhoNaBase/);
  assert.match(resultado.acao, /nunca preenchidos pelo agente/);
  assert.match(resultado.acao, /sem validacaoAnterior/);
  assert.match(resultado.acao, /resumeFromRunId devolveria/);
  assert.match(resultado.acao, /não foi descartada/);
});

test('vr2: teste da SPEC que sai infra, com falha de ambiente do mesmo comando e erro do sistema, também para', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'validar:': validarAmbiente({ execucoes: [execucao('T1', false, 'infra')], falhas: [{ comando: `  ${T1_CMD} `, resumo: "EACCES: permission denied, mkdir '/root/.cache/x'", natureza: 'ambiente', evidencia: 'XDG_CACHE_HOME' }] }),
  } });
  assert.equal(resultado.status, 'erro', JSON.stringify(resultado));
  assert.equal(resultado.motivo, 'ambiente');
});

test('vr2: import quebrado pela implementação e rotulado de ambiente, sem erro do sistema, não para: o loop corrige', async () => {
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'validar:': (o) => vez++ === 0
      ? { ...DEFAULTS['validar:'](o), verde: false, execucoes: [execucao('T1', false, 'infra')], falhas: [{ comando: T1_CMD, resumo: "Cannot find module './calc'", natureza: 'ambiente' }] }
      : DEFAULTS['validar:'](o),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.iteracoes, 2);
  assert.match(promptDe(chamadas, 'impl:U1', 1), /corrija o código sem editar o teste/);
});

for (const [caso, extra] of [
  ['ao lado de falha funcional', { falhas: [EPERM, { comando: 'npm test', resumo: 'soma errada', natureza: 'funcional' }] }],
  ['com reprodução vermelha por asserção', { execucoes: [execucao('T1', false)] }],
  ['com teste infra sem falha de ambiente do mesmo comando', { execucoes: [execucao('T1', false, 'infra')] }],
  ['com a execução do teste da SPEC faltando', { execucoes: [] }],
  ['com teste que saiu 0 sem executar caso', { execucoes: [execucao('T1', true, 'nenhuma', 0)] }],
]) {
  test(`vr2: ambiente ${caso} não para e nunca fecha verde`, async () => {
    const { resultado } = await rodar({ args: ARGS, overrides: { 'validar:': validarAmbiente(extra) } });
    assert.notEqual(resultado.motivo, 'ambiente', JSON.stringify(resultado));
    assert.equal(resultado.status, 'escalado');
  });
}

// validacao-reuso-3: hashes conferidos antes; a parada leva o histórico.
test('vr3: teste da SPEC alterado não se esconde atrás de falha só de ambiente: segue para o bloqueante', async () => {
  let vez = 0;
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'validar:': (o) => vez++ === 0
      ? { ...DEFAULTS['validar:'](o), verde: false, falhas: [{ comando: 'npm test', resumo: 'soma errada', natureza: 'funcional' }] }
      : validarAmbiente({ hashesDosTestes: { [TESTE]: HASH_B } })(o),
  } });
  assert.equal(resultado.status, 'escalado', JSON.stringify(resultado));
  assert.notEqual(resultado.motivo, 'ambiente');
  assert.ok(resultado.historico[1].findings.some((f) => f.origem === 'testes-intactos'));
});

test('vr3: parada por ambiente na iteração 2 leva o histórico da 1, com a natureza normalizada', async () => {
  let vez = 0;
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'validar:': (o) => vez++ === 0 ? { ...DEFAULTS['validar:'](o), verde: false, falhas: [{ comando: 'npm test', resumo: 'soma errada', natureza: 'funcional' }] } : validarAmbiente()(o),
  } });
  assert.equal(resultado.motivo, 'ambiente', JSON.stringify(resultado));
  assert.equal(resultado.iteracao, 2);
  assert.equal(resultado.historico.length, 2);
  assert.equal(resultado.historico[0].validacoes[0].natureza, 'funcional');
  assert.equal(resultado.historico[1].validacoes[0].natureza, 'ambiente');
  assert.equal(resultado.historico[1].iteracao, 2);
});

test('vr3: hash que não confere nem na recoleta continua erro de evidência, mesmo com falha só de ambiente', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    ...BASE_C,
    'validar:': validarAmbiente({ hashesDosTestes: { [TESTE]: SHA_C } }),
    'hashes:': () => ({ hashesDosTestes: { [TESTE]: HASH_C_TROCADO } }),
  } });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.fase, 'Validar');
  assert.equal(resultado.motivo, undefined, 'erro de evidência não vira ambiente');
  assert.match(resultado.acao, /não prova alteração/);
});

// validacao-reuso-4: correções levam a natureza e a proibição de contornar ambiente.
test('vr4: as correções da iteração 2 levam a natureza de cada falha e a regra de não contornar ambiente', async () => {
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'validar:': (o) => vez++ === 0 ? { ...DEFAULTS['validar:'](o), verde: false, falhas: [EPERM, { comando: 'npm test', resumo: 'soma errada' }] } : DEFAULTS['validar:'](o),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.iteracoes, 2);
  const impl2 = promptDe(chamadas, 'impl:U1', 1);
  assert.match(impl2, /"natureza":"ambiente"/);
  assert.match(impl2, /"natureza":"indeterminada"/);
  assert.match(impl2, /"validacaoVerde":false/);
  assert.match(impl2, /natureza "ambiente" nas correções[\s\S]*NÃO se corrige mudando código nem teste/);
});

test('vr4: teste da SPEC vermelho por infra depois da implementação separa import do código de ambiente; asserção continua mandando passar', async () => {
  const casos = [
    ['reprodução infra', {}, [repro('C1')], ['infra'], /não altere código nem teste[\s\S]*pendência/],
    ['controle infra', { ...specCom(['C1', 'C2'], preserva('C2')) }, [repro('C1'), controle('C2')], [null, 'infra'], /não altere código nem teste/],
  ];
  for (const [nome, spec, testes, falhas, espera] of casos) {
    const { resultado } = await rodar({ args: ARGS, overrides: {
      ...spec,
      'tdd:portao': () => ({ vermelhoConfirmado: true, testes }),
      'tdd:vermelho': vermelhoCom(...testes.map((t) => (t.tipo === 'reproducao' ? [false] : [true]))),
      'validar:': (o) => ({ ...DEFAULTS['validar:'](o), verde: false, execucoes: idsDoSchema(o).map((t, i) => (falhas[i] ? execucao(t, false, falhas[i]) : execucao(t, true))) }),
    } });
    const f = resultado.historico[0].findings.find((x) => x.origem === 'portao-tdd');
    assert.ok(f, `${nome}: ${JSON.stringify(resultado)}`);
    assert.match(f.cenario, espera, nome);
    assert.match(f.cenario, /corrija o código sem editar o teste/, nome);
    assert.ok(!/Faça o teste passar sem editá-lo/.test(f.cenario), nome);
  }
  const assercao = await rodar({ args: ARGS, overrides: { 'validar:': (o) => ({ ...DEFAULTS['validar:'](o), verde: false, execucoes: [execucao('T1', false)] }) } });
  const f = assercao.resultado.historico[0].findings.find((x) => x.origem === 'portao-tdd');
  assert.match(f.cenario, /Faça o teste passar sem editá-lo/);
  assert.ok(!/não altere código nem teste/.test(f.cenario));
});

// validacao-reuso-5 / validacao-reuso-6 / args-relatorio-6 / escada-revisao-5: impressão sem a SPEC e as pendências.
test('vr5: a impressão deixa de fora a SPEC (do diff) e as pendências (só dos não rastreados), nos dois prompts, e as listas saem na validação final', async () => {
  const { resultado, chamadas } = await rodar({ args: { ...ARGS, pendenciasPath: '/workspace/docs/pendencias.md', rebaselineTdd: REB_VAL }, overrides: REBASE_OK });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  const listas = `--impressao '["docs/plans/spec.md"]' '["docs/pendencias.md"]'`;
  for (const rotulo of ['impressao:i1', 'validar:i1']) assert.ok(promptDe(chamadas, rotulo).includes(listas), `${rotulo}: ${promptDe(chamadas, rotulo)}`);
  assert.deepEqual(resultado.validacaoFinal.excluidos, ['docs/plans/spec.md']);
  assert.deepEqual(resultado.validacaoFinal.excluidosNaoRastreados, ['docs/pendencias.md']);
  // Sem pendências, só a lista do diff; a validação final traz a segunda lista vazia.
  const semPend = await rodar({ args: ARGS });
  assert.match(promptDe(semPend.chamadas, 'validar:i1'), /--impressao '\["docs\/plans\/spec\.md"\]'\n/);
  assert.deepEqual(semPend.resultado.validacaoFinal.excluidosNaoRastreados, []);
  // SPEC fora do workspace e sem pendências: nada a excluir, o comando é o da 2.5.0.
  const fora = await rodar({ args: { ...ARGS, specPath: '/outro/spec.md' } });
  assert.match(promptDe(fora.chamadas, 'validar:i1'), /--impressao\n/);
  assert.deepEqual(fora.resultado.validacaoFinal.excluidos, []);
  // Pendências fora do workspace da SPEC continuam só na segunda lista.
  const soPend = await rodar({ args: { ...ARGS, specPath: '/outro/spec.md', pendenciasPath: 'docs/pendencias.md' } });
  assert.ok(promptDe(soPend.chamadas, 'validar:i1').includes(`--impressao '[]' '["docs/pendencias.md"]'`), promptDe(soPend.chamadas, 'validar:i1'));
});

test('vr5: Git real: gravar o Log na SPEC e as pendências entre os runs não impede o reuso; mudar código ou trocar a lista impede', async (t) => {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-reuso-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
  const git = (...a) => { const r = spawnSync('git', a, { cwd: root, env, encoding: 'utf8', timeout: 10000 }); assert.equal(r.status, 0, r.stderr); };
  git('init', '-q');
  mkdirSync(resolve(root, 'src')); mkdirSync(resolve(root, 'docs/plans'), { recursive: true });
  writeFileSync(resolve(root, 'src/a.js'), 'export const a = 1;\n');
  writeFileSync(resolve(root, 'docs/plans/spec.md'), '# E1\n\n## SPEC\n\n## Log de execução\n');
  git('add', '.'); git('-c', 'user.name=F', '-c', 'user.email=f@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'base');
  writeFileSync(resolve(root, 'src/a.js'), 'export const a = 2;\n');
  // O mecânico falso executa de verdade o bloco bash do prompt que tem --impressao.
  const impressao = (prompt) => {
    const cmd = [...prompt.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1].trim()).find((b) => b.includes('--impressao'));
    const r = spawnSync('sh', ['-c', cmd], { env, encoding: 'utf8', timeout: 10000 });
    assert.equal(r.status, 0, `${r.stderr} (${cmd})`);
    return JSON.parse(r.stdout).impressao;
  };
  const scriptsDir = resolve(HARNESS, '../../scripts');
  const comPendencias = { ...ARGS, workspaceRoot: root, scriptsDir, pendenciasPath: 'docs/pendencias.md' };
  const validarReal = { 'validar:': (o, _c, prompt) => ({ ...DEFAULTS['validar:'](o), impressaoWorktree: impressao(prompt) }) };
  const retomar = async (args, validacaoAnterior) => {
    const prompts = [];
    const r = await rodar({ args: { ...args, rebaselineTdd: { ...REB, validacaoAnterior } }, overrides: {
      ...REBASE_OK,
      'impressao:': (_o, _c, prompt) => ({ impressao: impressao(prompt) }),
      'validar:': (o, _c, prompt) => { prompts.push(prompt); return { ...DEFAULTS['validar:'](o), impressaoWorktree: impressao(prompt) }; },
    } });
    assert.equal(r.resultado.status, 'verde', JSON.stringify(r.resultado));
    return { reaproveitada: r.resultado.validacaoFinal.reaproveitada, suiteLonga: prompts[0].includes('as validações do projeto: npm test') };
  };
  const run1 = await rodar({ args: comPendencias, overrides: validarReal });
  assert.equal(run1.resultado.status, 'verde', JSON.stringify(run1.resultado));
  assert.ok(run1.resultado.validacaoFinal.impressao, 'o run 1 entrega impressão conferida');
  // O fluxo documentado grava o relatório no Log da SPEC e anota um desvio nas pendências.
  writeFileSync(resolve(root, 'docs/plans/spec.md'), '# E1\n\n## SPEC\n\n## Log de execução\n- [Step 7] dev-loop verde\n');
  writeFileSync(resolve(root, 'docs/pendencias.md'), '- [ ] débito achado de passagem\n');
  assert.deepEqual(await retomar(comPendencias, run1.resultado.validacaoFinal), { reaproveitada: true, suiteLonga: false });
  // Sem pendenciasPath no run novo a lista muda e a impressão não confere: os runs levam o mesmo valor.
  const { pendenciasPath, ...semPendencias } = comPendencias;
  assert.deepEqual(await retomar(semPendencias, run1.resultado.validacaoFinal), { reaproveitada: false, suiteLonga: true });
  // Código mudou depois da validação: roda tudo de novo.
  writeFileSync(resolve(root, 'src/a.js'), 'export const a = 3;\n');
  assert.deepEqual(await retomar(comPendencias, run1.resultado.validacaoFinal), { reaproveitada: false, suiteLonga: true });
});

// Revisão adversarial do porte: pendenciasPath que aponta para código RASTREADO (unidade com área
// de diretório, módulo fora das unidades) saía do `git diff HEAD` da impressão, e a validação longa
// era reaproveitada sobre código alterado. Com o script real, a impressão é recusada (sem reuso).
test('vr6: Git real: pendenciasPath em arquivo rastreado não esconde código; mudá-lo depois do verde não reaproveita a suíte longa', async (t) => {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-pend-rastreada-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_OPTIONAL_LOCKS: '0' };
  const git = (...a) => { const r = spawnSync('git', a, { cwd: root, env, encoding: 'utf8', timeout: 10000 }); assert.equal(r.status, 0, r.stderr); };
  git('init', '-q');
  mkdirSync(resolve(root, 'src')); mkdirSync(resolve(root, 'docs/plans'), { recursive: true });
  writeFileSync(resolve(root, 'src/a.js'), 'export const a = 1;\n');
  writeFileSync(resolve(root, 'package.json'), '{"name":"x"}\n');
  writeFileSync(resolve(root, 'docs/plans/spec.md'), '# E1\n\n## SPEC\n\n## Log de execução\n');
  git('add', '.'); git('-c', 'user.name=F', '-c', 'user.email=f@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'base');
  // O mecânico falso executa o bloco bash com --impressao; comando que falha não tem impressão.
  const impressao = (prompt) => {
    const cmd = [...prompt.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1].trim()).find((b) => b.includes('--impressao'));
    const r = spawnSync('sh', ['-c', cmd], { env, encoding: 'utf8', timeout: 10000 });
    return r.status === 0 ? JSON.parse(r.stdout).impressao : '';
  };
  const scriptsDir = resolve(HARNESS, '../../scripts');
  for (const [arquivos, pendenciasPath, mudar] of [['src/', 'src/a.js', 'src/a.js'], ['src/b.js', 'package.json', 'package.json']]) {
    writeFileSync(resolve(root, mudar), `${mudar === 'package.json' ? '{"name":"x"}' : 'export const a = 1;'}\n`);
    const args = { ...ARGS, workspaceRoot: root, scriptsDir, pendenciasPath };
    const spec = { 'spec:validar': () => ({ ...DEFAULTS['spec:validar'](), unidades: [{ id: 'U1', titulo: 'u', arquivos, criterios: ['C1'] }] }) };
    const run1 = await rodar({ args, overrides: { ...spec, 'validar:': (o, _c, prompt) => ({ ...DEFAULTS['validar:'](o), impressaoWorktree: impressao(prompt) }) } });
    assert.equal(run1.resultado.status, 'verde', JSON.stringify(run1.resultado));
    // A validação anterior traz a impressão que o run 1 registrou ou, se ele a recusou, a que a
    // lista única da revisão anterior registrava (SPEC e pendências no diff): o reuso é tentado.
    const antiga = JSON.parse(spawnSync(process.execPath, [resolve(scriptsDir, 'hashes-testes.mjs'), '--impressao', JSON.stringify(['docs/plans/spec.md', pendenciasPath].sort())], { cwd: root, env, encoding: 'utf8' }).stdout).impressao;
    const validacaoAnterior = { ...run1.resultado.validacaoFinal, impressao: run1.resultado.validacaoFinal.impressao ?? antiga };
    // A retomada muda o arquivo rastreado depois do verde e tenta reaproveitar a validação.
    writeFileSync(resolve(root, mudar), `${mudar === 'package.json' ? '{"name":"y"}' : 'export const a = 2;'}\n`);
    const prompts = [];
    const run2 = await rodar({ args: { ...args, rebaselineTdd: { ...REB, validacaoAnterior } }, overrides: {
      ...spec, ...REBASE_OK,
      'impressao:': (_o, _c, prompt) => ({ impressao: impressao(prompt) }),
      'validar:': (o, _c, prompt) => { prompts.push(prompt); return { ...DEFAULTS['validar:'](o), impressaoWorktree: impressao(prompt) }; },
    } });
    assert.equal(run2.resultado.status, 'verde', JSON.stringify(run2.resultado));
    assert.deepEqual(run2.resultado.validacoesReaproveitadas, [], pendenciasPath);
    assert.ok(prompts[0].includes('as validações do projeto: npm test'), `${pendenciasPath}: a suíte longa roda de novo`);
    assert.equal(run1.resultado.validacaoFinal.impressao, null, `${pendenciasPath}: pendência rastreada recusa a impressão`);
  }
});

test('vr6: pendenciasPath que aponta para arquivo de unidade é erro antes do portão (esconderia código da impressão)', async () => {
  for (const p of ['src/a.js', '/workspace/./src/a.js']) {
    const { resultado, chamadas } = await rodar({ args: { ...ARGS, pendenciasPath: p } });
    assert.equal(resultado.status, 'erro', p);
    assert.equal(resultado.fase, 'Spec', p);
    assert.match(resultado.detalhe, /arquivo de unidade/);
    assert.ok(!chamadas.some((c) => c.label === 'tdd:portao'), p);
  }
  // Unidade cuja área é um diretório (docs/) não barra o default docs/pendencias.md.
  const ok = await rodar({ args: { ...ARGS, pendenciasPath: 'docs/pendencias.md' }, overrides: { 'spec:validar': () => ({ ...DEFAULTS['spec:validar'](), unidades: [{ id: 'U1', titulo: 'docs', arquivos: 'docs/', criterios: ['C1'] }] }) } });
  assert.equal(ok.resultado.status, 'verde', JSON.stringify(ok.resultado));
});

// escada-revisao-1: semCriacao.
test('er1: unidade que só modifica o existente declara semCriacao e fecha verde, com o rastro na escada', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'impl:': () => ({ status: 'concluida', resumo: 'corrigi o comando do README', escada: [], semCriacao: true, arquivosTocados: ['README.md'] }) } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.iteracoes, 1);
  assert.deepEqual(resultado.ponytail.escada, [{ iteracao: 1, unidade: 'U1', semCriacao: true, arquivos: ['README.md'] }]);
  const schema = chamadas.find((c) => c.label === 'impl:U1').opts.schema;
  assert.equal(schema.properties.semCriacao.type, 'boolean');
  assert.ok(!schema.required.includes('semCriacao'), 'a consulta "bloqueada" não precisa do campo');
  assert.match(promptDe(chamadas, 'ponytail:i1'), /semCriacao\): \[\{"iteracao":1,"unidade":"U1","semCriacao":true/);
});

test('er1: o prompt ensina semCriacao, e escada vazia sem a declaração continua bloqueando', async () => {
  for (const semCriacao of [undefined, false]) {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'impl:': () => ({ status: 'concluida', resumo: 'ok', escada: [], arquivosTocados: ['README.md'], ...(semCriacao === undefined ? {} : { semCriacao }) }) } });
    const p = promptDe(chamadas, 'impl:U1');
    assert.match(p, /escada: \[\] e semCriacao: true/);
    assert.ok(!p.includes('Nada criado nesta unidade → escada: [].'));
    assert.equal(resultado.status, 'escalado');
    const f = resultado.historico[2].findings.find((x) => /Relato de escada ausente/.test(x.resumo));
    assert.match(f.resumo, /sem declaração semCriacao/);
    assert.match(f.cenario, /`escada: \[\]` com `semCriacao: true`/);
  }
});

// escada-revisao-2: confronto do diff com a escada declarada.
const SEM_CRIACAO = { 'impl:': () => ({ status: 'concluida', resumo: 'só ajustei', escada: [], semCriacao: true, arquivosTocados: ['src/a.js'] }) };
test('er2: semCriacao com criação que o diff mostra vira correção depois de confirmada', async () => {
  let aud = 0;
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    ...SEM_CRIACAO,
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), criacoesSemRelato: aud++ === 0 ? [{ oQue: 'calcularTaxa', arquivo: 'src/a.js', linha: 3, unidade: 'U1' }] : [] }),
    'confirmar:': () => ({ real: true, bloqueante: true, porque: 'o diff cria calcularTaxa e nenhuma escada o registra' }),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.iteracoes, 2);
  assert.match(promptDe(chamadas, 'impl:U1', 1), /P1-P7: criação sem relato de escada \\"calcularTaxa\\" \(U1\)/);
  const julgado = resultado.ponytail.duplicacoesEAbstracoes.find((j) => j.sinal === 'P1-P7');
  assert.equal(julgado.confirmado, true);
  assert.equal(julgado.natureza, 'procedimento');
});

test('er2: criação sem relato confirmada como não bloqueante vira pendência, sem retrabalho', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    ...SEM_CRIACAO,
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), criacoesSemRelato: [{ oQue: 'formatarData', arquivo: 'src/a.js' }] }),
    'confirmar:': () => ({ real: true, bloqueante: false, porque: 'existe, mas é helper interno trivial' }),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.iteracoes, 1);
  assert.equal(resultado.ponytail.duplicacoesEAbstracoes.find((j) => j.sinal === 'P1-P7').severidade, 'nao-bloqueante');
});

test('er2: o confronto usa a escada de todas as iterações: a correção da iteração 2 não acusa o que a 1 relatou', async () => {
  const criadas = [['calcularTaxa'], ['calcularTaxa', 'validarEntrada']];
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'impl:': (_o, c) => ({ status: 'concluida', resumo: 'ok', escada: [{ item: c.filter((x) => x.label === 'impl:U1').length === 1 ? 'calcularTaxa' : 'validarEntrada', degrau: 7, porque: 'novo' }], arquivosTocados: ['src/a.js'] }),
    // Auditor literal: reporta toda criação do diff acumulado cujo item não aparece no prompt dele.
    'ponytail:': (_o, c, prompt) => ({ ...DEFAULTS['ponytail:'](), criacoesSemRelato: criadas[c.filter((x) => x.label.startsWith('ponytail:')).length - 1].filter((n) => !prompt.includes(`"item":"${n}"`)).map((n) => ({ oQue: n, arquivo: 'src/a.js', unidade: 'U1' })) }),
    'rev:': (_o, c) => ({ findings: c.filter((x) => x.label.startsWith('rev:')).length === 1 ? [{ arquivo: 'src/a.js', linha: 4, resumo: 'bug A', cenario: 'entrada vazia quebra', severidade: 'bloqueante', confianca: 'confirmado' }] : [] }),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado.historico));
  assert.equal(resultado.iteracoes, 2);
  assert.equal(chamadas.filter((c) => c.label.startsWith('confirmar:')).length, 0);
  assert.match(promptDe(chamadas, 'ponytail:i2'), /base do confronto de criacoesSemRelato\): \[[^\n]*"item":"calcularTaxa"/);
});

test('er2: teste da SPEC e apoio do portão ficam fora do confronto, sem confirmador nem pendência', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1')], apoio: ['tests/helpers/fixture.js'] }),
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), criacoesSemRelato: [{ oQue: 'teste de C1', arquivo: TESTE }, { oQue: 'montarFixture', arquivo: 'tests/helpers/fixture.js' }] }),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.ok(!chamadas.some((c) => c.label.startsWith('confirmar:')));
  assert.deepEqual(resultado.ponytail.pendenciasEmTestesDaSpec, []);
  assert.ok(promptDe(chamadas, 'ponytail:i1').includes(`ficam fora deste confronto: ${JSON.stringify([TESTE, 'tests/helpers/fixture.js'])}`));
});

test('er2: o schema da auditoria aceita criacoesSemRelato e o confirmador do sinal recebe a escada acumulada', async () => {
  const { chamadas } = await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), criacoesSemRelato: [{ oQue: 'calcularTaxa', arquivo: 'src/a.js' }] }),
    'confirmar:': () => ({ real: false, bloqueante: false, porque: 'calcularTaxa é o fn relatado' }),
  } });
  const schema = chamadas.find((c) => c.label === 'ponytail:i1').opts.schema;
  assert.deepEqual(schema.properties.criacoesSemRelato.items.required, ['oQue', 'arquivo']);
  assert.ok(!schema.required.includes('criacoesSemRelato'), 'campo faltante não derruba a auditoria');
  const conf = chamadas.find((c) => c.label === 'confirmar:i1');
  assert.match(conf.prompt, /Criação sem relato é afirmação sobre a escada/);
  assert.match(conf.prompt, /Escada declarada em todas as iterações: \[\{"iteracao":1,"unidade":"U1","item":"fn"/);
  assert.ok(conf.opts.schema.required.includes('bloqueante'), 'sinal da auditoria: o confirmador julga fato e severidade');
});

// escada-revisao-3: natureza nos bloqueantes e resumo da escalada.
test('er3: escalada com validação verde e só relato de escada pendente diz isso no resumo, sem virar verde', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: { 'impl:': () => ({ status: 'concluida', resumo: 'ok', escada: [], arquivosTocados: ['src/a.js'] }) } });
  assert.equal(resultado.status, 'escalado');
  assert.deepEqual(resultado.resumoDaEscalada, { iteracao: 3, validacaoVerde: true, falhasDeValidacaoPorNatureza: {}, bloqueantesPorNatureza: { procedimento: 1 }, somenteProcedimento: true });
  assert.match(resultado.acao, /só de procedimento/);
  assert.match(resultado.acao, /Decisão do dono/);
  assert.match(resultado.acao, /não converte isto em verde/);
  assert.equal(resultado.historico[0].validacaoVerde, true);
});

test('er3: falha listada com verde declarado não vira "só procedimento"', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'impl:': () => ({ status: 'concluida', resumo: 'ok', escada: [], arquivosTocados: ['src/a.js'] }),
    'validar:': (o) => ({ ...DEFAULTS['validar:'](o), verde: true, falhas: [{ comando: 'npm test', resumo: 'falhou um caso', natureza: 'funcional' }] }),
  } });
  assert.equal(resultado.status, 'escalado');
  assert.equal(resultado.resumoDaEscalada.somenteProcedimento, false);
  assert.deepEqual(resultado.resumoDaEscalada.falhasDeValidacaoPorNatureza, { funcional: 1 });
  assert.match(resultado.acao, /diagnóstico pro humano/);
});

const DEP_SEM_JUSTIFICATIVA = { 'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), dependenciasNovas: [{ nome: 'left-pad', justificativaEncontrada: false, onde: 'package.json' }] }) };
for (const [natureza, overrides] of [
  ['funcional', { 'validar:': (o) => ({ ...DEFAULTS['validar:'](o), execucoes: [execucao('T1', false)] }) }],
  ['indeterminada', { 'validar:': (o) => ({ ...DEFAULTS['validar:'](o), execucoes: [execucao('T1', false, 'infra')] }) }],
  ['evidencia', { 'validar:': (o) => ({ ...DEFAULTS['validar:'](o), execucoes: [] }) }],
  ['integridade-dos-testes', { 'validar:': (o) => ({ ...DEFAULTS['validar:'](o), hashesDosTestes: { [TESTE]: HASH_B } }) }],
  ['dependencia', DEP_SEM_JUSTIFICATIVA],
  ['peso-de-diff', { 'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), abstracoesUsoUnico: [SINAL_EM_PRODUCAO] }), 'confirmar:': () => ({ real: true, bloqueante: true, porque: 'um chamador' }) }],
  // A lente que traz o próprio rótulo não o impõe: a natureza do finding de lente é do controlador.
  ['revisao', { 'rev:': () => ({ findings: [{ arquivo: 'src/a.js', linha: 2, resumo: 'erro engolido', cenario: 'catch vazio', severidade: 'bloqueante', confianca: 'confirmado', natureza: 'procedimento' }] }) }],
]) {
  test(`er3: bloqueante de natureza ${natureza} entra no resumo da escalada e nunca como só procedimento`, async () => {
    const { resultado } = await rodar({ args: ARGS, overrides });
    assert.equal(resultado.status, 'escalado', JSON.stringify(resultado));
    assert.deepEqual(resultado.resumoDaEscalada.bloqueantesPorNatureza, { [natureza]: 1 });
    assert.equal(resultado.resumoDaEscalada.somenteProcedimento, false);
  });
}

// escada-revisao-6: busca de chamadores na auditoria.
test('er6: a auditoria busca os chamadores antes de afirmar uso único, e o confirmador recebe a busca como alegação', async () => {
  const busca = 'git grep -n -w Wrapper: 1 resultado';
  const { chamadas } = await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), abstracoesUsoUnico: [{ ...SINAL_EM_PRODUCAO, buscaChamadores: busca }] }),
    'confirmar:': () => ({ real: false, bloqueante: false, porque: 'três chamadores' }),
  } });
  const aud = chamadas.find((c) => c.label === 'ponytail:i1');
  assert.match(aud.prompt, /busque TODOS os chamadores/);
  assert.match(aud.prompt, /buscaChamadores o comando e a contagem/);
  assert.match(aud.prompt, /Dois ou mais chamadores reais/);
  assert.equal(aud.opts.schema.properties.abstracoesUsoUnico.items.properties.buscaChamadores.type, 'string');
  assert.deepEqual(aud.opts.schema.properties.abstracoesUsoUnico.items.required, ['oQue', 'unicoChamador']);
  const conf = promptDe(chamadas, 'confirmar:i1');
  assert.match(conf, /alegação, não prova/);
  assert.ok(conf.includes(busca));
});

test('er6: a busca declarada acompanha a pendência em teste da SPEC, que não passa por confirmador', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), abstracoesUsoUnico: [{ arquivo: TESTE, oQue: 'montarFixture', unicoChamador: TESTE, buscaChamadores: 'git grep -n -w montarFixture: 1' }] }),
  } });
  assert.equal(resultado.status, 'verde');
  assert.ok(!chamadas.some((c) => c.label.startsWith('confirmar:')));
  assert.equal(resultado.ponytail.pendenciasEmTestesDaSpec[0].buscaChamadores, 'git grep -n -w montarFixture: 1');
});

test('er6: busca com texto diferente a cada iteração não paga novo confirmador para a mesma evidência', async () => {
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), abstracoesUsoUnico: [{ ...SINAL_EM_PRODUCAO, buscaChamadores: `git grep -n -w Wrapper (rodada ${vez})` }] }),
    'validar:': (o) => ({ ...DEFAULTS['validar:'](o), verde: vez++ > 0 }),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.iteracoes, 2);
  assert.equal(chamadas.filter((c) => c.label.startsWith('confirmar:')).length, 1);
});

// escada-revisao-7: afirmação mecânica da lente só com busca executada.
test('er7: a lente só afirma uso, chamadores ou impacto com a busca executada; sem ela, plausível', async () => {
  const { chamadas } = await rodar({ args: MAX });
  const lentes = chamadas.filter((c) => c.label.startsWith('rev:'));
  assert.equal(lentes.length, 3);
  for (const c of lentes) {
    assert.match(c.prompt, /só entra com a busca executada \(comando \+ resultado\) no cenário/);
    assert.match(c.prompt, /sem ela, marque plausivel/);
  }
});

// escada-revisao-8: confirmador de finding de lente reconta antes de bloquear.
test('er8: o confirmador de finding de lente refaz a busca de chamadores; o do sinal P2 continua sem a instrução', async () => {
  const { chamadas } = await rodar({ args: ARGS, overrides: {
    'rev:': () => ({ findings: [{ arquivo: 'src/a.js', linha: 10, resumo: 'formatar() não tem outro chamador', cenario: 'só render() chama formatar()', severidade: 'bloqueante', confianca: 'plausivel' }] }),
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), duplicacoes: [{ arquivo: 'src/b.js', linha: 3, oQue: 'soma', ondeJaExiste: 'src/base.js' }] }),
    'confirmar:': () => ({ real: false, bloqueante: false, porque: 'não reproduz' }),
  } });
  const prompts = chamadas.filter((c) => c.label.startsWith('confirmar:')).map((c) => c.prompt);
  const lente = prompts.find((p) => p.includes('formatar()'));
  const p2 = prompts.find((p) => p.includes('P2:'));
  assert.match(lente, /refaça a busca no workspace/);
  assert.match(lente, /git grep -n -w/);
  assert.match(lente, /resultado que não bate → real=false/);
  assert.ok(!/chamador/i.test(p2), 'o sinal P2 segue a decisão do C2');
});

// args-relatorio-7: revisão de contratos do controlador.
test('ar7: o harness registra a revisão de contratos 2026-11-02-r8 antes de qualquer agente', async () => {
  const { logs, chamadas } = await rodar({ args: '{nao é json' });
  assert.equal(logs[0], 'odin-dev-loop: revisão de contratos 2026-11-02-r8');
  assert.equal(chamadas.length, 0);
});

// decisao-13, furo 1: finding de lente não forja campo do controlador. `origem` decide quem ganha a
// pergunta de severidade (e com ela o "real, não bloqueante" que vira pendência); `sinal` e
// `buscaChamadores` montam o prompt do confirmador. A severidade do finding de lente é da lente.
const LENTE_C1 = { arquivo: 'src/a.js', linha: 7, resumo: 'critério C1 não atendido', cenario: 'entrada vazia devolve 0', severidade: 'bloqueante', confianca: 'plausivel' };
const TEXTOS_DO_CONTROLADOR = ['sinal MECÂNICO da auditoria ponytail', 'Uso único é afirmação sobre CHAMADORES', 'Busca declarada pela auditoria', 'Criação sem relato é afirmação sobre a escada'];
for (const [nome, forjado] of [
  ['origem da auditoria', { ...LENTE_C1, origem: 'auditoria-ponytail' }],
  ['origem e sinal P11 com busca', { ...LENTE_C1, origem: 'auditoria-ponytail', sinal: 'P11', buscaChamadores: 'git grep -n -w formatar: 1 resultado' }],
  ['sinal P1-P7 sem origem', { ...LENTE_C1, sinal: 'P1-P7' }],
]) {
  test(`d13: finding de lente com ${nome} forjado continua bloqueante e o confirmador não recebe a pergunta da auditoria`, async () => {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
      'rev:': () => ({ findings: [forjado] }),
      'confirmar:': () => ({ real: true, bloqueante: false, porque: 'existe; eu não bloquearia' }),
    } });
    assert.equal(resultado.status, 'escalado', JSON.stringify(resultado));
    const confirmadores = chamadas.filter((c) => c.label.startsWith('confirmar:'));
    assert.equal(confirmadores.length, 3);
    for (const c of confirmadores) {
      for (const texto of TEXTOS_DO_CONTROLADOR) assert.ok(!c.prompt.includes(texto), `o prompt do confirmador de lente não traz "${texto}"`);
      assert.ok(!Object.hasOwn(c.opts.schema.properties, 'bloqueante'), 'o schema do confirmador de lente não oferece o campo de severidade');
    }
    assert.deepEqual(resultado.ponytail.duplicacoesEAbstracoes, [], 'finding de lente não entra no registro de vereditos da auditoria');
    const f = resultado.historico[0].findings.find((x) => x.resumo === LENTE_C1.resumo);
    assert.ok(f, 'o finding de lente fica entre os bloqueantes da iteração');
    assert.equal(f.origem, 'lente', 'a origem do finding de lente é fixada pelo controlador');
    assert.equal(f.sinal, undefined);
    assert.equal(f.buscaChamadores, undefined);
    assert.equal(f.natureza, 'revisao');
  });
}

test('d13: controle: na mesma iteração o sinal plausível da auditoria ganha a pergunta de severidade e o forjado da lente não', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), abstracoesUsoUnico: [SINAL_EM_PRODUCAO] }),
    'rev:': () => ({ findings: [{ ...LENTE_C1, origem: 'auditoria-ponytail', sinal: 'P11' }] }),
    'confirmar:': () => ({ real: true, bloqueante: false, porque: 'existe; eu não bloquearia' }),
  } });
  assert.equal(resultado.status, 'escalado', JSON.stringify(resultado));
  const confirmadores = chamadas.filter((c) => c.label.startsWith('confirmar:'));
  const daAuditoria = confirmadores.filter((c) => c.prompt.includes('P11: abstração de uso único'));
  const daLente = confirmadores.filter((c) => c.prompt.includes(LENTE_C1.resumo));
  assert.equal(daAuditoria.length, 1, 'o veredito do sinal é reaproveitado nas iterações seguintes');
  assert.equal(daLente.length, 3);
  assert.match(daAuditoria[0].prompt, /sinal MECÂNICO da auditoria ponytail/);
  assert.match(daAuditoria[0].prompt, /Uso único é afirmação sobre CHAMADORES/);
  assert.deepEqual(daAuditoria[0].opts.schema.required, ['real', 'bloqueante']);
  assert.ok(daLente.every((c) => !c.prompt.includes('sinal MECÂNICO') && !Object.hasOwn(c.opts.schema.properties, 'bloqueante')));
  assert.equal(resultado.ponytail.duplicacoesEAbstracoes.length, 1);
  assert.equal(resultado.ponytail.duplicacoesEAbstracoes[0].severidade, 'nao-bloqueante');
  assert.ok(resultado.historico.every((h) => h.findings.some((x) => x.resumo === LENTE_C1.resumo)));
  assert.ok(resultado.historico.every((h) => !h.findings.some((x) => x.resumo.startsWith('P11:'))));
});

// decisao-13, furo 2: validação que declara verde=true e lista falha. O controlador normaliza uma
// vez (verde só com verde=true E nenhuma falha listada) e usa esse valor em todo lugar: saída por
// ambiente, histórico, resumo da escalada e fechamento verde. A incoerência fica registrada.
const FALHA_FUNCIONAL = { comando: 'npm test', resumo: 'soma errada em 2 + 2', natureza: 'funcional' };

test('d13: validação com verde=true e falha funcional listada não fecha verde: escala no teto com validacaoVerde false', async () => {
  const { resultado, chamadas, logs } = await rodar({ args: ARGS, overrides: {
    'validar:': (o) => ({ ...DEFAULTS['validar:'](o), verde: true, falhas: [FALHA_FUNCIONAL] }),
  } });
  assert.equal(resultado.status, 'escalado', JSON.stringify(resultado));
  assert.equal(resultado.validacaoFinal, undefined, 'nenhuma validação reutilizável sai de um run que não fechou');
  assert.equal(resultado.resumoDaEscalada.validacaoVerde, false);
  assert.equal(resultado.resumoDaEscalada.somenteProcedimento, false);
  assert.deepEqual(resultado.resumoDaEscalada.falhasDeValidacaoPorNatureza, { funcional: 1 });
  assert.deepEqual(resultado.historico.map((h) => h.validacaoVerde), [false, false, false]);
  assert.deepEqual(resultado.historico.map((h) => h.verdeDeclaradoComFalhas), [true, true, true], 'a incoerência fica no histórico');
  assert.ok(resultado.historico.every((h) => h.findings.length === 0), 'só a falha listada segura o run: nenhum motivo de bloqueio inventado');
  assert.equal(logs.filter((m) => /declarou verde=true e listou 1 falha/.test(m)).length, 3, 'a incoerência aparece no log de cada iteração');
  const impl2 = promptDe(chamadas, 'impl:U1', 1);
  assert.match(impl2, /"validacaoVerde":false/);
  assert.match(impl2, /soma errada em 2 \+ 2/, 'a falha listada volta como correção para o operário');
});

test('d13: verde=true com falha listada na 1 e validação limpa na 2 fecha verde só na 2', async () => {
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'validar:': (o) => vez++ === 0 ? { ...DEFAULTS['validar:'](o), verde: true, falhas: [FALHA_FUNCIONAL] } : DEFAULTS['validar:'](o),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.iteracoes, 2);
  assert.equal(chamadas.filter((c) => c.label.startsWith('impl:')).length, 2);
  assert.match(promptDe(chamadas, 'impl:U1', 1), /soma errada em 2 \+ 2/);
});

test('d13: verde=true com todas as falhas de ambiente cai na saída por ambiente, como verde=false', async () => {
  const comVerde = await rodar({ args: { ...ARGS, validacoes: ['uv run pytest'] }, overrides: { 'validar:': validarAmbiente({ verde: true }) } });
  const semVerde = await rodar({ args: { ...ARGS, validacoes: ['uv run pytest'] }, overrides: { 'validar:': validarAmbiente() } });
  for (const { resultado, chamadas } of [comVerde, semVerde]) {
    assert.equal(resultado.status, 'erro', JSON.stringify(resultado));
    assert.equal(resultado.fase, 'Validar');
    assert.equal(resultado.motivo, 'ambiente');
    assert.equal(resultado.iteracao, 1);
    assert.equal(resultado.detalhe[0].evidencia, EPERM.evidencia);
    assert.ok(!chamadas.some((c) => c.label.startsWith('ponytail:') || c.label.startsWith('rev:')), 'parada antes da auditoria e das lentes');
  }
  assert.equal(comVerde.resultado.verdeDeclaradoComFalhas, true, 'a saída por ambiente registra a incoerência');
  assert.equal(comVerde.resultado.historico.at(-1).verdeDeclaradoComFalhas, true);
  assert.equal(semVerde.resultado.historico.at(-1).verdeDeclaradoComFalhas, undefined);
  assert.deepEqual(comVerde.resultado.historico.at(-1).validacoes, comVerde.resultado.detalhe);
  assert.equal(comVerde.resultado.historico.at(-1).validacaoVerde, false);
  assert.equal(semVerde.resultado.verdeDeclaradoComFalhas, undefined);
  assert.ok(comVerde.logs.some((m) => /declarou verde=true e listou 1 falha/.test(m)));
});

test('d13: controle: verde=true sem falha listada continua fechando verde na iteração 1, sem registro de incoerência', async () => {
  const { resultado, logs } = await rodar({ args: ARGS });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.iteracoes, 1);
  assert.equal(resultado.validacaoFinal.verde, true);
  assert.ok(!logs.some((m) => /declarou verde=true e listou/.test(m)));
});

test('pendenciasPath em área de unidade não reaproveita verde para módulo novo alterado', async t => {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), 'odin-pend-nova-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  const run = (exe, argv) => spawnSync(exe, argv, { cwd: root, env, encoding: 'utf8' });
  const git = (...argv) => { const r = run('git', argv); assert.equal(r.status, 0, r.stderr); };
  git('init', '-q'); mkdirSync(resolve(root, 'src')); mkdirSync(resolve(root, 'docs/plans'), { recursive: true });
  writeFileSync(resolve(root, 'docs/plans/spec.md'), 'spec fixture\n');
  writeFileSync(resolve(root, 'check.cjs'), "require('node:assert').equal(require('./src/new.cjs'), 1)\n");
  git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'base');
  const scriptsDir = resolve(HARNESS, '../../scripts');
  const fp = () => {
    const r = run(process.execPath, [resolve(scriptsDir, 'hashes-testes.mjs'), '--impressao', '["docs/plans/spec.md"]', '["src/new.cjs"]']);
    assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout).impressao;
  };
  writeFileSync(resolve(root, 'src/new.cjs'), 'module.exports=1;\n');
  const anterior = fp(); assert.equal(run(process.execPath, ['check.cjs']).status, 0);
  writeFileSync(resolve(root, 'src/new.cjs'), 'module.exports=2;\n');
  assert.equal(fp(), anterior, 'a lista explícita continua excluindo o arquivo; o controlador precisa recusar o reuso ambíguo');
  assert.notEqual(run(process.execPath, ['check.cjs']).status, 0);
  let executouSuite = 0;
  const { resultado, chamadas } = await rodar({ args: { ...ARGS, workspaceRoot: root, scriptsDir, pendenciasPath: 'src/new.cjs', validacoes: ['node check.cjs'], rebaselineTdd: { ...REB, validacaoAnterior: { impressao: anterior, comandos: ['node check.cjs'], verde: true } } }, overrides: {
    'spec:validar': () => ({ ...DEFAULTS['spec:validar'](), unidades: [{ id: 'U1', titulo: 'src', arquivos: 'src/', criterios: ['C1'] }] }),
    'impressao:': () => ({ impressao: fp() }),
    'validar:': (o, _c, prompt) => {
      const deveRodar = prompt.includes('as validações do projeto: node check.cjs');
      const falhou = deveRodar && run(process.execPath, ['check.cjs']).status !== 0;
      if (deveRodar) executouSuite++;
      return { ...DEFAULTS['validar:'](o), verde: !falhou, falhas: falhou ? [{ comando: 'node check.cjs', resumo: 'AssertionError', tipo: 'codigo' }] : [], impressaoWorktree: fp() };
    },
  } });
  assert.ok(executouSuite > 0);
  assert.notEqual(resultado.status, 'verde');
  assert.deepEqual(resultado.validacoesReaproveitadas, []);
  assert.ok(!chamadas.some(c => c.label.startsWith('impressao:')), 'não tenta provar reuso com exclusão ambígua');
});

test('pendência nova sob diretório de unidade conta como implementação anterior', async () => {
  const pendenciasPath = 'src/new.js';
  const { resultado } = await rodar({ args: { ...ARGS, pendenciasPath }, overrides: {
    'spec:validar': () => ({ ...DEFAULTS['spec:validar'](), unidades: [{ id: 'U1', titulo: 'src', arquivos: 'src/', criterios: ['C1'] }] }),
    ...VERDE_COM(ALTERADO([TESTE, pendenciasPath], { adicionados: [TESTE, pendenciasPath] })),
  } });
  assert.equal(resultado.motivo, 'implementacao-preexistente');
  assert.deepEqual(resultado.tdd.implementacaoPreexistente.arquivos, [pendenciasPath]);
});


test('parada por ambiente preserva histórico anterior e acrescenta a iteração incoerente uma vez', async () => {
  let vez = 0;
  const { resultado } = await rodar({ args: { ...ARGS, validacoes: ['uv run pytest'] }, overrides: {
    'validar:': o => vez++ === 0 ? { ...DEFAULTS['validar:'](o), verde: false, falhas: [FALHA_FUNCIONAL] } : validarAmbiente({ verde: true })(o),
  } });
  assert.equal(resultado.motivo, 'ambiente');
  assert.deepEqual(resultado.historico.map(h => h.iteracao), [1, 2]);
  assert.equal(resultado.historico[0].validacoes[0].resumo, FALHA_FUNCIONAL.resumo);
  assert.equal(resultado.historico[1].verdeDeclaradoComFalhas, true);
  assert.equal(resultado.historico[1].validacaoVerde, false);
  assert.deepEqual(resultado.historico[1].findings, []);
});

// ── Caminhos relatados por agente (odin 3.0.2) ───────────────────────────────
// Run wf_9dd8d7f9-e7d (munin, onda 3.2-B, 2026-11-13): os operários relataram arquivosTocados com
// o caminho absoluto da worktree. O harness juntou esses caminhos crus ao inventário de qualidade,
// o `inspecionar-git.mjs quality` recusou ("path de qualidade inválido") e o run terminou em
// `erro` na fase Validar antes de a falha funcional voltar ao operário. A regra: todo caminho
// relatado por agente vira relativo à raiz do workspace antes de ser usado; fora dela é recusado
// com diagnóstico próprio, nunca com erro genérico.
const comandoQuality = prompt => prompt.split('\n').find(l => l.includes('inspecionar-git.mjs') && l.includes(' quality '));
const comandoDiff = prompt => prompt.split('\n').find(l => l.includes('inspecionar-git.mjs') && l.includes(' diff '));

test('arquivosTocados absoluto dentro do workspace vira relativo e a falha funcional volta ao operário', async () => {
  let vez = 0;
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'impl:': () => ({ ...DEFAULTS['impl:'](), arquivosTocados: ['/workspace/src/a.js', '/workspace/./src/b.js'] }),
    'validar:': o => vez++ === 0
      ? { ...DEFAULTS['validar:'](o), verde: false, falhas: [FALHA_FUNCIONAL], execucoes: idsDoSchema(o).map(t => execucao(t, false)) }
      : DEFAULTS['validar:'](o),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado.detalhe));
  assert.equal(resultado.iteracoes, 2, 'a falha funcional da 1ª iteração virou correção, não erro');
  assert.equal(chamadas.filter(c => c.label.startsWith('impl:')).length, 2);
  const validar = chamadas.find(c => c.label === 'validar:i1');
  assert.ok(comandoQuality(validar.prompt).includes(JSON.stringify(['src/a.js', 'src/b.js', TESTE, 'docs/plans/spec.md'])), comandoQuality(validar.prompt));
  assert.ok(!comandoQuality(validar.prompt).includes('/workspace/src'), 'o inventário só recebe caminho relativo');
  const auditoria = chamadas.find(c => c.label === 'ponytail:i1');
  assert.ok(!comandoDiff(auditoria.prompt).includes('/workspace/src'), 'o diff dos revisores só recebe caminho relativo');
  assert.ok(chamadas.find(c => c.label === 'impl:U1').prompt.includes('relativo à raiz do workspace'), 'o pedido ao operário exige caminho relativo');
});

test('arquivosTocados fora do workspace bloqueia na implementação com diagnóstico, antes da validação', async () => {
  for (const fora of ['/outro/checkout/src/a.js', '../vizinho/a.js', 'C:\\temp\\a.js']) {
    const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
      'impl:': () => ({ ...DEFAULTS['impl:'](), arquivosTocados: ['src/a.js', fora] }),
    } });
    assert.equal(resultado.status, 'bloqueado', fora);
    assert.equal(resultado.fase, 'Implementar');
    assert.equal(resultado.motivo, 'arquivos-fora-do-workspace');
    assert.deepEqual(resultado.arquivosForaDoWorkspace, [{ unidade: 'U1', path: fora }]);
    assert.match(resultado.acao, /fora da worktree/);
    assert.ok(!chamadas.some(c => c.label.startsWith('validar:')), 'não gasta validação com relato inválido');
  }
});

test('apoio do portão fora do workspace bloqueia o TDD com diagnóstico em vez de sumir', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1')], apoio: ['/outro/tests/helpers/f.js'] }),
  } });
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'TDD');
  assert.match(resultado.detalhe, /apoio fora do workspace.*\/outro\/tests\/helpers\/f\.js/);
  assert.ok(!chamadas.some(c => c.label.startsWith('impl:')));
});

test('apoio do portão absoluto dentro do workspace vira relativo', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1')], apoio: ['/workspace/tests/helpers/f.js'] }),
    ...VERDE_COM(ALTERADO([TESTE, 'tests/helpers/f.js'], { adicionados: [TESTE, 'tests/helpers/f.js'] })),
  } });
  assert.deepEqual(resultado.tdd.apoio, ['tests/helpers/f.js']);
});

test('evidência de qualityReview com caminho absoluto dentro do workspace conta como o arquivo relativo', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), qualityReview: LEGACY_REVIEW.map(r => ({ ...r, evidence: r.evidence.map(e => ({ ...e, path: `/workspace/${e.path}` })) })) }),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado.detalhe));
});

test('evidência de qualityReview fora do workspace é recusada nomeando o caminho', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), qualityReview: LEGACY_REVIEW.map(r => ({ ...r, evidence: r.evidence.map(e => ({ ...e, path: '/outro/src/a.js' })) })) }),
  } });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.fase, 'Auditar');
  assert.match(String(resultado.detalhe), /fora do workspace.*\/outro\/src\/a\.js/);
});

test('inventário de qualidade com erro nomeia o erro do script e os caminhos omitidos', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'validar:': o => ({ ...DEFAULTS['validar:'](o), qualityInventory: { files: [], uninspected: ['src/a.js'], errors: ['src/a.js: arquivo ausente ou ignorado: src/a.js'] } }),
  } });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.fase, 'Validar');
  assert.match(resultado.detalhe.join(' '), /arquivo ausente ou ignorado: src\/a\.js/);
});

// ── Relato de arquivos que não fecha com a worktree (odin 3.0.2, item 4) ─────
// Arquivo relatado que não existe (ou é ignorado) e arquivo novo que o operário criou sem relatar
// terminavam em `erro` no inventário de qualidade. Retomar o run devolve o mesmo relato do cache,
// então o erro era terminal. Agora viram correção ao operário, dentro do teto de iterações.
const linhaInventario = path => ({ path, lines: 12, bytes: 240, status: 'text' });
const INVENTARIO_OK = ['src/a.js', TESTE, 'docs/plans/spec.md'];

test('arquivo relatado que não existe vira correção ao operário e sai do inventário seguinte', async () => {
  let vezImpl = 0, vezVal = 0;
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'impl:': () => ({ ...DEFAULTS['impl:'](), arquivosTocados: vezImpl++ === 0 ? ['src/a.js', 'src/fantasma.js'] : ['src/a.js'] }),
    'validar:': o => vezVal++ === 0
      ? { ...DEFAULTS['validar:'](o), qualityInventory: inventarioLiteral({ files: INVENTARIO_OK.map(linhaInventario), uninspected: ['src/fantasma.js'], errors: ['src/fantasma.js: arquivo ausente ou ignorado: src/fantasma.js'] }) }
      : DEFAULTS['validar:'](o),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado.detalhe));
  assert.equal(resultado.iteracoes, 2);
  assert.match(chamadas.find(c => c.label === 'impl:U1' && c.prompt.includes('CORREÇÕES')).prompt, /src\/fantasma\.js/);
  assert.ok(!comandoQuality(chamadas.find(c => c.label === 'validar:i2').prompt).includes('fantasma'), 'o relato corrigido não pede de novo o arquivo inexistente');
});

test('arquivo novo criado e não relatado vira correção ao operário em vez de erro', async () => {
  let vezImpl = 0, vezVal = 0;
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'impl:': () => ({ ...DEFAULTS['impl:'](), arquivosTocados: vezImpl++ === 0 ? ['src/a.js'] : ['src/a.js', 'src/novo.js'] }),
    'validar:': o => vezVal++ === 0
      ? { ...DEFAULTS['validar:'](o), qualityInventory: inventarioLiteral({ files: INVENTARIO_OK.map(linhaInventario), uninspected: ['src/novo.js'], errors: [] }) }
      : DEFAULTS['validar:'](o),
  } });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado.detalhe));
  assert.equal(resultado.iteracoes, 2);
  assert.match(chamadas.find(c => c.label === 'impl:U1' && c.prompt.includes('CORREÇÕES')).prompt, /src\/novo\.js/);
  assert.ok(comandoQuality(chamadas.find(c => c.label === 'validar:i2').prompt).includes('src/novo.js'));
});

test('relato que nunca fecha com a worktree escala no teto com natureza procedimento, sem erro', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'impl:': () => ({ ...DEFAULTS['impl:'](), arquivosTocados: ['src/a.js', 'src/fantasma.js'] }),
    'validar:': o => ({ ...DEFAULTS['validar:'](o), qualityInventory: inventarioLiteral({ files: INVENTARIO_OK.map(linhaInventario), uninspected: ['src/fantasma.js'], errors: ['src/fantasma.js: arquivo ausente ou ignorado: src/fantasma.js'] }) }),
  } });
  assert.equal(resultado.status, 'escalado', JSON.stringify(resultado.detalhe));
  assert.equal(resultado.fase, 'Loop');
  assert.deepEqual(resultado.resumoDaEscalada.bloqueantesPorNatureza, { procedimento: 1 });
  assert.equal(chamadas.filter(c => c.label.startsWith('impl:')).length, 3);
});

test('controle: erro do inventário que não vem do relato do operário continua erro com diagnóstico', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'validar:': o => ({ ...DEFAULTS['validar:'](o), qualityInventory: inventarioLiteral({ files: [], uninspected: [], errors: ['índice unmerged: src/a.js'] }) }),
  } });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.fase, 'Validar');
  assert.match(resultado.detalhe.join(' '), /índice unmerged: src\/a\.js/);
});

test('arquivo não relatado que reaparece depois da correção bloqueia como artefato, sem gastar o teto', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'validar:': o => ({ ...DEFAULTS['validar:'](o), qualityInventory: inventarioLiteral({ files: INVENTARIO_OK.map(linhaInventario), uninspected: ['.coverage'], errors: [] }) }),
  } });
  assert.equal(resultado.status, 'bloqueado', JSON.stringify(resultado.detalhe));
  assert.equal(resultado.fase, 'Validar');
  assert.equal(resultado.motivo, 'artefato-nao-rastreado');
  assert.deepEqual(resultado.artefatos, ['.coverage']);
  assert.match(resultado.acao, /\.gitignore/);
  assert.equal(chamadas.filter(c => c.label.startsWith('impl:')).length, 2, 'uma correção, depois bloqueio');
});

test('a correção de arquivo não relatado nunca manda apagar arquivo que o operário não criou', async () => {
  let vezVal = 0;
  const { chamadas } = await rodar({ args: ARGS, overrides: {
    'validar:': o => vezVal++ === 0
      ? { ...DEFAULTS['validar:'](o), qualityInventory: inventarioLiteral({ files: INVENTARIO_OK.map(linhaInventario), uninspected: ['notas.md'], errors: [] }) }
      : DEFAULTS['validar:'](o),
  } });
  const correcao = chamadas.find(c => c.label === 'impl:U1' && c.prompt.includes('CORREÇÕES')).prompt;
  assert.match(correcao, /não apague/i);
  assert.doesNotMatch(correcao, /apague-o/);
});
