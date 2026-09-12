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
const DEFAULTS = {
  'spec:ids': () => ({ok:true,ids:['C1'],erros:[],verificacoesComplementares:{}}),
  'spec:validar': () => ({
    ok: true, pendenciasBloqueadoras: [], validacoesDaSpec: ['npm test'],
    criterios: [{ id: 'C1', texto: 'faz X' }],
    unidades: [{ id: 'U1', titulo: 'unidade 1', arquivos: 'src/a.js', criterios: ['C1'] }],
  }),
  'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [{ criterio: 'C1', path: TESTE, motivoFalha: 'falta implementação' }] }),
  'tdd:vermelho': () => ({ exitZero: false, falhaEsperada: true, hashesDosTestes: { [TESTE]: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } }),
  'impl:': () => ({ status: 'concluida', resumo: 'ok', escada: [{ item: 'fn', degrau: 7, porque: 'nada reusável' }], arquivosTocados: ['src/a.js'] }),
  'consulta:': () => ({ decisao: 'use A', porque: 'mais simples' }),
  'validar:': () => ({ verde: true, falhas: [], hashesDosTestes: { [TESTE]: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } }),
  'ponytail:': () => ({ dependenciasNovas: [], duplicacoes: [], abstracoesUsoUnico: [], forasDeEscopo: [], linhasAdicionadasAcumuladas: 12 }),
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
  let ativos = 0;
  let maxAtivos = 0;
  const agent = async (prompt, opts) => {
    chamadas.push({ label: opts.label, opts });
    const fn = responder(opts.label, overrides);
    if (!fn) throw new Error(`label sem resposta no teste: ${opts.label}`);
    ativos++; maxAtivos = Math.max(maxAtivos, ativos);
    if (atraso) await new Promise((r) => setTimeout(r, atraso));
    ativos--;
    return fn(opts, chamadas, prompt);
  };
  const parallel = async (thunks) => Promise.all(thunks.map((t) => Promise.resolve().then(t).catch(() => null)));
  const fn = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', corpoDoScript(FONTE));
  const resultado = await fn(args, agent, parallel, () => {}, () => {});
  return { resultado, chamadas, maxAtivos };
}

const ARGS = { workspaceRoot: '/workspace', scriptsDir: '/plugin/scripts', specPath: 'docs/plans/spec.md', branch: 'feat/x', perfil: 'economico', validacoes: ['npm test'], hoje: '2026-09-02' };
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
      'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [{ criterio: 'C1', path, motivoFalha: 'falta implementação' }] }),
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
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'tdd:vermelho': () => ({ exitZero: true, falhaEsperada: false, hashesDosTestes: { [TESTE]: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } }) } });
  assert.ok(chamadas.some((c) => c.label === 'tdd:vermelho'), 'o harness despacha uma execução independente dos testes da SPEC');
  assert.equal(resultado.status, 'bloqueado');
  assert.equal(resultado.fase, 'TDD');
  assert.match(resultado.detalhe, /passaram/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')), 'nada implementa com o vermelho não confirmado');
});

test('erro de sintaxe/import/infra no vermelho independente aborta antes da implementação', async () => {
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: {
    'tdd:vermelho': () => ({ exitZero: false, falhaEsperada: false, resumo: 'Cannot find module', hashesDosTestes: { [TESTE]: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } }),
  } });
  assert.equal(resultado.status, 'erro');
  assert.equal(resultado.fase, 'TDD');
  assert.match(resultado.detalhe, /Cannot find module/);
  assert.ok(!chamadas.some((c) => c.label.startsWith('impl:')));
});

test('verificação manual explícita não vira alegação de critério verificado', async () => {
  const { resultado } = await rodar({ args: ARGS, overrides: {
    'spec:ids': () => ({ok:true,ids:['C1','C2'],erros:[],verificacoesComplementares:{C2:'inspecionar a tela no Claude'}}),
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
  const { resultado, chamadas } = await rodar({ args: ARGS, overrides: { 'validar:': () => ({ verde: true, falhas: [], hashesDosTestes: { [TESTE]: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } }) } });
  assert.equal(resultado.status, 'escalado');
  const findings = resultado.historico.flatMap((h) => h.findings);
  assert.ok(findings.some((f) => /alterad/i.test(f.resumo) && f.arquivo.includes(TESTE)), `esperava finding de teste alterado, veio ${JSON.stringify(findings)}`);
  assert.ok(!chamadas.some((c) => c.label.startsWith('confirmar:')), 'bloqueante automático não passa pelo confirmador');
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

test('caminho verde: uma iteração, relatório com modelo efetivo por step e testes intactos', async () => {
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
      'tdd:vermelho': () => ({exitZero:false, falhaEsperada:true, hashesDosTestes:{[chave]:'a'.repeat(64)}}),
      'validar:': () => ({verde:true, falhas:[], hashesDosTestes:{[TESTE]:'a'.repeat(64)}}),
    }});
    assert.equal(resultado.status,'verde',JSON.stringify(resultado));
  });
}
test('dois hashes conflitantes para o mesmo arquivo reprovam como erro de evidência', async () => {
 const {resultado}=await rodar({args:ARGS,overrides:{'tdd:vermelho':()=>({exitZero:false,falhaEsperada:true,hashesDosTestes:{[TESTE]:'a'.repeat(64),['/workspace/'+TESTE]:'b'.repeat(64)}})}});
 assert.equal(resultado.status,'erro'); assert.equal(resultado.fase,'TDD');
});
test('arquivo externo com mesmo sufixo não equivale ao teste do workspace', async () => {
 const {resultado}=await rodar({args:ARGS,overrides:{'validar:':()=>({verde:true,hashesDosTestes:{['/outro/'+TESTE]:'a'.repeat(64)}})}});
 assert.notEqual(resultado.status,'verde');
});

test('SPEC original duplicada bloqueia antes do agente que poderia reinterpretá-la',async()=>{
 const {resultado,chamadas}=await rodar({args:ARGS,overrides:{'spec:ids':()=>({ok:false,ids:['C1','C1'],erros:['ID repetido: C1']})}});
 assert.equal(resultado.status,'bloqueado');assert.equal(resultado.fase,'Spec');
 assert.ok(!chamadas.some(c=>c.label==='spec:validar'));
});
test('agente que troca identidade de critério original bloqueia antes do TDD',async()=>{
 const {resultado}=await rodar({args:ARGS,overrides:{'spec:ids':()=>({ok:true,ids:['A1'],erros:[],verificacoesComplementares:{}})}});
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
   'spec:ids':()=>({ok:true,ids:['C1'],erros:[],verificacoesComplementares:manual?{C1:'revisar contraste'}:{}}),
   'spec:validar':()=>({...DEFAULTS['spec:validar'](),criterios:[{id:'C1',texto:'faz X',verificacaoComplementar:manual?'':'soma.test.js a escrever'}]}),
  }});
  assert.equal(resultado.status,manual?'bloqueado':'verde',JSON.stringify(resultado));
  if(manual) assert.equal(resultado.fase,'VerificacaoManual');
 }
});

test('ID constructor não herda uma verificação manual do protótipo',async()=>{
 const {resultado}=await rodar({args:ARGS,overrides:{
  'spec:ids':()=>({ok:true,ids:['constructor'],erros:[],verificacoesComplementares:{}}),
  'spec:validar':()=>({...DEFAULTS['spec:validar'](),criterios:[{id:'constructor',texto:'faz X'}],unidades:[{id:'U1',titulo:'unidade',arquivos:'src/a.js',criterios:['constructor']}]}),
  'tdd:portao':()=>({vermelhoConfirmado:true,testes:[{criterio:'constructor',path:TESTE,motivoFalha:'falta implementação'}]}),
 }});
 assert.equal(resultado.status,'verde',JSON.stringify(resultado));
});

for (const path of ['tests/./a.test.js', 'tests//a.test.js']) {
  test(`path do TDD usa a mesma identidade do helper: ${path}`, async () => {
    const { resultado } = await rodar({ args: ARGS, overrides: {
      'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [{ criterio: 'C1', path, motivoFalha: 'falta implementação' }] }),
    } });
    assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  });
}

test('comandos transportados executam os helpers reais com espaços e aspas no caminho', async t => {
  const root = realpathSync(mkdtempSync(resolve(tmpdir(), "odin comando ' ")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const specPath = "spec ' teste.md";
  const path = "teste ' soma.js";
  writeFileSync(resolve(root, specPath), '# SPEC\n## Critérios de aceite\n| # | Critério | Teste |\n|---|---|---|\n| C1 | soma | teste |\n');
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
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [{ criterio: 'C1', path, motivoFalha: 'falta implementação' }] }),
    'tdd:vermelho': (_opts, _chamadas, prompt) => ({ exitZero: false, falhaEsperada: true, hashesDosTestes: executar(prompt) }),
    'validar:': (_opts, _chamadas, prompt) => ({ verde: true, falhas: [], hashesDosTestes: executar(prompt) }),
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
      'confirmar:': () => ({ real: true, porque: 'cenário reproduzido' }),
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
      'confirmar:': () => ({ real: true, porque: 'cenário reproduzido' }),
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
    'confirmar:': (opts, chamadas) => ({ real: chamadas.filter(c => c.label.startsWith('confirmar:')).length > 1, porque: 'cenário mudou' }),
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
