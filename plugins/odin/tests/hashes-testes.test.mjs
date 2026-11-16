import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const SCRIPT = resolve(import.meta.dirname, '../skills/dev-loop/scripts/hashes-testes.mjs');
function fixture(t) {
 const root=mkdtempSync(join(tmpdir(),'odin-hashes-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 mkdirSync(join(root,'tests'));writeFileSync(join(root,'tests/a.js'),'abc');return root;
}
function run(root, paths) { const r=spawnSync(process.execPath,[SCRIPT,JSON.stringify(paths)],{cwd:root,encoding:'utf8'});return {...r,json:r.status===0?JSON.parse(r.stdout):null}; }
test('calcula SHA-256 conhecido com chave relativa canônica',t=>{
 const root=fixture(t);const r=run(root,['./tests/a.js']);
 assert.equal(r.status,0,r.stderr);
 // SHA-256 de "abc" e, depois do hífen, a conferência de transporte: CRC-32 de `path\nsha`,
 // calculado fora do script (zlib do Python) — vetor conhecido, não eco do algoritmo.
 assert.deepEqual(r.json,{'tests/a.js':'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad-2b61c175'});
});
test('conferência amarra o hash ao path: mesmo conteúdo em dois arquivos, conferências diferentes',t=>{
 const root=fixture(t);writeFileSync(join(root,'tests/b.js'),'abc');const r=run(root,['tests/a.js','tests/b.js']);
 assert.equal(r.status,0,r.stderr);
 const [a,b]=['tests/a.js','tests/b.js'].map(p=>r.json[p].split('-'));
 assert.equal(a[0],b[0]);assert.match(a[1],/^[a-f0-9]{8}$/);assert.notEqual(a[1],b[1]);
});
test('hash muda quando conteúdo muda',t=>{
 const root=fixture(t);const antes=run(root,['tests/a.js']);assert.equal(antes.status,0,antes.stderr);
 writeFileSync(join(root,'tests/a.js'),'abcd');const depois=run(root,['tests/a.js']);assert.equal(depois.status,0,depois.stderr);
 assert.notEqual(antes.json['tests/a.js'],depois.json['tests/a.js']);
});
test('traversal, path absoluto e symlink externo reprovam sem mapa parcial; arquivo ausente vira sentinela (3.0.3)',t=>{
 const root=fixture(t);writeFileSync(join(root,'fora.js'),'externo');symlinkSync('../fora.js',join(root,'tests/link.js'));
 // Link é interno ao projeto: permitido. O externo aponta para outro diretório.
 const externo=fixture(t);symlinkSync(externo,join(root,'externo'));
 assert.equal(run(root,['tests/link.js']).status,0);
 const ausente=run(root,['tests/a.js','sumiu.js']);assert.equal(ausente.status,0,ausente.stderr);assert.equal(ausente.json['sumiu.js'],'ausente');
 for(const paths of [['../fora.js'],[join(root,'tests/a.js')],['externo/tests/a.js']]){
  const r=run(root,paths);assert.equal(r.status,1);assert.equal(r.stdout,'');
 }
});

// 2.6.0: `hashesDeTestes` é exportado para `copia-base.mjs`, e o CLI só roda quando o script é o
// executado. Sem a guarda, importar o módulo rodava o CLI com o argv do importador: erro no
// stderr e exitCode 1 no processo de quem importou.
function importador(t, argv) {
 const dir=mkdtempSync(join(tmpdir(),'odin-hashes-imp-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 mkdirSync(join(dir,'tests'));writeFileSync(join(dir,'tests/a.js'),'abc');
 writeFileSync(join(dir,'importa.mjs'),`import { hashesDeTestes } from ${JSON.stringify(pathToFileURL(SCRIPT).href)};\nconst r = hashesDeTestes(['tests/a.js'], process.cwd());\nconsole.log(JSON.stringify({ r, exitCode: process.exitCode ?? null }));\n`);
 return { dir, ...spawnSync(process.execPath,[join(dir,'importa.mjs'),...argv],{cwd:dir,encoding:'utf8'}) };
}
test('importar o módulo não roda o CLI: sem saída extra nem exitCode, mesmo com o argv de outro script',t=>{
 const p=importador(t,['criar','HEAD','["tests/a.js"]']);
 assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');
 const linhas=p.stdout.trim().split('\n');assert.equal(linhas.length,1,p.stdout);
 assert.equal(JSON.parse(linhas[0]).exitCode,null);
});
test('hashesDeTestes(paths, root) devolve o mesmo mapa que o CLI imprime',t=>{
 const p=importador(t,[]);assert.equal(p.status,0,p.stderr);
 const cli=run(p.dir,['tests/a.js']);assert.equal(cli.status,0,cli.stderr);
 assert.deepEqual(JSON.parse(p.stdout).r,cli.json);
});
test('CLI chamado por diretório symlink imprime também com --preserve-symlinks-main',t=>{
 const root=fixture(t);const link=join(mkdtempSync(join(tmpdir(),'odin-hashes-link-')),'scripts');
 t.after(()=>rmSync(dirname(link),{recursive:true,force:true}));symlinkSync(dirname(SCRIPT),link);
 for(const NODE_OPTIONS of ['','--preserve-symlinks-main']){
  const r=spawnSync(process.execPath,[join(link,'hashes-testes.mjs'),'["tests/a.js"]'],{cwd:root,encoding:'utf8',env:{...process.env,NODE_OPTIONS}});
  assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),run(root,['tests/a.js']).json,NODE_OPTIONS);
 }
});

// ── odin 3.0.3: sentinelas por caminho (A4) e o que não pode mudar (A5) ─────────────────────────
// O apoio do portão entra no mesmo lote de hashes dos testes. Sem sentinela, uma fixture removida ou
// uma pasta declarada derrubava o lote inteiro (exit 1) e virava `erro` de evidência no harness.
test('A4: a CLI devolve ausente e nao-regular por caminho, com hash conferido para o arquivo, e sai 0',t=>{
 const root=fixture(t);mkdirSync(join(root,'tests/pasta'));
 const r=run(root,['tests/a.js','sumiu.js','tests/pasta','tests/a.js/dentro']);
 assert.equal(r.status,0,r.stderr);
 // Mesmo vetor do teste de SHA conhecido: SHA-256 de "abc" e a conferência calculada pelo zlib do Python.
 assert.deepEqual(r.json,{'tests/a.js':'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad-2b61c175','sumiu.js':'ausente','tests/pasta':'nao-regular','tests/a.js/dentro':'ausente'});
});
test('A5: caminho inválido segue saindo 1 sem JSON, hashesDeTestes segue estrito e --impressao devolve o mesmo valor',async t=>{
 const root=fixture(t);writeFileSync(join(root,'fora.js'),'externo');
 const externo=fixture(t);symlinkSync(externo,join(root,'externo'));
 for(const paths of [[join(root,'tests/a.js')],['../fora.js'],['tests/../fora.js'],['tests/a:b.js'],['tests\\a.js'],['externo/tests/a.js'],['tests/a.js','../fora.js'],['tests/a.js','tests/a:b.js']]){
  const r=run(root,paths);assert.equal(r.status,1,JSON.stringify(paths));assert.equal(r.stdout,'',JSON.stringify(paths));
 }
 const { hashesDeTestes }=await import(pathToFileURL(SCRIPT).href);
 const raiz=realpathSync(root);
 assert.deepEqual(Object.keys(hashesDeTestes(['tests/a.js'],raiz)),['tests/a.js']);
 assert.throws(()=>hashesDeTestes(['sumiu.js'],raiz),'arquivo inexistente continua lançando sem a opção de tolerância');
 mkdirSync(join(root,'tests/pasta'));
 assert.throws(()=>hashesDeTestes(['tests/pasta'],raiz),'pasta continua lançando sem a opção de tolerância');
 // Árvore determinística: commit com identidade e datas fixas. O valor esperado foi gravado com o
 // script da 3.0.2; mudar a impressão da mesma árvore invalidaria toda `validacaoAnterior` já registrada.
 const dir=realpathSync(mkdtempSync(join(tmpdir(),'odin-hashes-fixa-')));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const env={...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_AUTHOR_NAME:'Fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'Fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid',GIT_AUTHOR_DATE:'2026-01-01T00:00:00Z',GIT_COMMITTER_DATE:'2026-01-01T00:00:00Z'};
 const git=(...args)=>{const g=spawnSync('git',args,{cwd:dir,env,encoding:'utf8'});assert.equal(g.status,0,g.stderr);};
 git('init','-q');mkdirSync(join(dir,'tests'));writeFileSync(join(dir,'tests/a.js'),'abc');writeFileSync(join(dir,'LEIA.md'),'x\n');
 git('add','.');git('-c','commit.gpgSign=false','-c','core.hooksPath=/dev/null','commit','-qm','fixa');
 writeFileSync(join(dir,'novo.js'),'y\n');
 const imp=spawnSync(process.execPath,[SCRIPT,'--impressao'],{cwd:dir,env,encoding:'utf8'});
 assert.equal(imp.status,0,imp.stderr);
 assert.deepEqual(JSON.parse(imp.stdout),{impressao:'82181a8d20e20695c749d985be66254cb7f7840c8e05b058575c4e50c1cdbc96-9b5ac0b0'});
});
