import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';

function arquivosAbertos() {
  // Só nomes de arquivos do usuário. Nenhum argumento de processo ou valor de ambiente sai no relatório.
  const r = spawnSync('/usr/sbin/lsof', ['-nP', '-a', '-u', String(process.getuid()), '-F0n'], {
    encoding: 'utf8', timeout: 20000, maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0 || r.stderr?.trim()) throw Error('lsof indisponível ou parcial');
  return r.stdout.split('\0').filter(f => f.startsWith('n/')).map(f => f.slice(1));
}

export function investigarUv({ raizes, executavel, home = homedir(), env = process.env, abertos = arquivosAbertos }) {
  if (executavel && !/^[\w][\w.+-]*$/.test(executavel)) throw Error('Informe somente o nome do executável em bin.');
  const cache = env.UV_CACHE_DIR || join(env.XDG_CACHE_HOME || join(home, '.cache'), 'uv');
  const ferramentas = env.UV_TOOL_DIR || join(env.XDG_DATA_HOME || join(home, '.local/share'), 'uv/tools');
  const arquivos = join(cache, 'archive-v0'), limites = [], ambientes = new Map(), ambientesDiretosNoIndice = [];
  const estruturaVenv = new Set(['bin', 'include', 'lib', 'lib64', 'share', 'pyvenv.cfg', 'CACHEDIR.TAG', '.gitignore', '.lock']);

  function entradas(dir) { return readdirSync(dir, { withFileTypes: true }); }
  function info(path) { return lstatSync(path, { throwIfNoEntry: false }); }
  function erro(path, e) { limites.push({ caminho: path, erro: e.code || e.message }); }
  function dono(path) {
    const rel = relative(arquivos, path);
    if (!rel || isAbsolute(rel) || rel.startsWith('..' + sep)) return;
    return ambientes.get(rel.split(sep)[0]);
  }

  const buckets = info(cache) ? entradas(cache) : [];
  const reconhecido = buckets.some(b => b.name === 'environments-v2' && b.isDirectory())
    && buckets.some(b => b.name === 'archive-v0' && b.isDirectory());
  if (!reconhecido) limites.push({ caminho: cache, erro: 'índices archive-v0 e environments-v2 não reconhecidos' });
  if (info(arquivos)?.isDirectory() && realpathSync(arquivos) === arquivos) {
    for (const arq of entradas(arquivos)) {
      if (!arq.isDirectory()) continue;
      const caminho = join(arquivos, arq.name);
      try {
        const cfg = join(caminho, 'pyvenv.cfg');
        if (!info(cfg)?.isFile()) continue;
        if (executavel) {
          const bin = join(caminho, 'bin');
          if (!info(bin)?.isDirectory()) continue;
          const entrada = info(join(bin, executavel));
          if (!entrada || (!entrada.isFile() && !entrada.isSymbolicLink())) continue;
        }
        const python = /^version_info\s*=\s*([\d.]+)\s*$/m.exec(readFileSync(cfg, 'utf8'))?.[1];
        const dist = [];
        const locais = entradas(caminho).filter(e => !estruturaVenv.has(e.name)).length;
        let fontesDiretas = 0;
        const lib = join(caminho, 'lib');
        if (info(lib)?.isDirectory()) for (const ver of entradas(lib)) {
          if (!ver.isDirectory() || !/^python\d+\.\d+t?$/.test(ver.name)) continue;
          const site = join(lib, ver.name, 'site-packages');
          if (!info(site)?.isDirectory()) continue;
          for (const d of entradas(site).filter(d => d.isDirectory() && d.name.endsWith('.dist-info'))) {
            dist.push(d.name);
            if (info(join(site, d.name, 'direct_url.json'))) fontesDiretas++;
          }
        }
        const composicao = python && dist.length ? createHash('sha256').update(JSON.stringify([python, dist.sort()])).digest('hex') : null;
        ambientes.set(arq.name, { caminho, python, composicao, pacotes: dist.length, itensExtrasNaRaiz: locais, fontesDiretas,
          indices: [], dependentes: [], arquivoAberto: false });
      } catch (e) { erro(caminho, e); }
    }
  } else if (info(arquivos)) limites.push({ caminho: arquivos, erro: 'arquivo de pacotes redirecionado' });

  // Classifica vínculos pelo local onde foram encontrados. Um índice descartável do uv
  // e uma .venv de projeto podem apontar para o mesmo ambiente, com consequências diferentes.
  const aliases = new Map();
  function examinar(path, origem, indice = false) {
    try {
      const st = info(path);
      if (!st) return;
      if (st.isSymbolicLink()) {
        let alvo;
        try { alvo = realpathSync(path); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
        const a = dono(alvo);
        if (a) {
          if (indice && alvo === a.caminho) { a.indices.push(path); aliases.set(path, a); }
          else if (!a.dependentes.includes(origem)) a.dependentes.push(origem);
        } else if (origem.startsWith('projeto ') && path === join(origem.slice(8), '.venv')) {
          limites.push({ caminho: path, erro: 'ambiente de projeto redirecionado para fora dos arquivos avaliados' });
        }
      } else if (st.isDirectory()) {
        if (indice && info(join(path, 'pyvenv.cfg'))?.isFile()) {
          ambientesDiretosNoIndice.push(path);
          origem = 'ambiente instalado diretamente no índice';
          indice = false;
        }
        for (const filho of entradas(path)) {
          if (filho.isDirectory() || filho.isSymbolicLink()) examinar(join(path, filho.name), origem, indice);
        }
      }
    } catch (e) { erro(path, e); }
  }
  if (ambientes.size) {
    if (env.VIRTUAL_ENV) {
      try {
        const atual = dono(realpathSync(env.VIRTUAL_ENV));
        if (atual) atual.dependentes.push('ambiente Python ativo nesta sessão');
      } catch (e) { erro('VIRTUAL_ENV', e); }
    }
    for (const b of buckets.filter(b => /^(environments|sdists|wheels)-v\d+$/.test(b.name))) {
      if (!b.isDirectory()) { limites.push({ caminho: join(cache, b.name), erro: 'índice redirecionado' }); continue; }
      examinar(join(cache, b.name), b.name, b.name === 'environments-v2');
    }
    examinar(ferramentas, 'instalações uv');
    const bin = env.UV_TOOL_BIN_DIR || env.XDG_BIN_HOME || join(home, '.local/bin');
    examinar(bin, 'executáveis do usuário');
    for (const root of raizes) examinar(join(root, '.venv'), 'projeto ' + root);
    try {
      for (const path of abertos()) {
        const a = dono(path);
        if (a) a.arquivoAberto = true;
        else if (path.startsWith(cache + sep)) {
          // lsof pode devolver o caminho do índice, inclusive de um arquivo sob ele.
          const partes = relative(cache, path).split(sep);
          let prefixo = cache;
          for (const parte of partes) {
            prefixo = join(prefixo, parte);
            const viaIndice = aliases.get(prefixo);
            if (viaIndice) { viaIndice.arquivoAberto = true; break; }
          }
        }
      }
    } catch (e) { erro('arquivos abertos do usuário', e); }
  }

  const candidatos = [...ambientes.values()].map(a => {
    const revisar = !limites.length && !a.arquivoAberto && !a.dependentes.length && !a.itensExtrasNaRaiz && !a.fontesDiretas && a.indices.length && a.composicao;
    const motivo = a.arquivoAberto ? 'arquivo aberto na amostra' : a.dependentes.length ? 'vínculo fora do índice de ambientes'
      : a.itensExtrasNaRaiz || a.fontesDiretas ? 'itens adicionais ou pacotes de fonte direta exigem verificação'
      : limites.length ? 'investigação incompleta' : !a.indices.length ? 'sem vínculo reconhecido de ambiente recriável'
      : !a.composicao ? 'composição desconhecida' : 'apenas referências de cache nas fontes examinadas; confirmar recriação e estado local';
    return { ...a, categoria: 'Ambientes Python do uv', classe: revisar ? 'revisar' : 'preservar', motivo };
  });
  return { candidatos, limites, cache, executavel, projetosExaminados: raizes, ambientesDiretosNoIndice };
}
