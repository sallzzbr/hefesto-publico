import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fixture, json, pending, selected, successful } from './support/tracked-pending-fixtures.mjs';
import { auditLink, diff, intercept, linkPath, linkSpec, sparse, unchanged } from './support/batch-link-fixtures.mjs';
for(const mode of ['native','fallback']) {
  test(`P1 ${mode} one candidate remains green and no candidates need no membership`,t=>{
    const workspace=sparse(t,1), trace=intercept(workspace,mode), verify=unchanged(workspace); trace.clear();
    successful(workspace.inspect(selected)); assert.equal(trace.records().filter(record=>record.args.includes('check-rules')).length,1);
    verify(); workspace.git('sparse-checkout','disable'); const afterDisable=unchanged(workspace); trace.clear();
    successful(workspace.inspect(selected)); assert.equal(trace.records().filter(record=>record.args.includes('check-rules')).length,0); afterDisable();
  });
}
for(const mode of ['unterminated','duplicate','unknown','emptyRecord','partial','warning','signal']) {
  test(`P1 malformed membership ${mode} refuses with intact state`,t=>{
    const workspace=sparse(t,3), verify=unchanged(workspace); intercept(workspace,mode);
    const execution=workspace.inspect(selected); assert.notEqual(execution.status,0); assert.ok(json(execution).errors.length); verify();
  });
}
for(const mode of ['native','fallback']) {
  test(`P1 ${mode} included and excluded mixture remains visible without cached rules`,t=>{
    const workspace=sparse(t,4); workspace.write('src/manual.txt','included\n'); workspace.commit();
    workspace.git('update-index','--skip-worktree','--','src/manual.txt'); rmSync(join(workspace.root,'src/manual.txt'));
    const verify=unchanged(workspace); intercept(workspace,mode);
    let execution=workspace.inspect(selected), value=json(execution);
    if(execution.status!==0) assert.ok(value.errors.length);
    else { assert.ok(value.files.some(file=>file.path==='src/manual.txt' && file.status==='deleted')); assert.ok(workspace.paths.every(path=>!value.files.some(file=>file.path===path))); }
    verify();
    const rules=join(workspace.root,'.git/info/sparse-checkout');
    writeFileSync(rules,readFileSync(rules,'utf8')+'/outside/\n');
    execution=workspace.inspect(selected); value=json(execution);
    if(execution.status!==0) assert.ok(value.errors.length);
    else for(const path of workspace.paths) assert.ok(value.files.some(file=>file.path===path && file.status==='deleted'),'new rules cannot reuse earlier exclusion');
    verify();
  });
}
for(const destination of ['external','metadata','dangling','loop','directory','special']) {
  test(`P1 ${destination} terminal link refuses quality and diff`,t=>{
    const workspace=fixture(t); let target;
    if(destination==='external') {target=join(workspace.parent,'secret');writeFileSync(target,'OUTSIDE SECRET\n');}
    if(destination==='metadata') target='../.git/config';
    if(destination==='dangling') target='absent';
    if(destination==='loop') target='internal-link';
    if(destination==='directory') target='../tests';
    if(destination==='special') {target='../pipe';const made=spawnSync('mkfifo',[join(workspace.root,'pipe')],{encoding:'utf8'});assert.equal(made.status,0,made.stderr);}
    symlinkSync(target,join(workspace.root,linkPath)); const verify=unchanged(workspace);
    const execution=workspace.inspect([...selected,linkPath]);assert.notEqual(execution.status,0);assert.ok(json(execution).errors.length);
    const material=diff(workspace,[linkPath]);assert.notEqual(material.status,0);assert.doesNotMatch(material.stdout,/OUTSIDE SECRET/);verify();
  });
}
test('P1 pending link remains forbidden even for internal regular destination',t=>{
  const workspace=fixture(t);mkdirSync(join(workspace.root,'notes'));symlinkSync('../src/a.js',join(workspace.root,pending));const verify=unchanged(workspace);
  const execution=workspace.inspect(selected,pending);assert.notEqual(execution.status,0);assert.ok(json(execution).errors.length);verify();
});
test('P1 deleted tracked link keeps deleted inventory and Git diff representation',t=>{
  const workspace=fixture(t);symlinkSync('a.js',join(workspace.root,linkPath));workspace.commit();rmSync(join(workspace.root,linkPath));const verify=unchanged(workspace);
  const value=successful(workspace.inspect([...selected,linkPath]));assert.deepEqual(value.files.find(file=>file.path===linkPath),{path:linkPath,status:'deleted',bytes:0,lines:0});
  const execution=diff(workspace,[linkPath]);assert.equal(execution.status,0,execution.stderr);const material=JSON.parse(execution.stdout);assert.deepEqual(material.novos,[]);assert.match(material.rastreados,/deleted file mode 120000/);verify();
});
test('P1 undeclared new link remains an omission',t=>{
  const workspace=fixture(t);symlinkSync('a.js',join(workspace.root,linkPath));
  const value=successful(workspace.inspect(selected));assert.ok(JSON.stringify(value.uninspected).includes(linkPath));
  const execution=diff(workspace,selected);assert.equal(execution.status,0,execution.stderr);const material=JSON.parse(execution.stdout);assert.ok(material.novosNaoIncluidos.includes(linkPath));assert.ok(!material.novos.some(file=>file.path===linkPath));
});
for(const scenario of ['link-line','impossible-spec-line','missing-spec','zero-bytes','positive-lines']) {
  test(`P1 symlink evidence rejects ${scenario}`,async t=>{
    const workspace=fixture(t),spec=linkSpec(workspace);
    const measured=successful(workspace.inspect(selected));
    measured.files.push({path:linkPath,status:'symlink',lines:0,bytes:4});
    const evidence={};
    if(scenario==='link-line') Object.assign(evidence,{path:linkPath,line:1});
    if(scenario==='impossible-spec-line') evidence.line=measured.files.find(file=>file.path===selected[2]).lines+1;
    if(scenario==='missing-spec') measured.files=measured.files.filter(file=>file.path!==selected[2]);
    if(scenario==='zero-bytes') measured.files.find(file=>file.path===linkPath).bytes=0;
    if(scenario==='positive-lines') measured.files.find(file=>file.path===linkPath).lines=1;
    const outcome=await auditLink(workspace,{...spec,measured,evidence});assert.notEqual(outcome.result.status,'verde',JSON.stringify(outcome.result));
  });
}
test('P1 reversed membership records cannot hide included absences',t=>{
  const workspace=sparse(t,4), verify=unchanged(workspace); intercept(workspace,'reversed');
  const execution=workspace.inspect(selected), value=json(execution);
  if(execution.status!==0) assert.ok(value.errors.length,'included absence must be diagnosed');
  else for(const path of workspace.paths) assert.ok(value.files.some(file=>file.path===path && file.status==='deleted'));
  verify();
});
test('P1 changed tracked link stays represented by Git diff without new-file JSON',t=>{
  const workspace=fixture(t);symlinkSync('a.js',join(workspace.root,linkPath));workspace.commit();rmSync(join(workspace.root,linkPath));symlinkSync('../tests/a.test.js',join(workspace.root,linkPath));const verify=unchanged(workspace);
  const execution=diff(workspace,[linkPath]);assert.equal(execution.status,0,execution.stderr);const value=JSON.parse(execution.stdout);
  assert.deepEqual(value.novos,[]);assert.match(value.rastreados,/-a\.js/);assert.match(value.rastreados,/\+\.\.\/tests\/a\.test\.js/);verify();
});
