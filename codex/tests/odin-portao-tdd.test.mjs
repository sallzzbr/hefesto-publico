// Portão TDD do odin 2.5.0 e do porte 2.6.0 na distribuição Codex: o controlador é a cópia sincronizada, então o
// que se prova aqui é que o bridge transporta os args novos, valida os schemas novos e devolve o
// relatório com a continuidade registrada; e que a skill nativa ensina a montar esses args.
// Fixtures reaproveitadas da suíte Claude (mesmo bloco que controllers.test.mjs avalia).
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { iniciar, responder } from '../runtime/bridge.mjs';

const CODEX = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(CODEX, '..');
const PACOTE = join(CODEX, 'plugins', 'odin');
const ler = (rel) => readFileSync(join(PACOTE, rel), 'utf8');

function fixtures(args = ARGS) {
  const fonte = readFileSync(join(REPO, 'plugins', 'odin', 'tests', 'harness-dev-loop.test.mjs'), 'utf8');
  const inicio = fonte.indexOf('const TESTE');
  const fim = fonte.indexOf('function responder(label, overrides)');
  assert.ok(inicio >= 0 && fim > inicio, 'bloco de fixtures da suíte Claude não encontrado');
  const specPath = args.specPath.startsWith(`${args.workspaceRoot}/`) ? args.specPath.slice(args.workspaceRoot.length + 1) : args.specPath;
  return new Function('specPath', `${fonte.slice(inicio, fim)}\nLEGACY_INVENTORY.files.find(file => file.path === 'docs/plans/spec.md').path = specPath;\nreturn { DEFAULTS, repro, controle, idsDoSchema, execucao, TESTE, HASH_A, HASH_B, IMP_C, ALTERACOES };`)(specPath);
}

// Recusa do bridge (schema) sem virar falha do replay: para provar que o schema novo é imposto.
async function recusa(t, args, overrides, label) {
  const dir = mkdtempSync(join(tmpdir(), 'codex-odin-recusa-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { DEFAULTS } = fixtures(args);
  const tabela = { ...DEFAULTS, ...overrides };
  let saida = await iniciar(PACOTE, join(dir, 'run'), args);
  while (saida.status === 'aguardando') {
    const pedido = saida.solicitacoes.at(-1);
    const chave = Object.keys(tabela).find((k) => pedido.label === k || (k.endsWith(':') && pedido.label.startsWith(k)));
    if (pedido.label === label) return assert.rejects(() => responder(PACOTE, join(dir, 'run'), pedido.id, { resultado: tabela[chave](pedido) }), /schema/);
    saida = await responder(PACOTE, join(dir, 'run'), pedido.id, { resultado: tabela[chave](pedido) });
  }
  assert.fail(`o run terminou sem pedir ${label}`);
}

async function replay(t, args, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'codex-odin-portao-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { DEFAULTS } = fixtures(args);
  const tabela = { ...DEFAULTS, ...overrides };
  const chamadas = [];
  let saida = await iniciar(PACOTE, join(dir, 'run'), args);
  while (saida.status === 'aguardando') {
    assert.ok(chamadas.length < 100, 'replay não convergiu');
    const pedido = saida.solicitacoes.at(-1);
    const chave = Object.keys(tabela).find((k) => pedido.label === k || (k.endsWith(':') && pedido.label.startsWith(k)));
    assert.ok(chave, `fixture ausente para ${pedido.label}`);
    chamadas.push(pedido);
    // Recusa do bridge (schema) é desfecho do controlador sob teste: vira asserção, não exceção solta.
    try { saida = await responder(PACOTE, join(dir, 'run'), pedido.id, { resultado: tabela[chave](pedido) }); }
    catch (e) { assert.fail(`bridge recusou a resposta de ${pedido.label}: ${e.message}`); }
  }
  assert.equal(saida.status, 'concluido');
  return { resultado: saida.resultado, chamadas };
}

const ARGS = { workspaceRoot: '/workspace', scriptsDir: '/plugin/scripts', specPath: 'spec.md', branch: 'feat/x', perfil: 'economico', validacoes: ['npm test'], hoje: '2026-11-01' };
// Tipo de cada critério vem da coluna Tipo da SPEC (2.6.0): reprodução por default.
const specCom = (DEFAULTS, ids, preservacao = []) => ({
  'spec:ids': () => ({ ...DEFAULTS['spec:ids'](), ok: true, ids, erros: [], verificacoesComplementares: {}, tipos: Object.fromEntries(ids.map((id) => [id, preservacao.includes(id) ? 'preservacao' : 'reproducao'])) }),
  'spec:validar': () => ({ ...DEFAULTS['spec:validar'](), criterios: ids.map((id) => ({ id, texto: `faz ${id}` })), unidades: [{ id: 'U1', titulo: 'u1', arquivos: 'src/a.js', criterios: ids }] }),
});

test('skill nativa e execução Codex ensinam tipos de teste, exceção, rebaseline e reuso', () => {
  const skill = ler('skills/dev-loop/SKILL.md');
  const exec = ler('skills/dev-loop/references/execucao.md');
  for (const termo of ['reprodução', 'preservação', 'autorizacoesTdd', 'rebaselineTdd']) assert.ok(skill.includes(termo), `SKILL.md nativa sem "${termo}"`);
  for (const termo of ['autorizacoesTdd', 'rebaselineTdd', 'validacaoAnterior', 'validacaoFinal', 'vermelhoConfirmado', 'state.json', 'run novo', '--impressao']) {
    assert.ok(exec.includes(termo), `execucao.md sem "${termo}"`);
  }
  assert.match(exec, /nunca reverta|não reverta/i);
});

test('odin Codex 1.0.1 com CHANGELOG', () => {
  assert.equal(JSON.parse(ler('.codex-plugin/plugin.json')).version, '1.0.1');
  assert.match(ler('CHANGELOG.md'), /^## 1\.0\.0(\s|$)/m);
});

test('replay Codex: suíte mista com 4 regressões vermelhas e 6 controles verdes fecha verde', async (t) => {
  const { DEFAULTS, repro, controle, idsDoSchema, execucao, TESTE, HASH_A } = fixtures();
  const ids = Array.from({ length: 10 }, (_, i) => `C${i + 1}`);
  const { resultado } = await replay(t, ARGS, {
    ...specCom(DEFAULTS, ids, ids.slice(4)),
    'tdd:portao': () => ({ vermelhoConfirmado: true, testes: ids.map((id, i) => (i < 4 ? repro(id) : controle(id))) }),
    'tdd:vermelho': (o) => ({ ...DEFAULTS['tdd:vermelho'](o), execucoes: idsDoSchema(o).map((x, i) => execucao(x, i >= 4)) }),
  });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.tdd.reproducoes.length, 4);
  assert.equal(resultado.tdd.preservacoes.length, 6);
});

const AUT = { criterios: ['C1'], evidencia: 'run anterior bloqueado: C1 só preserva comportamento', autorizacao: 'pode seguir com C1 sem vermelho', autorizadoPor: 'dono', registradaEm: '2026-11-01' };

test('replay Codex: autorização nos args do run novo dá continuidade sem editar controlador nem estado', async (t) => {
  const { DEFAULTS, controle, idsDoSchema, execucao } = fixtures();
  // Exceção humana exige perfil máximo (decisão do dono, 2026-11-02): três lentes no replay.
  const { resultado, chamadas } = await replay(t, { ...ARGS, perfil: 'maximo', autorizacoesTdd: [AUT] }, {
    ...specCom(DEFAULTS, ['C1'], ['C1']),
    'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [controle('C1')] }),
    'tdd:vermelho': (o) => ({ ...DEFAULTS['tdd:vermelho'](o), execucoes: idsDoSchema(o).map((x) => execucao(x, true)) }),
  });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.equal(resultado.tdd.vermelhoConfirmado, false);
  assert.deepEqual(resultado.tdd.continuidade.autorizacoes[0].criteriosCobertos, ['C1']);
  assert.equal(resultado.tdd.continuidade.autorizacoes[0].autorizacao, AUT.autorizacao);
  assert.equal(chamadas.filter((c) => c.label.startsWith('rev:')).length, 3);
});

test('replay Codex: autorização fora do perfil máximo encerra em Args sem pedir trabalho', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'codex-odin-perfil-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const perfil of ['economico', 'balanceado']) {
    const saida = await iniciar(PACOTE, join(dir, perfil), { ...ARGS, perfil, autorizacoesTdd: [AUT] });
    assert.equal(saida.status, 'concluido');
    assert.equal(saida.resultado.status, 'erro');
    assert.equal(saida.resultado.fase, 'Args');
    assert.equal(saida.resultado.acao, 'reinvocar em run novo com perfil maximo');
  }
});

test('replay Codex: o bridge impõe o schema novo do preflight (tipos) e da execução independente (alterações)', async (t) => {
  const { DEFAULTS } = fixtures();
  await recusa(t, ARGS, { 'spec:ids': () => ({ ok: true, ids: ['C1'], erros: [], verificacoesComplementares: {} }) }, 'spec:ids');
  await recusa(t, ARGS, { 'tdd:vermelho': (o) => { const r = DEFAULTS['tdd:vermelho'](o); delete r.alteracoes; return r; } }, 'tdd:vermelho');
});

test('replay Codex: retomada com vermelho na base mede na cópia e fecha verde sem continuidade', async (t) => {
  const { DEFAULTS, repro, idsDoSchema, execucao, TESTE, HASH_A, HASH_B } = fixtures();
  // Execução coerente (decisão 13, furo 3): a cópia é da baseRef pedida, e alteracoes resolveu a
  // mesma base para o mesmo sha. Um sha arbitrário na cópia agora é erro TDD, não vermelho na base.
  // Desde a decisão 24 a baseRef é o SHA completo, e os dois shas são iguais a ela.
  const shaBase = `abc1234${'f'.repeat(33)}`;
  const base = { ...ARGS, baseRef: shaBase, vermelhoNaBase: true };
  const naCopia = (hash) => (o) => ({ ...DEFAULTS['tdd:vermelho'](o), execucoes: idsDoSchema(o).map((x) => execucao(x, false)),
    alteracoes: { comparadoCom: shaBase, sha: shaBase, alterados: [TESTE, 'src/a.js'], adicionados: [TESTE] },
    copiaBase: { sha: shaBase, hashesDosTestes: { [TESTE]: hash }, removida: true, vinculados: [] } });
  const ok = await replay(t, base, { 'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1')] }), 'tdd:vermelho': naCopia(HASH_A) });
  assert.equal(ok.resultado.status, 'verde', JSON.stringify(ok.resultado));
  assert.equal(ok.resultado.tdd.modo, 'base');
  assert.equal(ok.resultado.tdd.continuidade, null);
  assert.ok(ok.chamadas.find((c) => c.label === 'tdd:vermelho').prompt.includes(`copia-base.mjs' criar '${shaBase}'`));
  const divergente = await replay(t, base, { 'tdd:portao': () => ({ vermelhoConfirmado: true, testes: [repro('C1')] }), 'tdd:vermelho': naCopia(HASH_B) });
  assert.equal(divergente.resultado.status, 'erro');
  assert.equal(divergente.resultado.fase, 'TDD');
  // Na base o "não" do operário diz que os testes não estão prontos ou não cobrem o critério: bloqueia.
  const nao = await replay(t, base, { 'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [repro('C1')], problemas: ['o teste de C1 não cobre o caso de borda'] }), 'tdd:vermelho': naCopia(HASH_A) });
  assert.equal(nao.resultado.status, 'bloqueado', JSON.stringify(nao.resultado));
  assert.equal(nao.resultado.motivo, 'nao-confirmado');
  assert.ok(!nao.chamadas.some((c) => c.label.startsWith('impl:')));
  await recusa(t, base, { 'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [repro('C1')] }), 'tdd:vermelho': (o) => { const r = naCopia(HASH_A)(o); delete r.copiaBase; return r; } }, 'tdd:vermelho');
});

// Decisão 24 do dono (2026-11-03): baseRef só como SHA completo. O bridge entrega o erro de Args do
// controlador sincronizado antes de qualquer pedido de trabalho, com o valor e o comando do SHA.
test('replay Codex: baseRef que não é SHA completo encerra em Args sem pedir trabalho', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'codex-odin-baseref-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const sha = `abc1234${'f'.repeat(33)}`;
  for (const [i, baseRef] of ['main', 'v3.24.0', '20261103', sha.slice(0, 7), sha.slice(0, 39), 'HEAD~1', 42].entries()) {
    const saida = await iniciar(PACOTE, join(dir, `run-${i}`), { ...ARGS, baseRef, vermelhoNaBase: true });
    assert.equal(saida.status, 'concluido', JSON.stringify(baseRef));
    assert.equal(saida.resultado.status, 'erro', JSON.stringify(baseRef));
    assert.equal(saida.resultado.fase, 'Args', JSON.stringify(baseRef));
    assert.ok(saida.resultado.detalhe.includes(`recebi ${JSON.stringify(baseRef)}`), saida.resultado.detalhe);
    assert.ok(saida.resultado.acao.includes("git rev-parse --verify '<ref>^{commit}'"), saida.resultado.acao);
    assert.ok(saida.resultado.acao.includes('git merge-base <branchBase> HEAD'), saida.resultado.acao);
  }
  for (const baseRef of [sha, '0123456789abcdef'.repeat(4)]) {
    const saida = await iniciar(PACOTE, join(dir, `ok-${baseRef.length}`), { ...ARGS, baseRef, vermelhoNaBase: true });
    assert.equal(saida.status, 'aguardando', `${baseRef.length} hex: o run segue para o trabalho`);
  }
});

test('replay Codex: rebaseline com validação anterior igual reaproveita a suíte longa', async (t) => {
  const { DEFAULTS, repro, idsDoSchema, execucao, IMP_C } = fixtures();
  const reb = { criteriosAprovados: ['C1'], motivo: 'retomada tardia', autorizadoPor: 'dono', registradaEm: '2026-11-01', validacaoAnterior: { impressao: IMP_C, comandos: ['npm test'], verde: true } };
  const { resultado, chamadas } = await replay(t, { ...ARGS, rebaselineTdd: reb }, {
    'tdd:portao': () => ({ vermelhoConfirmado: false, testes: [repro('C1')] }),
    'tdd:vermelho': (o) => ({ ...DEFAULTS['tdd:vermelho'](o), execucoes: idsDoSchema(o).map((x) => execucao(x, true)) }),
  });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.deepEqual(resultado.tdd.continuidade.rebaseline.implementacaoAnterior.criterios, ['C1']);
  assert.equal(resultado.validacoesReaproveitadas.length, 1);
  assert.ok(chamadas.some((c) => c.label === 'impressao:i1' && c.papel === 'odin:mecanico'));
});

// 2.6.0, parte 2: o bridge valida schema com additionalProperties:false no IMPL_SCHEMA e no
// AUDITORIA_SCHEMA, e enum aninhado em falhas. Campo novo que só existisse no prompt seria recusado
// aqui como "campo extra" (o semCriacao da outra 2.5 era recusado pelo schema da 2.5.0).
test('replay Codex: semCriacao, criacoesSemRelato e buscaChamadores passam pelo bridge, e a impressão exclui a SPEC', async (t) => {
  const { DEFAULTS } = fixtures();
  const { resultado, chamadas } = await replay(t, ARGS, {
    'impl:': () => ({ status: 'concluida', resumo: 'corrigi o comando do README', escada: [], semCriacao: true, arquivosTocados: ['README.md'] }),
    'validar:': o => { const value = DEFAULTS['validar:'](o); value.qualityInventory.files.push({ path: 'README.md', lines: 12, bytes: 240, status: 'text' }); return value; },
    'ponytail:': () => ({ ...DEFAULTS['ponytail:'](), criacoesSemRelato: [], abstracoesUsoUnico: [{ arquivo: 'src/a.js', oQue: 'Wrapper', unicoChamador: 'src/b.js', buscaChamadores: 'git grep -n -w Wrapper: 3' }] }),
    'confirmar:': () => ({ real: false, bloqueante: false, porque: 'três chamadores' }),
  });
  assert.equal(resultado.status, 'verde', JSON.stringify(resultado));
  assert.deepEqual(resultado.ponytail.escada, [{ iteracao: 1, unidade: 'U1', semCriacao: true, arquivos: ['README.md'] }]);
  assert.match(chamadas.find((c) => c.label === 'validar:i1').prompt, /--impressao '\["spec\.md"\]'/);
  assert.deepEqual(resultado.validacaoFinal.excluidos, ['spec.md']);
  assert.match(chamadas.find((c) => c.label === 'confirmar:i1').prompt, /git grep -n -w Wrapper: 3/);
});

test('replay Codex: falha só de ambiente encerra como erro de ambiente, e natureza fora do enum é recusada', async (t) => {
  const { DEFAULTS } = fixtures();
  const ambiente = { comando: 'uv run pytest', resumo: 'PermissionError: [Errno 13] Permission denied: ~/.cache/uv', natureza: 'ambiente', evidencia: 'UV_CACHE_DIR' };
  const { resultado, chamadas } = await replay(t, { ...ARGS, validacoes: ['uv run pytest'] }, { 'validar:': (o) => ({ ...DEFAULTS['validar:'](o), verde: false, falhas: [ambiente] }) });
  assert.equal(resultado.status, 'erro', JSON.stringify(resultado));
  assert.equal(resultado.fase, 'Validar');
  assert.equal(resultado.motivo, 'ambiente');
  assert.ok(!chamadas.some((c) => c.label.startsWith('ponytail:')), 'a falha de ambiente não vira correção nem revisão');
  await recusa(t, ARGS, { 'validar:': (o) => ({ ...DEFAULTS['validar:'](o), verde: false, falhas: [{ comando: 'npm test', resumo: 'x', natureza: 'infra' }] }) }, 'validar:i1');
});

test('cópia sincronizada do helper de hashes calcula a impressão da worktree no pacote Codex', (t) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'codex-odin-impressao-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  const git = (...a) => { const r = spawnSync('git', a, { cwd: dir, env, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
  git('init', '-q');
  writeFileSync(join(dir, 'a.js'), 'x\n');
  git('add', 'a.js');
  git('-c', 'user.name=F', '-c', 'user.email=f@example.invalid', '-c', 'commit.gpgSign=false', 'commit', '-qm', 'f');
  const script = join(PACOTE, 'shared', 'skills', 'dev-loop', 'scripts', 'hashes-testes.mjs');
  const r = spawnSync(process.execPath, [script, '--impressao'], { cwd: dir, env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(JSON.parse(r.stdout).impressao, /^[a-f0-9]{64}-[a-f0-9]{8}$/);
});

// Iteração 2 (revisão adversarial): o modo Solo e a entregar nativos ainda descreviam o portão antigo.
test('Solo e entregar nativos usam reprodução e preservação, não o portão antigo', () => {
  const exec = ler('skills/dev-loop/references/execucao.md');
  const solo = exec.slice(exec.indexOf('Solo permitido'));
  assert.match(solo, /reprodução/);
  assert.match(solo, /preservação/);
  const entregar = ler('skills/entregar/SKILL.md');
  assert.doesNotMatch(entregar, /Software exige testes vermelhos pelo motivo correto/);
  assert.match(entregar, /reprodução/);
});

// Decisão do dono de 2026-11-03: no Solo, a exceção ao portão passa para o Loop no perfil máximo.
// Estes casos travam a INSTRUÇÃO ESCRITA das skills nativas e das cópias em shared, não o
// comportamento do agente: o bridge prova o erro de Args fora do perfil maximo (replay acima);
// o Solo não passa pelo bridge, então nada aqui prova que um agente obedece ao que está escrito.
const plano = (texto) => texto.replace(/\s+/g, ' ');
const trecho = (texto, inicio, fim) => {
  const i = texto.indexOf(inicio);
  assert.ok(i >= 0, `marcador ausente: ${inicio}`);
  const j = fim ? texto.indexOf(fim, i + inicio.length) : texto.length;
  assert.ok(j >= 0, `marcador ausente: ${fim}`);
  return texto.slice(i, j);
};
const EXCECAO = /sem (nenhuma reprodução )?vermelh|nenhuma reprodução vermelha|autorizacoesTdd|exceção humana|a exceção/i;
const PERFIL_MAXIMO = /perfil (\*\*)?(`maximo`|[Mm]áximo)/;
const CONTEXTO_LOOP = /Loop|harness|dev-loop|script|\brun\b|Args/i;
// "sem passar para o Loop" não sai do Solo: a negação logo antes não conta como passagem.
const SAI_DO_SOLO = /(?<!sem |não )passa(r)? (a entrega )?para (o modo Loop|o Loop|este Loop|cá)|nunca segue no Solo|não segue no Solo/;
// Mesma heurística da suíte Claude (portao-tdd-docs.test.mjs): exceção condicionada ao perfil
// máximo sem dizer que é no Loop, ou exceção no Solo sem mandar a entrega para o Loop, cite
// perfil ou não.
const frasesAmbiguas = (texto) => plano(texto).split(/\.\s/).filter((f) => EXCECAO.test(f) && (
  (PERFIL_MAXIMO.test(f) && !CONTEXTO_LOOP.test(f)) ||
  (/\bSolo\b/.test(f) && !SAI_DO_SOLO.test(f))
));

test('decisão 12: a heurística reprova frase que deixa a exceção seguir no Solo, com ou sem perfil', () => {
  for (const f of [
    'No Solo, a entrega segue sem nenhuma reprodução vermelha com a frase do dono citada literalmente no Log. ',
    'No Solo, a exceção vale no perfil `maximo`, sem passar para o Loop. ',
    'Sem nenhuma reprodução vermelha, a exceção vale no perfil `maximo`. ',
  ]) assert.equal(frasesAmbiguas(f).length, 1, f);
  for (const f of [
    'No Solo, a exceção não segue: a entrega passa para o Loop no perfil `maximo`. ',
    'A exceção só vale no perfil `maximo` do bridge (fora dele é erro de Args). ',
  ]) assert.deepEqual(frasesAmbiguas(f), [], f);
});

test('decisão 12: a entregar nativa manda a exceção do Solo para o Loop no perfil maximo, com opt-in registrado', () => {
  const passo = plano(ler('skills/entregar/SKILL.md').split('\n').find((l) => l.startsWith('5. Software exige')) ?? '');
  assert.match(passo, /nunca segue no Solo/);
  assert.match(passo, /passa para o Loop \(dev-loop\) no perfil `maximo`/);
  assert.match(passo, /run novo com `autorizacoesTdd`/);
  assert.match(passo, /citada literalmente/);
  assert.match(passo, /opt-in de custo[^;]*registrado no Log/);
  assert.match(passo, /escopo e custo não aumentaram/);
  assert.match(passo, /bloqueada no portão/);
  // Sem subagentes não há Loop: bloqueia sem pedir o opt-in.
  assert.match(passo, /sem subagentes para o Loop \(aí sem pedir o opt-in\), fica bloqueada no portão/);
  assert.match(passo, /Vale por fase, critério a critério/);
  assert.match(passo, /fases já implementadas no Solo[^.]*`baseRef` do Log com `vermelhoNaBase: true`[^.]*`autorizacoesTdd` cobre só os critérios sem vermelho/);
  assert.match(passo, /sem `vermelhoNaBase`, o portão bloqueia com `implementacao-preexistente`/);
});

test('decisão 12: dev-loop nativa e execução separam o harness (maximo ou erro de Args) do Solo (passa para o Loop)', () => {
  const passo4 = ler('skills/dev-loop/SKILL.md').split('\n').find((l) => l.startsWith('4. Ausência de vermelho')) ?? '';
  assert.match(passo4, /perfil `maximo` \(fora dele é erro de Args antes de qualquer agente\)/);
  assert.match(passo4, /No Solo não há exceção[^.]*passa para este Loop no perfil `maximo`/);
  assert.match(passo4, /opt-in[^.]*registrado no Log/);
  assert.match(passo4, /Sem esse opt-in, ou sem subagentes, fica bloqueada no portão/);
  assert.match(passo4, /passa para cá com fases já implementadas no Solo[^.]*`baseRef` \+ `vermelhoNaBase: true`[^.]*só os critérios sem vermelho/);
  const solo = plano(trecho(ler('skills/dev-loop/references/execucao.md'), 'Solo permitido'));
  assert.match(solo, /o Solo não segue com exceção, nem com autorrevisão pelas lentes do perfil `maximo`/);
  assert.match(solo, /passa para o Loop[^.]*perfil `maximo`[^.]*`autorizacoesTdd`/);
  assert.match(solo, /opt-in de custo[^.]*registrado no Log/);
  assert.match(solo, /bloqueada no portão/);
  assert.match(solo, /Vale por fase, critério a critério, mesmo ao lado de outras reproduções vermelhas/);
  assert.match(solo, /fases já implementadas no Solo[^.]*`baseRef` \+ `vermelhoNaBase: true`[^.]*só os critérios sem vermelho/);
  assert.match(plano(ler('skills/dev-loop/references/execucao.md')), /`vermelhoNaBase: true` \(exige `baseRef`\): retomada com a implementação já na worktree, inclusive fases já implementadas no Solo quando a entrega passa para o Loop/);
});

test('decisão 12: a cópia em shared do resumo canônico separa os modos', () => {
  const portao = plano(trecho(ler('shared/skills/dev-loop/references/escada-ponytail.md'), '## 🔴 Portão TDD (resumo canônico)', 'No harness esses invariantes'));
  assert.doesNotMatch(portao, /citada literalmente e no perfil `maximo`/);
  assert.match(trecho(portao, '**Harness do `dev-loop`:**', '**Solo da `entregar`'), /só vale no perfil `maximo`[^]*erro na fase `Args`/);
  const solo = trecho(portao, '**Solo da `entregar`');
  assert.match(solo, /nunca segue no Solo/);
  assert.match(solo, /passa para o modo Loop \(skill `dev-loop`\) no perfil `maximo`/);
  assert.match(solo, /opt-in de custo do Loop[^.]*registrado no Log/);
  assert.match(solo, /Vale por fase, critério a critério/);
  assert.match(solo, /fases já implementadas no Solo[^.]*`vermelhoNaBase: true`/);
  const spec = plano(ler('shared/skills/dev-loop/references/spec-template.md'));
  assert.match(spec, /não abre o portão sem autorização registrada do dono num Loop em perfil `maximo` \(no Solo, a entrega passa para o Loop/);
});

test('decisão 12: nenhuma doc do pacote odin condiciona a exceção ao perfil máximo fora do Loop, nem a deixa seguir no Solo', () => {
  for (const rel of ['skills/entregar/SKILL.md', 'skills/dev-loop/SKILL.md', 'skills/dev-loop/references/execucao.md', 'RUNTIME.md',
    'shared/skills/dev-loop/references/escada-ponytail.md', 'shared/skills/entregar/CONTRATO.md', 'shared/skills/dev-loop/CONTRATO.md',
    'shared/skills/entregar/references/steps-detalhados.md', 'shared/skills/dev-loop/references/spec-template.md']) {
    assert.deepEqual(frasesAmbiguas(ler(rel)), [], `codex/plugins/odin/${rel}`);
  }
});
