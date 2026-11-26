// O registro identifica os caminhos a conferir. A verificação dos arquivos usa apenas metadados.
import { spawnSync } from 'node:child_process';
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';

const objeto = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const texto = v => typeof v === 'string' && v.length > 0 && v.length <= 4096 && !/[\u0000-\u001f\u007f]/u.test(v);
const plugins = new Set(['odin', 'mimyr', 'hermes']);
const limite = 8 * 1024 * 1024;

function lerBytes(path, limiteBytes) {
  if (realpathSync(path) !== path || !lstatSync(path).isFile()) throw Error('registro redirecionado ou especial');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
  try {
    const st = fstatSync(fd);
    if (!st.isFile() || st.size > limiteBytes) throw Error('registro especial ou acima do limite de leitura');
    const bytes = Buffer.alloc(st.size);
    let pos = 0;
    while (pos < bytes.length) {
      const n = readSync(fd, bytes, pos, bytes.length - pos, pos);
      if (!n) throw Error('registro mudou durante a leitura');
      pos += n;
    }
    if (fstatSync(fd).size !== bytes.length) throw Error('registro mudou durante a leitura');
    return bytes;
  } finally { closeSync(fd); }
}

function lerJson(path) {
  return JSON.parse(lerBytes(path, limite).toString('utf8'));
}

function conferirArquivo(caminho, base, raiz, pasta = '.') {
  if (!base) return { caminho, verificacao: 'arquivo não verificado' };
  if (!texto(pasta)) return { caminho, verificacao: 'base do arquivo desconhecida' };
  // Normalizar ".." poderia ocultar um link antes do segmento. A conferência fica pendente.
  if ([base, pasta, caminho].some(p => p.split(sep === '/' ? '/' : /[\\/]/).includes('..'))) return { caminho, verificacao: 'caminho ambíguo' };
  const alvo = resolve(base, pasta, caminho), rel = relative(raiz, alvo);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) return { caminho, verificacao: 'fora da raiz' };
  try {
    let atual = raiz;
    for (const nome of rel.split(sep)) {
      atual = join(atual, nome);
      if (lstatSync(atual).isSymbolicLink()) return { caminho, verificacao: 'link preservado' };
    }
    if (!lstatSync(alvo).isFile()) return { caminho, verificacao: 'não é arquivo regular' };
    return { caminho, verificacao: 'arquivo presente', caminhoVerificado: alvo };
  } catch (e) { return { caminho, verificacao: e.code === 'ENOENT' ? 'ausente' : 'leitura inconclusiva', erro: e.code }; }
}

function arquivosRelatados(resultado, base, raiz) {
  const entregas = new Set(), paraRevisao = new Set(), intermediarios = new Set();
  if (objeto(resultado)) {
    const adicionar = (grupo, p) => { if (texto(p)) grupo.add(p); };
    const material = resultado.status === 'verde' ? entregas : paraRevisao;
    adicionar(material, resultado.render);
    adicionar(material, resultado.pacote);
    adicionar(entregas, resultado.rotasPath);
    adicionar(intermediarios, resultado.parcial?.render);
    for (const [lista, campo, grupo] of [
      [resultado.capitulos, 'arquivo', entregas], [resultado.reportsGravados, null, entregas],
      [resultado.rotas, 'rough', intermediarios], [resultado.candidatos, 'path', intermediarios], [resultado.historico, 'render', intermediarios],
    ]) {
      if (Array.isArray(lista)) for (const item of lista) adicionar(grupo, campo ? item?.[campo] : item);
    }
  }
  const conferir = p => conferirArquivo(p, base, raiz);
  return {
    entregas: [...entregas].map(conferir),
    paraRevisao: [...paraRevisao].filter(p => !entregas.has(p)).map(conferir),
    intermediarios: [...intermediarios].filter(p => !entregas.has(p) && !paraRevisao.has(p)).map(conferir),
  };
}

// Ações gravadas antes de Hermes e Mimyr sinalizarem requerRunNovo no relatório.
const validacoesAntigas = new Set([
  'conferir o script/venv no workspace e reinvocar com resumeFromRunId',
  'provável path/venv errado — reinvocar com resumeFromRunId',
  'conferir script/venv/flags no workspace; preservar render e falhas antes de retomar',
  'checks voltaram cegos: 0 arquivos analisados com capítulos escritos na working tree — provável path/venv errado; reinvocar com resumeFromRunId',
]);

function resultadoFinal(resultado, base, raiz) {
  const final = {
    estado: 'concluida',
    desfecho: ['verde', 'bloqueado', 'escalado', 'erro', 'aguardando-rota'].includes(resultado?.status) ? resultado.status : null,
    ...arquivosRelatados(resultado, base, raiz),
  };
  if (final.desfecho === 'erro' && (resultado.requerRunNovo === true || validacoesAntigas.has(resultado.acao))) {
    final.proximaAcao = 'Confira a pasta de origem e preserve os arquivos já produzidos. Confira os caminhos, o script e o venv e repita a validação nesses arquivos. Para refazer o workflow inteiro, confira as etapas que repetiriam alterações ou custos antes de iniciar uma nova execução.';
  }
  return final;
}

function origemClaude(path, dados, raiz) {
  const bases = new Set();
  function registrar(cwd) {
    if (texto(cwd) && isAbsolute(cwd)) bases.add(cwd);
  }
  let args = dados.args;
  if (typeof args === 'string') {
    try { args = JSON.parse(args); } catch { /* argumentos antigos podem ser texto livre */ }
  }
  registrar(args?.workspaceRoot);
  registrar(dados.cwd);

  // No perfil Claude, a transcrição é irmã da pasta da sessão. O diretório de projeto
  // codificado pode corresponder a mais de um caminho e uma sessão pode mudar de cwd.
  const workflows = dirname(path), sessao = dirname(workflows), projeto = dirname(sessao);
  const perfil = resolve(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'));
  if (basename(workflows) === 'workflows' && dirname(projeto) === join(perfil, 'projects')) {
    const idSessao = basename(sessao), transcricao = join(projeto, idSessao + '.jsonl');
    let bytes;
    try { bytes = lerBytes(transcricao, 64 * 1024 * 1024); }
    catch (e) {
      if (e.code !== 'ENOENT') return { evidencia: 'origem em conferência: transcrição ilegível ou acima do limite de leitura' };
    }
    if (bytes) {
      const id = Buffer.from(dados.runId);
      for (let pos = 0; pos < bytes.length;) {
        const quebra = bytes.indexOf(10, pos), fim = quebra < 0 ? bytes.length : quebra;
        const linha = bytes.subarray(pos, fim);
        pos = fim + 1;
        if (!linha.includes(id)) continue;
        let evento;
        try { evento = JSON.parse(linha.toString('utf8')); }
        catch { return { evidencia: 'origem em conferência: registro da sessão incompleto' }; }
        if (evento?.type === 'user' && evento.sessionId === idSessao && evento.toolUseResult?.runId === dados.runId
            && evento.toolUseResult.taskId === dados.taskId) registrar(evento.cwd);
      }
    }
  }
  if (!bases.size) return { evidencia: 'origem da execução sem confirmação' };
  const pastas = new Set();
  for (const caminho of bases) {
    if (caminho.split(sep === '/' ? '/' : /[\\/]/).includes('..')) return { evidencia: 'caminho de origem ambíguo' };
    pastas.add(resolve(caminho));
  }
  if (pastas.size !== 1) return { evidencia: 'origem em conferência: pastas de trabalho divergentes' };
  const [base] = pastas, rel = relative(raiz, base);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    return { evidencia: 'origem da execução fora da raiz examinada. Para conferir os arquivos, use --root com uma pasta que inclua a origem' };
  }
  // Um link no caminho pode ter mudado desde a execução, mesmo se o último diretório já sumiu.
  let atual = parse(base).root;
  try {
    for (const nome of base.slice(atual.length).split(sep)) {
      atual = join(atual, nome);
      const st = lstatSync(atual);
      if (st.isSymbolicLink()) return { evidencia: 'origem da execução passa por um link. Confira a pasta física na sessão original' };
      if (!st.isDirectory()) return { evidencia: 'pasta de origem não confirmada' };
    }
  } catch (e) {
    if (e.code === 'ENOENT') return { base, disponivel: false, evidencia: 'pasta de origem identificada, atualmente indisponível' };
    return { evidencia: 'pasta de origem inacessível' };
  }
  return { base, disponivel: true };
}

function orientarReplayClaude(dados, origem) {
  const conferir = { proximaAcao: 'Confira em /workflows, na sessão original, qual chamada falhou e quais etapas poderiam repetir trabalho ou custos. O registro não confirma o ponto de retomada.' };
  const agentes = Array.isArray(dados.workflowProgress) ? dados.workflowProgress.filter(e => e?.type === 'workflow_agent') : [];
  if (!agentes.length || agentes.length !== dados.agentCount ||
      !agentes.every(e => Number.isSafeInteger(e.index) && texto(e.label) && ['done', 'error', 'progress'].includes(e.state))) return conferir;
  // O index registra a ordem de enfileiramento. Chamadas paralelas podem começar em outra ordem.
  agentes.sort((a, b) => a.index - b.index);
  if (!agentes.every((e, i) => e.index === i + 1)) return conferir;
  const primeira = agentes.find(e => e.state !== 'done');
  if (!primeira) return { proximaAcao: 'Todas as chamadas registradas terminaram. Com os mesmos prompts, o Claude reaproveita as respostas salvas. Confira o resultado e os efeitos no workspace antes de decidir quais etapas precisam ser executadas de novo.' };
  if (primeira.state !== 'error') return conferir;
  if (primeira.index < agentes.length) {
    const ultima = agentes.at(-1);
    return { proximaAcao: `A primeira falha registrada foi a chamada ${primeira.index} (${primeira.label}). O replay pode repetir essa chamada e as posteriores, até a ${ultima.index} (${ultima.label}). Confira em /workflows os efeitos e custos desse trecho, inclusive os de geração ou crítica que já ocorreram.` };
  }

  const { fase, detalhe, acao } = dados.result;
  const semResposta = [detalhe, acao].some(s => texto(s) && /não retornou(?:$|[\s.,;—])/iu.test(s));
  if (!semResposta || !texto(fase) || primeira.phaseTitle !== fase) return conferir;
  const passos = [];
  if (!origem.base) passos.push('Confirme a pasta de origem na sessão original.');
  else if (!origem.disponivel) passos.push('Recupere e confira a pasta de origem.');
  passos.push(`Na mesma sessão do Claude, confira em /workflows os efeitos da chamada ${primeira.index} (${primeira.label}), que terminou com erro na fase ${fase}. Para repeti-la com os mesmos prompts, peça a reinvocação com resumeFromRunId igual a ${dados.runId}.`);
  return { retomar: passos.join(' ') };
}

function estadoClaude(dados, origem, raiz) {
  if (dados.status === 'completed') {
    const final = resultadoFinal(dados.result, origem.disponivel ? origem.base : null, raiz);
    // Apenas a instrução afirmativa dos controladores. Alguns erros citam o ID para pedir um run novo.
    const acao = dados.result?.acao;
    if (final.desfecho === 'erro' && !final.proximaAcao && texto(acao) && /(?:^|[;.—]\s*)reinvocar com resumeFromRunId(?=$|[;.]| \()/i.test(acao)) {
      return { ...final, ...orientarReplayClaude(dados, origem) };
    }
    return final;
  }
  if (dados.status === 'running') return { estado: 'ativa', evidencia: 'running no registro do executor; conferir a atividade atual na sessão' };
  if (dados.status === 'paused') return { estado: 'retomavel', retomar: 'Na sessão original, abra /workflows, selecione a execução e pressione p.' };
  if (['killed', 'failed'].includes(dados.status)) return { estado: 'interrompida',
    evidencia: 'Confira a execução em /workflows na sessão original. Para reaproveitar o progresso salvo, peça para relançar o mesmo script e confira os efeitos das etapas interrompidas.' };
  return { estado: 'desconhecido' };
}

function registroClaude(path, dados, raiz) {
  if (!objeto(dados) || !texto(dados.runId) || !/^wf_[a-zA-Z0-9_-]+$/.test(dados.runId) || basename(path) !== dados.runId + '.json'
      || !texto(dados.taskId) || typeof dados.script !== 'string' || !Object.hasOwn(dados, 'status')) return null;
  const origem = origemClaude(path, dados, raiz);
  const run = { executor: 'Claude Workflow', runId: dados.runId, registro: path, ...estadoClaude(dados, origem, raiz) };
  if (origem.base) {
    run.pastaDeOrigem = origem.base;
    run.origemDisponivel = origem.disponivel;
  }
  if (origem.evidencia) run.evidencia = [origem.evidencia, run.evidencia].filter(Boolean).join('. ');
  return run;
}

function travaAberta(dir, lock) {
  const dono = lerJson(lock);
  if (!objeto(dono) || dono.host !== hostname() || dono.runDir !== dir || !Number.isSafeInteger(dono.pid) || dono.pid <= 0) return false;
  // PID vivo pode ter sido reutilizado. Exigir que ele ainda tenha esta trava aberta.
  return spawnSync('lsof', ['-nP', '-a', '-p', String(dono.pid), '--', lock], {
    timeout: 2000, stdio: 'ignore',
  }).status === 0;
}

function interrupcao(dir, run) {
  const lock = join(dir, '.lock'), tmp = join(dir, 'state.tmp');
  if (lstatSync(lock, { throwIfNoEntry: false })) {
    let aberta = false;
    try { aberta = travaAberta(dir, lock); } catch { /* trava incompleta exige reconciliação */ }
    return { ...run, estado: aberta ? 'ativa' : 'desconhecido',
      evidencia: aberta ? 'o processo do executor mantém a trava aberta' : 'trava sem escritor confirmado; reconciliar no executor' };
  }
  if (lstatSync(tmp, { throwIfNoEntry: false })) return { ...run, evidencia: 'state.tmp presente; reconciliar a gravação no executor' };
  return null;
}

function registroCodex(dir, dados, pacote, base, raiz) {
  if (!objeto(dados) || dados.version !== 1 || !texto(dados.runId) || !plugins.has(dados.plugin)
      || !/^[a-f0-9]{64}$/.test(dados.fingerprint) || !/^[a-f0-9]{64}$/.test(dados.argsHash)
      || !objeto(dados.args) || !objeto(dados.respostas)) return null;
  const registro = join(dir, 'state.json');
  // As respostas aceitas podem registrar trabalho antes do relatório final.
  const tocados = new Map();
  for (const resposta of Object.values(dados.respostas)) {
    const relato = resposta?.resultado;
    if (!Array.isArray(relato?.arquivosTocados)) continue;
    for (const caminho of relato.arquivosTocados) {
      if (!texto(caminho)) continue;
      let pasta = '.';
      if (dados.plugin === 'mimyr' && !isAbsolute(caminho) && (relato.baseArquivosTocados ?? 'workspace') !== 'workspace') {
        pasta = relato.baseArquivosTocados === 'curso' && texto(dados.args.cursoDir) ? dados.args.cursoDir : null;
      }
      const chave = JSON.stringify([pasta, caminho]);
      if (!tocados.has(chave)) tocados.set(chave, conferirArquivo(caminho, base, raiz, pasta));
    }
  }
  const run = { executor: 'Hefesto Codex', plugin: dados.plugin, runId: dados.runId, registro, estado: 'desconhecido',
    arquivosTocados: [...tocados.values()],
    intermediarios: [{ caminho: registro, verificacao: 'checkpoint lido' }] };
  const verificar = interrupcao(dir, run);
  if (verificar) return verificar;
  if (!pacote) return { ...run, evidencia: 'consultar proximo no pacote de origem para determinar o estado' };
  // O executável vem exclusivamente da instalação indicada pelo chamador, nunca do registro.
  const bridge = join(pacote, 'runtime', 'bridge.mjs');
  let manifesto;
  try { manifesto = lerJson(join(pacote, '.codex-plugin', 'plugin.json')); }
  catch { return { ...run, limite: 'manifesto do pacote de origem ilegível' }; }
  if (manifesto?.name !== dados.plugin) {
    return { ...run, evidencia: 'o pacote indicado não corresponde ao executor do registro' };
  }
  const args = [bridge, 'proximo', dir];
  const consulta = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 10000, maxBuffer: limite, stdio: ['ignore', 'pipe', 'pipe'] });
  if (consulta.status !== 0) return { ...run, evidencia: 'proximo não confirmou o estado; conferir a versão original do pacote e a integridade do registro' };
  const resposta = JSON.parse(consulta.stdout);
  const mudou = interrupcao(dir, run);
  if (mudou) return mudou;
  if (resposta?.status === 'aguardando' && Array.isArray(resposta.solicitacoes) && resposta.solicitacoes.length) {
    return { ...run, estado: 'aguardando', pendentes: resposta.solicitacoes.length, atividadeDaSessao: 'desconhecida',
      evidencia: 'o controlador aguarda resposta; confira quem está atendendo ao pedido na sessão de origem' };
  }
  if (resposta?.status === 'concluido' && objeto(resposta.resultado)) {
    const final = resultadoFinal(resposta.resultado, base, raiz);
    return { ...run, ...final, intermediarios: [...run.intermediarios, ...final.intermediarios] };
  }
  return run;
}

// Aceita diretório do bridge ou arquivo do executor. Outro formato continua preservado.
export function inspecionarExecucao(alvo, raiz, pacote) {
  const desconhecida = { estado: 'desconhecido' };
  try {
    const baseDosArquivos = dados => texto(dados?.args?.workspaceRoot) && isAbsolute(dados.args.workspaceRoot) ? dados.args.workspaceRoot : raiz;
    if (alvo.split(sep).some((p, i, partes) => p === '.github' && partes[i + 1] === 'workflows')) {
      return { ...desconhecida, evidencia: 'definição do workflow do projeto' };
    }
    if (realpathSync(alvo) !== alvo) return { ...desconhecida, evidencia: 'caminho redirecionado' };
    const st = lstatSync(alvo);
    if (st.isDirectory() || basename(alvo) === 'state.json') {
      const dir = st.isDirectory() ? alvo : dirname(alvo);
      const path = join(dir, 'state.json');
      const antes = lstatSync(path, { bigint: true, throwIfNoEntry: false });
      if (!antes) return desconhecida;
      const dados = lerJson(path);
      const run = registroCodex(dir, dados, pacote && resolve(pacote), baseDosArquivos(dados), raiz);
      const depois = lstatSync(path, { bigint: true, throwIfNoEntry: false });
      if (!depois || antes.dev !== depois.dev || antes.ino !== depois.ino || antes.ctimeNs !== depois.ctimeNs) {
        return { ...desconhecida, evidencia: 'registro mudou durante a consulta; repetir no executor' };
      }
      return run || desconhecida;
    }
    if (st.isFile() && /^wf_[a-zA-Z0-9_-]+\.json$/.test(basename(alvo))) {
      const dados = lerJson(alvo);
      return registroClaude(alvo, dados, raiz) || desconhecida;
    }
    return desconhecida;
  } catch (e) {
    return { ...desconhecida, limite: e.code || (e instanceof SyntaxError ? 'JSON inválido' : e.message) };
  }
}
