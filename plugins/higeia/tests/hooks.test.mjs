import assert from 'node:assert/strict';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync,
  renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { promisify } from 'node:util';

const pacote = fileURLToPath(new URL('../', import.meta.url));
const posix = { skip: !['darwin', 'linux'].includes(process.platform) };

function ensaio(t, runtime = 'claude') {
  const temp = realpathSync(mkdtempSync(join(tmpdir(), 'higeia hooks ')));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const env = { ...process.env, TMPDIR: temp };
  const codex = runtime === 'codex';
  const root = codex ? join(pacote, '../../codex/plugins/higeia') : pacote;
  const helper = join(root, codex ? 'shared/scripts' : 'scripts', 'temporarios.py');
  const hooks = JSON.parse(readFileSync(join(root, 'hooks/hooks.json'))).hooks;
  const chave = sid => createHash('sha256').update(runtime + '\0' + sid).digest('hex');
  function evento(sid, hook_event_name, extra = {}) {
    const cmd = hooks[hook_event_name][0].hooks[0].command;
    const r = spawnSync('/bin/sh', ['-c', cmd], { env: { ...env, CLAUDE_PLUGIN_ROOT: root, PLUGIN_ROOT: root },
      cwd: temp, input: JSON.stringify({ hook_event_name, session_id: sid, cwd: temp, last_assistant_message: "concluído", ...extra }), encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, '');
    const saida = r.stdout ? JSON.parse(r.stdout) : {};
    return saida.hookSpecificOutput?.additionalContext || saida.decision || '';
  }
  function helperCmd(sid, ...args) {
    return execFileSync('python3', ['-I', '-S', '-B', helper, runtime, chave(sid), ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  }
  return { temp, evento, helperCmd, chave, env, helper };
}

for (const runtime of ['claude', 'codex']) {
  test(runtime + ' cria somente sob demanda e recolhe só o rascunho registrado da própria sessão', posix, t => {
    const f = ensaio(t, runtime);
    const contexto = f.evento('s1', 'SessionStart');
    assert.ok(contexto.includes(f.chave('s1')) && contexto.includes(f.helper) && contexto.includes('reter'));
    assert.deepEqual(readdirSync(f.temp), []);
    const a = f.helperCmd('s1', 'novo', 'csv'), b = f.helperCmd('s2', 'novo');
    const entrega = join(f.temp, 'entrega.csv'), incerto = join(dirname(a), 'outro.csv');
    for (const file of [a, b, entrega, incerto]) writeFileSync(file, 'preservar');
    f.evento('s1', 'Stop');
    assert.equal(existsSync(a), false);
    for (const file of [b, entrega, incerto]) assert.equal(readFileSync(file, 'utf8'), 'preservar');
    f.evento('s1', 'Stop', { stop_hook_active: true });
    assert.equal(readFileSync(incerto, 'utf8'), 'preservar');
  });
}

test('retenção sobrevive a Stop e à retomada até liberação explícita', posix, t => {
  const f = ensaio(t);
  const continuar = f.helperCmd('a', 'novo'), pronto = f.helperCmd('a', 'novo');
  f.helperCmd('a', 'reter', continuar);
  f.helperCmd('a', 'reter', continuar);
  assert.throws(() => f.helperCmd('b', 'liberar', continuar));
  f.evento('a', 'Stop', { background_tasks: [{ type: 'shell' }] });
  assert.ok(existsSync(pronto));
  assert.match(f.evento('a', 'SessionStart', { source: 'resume' }), /2 arquivo/);
  f.evento('a', 'Stop');
  assert.ok(existsSync(continuar) && !existsSync(pronto));
  f.helperCmd('a', 'liberar', basename(continuar));
  f.evento('a', 'Stop');
  assert.equal(existsSync(dirname(continuar)), false);
});

test('preserva entregas movidas, substituições atômicas, diretórios e symlinks', posix, t => {
  const f = ensaio(t), novo = () => f.helperCmd('s1', 'novo');
  const entrega = join(f.temp, 'relatorio'), r = novo();
  writeFileSync(r, 'entrega'); renameSync(r, entrega);
  const substituido = novo(); unlinkSync(substituido); writeFileSync(substituido, 'versão nova');
  const link = novo(); unlinkSync(link); symlinkSync(entrega, link);
  const pasta = novo(); unlinkSync(pasta); mkdirSync(pasta); writeFileSync(join(pasta, 'final'), 'final');
  f.evento('s1', 'Stop');
  assert.equal(readFileSync(entrega, 'utf8'), 'entrega');
  assert.equal(readFileSync(substituido, 'utf8'), 'versão nova');
  assert.equal(readFileSync(link, 'utf8'), 'entrega');
  assert.equal(readFileSync(join(pasta, 'final'), 'utf8'), 'final');
});

test('retoma uma coleta interrompida depois da captura e recusa caminhos de fora', posix, t => {
  const f = ensaio(t), r = f.helperCmd('a', 'novo');
  const fora = join(f.temp, 'externo'); writeFileSync(fora, 'dados');
  assert.throws(() => f.helperCmd('a', 'reter', fora));
  assert.throws(() => f.helperCmd('a', 'novo', '../externo'));
  renameSync(r, join(dirname(r), '.recibos', 'coleta.' + basename(r)));
  f.evento('a', 'Stop');
  assert.equal(existsSync(dirname(r)), false);
  assert.equal(readFileSync(fora, 'utf8'), 'dados');
});

test('cliente e sessão particionam o mesmo TMPDIR, e eventos sem identidade preservam o arquivo', posix, t => {
  const f = ensaio(t), r = f.helperCmd('id', 'novo');
  const hook = join(pacote, 'scripts/hook-sessao.mjs');
  for (const [runtime, event] of [['codex', { session_id: 'id', hook_event_name: 'Stop' }],
    ['claude', { hook_event_name: 'Stop' }], ['claude', { session_id: 'id', hook_event_name: 'SessionEnd' }]]) {
    const result = spawnSync(process.execPath, [hook, runtime], { input: JSON.stringify(event), env: f.env });
    assert.equal(result.status, 0);
    assert.ok(existsSync(r));
  }
});

test('um link de entrega na resposta retém o arquivo entre turnos e impede apenas a primeira conclusão', posix, t => {
  const f = ensaio(t), a = f.helperCmd('s', 'novo', 'pdf'), b = f.helperCmd('s', 'novo');
  writeFileSync(a, 'relatório');
  const resposta = { last_assistant_message: '[Baixar PDF](' + a.replace('rascunho', '%72ascunho') + ')' };
  assert.equal(f.evento('s', 'Stop', resposta), 'block');
  assert.equal(readFileSync(a, 'utf8'), 'relatório');
  assert.ok(!existsSync(b));
  assert.equal(f.evento('s', 'Stop', { ...resposta, stop_hook_active: true }), '');
  f.evento('s', 'Stop');
  assert.equal(JSON.parse(f.helperCmd('s', 'listar'))[0].estado, 'retido');
  const final = join(f.temp, 'resultado.pdf'); renameSync(a, final);
  f.evento('s', 'Stop');
  assert.equal(readFileSync(final, 'utf8'), 'relatório');
});

test('fim sem resposta preserva as reservas e link para a pasta retém seus arquivos', posix, t => {
  const f = ensaio(t), a = f.helperCmd('s', 'novo');
  f.evento('s', 'Stop', { last_assistant_message: null });
  assert.ok(existsSync(a));
  assert.equal(f.evento('s', 'Stop', { last_assistant_message: 'Arquivos em <' + dirname(a) + '/>' }), 'block');
  f.evento('s', 'Stop');
  assert.ok(existsSync(a));
});

test('reservas simultâneas têm identidades independentes e dois Stop são idempotentes', posix, async t => {
  const f = ensaio(t);
  const executar = promisify(execFile);
  const reservar = async sid => (await executar('python3', ['-I', '-S', '-B', f.helper, 'claude', f.chave(sid), 'novo'], { env: f.env })).stdout.trim();
  const [a, b, c] = await Promise.all([reservar('a'), reservar('b'), reservar('a')]);
  assert.equal(new Set([a, b, c]).size, 3);
  const parar = () => new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [join(pacote, 'scripts/hook-sessao.mjs'), 'claude'], { env: f.env }, (e, out, err) => {
      if (e || err) reject(e || Error(err));
      else resolve(out);
    });
    child.stdin.end(JSON.stringify({ session_id: 'a', hook_event_name: 'Stop', last_assistant_message: 'ok' }));
  });
  await Promise.all([parar(), parar()]);
  assert.ok(!existsSync(a) && !existsSync(c) && existsSync(b));
});

test('uma pasta de sessão redirecionada não permite alcançar a reserva através do link', posix, t => {
  const f = ensaio(t), a = f.helperCmd('s', 'novo');
  writeFileSync(a, 'preservar');
  const antes = dirname(a), movido = join(f.temp, 'movido');
  renameSync(antes, movido); symlinkSync(movido, antes);
  const r = spawnSync(process.execPath, [join(pacote, 'scripts/hook-sessao.mjs'), 'claude'], {
    env: f.env, input: JSON.stringify({ session_id: 's', hook_event_name: 'Stop', last_assistant_message: 'ok' }), encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /incompleta/);
  assert.equal(readFileSync(join(movido, basename(a)), 'utf8'), 'preservar');
});
