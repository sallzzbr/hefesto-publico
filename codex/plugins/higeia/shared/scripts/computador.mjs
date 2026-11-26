import { lstatSync, opendirSync, readdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// As únicas entradas para a medição são caminhos conhecidos de cache ou locais
// de revisão pessoal. A descoberta consulta metadados, inclusive em Downloads.
export function computador({ home = homedir(), agora = Date.now() } = {}) {
  const raiz = realpathSync(home);
  const dispositivo = lstatSync(raiz).dev;
  const candidatos = [], limites = [];
  const idadeRelatorioDias = 30, arquivoGrandeBytes = 500_000_000;

  function inspecionar(path) {
    try {
      const st = lstatSync(path);
      if (st.isSymbolicLink() || realpathSync(path) !== path || st.dev !== dispositivo) {
        limites.push({ caminho: path, erro: 'link ou outro volume excluído' });
        return;
      }
      return st;
    } catch (e) {
      if (e.code !== 'ENOENT') limites.push({ caminho: path, erro: e.code });
    }
  }
  function entradas(dir) {
    if (!inspecionar(dir)?.isDirectory()) return [];
    try { return readdirSync(dir, { withFileTypes: true }); }
    catch (e) { limites.push({ caminho: dir, erro: e.code }); return []; }
  }
  function cache(path, categoria) {
    if (!inspecionar(path)?.isDirectory()) return;
    // O macOS pode permitir stat e negar a enumeração do mesmo diretório.
    try {
      const dir = opendirSync(path);
      try { dir.readSync(); } finally { dir.closeSync(); }
    } catch (e) {
      limites.push({ caminho: path, erro: e.code });
      return;
    }
    candidatos.push({ caminho: path, categoria, classe: 'condicional',
      motivo: 'cache identificado da aplicação; pode ser recompilado ou baixado novamente' });
  }
  const biblioteca = join(raiz, 'Library');
  const caches = join(biblioteca, 'Caches'), suporte = join(biblioteca, 'Application Support');
  function cacheChromium(perfil, categoria) {
    for (const local of ['Cache/Cache_Data', 'Code Cache/js', 'Code Cache/wasm', 'GPUCache']) {
      cache(join(perfil, local), categoria);
    }
  }
  for (const produto of ['Google/Chrome', 'Microsoft Edge', 'BraveSoftware/Brave-Browser', 'Chromium']) {
    for (const dir of [join(caches, produto), join(suporte, produto)]) {
      for (const e of entradas(dir)) {
        if (e.isDirectory() && /^(Default|Profile \d+|Guest Profile)$/.test(e.name)) {
          cacheChromium(join(dir, e.name), 'Navegadores');
        }
      }
    }
  }
  const firefox = join(caches, 'Firefox/Profiles');
  for (const e of entradas(firefox)) {
    if (e.isDirectory()) cache(join(firefox, e.name, 'cache2/entries'), 'Navegadores');
  }
  const safari = join(caches, 'com.apple.Safari/WebKitCache');
  for (const e of entradas(safari)) {
    if (e.isDirectory() && /^Version \d+$/.test(e.name)) cache(join(safari, e.name, 'Records'), 'Navegadores');
  }
  for (const app of ['Code', 'Claude', 'Codex', 'Slack', 'discord']) {
    cacheChromium(join(suporte, app), 'Caches de aplicativos');
  }

  const downloads = join(raiz, 'Downloads');
  const reserva = join(downloads, '.higeia-instaladores');
  for (const item of entradas(reserva)) {
    const caminho = join(reserva, item.name);
    if (inspecionar(caminho)) candidatos.push({ caminho, categoria: 'Quarentena de instaladores',
      classe: 'preservar', motivo: 'ocupação mantida no volume para restauração' });
  }
  for (const e of entradas(downloads)) {
    if (e.name.startsWith('.') || !(e.isFile() || e.isDirectory())) continue;
    const caminho = join(downloads, e.name);
    if (!inspecionar(caminho)) continue;
    const incompleto = /\.(crdownload|download|part|partial)$/i.test(e.name);
    let categoria = 'Outros downloads';
    if (incompleto) categoria = 'Downloads incompletos';
    else if (/\.(dmg|pkg|mpkg)$/i.test(e.name)) categoria = 'Instaladores em Downloads';
    else if (/\.(zip|7z|rar|tar|tgz|gz|bz2|xz)$/i.test(e.name)) categoria = 'Compactados em Downloads';
    candidatos.push({ caminho, categoria, classe: incompleto ? 'preservar' : 'revisar',
      motivo: incompleto ? 'transferência possivelmente em andamento' : 'confirmar se deseja guardar ou se existe outra cópia' });
  }
  const lixeira = join(raiz, '.Trash');
  if (inspecionar(lixeira)?.isDirectory()) {
    // Só inclua a Lixeira se for possível enumerá-la. O tamanho do diretório
    // protegido, sozinho, não representa o conteúdo que seria esvaziado.
    for (const e of entradas(lixeira)) {
      if (e.name === '.DS_Store') continue;
      const caminho = join(lixeira, e.name);
      if (inspecionar(caminho)) candidatos.push({ caminho, categoria: 'Lixeira', classe: 'revisar',
        motivo: 'confirmar descarte definitivo dos itens deste usuário' });
    }
  }
  for (const local of ['Desktop', 'Documents', 'Movies']) {
    const dir = join(raiz, local);
    for (const e of entradas(dir)) {
      if (!e.isFile() || e.name.startsWith('.')) continue;
      const caminho = join(dir, e.name);
      if (inspecionar(caminho)?.size >= arquivoGrandeBytes) candidatos.push({ caminho,
        categoria: 'Arquivos pessoais grandes', classe: 'revisar', motivo: 'confirmar interesse e backup' });
    }
  }
  const relatorios = join(biblioteca, 'Logs/DiagnosticReports');
  for (const e of entradas(relatorios)) {
    if (!e.isFile() || !/\.(ips|crash|diag|spin)$/i.test(e.name)) continue;
    const caminho = join(relatorios, e.name);
    if (inspecionar(caminho)?.mtimeMs <= agora - idadeRelatorioDias * 86400000) candidatos.push({ caminho,
      categoria: 'Relatórios de falha antigos', classe: 'revisar', motivo: 'confirmar se há investigação em andamento' });
  }
  return { raiz, candidatos, limites, idadeRelatorioDias, arquivoGrandeBytes };
}
