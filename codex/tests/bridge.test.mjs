import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { iniciar, proximo, responder } from '../runtime/bridge.mjs';
import { contract } from '../../plugins/odin/tests/support/quality-fixtures.mjs';
const ROOT = resolve(import.meta.dirname, '../plugins');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'codex-bridge-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, run: join(root, 'run') };
}
const ARGS = { specPath: 'spec.md', branch: 'test/fixture', perfil: 'economico', validacoes: ['npm test'], hoje: '2026-09-06' };
// O preflight do odin 2.6.0 devolve também o Tipo de cada critério (coluna Tipo da SPEC).
const specOK = { quality: contract(), ok: true, ids: ['C1'], erros: [], verificacoesComplementares: {}, tipos: { C1: 'reproducao' } };
function args(root) { return { ...ARGS, workspaceRoot: root, scriptsDir: resolve(ROOT, 'odin/shared/skills/dev-loop/scripts') }; }
test('SPEC duplicada encerra antes do julgamento e replay não pede trabalho já respondido', async t => {
  const f = fixture(t), plugin = join(ROOT, 'odin');
  const primeira = await iniciar(plugin, f.run, args(f.root));
  assert.equal(primeira.status, 'aguardando'); assert.equal(primeira.solicitacoes[0].label, 'spec:ids');
  const id = primeira.solicitacoes[0].id;
  const final = await responder(plugin, f.run, id, { resultado: { ...specOK, ok: false, ids: ['C1','C1'], erros: ['ID repetido: C1'] }, modeloEfetivo: 'teste-simulado' });
  assert.equal(final.status, 'concluido'); assert.equal(final.resultado.status, 'bloqueado'); assert.equal(final.resultado.fase, 'Spec');
  assert.deepEqual(await proximo(plugin, f.run), final);
  await assert.rejects(() => responder(plugin, f.run, id, { resultado: specOK }), /pendente/);
});
test('schema inválido e ID desconhecido não alteram estado persistido', async t => {
  const f = fixture(t), plugin = join(ROOT, 'odin');
  const state = await iniciar(plugin, f.run, args(f.root));
  const antes = readFileSync(join(f.run, 'state.json'), 'utf8');
  await assert.rejects(() => responder(plugin, f.run, state.solicitacoes[0].id, { resultado: { ok: 'sim' } }), /schema/);
  await assert.rejects(() => responder(plugin, f.run, 'id-inexistente', { resultado: specOK }), /pendente/);
  assert.equal(readFileSync(join(f.run, 'state.json'), 'utf8'), antes);
});
test('resposta funcional leva ao TDD; modelo final não é inventado como Claude', async t => {
  const f = fixture(t), plugin = join(ROOT, 'odin');
  let state = await iniciar(plugin, f.run, args(f.root));
  state = await responder(plugin, f.run, state.solicitacoes[0].id, { resultado: specOK });
  assert.equal(state.solicitacoes[0].label, 'spec:validar');
  state = await responder(plugin, f.run, state.solicitacoes[0].id, { resultado: { ok: true, criterios: [{ id: 'C1', texto: 'soma' }], unidades: [{ id: 'U1', titulo: 'soma', arquivos: 'soma.js', criterios: ['C1'] }], pendenciasBloqueadoras: [] } });
  assert.equal(state.solicitacoes[0].label, 'tdd:portao');
  state = await responder(plugin, f.run, state.solicitacoes[0].id, { resultado: { vermelhoConfirmado: false, testes: [], problemas: ['teste nasceu verde'] } });
  assert.equal(state.resultado.fase, 'TDD');
  assert.equal(state.resultado.modelos.runtime, 'codex');
  assert.ok(!JSON.stringify(state.resultado.modelos).match(/sonnet|opus|haiku|fable/));
});
test('Mimyr mantém veto a curso sem aprovação antes de escrever', async t => {
  const f = fixture(t), plugin = join(ROOT, 'mimyr');
  let state = await iniciar(plugin, f.run, { cursoDir: './course', estruturaPath: './estrutura.md', perfil: 'economico', scriptsDir: './scripts', python: 'python3' });
  state = await responder(plugin, f.run, state.solicitacoes[0].id, { resultado: { ok: true, aprovada: false, capitulos: [], capitulosComArquivoExistente: [] } });
  assert.equal(state.resultado.status, 'bloqueado'); assert.equal(state.resultado.fase, 'Estrutura');
});
test('Hermes com argumentos ausentes não emite produção ou chamada paga', async t => {
  const f = fixture(t); const state = await iniciar(join(ROOT, 'hermes'), f.run, {});
  assert.equal(state.status, 'concluido'); assert.equal(state.resultado.status, 'erro');
});

function controladorSintetico(root, source) {
  const plugin = join(root, 'odin');
  mkdirSync(join(plugin, '.codex-plugin'), { recursive: true });
  mkdirSync(join(plugin, 'shared/skills/dev-loop/harness'), { recursive: true });
  mkdirSync(join(plugin, 'runtime'));
  writeFileSync(join(plugin, '.codex-plugin/plugin.json'), JSON.stringify({ name: 'odin' }));
  writeFileSync(join(plugin, 'shared/skills/dev-loop/harness/loop.mjs'), `export const meta = {\n}\n${source}`);
  return plugin;
}
test('responder ramos paralelos fora de ordem preserva IDs e respostas já aceitas', async t => {
  const f = fixture(t), plugin = controladorSintetico(f.root, `
    const out = await parallel(['A','B'].map(ramo => async () => {
      const a = await agent(ramo+'1', {label:ramo+'1',schema:{type:'string'}});
      const b = await agent(ramo+'2', {label:ramo+'2',schema:{type:'string'}});
      return [a,b];
    }));
    return {status:'validado',out};`);
  let state = await iniciar(plugin, f.run, {});
  const id = (label) => state.solicitacoes.find(x => x.label === label).id;
  state = await responder(plugin, f.run, id('B1'), { resultado: 'B1' });
  const b2 = id('B2');
  state = await responder(plugin, f.run, id('A1'), { resultado: 'A1' });
  assert.equal(id('B2'), b2);
  state = await responder(plugin, f.run, b2, { resultado: 'B2' });
  assert.deepEqual(state.solicitacoes.map(x => x.label), ['A2']);
  state = await responder(plugin, f.run, id('A2'), { resultado: 'A2' });
  assert.deepEqual(state.resultado.out, [['A1','A2'],['B1','B2']]);
  assert.deepEqual(await proximo(plugin, f.run), state);
});
test('falha operacional encerra o run sem entregar null ao fallback legado', async t => {
  const f = fixture(t), plugin = controladorSintetico(f.root, `
    const opts = {label:'mesmo-pedido',schema:{type:'boolean'}};
    const a = await agent('tentar', opts);
    return {status:'fim',out:a === null ? await agent('tentar', opts) : a};`);
  let state = await iniciar(plugin, f.run, {});
  const primeiro = state.solicitacoes[0].id;
  state = await responder(plugin, f.run, primeiro, { erro: 'indisponibilidade observada' });
  assert.equal(state.status, 'concluido');
  assert.equal(state.resultado.status, 'erro');
  assert.equal(state.solicitacoes, undefined);
  assert.equal(state.resultado.falhasOperacionais[0].id, primeiro);
  assert.equal(state.resultado.modelos.execucoes[0].erro, 'indisponibilidade observada');
  assert.deepEqual(await proximo(plugin, f.run), state);
  await assert.rejects(() => responder(plugin, f.run, primeiro, { resultado: true }), /pendente/);
});

test('falha operacional paralela preserva respostas e identifica trabalho interrompido sem presumir rollback', async t => {
  const f = fixture(t), plugin = controladorSintetico(f.root, `
    await agent('feito', {label:'feito',schema:{type:'string'}});
    const out = await parallel(['A','B'].map(label => async () => {
      try { return await agent(label, {label,schema:{type:'boolean'}}); }
      catch { return await agent('fallback', {label:'fallback',schema:{type:'boolean'}}); }
    })); return {status:'verde',out};`);
  let out = await iniciar(plugin, f.run, {});
  out = await responder(plugin, f.run, out.solicitacoes[0].id, { resultado: 'artefato já escrito' });
  const [a,b] = out.solicitacoes;
  out = await responder(plugin, f.run, a.id, { erro: 'retorno incerto' });
  assert.equal(out.resultado.status, 'erro');
  assert.deepEqual(out.resultado.solicitacoesInterrompidas.map(s => s.id), [b.id]);
  const saved = JSON.parse(readFileSync(join(f.run, 'state.json'))).respostas;
  assert.equal(Object.keys(saved).length, 2);
  assert.ok(Object.values(saved).some(r => r.resultado === 'artefato já escrito'));
  assert.deepEqual(await proximo(plugin, f.run), out);
  await assert.rejects(() => responder(plugin, f.run, b.id, { resultado: true }), /pendente/);
});

test('resultado negativo de conteúdo continua permitindo correção de domínio', async t => {
  const f = fixture(t), plugin = controladorSintetico(f.root, `
    let r = await agent('revisar', {schema:{type:'boolean'}});
    if (!r) r = await agent('corrigir achado', {schema:{type:'boolean'}});
    return {status:r ? 'verde' : 'escalado'};`);
  let out = await iniciar(plugin, f.run, {});
  out = await responder(plugin, f.run, out.solicitacoes[0].id, { resultado: false });
  assert.equal(out.solicitacoes[0].prompt, 'corrigir achado');
  out = await responder(plugin, f.run, out.solicitacoes[0].id, { resultado: true });
  assert.equal(out.resultado.status, 'verde');
});

function papelFixture(root) {
  const plugin = controladorSintetico(root, `
    const out = await agent('trabalho', {label:'trabalho',agentType:'odin:mecanico',model:'haiku',effort:'low',schema:{type:'boolean'}});
    return {status:'fim',out};`);
  mkdirSync(join(plugin, 'shared/agents'));
  writeFileSync(join(plugin, 'shared/agents/mecanico.md'), '# Papel de fixture\n');
  return plugin;
}
test('sem preferência Codex, modelo e effort legados não substituem a sessão', async t => {
  const f = fixture(t), plugin = papelFixture(f.root);
  let out = await iniciar(plugin, f.run, {});
  assert.equal(out.solicitacoes[0].modeloSolicitado, null);
  assert.equal(out.solicitacoes[0].effort, null);
  out = await responder(plugin, f.run, out.solicitacoes[0].id, { resultado: true });
  assert.equal(out.resultado.modelos.execucoes[0].modelo, 'não informado pelo executor');
});
test('preferência explícita por papel é emitida separada da identidade efetiva', async t => {
  const f = fixture(t), plugin = papelFixture(f.root);
  let out = await iniciar(plugin, f.run, { execucaoCodex: { papeis: { 'odin:mecanico': { modelo: 'gpt-5.6-luna', effort: 'medium' } } } });
  assert.equal(out.solicitacoes[0].modeloSolicitado, 'gpt-5.6-luna');
  assert.equal(out.solicitacoes[0].effort, 'medium');
  out = await responder(plugin, f.run, out.solicitacoes[0].id, { resultado: true, modeloEfetivo: 'executor-de-fixture' });
  assert.equal(out.resultado.modelos.execucoes[0].modelo, 'executor-de-fixture');
  assert.equal(out.resultado.modelos.execucoes[0].modeloSolicitado, 'gpt-5.6-luna');
});
test('configuração Codex inválida bloqueia antes de criar run', async t => {
  const f = fixture(t), plugin = papelFixture(f.root);
  const invalidos = [null, [], { errado: {} }, { papeis: [] }, { papeis: { 'odin:ausente': {} } },
    { papeis: { 'odin:mecanico': { modelo: 'opus' } } }, { papeis: { 'odin:mecanico': { modelo: ' ' } } },
    { papeis: { 'odin:mecanico': { effort: 'impossivel' } } }, { papeis: { 'odin:mecanico': { fallback: 'gpt-5.6-luna' } } }];
  for (const execucaoCodex of invalidos) {
    await assert.rejects(() => iniciar(plugin, f.run, { execucaoCodex }), /execucaoCodex/);
  }
  // Se alguma tentativa tivesse criado estado, esta abertura falharia com EEXIST.
  assert.equal((await iniciar(plugin, f.run, {})).status, 'aguardando');
});
test('run recusa código alterado e argumentos adulterados antes de emitir trabalho', async t => {
  const f = fixture(t), plugin = join(f.root, 'odin');
  cpSync(join(ROOT, 'odin'), plugin, { recursive: true });
  await iniciar(plugin, f.run, args(f.root));
  const source = join(plugin, 'shared/skills/dev-loop/harness/loop.mjs');
  const antes = readFileSync(source);
  writeFileSync(source, Buffer.concat([antes, Buffer.from('\n// mudou\n')]));
  await assert.rejects(() => proximo(plugin, f.run), /fonte do pacote mudou/);
  writeFileSync(source, antes);
  const state = JSON.parse(readFileSync(join(f.run, 'state.json')));
  state.args.perfil = 'maximo';
  writeFileSync(join(f.run, 'state.json'), JSON.stringify(state));
  await assert.rejects(() => proximo(plugin, f.run), /argumentos/);
});
test('ID de outro run não pode autorizar resposta mesmo com argumentos idênticos', async t => {
  const f = fixture(t), plugin = join(ROOT, 'odin');
  const a = await iniciar(plugin, f.run, args(f.root));
  const runB = join(f.root, 'run-b');
  const b = await iniciar(plugin, runB, args(f.root));
  assert.notEqual(a.solicitacoes[0].id, b.solicitacoes[0].id);
  await assert.rejects(() => responder(plugin, runB, a.solicitacoes[0].id, { resultado: specOK }), /pendente/);
});
test('CLI de pacote copiado executa via path temporário inclusive aliases do sistema', t => {
  const f = fixture(t), plugin = join(f.root, 'hermes');
  cpSync(join(ROOT, 'hermes'), plugin, { recursive: true });
  const input = join(f.root, 'args.json'); writeFileSync(input, '{}');
  const r = spawnSync(process.execPath, [join(plugin, 'runtime/bridge.mjs'), 'iniciar', f.run, input], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).status, 'concluido');
});

// Registro de 2026-10 (retomada do dev-loop no Codex): cache criado pelo ambiente dentro do
// pacote instalado recusava a retomada sem dizer qual arquivo, e diretório de estado sem escrita
// falhava com o código cru do sistema.
test('cache efêmero no pacote instalado não recusa retomada; arquivo real novo é nomeado na recusa', async t => {
  const f = fixture(t), plugin = join(f.root, 'odin');
  cpSync(join(ROOT, 'odin'), plugin, { recursive: true });
  const inicio = await iniciar(plugin, f.run, args(f.root));
  mkdirSync(join(plugin, 'shared/skills/dev-loop/scripts/__pycache__'));
  writeFileSync(join(plugin, 'shared/skills/dev-loop/scripts/__pycache__/x.cpython-313.pyc'), 'bytecode');
  writeFileSync(join(plugin, 'shared/.DS_Store'), 'finder');
  assert.deepEqual(await proximo(plugin, f.run), inicio, 'retomada íntegra apesar dos caches');
  writeFileSync(join(plugin, 'shared/skills/dev-loop/scripts/extra.mjs'), '// arquivo novo');
  writeFileSync(join(plugin, 'shared/skills/dev-loop/harness/loop.mjs'), readFileSync(join(plugin, 'shared/skills/dev-loop/harness/loop.mjs'), 'utf8') + '\n// mudou\n');
  await assert.rejects(() => proximo(plugin, f.run), e => /novos: shared\/skills\/dev-loop\/scripts\/extra\.mjs/.test(e.message) && /alterados: shared\/skills\/dev-loop\/harness\/loop\.mjs/.test(e.message) && /Nunca edite o fingerprint/.test(e.message) && /reinstalando a mesma versão/.test(e.message));
});
test('iniciar diagnostica diretório do run existente ou pai ausente sem criar nada', async t => {
  const f = fixture(t), plugin = join(ROOT, 'odin');
  await assert.rejects(() => iniciar(plugin, join(f.root, 'nao', 'existe', 'run'), args(f.root)), /diretório pai do run não existe: .*nao[\\/]existe/);
  mkdirSync(f.run);
  writeFileSync(join(f.run, 'state.json'), '{}');
  await assert.rejects(() => iniciar(plugin, f.run, args(f.root)), /já existe: .*use proximo/);
});

// Revisão adversarial do diff (BRIDGE-2..4): exclusão de efêmeros não desliga a guarda de
// symlink, run legado tem diagnóstico próprio e diretório sem estado não é tratado como run.
test('symlink com nome de cache efêmero continua recusado no pacote', async t => {
  const f = fixture(t), plugin = join(f.root, 'odin');
  cpSync(join(ROOT, 'odin'), plugin, { recursive: true });
  mkdirSync(join(f.root, 'fora'));
  symlinkSync(join(f.root, 'fora'), join(plugin, 'shared/skills/dev-loop/scripts/__pycache__'));
  await assert.rejects(() => iniciar(plugin, f.run, args(f.root)), /symlink não permitido/);
});
test('run criado antes do inventário de arquivos recebe diagnóstico de versão anterior, não ordem de apagar arquivo', async t => {
  const f = fixture(t), plugin = join(f.root, 'odin');
  cpSync(join(ROOT, 'odin'), plugin, { recursive: true });
  await iniciar(plugin, f.run, args(f.root));
  const state = JSON.parse(readFileSync(join(f.run, 'state.json'), 'utf8'));
  delete state.arquivos;
  writeFileSync(join(f.run, 'state.json'), JSON.stringify(state));
  writeFileSync(join(plugin, 'shared/skills/dev-loop/scripts/extra.mjs'), '// novo');
  await assert.rejects(() => proximo(plugin, f.run), e => /versão anterior do bridge/.test(e.message) && /remover arquivos não resolve/.test(e.message));
});
test('diretório existente sem state.json não é tratado como run a retomar', async t => {
  const f = fixture(t);
  mkdirSync(f.run);
  await assert.rejects(() => iniciar(join(ROOT, 'odin'), f.run, args(f.root)), /não é um run \(sem state.json\)/);
});

test('CLI mantém execução com preserve-symlinks-main por alias de diretório', t => {
  const f = fixture(t), plugin = join(f.root, 'hermes');
  cpSync(join(ROOT, 'hermes'), plugin, { recursive: true });
  // Usa o fonte em revisão, sem depender de sync das cópias geradas.
  cpSync(resolve(import.meta.dirname, '../runtime/bridge.mjs'), join(plugin, 'runtime/bridge.mjs'));
  const alias = join(f.root, 'alias'); symlinkSync(plugin, alias, 'dir');
  const input = join(f.root, 'args.json'); writeFileSync(input, '{}');
  const r = spawnSync(process.execPath, ['--preserve-symlinks-main', join(alias, 'runtime/bridge.mjs'), 'iniciar', f.run, input], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).status, 'concluido');
  assert.ok(readFileSync(join(f.run, 'state.json'), 'utf8'));
});
test('lock órfão no run falha com diagnóstico acionável, sem ser removido nem alterar o estado', async t => {
  const f = fixture(t), plugin = join(ROOT, 'odin');
  const state = await iniciar(plugin, f.run, args(f.root));
  const id = state.solicitacoes[0].id, lock = join(f.run, '.lock');
  writeFileSync(lock, JSON.stringify({ pid: 999999, host: 'outra', iniciadoEm: '2026-01-01T00:00:00.000Z' }) + '\n');
  const antes = readFileSync(join(f.run, 'state.json'), 'utf8');
  await assert.rejects(() => responder(plugin, f.run, id, { resultado: specOK }), erro => {
    assert.match(erro.message, /\.lock/);
    assert.ok(erro.message.includes(lock), 'a mensagem precisa citar o caminho do lock');
    assert.match(erro.message, /interrompid/);
    assert.match(erro.message, /pid/i);
    assert.match(erro.message, /remov/i);
    return true;
  });
  assert.equal(readFileSync(lock, 'utf8').includes('999999'), true, 'o lock não pode ser removido sozinho');
  assert.equal(readFileSync(join(f.run, 'state.json'), 'utf8'), antes);
  rmSync(lock);
  const seguinte = await responder(plugin, f.run, id, { resultado: specOK });
  assert.equal(seguinte.solicitacoes[0].label, 'spec:validar');
  assert.equal(existsSync(lock), false, 'o lock de uma resposta concluída é removido');
});
