import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
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
 assert.deepEqual(r.json,{'tests/a.js':'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'});
});
test('hash muda quando conteúdo muda',t=>{
 const root=fixture(t);const antes=run(root,['tests/a.js']);assert.equal(antes.status,0,antes.stderr);
 writeFileSync(join(root,'tests/a.js'),'abcd');const depois=run(root,['tests/a.js']);assert.equal(depois.status,0,depois.stderr);
 assert.notEqual(antes.json['tests/a.js'],depois.json['tests/a.js']);
});
test('arquivo ausente, traversal, path absoluto e symlink externo reprovam sem mapa parcial',t=>{
 const root=fixture(t);writeFileSync(join(root,'fora.js'),'externo');symlinkSync('../fora.js',join(root,'tests/link.js'));
 // Link é interno ao projeto: permitido. O externo aponta para outro diretório.
 const externo=fixture(t);symlinkSync(externo,join(root,'externo'));
 assert.equal(run(root,['tests/link.js']).status,0);
 for(const paths of [['tests/a.js','sumiu.js'],['../fora.js'],[join(root,'tests/a.js')],['externo/tests/a.js']]){
  const r=run(root,paths);assert.equal(r.status,1);assert.equal(r.stdout,'');
 }
});
