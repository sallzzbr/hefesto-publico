#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// Supervisor limita entrada e execução até quando o worker encontra IO lento.
if(!['claude','codex'].includes(process.argv[2]))process.exit(0);
let input='';
const timer=setTimeout(()=>process.exit(0),400);
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{input+=chunk;if(Buffer.byteLength(input)>65536)process.exit(0);});
process.stdin.on('error',()=>process.exit(0));
process.stdin.on('end',()=>{
  clearTimeout(timer);
  try {
    JSON.parse(input);
    const result=spawnSync(process.execPath,[fileURLToPath(new URL('./hook-worker.mjs',import.meta.url))],{input,encoding:'utf8',timeout:1500,maxBuffer:32768,windowsHide:true});
    if(result.status===0 && result.stdout) process.stdout.write(result.stdout);
    else if(result.error) process.stderr.write('TitBits: conferência indisponível; continue e consulte o GDD.\n');
  } catch { /* Fail-open. Nunca exit 2 ou decision block. */ }
});
