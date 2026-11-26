import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

const eventos = { sessionStart: 'SessionStart', stop: 'Stop' };
const confiancas = new Set(['trusted', 'untrusted', 'modified', 'managed']);

function resumir(entry) {
  const origens = new Map();
  let parcial = Boolean(entry.errors.length || entry.warnings.length);
  for (const hook of entry.hooks) {
    if (!hook?.source || !hook.eventName || (hook.source === 'plugin' && !hook.pluginId)) parcial = true;
    if (hook?.source !== 'plugin' || typeof hook.pluginId !== 'string' || !/^higeia@[^@]+$/.test(hook.pluginId)) continue;
    if (!origens.has(hook.pluginId)) origens.set(hook.pluginId, []);
    origens.get(hook.pluginId).push(hook);
  }
  if (!origens.size) origens.set(null, []);
  const hooks = [];
  for (const [plugin, lista] of origens) {
    for (const [nome, evento] of Object.entries(eventos)) {
      const encontrados = lista.filter(h => h.eventName === nome);
      if (!encontrados.length) {
        hooks.push({ plugin, evento, descoberta: parcial ? 'inconclusiva' : 'não listado' });
      }
      for (const h of encontrados) {
        hooks.push({ plugin, evento, descoberta: 'listado',
          habilitado: typeof h.enabled === 'boolean' ? h.enabled : null,
          confianca: confiancas.has(h.trustStatus) ? h.trustStatus : 'desconhecida' });
      }
    }
  }
  return { estado: parcial ? 'parcial' : 'consultado', avisos: entry.warnings.length, erros: entry.errors.length, hooks };
}

// O cliente consulta a configuração efetiva por pasta, sem iniciar thread ou enviar mensagem.
export function consultarHooksCodex(root) {
  const fonte = 'Codex CLI · hooks/list';
  return new Promise(resolveConsulta => {
    const child = spawn('codex', ['app-server', '--stdio'], { cwd: root, stdio: ['pipe', 'pipe', 'ignore'] });
    let encerrado = false;
    let bytes = 0;
    child.stdout.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > 4 * 1024 * 1024) falha('Resposta acima do limite de leitura.');
    });
    const reader = createInterface({ input: child.stdout });
    const timer = setTimeout(() => falha('Tempo de consulta excedido.'), 8000);
    function terminar(resultado) {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(timer);
      reader.close();
      child.stdin.end();
      if (child.pid && child.exitCode === null && child.signalCode === null) {
        // O app-server encerra ao receber EOF. Limite também a espera por um cliente travado.
        const limite = setTimeout(() => child.kill('SIGKILL'), 500);
        limite.unref();
        child.once('close', () => clearTimeout(limite));
      }
      resolveConsulta({ fonte, execucao: 'não aferida nesta consulta', ...resultado });
    }
    function falha(motivo) { terminar({ estado: 'indisponível', motivo, hooks: [] }); }
    function enviar(msg) { child.stdin.write(JSON.stringify(msg) + '\n'); }
    child.on('error', err => falha(err.code === 'ENOENT' ? 'Codex CLI ausente no PATH.' : 'Falha ao iniciar o Codex CLI.'));
    child.on('close', () => falha('Codex encerrou antes de responder.'));
    child.stdin.on('error', () => falha('Falha de comunicação com o Codex.'));
    reader.on('error', () => falha('Falha na leitura da resposta do Codex.'));
    reader.on('line', line => {
      if (encerrado) return;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== 1 && msg.id !== 2) return;
        if (msg.error) return falha(msg.error.code === -32601 ? 'Versão do Codex sem suporte a hooks/list.' : 'O Codex recusou a consulta.');
        if (msg.id === 1) {
          enviar({ method: 'initialized', params: {} });
          enviar({ id: 2, method: 'hooks/list', params: { cwds: [root] } });
          return;
        }
        const entries = msg.result?.data;
        const entry = Array.isArray(entries) && entries.length === 1 && entries[0];
        if (!entry || typeof entry.cwd !== 'string' || resolve(entry.cwd) !== root ||
            ![entry.hooks, entry.errors, entry.warnings].every(Array.isArray)) {
          return falha('Resposta incompatível ou de outra pasta.');
        }
        terminar(resumir(entry));
      } catch { falha('Resposta inválida do Codex.'); }
    });
    child.on('spawn', () => enviar({ id: 1, method: 'initialize', params: {
      clientInfo: { name: 'higeia', version: '1' }, capabilities: { experimentalApi: true },
    } }));
  });
}
