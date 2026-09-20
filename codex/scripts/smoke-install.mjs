#!/usr/bin/env node
// Smoke opcional: CLI instalada, perfil descartável, nenhuma sessão de modelo.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';
const codex = resolve(import.meta.dirname, '..');
const temp = mkdtempSync(join(tmpdir(), 'hefesto-codex-smoke-'));
const profile = join(temp, 'profile'), workspace = join(temp, 'workspace');
mkdirSync(profile); mkdirSync(workspace);
// CODEX_HOME mantém seu significado: diretório de configuração deste processo de teste.
const env = { ...process.env, CODEX_HOME: profile };
function cli(args) {
  const r = spawnSync('codex', args, { cwd: workspace, env, encoding: 'utf8', timeout: 30000 });
  if (r.status !== 0) throw new Error(`${args.join(' ')}: ${r.error?.message || r.stderr || 'CLI falhou'}`);
  return r.stdout;
}
async function descobrir() {
  const child = spawn('codex', ['app-server', '--stdio'], { cwd: workspace, env, stdio: ['pipe','pipe','pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const reader = createInterface({ input: child.stdout });
  try {
    return await new Promise((accept, reject) => {
      const timer = setTimeout(() => reject(new Error('skills/list excedeu 30s')), 30000);
      const finish = (err, value) => { clearTimeout(timer); err ? reject(err) : accept(value); };
      const send = value => child.stdin.write(JSON.stringify(value) + '\n');
      child.on('error', err => finish(err));
      child.on('exit', code => finish(new Error(`app-server encerrou: ${code}; ${stderr}`)));
      reader.on('line', line => {
        try {
          const msg = JSON.parse(line);
          if (msg.id === 1) {
            if (msg.error) throw new Error(JSON.stringify(msg.error));
            send({ method: 'initialized', params: {} });
            send({ id: 2, method: 'skills/list', params: { cwds: [workspace], forceReload: true } });
          } else if (msg.id === 2) {
            if (msg.error) throw new Error(JSON.stringify(msg.error));
            finish(null, msg.result);
          }
        } catch (err) { finish(err); }
      });
      send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'hefesto-smoke', version: '0.1.0' }, capabilities: { experimentalApi: true } } });
    });
  } finally {
    reader.close();
    if (child.exitCode === null) {
      await new Promise(done => { child.once('exit', done); child.kill('SIGTERM'); });
    }
  }
}
try {
  const version = cli(['--version']).trim();
  const marketplace = JSON.parse(cli(['plugin', 'marketplace', 'add', codex, '--json']));
  if (marketplace.marketplaceName !== 'hefesto') throw new Error('marketplace incorreto');
  const esperado = { hefesto: 4, bragir: 11, hestia: 6, odin: 6, mimyr: 5, hermes: 16 };
  const installed = [];
  for (const name of Object.keys(esperado)) installed.push(JSON.parse(cli(['plugin', 'add', `${name}@hefesto`, '--json'])));
  const data = (await descobrir()).data;
  if (!Array.isArray(data) || data.length !== 1 || data[0].errors?.length) throw new Error('erro de descoberta de skills');
  const skills = data[0].skills.filter(s => s.pluginId?.endsWith('@hefesto'));
  for (const [name, count] of Object.entries(esperado)) {
    const group = skills.filter(s => s.pluginId === `${name}@hefesto`);
    if (group.length !== count || group.some(s => !s.enabled || s.path.includes('/shared/'))) throw new Error(`descoberta incorreta de ${name}`);
  }
  const hermes = installed.find(p => p.name === 'hermes');
  const input = join(workspace, 'args.json'); writeFileSync(input, '{}');
  const smoke = spawnSync(process.execPath, [join(hermes.installedPath, 'runtime/bridge.mjs'), 'iniciar', join(workspace, 'run'), input], { cwd: workspace, env, encoding: 'utf8', timeout: 10000 });
  if (smoke.status !== 0 || JSON.parse(smoke.stdout).resultado?.status !== 'erro') throw new Error('controlador instalado não executou o veto de argumentos');
  console.log(JSON.stringify({ cli: version, marketplace: 'hefesto', instalados: installed.length, skills: skills.length, porPlugin: esperado, errosDeDescoberta: [], controladorInstalado: 'veto de argumentos Hermes verificado', perfil: 'temporário removido ao terminar', chamadasDeModelo: 0 }, null, 2));
} catch (err) { console.error(err.message); process.exitCode = 1; }
finally { rmSync(temp, { recursive: true, force: true }); }
