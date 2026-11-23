import { execFileSync } from 'node:child_process';
import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// plutil lê plists binários e XML sem iniciar Xcode ou CoreSimulatorService.
// Extrair campos evita converter datas e blobs de imagens inteiras para JSON.
function lerCampo(arquivo, chave, tipo = 'raw') {
  try {
    const s = execFileSync('/usr/bin/plutil', ['-extract', chave, tipo, '-o', '-', arquivo],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 }).trim();
    return tipo === 'json' ? JSON.parse(s) : s;
  } catch (e) {
    if (chave === 'lastBootedAt' && e.status === 1 && String(e.stderr).includes('No value at that key path')) return null;
    throw e;
  }
}

export function desenvolvimento({ home = homedir(), sistema = '/', plataforma = process.platform, campo = lerCampo, env = process.env } = {}) {
  const candidatos = [], limites = [], runtimes = [], dispositivos = [];
  if (plataforma !== 'darwin') return { candidatos, limites, runtimes, dispositivos, suportado: false };
  const developer = join(home, 'Library/Developer'), caches = join(home, 'Library/Caches');
  const core = join(sistema, 'Library/Developer/CoreSimulator');
  function tipo(caminho) {
    try {
      const st = lstatSync(caminho);
      if (st.isSymbolicLink() || realpathSync(dirname(caminho)) !== resolve(dirname(caminho))) {
        limites.push({ caminho, erro: 'caminho redirecionado excluído' });
        return;
      }
      return st;
    } catch (e) { if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') limites.push({ caminho, erro: e.code }); }
  }
  function pastas(caminho, conferirLinks = false) {
    if (!tipo(caminho)?.isDirectory()) return [];
    try {
      const entradas = readdirSync(caminho, { withFileTypes: true });
      if (conferirLinks && entradas.some(e => e.isSymbolicLink())) limites.push({ caminho, erro: 'registro com link não inspecionado' });
      return entradas.filter(d => d.isDirectory()).map(d => d.name);
    }
    catch (e) { limites.push({ caminho, erro: e.code }); return []; }
  }
  function cache(categoria, caminho) {
    if (tipo(caminho)?.isDirectory()) candidatos.push({ caminho, categoria, classe: 'condicional', motivo: 'cache recriável; conferir ferramentas paradas e acesso às dependências' });
  }
  // Somente subpastas conhecidas. Dados do simulador, repositórios de pacotes,
  // perfis de navegador e checkouts SwiftPM podem conter trabalho local.
  const catalogo = [
    ['Node.js', home, ['.npm/_cacache', '.bun/install/cache']],
    ['Node.js', caches, ['pnpm/metadata', 'pnpm/metadata-v1.3', 'pnpm/metadata-full-v1.3', 'pnpm/v11/metadata', 'pnpm/v11/metadata-full', 'node-gyp']],
    ['Python', caches, ['pip/http', 'pip/http-v2', 'pip/wheels']],
    ['Homebrew', caches, ['Homebrew/downloads']],
    ['CocoaPods e SwiftPM', caches, ['CocoaPods/Pods/Specs', 'CocoaPods/Pods/Release', 'org.swift.swiftpm/manifests']],
    ['Gradle', home, ['.gradle/caches/modules-2/files-2.1']],
    ['Xcode', developer, ['CoreSimulator/Caches', 'Xcode/DerivedData/ModuleCache.noindex', 'Xcode/DerivedData/SDKStatCaches.noindex', 'Xcode/DerivedData/CompilationCache.noindex']],
  ];
  for (const [categoria, raiz, paths] of catalogo) for (const p of paths) cache(categoria, join(raiz, p));
  const uv = env.UV_CACHE_DIR || join(env.XDG_CACHE_HOME || join(home, '.cache'), 'uv');
  const ferramentas = env.UV_TOOL_DIR || join(env.XDG_DATA_HOME || join(home, '.local/share'), 'uv/tools');
  const ferramentasUv = pastas(ferramentas).filter(n => tipo(join(ferramentas, n, 'uv-receipt.toml'))?.isFile()).sort();
  for (const nome of pastas(uv).filter(n => /^(simple|wheels)-v\d+$/.test(n))) cache('Python', join(uv, nome));
  function preservar(categoria, caminho, motivo) {
    if (tipo(caminho)?.isDirectory()) candidatos.push({ caminho, categoria, classe: 'preservar', motivo });
  }
  for (const nome of pastas(uv).filter(n => /^archive-v\d+$/.test(n))) {
    const caminho = join(uv, nome);
    const ambientesPython = pastas(caminho).filter(n => tipo(join(caminho, n, 'pyvenv.cfg'))?.isFile()).length;
    candidatos.push({ caminho, categoria: 'Arquivo de pacotes do uv', classe: 'preservar', ambientesPython,
      motivo: 'cache compartilhado de pacotes e ambientes Python; instalação de uma ferramenta não atribui o cache a ela' });
  }
  preservar('Store do pnpm', join(home, 'Library/pnpm/store'), 'pacotes compartilhados; referências de projetos não verificadas');
  preservar('Imagens Android', join(home, 'Library/Android/sdk/system-images'), 'compatibilidade dos AVDs e projetos não verificada');
  const gradle = join(home, '.gradle/caches');
  for (const versao of pastas(gradle).filter(n => /^\d+(\.\d+)+$/.test(n))) {
    for (const parte of ['transforms', 'generated-gradle-jars', 'groovy-dsl', 'kotlin-dsl', 'javaCompile']) {
      cache('Gradle', join(gradle, versao, parte));
    }
  }
  const playwright = join(caches, 'ms-playwright');
  for (const nome of pastas(playwright).filter(n => /^(chromium|chromium_headless_shell|firefox|webkit|ffmpeg)-\d+$/.test(n))) {
    if (tipo(join(playwright, nome, 'INSTALLATION_COMPLETE'))?.isFile()) cache('Playwright', join(playwright, nome));
  }
  const derivados = join(developer, 'Xcode/DerivedData');
  for (const nome of pastas(derivados)) {
    const projeto = join(derivados, nome);
    if (tipo(join(projeto, 'info.plist'))?.isFile()) cache('Xcode', join(projeto, 'Build/Intermediates.noindex'));
  }
  const avds = join(home, '.android/avd');
  for (const nome of pastas(avds).filter(n => n.endsWith('.avd'))) candidatos.push({
    caminho: join(avds, nome), classe: 'preservar', categoria: 'Android AVD', motivo: 'estado e dados locais do emulador Android',
  });

  const indice = join(core, 'Images/images.plist');
  if (tipo(indice)?.isFile()) {
    try {
      const total = Number(campo(indice, 'images'));
      if (!Number.isSafeInteger(total) || total < 0 || total > 1000) throw Error('contagem inválida');
      for (let i = 0; i < total; i++) {
        try {
          const info = campo(indice, 'images.' + i + '.runtimeInfo', 'json');
          const caminho = fileURLToPath(campo(indice, 'images.' + i + '.path.relative'));
          const asset = join(sistema, 'System/Library/AssetsV2') + sep;
          const local = join(core, 'Images') + sep;
          if (!(caminho.startsWith(asset) || caminho.startsWith(local)) || !caminho.endsWith('.dmg') || !tipo(caminho)?.isFile()
              || !/^com\.apple\.CoreSimulator\.SimRuntime\.[\w-]+$/.test(info.bundleIdentifier) || !info.platformIdentifier
              || !Number.isSafeInteger(info.version) || info.version < 1) throw Error('registro incompleto ou imagem fora das origens reconhecidas');
          runtimes.push({ id: info.bundleIdentifier, plataforma: info.platformIdentifier, versao: info.version, build: info.build, caminho });
        } catch { limites.push({ caminho: indice, erro: 'imagem ' + i + ' não identificada' }); }
      }
    } catch { limites.push({ caminho: indice, erro: 'inventário de imagens ilegível' }); }
  }
  const devices = join(developer, 'CoreSimulator/Devices');
  for (const nome of pastas(devices, true).filter(n => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(n))) {
    const caminho = join(devices, nome), plist = join(caminho, 'device.plist');
    try {
      if (!tipo(plist)?.isFile() || String(campo(plist, 'UDID')).toUpperCase() !== nome.toUpperCase()) throw Error();
      const antes = limites.length;
      const bundles = join(caminho, 'data/Containers/Bundle/Application');
      const aplicativos = [];
      for (const pasta of pastas(bundles, true)) {
        for (const app of pastas(join(bundles, pasta), true).filter(n => n.endsWith('.app'))) {
          aplicativos.push(app.slice(0, -4));
        }
      }
      const containers = pastas(join(caminho, 'data/Containers/Data/Application'), true).length;
      const ultimaInicializacao = campo(plist, 'lastBootedAt') || null;
      const comSinalDeUso = Boolean(ultimaInicializacao || aplicativos.length || containers);
      dispositivos.push({ caminho, id: nome, nome: campo(plist, 'name'), runtime: campo(plist, 'runtime'), estado: campo(plist, 'state'),
        ultimaInicializacao, aplicativos: aplicativos.sort(), containers, comSinalDeUso, inspecaoCompleta: limites.length === antes });
    } catch {
      limites.push({ caminho, erro: 'registro do dispositivo ilegível' });
      dispositivos.push({ caminho, id: nome, runtime: null, estado: null });
    }
  }
  if (dispositivos.length && !runtimes.length) limites.push({ caminho: indice, erro: 'sem inventário compatível para os dispositivos registrados' });
  const dispositivosIncertos = limites.some(l => l.caminho === devices || l.caminho.startsWith(devices + sep));
  for (const r of runtimes) {
    const anteriores = runtimes.some(outro => outro.plataforma === r.plataforma && outro.versao > r.versao);
    const verificarUso = dispositivosIncertos || dispositivos.some(d => !d.runtime || (d.runtime === r.id && (d.estado !== '1' || d.comSinalDeUso)));
    r.anterior = anteriores;
    r.dispositivos = dispositivos.filter(d => d.runtime === r.id).length;
    candidatos.push({ caminho: r.caminho, categoria: 'Imagens do simulador', classe: anteriores && !verificarUso ? 'revisar' : 'preservar',
      motivo: !anteriores ? 'versão mais recente registrada desta plataforma' : verificarUso ? 'preservar até esclarecer uso e estado dos dispositivos dependentes' : 'versão anterior; confirmar compatibilidade exigida pelos projetos', runtime: r.id });
  }
  const dyld = join(core, 'Caches/dyld');
  for (const host of pastas(dyld)) {
    const raiz = join(dyld, host);
    for (const nome of pastas(raiz)) {
      const r = runtimes.find(r => nome === r.id + '.' + r.build);
      if (!r) continue;
      const imagem = candidatos.find(item => item.caminho === r.caminho);
      candidatos.push({ caminho: join(raiz, nome), categoria: 'Cache dyld do simulador', classe: imagem.classe,
        motivo: 'cache do runtime gerenciado pelo CoreSimulator; confirmar a liberação pelo Xcode', runtime: r.id });
    }
  }
  for (const d of dispositivos) {
    const revisar = d.inspecaoCompleta && !d.comSinalDeUso && d.estado === '1' && runtimes.some(r => r.id === d.runtime);
    candidatos.push({ caminho: d.caminho, categoria: 'Dados de dispositivos simulados', classe: revisar ? 'revisar' : 'preservar',
      motivo: revisar ? 'sem inicialização, apps ou contêineres observados; confirmar dados locais e referências ao identificador antes de recriar'
        : 'inicialização, apps, dados, estado ativo ou informação insuficiente; preservar até confirmar', runtime: d.runtime, dispositivo: d.nome });
  }
  return { candidatos, limites, runtimes, dispositivos, ferramentasUv, suportado: true };
}
