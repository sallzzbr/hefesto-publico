import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import fs, { closeSync, openSync, renameSync, existsSync, copyFileSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, lstatSync, statfsSync, chmodSync, utimesSync, linkSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { inspecionarExecucao } from '../scripts/execucoes.mjs';
import { hostname, tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { investigarUv } from '../scripts/ambientes-uv.mjs';
import { computador } from '../scripts/computador.mjs';
import { desenvolvimento } from '../scripts/desenvolvimento.mjs';
import { ambiente } from '../scripts/ambiente.mjs';
import { residuos } from '../scripts/residuos.mjs';
import { medirEspaco, candidatosAmbiente, candidatosResiduos } from '../scripts/espaco.mjs';
import { memoria } from '../scripts/memoria.mjs';

function temp(t) {
  const path = realpathSync(mkdtempSync(join(tmpdir(), 'higeia-')));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}
function put(path, content) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); }
const git = (dir, ...args) => execFileSync('git', ['-c', 'user.email=fixture', '-c', 'user.name=Fixture', '-c', 'commit.gpgsign=false', '-C', dir, ...args], { stdio: 'pipe' });

test('refs integradas, pendentes, ignorados e travas sem alterar índice, refs ou worktree', t => {
  const top = temp(t), dir = join(top, 'repo'), wt = join(top, 'secundaria');
  mkdirSync(dir); git(dir, 'init', '-b', 'main');
  put(join(dir, '.gitignore'), '.env\n'); git(dir, 'add', '.gitignore'); git(dir, 'commit', '-m', 'base');
  git(dir, 'branch', 'integrada'); git(dir, 'worktree', 'add', '-b', 'pendente', wt);
  put(join(wt, 'arquivo'), 'v1'); git(wt, 'add', 'arquivo'); git(wt, 'commit', '-m', 'trabalho');
  put(join(wt, '.env'), 'fixture'); put(join(wt, 'arquivo'), 'v2'); put(join(wt, 'novo'), 'v1');
  git(dir, 'worktree', 'lock', wt);
  const indexPath = git(wt, 'rev-parse', '--path-format=absolute', '--git-path', 'index').toString().trim();
  const index = readFileSync(indexPath), refs = git(dir, 'show-ref');
  const result = residuos(top);
  assert.equal(result.repositorios.length, 1);
  const repo = result.repositorios[0];
  assert.equal(repo.branches.find(x => x.nome === 'integrada').integradaNaBaseLocal, true);
  assert.equal(repo.branches.find(x => x.nome === 'pendente').integradaNaBaseLocal, false);
  const worktree = repo.worktrees.find(w => w.branch === 'pendente');
  assert.equal(worktree.travada, true);
  assert.deepEqual([worktree.estado.modificados, worktree.estado.novos, worktree.estado.ignorados], [1, 1, 1]);
  assert.deepEqual(readFileSync(indexPath), index); assert.deepEqual(git(dir, 'show-ref'), refs);
  assert.equal(readFileSync(join(wt, '.env'), 'utf8'), 'fixture');
});

test('refs sem base e pasta de workflow sem prova de conclusão seguem desconhecidas', t => {
  const root = temp(t); git(root, 'init', '-b', 'trunk');
  put(join(root, 'dados'), 'ok'); git(root, 'add', 'dados'); git(root, 'commit', '-m', 'inicial');
  put(join(root, 'runs/teste/state.json'), '{"status":"completed"}');
  const res = residuos(root); assert.equal(res.repositorios[0].branches[0].integradaNaBaseLocal, null);
  assert.equal(res.artefatos[0].situacao, 'origem e uso a conferir');
});

const cliResiduos = fileURLToPath(new URL('../scripts/diagnostico.mjs', import.meta.url));
const pacoteMimyr = fileURLToPath(new URL('../../../codex/plugins/mimyr', import.meta.url));

function diagnosticarExecucao(root, ...opcoes) {
  return JSON.parse(execFileSync(process.execPath, [cliResiduos, 'residuos', '--root', root, ...opcoes], { encoding: 'utf8' }));
}

test('associa entregas e intermediários ao registro Claude e preserva os bytes mesmo após conclusão', t => {
  const root = temp(t); git(root, 'init', '-b', 'main');
  const runId = 'wf_exemplo', registro = join(root, 'runs', runId + '.json');
  const final = 'entregas/final.png', anterior = 'outputs/prova.png';
  for (const arquivo of [anterior, final]) put(join(root, arquivo), 'material');
  const dados = { runId, taskId: 'tarefa', script: 'conteúdo reservado do script', args: { workspaceRoot: root },
    status: 'completed', result: { status: 'escalado', render: final, pacote: 'outputs/pacote.md',
      historico: [{ render: anterior }, { render: final }], candidatos: [{ path: anterior }] } };
  put(registro, JSON.stringify(dados));
  const antes = readFileSync(registro);
  const relatorio = diagnosticarExecucao(root);
  const run = relatorio.artefatos.find(a => a.caminho === registro).execucao;
  assert.equal(run.estado, 'concluida'); assert.equal(run.desfecho, 'escalado'); assert.equal(run.runId, runId);
  assert.deepEqual(run.entregas, []);
  assert.deepEqual(run.paraRevisao, [{ caminho: final, verificacao: 'arquivo presente', caminhoVerificado: join(root, final) },
    { caminho: 'outputs/pacote.md', verificacao: 'ausente', erro: 'ENOENT' }]);
  assert.deepEqual(run.intermediarios, [{ caminho: anterior, verificacao: 'arquivo presente', caminhoVerificado: join(root, anterior) }]);
  assert.equal(relatorio.espaco.potencialBytes, 0); assert.deepEqual(readFileSync(registro), antes);
  assert.equal(relatorio.espaco.itens.find(i => i.caminho === join(root, final)).classe, 'preservar');
  assert.equal(readFileSync(join(root, final), 'utf8'), 'material');
  assert.ok(!JSON.stringify(relatorio).includes(dados.script));
});

test('caminhos relatados fora da raiz e links não confirmam entrega presente', t => {
  const root = temp(t), externo = temp(t), runId = 'wf_selecionado', registro = join(root, runId + '.json');
  put(join(externo, 'arquivo'), 'externo');
  const caminhos = [join(externo, 'arquivo'), '../arquivo'];
  if (process.platform !== 'win32') {
    symlinkSync(externo, join(root, 'atalho')); caminhos.push('atalho/arquivo');
  }
  put(registro, JSON.stringify({ runId, taskId: 'tarefa', script: 'exemplo', cwd: root, status: 'completed',
    result: { reportsGravados: caminhos } }));
  const run = diagnosticarExecucao(root, '--execucao', registro).artefatos[0].execucao;
  assert.deepEqual(run.entregas.map(e => e.verificacao), ['fora da raiz', 'caminho ambíguo', ...(process.platform !== 'win32' ? ['link preservado'] : [])]);
  assert.equal(readFileSync(join(externo, 'arquivo'), 'utf8'), 'externo');
});

test('reconhece atividade e pausa registradas pelo Claude e mantém registros incoerentes em revisão', t => {
  const root = temp(t), runId = 'wf_sintetico', path = join(root, runId + '.json');
  const ler = () => diagnosticarExecucao(root, '--execucao', path).artefatos[0].execucao;
  const registro = { runId, taskId: 'tarefa', script: 'exemplo', args: { workspaceRoot: root } };
  for (const [status, estado] of [['running', 'ativa'], ['paused', 'retomavel'], ['killed', 'interrompida'], ['outro', 'desconhecido']]) {
    put(path, JSON.stringify({ ...registro, status }));
    const run = ler(); assert.equal(run.estado, estado);
    if (status === 'paused') assert.match(run.retomar, /workflows/);
  }
  put(path, JSON.stringify({ ...registro, runId: 'wf_outra', status: 'completed' }));
  assert.equal(ler().estado, 'desconhecido');
});

test('consulta proximo do pacote real e distingue aguardando de encerrado com bloqueio', async t => {
  const root = temp(t), dir = join(root, 'execução fora das convenções');
  const bridge = await import(pathToFileURL(join(pacoteMimyr, 'runtime', 'bridge.mjs')));
  const pedido = await bridge.iniciar(pacoteMimyr, dir, { cursoDir: './curso', estruturaPath: './estrutura.md', perfil: 'economico', scriptsDir: './scripts', python: 'python3' });
  const semPacote = diagnosticarExecucao(root, '--execucao', dir).artefatos[0].execucao;
  assert.equal(semPacote.estado, 'desconhecido'); assert.ok(!semPacote.retomar);
  const opcoes = ['--execucao', dir, '--pacote-codex', pacoteMimyr], path = join(dir, 'state.json');
  const antes = readFileSync(path);
  const run = diagnosticarExecucao(root, ...opcoes).artefatos[0].execucao;
  assert.equal(run.estado, 'aguardando'); assert.equal(run.pendentes, pedido.solicitacoes.length);
  assert.equal(run.atividadeDaSessao, 'desconhecida'); assert.ok(!run.retomar);
  assert.deepEqual(readFileSync(path), antes);
  await bridge.responder(pacoteMimyr, dir, pedido.solicitacoes[0].id, { resultado: { ok: true, aprovada: false, capitulos: [], capitulosComArquivoExistente: [] } });
  const depois = readFileSync(path);
  const fim = diagnosticarExecucao(root, ...opcoes).artefatos[0].execucao;
  assert.equal(fim.estado, 'concluida'); assert.equal(fim.desfecho, 'bloqueado');
  assert.deepEqual(fim.intermediarios, [{ caminho: path, verificacao: 'checkpoint lido' }]); assert.ok(!fim.retomar);
  assert.deepEqual(readFileSync(path), depois);
});

test('bridge do Mimyr repete checks cegos salvos e uma nova execução pode validar o capítulo', async t => {
  const root = temp(t), arquivo = 'capitulo.html';
  const args = { workspaceRoot: root, cursoDir: './curso', estruturaPath: './estrutura.md', perfil: 'economico', scriptsDir: './scripts', python: 'python3' };
  const bridge = await import(pathToFileURL(join(pacoteMimyr, 'runtime', 'bridge.mjs')));
  const cap = { id: 'c1', titulo: 'Capítulo', arquivo, objetivo: 'ensinar', criterios: ['explica'], reescrever: true };
  async function chegarNosChecks(dir) {
    let saida = await bridge.iniciar(pacoteMimyr, dir, args);
    for (const [label, resultado] of [
      ['estrutura:validar', { ok: true, aprovada: true, capitulos: [cap], capitulosComArquivoExistente: [] }],
      ['escrever:c1', { status: 'concluido', resumo: 'capítulo escrito', arquivosTocados: [arquivo], baseArquivosTocados: 'curso' }],
    ]) {
      assert.equal(saida.solicitacoes[0].label, label);
      saida = await bridge.responder(pacoteMimyr, dir, saida.solicitacoes[0].id, { resultado });
    }
    assert.equal(saida.solicitacoes[0].label, 'checks:i1');
    return saida.solicitacoes[0].id;
  }
  const antigo = join(root, 'anterior'), novo = join(root, 'novo');
  const id = await chegarNosChecks(antigo);
  const checks = { verde: true, arquivosAnalisados: 0, falhas: [] };
  const fim = await bridge.responder(pacoteMimyr, antigo, id, { resultado: checks });
  assert.equal(fim.resultado.status, 'erro');
  put(join(root, 'curso', arquivo), 'arquivo agora visível');
  assert.deepEqual(await bridge.proximo(pacoteMimyr, antigo), fim);
  const run = inspecionarExecucao(antigo, root, pacoteMimyr);
  assert.equal(run.retomar, undefined); assert.match(run.proximaAcao, /repita a validação/);
  const idNovo = await chegarNosChecks(novo);
  assert.notEqual(idNovo, id);
  const revisao = await bridge.responder(pacoteMimyr, novo, idNovo, { resultado: { ...checks, arquivosAnalisados: 1 } });
  assert.match(revisao.solicitacoes[0].label, /^rev:/);
});

test('um checkpoint indicado por caminho relativo atualiza o mesmo run descoberto e preserva arquivos já tocados', t => {
  const root = temp(t); git(root, 'init', '-b', 'main');
  const path = join(root, 'runs/trabalho/state.json'), tocado = 'src/curso.md';
  put(join(root, tocado), 'edição em andamento');
  put(path, JSON.stringify({ version: 1, runId: 'exemplo', fingerprint: 'a'.repeat(64), argsHash: 'b'.repeat(64),
    plugin: 'mimyr', args: {}, respostas: { exemplo: { resultado: { arquivosTocados: [tocado, tocado] } } } }));
  const r = diagnosticarExecucao(root, '--execucao', 'runs/trabalho/state.json');
  assert.equal(r.artefatos.length, 1);
  const run = r.artefatos[0].execucao;
  assert.equal(run.estado, 'desconhecido'); assert.equal(run.registro, path);
  assert.deepEqual(run.arquivosTocados, [{ caminho: tocado, verificacao: 'arquivo presente', caminhoVerificado: join(root, tocado) }]);
  assert.equal(r.espaco.itens.find(i => i.caminho === join(root, tocado)).classe, 'preservar');
});

test('confere arquivos do Mimyr pela base declarada em cada resposta, inclusive homônimos', t => {
  const root = temp(t), dir = join(root, 'runs/curso'), nome = 'capitulo.html';
  for (const caminho of [nome, 'curso/' + nome]) put(join(root, caminho), 'capítulo');
  put(join(dir, 'state.json'), JSON.stringify({ version: 1, runId: 'curso', plugin: 'mimyr',
    fingerprint: 'a'.repeat(64), argsHash: 'b'.repeat(64), args: { cursoDir: './curso', workspaceRoot: root },
    respostas: { a: { resultado: { arquivosTocados: [nome] } },
      b: { resultado: { baseArquivosTocados: 'curso', arquivosTocados: [nome, nome] } } } }));
  const r = diagnosticarExecucao(root, '--execucao', dir);
  assert.deepEqual(r.artefatos[0].execucao.arquivosTocados.map(a => a.caminhoVerificado).sort(),
    [join(root, nome), join(root, 'curso', nome)].sort());
});

test('conserva o artefato de rotas e seus roughs quando o Hermes aguarda escolha humana', t => {
  const root = temp(t), runId = 'wf_rotas', registro = join(root, runId + '.json');
  const rotasPath = 'rotas.md', rough = 'esboco.png';
  for (const caminho of [rotasPath, rough]) put(join(root, caminho), 'material');
  put(registro, JSON.stringify({ runId, taskId: 'tarefa', script: 'exemplo', cwd: root, status: 'completed',
    result: { status: 'aguardando-rota', rotasPath, rotas: [{ rough }, { rough: null }] } }));
  const r = diagnosticarExecucao(root, '--execucao', registro), run = r.artefatos[0].execucao;
  assert.equal(run.estado, 'concluida'); assert.equal(run.desfecho, 'aguardando-rota');
  assert.deepEqual(run.entregas.map(a => a.caminhoVerificado), [join(root, rotasPath)]);
  assert.deepEqual(run.intermediarios.map(a => a.caminhoVerificado), [join(root, rough)]);
  assert.equal(r.espaco.potencialBytes, 0);
});

test('atribui registros às respectivas worktrees ao revisar uma coleção e ao selecionar um run', t => {
  const root = temp(t), principal = join(root, 'principal'), secundaria = join(root, 'secundaria');
  mkdirSync(principal); git(principal, 'init', '-b', 'main');
  put(join(principal, 'entrega.md'), 'entrega'); git(principal, 'add', '.'); git(principal, 'commit', '-m', 'inicial');
  git(principal, 'worktree', 'add', '-b', 'revisao', secundaria);
  for (const pasta of [principal, secundaria]) {
    put(join(pasta, 'runs/wf_exemplo.json'), JSON.stringify({ runId: 'wf_exemplo', taskId: 'tarefa',
      script: 'exemplo', args: { workspaceRoot: pasta }, status: 'completed', result: { reportsGravados: ['entrega.md'] } }));
  }
  for (const opcoes of [[], ['--execucao', 'secundaria/runs/wf_exemplo.json']]) {
    const r = diagnosticarExecucao(root, ...opcoes);
    assert.equal(r.repositorios.length, 1);
    assert.deepEqual(r.artefatos.filter(a => a.execucao?.executor).map(a => a.execucao.entregas[0].caminhoVerificado).sort(),
      [join(principal, 'entrega.md'), join(secundaria, 'entrega.md')].sort());
  }
});

test('registro externo do Claude usa a sessão e a tarefa exatas para conferir a worktree da entrega', t => {
  const top = temp(t), projetos = join(top, 'checkouts'), principal = join(projetos, 'projeto'), irma = join(projetos, 'irma');
  mkdirSync(principal, { recursive: true }); git(principal, 'init', '-b', 'main');
  put(join(principal, 'rotas.md'), 'original'); git(principal, 'add', '.'); git(principal, 'commit', '-m', 'inicial');
  git(principal, 'worktree', 'add', '-b', 'revisao', irma);
  const perfil = join(top, 'perfil'), sessao = 'sessao-exemplo', runId = 'wf_exemplo', taskId = 'tarefa-exemplo';
  const projeto = join(perfil, 'projects', principal.replace(/[^a-z0-9]/gi, '-'));
  const registro = join(projeto, sessao, 'workflows', runId + '.json'), transcricao = join(projeto, sessao + '.jsonl');
  const evento = (cwd, tarefa = taskId, idSessao = sessao) => JSON.stringify({
    type: 'user', sessionId: idSessao, cwd, toolUseResult: { runId, taskId: tarefa }, message: 'texto privado de teste',
  });
  put(registro, JSON.stringify({ runId, taskId, script: 'exemplo', status: 'completed', result: { status: 'aguardando-rota', rotasPath: 'rotas.md' } }));
  const ler = raiz => JSON.parse(execFileSync(process.execPath, [cliResiduos, 'residuos', '--root', raiz, '--execucao', registro], {
    encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: perfil },
  }));
  const run = r => r.artefatos.find(a => a.caminho === registro).execucao;
  const incerta = r => {
    assert.equal(run(r).estado, 'concluida'); assert.equal(run(r).desfecho, 'aguardando-rota');
    assert.match(run(r).evidencia, /origem|fora da raiz/);
    assert.ok(!run(r).retomar);
    assert.deepEqual(run(r).entregas, [{ caminho: 'rotas.md', verificacao: 'arquivo não verificado' }]);
    assert.ok(!r.espaco.itens.some(i => i.caminho === join(irma, 'rotas.md')));
  };
  incerta(ler(irma)); // sem transcrição
  put(transcricao, '{"runId":"' + runId); // evento ainda incompleto
  incerta(ler(projetos));
  put(transcricao, [evento(irma, 'outra'), evento(irma, taskId, 'outra-sessao')].join('\n'));
  incerta(ler(projetos));
  put(transcricao, [evento(irma, 'outra'), evento(principal)].join('\n'));
  const r = ler(projetos);
  assert.equal(run(r).entregas[0].caminhoVerificado, join(principal, 'rotas.md'));
  assert.ok(!JSON.stringify(r).includes('texto privado de teste'));
  const fora = ler(irma); incerta(fora); assert.match(run(fora).evidencia, /--root/);
  put(transcricao, [evento(principal), evento(irma)].join('\n'));
  incerta(ler(projetos)); // evidências da mesma tarefa se contradizem
});

test('uma cópia de registro Claude sem origem fica em conferência mesmo ao lado de um arquivo homônimo', t => {
  const root = temp(t), runId = 'wf_copia', registro = join(root, runId + '.json');
  put(join(root, 'final.png'), 'local');
  put(registro, JSON.stringify({ runId, taskId: 'tarefa', script: 'exemplo', status: 'completed', result: { status: 'verde', render: 'final.png' } }));
  const r = diagnosticarExecucao(root, '--execucao', registro);
  const run = r.artefatos[0].execucao;
  assert.equal(run.estado, 'concluida'); assert.equal(run.desfecho, 'verde');
  assert.ok(!run.entregas[0].caminhoVerificado);
  assert.ok(!r.espaco.itens.some(i => i.caminho === join(root, 'final.png')));
});

const falhaFinalDeChecks = {
  agentCount: 1, workflowProgress: [{ type: 'workflow_agent', index: 1, label: 'checks:i1', phaseTitle: 'Checks', state: 'error' }],
  result: { status: 'erro', fase: 'Checks', acao: 'o agente de checks não retornou — conferir o executor; reinvocar com resumeFromRunId' },
};

test('estados do registro Claude continuam disponíveis com origem desconhecida ou fora da raiz', t => {
  const root = temp(t), externa = temp(t), runId = 'wf_estados', registro = join(root, runId + '.json');
  for (const cwd of [undefined, externa]) {
    for (const [status, estado] of [['running', 'ativa'], ['paused', 'retomavel'], ['failed', 'interrompida'], ['killed', 'interrompida'], ['outro', 'desconhecido']]) {
      put(registro, JSON.stringify({ runId, taskId: 'tarefa', script: 'exemplo', cwd, status }));
      const run = inspecionarExecucao(registro, root);
      assert.equal(run.estado, estado); assert.match(run.evidencia, cwd ? /--root/ : /origem.*sem confirmação/);
      if (status === 'paused') assert.match(run.retomar, /sessão original.*\/workflows/);
      if (status === 'running') assert.match(run.evidencia, /atividade atual/);
    }
    put(registro, JSON.stringify({ runId, taskId: 'tarefa', script: 'exemplo', cwd, status: 'completed', ...falhaFinalDeChecks }));
    const run = inspecionarExecucao(registro, root);
    assert.equal(run.desfecho, 'erro'); assert.match(run.retomar, /Confirme a pasta de origem/);
    assert.ok(run.retomar.includes(runId));
  }
});

test('link redirecionado na origem do Claude não atribui a entrega à pasta atual do link', { skip: process.platform === 'win32' }, t => {
  const root = temp(t), original = join(root, 'original'), irma = join(root, 'irma'), atalho = join(root, 'atual');
  for (const pasta of [original, irma]) put(join(pasta, 'projeto', 'final.png'), 'material');
  symlinkSync(original, atalho);
  const runId = 'wf_atalho', registro = join(root, runId + '.json');
  put(registro, JSON.stringify({ runId, taskId: 'tarefa', script: 'exemplo', args: { workspaceRoot: join(atalho, 'projeto') },
    status: 'completed', result: { status: 'verde', render: 'final.png' } }));
  rmSync(atalho); symlinkSync(irma, atalho);
  for (const pastaExiste of [true, false]) {
    if (!pastaExiste) rmSync(join(irma, 'projeto'), { recursive: true });
    const r = diagnosticarExecucao(root, '--execucao', registro), run = r.artefatos[0].execucao;
    assert.equal(run.desfecho, 'verde'); assert.ok(!run.pastaDeOrigem);
    assert.match(run.evidencia, /link/);
    assert.deepEqual(run.entregas, [{ caminho: 'final.png', verificacao: 'arquivo não verificado' }]);
    assert.ok(!r.espaco.itens.some(i => i.caminho === join(irma, 'projeto', 'final.png')));
  }
});

test('erro concluído do Claude só indica reinvocação quando a chamada final falhou e o controlador ficou sem resposta', t => {
  const root = temp(t), runId = 'wf_continuar', registro = join(root, runId + '.json');
  const ler = (acao, progresso = {}) => {
    put(registro, JSON.stringify({ runId, taskId: 'tarefa', script: 'exemplo', args: JSON.stringify({ workspaceRoot: root }),
      status: 'completed', ...falhaFinalDeChecks,
      result: { status: 'erro', fase: 'Checks', detalhe: 'o agente de checks não retornou', acao }, ...progresso }));
    return diagnosticarExecucao(root, '--execucao', registro).artefatos[0].execucao;
  };
  const preflight = 'conferir o script/venv no workspace e reinvocar com resumeFromRunId';
  for (const acao of ['reinvocar com resumeFromRunId', 'a revisão não retornou; reinvocar com resumeFromRunId']) {
    const run = ler(acao); assert.equal(run.estado, 'concluida'); assert.equal(run.desfecho, 'erro');
    assert.match(run.retomar, /mesma sessão/); assert.ok(run.retomar.includes(runId));
  }
  const acao = 'reinvocar com resumeFromRunId';
  const agente = { type: 'workflow_agent', index: 1, state: 'done', label: 'escrever:c1', phaseTitle: 'Escrever' };
  const concluido = ler(acao, { agentCount: 1, workflowProgress: [agente] });
  assert.ok(!concluido.retomar); assert.match(concluido.proximaAcao, /respostas.*salvas/);
  const checks = { ...falhaFinalDeChecks.workflowProgress[0], index: 2 };
  const final = ler(acao, { agentCount: 2, workflowProgress: [checks, agente] });
  assert.match(final.retomar, /checks:i1/); assert.match(final.retomar, /mesma sessão/);
  const duasFalhas = ler(acao, { agentCount: 2, workflowProgress: [{ ...agente, state: 'error' }, checks] });
  assert.equal(duasFalhas.retomar, undefined); assert.match(duasFalhas.proximaAcao, /escrever:c1/);
  assert.ok(!ler(acao, { agentCount: 2, workflowProgress: [agente, { ...checks, phaseTitle: 'Escrever' }] }).retomar);
  assert.ok(!ler(acao, { result: { status: 'erro', fase: 'Checks', detalhe: 'resposta não conforme', acao } }).retomar);
  for (const acao of [undefined, 'iniciar run novo (resumeFromRunId devolveria a mesma resposta)', 'não reinvocar com resumeFromRunId', 'não ' + preflight]) {
    assert.ok(!ler(acao).retomar);
  }
});

test('erro tolerado antes de uma resposta salva identifica o início do replay sem sugerir retomada', t => {
  const root = temp(t), runId = 'wf_replay', registro = join(root, runId + '.json');
  const agente = (index, label, state) => ({ type: 'workflow_agent', index, label, state });
  const erro = agente(1, 'portao:validar', 'error'), fallback = agente(2, 'portao:validar', 'done');
  for (const [fase, label, detalhe, acao] of [
    ['Portão', 'portao:validar', 'portão aprovou mas não devolveu a rota completa', 'reinvocar com resumeFromRunId'],
    ['Produzir', 'selecao:i1', 'seleção apontou path fora dos candidatos: outro.png', 'reinvocar com resumeFromRunId'],
    ['Pacote', 'pacote:montar', [{ resumo: 'disco cheio' }], 'report não gravado = validação que não aconteceu; reinvocar com resumeFromRunId (o loop já completo vem do cache)'],
  ]) {
    const chamadas = fase === 'Portão' ? [erro, fallback] : [erro, fallback, agente(3, 'producao:i1', 'done')];
    if (fase === 'Pacote') chamadas.push(agente(4, 'crit:i1', 'done'));
    if (fase !== 'Portão') chamadas.push(agente(chamadas.length + 1, label, 'done'));
    put(registro, JSON.stringify({ runId, taskId: 'tarefa', script: 'exemplo', status: 'completed', cwd: root,
      result: { status: 'erro', fase, detalhe, acao }, agentCount: chamadas.length, workflowProgress: chamadas.reverse() }));
    const run = inspecionarExecucao(registro, root);
    assert.equal(run.retomar, undefined); assert.match(run.proximaAcao, /portao:validar/);
    assert.match(run.proximaAcao, /posteriores|seguintes/); assert.match(run.proximaAcao, /custo/);
  }
});

test('histórico de chamadas ausente, truncado ou inconclusivo deixa a retomada para conferência', t => {
  const root = temp(t), runId = 'wf_incompleto', registro = join(root, runId + '.json');
  const [erro] = falhaFinalDeChecks.workflowProgress;
  for (const progresso of [
    { workflowProgress: undefined }, { workflowProgress: [] }, { agentCount: 2 }, { agentCount: undefined },
    { workflowProgress: [{ ...erro, index: 2 }] }, { agentCount: 2, workflowProgress: [erro, erro] },
    { workflowProgress: [{ ...erro, state: 'progress' }] }, { workflowProgress: [{ ...erro, state: 'desconhecido' }] },
    { workflowProgress: [{ ...erro, label: '' }] },
  ]) {
    put(registro, JSON.stringify({ runId, taskId: 'tarefa', script: 'exemplo', status: 'completed', cwd: root,
      ...falhaFinalDeChecks, ...progresso }));
    const run = inspecionarExecucao(registro, root);
    assert.equal(run.estado, 'concluida'); assert.equal(run.desfecho, 'erro');
    assert.equal(run.retomar, undefined); assert.match(run.proximaAcao, /\/workflows/);
  }
});

test('resposta de validação já recebida pede nova validação nos registros atuais e históricos', t => {
  const root = temp(t), runId = 'wf_validacao', registro = join(root, runId + '.json');
  for (const result of [
    { requerRunNovo: true, acao: 'orientação do controlador' },
    { acao: 'conferir o script/venv no workspace e reinvocar com resumeFromRunId' },
    { acao: 'provável path/venv errado — reinvocar com resumeFromRunId' },
    { acao: 'checks voltaram cegos: 0 arquivos analisados com capítulos escritos na working tree — provável path/venv errado; reinvocar com resumeFromRunId' },
    { acao: 'conferir script/venv/flags no workspace; preservar render e falhas antes de retomar' },
  ]) {
    put(registro, JSON.stringify({ runId, taskId: 'teste', script: 'teste', status: 'completed', result: { status: 'erro', ...result } }));
    const run = inspecionarExecucao(registro, root);
    assert.equal(run.desfecho, 'erro'); assert.equal(run.retomar, undefined);
    assert.match(run.proximaAcao, /script.*venv/); assert.match(run.proximaAcao, /nova execução/);
  }
});

test('origem histórica identificada mas removida mantém o erro e condiciona a reinvocação à recuperação da pasta', t => {
  const root = temp(t), antiga = join(root, 'checkout-removido'), runId = 'wf_anterior', registro = join(root, runId + '.json');
  put(join(root, 'arte.png'), 'homônimo em outra pasta');
  put(registro, JSON.stringify({ runId, taskId: 'tarefa', script: 'exemplo', cwd: antiga, status: 'completed', ...falhaFinalDeChecks,
    result: { ...falhaFinalDeChecks.result, render: 'arte.png' } }));
  const run = diagnosticarExecucao(root, '--execucao', registro).artefatos[0].execucao;
  assert.equal(run.estado, 'concluida'); assert.equal(run.desfecho, 'erro');
  assert.equal(run.pastaDeOrigem, antiga); assert.equal(run.origemDisponivel, false);
  assert.match(run.retomar, /recupere/i); assert.match(run.retomar, /mesma sessão/);
  assert.equal(run.paraRevisao[0].verificacao, 'arquivo não verificado');
  assert.match(run.evidencia, /pasta de origem.*indisponível/);
  assert.ok(!run.paraRevisao[0].caminhoVerificado);
});

test('render e pacote do Hermes aguardam revisão no escalado e contam uma só vez entre os arquivos preservados', t => {
  const root = temp(t), runId = 'wf_render', registro = join(root, runId + '.json');
  const caminhos = ['arte.png', 'pacote.md'];
  for (const caminho of caminhos) put(join(root, caminho), 'material');
  for (const status of ['escalado', 'verde']) {
    put(registro, JSON.stringify({ runId, taskId: 'tarefa', script: 'exemplo', cwd: root, status: 'completed',
      result: { status, render: caminhos[0], pacote: caminhos[1], historico: [{ render: caminhos[0] }] } }));
    const r = diagnosticarExecucao(root, '--execucao', registro), run = r.artefatos[0].execucao;
    assert.deepEqual(run.entregas.map(a => a.caminho), status === 'verde' ? caminhos : []);
    assert.deepEqual(run.paraRevisao.map(a => a.caminho), status === 'escalado' ? caminhos : []);
    assert.deepEqual(run.intermediarios, []);
    assert.equal(r.espaco.potencialBytes, 0);
    for (const caminho of caminhos) assert.equal(r.espaco.itens.find(i => i.caminho === join(root, caminho)).classe, 'preservar');
  }
});

test('troca atômica do checkpoint entre leitura e consulta invalida as atribuições da leitura anterior', async t => {
  const root = temp(t), dir = join(root, 'run'), estado = join(dir, 'state.json');
  const bridge = await import(pathToFileURL(join(pacoteMimyr, 'runtime', 'bridge.mjs')));
  await bridge.iniciar(pacoteMimyr, dir, {});
  const antes = JSON.parse(readFileSync(estado, 'utf8'));
  const outro = join(dir, 'novo.json');
  put(outro, JSON.stringify({ ...antes, runId: 'outro-run' }));
  // Simula o rename de um escritor ao abrir o manifesto, depois da leitura do checkpoint.
  const abrir = fs.openSync;
  const mock = t.mock.method(fs, 'openSync', (path, ...args) => {
    if (path === join(pacoteMimyr, '.codex-plugin/plugin.json')) renameSync(outro, estado);
    return abrir(path, ...args);
  });
  syncBuiltinESMExports();
  try {
    const run = inspecionarExecucao(dir, root, pacoteMimyr);
    assert.equal(run.estado, 'desconhecido'); assert.equal(run.runId, undefined); assert.match(run.evidencia, /mudou/);
  } finally { mock.mock.restore(); syncBuiltinESMExports(); }
});

test('trava órfã e gravação parcial impedem indicação de retomada; escritor com trava aberta indica atividade', async t => {
  const root = temp(t), dir = join(root, 'execucao'), lock = join(dir, '.lock'), tmp = join(dir, 'state.tmp');
  const bridge = await import(pathToFileURL(join(pacoteMimyr, 'runtime', 'bridge.mjs')));
  await bridge.iniciar(pacoteMimyr, dir, {});
  const ler = () => diagnosticarExecucao(root, '--execucao', dir, '--pacote-codex', pacoteMimyr).artefatos[0].execucao;
  put(tmp, 'parcial'); assert.match(ler().evidencia, /state.tmp/);
  put(lock, JSON.stringify({ host: hostname(), runDir: dir, pid: process.pid }));
  assert.equal(ler().estado, 'desconhecido');
  const fd = openSync(lock, 'r+');
  try {
    if (process.platform === 'darwin') assert.equal(ler().estado, 'ativa');
    const semLsof = JSON.parse(execFileSync(process.execPath, [cliResiduos, 'residuos', '--root', root, '--execucao', dir],
      { encoding: 'utf8', env: { ...process.env, PATH: root } })).artefatos[0].execucao;
    assert.equal(semLsof.estado, 'desconhecido'); assert.ok(!semLsof.retomar);
  } finally { closeSync(fd); }
  assert.equal(readFileSync(tmp, 'utf8'), 'parcial'); assert.ok(existsSync(lock));
});

test('registro ilegível, definição de workflow e pasta sem registro permanecem preservados', t => {
  const root = temp(t), dir = join(root, 'sem registro'), codigo = join(root, '.github/workflows/wf_codigo.json');
  mkdirSync(dir); put(codigo, '{"runId":"wf_codigo","taskId":"tarefa","status":"completed","script":"exemplo","args":{}}');
  for (const alvo of [codigo, dir]) {
    const r = diagnosticarExecucao(root, '--execucao', alvo);
    assert.equal(r.artefatos[0].execucao.estado, 'desconhecido'); assert.equal(r.espaco.itens[0].classe, 'preservar');
  }
  put(join(dir, 'state.json'), '{');
  const r = diagnosticarExecucao(root, '--execucao', dir);
  assert.ok(r.espaco.parcial); assert.equal(r.artefatos[0].execucao.estado, 'desconhecido');
  assert.equal(readFileSync(join(dir, 'state.json'), 'utf8'), '{');
});

test('separa origem e versões em cache, aplica perfis explícitos e distingue conteúdo', t => {
  const home = temp(t), root = join(home, 'repo'), c = join(home, 'codex'), a = join(home, 'claude');
  mkdirSync(root); mkdirSync(join(root, '.git'));
  const skill = dir => '---\nname: revisar\ndescription: "Review ' + dir + '"\n---\n';
  put(join(home, '.agents/skills/colecao/revisar/SKILL.md'), skill('user'));
  put(join(c, 'plugins/cache/market/p/1/skills/revisar/SKILL.md'), skill('externa'));
  put(join(c, 'plugins/cache/market/p/2/skills/revisar/SKILL.md'), skill('nova'));
  put(join(c, 'config.toml'), '[plugins."p@market"]\nenabled = true\n');
  put(join(a, 'plugins/installed_plugins.json'), '{"plugins": {}}');
  put(join(home, '.codex/skills/fantasma/SKILL.md'), 'arquivo fora do perfil');
  const res = ambiente(root, { CODEX_HOME: c, CLAUDE_CONFIG_DIR: a }, home);
  assert.equal(res.skills.length, 3); assert.equal(res.plugins.length, 2);
  assert.equal(res.sobreposicoes[0].tipo, 'conteúdo diferente');
  assert.ok(res.skills.every(s => s.nome === 'revisar')); assert.match(res.uso, /desconhecido/);
  assert.match(res.plugins[0].estado, /versão em cache/);
});

test('Munin ausente ou sem escopo segue sem resultado e só pede contexto de leitura', () => {
  const runner = (name, args) => {
    assert.equal(name, 'munin'); assert.equal(args[0], 'contexto'); assert.ok(args.includes('feature'));
    return { status: 1, stdout: '' };
  };
  assert.deepEqual(memoria('.', 'nota', 'feature', runner).registros, []);
});

test('Munin seleciona só notas pertinentes com procedência e aceita busca vazia', () => {
  const run = () => ({ status: 0, stdout: JSON.stringify({ ok: true, secoes: {
    'No projeto': [{ id: 'p1', texto: 'Revisão da ponte' }], 'Preferências gerais': [{ id: 'g', texto: 'ponte' }] } }) });
  assert.deepEqual(memoria('.', 'REVISAO ponte', null, run).registros.map(n => n.id), ['p1']);
  assert.equal(memoria('.', 'outra', null, run).registros.length, 0);
});

test('diretório gerenciado contendo apenas o marcador aparece para investigação', t => {
  const root = join(temp(t), 'worktrees');
  const path = join(root, 'antiga', '.codex-worktree-name'); put(path, '');
  const result = residuos(root);
  assert.equal(result.repositorios.length, 0); assert.equal(result.artefatos.length, 1);
  assert.equal(result.artefatos[0].worktreeRegistrada, false);
  assert.match(result.artefatos[0].situacao, /somente marcador/);
  assert.equal(readFileSync(path, 'utf8'), '');
});

test('mede bytes e % do volume, sem contar a pasta aninhada ou o destino de um link duas vezes', t => {
  const raiz = temp(t), alvo = join(raiz, 'candidato'), arquivo = join(alvo, 'dados');
  put(arquivo, Buffer.alloc(65536, 17));
  const protegido = join(raiz, 'protegido'); put(protegido, Buffer.alloc(32768, 11));
  const links = join(alvo, 'compartilhado');
  linkSync(protegido, links);
  const paths = [alvo, arquivo];
  if (process.platform !== 'win32') {
    const atalho = join(alvo, 'atalho'); symlinkSync(raiz, atalho); paths.push(atalho);
  }
  const tamanho = path => {
    const st = lstatSync(path);
    return process.platform === 'win32' ? (st.isFile() ? st.size : 0) : st.blocks * 512;
  };
  const espaco = medirEspaco([raiz], [alvo, arquivo, links, alvo].map(caminho => ({ caminho, classe: 'condicional' })));
  const esperado = paths.reduce((n, p) => n + tamanho(p), 0);
  const fs = statfsSync(raiz);
  assert.equal(espaco.itens.length, 1);
  assert.equal(espaco.potencialBytes, esperado);
  assert.equal(espaco.porVolume[0].hardlinksExcluidosBytes, tamanho(protegido));
  assert.equal(espaco.porVolume[0].capacidadeBytes, fs.blocks * fs.bsize);
  assert.equal(espaco.porVolume[0].percentualDaCapacidade, 100 * esperado / (fs.blocks * fs.bsize));
  assert.equal(espaco.parcial, false);
});

test('preserva grupo sobreposto e distingue caminho inacessível de zero medido', t => {
  const root = temp(t), dir = join(root, 'checkout'), arquivo = join(dir, 'local');
  put(arquivo, Buffer.alloc(32768, 5));
  const espaco = medirEspaco([root], [{ caminho: dir, classe: 'condicional' }, { caminho: arquivo, classe: 'preservar' },
    { caminho: join(root, 'ausente'), classe: 'condicional' }]);
  assert.equal(espaco.potencialBytes, 0);
  assert.ok(espaco.porVolume[0].preservarBytes > 0);
  assert.equal(espaco.parcial, true);
  assert.equal(espaco.itens.find(e => e.caminho.endsWith('ausente')).bytes, null);
});

test('só inclui cópias idênticas excedentes e checkout secundário integrado sem pendências', () => {
  const base = { nome: 'y', principal: false, caminho: 'checkout', branch: 'y', estado: { modificados: 0, novos: 0, ignorados: 0 }, operacoes: [] };
  const dados = { repositorios: [{ branches: [{ nome: 'y', integradaNaBaseLocal: true }], worktrees: [
    { ...base, principal: true }, base, { ...base, caminho: 'outra', travada: true }, { ...base, caminho: 'comentarios', estado: { ...base.estado, ignorados: 1 } },
  ] }], artefatos: [] };
  assert.deepEqual(candidatosResiduos(dados).map(i => i.classe), ['condicional', 'preservar', 'preservar']);
  const skills = ['pessoal', 'pacote', 'alias'].map((caminho, i) => ({ caminho, real: i === 2 ? 'pessoal' : caminho, plugin: i === 1 ? 'plugin' : null }));
  const sobreposicoes = [{ tipo: 'conteúdo idêntico', chave: 'runtime/x', caminhos: ['pessoal', 'pacote', 'alias'] },
    { tipo: 'conteúdo diferente', caminhos: ['pessoal', 'pacote'] }];
  assert.deepEqual(candidatosAmbiente({ skills, sobreposicoes }).map(i => i.caminho), ['pacote']);
});

test('mede só subpastas recriáveis e mostra dependências compartilhadas fora do potencial', t => {
  const home = temp(t);
  const dir = rel => join(home, rel);
  put(dir('.npm/_cacache/content-v2/pkg'), 'cache');
  put(dir('.npm/_npx/rascunho'), 'não classificado');
  put(dir('Library/Developer/Xcode/DerivedData/projeto/info.plist'), 'registro');
  put(dir('Library/Developer/Xcode/DerivedData/projeto/Build/Intermediates.noindex/a'), 'objeto');
  put(dir('Library/Developer/Xcode/DerivedData/projeto/SourcePackages/checkouts/mod/edicao'), 'edição');
  put(dir('.cache/uv/archive-v0/pacote'), 'compartilhado');
  put(dir('.cache/uv/archive-v0/ambiente/pyvenv.cfg'), 'ambiente de ferramenta');
  put(dir('.local/share/uv/tools/exemplo/uv-receipt.toml'), 'recibo');
  put(dir('.local/share/uv/tools/sem-recibo/dados'), 'outra origem');
  const dados = desenvolvimento({ home, sistema: home, plataforma: 'darwin', env: {} });
  assert.deepEqual(dados.ferramentasUv, ['exemplo']);
  assert.equal(dados.candidatos.find(c => c.categoria === 'Arquivo de pacotes do uv').ambientesPython, 1);
  const espaco = medirEspaco([home], dados.candidatos);
  assert.deepEqual(Object.keys(espaco.porVolume[0].porCategoria).sort(), ['Arquivo de pacotes do uv', 'Node.js', 'Xcode']);
  const g = espaco.porVolume[0].porCategoria;
  assert.ok(g['Arquivo de pacotes do uv'].preservarBytes > 0);
  assert.equal(espaco.potencialBytes, g['Node.js'].potencialBytes + g.Xcode.potencialBytes);
  assert.equal(espaco.itens.find(i => i.categoria === 'Xcode').caminho, dir('Library/Developer/Xcode/DerivedData/projeto/Build/Intermediates.noindex'));
  assert.equal(desenvolvimento({ plataforma: 'linux' }).suportado, false);
});

test('compara versões por plataforma, mede imagem uma vez e preserva dispositivos em uso ou desconhecidos', t => {
  const sistema = temp(t), home = join(sistema, 'perfil'), core = join(sistema, 'Library/Developer/CoreSimulator');
  const indice = join(core, 'Images/images.plist'); put(indice, 'fixture');
  const ids = ['iOS-26-1', 'iOS-26-5', 'watchOS-10'].map(n => 'com.apple.CoreSimulator.SimRuntime.' + n);
  const imagens = ids.map((_, i) => join(core, 'Images', i + '.dmg'));
  imagens.forEach(p => put(p, Buffer.alloc(8192, 7)));
  const id = '11111111-1111-1111-1111-111111111111';
  const plist = join(home, 'Library/Developer/CoreSimulator/Devices', id, 'device.plist'); put(plist, 'fixture');
  put(join(core, 'Caches/dyld/host', ids[0] + '.B', 'cache'), 'dyld');
  let estado = '1', legivel = true, boot = null;
  const campo = (p, k) => {
    if (p === plist) {
      if (!legivel) throw Error();
      return { UDID: id, name: 'Telefone de teste', runtime: ids[0], state: estado, lastBootedAt: boot }[k];
    }
    if (k === 'images') return '3';
    const i = Number(k.split('.')[1]);
    if (k.endsWith('path.relative')) return pathToFileURL(imagens[i]).href;
    return { bundleIdentifier: ids[i], version: [101, 105, 10][i], platformIdentifier: i === 2 ? 'watchOS' : 'iOS', build: 'B' };
  };
  const scan = () => desenvolvimento({ home, sistema, plataforma: 'darwin', campo, env: {} });
  const dados = scan(), espaco = medirEspaco([home], dados.candidatos);
  const v = espaco.porVolume[0];
  assert.deepEqual(dados.runtimes.map(r => r.anterior), [true, false, false]);
  assert.equal(v.potencialBytes, 0);
  assert.equal(v.revisarBytes, espaco.itens.filter(i => i.classe === 'revisar').reduce((n, i) => n + i.bytes, 0));
  assert.equal(v.porCategoria['Imagens do simulador'].revisarBytes, espaco.itens.find(i => i.caminho === imagens[0]).bytes);
  assert.equal(v.percentualEmRevisao, 100 * v.revisarBytes / v.capacidadeBytes);
  assert.equal(v.totalComRevisaoGB, (v.potencialBytes + v.revisarBytes) / 1e9);
  assert.equal(v.percentualComRevisao, 100 * v.totalComRevisaoBytes / v.capacidadeBytes);
  assert.equal(v.porCategoria['Dados de dispositivos simulados'].revisarGB, v.porCategoria['Dados de dispositivos simulados'].revisarBytes / 1e9);
  boot = '2026-01-01T12:00:00Z'; assert.ok(scan().candidatos.every(i => i.classe === 'preservar'));
  boot = null;
  estado = '3'; assert.ok(scan().candidatos.every(i => i.classe === 'preservar'));
  legivel = false; assert.ok(scan().limites.length > 0); assert.ok(scan().candidatos.every(i => i.classe === 'preservar'));
});

test('distingue perfil recriável, uso e estado local mesmo sem data de inicialização', t => {
  const sistema = temp(t), home = join(sistema, 'perfil'), core = join(sistema, 'Library/Developer/CoreSimulator');
  const indice = join(core, 'Images/images.plist'), imagem = join(core, 'Images/atual.dmg');
  put(indice, 'fixture'); put(imagem, 'imagem');
  const id = '22222222-2222-2222-2222-222222222222', runtime = 'com.apple.CoreSimulator.SimRuntime.iOS-26-5';
  const device = join(home, 'Library/Developer/CoreSimulator/Devices', id), plist = join(device, 'device.plist');
  put(plist, 'registro');
  let boot = null;
  const campo = (p, k) => {
    if (p === plist) return { UDID: id, name: 'Telefone A', runtime, state: '1', lastBootedAt: boot }[k];
    if (k === 'images') return '1';
    if (k.endsWith('path.relative')) return pathToFileURL(imagem).href;
    return { bundleIdentifier: runtime, platformIdentifier: 'iOS', version: 105, build: 'A' };
  };
  const scan = () => desenvolvimento({ home, sistema, plataforma: 'darwin', campo, env: {} });
  const classe = () => scan().candidatos.find(c => c.caminho === device).classe;
  assert.equal(classe(), 'revisar');
  assert.equal(scan().candidatos.find(c => c.caminho === imagem).classe, 'preservar');
  boot = '2026-01-01T12:00:00Z';
  assert.equal(classe(), 'preservar');
  boot = null;
  put(join(device, 'data/Containers/Data/Application/app/local'), 'estado');
  assert.equal(classe(), 'preservar');
  put(join(device, 'data/Containers/Bundle/Application/app/Exemplo.app/Info.plist'), 'metadados');
  assert.deepEqual(scan().dispositivos[0].aplicativos, ['Exemplo']);
  assert.equal(scan().dispositivos[0].nome, 'Telefone A');
});

test('desconta áreas sobrepostas entre caches e simuladores e prevalece a decisão mais cautelosa', t => {
  const root = temp(t), p = join(root, 'cache'), filho = join(p, 'dados');
  put(filho, Buffer.alloc(8192, 17));
  const items = [{ caminho: p, categoria: 'A', classe: 'condicional' }, { caminho: filho, categoria: 'B', classe: 'revisar' }];
  const e = medirEspaco([root], items);
  assert.equal(e.itens.length, 1);
  assert.equal(e.potencialBytes, 0);
  assert.ok(e.porVolume[0].revisarBytes >= 8192);
  assert.equal(medirEspaco([root], [...items, { caminho: filho, classe: 'preservar' }]).porVolume[0].revisarBytes, 0);
});

test('uv distingue índice recriável, projeto dependente, arquivo aberto e conteúdo local', t => {
  const linkDir = (alvo, link) => symlinkSync(alvo, link, process.platform === 'win32' ? 'junction' : 'dir');
  const home = temp(t), cache = join(home, '.cache/uv'), raiz = join(home, 'projeto');
  const arquivo = join(cache, 'archive-v0'), indice = join(cache, 'environments-v2', 'python');
  mkdirSync(indice, { recursive: true }); mkdirSync(raiz);
  const nomes = ['livre', 'projeto', 'aberto', 'extra', 'origem', 'wheel', 'sem-indice'];
  const direto = join(cache, 'environments-v2', 'central'); put(join(direto, 'pyvenv.cfg'), 'centralizado');
  for (const nome of nomes) {
    const p = join(arquivo, nome);
    put(join(p, 'pyvenv.cfg'), 'version_info = 3.12.1');
    put(join(p, 'bin/ferramenta'), '');
    put(join(p, 'lib/python3.12/site-packages/mod-1.0.dist-info/METADATA'), '');
    if (nome !== 'sem-indice') linkDir(p, join(indice, nome));
  }
  linkDir(join(indice, 'projeto'), join(raiz, '.venv'));
  put(join(arquivo, 'extra', 'banco.db'), 'estado local');
  put(join(arquivo, 'origem', 'lib/python3.12/site-packages/mod-1.0.dist-info/direct_url.json'), '{}');
  mkdirSync(join(cache, 'wheels-v6')); linkDir(join(arquivo, 'wheel'), join(cache, 'wheels-v6', 'mod'));
  const consultar = (abertos, env = {}) => investigarUv({ home, env, raizes: [raiz], executavel: 'ferramenta', abertos });
  const r = consultar(() => [join(indice, 'aberto', 'bin/ferramenta')]);
  assert.deepEqual(r.ambientesDiretosNoIndice, [direto]);
  assert.deepEqual(r.limites, []);
  assert.deepEqual(r.candidatos.filter(c => c.classe === 'revisar').map(c => c.caminho), [join(arquivo, 'livre')]);
  assert.ok(r.candidatos.find(c => c.caminho.endsWith('aberto')).arquivoAberto);
  assert.equal(new Set(r.candidatos.map(c => c.composicao)).size, 1);
  assert.ok(consultar(() => { throw Error('indisponível'); }).candidatos.every(c => c.classe === 'preservar'));
  assert.ok(consultar(() => [], { VIRTUAL_ENV: join(arquivo, 'livre') }).candidatos.find(c => c.caminho.endsWith('livre')).dependentes.length);
  assert.throws(() => investigarUv({ home, env: {}, raizes: [], executavel: '../fora' }), /executável/);
});

test('plano de iOS mantém o modelo registrado mesmo se o nome mudou e preserva outras plataformas', async () => {
  const { planoIos } = await import('../scripts/plano-ios.mjs');
  const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const rt = v => 'com.apple.CoreSimulator.SimRuntime.iOS-' + v;
  const tipo = [{ name: 'modelo', identifier: 'tipo' }];
  const base = { name: 'apelido', state: 'Shutdown', isAvailable: true, deviceTypeIdentifier: 'tipo' };
  const dispositivos = { [rt('2-0')]: [{ ...base, udid: id(1) }, { ...base, name: 'modelo', deviceTypeIdentifier: 'outro', udid: id(2) }],
    [rt('1-0')]: [{ ...base, udid: id(3) }], watchOS: [{ ...base, udid: id(4) }] };
  const imagem = { platformIdentifier: 'com.apple.platform.iphonesimulator', deletable: true, state: 'Ready' };
  const imagens = { nova: { ...imagem, identifier: id(5), runtimeIdentifier: rt('2-0') },
    velha: { ...imagem, identifier: id(6), runtimeIdentifier: rt('1-0'), version: '1.0' } };
  const plano = () => planoIos(dispositivos, imagens, tipo, 'modelo', '2.0');
  assert.equal(plano().manter.udid, id(1));
  assert.deepEqual(plano().remover.map(x => x.udid), [id(2), id(3)]);
  assert.deepEqual(plano().removerImagens, [{ identifier: id(6), version: '1.0' }]);
  dispositivos[rt('1-0')][0].state = 'Booted';
  assert.throws(plano, /estado/);
  dispositivos[rt('1-0')][0].state = 'Shutdown';
  dispositivos[rt('2-0')][1].deviceTypeIdentifier = 'tipo';
  assert.throws(plano, /ambíguo/);
});

test('a prova de recibos preserva um arquivo local desconhecido mesmo dentro de site-packages', t => {
  const raiz = temp(t);
  const site = join(raiz, 'lib/python3.13/site-packages');
  put(join(site, 'demo-1.dist-info/RECORD'), 'demo.py,,\ndemo-1.dist-info/RECORD,,\n');
  put(join(site, 'demo.py'), '');
  const script = new URL('../scripts/provar-ambientes-uv.py', import.meta.url);
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const prova = () => execFileSync(python, ['-B', '-c',
    "import runpy, sys; from pathlib import Path; print(runpy.run_path(sys.argv[1])['arquivos_conhecidos'](Path(sys.argv[2]), Path(sys.argv[3])))",
    fileURLToPath(script), raiz, site], { encoding: 'utf8' }).trim();
  assert.equal(prova(), 'True');
  put(join(site, 'dados-locais.db'), 'fixture');
  assert.equal(prova(), 'False');
});

test('Claude-Mem veta a limpeza quando o worker só consegue encontrar a memória pela busca textual', async t => {
  const raiz = temp(t);
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  mkdirSync(join(raiz, 'chroma'));
  execFileSync(python, ['-B', '-c', `
from pathlib import Path
import sqlite3, sys
raiz = Path(sys.argv[1])
with sqlite3.connect(raiz / 'claude-mem.db') as con:
    con.executescript("create table observations(id integer primary key,title text,project text); insert into observations values(7,'fixture','teste'); create virtual table observations_fts using fts5(title); insert into observations_fts values('fixture');")
with sqlite3.connect(raiz / 'chroma/chroma.sqlite3') as con:
    con.executescript("create table embeddings(id,embedding_id); insert into embeddings values(1,'obs_7_fact_1');")
`, raiz]);
  let vetorial = false;
  const servidor = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const busca = url.searchParams.get('query');
    const resposta = url.pathname === '/api/health' ? { initialized: true, mcpReady: true, version: 'fixture' }
      : url.pathname === '/api/observation/7' ? { title: 'fixture' }
      : { observations: busca === 'fixture' || vetorial ? [{ id: 7 }] : [] };
    res.end(JSON.stringify(resposta));
  });
  await new Promise((resolve, reject) => servidor.once('error', reject).listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => servidor.close(resolve)));
  put(join(raiz, 'worker.pid'), JSON.stringify({ port: servidor.address().port }));
  const script = fileURLToPath(new URL('../scripts/verificar-claude-mem.py', import.meta.url));
  const verificar = () => promisify(execFile)(python, ['-B', script, '--dados', raiz]);
  await assert.rejects(verificar(), e => e.code === 1 && JSON.parse(e.stdout).erro.includes('Busca vetorial inconclusiva'));
  vetorial = true;
  const { stdout } = await verificar();
  assert.equal(JSON.parse(stdout).idConfirmado, 7);
  assert.equal(JSON.parse(stdout).resultadosTextuaisDoControle, 0);
});

function cliHooks(t) {
  const root = temp(t), bin = join(root, 'bin');
  mkdirSync(bin);
  const cmd = fileURLToPath(new URL('../scripts/diagnostico.mjs', import.meta.url));
  const env = { ...process.env, HOME: root, USERPROFILE: root, PATH: bin, CODEX_HOME: join(root, 'codex'),
    CLAUDE_CONFIG_DIR: join(root, 'claude') };
  const rodar = (...args) => JSON.parse(execFileSync(process.execPath, [cmd, 'ambiente', '--root', root, ...args],
    { cwd: root, env, encoding: 'utf8', timeout: 15000 }));
  function simular() {
    if (process.platform === 'win32') copyFileSync(process.execPath, join(bin, 'codex.exe'));
    else symlinkSync(process.execPath, join(bin, 'codex'));
    put(join(root, 'app-server'), `
      const { createInterface } = require('node:readline');
      const { appendFileSync, readFileSync } = require('node:fs');
      createInterface({ input: process.stdin }).on('line', line => {
        const { id, method, params } = JSON.parse(line);
        appendFileSync('metodos', method + '\\n');
        if (method === 'initialize') console.log(JSON.stringify({ id, result: {} }));
        if (method === 'hooks/list' && params.cwds[0] === process.cwd()) {
          console.log(JSON.stringify({ id, ...JSON.parse(readFileSync('resposta', 'utf8')) }));
        }
      });
    `);
  }
  function consulta(hooks, extra = {}) {
    put(join(root, 'resposta'), JSON.stringify({ result: { data: [{ cwd: root, errors: [], warnings: [], hooks, ...extra }] } }));
    return rodar('--hooks-codex').hooksCodex;
  }
  return { root, rodar, simular, consulta };
}

test('auditoria distingue habilitação e confiança dos dois hooks pelo RPC do Codex', t => {
  const f = cliHooks(t); f.simular();
  const base = { source: 'plugin', pluginId: 'higeia@hefesto', enabled: true, command: 'comando privado' };
  const res = f.consulta([
    { ...base, eventName: 'sessionStart', trustStatus: 'trusted' },
    { ...base, eventName: 'stop', trustStatus: 'untrusted' },
    { ...base, eventName: 'stop', pluginId: 'outro@hefesto', trustStatus: 'trusted' },
    { ...base, eventName: 'stop', source: 'project', trustStatus: 'trusted' },
    { ...base, eventName: 'stop', pluginId: 'higeia@local', enabled: false, trustStatus: 'modified' },
  ]);
  assert.equal(res.estado, 'consultado');
  assert.deepEqual(res.hooks.map(h => [h.plugin, h.evento, h.descoberta, h.habilitado, h.confianca]), [
    ['higeia@hefesto', 'SessionStart', 'listado', true, 'trusted'],
    ['higeia@hefesto', 'Stop', 'listado', true, 'untrusted'],
    ['higeia@local', 'SessionStart', 'não listado', undefined, undefined],
    ['higeia@local', 'Stop', 'listado', false, 'modified'],
  ]);
  assert.ok(!JSON.stringify(res).includes(base.command));
  assert.deepEqual(readFileSync(join(f.root, 'metodos'), 'utf8').trim().split('\n'), ['initialize', 'initialized', 'hooks/list']);
});

test('resposta parcial, pasta divergente e versão incompatível nunca afirmam ausência de hooks', t => {
  const f = cliHooks(t); f.simular();
  const parcial = f.consulta([], { errors: [{ message: 'conteúdo privado' }] });
  assert.equal(parcial.estado, 'parcial'); assert.equal(parcial.erros, 1);
  assert.deepEqual(parcial.hooks.map(h => h.descoberta), ['inconclusiva', 'inconclusiva']);
  assert.ok(!JSON.stringify(parcial).includes('conteúdo privado'));
  assert.equal(f.consulta([{ source: 'plugin', eventName: 'stop', pluginId: null }]).hooks[1].descoberta, 'inconclusiva');
  assert.equal(f.consulta([], { cwd: dirname(f.root) }).estado, 'indisponível');
  put(join(f.root, 'resposta'), JSON.stringify({ error: { code: -32601 } }));
  assert.match(f.rodar('--hooks-codex').hooksCodex.motivo, /sem suporte/);
  const gerenciado = f.consulta([{ source: 'plugin', pluginId: 'higeia@hefesto', eventName: 'stop', enabled: true, trustStatus: 'managed' }]);
  assert.equal(gerenciado.hooks[1].confianca, 'managed');
  assert.deepEqual(f.consulta([]).hooks.map(h => h.descoberta), ['não listado', 'não listado']);
});

test('sem CLI, a auditoria conserva o inventário; o modo básico dispensa app-server', t => {
  const f = cliHooks(t);
  const dados = f.rodar('--hooks-codex');
  assert.equal(dados.hooksCodex.estado, 'indisponível'); assert.match(dados.hooksCodex.motivo, /ausente/);
  assert.ok(Array.isArray(dados.skills) && dados.espaco);
  f.simular(); assert.equal(f.rodar().hooksCodex, undefined);
  assert.equal(existsSync(join(f.root, 'metodos')), false);
});

test('plano dos módulos Clang preserva outros formatos, vínculos, mudanças e originais após falha', { skip: process.platform === 'win32' }, t => {
  const root = temp(t);
  const script = fileURLToPath(new URL('../scripts/cache-modulos.py', import.meta.url));
  execFileSync('python3', ['-I', '-B', '-c', `
import os, runpy, sys
from pathlib import Path
m = runpy.run_path(sys.argv[1])
root = Path(sys.argv[2]) / 'cache'
grupo = root / 'ABC'
grupo.mkdir(parents=True)
def criar(nome, dados):
    f = grupo / nome
    f.write_bytes(dados)
    return f
a = criar('Foundation-ABC.pcm', b'CPCHorigem')
b = criar('Darwin-ABC.pcm', b'CPCHorigem')
extra = criar('Outro-ABC.pcm', b'outro formato')
link = criar('Link-ABC.pcm', b'CPCHlink')
os.link(link, grupo / 'segundo')
(grupo / 'Fora-ABC.pcm').symlink_to(a)
(root / 'DEF').symlink_to(grupo)
def plano():
    itens, chave = m['inventario'](root)
    assert set(itens) == {'ABC'} and set(itens['ABC']) == {a.name, b.name}
    return chave
def aplicar(chave, teste):
    return m['aplicar'](root, chave, lambda _: None, teste)
antigo = plano()
a.write_bytes(b'CPCHmudou')
try: aplicar(antigo, lambda _: True)
except ValueError: pass
else: raise AssertionError('plano obsoleto aceito')
def falha(_):
    assert not a.exists() and not b.exists()
    return False
try: aplicar(plano(), falha)
except ValueError: pass
else: raise AssertionError('falha de compilação ignorada')
assert a.read_bytes() == b'CPCHmudou' and b.read_bytes() == b'CPCHorigem'
def colisao(_):
    a.write_bytes(b'entrega concorrente')
    return False
try: aplicar(plano(), colisao)
except RuntimeError: pass
else: raise AssertionError('colisão não relatada')
reserva = root.parent / '.higeia-modulos-em-revisao'
assert a.read_bytes() == b'entrega concorrente' and (reserva / 'ABC' / a.name).read_bytes() == b'CPCHmudou'
assert b.read_bytes() == b'CPCHorigem'
a.unlink()
m['devolver'](root, reserva)
chamadas = []
def compilar(_):
    chamadas.append(reserva.exists())
    return True
result = aplicar(plano(), compilar)
assert chamadas == [True, False] and result['arquivos'] == 2
assert not a.exists() and not b.exists() and not reserva.exists()
assert extra.exists() and link.exists() and (grupo / 'Fora-ABC.pcm').is_symlink()
assert result['variacaoLivreBytes'] == result['livreDepoisBytes'] - result['livreBytes']
`, script, root], { stdio: 'pipe' });
});

test('computador prioriza caches reconhecidos e separa instalações, compactados, transferências e dados pessoais', t => {
  const home = temp(t);
  const paths = [
    'Library/Caches/Google/Chrome/Profile 1/Cache/Cache_Data/bloco',
    'Library/Application Support/Code/Code Cache/js/bloco',
    'Library/Application Support/Code/IndexedDB/entrega',
    'Library/Caches/desconhecido/entrega',
    'Downloads/copia.dmg', 'Downloads/copia.zip', 'Downloads/entregas/texto',
    'Downloads/transferencia.crdownload', '.Trash/texto',
    'Library/Logs/DiagnosticReports/antigo.ips', 'Library/Logs/DiagnosticReports/novo.ips',
  ];
  for (const path of paths) put(join(home, path), 'conteúdo');
  const agora = Date.now();
  const antigo = new Date(agora - 31 * 86400000);
  utimesSync(join(home, paths.at(-2)), antigo, antigo);
  const { candidatos, limites } = computador({ home, agora });
  assert.deepEqual(limites, []);
  const medicao = medirEspaco([home], candidatos);
  const grupos = medicao.porVolume[0].porCategoria;
  assert.deepEqual(Object.keys(grupos).sort(), ['Navegadores', 'Caches de aplicativos', 'Instaladores em Downloads',
    'Compactados em Downloads', 'Outros downloads', 'Downloads incompletos', 'Lixeira', 'Relatórios de falha antigos'].sort());
  assert.ok(grupos.Navegadores.potencialBytes > 0);
  assert.ok(grupos['Instaladores em Downloads'].revisarBytes > 0);
  assert.equal(grupos['Downloads incompletos'].totalComRevisaoBytes, 0);
  assert.equal(candidatos.length, 8);
  assert.ok(candidatos.some(c => c.caminho.endsWith('antigo.ips')));
  for (const path of paths) assert.equal(readFileSync(join(home, path), 'utf8'), 'conteúdo');
});

test('computador exclui ancestrais redirecionados e sinaliza o limite de cobertura', { skip: process.platform === 'win32' }, t => {
  const home = temp(t), fora = temp(t);
  put(join(fora, 'Default/GPUCache/bloco'), 'protegido');
  const google = join(home, 'Library/Caches/Google');
  mkdirSync(google, { recursive: true });
  symlinkSync(fora, join(google, 'Chrome'));
  const protegido = join(home, 'Library/Application Support/Code/GPUCache');
  const testarPermissao = process.getuid?.() !== 0;
  if (testarPermissao) {
    put(join(protegido, 'bloco'), 'privado');
    chmodSync(protegido, 0);
  }
  try {
    const { candidatos, limites } = computador({ home });
    assert.deepEqual(candidatos, []);
    assert.ok(limites.some(item => item.caminho === join(google, 'Chrome')));
    if (testarPermissao) assert.ok(limites.some(item => item.caminho === protegido && item.erro === 'EACCES'));
  } finally {
    if (testarPermissao) chmodSync(protegido, 0o700);
  }
});

const simularCacheApp = (t, caso) => {
  const script = fileURLToPath(new URL('../scripts/caches-apps.py', import.meta.url));
  execFileSync('python3', ['-I', '-B', '-c', `
import os, runpy, sys
from pathlib import Path
m = runpy.run_path(sys.argv[1])
root = Path(sys.argv[2])
apps = ['chrome', 'claude', 'slack']
def raiz(app):
    return root / m['APPS'][app][2][0]
def cache(app):
    return raiz(app) / 'Cache/Cache_Data'
for app in apps:
    cache(app).mkdir(parents=True)
    (cache(app) / 'bloco').write_bytes(os.urandom(65536))
    (raiz(app) / 'Cookies').write_text('pessoal')
def plano(selecao): return m['previa'](root, selecao)[0]['plano']
class Controle:
    def __init__(self, nome): self.nome, self.ativo = nome, True
    def estado(self): return {'ativo': self.ativo}
    def parado(self): return not self.ativo
    def fechar(self): self.ativo = False
    def abrir(self):
        self.ativo = True
        cache(self.nome).mkdir(exist_ok=True)
        (cache(self.nome) / 'regenerado').write_bytes(os.urandom(4096))
    def pronto(self): return self.ativo
def rodar(selecao, classe=Controle):
    return m['aplicar'](root, selecao, plano(selecao), classe)
` + caso, script, temp(t)]);
};

test('caches dos três apps medem somente o lote autorizado após a reabertura', { skip: process.platform === 'win32' }, t => {
  simularCacheApp(t, `
entrega = root / 'Downloads' / 'entrega'
entrega.parent.mkdir()
entrega.write_text('preservada')
for selecao in (['chrome', 'claude'], ['slack']):
    resultado = rodar(selecao)
    assert resultado['completo']
    if 'slack' not in selecao: assert (cache('slack') / 'bloco').is_file()
    for nome in selecao:
        a = resultado['apps'][nome]
        assert a['estado'] == 'verificado'
        assert a['antesBytes'] > a['depoisBytes'] > 0
        assert a['reducaoBytes'] == a['antesBytes'] - a['depoisBytes']
        assert (cache(nome) / 'regenerado').is_file()
        assert not (cache(nome) / 'bloco').exists()
    assert resultado['reducaoVerificadaBytes'] == sum(a['reducaoBytes'] for a in resultado['apps'].values())
    assert resultado['variacaoLivreGB'] == (resultado['livreDepoisBytes'] - resultado['livreAntesBytes']) / 1e9
assert entrega.read_text() == 'preservada'
assert all((raiz(app) / 'Cookies').read_text() == 'pessoal' for app in apps)
`);
});

test('limpeza recusa raízes trocadas, links, reserva anterior e encerramento incompleto', { skip: process.platform === 'win32' }, t => {
  simularCacheApp(t, `
c = cache('chrome')
antigo = plano(apps)
c.rename(c.with_name('outra'))
c.mkdir()
try: m['aplicar'](root, apps, antigo, Controle)
except ValueError: pass
else: raise AssertionError('plano obsoleto aceito')
(c/'atalho').symlink_to(raiz('chrome') / 'Cookies')
try: plano(apps)
except ValueError: pass
else: raise AssertionError('link aceito')
(c/'atalho').unlink()
m['reserva'](c).mkdir()
try: plano(apps)
except ValueError: pass
else: raise AssertionError('reserva aceita')
m['reserva'](c).rmdir()
class Ocupado(Controle):
    def parado(self): return False
r = rodar(['slack'], Ocupado)
assert not r['completo'] and (cache('slack') / 'bloco').is_file()
`);
});

test('falha de abertura preserva o lote e um cache recriado sem sobrescrever a entrega', { skip: process.platform === 'win32' }, t => {
  simularCacheApp(t, `
class Falha(Controle):
    def pronto(self): raise ValueError('falha de renderização')
r = rodar(apps, Falha)
assert not r['completo'] and r['apps']['claude']['estado'] == 'não processado'
assert (cache('chrome') / 'regenerado').is_file()
reserva = m['reserva'](cache('chrome'))
assert (reserva / 'bloco').is_file() and str(reserva) in r['apps']['chrome']['erro']
assert (raiz('chrome') / 'Cookies').read_text() == 'pessoal'
class SemCacheNovo(Controle):
    def abrir(self): self.ativo = True
    def pronto(self): raise ValueError('falha')
r = rodar(['slack'], SemCacheNovo)
assert not r['completo'] and (cache('slack') / 'bloco').is_file()
assert not m['reserva'](cache('slack')).exists()
`);
});

test('prévia continua após permissão negada e calcula o subtotal só dos apps medidos', { skip: process.platform === 'win32' }, t => {
  simularCacheApp(t, `
import errno
from unittest.mock import patch
# O primeiro cache do Chrome é legível. A segunda raiz falha depois.
bloqueado = root / m['APPS']['chrome'][2][1]
bloqueado.mkdir(parents=True)
(cache('slack') / 'bloco').unlink()
cache('slack').rmdir()
esperado = (cache('claude') / 'bloco').stat().st_blocks * 512
dados, _ = m['previa'](root, apps)
assert dados['rotulo'] == 'TOTAL' and dados['plano']
assert dados['potencialBytes'] == sum(sum(itens.values()) for itens in dados['apps'].values())
abrir = os.open
def bloquear(path, flags, *args, **kwargs):
    if path == 'Google' and 'dir_fd' in kwargs:
        pai = os.fstat(kwargs['dir_fd'])
        if os.path.samestat(pai, (root / 'Application Support').stat()):
            raise PermissionError(errno.EPERM, 'Operation not permitted', 'Chrome')
    return abrir(path, flags, *args, **kwargs)
with patch.object(os, 'open', bloquear):
    r, _ = m['previa'](root, apps)
    assert r['rotulo'] == 'SUBTOTAL MEDIDO' and r['plano'] is None
    assert set(r['apps']) == {'claude', 'slack'}
    assert r['porApp']['chrome']['estado'] == 'não medido' and r['porApp']['chrome']['gb'] is None
    assert r['porApp']['chrome']['erro'] == 'EPERM'
    assert r['porApp']['slack']['estado'] == 'sem pastas de cache' and r['porApp']['slack']['bytes'] == 0
    assert r['porApp']['claude']['bytes'] == esperado
    assert r['potencialBytes'] == esperado and r['potencialGB'] == esperado / 1e9
    assert r['percentual'] == r['porApp']['claude']['percentual'] == 100 * esperado / r['capacidadeBytes']
    vazio, _ = m['previa'](root, ['chrome'])
    assert vazio['rotulo'] == 'NENHUM APP MEDIDO' and vazio['potencialGB'] is None and vazio['percentual'] is None
    try: m['aplicar'](root, apps, dados['plano'], lambda _: sys.exit('aplicação parcial inesperada'))
    except ValueError: pass
    else: raise AssertionError('plano antigo aceito após perda de acesso')
with patch.object(os, 'open', side_effect=PermissionError(errno.EACCES, 'Permission denied')):
    r, _ = m['previa'](root, apps)
    assert all(v['erro'] == 'EACCES' for v in r['porApp'].values())
    assert r['potencialBytes'] is None
`);
});

test('quarentena exige prévia atual e restaura só o instalador escolhido sem sobrescrever', t => {
  const root = temp(t);
  const script = fileURLToPath(new URL('../scripts/instaladores.py', import.meta.url));
  execFileSync('python3', ['-I', '-B', '-c', `
from pathlib import Path
import runpy, sys
executar = runpy.run_path(sys.argv[1])['executar']
d = Path(sys.argv[2])
a, b = d/'Um instalador.dmg', d/'Outro.pkg'
a.write_bytes(b'A')
b.write_bytes(b'B')
def prever(): return executar(d, 'prever', a.name)['plano']
p = prever()
a.write_bytes(b'original')
try: executar(d, 'guardar', a.name, p)
except ValueError: pass
else: raise AssertionError('aceitou plano antigo')
assert executar(d, 'guardar', a.name, prever())['bytesLiberados'] == 0
assert executar(d, 'listar') == [a.name] and not a.exists()
a.write_bytes(b'novo')
try: executar(d, 'guardar', a.name, prever())
except FileExistsError: pass
else: raise AssertionError('sobrescreveu reserva')
try: executar(d, 'restaurar', a.name)
except FileExistsError: pass
else: raise AssertionError('sobrescreveu destino')
assert a.read_bytes() == b'novo'
alternativo = 'Cópia.moved.dmg'
try: executar(d, 'restaurar', a.name, novo_nome='../fora.dmg')
except ValueError: pass
else: raise AssertionError('restaurou fora de Downloads')
executar(d, 'restaurar', a.name, novo_nome=alternativo)
assert (d/alternativo).read_bytes() == b'original' and a.read_bytes() == b'novo'
(d/alternativo).rename(d/'legado.mpkg')
p = executar(d, 'prever', 'legado.mpkg')['plano']
executar(d, 'guardar', 'legado.mpkg', p)
executar(d, 'restaurar', 'legado.mpkg')
assert (d/'legado.mpkg').read_bytes() == b'original'
assert a.read_bytes() == b'novo' and b.read_bytes() == b'B'
assert executar(d, 'listar') == []
(d/'atalho.pkg').symlink_to(b)
for nome in ('atalho.pkg', '../Outro.pkg', 'parcial.pkg.download'):
    try: executar(d, 'prever', nome)
    except ValueError: pass
    else: raise AssertionError('aceitou item fora da seleção')
`, script, root]);
});

test('diagnóstico mostra bytes de instaladores em quarentena como ocupação preservada', t => {
  const home = temp(t);
  const caminho = join(home, 'Downloads/.higeia-instaladores/app.pkg');
  put(caminho, Buffer.alloc(65536, 1));
  const { candidatos } = computador({ home });
  const volume = medirEspaco([home], candidatos).porVolume[0];
  const grupo = volume.porCategoria['Quarentena de instaladores'];
  assert.ok(grupo.preservarBytes > 0);
  assert.equal(volume.preservarBytes, grupo.preservarBytes);
  assert.equal(volume.totalComRevisaoBytes, 0);
});
