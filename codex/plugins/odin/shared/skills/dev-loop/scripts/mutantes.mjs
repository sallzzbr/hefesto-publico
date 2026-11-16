#!/usr/bin/env node
// Mutação textual das linhas que a entrega acrescentou (odin 3.1.0, fase Mutar do dev-loop). Mede se
// os testes da SPEC (e os reforços aceitos) percebem uma troca de comportamento no código novo. A
// worktree nunca é tocada: cada mutante é aplicado numa cópia descartável, e o script confere no fim
// que a worktree está como estava.
//
//   medir <baseRef|HEAD> '<excluidos-json>' '<comandos-json>'
//         [--vincular '<json>'] [--pai <dir>] [--max <n, até 20>] [--timeout <segundos por comando>]
//         [--prioridade '<json [{path, trecho, operador, de, para}]>']
//
// Cada mutante traz `mortoPor`: o primeiro comando que o derrubou (null se sobreviveu), para o harness
// só aceitar reforço cujo comando dele matou o mutante; e `trecho`, a linha original sem espaços nas
// pontas, que com path, operador, de e para identifica a mesma troca quando a linha muda de número.
// A amostra: o rodízio por arquivo decide a cota de cada um; dentro dele, um mutante por linha, com
// passo uniforme do começo ao fim (decisão do dono, 2026-11-16: antes saíam só as primeiras linhas);
// só o teto que sobra volta às outras trocas de uma linha já amostrada.
// `--prioridade` põe antes, dentro do teto, a mesma troca de um sobrevivente real pendente.
// Saída: um JSON em stdout com `conferencia`, o CRC-32 da serialização canônica (chaves em ordem
// alfabética, sem espaços) do resto, no mesmo algoritmo do `crc32` do harness, que recalcula e recusa
// transcrição errada. Erro de argumento ou de ambiente sai diferente de 0 com a mensagem em stderr,
// nunca com JSON parcial.
//
// Operadores textuais, sem AST: comparação, lógicos, booleanos e `return <expr>` (vira null/None).
// Linha de comentário e texto entre aspas não geram mutante; o resíduo (regex, JSX, genéricos) vira
// sobrevivente que o confirmador de equivalência descarta. `<` e `>` soltos só valem com espaço dos
// dois lados, para não tocar em seta, genérico e anotação de tipo.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, chmodSync, constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, posix, relative, resolve } from 'node:path';

const LIMITE = 20;
const TIMEOUT_PADRAO = 120;
const ELEGIVEL = /\.(?:js|mjs|cjs|ts|tsx|jsx|py)$/;
const env = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
const git = (args, opcoes = {}) => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.quotepath=false', ...args], {
  env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'], ...opcoes,
});
const lstatExiste = p => { try { lstatSync(p); return true; } catch { return false; } };
// Só arquivo regular de texto UTF-8 conta e vira mutante: link simbólico seria lido pelo alvo (que pode
// estar fora do workspace) e binário não tem linha a mutar.
const textoRegular = p => {
  if (!lstatSync(p).isFile()) return false;
  const bytes = readFileSync(p);
  return !bytes.includes(0) && Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes);
};
const dentro = (base, alvo) => { const r = relative(base, alvo); return r === '' || (!isAbsolute(r) && r !== '..' && !r.startsWith('../') && !r.startsWith('..\\')); };
const relativoSeguro = p => typeof p === 'string' && p.trim() && p === p.trim() && !isAbsolute(p) && !/[:\\\x00-\x1f]/.test(p) && !p.split('/').some(x => x === '..' || x.toLowerCase() === '.git');
const listaJson = (texto, nome, { vazio, item, descricao }) => {
  let v;
  try { v = JSON.parse(texto); } catch { throw new Error(`${nome}: JSON inválido`); }
  if (!Array.isArray(v) || (!vazio && !v.length) || !v.every(item)) throw new Error(`${nome}: esperado array JSON${vazio ? '' : ' não vazio'} de ${descricao ?? (item === relativoSeguro ? 'paths relativos' : 'comandos (texto não vazio)')}`);
  return v;
};

// CRC-32 (IEEE) em JS puro, byte a byte igual ao `crc32` de `harness/loop.mjs` (o harness não
// importa módulos): unidade UTF-16 abaixo de 256 vale um byte, as demais dois.
function crc32(texto) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < texto.length; i++) {
    const u = texto.charCodeAt(i);
    for (const b of u < 256 ? [u] : [u & 0xFF, u >>> 8]) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
    }
  }
  return ((c ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}
const ordenado = v => Array.isArray(v) ? v.map(ordenado)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, ordenado(v[k])])) : v;

function opcoes(resto) {
  const o = {};
  for (let i = 0; i < resto.length; i += 2) {
    if (!['--vincular', '--pai', '--max', '--timeout', '--prioridade'].includes(resto[i]) || resto[i + 1] === undefined) throw new Error(`opção inválida: ${resto[i]}`);
    o[resto[i].slice(2)] = resto[i + 1];
  }
  const inteiro = (nome, padrao) => {
    if (o[nome] === undefined) return padrao;
    if (!/^[1-9]\d*$/.test(o[nome])) throw new Error(`--${nome}: inteiro positivo esperado`);
    return Number(o[nome]);
  };
  return {
    pai: o.pai,
    vincular: o.vincular === undefined ? [] : listaJson(o.vincular, '--vincular', { vazio: true, item: relativoSeguro }),
    max: Math.min(inteiro('max', LIMITE), LIMITE),
    timeout: inteiro('timeout', TIMEOUT_PADRAO),
    prioridade: o.prioridade === undefined ? [] : listaJson(o.prioridade, '--prioridade', { vazio: true, item: x => x && typeof x === 'object' && relativoSeguro(x.path) && ['trecho', 'operador', 'de', 'para'].every(k => typeof x[k] === 'string' && x[k]), descricao: 'objetos { path, trecho, operador, de, para }' }),
  };
}

// Marca, caractere a caractere, o que é código: comentário (`//`, `/* */` em JS; `#` em Python) e
// texto entre aspas (inclusive crase em JS e aspas triplas em Python) ficam de fora.
function mascaraDeCodigo(texto, py) {
  const n = texto.length;
  const codigo = new Uint8Array(n);
  let i = 0;
  while (i < n) {
    const c = texto[i];
    if ((!py && c === '/' && texto[i + 1] === '/') || (py && c === '#')) { while (i < n && texto[i] !== '\n') i++; continue; }
    if (!py && c === '/' && texto[i + 1] === '*') { const f = texto.indexOf('*/', i + 2); i = f < 0 ? n : f + 2; continue; }
    if (c === '"' || c === "'" || (!py && c === '`')) {
      const triplo = py && texto.startsWith(c.repeat(3), i);
      const aspas = triplo ? c.repeat(3) : c;
      i += aspas.length;
      while (i < n && !texto.startsWith(aspas, i)) {
        if (texto[i] === '\\') i++;
        else if (c !== '`' && !triplo && texto[i] === '\n') break;
        i++;
      }
      i = Math.min(n, i + (texto.startsWith(aspas, i) ? aspas.length : 0));
      continue;
    }
    codigo[i] = 1;
    i++;
  }
  return codigo;
}

const COMPARACAO = /(?<![<>=!])(?:===|!==|==|!=|>=|<=)(?!=)|(?<=\s)[<>](?=\s)/g;
const TROCA_COMPARACAO = { '===': '!==', '!==': '===', '==': '!=', '!=': '==', '>=': '<', '<=': '>', '>': '<=', '<': '>=' };
const equilibrado = expr => {
  let nivel = 0;
  for (const ch of expr) { if ('([{'.includes(ch)) nivel++; else if (')]}'.includes(ch) && --nivel < 0) return false; }
  return nivel === 0;
};

// Mutantes de uma linha (`linha` com o que não é código trocado por \u0001), ordenados pela coluna.
function mutantesDaLinha(linha, codigo, py) {
  const achados = [];
  const mira = (operador, regex, para) => { for (const m of codigo.matchAll(regex)) achados.push({ operador, inicio: m.index, fim: m.index + m[0].length, de: m[0], para: para(m[0]) }); };
  mira('comparacao', COMPARACAO, de => TROCA_COMPARACAO[de]);
  if (py) {
    mira('logico', /(?<![\w.])(?:and|or)(?!\w)/g, de => (de === 'and' ? 'or' : 'and'));
    mira('booleano', /(?<![\w.])(?:True|False)(?!\w)/g, de => (de === 'True' ? 'False' : 'True'));
  } else {
    mira('logico', /&&|\|\|/g, de => (de === '&&' ? '||' : '&&'));
    mira('booleano', /(?<![\w.$])(?:true|false)(?![\w$])/g, de => (de === 'true' ? 'false' : 'true'));
  }
  const ret = /(?<![\w.$])return\s+/.exec(codigo);
  if (ret) {
    const inicio = ret.index + ret[0].length;
    const fimExpr = codigo.indexOf(';', inicio);
    const bruto = codigo.slice(inicio, fimExpr < 0 ? codigo.length : fimExpr);
    const expr = bruto.trim();
    const neutro = py ? /^(?:None|True|False)$/ : /^(?:null|undefined|true|false)$/;
    if (expr && !neutro.test(expr) && !/[\u0001]/.test(expr) && equilibrado(expr) && !/[,(\[{+\-*/%&|^<>=?:.\\]$/.test(expr)) {
      achados.push({ operador: 'retorno', inicio, fim: inicio + bruto.trimEnd().length, de: linha.slice(inicio, inicio + bruto.trimEnd().length), para: py ? 'None' : 'null' });
    }
  }
  const vistos = {};
  return achados.sort((a, b) => a.inicio - b.inicio || a.operador.localeCompare(b.operador)).map(m => ({ ...m, ocorrencia: vistos[m.operador] = (vistos[m.operador] ?? -1) + 1 }));
}

// Linhas (1-based) acrescentadas por arquivo elegível contra a base: o diff dos arquivos rastreados e
// o arquivo inteiro para o que a base não tem (novo, commitado ou não, não ignorado).
function linhasAcrescentadas(sha, excluidos, arquivos) {
  const naBase = new Set(git(['ls-tree', '-r', '--name-only', '-z', sha]).split('\0').filter(Boolean));
  const elegivel = p => ELEGIVEL.test(p) && !excluidos.has(p) && arquivos.has(p) && textoRegular(p);
  const alterados = git(['diff', '--name-only', '-z', '--no-renames', '--no-ext-diff', '--diff-filter=ACMT', sha, '--']).split('\0').filter(Boolean);
  const porArquivo = new Map();
  for (const p of [...new Set([...alterados, ...arquivos])].sort()) {
    if (!elegivel(p)) continue;
    if (!naBase.has(p)) {
      // Arquivo novo: toda a extensão do arquivo, contada pelos segmentos do split (inclui o vazio final).
      porArquivo.set(p, { novo: true, total: readFileSync(p, 'utf8').split('\n').length });
      continue;
    }
    const linhas = new Set();
    for (const h of git(['diff', '-U0', '--no-color', '--no-ext-diff', '--no-textconv', sha, '--', p]).split('\n')) {
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(h);
      if (m) for (let k = 0; k < Number(m[2] ?? 1); k++) linhas.add(Number(m[1]) + k);
    }
    if (linhas.size) porArquivo.set(p, { novo: false, linhas, total: linhas.size });
  }
  return porArquivo;
}

function candidatosDe(porArquivo) {
  const porPath = new Map();
  for (const [path, info] of porArquivo) {
    // `linhasAcrescentadas` já deixou de fora link simbólico e binário (`textoRegular`).
    const texto = readFileSync(path, 'utf8');
    const py = path.endsWith('.py');
    const codigo = mascaraDeCodigo(texto, py);
    const linhas = texto.split('\n');
    const lista = [];
    let offset = 0;
    linhas.forEach((linha, idx) => {
      const numero = idx + 1;
      if (info.novo || info.linhas.has(numero)) {
        // Por unidade UTF-16, como a máscara: iterar por code point deslocaria o corte depois de um emoji.
        let soCodigo = '';
        for (let k = 0; k < linha.length; k++) soCodigo += codigo[offset + k] ? linha[k] : '\u0001';
        for (const m of mutantesDaLinha(linha, soCodigo, py)) {
          lista.push({ id: `${path}:${numero}:${m.operador}:${m.ocorrencia}`, path, linha: numero, trecho: linha.trim(), operador: m.operador, de: m.de, para: m.para, aplicar: linha.slice(0, m.inicio) + m.para + linha.slice(m.fim) });
        }
      }
      offset += linha.length + 1;
    });
    if (lista.length) porPath.set(path, lista);
  }
  return porPath;
}

const mesmaTroca = (p, c) => c.path === p.path && c.trecho === p.trecho && c.operador === p.operador && c.de === p.de && c.para === p.para;
function amostra(porPath, max, prioridade) {
  const todos = [...porPath.values()].flat();
  const saida = [];
  for (const p of prioridade) {
    const c = todos.find(x => !saida.includes(x) && mesmaTroca(p, x));
    if (c && saida.length < max) saida.push(c);
  }
  const paths = [...porPath.keys()].sort();
  const porLinha = new Map(paths.map(p => {
    const vistas = new Set();
    return [p, porPath.get(p).filter(c => !saida.includes(c) && !vistas.has(c.linha) && vistas.add(c.linha))];
  }));
  const cota = new Map(paths.map(p => [p, 0]));
  let resta = max - saida.length;
  while (resta > 0 && paths.some(p => cota.get(p) < porLinha.get(p).length)) {
    for (const p of paths) if (resta > 0 && cota.get(p) < porLinha.get(p).length) { cota.set(p, cota.get(p) + 1); resta--; }
  }
  for (const p of paths) {
    const linhas = porLinha.get(p), k = cota.get(p);
    for (let i = 0; i < k; i++) saida.push(linhas[Math.floor((i * linhas.length) / k)]);
  }
  // Teto sobrando (entrega com menos linhas que o teto): as outras trocas das mesmas linhas, em rodízio.
  const filas = paths.map(p => porPath.get(p).filter(c => !saida.includes(c)));
  while (saida.length < max && filas.some(f => f.length)) for (const f of filas) if (f.length && saida.length < max) saida.push(f.shift());
  return saida;
}

function digestDaWorktree(arquivos) {
  const h = createHash('sha256');
  for (const p of [...arquivos].sort()) {
    const st = lstatSync(p);
    h.update(`${p}\0${st.mode}\0`);
    h.update(st.isSymbolicLink() ? readlinkSync(p) : st.isFile() ? readFileSync(p) : '');
  }
  return h.digest('hex');
}

function arquivosDaWorktree() {
  return new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(p => {
    if (!p) return false;
    try { const st = lstatSync(p); return st.isFile() || st.isSymbolicLink(); } catch { return false; }
  }));
}

function criarCopia(root, arquivos, opts) {
  const pai = resolve(opts.pai ?? tmpdir());
  if (!existsSync(pai)) throw new Error(`diretório pai da cópia não existe: ${pai}`);
  try { accessSync(pai, constants.W_OK); } catch (e) { throw new Error(`diretório pai da cópia não é gravável: ${pai} (${e.code}); isto é ambiente. Passe --pai <dir gravável>.`); }
  // Dentro do workspace só em diretório ignorado pelo Git: senão a cópia vira arquivo novo da entrega.
  if (dentro(root, realpathSync(pai))) {
    try { git(['check-ignore', '-q', relative(root, realpathSync(pai)) || '.']); }
    catch { throw new Error(`diretório pai da cópia dentro do workspace precisa ser ignorado pelo Git: ${pai}. Passe --pai <dir ignorado ou fora do workspace>.`); }
  }
  const dir = realpathSync(mkdtempSync(join(pai, 'odin-mutar-')));
  copiaAtual = dir;
  try {
    for (const p of arquivos) {
      const destino = join(dir, p);
      mkdirSync(dirname(destino), { recursive: true });
      const st = lstatSync(p);
      if (st.isSymbolicLink()) symlinkSync(readlinkSync(p), destino);
      else { copyFileSync(p, destino); chmodSync(destino, st.mode & 0o777); }
    }
    for (const p of opts.vincular.map(x => posix.normalize(x))) {
      const origem = resolve(root, p);
      if (!existsSync(origem) || !lstatSync(origem).isDirectory()) continue;
      // Cada componente até o vínculo precisa ser diretório real da cópia: um link copiado (lib -> ../x)
      // levaria o vínculo para fora dela. Mesma defesa do `destinoSeguro` de copia-base.mjs.
      let atual = dir;
      for (const parte of dirname(p).split('/').filter(x => x && x !== '.')) {
        atual = join(atual, parte);
        if (!lstatExiste(atual)) mkdirSync(atual);
        else if (lstatSync(atual).isSymbolicLink() || !lstatSync(atual).isDirectory()) throw new Error(`--vincular ${p}: ${relative(dir, atual)} é link simbólico ou arquivo na cópia; o vínculo não é criado através dele`);
      }
      if (lstatExiste(join(dir, p))) continue;
      symlinkSync(origem, join(dir, p), process.platform === 'win32' ? 'junction' : undefined);
    }
    // Sem .git própria, `git` rodado na cópia subiria ao repositório que a contém; o gitfile inválido
    // faz o git falhar ali em vez de operar no índice e nas refs do projeto.
    writeFileSync(join(dir, '.git'), 'odin: copia descartavel sem repositorio\n');
    return dir;
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    copiaAtual = null;
    throw e;
  }
}

// Roda o comando num grupo de processos próprio e, no timeout, mata o grupo inteiro: o laço infinito
// que o mutante provoca mora num filho do shell, e matar só o shell o deixaria órfão consumindo CPU.
// Falha ao iniciar o comando é ambiente e interrompe a medição; nunca vale como mutante morto.
// Sinal (o Bash que estoura o próprio timeout, Ctrl-C) pula o `finally`: sem isto a cópia ficava no
// diretório temporário e o comando em andamento seguia órfão. Limpa, sai com 128+n e nada em stdout.
let pararComando = null;
let copiaAtual = null;
for (const [sinal, n] of [['SIGTERM', 15], ['SIGINT', 2], ['SIGHUP', 1]]) process.on(sinal, () => {
  pararComando?.();
  if (copiaAtual) rmSync(copiaAtual, { recursive: true, force: true });
  process.stderr.write(`mutantes.mjs interrompido por ${sinal}; cópia removida, nada medido\n`);
  process.exit(128 + n);
});
const rodar = (comando, cwd, timeout) => new Promise((ok, falha) => {
  const win = process.platform === 'win32';
  const filho = spawn(comando, { cwd, shell: true, env, stdio: 'ignore', detached: !win });
  let estourou = false;
  const matar = () => {
    try { if (win) spawnSync('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { stdio: 'ignore' }); else process.kill(-filho.pid, 'SIGKILL'); } catch { /* grupo já encerrado */ }
  };
  pararComando = matar;
  const relogio = setTimeout(() => { estourou = true; matar(); }, timeout * 1000);
  filho.on('error', e => { clearTimeout(relogio); matar(); pararComando = null; falha(new Error(`ambiente: não foi possível executar o comando (${e.code ?? e.message}): ${comando}`)); });
  filho.on('close', status => { clearTimeout(relogio); matar(); pararComando = null; ok(estourou ? -1 : status ?? -1); });
});

async function medir(baseRef, excluidosJson, comandosJson, resto) {
  const root = realpathSync(git(['rev-parse', '--show-toplevel']).trim());
  if (root !== realpathSync(process.cwd())) throw new Error('execute da raiz física do workspace');
  if (typeof baseRef !== 'string' || !/^[A-Za-z0-9._/~^@{}-]+$/.test(baseRef) || baseRef.startsWith('-') || baseRef.includes('..')) throw new Error(`base inválida: ${baseRef}`);
  const excluidos = new Set(listaJson(excluidosJson, 'excluídos', { vazio: true, item: relativoSeguro }).map(p => posix.normalize(p)));
  const comandos = listaJson(comandosJson, 'comandos', { vazio: false, item: c => typeof c === 'string' && c.trim() });
  const opts = opcoes(resto);
  let sha;
  try { sha = git(['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]).trim(); } catch { sha = ''; }
  if (!/^[0-9a-f]{40,64}$/.test(sha)) throw new Error(`base não resolve para commit: ${baseRef}`);

  const arquivos = arquivosDaWorktree();
  const antes = digestDaWorktree(arquivos);
  const porArquivo = linhasAcrescentadas(sha, excluidos, arquivos);
  const porPath = candidatosDe(porArquivo);
  const candidatos = [...porPath.values()].reduce((s, l) => s + l.length, 0);
  const sorteados = candidatos ? amostra(porPath, opts.max, opts.prioridade) : [];
  const acrescentadas = Object.fromEntries([...porArquivo].map(([p, i]) => [p, i.total]));

  let controle = { ok: false, execucoes: [] };
  let mutantes = [];
  let removida = true;
  if (sorteados.length) {
    const dir = criarCopia(root, arquivos, opts);
    try {
      for (const comando of comandos) controle.execucoes.push({ comando, exitCode: await rodar(comando, dir, opts.timeout) });
      controle.ok = controle.execucoes.every(e => e.exitCode === 0);
      if (controle.ok) {
        for (const m of sorteados) {
          const alvo = join(dir, m.path);
          if (lstatSync(alvo).isSymbolicLink() || !dentro(dir, realpathSync(alvo))) throw new Error(`alvo do mutante fora da cópia: ${m.id}`);
          const original = readFileSync(alvo);
          const linhas = original.toString('utf8').split('\n');
          linhas[m.linha - 1] = m.aplicar;
          writeFileSync(alvo, linhas.join('\n'));
          let mortoPor = null;
          try {
            if (readFileSync(alvo).equals(original)) throw new Error(`mutante não alterou os bytes: ${m.id}`);
            for (const c of comandos) if (await rodar(c, dir, opts.timeout) !== 0) { mortoPor = c; break; }
          } finally { writeFileSync(alvo, original); }
          if (!readFileSync(alvo).equals(original)) throw new Error(`restauração falhou: ${m.id}`);
          const { aplicar: _aplicar, ...publico } = m;
          mutantes.push({ ...publico, resultado: mortoPor === null ? 'sobrevivente' : 'morto', mortoPor });
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
      copiaAtual = null;
      removida = !existsSync(dir);
    }
  }
  const resultado = {
    base: baseRef, candidatos, amostrados: mutantes.length, linhasAcrescentadas: acrescentadas, controle, mutantes, removida,
    worktreeIntacta: digestDaWorktree(arquivos) === antes && [...arquivosDaWorktree()].sort().join('\0') === [...arquivos].sort().join('\0'),
  };
  return { ...resultado, conferencia: crc32(JSON.stringify(ordenado(resultado))) };
}

try {
  const [modo, a, b, c, ...resto] = process.argv.slice(2);
  if (modo !== 'medir' || a === undefined || b === undefined || c === undefined) throw new Error("uso: mutantes.mjs medir <baseRef|HEAD> '<excluidos-json>' '<comandos-json>' [--vincular '<json>'] [--pai <dir>] [--max <n>] [--timeout <s>] [--prioridade '<json>']");
  console.log(JSON.stringify(await medir(a, b, c, resto)));
} catch (e) {
  console.error(`ERRO: ${e.message}`);
  process.exitCode = 1;
}
