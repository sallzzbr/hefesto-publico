import { lstatSync, realpathSync, readdirSync, statfsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export function candidatosAmbiente(dados) {
  const porCaminho = new Map(dados.skills.map(s => [s.caminho, s]));
  const candidatos = [];
  for (const grupo of dados.sobreposicoes) {
    if (grupo.tipo !== 'conteúdo idêntico') continue;
    const copias = grupo.caminhos.map(p => porCaminho.get(p));
    // Conserva a fonte de projeto/usuário quando há uma cópia fornecida por plugin.
    copias.sort((a, b) => Number(Boolean(a.plugin)) - Number(Boolean(b.plugin)) || a.caminho.localeCompare(b.caminho));
    const vistos = new Set([copias[0].real]);
    for (const copia of copias.slice(1)) {
      if (vistos.has(copia.real)) continue;
      vistos.add(copia.real);
      candidatos.push({ caminho: copia.caminho, categoria: 'Skills duplicadas', classe: 'condicional', motivo: 'SKILL.md idêntico; confirmar qual instalação manter', grupo: grupo.chave });
    }
  }
  return candidatos;
}

export function candidatosResiduos(dados) {
  const candidatos = [];
  const registrados = new Set();
  for (const repo of dados.repositorios) {
    for (const w of repo.worktrees || []) {
      registrados.add(w.caminho);
      if (w.principal || w.bare || w.registroSemPasta) continue;
      const e = w.estado;
      const integrada = repo.branches.find(b => b.nome === w.branch)?.integradaNaBaseLocal;
      const revisavel = integrada === true && e && e.modificados === 0 && e.novos === 0 && e.ignorados === 0
        && !e.submodulosPossiveis && !e.filtrosExternosNeutralizados && !w.travada && w.operacoes?.length === 0;
      candidatos.push({ caminho: w.caminho, categoria: 'Worktrees Git', classe: revisavel ? 'condicional' : 'preservar',
        motivo: revisavel ? 'worktree limpa e integrada à base local; conferir sessão' : 'worktree com pendência ou preservação a verificar' });
    }
  }
  for (const a of dados.artefatos) {
    if (registrados.has(a.caminho)) continue;
    const marcador = a.origem === 'marcador de worktree Codex' && a.situacao.startsWith('somente marcador') && a.worktreeRegistrada === false;
    candidatos.push({ caminho: a.caminho, categoria: 'Resíduos de IA', classe: marcador ? 'condicional' : 'preservar',
      motivo: marcador ? 'pasta com marcador isolado; conferir chat' : 'artefato com origem ou uso a verificar' });
  }
  return candidatos;
}

const dentro = (pai, filho) => {
  const rel = relative(pai, filho);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel));
};

// O grupo sobreposto herda a classe mais cautelosa, inclusive quando uma pasta
// aparentemente descartável contém um item que precisa ser preservado.
function consolidar(candidatos) {
  const unicos = [];
  for (const item of candidatos.toSorted((a, b) => a.caminho.length - b.caminho.length)) {
    const pai = unicos.find(p => dentro(p.caminho, item.caminho));
    if (!pai) unicos.push({ ...item });
    else if (item.classe === 'preservar' || (item.classe === 'revisar' && pai.classe === 'condicional')) {
      pai.classe = item.classe;
      pai.motivo = item.caminho === pai.caminho ? item.motivo : 'contém item com restrição';
    }
  }
  return unicos;
}

export function medirEspaco(raizes, candidatos) {
  const volumes = new Map(), itens = [], limites = [], multiplos = new Set();
  const logico = process.platform === 'win32';
  function volume(caminho, st) {
    const id = String(st.dev);
    if (!volumes.has(id)) {
      let capacidadeBytes = null, disponivelBytes = null;
      try {
        const fs = statfsSync(caminho, { bigint: true });
        if (fs.blocks > 0n && fs.bsize > 0n) {
          capacidadeBytes = Number(fs.blocks * fs.bsize);
          disponivelBytes = Number(fs.bavail * fs.bsize);
        }
      } catch (e) { limites.push({ caminho, erro: e.code }); }
      volumes.set(id, { id, referencia: caminho, capacidadeBytes, disponivelBytes, potencialBytes: 0, revisarBytes: 0, preservarBytes: 0, hardlinksExcluidosBytes: 0, porCategoria: {} });
    }
    return volumes.get(id);
  }
  for (const raiz of raizes) volume(raiz, lstatSync(raiz, { bigint: true }));
  for (const item of consolidar(candidatos)) {
    const entrada = { ...item, bytes: null, volume: null, completa: false };
    itens.push(entrada);
    try {
      if (realpathSync(dirname(item.caminho)) !== resolve(dirname(item.caminho))) {
        limites.push({ caminho: item.caminho, erro: 'ancestral redirecionado' }); continue;
      }
      const inicial = lstatSync(item.caminho, { bigint: true });
      const v = volume(inicial.isSymbolicLink() ? dirname(item.caminho) : item.caminho, inicial);
      entrada.volume = v.id;
      entrada.bytes = 0;
      const errosAntes = limites.length;
      function contar(path, st) {
        if (st.dev !== inicial.dev) { limites.push({ caminho: path, erro: 'ponto de montagem excluído' }); return; }
        const bytes = logico ? (st.isFile() ? Number(st.size) : 0) : Number(st.blocks * 512n);
        if (!st.isDirectory() && st.nlink > 1n) {
          const id = st.dev + '/' + st.ino;
          if (!multiplos.has(id)) { v.hardlinksExcluidosBytes += bytes; multiplos.add(id); }
          return;
        }
        entrada.bytes += bytes;
        if (!st.isDirectory()) return;
        for (const nome of readdirSync(path)) {
          const filho = join(path, nome);
          try { contar(filho, lstatSync(filho, { bigint: true })); }
          catch (e) { limites.push({ caminho: filho, erro: e.code }); }
        }
      }
      try { contar(item.caminho, inicial); }
      finally {
        const categoria = item.categoria ?? 'Outros';
        const grupo = v.porCategoria[categoria] ??= { potencialBytes: 0, revisarBytes: 0, preservarBytes: 0 };
        const campo = { condicional: 'potencialBytes', revisar: 'revisarBytes', preservar: 'preservarBytes' }[item.classe];
        grupo[campo] += entrada.bytes;
        v[campo] += entrada.bytes;
      }
      entrada.completa = errosAntes === limites.length;
    } catch (e) { limites.push({ caminho: item.caminho, erro: e.code }); }
  }
  const porVolume = [...volumes.values()];
  for (const v of porVolume) {
    for (const grupo of [v, ...Object.values(v.porCategoria)]) {
      grupo.totalComRevisaoBytes = grupo.potencialBytes + grupo.revisarBytes;
      grupo.totalComRevisaoGB = grupo.totalComRevisaoBytes / 1e9;
      grupo.percentualComRevisao = v.capacidadeBytes ? 100 * grupo.totalComRevisaoBytes / v.capacidadeBytes : null;
      grupo.potencialGB = grupo.potencialBytes / 1e9;
      grupo.revisarGB = grupo.revisarBytes / 1e9;
      grupo.percentualDaCapacidade = v.capacidadeBytes ? 100 * grupo.potencialBytes / v.capacidadeBytes : null;
      grupo.percentualEmRevisao = v.capacidadeBytes ? 100 * grupo.revisarBytes / v.capacidadeBytes : null;
    }
  }
  return { metrica: logico ? 'tamanho lógico dos arquivos' : 'blocos alocados', potencialBytes: porVolume.reduce((n, v) => n + v.potencialBytes, 0),
    porVolume, itens, limites, parcial: limites.length > 0 };
}
