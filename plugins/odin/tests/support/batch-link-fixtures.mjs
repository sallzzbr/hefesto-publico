import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixture, selected } from './tracked-pending-fixtures.mjs';
import { contract, responses, runHarness, specification } from './quality-fixtures.mjs';
export const inspector = fileURLToPath(new URL('../../skills/dev-loop/scripts/inspecionar-git.mjs', import.meta.url));
export function sparse(t, count) {
  const workspace = fixture(t);
  const paths = Array.from({ length: count }, (_, i) => `outside/file-${i}.txt`);
  paths.forEach(path => workspace.write(path, 'excluded\n')); workspace.commit();
  workspace.git('sparse-checkout', 'init', '--cone', '--no-sparse-index');
  workspace.git('sparse-checkout', 'set', 'src', 'docs', 'tests');
  return { ...workspace, paths };
}
export function intercept(workspace, mode = 'native') {
  const lookup = spawnSync('which', ['git'], { env: workspace.env, encoding: 'utf8' });
  assert.equal(lookup.status, 0, lookup.stderr);
  const bin = join(workspace.parent, 'batch-bin'); mkdirSync(bin);
  const log = join(workspace.parent, 'batch.jsonl'); writeFileSync(log, '');
  const script = join(bin, 'git');
  writeFileSync(script, `#!${process.execPath}\n` + `
const fs=require('node:fs'); const {spawnSync}=require('node:child_process');
const args=process.argv.slice(2), input=fs.readFileSync(0), i=args.indexOf('sparse-checkout');
fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({args,input:input.toString('base64')})+'\\n');
if(i>=0 && args[i+1]==='check-rules') {
  const paths=input.toString().split('\\0').filter(Boolean), first=paths[0], mode=process.env.ODIN_BATCH_MODE;
  if(mode==='signal') process.kill(process.pid,'SIGTERM');
  if(mode==='fallback') {process.stderr.write("error: unknown subcommand: \\x60check-rules'\\nusage: git sparse-checkout <subcommand>\\n");process.exitCode=129;return;}
  const output={unterminated:first,duplicate:first+'\\0'+first+'\\0',unknown:'foreign/file.txt\\0',emptyRecord:'\\0',partial:first+'\\0',warning:'',reversed:paths.slice().reverse().join('\\0')+'\\0'};
  if(Object.hasOwn(output,mode)) {process.stdout.write(output[mode]);if(mode==='partial'||mode==='warning')process.stderr.write('fatal: incomplete membership\\n');process.exitCode=mode==='partial'?1:0;return;}
}
const result=spawnSync(${JSON.stringify(lookup.stdout.trim())},args,{env:process.env,input});
if(result.error)throw result.error;process.stdout.write(result.stdout);process.stderr.write(result.stderr);process.exitCode=result.status===null?1:result.status;
`);
  chmodSync(script, 0o755); workspace.env.PATH = bin + delimiter + workspace.env.PATH; workspace.env.ODIN_BATCH_MODE = mode;
  return { records: () => readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)), clear: () => writeFileSync(log, '') };
}
export function unchanged(workspace) {
  const index = readFileSync(join(workspace.root, '.git/index'));
  const bits = workspace.git('ls-files', '-v');
  const bytes = selected.map(path => readFileSync(join(workspace.root, path)));
  return () => { assert.deepEqual(readFileSync(join(workspace.root, '.git/index')), index); assert.equal(workspace.git('ls-files', '-v'), bits); selected.forEach((path,i) => assert.deepEqual(readFileSync(join(workspace.root,path)),bytes[i])); };
}
export function diff(workspace, paths) {
  return spawnSync(process.execPath, [inspector, 'diff', JSON.stringify(paths), 'HEAD'], { cwd: workspace.root, env: workspace.env, encoding: 'utf8' });
}
export const linkPath = 'src/internal-link';
export const observation = 'src/internal-link is a symlink; literal destination a.js resolves inside src to a regular file. Inspected only link bytes and containment; target content is outside this link inspection.';
export function linkSpec(workspace) {
  const quality = contract(); quality.checks.forEach(check => { check.paths = [linkPath]; });
  const text = specification(quality) + '\n## Link inspection\n' + observation + '\n';
  workspace.write(selected[2], text);
  return { quality, line: text.split('\n').indexOf(observation) + 1 };
}
export async function auditLink(workspace, { quality, line, measured, evidence = {}, mutate = value => value, perfil = 'economico' }) {
  const table = responses(quality), measurements = [];
  const result = await runHarness({ quality, options: { workspaceRoot: workspace.root, scriptsDir: inspector.slice(0, inspector.lastIndexOf('/')), perfil }, overrides: {
    'spec:validar': () => { const value = table['spec:validar'](); value.unidades[0].arquivos = linkPath; return value; },
    'impl:': () => ({ ...table['impl:'](), arquivosTocados: [linkPath] }),
    'validar:': (options, calls, prompt) => {
      let value = measured;
      if (!value) {
        const commands = [...prompt.matchAll(/```bash\n([\s\S]*?)```/g)].map(match => match[1].trim()).filter(command => /inspecionar-git\.mjs.* quality /.test(command));
        assert.equal(commands.length, 1);
        const execution = spawnSync('/bin/sh', ['-c', commands[0]], { cwd: workspace.root, env: workspace.env, encoding: 'utf8' });
        value = JSON.parse(execution.stdout); measurements.push({ execution, value });
      }
      return { ...table['validar:'](options), qualityInventory: mutate(structuredClone(value)) };
    },
    'ponytail:': () => { const value = table['ponytail:'](); value.qualityReview.forEach(item => { item.evidence = [{ path: selected[2], line, observation, ...evidence }]; }); return value; },
  } });
  return { ...result, measurements };
}
