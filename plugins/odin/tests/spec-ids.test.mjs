import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const SCRIPT=resolve(import.meta.dirname,'../skills/dev-loop/scripts/spec-ids.mjs');
function run(t, rows){const dir=mkdtempSync(join(tmpdir(),'odin-spec-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'spec.md');writeFileSync(file,`# SPEC: soma\n## Critérios de aceite\n| # | Critério | Teste |\n|---|---|---|\n${rows}\n## Non-goals\nNada mais.\n`);const r=spawnSync(process.execPath,[SCRIPT,file],{encoding:'utf8'});return {...r,json:r.stdout?JSON.parse(r.stdout):null};}
test('extrai IDs da tabela original na ordem e sem deduplicar silenciosamente',t=>{const r=run(t,'| C1 | Soma | `soma.test.js` |\n| C2 | Zero | `soma.test.js` |');assert.equal(r.status,0,r.stderr);assert.deepEqual(r.json.ids,['C1','C2']);});
test('C1 duplicado bloqueia mesmo quando textos são distintos',t=>{const r=run(t,'| C1 | Soma | `soma.test.js` |\n| C1 | Zero | `soma.test.js` |');assert.equal(r.status,1);assert.equal(r.json.ok,false);assert.match(r.json.erros.join(' '),/C1/);});
test('tabela vazia e ID vazio reprovam',t=>{for(const rows of ['', '| | Soma | `soma.test.js` |']){const r=run(t,rows);assert.equal(r.status,1);assert.equal(r.json.ok,false);}});
test('ID pode ser identidade de critério; duplicá-lo não equivale a outro cabeçalho',t=>{
 const r=run(t,'| C1 | Soma | teste |\n| ID | Zero | teste |\n| ID | Negativo | teste |');
 assert.equal(r.status,1);assert.deepEqual(r.json.ids,['C1','ID','ID']);assert.match(r.json.erros.join(' '),/ID repetido: ID/);
});
test('tabela de subseção não é parte da tabela de critérios',t=>{
 const r=run(t,'| C1 | Soma | teste |\n\n### Casos de borda\n| Entrada | Resultado |\n|---|---|\n| 0 | zero |');
 assert.equal(r.status,0);assert.deepEqual(r.json.ids,['C1']);
});

test('verificação complementar vem somente da coluna explícita, sem confundir teste com revisão humana',t=>{
 const dir=mkdtempSync(join(tmpdir(),'odin-manual-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const file=join(dir,'spec.md');
 writeFileSync(file,'# SPEC\n## Critérios de aceite\n| # | Critério | Teste | Verificação complementar |\n|---|---|---|---|\n| C1 | soma | `soma.test.js` a escrever | |\n| C2 | visual | | revisar contraste |\n');
 const r=spawnSync(process.execPath,[SCRIPT,file],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 assert.deepEqual(JSON.parse(r.stdout).verificacoesComplementares,{C2:'revisar contraste'});
});

test('coluna de verificação complementar duplicada é ambígua e bloqueia',t=>{
 const dir=mkdtempSync(join(tmpdir(),'odin-coluna-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const file=join(dir,'spec.md');
 writeFileSync(file,'# SPEC\n## Critérios de aceite\n| # | Critério | Verificação complementar | Verificação complementar |\n|---|---|---|---|\n| C1 | soma | | revisar tela |\n');
 const r=spawnSync(process.execPath,[SCRIPT,file],{encoding:'utf8'});
 assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).ok,false);
});
