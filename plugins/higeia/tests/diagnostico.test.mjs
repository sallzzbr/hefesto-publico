import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, lstatSync, statfsSync, linkSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { investigarUv } from '../scripts/ambientes-uv.mjs';
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
