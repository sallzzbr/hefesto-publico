#!/usr/bin/env node
// Comandos de manutenção sem sintaxe de shell e sem instalar dependências.
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function verificarAlvo(root = ROOT) {
  const target = join(root, 'plugins/hefesto/skills/validar-plugin/scripts/validar.mjs');
  try { if (statSync(target).isFile()) return; } catch { /* Falha fechada abaixo. */ }
  throw new Error('o alvo do mutation testing está ausente ou não é arquivo. Não executar Stryker sem alvo.');
}

export function planoPython(mode, plugin, env = process.env, platform = process.platform) {
  // Nome de plugin com suíte própria (plugins/<nome>/tests): forma kebab-case e diretório existente, nada além.
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(plugin ?? '') || !existsSync(join(ROOT, 'plugins', plugin, 'tests'))
      || !['pytest', 'cobertura'].includes(mode)
      || (mode === 'cobertura' && plugin !== 'hestia')) throw new Error('combinação de comando/plugin inválida');
  const args = ['-m', 'pytest', '-p', 'no:cacheprovider'];
  if (mode === 'cobertura') args.push('-p', 'pytest_cov');
  args.push('-q');
  if (mode === 'cobertura') args.push('--cov=plugins/hestia/scripts', '--cov-report=term-missing', '--cov-fail-under=90');
  args.push(`plugins/${plugin}/tests`);
  return {
    command: env.PYTHON || (platform === 'win32' ? 'python' : 'python3'),
    args,
    env: { ...env, PYTHONDONTWRITEBYTECODE: '1', PYTEST_DISABLE_PLUGIN_AUTOLOAD: '1' },
  };
}

export function executarProcesso(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: ROOT, env, stdio: 'inherit', shell: false });
  if (result.error || result.signal || result.status === null) {
    console.error(`ERRO: não foi possível concluir ${command}: ${result.error?.message || result.signal || 'sem código de saída'}`);
    return 1;
  }
  return result.status;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    const [mode, plugin, ...extra] = process.argv.slice(2);
    if (mode === 'premutation' && !plugin && !extra.length) verificarAlvo();
    else {
      if (extra.length) throw new Error('argumentos excedentes');
      const plan = planoPython(mode, plugin);
      process.exitCode = executarProcesso(plan.command, plan.args, plan.env);
    }
  } catch (cause) {
    console.error(`ERRO: ${cause.message}`);
    process.exitCode = 1;
  }
}
