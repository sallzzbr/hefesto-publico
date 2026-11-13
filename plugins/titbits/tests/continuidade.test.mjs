import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'scripts/continuidade.mjs');
const hook = path.join(root, 'scripts/hook.mjs');
const codexTitbits = path.join(root, '../../codex/plugins/titbits');
// Mesmo comportamento nas duas distribuições: scripts e template do pacote Codex são cópias geradas.
const distribuicoes = {
  claude: {cli, hook, gdd: path.join(root, 'templates/gdd.md')},
  codex: {cli: path.join(codexTitbits, 'shared/scripts/continuidade.mjs'), hook: path.join(codexTitbits, 'shared/scripts/hook.mjs'), gdd: path.join(codexTitbits, 'shared/templates/gdd.md')},
};
function fixture(t, d = distribuicoes.claude) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'titbits-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, '.git'));
  function write(p, text) { fs.mkdirSync(path.dirname(path.join(dir, p)), {recursive:true}); fs.writeFileSync(path.join(dir,p), text); }
  write('.titbits/config.json', JSON.stringify({formato:1, enabled:true, local_jogo:'docs/jogo'}));
  write('docs/jogo/gdd/README.md', '# GDD\n- versão: 1\n');
  write('docs/jogo/producao/estado.md', '- próximo passo: testar o espelho\n');
  const node = (id, links=[]) => '```titbits-relacoes\n'+JSON.stringify([{id,relacoes:links.map(alvo=>({alvo,tipo:'depende_de'}))}])+'\n```\n';
  write('docs/jogo/gdd/mecanica.md', node('MEC-001'));
  write('docs/jogo/gdd/fase.md', node('FAS-001',['MEC-001']));
  write('docs/jogo/producao/evidencia.md', node('TEC-001',['FAS-001']));
  write('docs/jogo/gdd/audio.md', node('AUD-001'));
  function run(action,...extra) { return spawnSync(process.execPath,[d.cli,action,'--workspace',dir,'--jogo','docs/jogo',...extra],{encoding:'utf8'}); }
  function baseline() { const r=run('reconciliar'); assert.equal(r.status,0,r.stderr); write('docs/jogo/gdd/relacoes.json',r.stdout); return JSON.parse(r.stdout); }
  function event(name,session='s1',runtime='codex') {return spawnSync(process.execPath,[d.hook,runtime],{input:JSON.stringify({cwd:dir,session_id:session,hook_event_name:name}),encoding:'utf8',timeout:5000});}
  return {dir,write,node,run,baseline,event};
}
test('reconciliação gera baseline persistente sem escrever arquivos',t=>{const f=fixture(t);const b=f.baseline();assert.equal(b.gdd_versao,1);assert.equal(b.nos.length,4);assert.match(b.arquivos['gdd/mecanica.md'],/^[a-f0-9]{64}$/);assert.equal(f.run('verificar').status,0);});
test('mudança identifica impactos transitivos sem invalidar domínio independente',t=>{const f=fixture(t);f.baseline();f.write('docs/jogo/gdd/mecanica.md',f.node('MEC-001')+'nova regra');const r=f.run('verificar');assert.equal(r.status,1);const o=JSON.parse(r.stdout);assert.deepEqual(o.afetados.sort(),['FAS-001','MEC-001','TEC-001']);assert.ok(!o.afetados.includes('AUD-001'));});
test('ciclo termina e propaga impacto uma única vez',t=>{const f=fixture(t);f.write('docs/jogo/gdd/mecanica.md',f.node('MEC-001',['TEC-001']));f.baseline();f.write('docs/jogo/gdd/fase.md',f.node('FAS-001',['MEC-001'])+'mudou');const o=JSON.parse(f.run('verificar').stdout);assert.equal(new Set(o.afetados).size,3);});
test('baseline ausente não vira sucesso nem é criada automaticamente',t=>{const f=fixture(t);const r=f.run('verificar');assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).estado,'nao_avaliado');assert.ok(!fs.existsSync(path.join(f.dir,'docs/jogo/gdd/relacoes.json')));});
test('detecta novos e removidos sem depender do cache',t=>{const f=fixture(t);f.baseline();f.write('docs/jogo/gdd/novo.md','# não mapeado');fs.unlinkSync(path.join(f.dir,'docs/jogo/gdd/audio.md'));const o=JSON.parse(f.run('verificar').stdout);assert.ok(o.novos.includes('gdd/novo.md'));assert.ok(o.removidos.includes('gdd/audio.md'));assert.equal(o.cobertura,'incompleta');});
test('rejeita relação desconhecida em reconciliação',t=>{const f=fixture(t);f.write('docs/jogo/gdd/fase.md',f.node('FAS-001',['MEC-999']));assert.equal(f.run('reconciliar').status,2);});
test('índice adulterado não elimina dependência silenciosamente',t=>{const f=fixture(t);const b=f.baseline();b.nos=[];f.write('docs/jogo/gdd/relacoes.json',JSON.stringify(b));assert.equal(f.run('verificar').status,2);});
test('versão divergente exige reconciliação',t=>{const f=fixture(t);f.baseline();f.write('docs/jogo/gdd/README.md','- versão: 2');assert.equal(JSON.parse(f.run('verificar').stdout).versao_divergente,true);});
test('hook sem opt-in é silencioso e não cria cache',t=>{const f=fixture(t);fs.unlinkSync(path.join(f.dir,'.titbits/config.json'));const r=f.event('SessionStart');assert.equal(r.status,0);assert.equal(r.stdout,'');assert.ok(!fs.existsSync(path.join(f.dir,'.titbits/cache')));});
test('startup traz contexto limitado com contrato por runtime',t=>{const f=fixture(t);f.baseline();for(const rt of ['codex','claude']) {const r=f.event('SessionStart','s1',rt);assert.equal(r.status,0,r.stderr);const o=JSON.parse(r.stdout);assert.equal(o.hookSpecificOutput.hookEventName,'SessionStart');assert.match(o.hookSpecificOutput.additionalContext,/testar o espelho/);assert.ok(o.hookSpecificOutput.additionalContext.length<=4000);assert.equal(o.decision,undefined);}});
test('PostToolUse não é tratado: sem contexto, cache ou escrita',t=>{const f=fixture(t);f.baseline();const before=fs.readFileSync(path.join(f.dir,'docs/jogo/gdd/relacoes.json'),'utf8');const r=f.event('PostToolUse');assert.equal(r.status,0);assert.equal(r.stdout,'');assert.ok(!fs.existsSync(path.join(f.dir,'.titbits/cache')));assert.equal(fs.readFileSync(path.join(f.dir,'docs/jogo/gdd/relacoes.json'),'utf8'),before);});
test('mudança externa avisa no próximo prompt, deduplica por sessão e resiste à perda do cache',t=>{const f=fixture(t);f.baseline();f.write('docs/jogo/gdd/mecanica.md',f.node('MEC-001')+'mudou');const a=f.event('UserPromptSubmit');assert.equal(a.status,0);assert.match(a.stdout,/MEC-001/);assert.equal(f.event('UserPromptSubmit').stdout,'');assert.match(f.event('UserPromptSubmit','s2').stdout,/MEC-001/);fs.rmSync(path.join(f.dir,'.titbits/cache'),{recursive:true});assert.match(f.event('UserPromptSubmit').stdout,/MEC-001/);});
test('hook inválido falha aberto sem emitir aprovação',t=>{const f=fixture(t);f.write('.titbits/config.json','{');const r=f.event('UserPromptSubmit');assert.equal(r.status,0);assert.ok(!r.stdout.includes('continue'));assert.ok(!r.stdout.includes('approve'));});
test('symlink de jogo para fora é rejeitado',t=>{const f=fixture(t);fs.symlinkSync(os.tmpdir(),path.join(f.dir,'fora'));f.write('.titbits/config.json',JSON.stringify({formato:1,enabled:true,local_jogo:'fora'}));assert.equal(f.event('SessionStart').stdout,'');const r=spawnSync(process.execPath,[cli,'verificar','--workspace',f.dir,'--jogo','fora'],{encoding:'utf8'});assert.equal(r.status,2);});
test('symlink de arquivo não é lido',t=>{const f=fixture(t);f.baseline();f.write('segredo.md','sentinela-externa');fs.symlinkSync(path.join(f.dir,'segredo.md'),path.join(f.dir,'docs/jogo/gdd/externo.md'));const r=f.run('verificar');assert.equal(r.status,2);assert.ok(!r.stdout.includes('sentinela-externa'));});
test('cache symlink não recebe escritas',t=>{const f=fixture(t);f.baseline();const outside=fs.mkdtempSync(path.join(os.tmpdir(),'titbits-out-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));fs.symlinkSync(outside,path.join(f.dir,'.titbits/cache'));f.write('docs/jogo/gdd/mecanica.md',f.node('MEC-001')+'mudou');assert.equal(f.event('UserPromptSubmit').stdout,'');assert.deepEqual(fs.readdirSync(outside),[]);});
test('repo aninhado não herda configuração do pai',t=>{const f=fixture(t);fs.mkdirSync(path.join(f.dir,'nested/.git'),{recursive:true});const r=spawnSync(process.execPath,[hook,'codex'],{input:JSON.stringify({cwd:path.join(f.dir,'nested'),session_id:'x',hook_event_name:'SessionStart'}),encoding:'utf8'});assert.equal(r.stdout,'');assert.equal(r.status,0);});
test('entrada JSON inválida e evento Stop não bloqueiam nem escrevem',t=>{for(const input of ['{',JSON.stringify({hook_event_name:'Stop'})]) {const r=spawnSync(process.execPath,[hook,'codex'],{input,encoding:'utf8',timeout:3000});assert.equal(r.status,0);assert.equal(r.stdout,'');}});
test('histórico preserva antes/depois sem duplicar IDs da fonte vigente',t=>{const f=fixture(t);f.write('docs/jogo/historico/DEC-001.md',f.node('MEC-001')+'regra antiga');assert.equal(f.run('reconciliar').status,0);});
test('jogo ainda sem requisitos não ganha baseline validada',t=>{const f=fixture(t);for(const p of ['gdd/mecanica.md','gdd/fase.md','gdd/audio.md','producao/evidencia.md'])f.write('docs/jogo/'+p,'rascunho');assert.equal(f.run('reconciliar').status,2);});
test('startup continua recuperando próximo passo mesmo sem baseline',t=>{const f=fixture(t);const r=f.event('SessionStart');assert.equal(r.status,0);assert.match(r.stdout,/testar o espelho/);assert.match(r.stdout,/nao_avaliado/);});
test('arquivo especial é recusado sem prender CLI', {skip:process.platform==='win32'}, t=>{const f=fixture(t);const p=path.join(f.dir,'docs/jogo/gdd/pipe.md');assert.equal(spawnSync('mkfifo',[p]).status,0);const r=spawnSync(process.execPath,[cli,'verificar','--workspace',f.dir,'--jogo','docs/jogo'],{encoding:'utf8',timeout:1000});assert.equal(r.status,2);});
test('verificação respeita deadline e limite por arquivo',async t=>{const f=fixture(t);const {scan}=await import('../scripts/continuidade.mjs');assert.throws(()=>scan(f.dir,'docs/jogo',Date.now()-1),/tempo/);f.write('docs/jogo/gdd/grande.md','x'.repeat(300000));assert.equal(f.run('verificar').status,2);});
test('mensagem longa é limitada e indica truncamento',t=>{const f=fixture(t);for(let i=2;i<50;i++)f.write('docs/jogo/gdd/regra-'+i+'.md',f.node('MEC-'+String(i).padStart(3,'0')));f.baseline();for(let i=2;i<50;i++)f.write('docs/jogo/gdd/regra-'+i+'.md',f.node('MEC-'+String(i).padStart(3,'0'))+'x');f.write('docs/jogo/producao/estado.md','proximo passo '+'.'.repeat(2000));const r=f.event('SessionStart');const text=JSON.parse(r.stdout).hookSpecificOutput.additionalContext;assert.ok(text.length<=4000);assert.match(text,/truncado/);});
test('input excessivo falha aberto sem contexto ou escrita',t=>{const f=fixture(t);const r=spawnSync(process.execPath,[hook,'codex'],{input:JSON.stringify({cwd:f.dir,session_id:'s',hook_event_name:'SessionStart',prompt:'x'.repeat(70000)}),encoding:'utf8'});assert.equal(r.status,0);assert.equal(r.stdout,'');assert.ok(!fs.existsSync(path.join(f.dir,'.titbits/cache')));});
test('config enabled false não modifica cache nem documentação',t=>{const f=fixture(t);f.write('.titbits/config.json',JSON.stringify({formato:1,enabled:false,local_jogo:'docs/jogo'}));assert.equal(f.event('SessionStart').stdout,'');assert.ok(!fs.existsSync(path.join(f.dir,'.titbits/cache')));});
test('parser recusa blocos quebrados e IDs duplicados',t=>{const f=fixture(t);f.write('docs/jogo/gdd/duplicado.md',f.node('MEC-001'));assert.equal(f.run('reconciliar').status,2);f.write('docs/jogo/gdd/duplicado.md','```titbits-relacoes\n[');assert.equal(f.run('reconciliar').status,2);});
test('finalizar DEC e atualizar estado não invalidam a baseline recém reconciliada',t=>{const f=fixture(t);f.write('docs/jogo/historico/DEC-001.md','estado: preparando');f.baseline();f.write('docs/jogo/historico/DEC-001.md','estado: aplicado');f.write('docs/jogo/producao/estado.md','próximo passo: QA');assert.equal(f.run('verificar').status,0);});
test('reconciliar recusa candidato maior que seu próprio limite de leitura',t=>{const f=fixture(t);const nodes=[];for(let i=1;i<1500;i++)nodes.push({id:'UX-'+String(i).padStart(3,'0'),relacoes:[]});f.write('docs/jogo/gdd/'+'a'.repeat(180)+'.md','```titbits-relacoes\n'+JSON.stringify(nodes)+'\n```');const r=f.run('reconciliar');assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).estado,'nao_avaliado');});
test('troca de ancestral entre validação e open não lê conteúdo externo',async t=>{const f=fixture(t);const {read}=await import('../scripts/continuidade.mjs');const outside=fs.mkdtempSync(path.join(os.tmpdir(),'titbits-race-read-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));fs.writeFileSync(path.join(outside,'mecanica.md'),'SENTINELA_EXTERNA');const original=fs.openSync;let swapped=false;fs.openSync=function(p,...args){if(!swapped&&String(p).endsWith('mecanica.md')){swapped=true;fs.renameSync(path.join(f.dir,'docs/jogo/gdd'),path.join(f.dir,'docs/jogo/gdd-old'));fs.symlinkSync(outside,path.join(f.dir,'docs/jogo/gdd'));}return original.call(this,p,...args);};let content;try{content=read(path.join(f.dir,'docs/jogo'),'gdd/mecanica.md');}catch{content='recusado';}finally{fs.openSync=original;}assert.ok(swapped);assert.notEqual(content,'SENTINELA_EXTERNA');});
test('troca do cache durante gravação não cria arquivo externo',t=>{const f=fixture(t);f.baseline();fs.mkdirSync(path.join(f.dir,'.titbits/cache'),{recursive:true});const outside=fs.mkdtempSync(path.join(os.tmpdir(),'titbits-race-write-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));f.write('preload.mjs',`import fs from 'node:fs';const original=fs.writeFileSync;let swapped=false;fs.writeFileSync=function(p,...args){if(!swapped&&String(p).endsWith('.tmp')){swapped=true;fs.renameSync(${JSON.stringify(path.join(f.dir,'.titbits/cache'))},${JSON.stringify(path.join(f.dir,'.titbits/cache-old'))});fs.symlinkSync(${JSON.stringify(outside)},${JSON.stringify(path.join(f.dir,'.titbits/cache'))});}return original.call(this,p,...args);};`);f.write('docs/jogo/gdd/mecanica.md',f.node('MEC-001')+'mudou');const r=spawnSync(process.execPath,[hook,'codex'],{input:JSON.stringify({cwd:f.dir,session_id:'s',hook_event_name:'UserPromptSubmit'}),encoding:'utf8',env:{...process.env,NODE_OPTIONS:'--import='+path.join(f.dir,'preload.mjs')}});assert.equal(r.status,0);assert.ok(fs.existsSync(path.join(f.dir,'.titbits/cache-old')));assert.deepEqual(fs.readdirSync(outside),[]);});
test('limite de repositório também funciona com arquivo .git de worktree',t=>{const f=fixture(t);f.write('nested/.git','gitdir: checkout-exemplo');const r=spawnSync(process.execPath,[hook,'codex'],{input:JSON.stringify({cwd:path.join(f.dir,'nested'),session_id:'s',hook_event_name:'SessionStart'}),encoding:'utf8'});assert.equal(r.status,0);assert.equal(r.stdout,'');});
test('worker travado termina sem bloqueio, contexto ou escrita',t=>{const f=fixture(t);f.write('delay.mjs',`if(process.argv[1]?.endsWith('hook-worker.mjs')) {const end=Date.now()+10000;while(Date.now()<end){}}`);const r=spawnSync(process.execPath,[hook,'codex'],{input:JSON.stringify({cwd:f.dir,session_id:'s',hook_event_name:'SessionStart'}),encoding:'utf8',env:{...process.env,NODE_OPTIONS:'--import='+path.join(f.dir,'delay.mjs')},timeout:4000});assert.equal(r.status,0);assert.equal(r.stdout,'');assert.match(r.stderr,/indisponível/);assert.ok(!fs.existsSync(path.join(f.dir,'.titbits/cache')));});
test('sessões concorrentes preservam documentos e caches independentes',async t=>{const f=fixture(t);f.baseline();const {spawn}=await import('node:child_process');const before=fs.readFileSync(path.join(f.dir,'docs/jogo/gdd/relacoes.json'),'utf8');const calls=['primeira','segunda'].map(session=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[hook,'codex'],{stdio:['pipe','pipe','pipe']});let out='';child.stdout.on('data',x=>out+=x);child.on('error',reject);child.on('close',code=>resolve({out,code}));child.stdin.end(JSON.stringify({cwd:f.dir,session_id:session,hook_event_name:'SessionStart'}));}));for(const r of await Promise.all(calls)){assert.equal(r.code,0);assert.match(r.out,/SessionStart/);}assert.equal(fs.readdirSync(path.join(f.dir,'.titbits/cache')).filter(x=>x.endsWith('.json')).length,2);assert.equal(fs.readFileSync(path.join(f.dir,'docs/jogo/gdd/relacoes.json'),'utf8'),before);});
test('startup recupera próximo passo mesmo quando a leitura do jogo falha',t=>{const cases={json:f=>f.write('docs/jogo/gdd/mecanica.md','```titbits-relacoes\n[{"id":"MEC-001"\n```\n'),grande:f=>f.write('docs/jogo/gdd/anexo.md','x'.repeat(300000)),symlink:f=>{f.write('fora.md','x');fs.symlinkSync(path.join(f.dir,'fora.md'),path.join(f.dir,'docs/jogo/gdd/link.md'));},sem_versao:f=>f.write('docs/jogo/gdd/README.md','# GDD\n')};for(const [name,apply] of Object.entries(cases)){const f=fixture(t);f.baseline();apply(f);const r=f.event('SessionStart','s-'+name);assert.equal(r.status,0,name);assert.match(r.stdout,/testar o espelho/,name);assert.match(r.stdout,/nao_avaliado/,name);}});
test('reconciliar exige revisão ou confirmação dos afetados em documentos não alterados',t=>{const f=fixture(t);f.baseline();f.write('docs/jogo/gdd/mecanica.md',f.node('MEC-001')+'nova regra');const r=f.run('reconciliar');assert.equal(r.status,1);const o=JSON.parse(r.stdout);assert.equal(o.estado,'revisao_necessaria');assert.deepEqual(o.pendentes,['FAS-001','TEC-001']);assert.equal(o.nos,undefined);assert.equal(f.run('reconciliar','--confirmar','FAS-001').status,1);assert.equal(f.run('reconciliar','--confirmar','FAS-001,MEC-999,TEC-001').status,2);const ok=f.run('reconciliar','--confirmar','FAS-001,TEC-001');assert.equal(ok.status,0,ok.stdout);assert.ok(JSON.parse(ok.stdout).nos.length===4);});
test('revisar os documentos afetados libera a reconciliação sem confirmação',t=>{const f=fixture(t);f.baseline();f.write('docs/jogo/gdd/mecanica.md',f.node('MEC-001')+'nova regra');f.write('docs/jogo/gdd/fase.md',f.node('FAS-001',['MEC-001'])+'revisada');f.write('docs/jogo/producao/evidencia.md',f.node('TEC-001',['FAS-001'])+'revisao_necessaria');const r=f.run('reconciliar');assert.equal(r.status,0,r.stdout);f.write('docs/jogo/gdd/relacoes.json',r.stdout);assert.equal(f.run('verificar').status,0);});
test('baseline existente inválida não é substituída silenciosamente',t=>{const f=fixture(t);f.baseline();f.write('docs/jogo/gdd/relacoes.json','{"formato":1}');assert.equal(f.run('reconciliar').status,2);assert.equal(f.run('reconciliar','--confirmar','MEC-001').status,2);});
test('confirmar só é aceito em reconciliar',t=>{const f=fixture(t);f.baseline();assert.equal(f.run('verificar','--confirmar','MEC-001').status,2);});
test('cerca de relações fora do formato estrito é recusada',t=>{for(const text of ['- item\n  ```titbits-relacoes\n  [{"id":"UX-001","relacoes":[]}]\n  ```\n','```titbits-relacoes json\n[{"id":"UX-001","relacoes":[]}]\n```\n','~~~titbits-relacoes\n[{"id":"UX-001","relacoes":[]}]\n~~~\n']){const f=fixture(t);f.write('docs/jogo/gdd/ux.md',text);assert.equal(f.run('reconciliar').status,2,text);}});
test('hooks declarados nos dois runtimes são só SessionStart e UserPromptSubmit',()=>{for(const p of [path.join(root,'hooks/hooks.json'),path.join(root,'../../codex/plugins/titbits/hooks/hooks.json')]){assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(p,'utf8')).hooks).sort(),['SessionStart','UserPromptSubmit'],p);}});

test('raiz fixada não permite ler nem gravar após troca de ancestral do workspace', t => {
  for (const trigger of ['config.json', 'estado.md']) {
    const f=fixture(t);f.baseline();
    const base=fs.mkdtempSync(path.join(os.tmpdir(),'titbits-root-race-'));
    t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
    const parent=path.join(base,'parent'), workspace=path.join(parent,'workspace'), external=path.join(base,'external');
    fs.mkdirSync(parent);fs.cpSync(f.dir,workspace,{recursive:true});
    fs.cpSync(f.dir,path.join(external,'workspace'),{recursive:true});
    const externalGame=path.join(external,'workspace/docs/jogo');
    fs.mkdirSync(path.join(externalGame,'historico'),{recursive:true});
    fs.writeFileSync(path.join(externalGame,'historico/indice.md'),'SENTINELA_EXTERNA');
    fs.mkdirSync(path.join(external,'workspace/.titbits/cache'),{recursive:true});
    const before=fs.readFileSync(path.join(workspace,'docs/jogo/gdd/relacoes.json'),'utf8');
    const preload=path.join(base,'race.mjs');
    fs.writeFileSync(preload,`import fs from 'node:fs';if(process.argv[1]?.endsWith('hook-worker.mjs')){const original=fs.openSync;let done=false;fs.openSync=function(p,...args){if(!done&&p===${JSON.stringify(trigger)}){done=true;fs.renameSync(${JSON.stringify(parent)},${JSON.stringify(parent+'-saved')});fs.symlinkSync(${JSON.stringify(external)},${JSON.stringify(parent)});}return original.call(this,p,...args)};}`);
    const r=spawnSync(process.execPath,[hook,'codex'],{input:JSON.stringify({cwd:workspace,session_id:'s',hook_event_name:'SessionStart'}),encoding:'utf8',env:{...process.env,NODE_OPTIONS:'--import='+preload},timeout:4000});
    assert.equal(r.status,0,r.stderr);
    assert.ok(fs.existsSync(parent+'-saved'),'a intercalação precisa ocorrer');
    assert.ok(!r.stdout.includes('SENTINELA_EXTERNA'),r.stdout);
    assert.deepEqual(fs.readdirSync(path.join(external,'workspace/.titbits/cache')),[]);
    assert.equal(fs.readFileSync(path.join(parent+'-saved','workspace/docs/jogo/gdd/relacoes.json'),'utf8'),before);
  }
});

test('blocos de exemplo não declaram nós e o parser retoma após a cerca externa', t => {
  for(const [open,close] of [['````markdown','````'],['~~~markdown','~~~']]) {
    const f=fixture(t);
    f.write('docs/jogo/gdd/exemplo.md',open+'\n'+f.node('UX-001')+close+'\n'+f.node('UX-002'));
    const r=f.run('reconciliar');assert.equal(r.status,0,r.stdout);
    assert.deepEqual(JSON.parse(r.stdout).nos.filter(n=>n.id.startsWith('UX-')).map(n=>n.id),['UX-002']);
  }
});

test('cercas malformadas literais em exemplos não invalidam declarações ativas CRLF', t => {
  for(const literal of ['  ```titbits-relacoes\n[]\n  ```','~~~titbits-relacoes\n[]\n~~~','```titbits-relacoes json\n[]\n```']) {
    const f=fixture(t);
    f.write('docs/jogo/gdd/exemplo.md',('````markdown\n'+literal+'\n````\n'+f.node('UX-002')).replaceAll('\n','\r\n'));
    const r=f.run('reconciliar');assert.equal(r.status,0,r.stdout);
    assert.ok(JSON.parse(r.stdout).nos.some(n=>n.id==='UX-002'));
  }
});

function expireDuringRead(f, filename, occurrence) {
  f.write('deadline.mjs',`import fs from 'node:fs';if(process.argv[1]?.endsWith('hook-worker.mjs')){let offset=0,count=0;const now=Date.now;Date.now=()=>now()+offset;const files=new Map(),open=fs.openSync,read=fs.readSync;fs.openSync=function(p,...args){const fd=open.call(this,p,...args);files.set(fd,p);return fd;};fs.readSync=function(fd,...args){const n=read.call(this,fd,...args);if(files.get(fd)===${JSON.stringify(filename)}&&++count===${occurrence})offset+=1100;return n;};}`);
  return spawnSync(process.execPath,[hook,'codex'],{input:JSON.stringify({cwd:f.dir,session_id:'deadline',hook_event_name:'SessionStart'}),encoding:'utf8',env:{...process.env,NODE_OPTIONS:'--import='+path.join(f.dir,'deadline.mjs')},timeout:4000});
}
test('prazo vencido durante releitura da versão preserva retomada e não avalia', t => {
  const f=fixture(t);f.baseline();const r=expireDuringRead(f,'README.md',2);
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/testar o espelho/);assert.match(r.stdout,/nao_avaliado/);
});
test('prazo vencido durante leitura da baseline preserva retomada e não avalia', t => {
  const f=fixture(t);f.baseline();const r=expireDuringRead(f,'relacoes.json',1);
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/testar o espelho/);assert.match(r.stdout,/nao_avaliado/);
});

test('confirmar sem baseline recusa IDs existentes, desconhecidos e prefixo inválido', t => {
  const f=fixture(t);
  for(const ids of ['MEC-001','MEC-999','ZZZ-999','MEC-001,MEC-001']) {
    const r=f.run('reconciliar','--confirmar',ids);assert.equal(r.status,2,ids+': '+r.stdout);
    assert.equal(JSON.parse(r.stdout).nos,undefined);
  }
  assert.equal(f.run('reconciliar').status,0);
  assert.ok(!fs.existsSync(path.join(f.dir,'docs/jogo/gdd/relacoes.json')));
});

test('deduplicação volta a alertar a mesma mudança após observar fontes reconciliadas', t => {
  const f=fixture(t);f.baseline();const original=f.node('MEC-001');
  f.write('docs/jogo/gdd/mecanica.md',original+'mudança A');
  assert.match(f.event('UserPromptSubmit').stdout,/MEC-001/);
  assert.equal(f.event('UserPromptSubmit').stdout,'');
  f.write('docs/jogo/gdd/mecanica.md',original);
  assert.equal(f.event('UserPromptSubmit').stdout,'');
  f.write('docs/jogo/gdd/mecanica.md',original+'mudança A');
  assert.match(f.event('UserPromptSubmit').stdout,/MEC-001/);
  assert.equal(f.event('UserPromptSubmit').stdout,'');
});

test('cerca com quatro espaços dentro de exemplo não encerra o bloco literal', t => {
  const f=fixture(t);
  f.write('docs/jogo/gdd/exemplo.md','````markdown\n    ````\n'+f.node('UX-001')+'````\n'+f.node('UX-002'));
  const r=f.run('reconciliar');assert.equal(r.status,0,r.stdout);
  assert.deepEqual(JSON.parse(r.stdout).nos.filter(n=>n.id.startsWith('UX-')).map(n=>n.id),['UX-002']);
});

test('exemplos cercados em listas não invalidam nem declaram relações', t => {
  for(const item of ['- Exemplo','1.  Exemplo','- Exemplo\n  - Item interno']) {
    const f=fixture(t);
    const literal=f.node('UX-001').replace('titbits-relacoes','titbits-relacoes json').trimEnd().split('\n').map(line=>'    '+line).join('\n');
    f.write('docs/jogo/gdd/exemplo.md',item+'\n\n    ````markdown\n'+literal+'\n    ````\n\n'+f.node('UX-002'));
    const r=f.run('reconciliar');assert.equal(r.status,0,r.stdout);
    assert.deepEqual(JSON.parse(r.stdout).nos.filter(n=>n.id.startsWith('UX-')).map(n=>n.id),['UX-002']);
  }
});

test('sair de lista com exemplo não fechado retoma declarações na primeira coluna', t => {
  const f=fixture(t);
  f.write('docs/jogo/gdd/exemplo.md','- Exemplo\n\n  ````markdown\n  conteúdo literal\n\n'+f.node('UX-002'));
  const r=f.run('reconciliar');assert.equal(r.status,0,r.stdout);
  assert.ok(JSON.parse(r.stdout).nos.some(n=>n.id==='UX-002'));
});

test('continuação de parágrafo sem indentação preserva exemplos dentro da lista', t => {
  for(const item of ['- Exemplo','1.  Exemplo','- Exemplo\n  - Item interno']) {
    const f=fixture(t);
    const literal=f.node('UX-001').trimEnd().split('\n').map(line=>'    '+line).join('\n');
    f.write('docs/jogo/gdd/exemplo.md',item+'\ncontinuação do mesmo parágrafo\n\n    ````markdown\n'+literal+'\n    ````\n\n'+f.node('UX-002'));
    const r=f.run('reconciliar');assert.equal(r.status,0,r.stdout);
    assert.deepEqual(JSON.parse(r.stdout).nos.filter(n=>n.id.startsWith('UX-')).map(n=>n.id),['UX-002']);
  }
});

test('exemplos respeitam padding de lista e marcadores aninhados na mesma linha', t => {
  const cases=[
    {prefix:'-     Exemplo\n\n     ````markdown',indent:'     '},
    {prefix:'- - - Exemplo\n\n      ````markdown',indent:'      '},
    {prefix:'- - ````markdown',indent:'    '},
    {prefix:'1. - ````markdown',indent:'     '},
  ];
  for(const {prefix,indent} of cases) {
    const f=fixture(t);
    const literal=f.node('UX-001').trimEnd().split('\n').map(line=>indent+line).join('\n');
    f.write('docs/jogo/gdd/exemplo.md',prefix+'\n'+literal+'\n'+indent+'````\n\n'+f.node('UX-002'));
    const r=f.run('reconciliar');assert.equal(r.status,0,r.stdout);
    assert.deepEqual(JSON.parse(r.stdout).nos.filter(n=>n.id.startsWith('UX-')).map(n=>n.id),['UX-002']);
  }
});

test('muitos marcadores de lista não consomem o supervisor nem apagam a retomada', t => {
  const f=fixture(t);f.baseline();
  f.write('docs/jogo/gdd/lista.md','- '.repeat(30000)+'Exemplo\n');
  const r=f.event('SessionStart');assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/testar o espelho/);
});

// TB-1: o preparar-jogo cria o índice do GDD em rascunho e sem versão; só o criar-gdd registra a versão 1.
const semVersao = texto => texto.split(/\r?\n/).filter(l => /^\s*[-*+]?\s*vers[ãa]o\s*:/i.test(l));
test('template do GDD nasce em rascunho sem versão nas duas distribuições', () => {
  for (const [nome, d] of Object.entries(distribuicoes)) {
    const texto = fs.readFileSync(d.gdd, 'utf8');
    assert.deepEqual(semVersao(texto), [], nome);
    assert.match(texto.split(/^## /m)[0], /^- estado: rascunho$/m, nome);
  }
});

test('verificar aceita o rascunho sem versão do scaffold sem acusar versão inválida', t => {
  for (const [nome, d] of Object.entries(distribuicoes)) {
    const f = fixture(t, d);
    f.write('docs/jogo/gdd/README.md', fs.readFileSync(d.gdd, 'utf8'));
    const r = f.run('verificar');
    assert.equal(r.status, 2, nome + ': ' + r.stdout);
    const o = JSON.parse(r.stdout);
    assert.equal(o.estado, 'nao_avaliado', nome);
    assert.match(o.motivo, /rascunho sem versão/, nome);
    assert.match(o.motivo, /criar-gdd registrar a versão 1/, nome);
    assert.doesNotMatch(o.motivo, /versão central/, nome);
    assert.ok(!fs.existsSync(path.join(f.dir, 'docs/jogo/gdd/relacoes.json')), nome);
  }
});

test('hook em rascunho sem versão recupera a retomada e não acusa inconsistência', t => {
  for (const [nome, d] of Object.entries(distribuicoes)) {
    const f = fixture(t, d);
    f.write('docs/jogo/gdd/README.md', fs.readFileSync(d.gdd, 'utf8'));
    for (const evento of ['SessionStart', 'UserPromptSubmit']) {
      const r = f.event(evento, 'rascunho-' + evento);
      assert.equal(r.status, 0, nome + ' ' + evento + ': ' + r.stderr);
      const contexto = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
      assert.match(contexto, /rascunho sem versão/, nome + ' ' + evento);
      assert.doesNotMatch(contexto, /inconsistentes/, nome + ' ' + evento);
      if (evento === 'SessionStart') assert.match(contexto, /testar o espelho/, nome);
    }
  }
});

test('reconciliar não gera baseline de rascunho sem versão e libera após a versão 1', t => {
  for (const [nome, d] of Object.entries(distribuicoes)) {
    const f = fixture(t, d);
    const rascunho = '# GDD\n\n- estado: rascunho\n- responsável: pendente\n';
    f.write('docs/jogo/gdd/README.md', rascunho);
    const r = f.run('reconciliar');
    assert.equal(r.status, 2, nome + ': ' + r.stdout);
    const o = JSON.parse(r.stdout);
    assert.equal(o.nos, undefined, nome);
    assert.match(o.motivo, /rascunho sem versão/, nome);
    assert.match(o.motivo, /antes de gerar baseline/, nome);
    f.write('docs/jogo/gdd/README.md', rascunho.replace('- estado: rascunho', '- versão: 1\n- estado: rascunho'));
    const ok = f.run('reconciliar');
    assert.equal(ok.status, 0, nome + ': ' + ok.stdout);
    assert.equal(JSON.parse(ok.stdout).gdd_versao, 1, nome);
  }
});

test('voltar a rascunho sem versão com baseline existente é divergência de versão, não falha de leitura', t => {
  for (const [nome, d] of Object.entries(distribuicoes)) {
    const f = fixture(t, d);
    f.baseline();
    f.write('docs/jogo/gdd/README.md', '# GDD\n- estado: rascunho\n');
    const r = f.run('verificar');
    assert.equal(r.status, 1, nome + ': ' + r.stdout);
    const o = JSON.parse(r.stdout);
    assert.equal(o.estado, 'revisao_necessaria', nome);
    assert.equal(o.versao_divergente, true, nome);
    assert.equal(o.gdd_versao, null, nome);
    const alerta = f.event('UserPromptSubmit', 'volta-' + nome);
    assert.match(JSON.parse(alerta.stdout).hookSpecificOutput.additionalContext, /"versao_divergente":true/, nome);
  }
});

test('versão inválida, estado fora do cabeçalho ou estado não rascunho continuam erro de versão central', t => {
  const casos = {
    versao_pendente: '# GDD\n- versão: pendente\n- estado: rascunho\n',
    versao_maiuscula: '# GDD\n- Versão: um\n- estado: rascunho\n',
    estado_em_secao: '# GDD\n\n## Requisitos\n- estado: rascunho\n',
    estado_proposto: '# GDD\n- estado: proposto\n',
  };
  for (const [nome, texto] of Object.entries(casos)) {
    const f = fixture(t);
    f.write('docs/jogo/gdd/README.md', texto);
    const r = f.run('verificar');
    assert.equal(r.status, 2, nome);
    assert.match(JSON.parse(r.stdout).motivo, /versão central ausente ou inválida/, nome);
  }
});

test('índice legado com versão 1 e estado rascunho continua versão 1', t => {
  const f = fixture(t);
  f.write('docs/jogo/gdd/README.md', '# GDD\n\n- versão: 1\n- estado: rascunho\n- responsável: pendente\n');
  assert.equal(f.baseline().gdd_versao, 1);
  assert.equal(f.run('verificar').status, 0);
});

test('local_jogo documentado com ponto e barra final funciona na CLI e no hook', t => {
  const f=fixture(t); f.baseline();
  for (const local of ['docs/jogo/', './docs/jogo', './docs/jogo/']) {
    f.write('.titbits/config.json', JSON.stringify({formato:1,enabled:true,local_jogo:local}));
    const r=spawnSync(process.execPath,[cli,'verificar','--workspace',f.dir,'--jogo',local],{encoding:'utf8'});
    assert.equal(r.status,0,r.stdout);
    const h=f.event('SessionStart',local);
    assert.match(h.stdout,/testar o espelho/,h.stderr);
  }
  for (const local of ['../docs/jogo','docs//jogo','/docs/jogo','docs\\jogo']) {
    const r=spawnSync(process.execPath,[cli,'verificar','--workspace',f.dir,'--jogo',local],{encoding:'utf8'});
    assert.equal(r.status,2,local);
  }
});

test('CLI explícita suporta leitura lenta que excede orçamento cooperativo do hook', t => {
  const f=fixture(t); f.baseline();
  const preload=path.join(f.dir,'latencia.cjs');
  fs.writeFileSync(preload,`const fs=require('node:fs'); const original=fs.readSync,open=fs.openSync;let target;fs.openSync=function(p,...args){const fd=open.call(this,p,...args);if(String(p).endsWith('mecanica.md'))target=fd;return fd;};fs.readSync=function(...args){if(args[0]===target){target=undefined;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1800);}return original.apply(this,args);};`);
  const r=spawnSync(process.execPath,['--require',preload,cli,'verificar','--workspace',f.dir,'--jogo','docs/jogo'],{encoding:'utf8',timeout:10000});
  assert.equal(r.status,0,r.stdout+r.stderr);
  const worker=spawnSync(process.execPath,['--require',preload,path.join(root,'scripts/hook-worker.mjs'),'codex'],{input:JSON.stringify({cwd:f.dir,session_id:'lento',hook_event_name:'SessionStart'}),encoding:'utf8',timeout:10000});
  assert.match(worker.stdout,/nao_avaliado/);
});

test('comandos registrados nos hooks Claude e Codex entregam retomada', t => {
  const f=fixture(t); f.baseline();
  for (const [runtime,plugin,variable] of [['claude',root,'CLAUDE_PLUGIN_ROOT'],['codex',codexTitbits,'PLUGIN_ROOT']]) {
    const config=JSON.parse(fs.readFileSync(path.join(plugin,'hooks/hooks.json'),'utf8'));
    for (const event of ['SessionStart','UserPromptSubmit']) {
      f.write('docs/jogo/gdd/mecanica.md',f.node('MEC-001')+runtime+event);
      const command=config.hooks[event][0].hooks[0].command.replace('${'+variable+'}',plugin);
      const r=spawnSync(command,{shell:true,input:JSON.stringify({cwd:f.dir,session_id:runtime+event,hook_event_name:event}),encoding:'utf8',timeout:5000});
      assert.equal(r.status,0,r.stderr);
      assert.match(r.stdout,/revisao_necessaria/);
      if(event==='SessionStart') assert.match(r.stdout,/testar o espelho/);
    }
  }
});

test('propostas ficam no inventário sem duplicar nós vigentes nas duas distribuições',t=>{
  for(const d of Object.values(distribuicoes)) {
    const f=fixture(t,d); f.baseline();
    f.write('docs/jogo/propostas/salto.md',f.node('MEC-001')+'alternativa');
    const r=f.run('verificar');assert.equal(r.status,1,r.stdout);
    const o=JSON.parse(r.stdout);assert.ok(o.novos.includes('propostas/salto.md'));assert.deepEqual(o.afetados,[]);
    const b=f.baseline();assert.ok(b.arquivos['propostas/salto.md']);assert.equal(b.nos.filter(n=>n.id==='MEC-001').length,1);
    assert.equal(b.nos.find(n=>n.id==='MEC-001').path,'gdd/mecanica.md');
    f.write('docs/jogo/propostas/salto.md',f.node('MEC-001')+'alternativa revisada');
    assert.ok(JSON.parse(f.run('verificar').stdout).alterados.includes('propostas/salto.md'));
  }
});

test('proposta legada em gdd/propostas exige migração autorizada sem mover arquivo',t=>{
  for(const d of Object.values(distribuicoes)) {
    const f=fixture(t,d);f.baseline();const p='docs/jogo/gdd/propostas/salto.md';f.write(p,'alternativa sem ID');
    const before=fs.readFileSync(path.join(f.dir,p),'utf8');const r=f.run('verificar');assert.equal(r.status,2);
    assert.match(r.stdout,/propostas\/.*autorização/);assert.equal(fs.readFileSync(path.join(f.dir,p),'utf8'),before);
    assert.ok(!fs.existsSync(path.join(f.dir,'docs/jogo/propostas/salto.md')));
  }
});

test('duplicação fora da pasta de propostas informa ID e caminhos sem excluir o achado',t=>{
  for(const d of Object.values(distribuicoes)) {
    const f=fixture(t,d);f.baseline();f.write('docs/jogo/gdd/revisao.md',f.node('MEC-001'));
    const r=f.run('verificar');assert.equal(r.status,2);assert.match(r.stdout,/ID duplicado.*MEC-001/);
    assert.match(r.stdout,/gdd\/mecanica.md/);assert.match(r.stdout,/gdd\/revisao.md/);assert.match(r.stdout,/se for proposta/);
  }
});

test('inventário de propostas recusa symlink sem ler conteúdo externo',t=>{
  for(const d of Object.values(distribuicoes)) {
    const f=fixture(t,d);f.baseline();f.write('externo.md','sentinela-proposta-externa');
    fs.mkdirSync(path.join(f.dir,'docs/jogo/propostas'));
    fs.symlinkSync(path.join(f.dir,'externo.md'),path.join(f.dir,'docs/jogo/propostas/alternativa.md'));
    const r=f.run('verificar');assert.equal(r.status,2);assert.match(r.stdout,/symlink/);assert.ok(!r.stdout.includes('sentinela-proposta-externa'));
  }
});
