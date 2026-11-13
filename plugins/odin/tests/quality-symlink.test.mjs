import assert from 'node:assert/strict';
import { readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fixture, selected, successful } from './support/tracked-pending-fixtures.mjs';
import { auditLink, diff, inspector, linkPath, linkSpec, unchanged } from './support/batch-link-fixtures.mjs';
for (const tracked of [false, true]) {
  test(`L1 ${tracked ? 'changed tracked' : 'new'} internal link inventory measures the link object`, t => {
    const workspace = fixture(t);
    if (tracked) { symlinkSync('../tests/a.test.js', join(workspace.root,linkPath)); workspace.commit(); rmSync(join(workspace.root,linkPath)); }
    symlinkSync('a.js', join(workspace.root, linkPath)); const verify = unchanged(workspace);
    const value = successful(workspace.inspect([...selected, linkPath]));
    assert.deepEqual(value.files.find(file => file.path === linkPath), { path: linkPath, status: 'symlink', lines: 0, bytes: readlinkSync(join(workspace.root,linkPath),{encoding:'buffer'}).length });
    verify();
  });
}
test('L1 new internal link diff preserves exact readlink bytes and regular JSON', t => {
  const workspace = fixture(t); const destination = 'alvo-é.txt'; workspace.write('src/' + destination, 'target content is not link content\n'); workspace.commit(); symlinkSync(destination, join(workspace.root,linkPath));
  workspace.write('src/new.txt','new regular\n'); const verify = unchanged(workspace);
  const execution = diff(workspace,[linkPath,'src/new.txt']); assert.equal(execution.status,0,execution.stderr);
  const value=JSON.parse(execution.stdout);
  assert.deepEqual(value.novos.find(file=>file.path===linkPath),{path:linkPath,type:'symlink',targetBase64:Buffer.from(destination).toString('base64')});
  assert.deepEqual(value.novos.find(file=>file.path==='src/new.txt'),{path:'src/new.txt',binario:false,conteudo:'new regular\n'}); verify();
});
test('L1 link inspection never reads content through the link or its target', t => {
  const workspace=fixture(t); workspace.write('private-target','SECRET CONTENT\n');
  workspace.commit(); symlinkSync('../private-target',join(workspace.root,linkPath));
  const preload=join(workspace.parent,'observe-reads.cjs'), trace=join(workspace.parent,'reads.jsonl');
  writeFileSync(trace,'');
  writeFileSync(preload, `const fs=require('node:fs');const original=fs.readFileSync;fs.readFileSync=function(path,...rest){fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify(String(path))+'\\n');return original.call(this,path,...rest)};require('node:module').syncBuiltinESMExports();`);
  for(const mode of ['quality','diff']) {
    const execution=spawnSync(process.execPath,['--require',preload,inspector,mode,JSON.stringify([linkPath]),'HEAD'],{cwd:workspace.root,env:workspace.env,encoding:'utf8'});
    assert.equal(execution.status,0,execution.stderr);
    assert.doesNotMatch(execution.stdout,/SECRET CONTENT/);
  }
  const reads=readFileSync(trace,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  assert.ok(!reads.includes(join(workspace.root,linkPath)),'must not read through the link');
  assert.ok(!reads.includes(join(workspace.root,'private-target')),'must not read resolved target');
});
for (const perfil of ['economico','balanceado','maximo']) {
  test(`L1 real emitted inventory and SPEC nontext evidence reach green in ${perfil}`,async t=>{
    const workspace=fixture(t); symlinkSync('a.js',join(workspace.root,linkPath)); const spec=linkSpec(workspace);
    const outcome=await auditLink(workspace,{...spec,perfil});
    assert.ok(outcome.measurements.length); assert.equal(outcome.result.status,'verde',JSON.stringify(outcome.result));
    for(const measurement of outcome.measurements) assert.equal(measurement.execution.status,0,measurement.execution.stderr);
    const validation=outcome.calls.find(call=>call.label.startsWith('validar:'));
    assert.ok(JSON.stringify(validation.schema).includes('symlink'),'agent inventory schema must permit symlink');
  });
}
