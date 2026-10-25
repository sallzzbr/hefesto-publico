#!/usr/bin/env node
// Índice derivado: nenhum comando desta CLI grava a documentação do jogo.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const hash = value => createHash('sha256').update(value).digest('hex');
const ID = /^(MEC|ART|AUD|NAR|UX|TEC|FAS|DEC|EXP|APR)-[0-9]{3,}$/;
const TYPES = new Set(['depende_de','implementa','verifica','representa']);
const MAX_BYTES = 256 * 1024;
function withinDeadline(deadline=Infinity) {
  if(Date.now()>deadline) throw Error('tempo de conferência excedido; cobertura incompleta');
}
// A mesma identidade acompanha configuração, fontes, baseline e cache.
export function pinRoot(workspace) {
  if(typeof workspace !== 'string') return workspace;
  const root=fs.realpathSync(workspace), st=fs.lstatSync(root);
  if(!st.isDirectory() || st.isSymbolicLink()) throw Error('workspace inválido');
  return Object.freeze({path:root,dev:st.dev,ino:st.ino});
}
export function safePath(root, relative, missing = false) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p=>!p || p==='.' || p==='..')) throw Error('path inválido');
  let current = typeof root==='string'?root:root.path;
  for (const piece of relative.split('/')) {
    current = path.join(current,piece);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw Error('symlink não permitido'); }
    catch(e) { if (!(missing && e.code==='ENOENT')) throw e; }
  }
  return current;
}
// Síncrono e restrito ao processo CLI/worker: cwd do SO fixa a identidade do
// diretório. Não reconstruir paths absolutos dentro do callback.
export function inDirectory(root, relative, operation) {
  root=pinRoot(root);
  const original=process.cwd();
  function enter(component, identity) {
    const expected=fs.lstatSync(component);
    if(!expected.isDirectory() || expected.isSymbolicLink()) throw Error('diretório inválido');
    if(identity && (expected.dev!==identity.dev || expected.ino!==identity.ino)) throw Error('raiz do workspace trocada durante operação');
    process.chdir(component);
    const actual=fs.statSync('.');
    if(actual.dev!==expected.dev || actual.ino!==expected.ino) throw Error('diretório trocado durante operação');
  }
  try {
    enter(root.path,root);
    if(relative) {
      if(path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p=>!p||p==='.'||p==='..')) throw Error('path inválido');
      for(const part of relative.split('/')) enter(part);
    }
    return operation();
  } finally {process.chdir(original);}
}
export function read(root, relative, deadline=Infinity) {
  withinDeadline(deadline);
  root=pinRoot(root);
  safePath(root,relative);
  const parts=relative.split('/'), name=parts.pop();
  return inDirectory(root,parts.join('/'),()=>{
    const expected=fs.lstatSync(name);
    if(!expected.isFile() || expected.isSymbolicLink()) throw Error('arquivo não regular');
    const fd=fs.openSync(name,fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const st=fs.fstatSync(fd);
      if(st.dev!==expected.dev || st.ino!==expected.ino || !st.isFile() || st.size>MAX_BYTES) throw Error('arquivo trocado, não regular ou acima do limite');
      const bytes=Buffer.alloc(MAX_BYTES+1);
      const n=fs.readSync(fd,bytes,0,bytes.length,0);
      withinDeadline(deadline);
      if(n>MAX_BYTES) throw Error('arquivo acima do limite');
      return bytes.subarray(0,n).toString('utf8');
    } finally {fs.closeSync(fd);}
  });
}
function relationBlocks(text,deadline) {
  const blocks=[], listIndents=[];
  const columns=(prefix,start=0)=>[...prefix].reduce((n,c)=>c==='\t'?n+4-n%4:n+1,start);
  let fence, body=[], paragraph=false;
  for(const line of text.split(/\r?\n/)) {
    withinDeadline(deadline);
    const indent=columns(/^[ \t]*/.exec(line)[0]);
    // Uma cerca dentro de lista não continua fora do seu contêiner.
    if(fence?.scope && line.trim() && indent<fence.scope) {fence=undefined;body=[];paragraph=false;}
    if(fence) {
      const close=/^[ \t]*(`{3,}|~{3,})[ \t]*$/.exec(line);
      if(close && close[1][0]===fence.char && close[1].length>=fence.length && (fence.relations || indent<=fence.scope+3)) {
        if(fence.relations) {
          if(!/^```[ \t]*$/.test(line)) throw Error('fechamento de relações fora do formato');
          blocks.push(body.join('\n'));
        }
        fence=undefined;body=[];
      } else if(fence.relations) body.push(line);
      continue;
    }
    let offset=0, column=0;
    const itemPattern=/([ \t]*)([-+*]|[0-9]{1,9}[.)])([ \t]+|$)/y;
    let item=itemPattern.exec(line);
    const interrupts=/^[ \t]*(?:`{3,}|~{3,}|#{1,6}(?:[ \t]|$)|>|(?:[-*_][ \t]*){3,}$)/.test(line);
    if(line.trim()) {
      // Prosa pode continuar o parágrafo do item sem repetir a indentação.
      if(!paragraph || item || interrupts) while(listIndents.length && indent<listIndents.at(-1)) listIndents.pop();
      while(item && columns(item[1],column)<=(listIndents.at(-1)||0)+3) {
        withinDeadline(deadline);
        const markerEnd=columns(item[1]+item[2],column), end=columns(item[0],column), padding=end-markerEnd;
        // Mais de quatro espaços inicia código indentado, com base de um espaço.
        listIndents.push(markerEnd+(padding>=1 && padding<=4?padding:1));
        // Avança no texto original; não reconstrói/revarre o prefixo já consumido.
        offset=itemPattern.lastIndex;column=end;
        item=itemPattern.exec(line);
      }
    }
    const scope=listIndents.at(-1)||0;
    const content=line.slice(offset), contentIndent=columns(/^[ \t]*/.exec(content)[0],column);
    const open=/^([ \t]*)(`{3,}|~{3,})(.*)$/.exec(content);
    if(!open) {paragraph=!!content.trim() && !interrupts && contentIndent<scope+4;continue;}
    paragraph=false;
    const relations=/^[ \t]*titbits-relacoes/.test(open[3]);
    if(relations && !/^```titbits-relacoes[ \t]*$/.test(line)) throw Error('bloco de relações fora do formato');
    // Cercas de exemplos seguem o delimitador externo; seu conteúdo é literal.
    if(!relations && (contentIndent-scope>3 || (open[2][0]==='`' && open[3].includes('`')))) continue;
    fence={char:open[2][0],length:open[2].length,relations,scope};
  }
  if(fence?.relations) throw Error('bloco de relações incompleto');
  return blocks;
}
export function scan(workspace, local, deadline=Date.now()+1700) {
  withinDeadline(deadline);
  const root=pinRoot(workspace), game=safePath(root,local);
  inDirectory(root,local,()=>{});
  const arquivos={}, nos=[]; let entries=0, bytes=0;
  function walk(relative='') {
    withinDeadline(deadline);
    const entriesHere=inDirectory(root,local+(relative?'/'+relative:''),()=>fs.readdirSync('.',{withFileTypes:true}));
    for (const e of entriesHere.sort((a,b)=>a.name.localeCompare(b.name))) {
      withinDeadline(deadline);
      if(++entries>2000) throw Error('inventário acima do limite; cobertura incompleta');
      const p=relative?relative+'/'+e.name:e.name;
      if(e.name.startsWith('.')) continue;
      if(!relative && !['gdd','producao'].includes(e.name)) continue;
      if(p==='producao/estado.md') continue;
      if(e.isSymbolicLink()) throw Error('symlink não permitido');
      if(e.isDirectory()) walk(p);
      else if(e.name.endsWith('.md')) {
        const text=read(root,local+'/'+p,deadline); bytes+=Buffer.byteLength(text);
        if(bytes>4*1024*1024) throw Error('documentação acima do limite; cobertura incompleta');
        arquivos[p]=hash(text);
        if(!p.startsWith('gdd/') && !p.startsWith('producao/')) continue;
        for(const block of relationBlocks(text,deadline)) {
          const values=JSON.parse(block);
          if(!Array.isArray(values)) throw Error('relações devem ser lista');
          for(const n of values) {
            withinDeadline(deadline);
            if(!n || !ID.test(n.id) || !Array.isArray(n.relacoes) || n.relacoes.some(r=>!r || !ID.test(r.alvo) || !TYPES.has(r.tipo))) throw Error('nó/relação inválido');
            if(nos.some(v=>v.id===n.id)) throw Error('ID duplicado');
            nos.push({id:n.id,path:p,relacoes:n.relacoes.map(r=>({alvo:r.alvo,tipo:r.tipo})).sort((a,b)=>(a.alvo+a.tipo).localeCompare(b.alvo+b.tipo))});
          }
        }
      }
    }
  }
  walk();
  const version=read(root,local+'/gdd/README.md',deadline).match(/^- versão: ([1-9][0-9]*)\s*$/m);
  if(!version) throw Error('versão central ausente ou inválida');
  nos.sort((a,b)=>a.id.localeCompare(b.id));
  withinDeadline(deadline);
  return {root,game,local,deadline,formato:1,gdd_versao:Number(version[1]),arquivos,nos};
}
export function candidate(s) {
  withinDeadline(s.deadline);
  if(!s.nos.length) throw Error('nenhum requisito mapeado; não avaliado');
  if(s.nos.some(n=>n.relacoes.some(r=>!s.nos.some(v=>v.id===r.alvo)))) throw Error('relação sem destino conhecido');
  const result={formato:1,gdd_versao:s.gdd_versao,arquivos:s.arquivos,nos:s.nos};
  if(Buffer.byteLength(JSON.stringify(result,null,2)+'\n')>MAX_BYTES) throw Error('índice acima do limite legível; reduzir cobertura por projeto');
  withinDeadline(s.deadline);
  return result;
}
function validateBase(b,deadline) {
  if(!b || b.formato!==1 || !Number.isSafeInteger(b.gdd_versao) || b.gdd_versao<1 || !b.arquivos || Array.isArray(b.arquivos) || !Array.isArray(b.nos) || !b.nos.length) throw Error('baseline ausente ou inválida');
  for(const [p,h] of Object.entries(b.arquivos)) if(!p.endsWith('.md') || !/^[a-f0-9]{64}$/.test(h)) throw Error('baseline inválida');
  const ids=new Set();
  for(const n of b.nos) {
    withinDeadline(deadline);
    if(!n || !ID.test(n.id) || ids.has(n.id) || !Object.hasOwn(b.arquivos,n.path) || !Array.isArray(n.relacoes) || n.relacoes.some(r=>!r || !ID.test(r.alvo) || !TYPES.has(r.tipo))) throw Error('baseline inválida');
    ids.add(n.id);
  }
  if(b.nos.some(n=>n.relacoes.some(r=>!ids.has(r.alvo)))) throw Error('baseline inconsistente');
}
export function inspect(s) {
  const b=JSON.parse(read(s.root,s.local+'/gdd/relacoes.json',s.deadline));validateBase(b,s.deadline);
  const keys=Object.keys(s.arquivos);
  const novos=keys.filter(p=>!Object.hasOwn(b.arquivos,p));
  const removidos=Object.keys(b.arquivos).filter(p=>!Object.hasOwn(s.arquivos,p));
  const alterados=keys.filter(p=>Object.hasOwn(b.arquivos,p)&&b.arquivos[p]!==s.arquivos[p]);
  // Um documento inalterado deve gerar exatamente os mesmos nós da baseline.
  for(const p of keys.filter(p=>b.arquivos[p]===s.arquivos[p])) {
    withinDeadline(s.deadline);
    if(JSON.stringify(b.nos.filter(n=>n.path===p))!==JSON.stringify(s.nos.filter(n=>n.path===p))) throw Error('índice diverge da fonte documental');
  }
  const changed=new Set([...novos,...removidos,...alterados]);
  const all=[...b.nos,...s.nos];
  const affected=new Set(all.filter(n=>changed.has(n.path)).map(n=>n.id));
  let grew=true; while(grew) {
    withinDeadline(s.deadline);
    grew=false;for(const n of all) if(!affected.has(n.id)&&n.relacoes.some(r=>affected.has(r.alvo))) {affected.add(n.id);grew=true;}
  }
  const unknown=[...changed].filter(p=>!all.some(n=>n.path===p));
  const dangling=s.nos.some(n=>n.relacoes.some(r=>!s.nos.some(v=>v.id===r.alvo)));
  const incomplete=novos.length>0||removidos.length>0||unknown.length>0||dangling;
  const version=b.gdd_versao!==s.gdd_versao;
  withinDeadline(s.deadline);
  return {estado:changed.size||version?'revisao_necessaria':'sem_alteracoes',cobertura:incomplete?'incompleta':'declarada',gdd_versao:s.gdd_versao,versao_divergente:version,alterados,novos,removidos,afetados:[...affected].sort(),nao_mapeados:unknown};
}
// Afetado em documento não alterado: a reconciliação apagaria o sinal sem revisão.
export function pending(s,confirmed=[]) {
  if(confirmed.some(id=>!ID.test(id))) throw Error('ID de confirmação inválido');
  let b;
  try {b=JSON.parse(read(s.root,s.local+'/gdd/relacoes.json',s.deadline));}
  catch(e) {
    if(e.code==='ENOENT') {
      if(confirmed.length) throw Error('confirmação exige baseline existente');
      return [];
    }
    throw Error('baseline existente ilegível; preservar e resolver antes de reconciliar');
  }
  const state=inspect(s);
  if(confirmed.some(id=>!state.afetados.includes(id))) throw Error('confirmação inclui ID não afetado');
  const unchanged=new Set(Object.keys(s.arquivos).filter(p=>b.arquivos[p]===s.arquivos[p]));
  return s.nos.filter(n=>unchanged.has(n.path)&&state.afetados.includes(n.id)&&!confirmed.includes(n.id)).map(n=>n.id).sort();
}
export function check(workspace,local) {
  try {return inspect(scan(workspace,local));}
  catch {return {estado:'nao_avaliado',cobertura:'incompleta',motivo:'Não foi possível conferir fontes e baseline. Execute verificar e revise configuração, limites e índice.'};}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [action,a,workspace,b,local,...rest]=process.argv.slice(2);
    const confirm=action==='reconciliar'&&rest.length===2&&rest[0]==='--confirmar'&&rest[1].split(',').every(id=>ID.test(id));
    if(!['verificar','reconciliar'].includes(action)||a!=='--workspace'||b!=='--jogo'||!local||(rest.length&&!confirm)) throw Error('uso: verificar --workspace <dir> --jogo <path relativo> | reconciliar --workspace <dir> --jogo <path relativo> [--confirmar ID,ID]');
    const s=scan(workspace,local);
    if(action==='reconciliar') {
      const pendentes=pending(s,confirm?rest[1].split(','):[]);
      if(pendentes.length) {
        process.stdout.write(JSON.stringify({estado:'revisao_necessaria',pendentes,motivo:'Afetados em documentos não alterados. Revisar e marcar tarefas/evidências, ou confirmar explicitamente com --confirmar.'},null,2)+'\n');
        process.exitCode=1;
      } else {process.stdout.write(JSON.stringify(candidate(s),null,2)+'\n');process.exitCode=0;}
    } else {
      const result=inspect(s);
      process.stdout.write(JSON.stringify(result,null,2)+'\n');
      process.exitCode=result.estado!=='sem_alteracoes'?1:0;
    }
  } catch(e) { process.stdout.write(JSON.stringify({estado:'nao_avaliado',cobertura:'incompleta',motivo:e.message})+'\n');process.exitCode=2; }
}
