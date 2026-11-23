// O sistema entrega o evento em stdin. Uma falha de manutenção nunca bloqueia a conversa.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (['darwin', 'linux'].includes(process.platform)) {
  const script = fileURLToPath(new URL('./temporarios.py', import.meta.url));
  const r = spawnSync('python3', ['-I', '-S', '-B', script, process.argv[2]], { stdio: 'inherit', timeout: 4000 });
  if (r.error || r.status !== 0) process.stderr.write('Higeia: manutenção da sessão incompleta. Confira os temporários na retomada.\n');
}
