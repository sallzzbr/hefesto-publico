import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { executarProcesso, planoPython, verificarAlvo } from '../../../scripts/manutencao.mjs';

test('manutenção preserva saída e código real de erro do subprocesso', () => {
  assert.equal(executarProcesso(process.execPath, ['-e', 'process.exit(7)']), 7);
});
test('manutenção não converte executável ausente em sucesso', () => {
  assert.equal(executarProcesso(join(tmpdir(), 'hefesto-python-inexistente'), []), 1);
});
test('manutenção executa sem shell e preserva argumentos com espaços', () => {
  assert.equal(executarProcesso(process.execPath, ['-e', 'if(process.argv[1] !== "a b;$HOME") process.exit(9)', 'a b;$HOME']), 0);
});
test('pytest preserva flags, ambiente e interpretador explícito em Windows', () => {
  const p = planoPython('pytest', 'hermes', { PYTHON: 'C:\\Python com espaço\\python.exe', EXISTENTE: 'sim' }, 'win32');
  assert.equal(p.command, 'C:\\Python com espaço\\python.exe');
  assert.deepEqual(p.args, ['-m','pytest','-p','no:cacheprovider','-q','plugins/hermes/tests']);
  assert.equal(p.env.EXISTENTE, 'sim');
  assert.equal(p.env.PYTHONDONTWRITEBYTECODE, '1');
  assert.equal(p.env.PYTEST_DISABLE_PLUGIN_AUTOLOAD, '1');
  assert.equal(planoPython('pytest','mimyr',{},'win32').command, 'python');
  assert.equal(planoPython('pytest','mimyr',{},'darwin').command, 'python3');
});
test('cobertura mantém piso 90 e argumentos inválidos são recusados', () => {
  const p = planoPython('cobertura', 'hestia', {});
  assert.deepEqual(p.args, ['-m','pytest','-p','no:cacheprovider','-p','pytest_cov','-q','--cov=plugins/hestia/scripts','--cov-report=term-missing','--cov-fail-under=90','plugins/hestia/tests']);
  assert.throws(() => planoPython('cobertura','hermes',{}));
  assert.throws(() => planoPython('pytest','../outro',{}));
});
test('premutation exige arquivo alvo, recusando ausência e diretório', () => {
  const root = mkdtempSync(join(tmpdir(), 'hefesto-premutation-'));
  try {
    assert.throws(() => verificarAlvo(root), /alvo/);
    const target = join(root, 'plugins/hefesto/skills/validar-plugin/scripts/validar.mjs');
    mkdirSync(target, { recursive: true });
    assert.throws(() => verificarAlvo(root), /alvo/);
    rmSync(target, { recursive: true });
    writeFileSync(target, 'conteúdo');
    assert.doesNotThrow(() => verificarAlvo(root));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
