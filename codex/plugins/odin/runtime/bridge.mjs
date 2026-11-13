#!/usr/bin/env node
// Replay local dos controladores. agent() suspende em solicitações, sem chamar uma API.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, lstatSync, mkdirSync, renameSync, openSync, closeSync, unlinkSync, realpathSync, accessSync, existsSync, rmSync, constants } from 'node:fs';
import { resolve, dirname, join, relative, sep } from 'node:path';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validarSchema, validarDefinicao } from './schema.mjs';
const HARNESSES = { odin: 'skills/dev-loop/harness/loop.mjs', mimyr: 'skills/gerar-curso/harness/curso.mjs', hermes: 'skills/criativo-fluxo/harness/criativo.mjs' };
const hash = value => createHash('sha256').update(value).digest('hex');
const ler = p => JSON.parse(readFileSync(p, 'utf8'));
// Caches que SO e Python criam sozinhos dentro do pacote instalado (ex.: `python3` sem -B num
// script de shared/). Nunca são executados pelo bridge; contá-los recusava a retomada de um run
// íntegro com "fonte do pacote mudou", sem dizer qual arquivo. O nome só basta com o tipo
// esperado pelo lstat (symlink não é diretório nem arquivo aqui): symlink ou recurso não regular
// com esses nomes continua recusado.
const EFEMERO = (nome, stat) => (nome === '__pycache__' && stat.isDirectory()) || ((nome === '.DS_Store' || nome.endsWith('.pyc')) && stat.isFile());
// Erro de escrita com o path e o que fazer, preservando código e causa originais.
function diagnosticoEscrita(e, alvo, orientacao) {
  if (!['EACCES', 'EPERM', 'EROFS', 'ENOSPC', 'ENOENT', 'ENOTDIR', 'EDQUOT'].includes(e.code)) return e;
  const erro = new Error(`não foi possível gravar ${alvo} (${e.code}${e.syscall ? ` em ${e.syscall}` : ''}). Isto é ambiente, não resultado do controlador: ${orientacao}`, { cause: e });
  erro.code = e.code;
  return erro;
}
function pacote(root) {
  const name = ler(join(root, '.codex-plugin/plugin.json')).name;
  if (!Object.hasOwn(HARNESSES, name)) throw new Error('plugin sem controlador suportado');
  const files = [];
  function varrer(dir) {
    for (const nome of readdirSync(dir).sort()) {
      const file = join(dir, nome), stat = lstatSync(file);
      if (EFEMERO(nome, stat)) continue;
      if (stat.isSymbolicLink()) throw new Error('symlink não permitido no pacote do controlador');
      if (stat.isDirectory()) varrer(file);
      else if (stat.isFile()) files.push([relative(root, file).split(sep).join('/'), hash(readFileSync(file))]);
      else throw new Error('recurso não regular');
    }
  }
  for (const dir of ['shared', 'runtime']) varrer(join(root, dir));
  const papeis = files.filter(([p]) => /^shared\/agents\/[^/]+\.md$/.test(p)).map(([p]) => `${name}:${p.slice('shared/agents/'.length, -3)}`);
  return { name, papeis, files, fingerprint: hash(JSON.stringify(files)), source: readFileSync(join(root, 'shared', HARNESSES[name]), 'utf8') };
}
function preferencias(args, bundle) {
  if (!Object.hasOwn(args, 'execucaoCodex')) return {};
  const objeto = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const config = args.execucaoCodex;
  if (!objeto(config) || Object.keys(config).some(k => k !== 'papeis') || !objeto(config.papeis)) throw new Error('execucaoCodex exige objeto papeis');
  for (const [papel, pref] of Object.entries(config.papeis)) {
    if (!bundle.papeis.includes(papel) || !objeto(pref) || Object.keys(pref).some(k => !['modelo', 'effort'].includes(k))) throw new Error(`execucaoCodex: papel ou campos inválidos: ${papel}`);
    // Formato OpenAI, não catálogo de disponibilidade. O executor verifica acesso e suporte.
    if (Object.hasOwn(pref, 'modelo') && (typeof pref.modelo !== 'string' || !/^(?:gpt-[a-z0-9][a-z0-9._-]*|o[1-9][a-z0-9._-]*)$/.test(pref.modelo))) throw new Error('execucaoCodex.modelo exige identificador OpenAI explícito');
    if (Object.hasOwn(pref, 'effort') && !['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(pref.effort)) throw new Error('execucaoCodex.effort inválido');
  }
  return config.papeis;
}
function checarRun(dir) {
  if (!lstatSync(dir).isDirectory() || lstatSync(dir).isSymbolicLink()) throw new Error('run deve ser diretório regular');
  if (lstatSync(join(dir, 'state.json')).isSymbolicLink()) throw new Error('estado não pode ser symlink');
}
function gravar(dir, state) {
  const tmp = join(dir, 'state.tmp');
  try { writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
  catch (e) {
    if (e.code === 'EEXIST') throw e;
    // O tmp foi criado por esta chamada (flag wx): remover não apaga evidência de outra gravação.
    if (e.syscall !== 'open') { try { unlinkSync(tmp); } catch {} }
    throw diagnosticoEscrita(e, join(dir, 'state.json'), 'o estado persistido anterior continua valendo; libere espaço ou permissão e repita o mesmo comando, preservando o run.');
  }
  try { renameSync(tmp, join(dir, 'state.json')); }
  catch (e) { throw diagnosticoEscrita(e, join(dir, 'state.json'), 'state.tmp ficou com o estado novo e state.json com o anterior; siga a recuperação manual do RUNTIME antes de gravar de novo.'); }
}
// Diz QUAIS arquivos mudaram desde o início do run. Runs anteriores a este campo só têm o hash.
function divergencia(state, bundle) {
  if (!Array.isArray(state.arquivos)) return ' Este run foi criado por versão anterior do bridge, sem inventário de arquivos: a atualização do próprio pacote muda o fingerprint e remover arquivos não resolve.';
  const antes = new Map(state.arquivos), agora = new Map(bundle.files);
  const lista = (rotulo, paths) => paths.length ? ` ${rotulo}: ${paths.slice(0, 10).join(', ')}${paths.length > 10 ? ` (+${paths.length - 10})` : ''}.` : '';
  return lista('novos', [...agora.keys()].filter(p => !antes.has(p)))
    + lista('removidos', [...antes.keys()].filter(p => !agora.has(p)))
    + lista('alterados', [...agora.keys()].filter(p => antes.has(p) && antes.get(p) !== agora.get(p)));
}
function estado(root, dir) {
  checarRun(dir);
  const state = ler(join(dir, 'state.json')), bundle = pacote(root);
  if (state.version !== 1 || typeof state.runId !== 'string' || !state.runId || state.plugin !== bundle.name) throw new Error('run incompatível com este pacote; iniciar run novo');
  if (state.fingerprint !== bundle.fingerprint) throw new Error(`fonte do pacote mudou desde o início do run; concluir com a fonte original ou iniciar run novo.${divergencia(state, bundle)} Arquivo estranho ao pacote (criado por ferramenta) se resolve reinstalando a mesma versão do pacote, não apagando à mão; recurso de versão nova exige run novo. Nunca edite o fingerprint.`);
  if (state.argsHash !== hash(JSON.stringify(state.args))) throw new Error('argumentos do run foram alterados');
  return { state, bundle };
}
async function avaliar(state, bundle) {
  const prefs = preferencias(state.args, bundle);
  const linhas = bundle.source.split('\n'), fimMeta = linhas.findIndex(l => l === '}');
  if (fimMeta < 0 || !linhas[0].startsWith('export const meta')) throw new Error('formato de controlador não suportado');
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const pendentes = [], execucoes = [], falhasOperacionais = [], ocorrencias = new Map();
  let fase = '', concluido = false, resultado, falha;
  const agent = (prompt, opts) => {
    validarDefinicao(opts.schema || {});
    // A ordem global muda quando ramos paralelos retomam em momentos distintos.
    // Identidade por chamada + ocorrência local preserva retries e IDs dos outros ramos.
    const chave = JSON.stringify([prompt, opts]);
    const ocorrencia = ocorrencias.get(chave) || 0;
    ocorrencias.set(chave, ocorrencia + 1);
    const id = hash(JSON.stringify([state.runId, chave, ocorrencia]));
    const pref = Object.hasOwn(prefs, opts.agentType) ? prefs[opts.agentType] : {};
    const solicitacao = { id, label: opts.label, papel: opts.agentType, prompt, schema: opts.schema || {}, modeloSolicitado: pref.modelo || null, effort: pref.effort || null, fase: opts.phase || fase };
    const resposta = state.respostas[id];
    if (resposta) {
      execucoes.push({ id, label: opts.label, papel: opts.agentType, modeloSolicitado: solicitacao.modeloSolicitado, effortSolicitado: solicitacao.effort, modelo: resposta.modeloEfetivo || 'não informado pelo executor', erro: resposta.erro || null });
      if (Object.hasOwn(resposta, 'erro')) {
        falhasOperacionais.push({ ...solicitacao, erro: resposta.erro });
        // Não devolver null nem lançar: wrappers legados convertem ambos em fallback.
        return new Promise(() => {});
      }
      return Promise.resolve(resposta.resultado);
    }
    pendentes.push(solicitacao);
    return new Promise(() => {});
  };
  const parallel = thunks => Promise.all(thunks.map(t => Promise.resolve().then(t).catch(() => null)));
  const fn = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', linhas.slice(fimMeta + 1).join('\n'));
  const { execucaoCodex: _config, ...argsDominio } = state.args;
  fn(argsDominio, agent, parallel, p => { fase = p; }, () => {}).then(r => { resultado = r; concluido = true; }, e => { falha = e; concluido = true; });
  // Flush do trabalho síncrono e das microtasks: agent pendente não mantém processo vivo.
  await new Promise(setImmediate);
  if (falhasOperacionais.length) return { status: 'concluido', resultado: {
    status: 'erro', motivo: 'Falha operacional; reconciliar efeitos e solicitações interrompidas antes de novo run.',
    falhasOperacionais, solicitacoesInterrompidas: pendentes, modelos: { runtime: 'codex', execucoes },
  } };
  if (falha) throw new Error(`controlador: ${falha.message}`);
  if (concluido) {
    if (!resultado || typeof resultado !== 'object') throw new Error('controlador encerrou sem relatório');
    // O controlador sabe tiers Claude; só o executor sabe qual modelo Codex rodou.
    resultado.modelos = { runtime: 'codex', execucoes };
    delete resultado.fallbacks;
    return { status: 'concluido', resultado };
  }
  if (!pendentes.length) throw new Error('controlador suspenso sem solicitação conhecida');
  return { status: 'aguardando', solicitacoes: pendentes };
}
export async function iniciar(root, dir, args) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('args deve ser objeto');
  if (args.tiering || args.modeloArquiteto) throw new Error('tiering Claude não é configuração Codex; configure o executor');
  // Diagnóstico ANTES de avaliar: pai ausente ou sem escrita é ambiente, e dizia só EACCES/ENOENT.
  const pai = dirname(resolve(dir));
  if (existsSync(dir)) throw new Error(existsSync(join(dir, 'state.json'))
    ? `diretório do run já existe: ${dir}. Use um diretório novo; para continuar este run, use proximo.`
    : `diretório ${dir} já existe e não é um run (sem state.json). Use um diretório novo.`);
  if (!existsSync(pai)) throw new Error(`diretório pai do run não existe: ${pai}. Crie-o dentro do workspace antes de iniciar.`);
  try { accessSync(pai, constants.W_OK); }
  catch (e) { throw new Error(`diretório pai do run não é gravável: ${pai} (${e.code}). Isto é ambiente: escolha um diretório gravável dentro do workspace.`); }
  const bundle = pacote(root);
  const state = { version: 1, runId: randomUUID(), plugin: bundle.name, fingerprint: bundle.fingerprint, arquivos: bundle.files, args, argsHash: hash(JSON.stringify(args)), respostas: {} };
  const out = await avaliar(state, bundle);
  try { mkdirSync(dir, { recursive: false, mode: 0o700 }); }
  catch (e) { throw diagnosticoEscrita(e, dir, 'escolha um diretório de run gravável dentro do workspace.'); }
  // Nada foi persistido se a primeira gravação falha: o diretório é desta chamada e sairia órfão.
  try { gravar(dir, state); }
  catch (e) { try { rmSync(dir, { recursive: true, force: true }); } catch {} throw e; }
  return out;
}
export async function proximo(root, dir) {
  const { state, bundle } = estado(root, dir);
  return avaliar(state, bundle);
}
export async function responder(root, dir, id, resposta) {
  checarRun(dir);
  const lock = join(dir, '.lock');
  let fd;
  try { fd = openSync(lock, 'wx', 0o600); } catch (erro) {
    if (erro.code !== 'EEXIST') throw erro;
    // Não remove sozinho: apagar o lock de uma resposta ainda em andamento abriria dois escritores no run.
    throw new Error(`o run está em uso ou uma execução anterior foi interrompida: ${lock} já existe. Confira o pid registrado no arquivo e, se esse processo não estiver mais rodando, remova o arquivo manualmente e repita a resposta.`);
  }
  try {
    writeFileSync(fd, JSON.stringify({ pid: process.pid, host: hostname(), runDir: resolve(dir), iniciadoEm: new Date().toISOString() }) + '\n');
    const { state, bundle } = estado(root, dir), atual = await avaliar(state, bundle);
    const pedido = atual.solicitacoes?.find(s => s.id === id);
    if (!pedido) throw new Error('solicitação não está pendente neste run');
    if (!resposta || typeof resposta !== 'object' || Array.isArray(resposta) || Object.keys(resposta).some(k => !['resultado','erro','modeloEfetivo'].includes(k))) throw new Error('envelope de resposta inválido');
    if (Object.hasOwn(resposta, 'resultado') === Object.hasOwn(resposta, 'erro')) throw new Error('forneça resultado ou erro, exclusivamente');
    if (resposta.modeloEfetivo !== undefined && (typeof resposta.modeloEfetivo !== 'string' || !resposta.modeloEfetivo.trim())) throw new Error('modeloEfetivo deve ser texto não vazio');
    if (Object.hasOwn(resposta, 'erro')) { if (typeof resposta.erro !== 'string' || !resposta.erro.trim()) throw new Error('erro deve ser texto não vazio'); }
    else validarSchema(resposta.resultado, pedido.schema);
    state.respostas[id] = resposta;
    const out = await avaliar(state, bundle);
    gravar(dir, state);
    return out;
  } finally { closeSync(fd); unlinkSync(lock); }
}
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const [modo, dir, id, input] = process.argv.slice(2);
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    let out;
    if (modo === 'iniciar' && dir && id && !input) out = await iniciar(root, resolve(dir), ler(id));
    else if (modo === 'proximo' && dir && !id) out = await proximo(root, resolve(dir));
    else if (modo === 'responder' && dir && id && input) out = await responder(root, resolve(dir), id, ler(input));
    else throw new Error('uso: bridge.mjs iniciar <run-dir-novo> <args.json> | proximo <run-dir> | responder <run-dir> <id> <resposta.json>');
    console.log(JSON.stringify(out, null, 2));
  } catch (e) { console.error(JSON.stringify({ status: 'erro', detalhe: e.message })); process.exitCode = 1; }
}
