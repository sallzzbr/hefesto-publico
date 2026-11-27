import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computador } from '../scripts/computador.mjs';
import { medirEspaco } from '../scripts/espaco.mjs';

function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'higeia-pessoal-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function runQuarantine(root, body) {
  const script = fileURLToPath(new URL('../scripts/instaladores.py', import.meta.url));
  execFileSync('python3', ['-I', '-B', '-c', `
import inspect, os, runpy, sys
from pathlib import Path
from unittest.mock import patch
from subprocess import CompletedProcess
from contextlib import nullcontext
execute = runpy.run_path(sys.argv[1])['executar']
root = Path(sys.argv[2])

def action(folder, verb, *args, scope='downloads', **kwargs):
    if 'scope' in inspect.signature(execute).parameters:
        kwargs['scope'] = scope
    return execute(folder, verb, *args, **kwargs)

def expected_error(kind, operation, *args, **kwargs):
    try:
        operation(*args, **kwargs)
    except kind:
        return
    raise AssertionError(f'A operação deveria ter falhado com {kind.__name__}')

def fake_activity(code, stdout=b'', stderr=b''):
    return patch('subprocess.run', return_value=CompletedProcess([], code, stdout, stderr))

idle = nullcontext() if sys.platform == 'darwin' else fake_activity(1)
${body}
`, script, root]);
}

test('revisão pessoal mostra ocupação e ação por item e separa reservas e transferências', t => {
  const home = fixture(t);
  function put(name) {
    const path = join(home, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.alloc(8192, 32));
    return path;
  }

  const archive = put('Downloads/Arquivo.zip');
  const other = put('Downloads/Outro.txt');
  const partial = put('Downloads/Parcial.filepart');
  const folderItem = put('Downloads/Pasta/Conteúdo.txt');
  const large = put('Desktop/Arquivo grande.bin');
  truncateSync(large, 500_000_000);
  const trash = put('.Trash/Na lixeira.txt');
  const report = put('Library/Logs/DiagnosticReports/antigo.ips');
  const reserved = put('Desktop/.higeia-quarentena/Guardado.bin');
  const legacy = put('Downloads/.higeia-instaladores/Legado.pkg');

  const { candidatos } = computador({ home, agora: Date.now() + 40 * 86_400_000 });
  const { itens, porVolume } = medirEspaco([home], candidatos);
  const byPath = new Map(itens.map(item => [item.caminho, item]));
  assert.deepEqual(
    [archive, other, partial, dirname(folderItem), large, trash, report, reserved, legacy]
      .map(path => byPath.get(path)?.acao),
    ['quarentena', 'quarentena', 'preservar', 'revisar', 'quarentena', 'revisar', 'revisar', 'restaurar', 'restaurar'],
  );
  assert.equal(byPath.get(partial).categoria, 'Downloads incompletos');
  assert.ok(byPath.get(archive).bytes > 0);
  assert.ok(byPath.get(reserved).bytes > 0);
  const reserve = porVolume[0].porCategoria['Quarentena de arquivos pessoais'];
  assert.equal(reserve.preservarBytes, byPath.get(reserved).bytes);
  assert.equal(reserve.totalComRevisaoBytes, 0);
});

test('quarentena guarda e restaura arquivos regulares com conteúdo intacto e colisões preservadas', t => {
  runQuarantine(fixture(t), `
a = root / 'Um arquivo.zip'
b = root / 'Outro arquivo.zip'
contents = b'conteudo original' * 4096
a.write_bytes(contents)
b.write_bytes(b'vizinho')
reserve = root / '.higeia-quarentena'
with idle:
    try:
        preview = action(root, 'prever', a.name)
    except ValueError as error:
        raise AssertionError('A prévia precisa aceitar compactados em Downloads') from error
    assert preview['tamanhoBytes'] == len(contents)
    assert not reserve.exists()
    result = action(root, 'guardar', a.name, preview['plano'])
    assert result['bytesLiberados'] == 0
    assert not a.exists() and (reserve / a.name).read_bytes() == contents
    assert action(root, 'listar') == [a.name]

    a.write_bytes(b'arquivo novo')
    replacement = action(root, 'prever', a.name)
    expected_error(FileExistsError, action, root, 'guardar', a.name, replacement['plano'])
    expected_error(FileExistsError, action, root, 'restaurar', a.name)
    assert (reserve / a.name).read_bytes() == contents

    alternative = 'Outra cópia.zip'
    action(root, 'restaurar', a.name, novo_nome=alternative)
    assert (root / alternative).read_bytes() == contents
    assert a.read_bytes() == b'arquivo novo' and b.read_bytes() == b'vizinho'
    assert action(root, 'listar') == []

    for scope in ('mesa', 'documentos', 'filmes'):
        folder = root / scope
        folder.mkdir()
        large = folder / 'Grande'
        large.write_bytes(contents)
        with large.open('r+b') as stream:
            stream.truncate(500_000_000)
        preview = action(folder, 'prever', large.name, scope=scope)
        action(folder, 'guardar', large.name, preview['plano'], scope=scope)
        action(folder, 'restaurar', large.name, scope=scope)
        assert large.stat().st_size == 500_000_000
        with large.open('rb') as stream:
            assert stream.read(len(contents)) == contents
`);
});

test('quarentena recusa escrita, mudança desde a prévia, transferência parcial e caminhos fora da seleção', t => {
  runQuarantine(fixture(t), `
a = root / 'Arquivo.dmg'
a.write_bytes(b'original')
writing = nullcontext() if sys.platform == 'darwin' else fake_activity(0, b'p123\\x00\\nf3\\x00aw\\x00\\n')
with a.open('ab'), writing:
    expected_error(ValueError, action, root, 'prever', a.name)

with idle:
    preview = action(root, 'prever', a.name)
    with a.open('ab'), writing:
        expected_error(ValueError, action, root, 'guardar', a.name, preview['plano'])

    a.write_bytes(b'mudou')
    expected_error(ValueError, action, root, 'guardar', a.name, preview['plano'])
    assert a.read_bytes() == b'mudou'

    partial = root / 'Parcial.filepart'
    partial.write_bytes(b'parcial')
    link = root / 'Link.dmg'
    link.symlink_to(a)
    hard_link = root / 'Hard link.dmg'
    hard_link.hardlink_to(a) if sys.version_info >= (3, 10) else os.link(a, hard_link)
    folder = root / 'Pasta.dmg'
    folder.mkdir()
    for name in (partial.name, link.name, hard_link.name, folder.name, '../Arquivo.dmg', '.oculto.dmg'):
        expected_error(ValueError, action, root, 'prever', name)
    expected_error(ValueError, action, root, 'prever', a.name, scope='lixeira')
    expected_error(ValueError, action, root, 'prever', a.name, scope='documentos')
    redirected = root / 'Redirecionada'
    redirected.symlink_to(root, target_is_directory=True)
    expected_error(ValueError, action, redirected, 'prever', a.name)

    reserve = root / '.higeia-quarentena'
    reserve.symlink_to(folder, target_is_directory=True)
    ready = root / 'Disponível.dmg'
    ready.write_bytes(b'fica na origem')
    plan = action(root, 'prever', ready.name)['plano']
    expected_error(OSError, action, root, 'guardar', ready.name, plan)
    assert ready.read_bytes() == b'fica na origem'
    assert not list(folder.iterdir())

with fake_activity(1, stderr=b'permissao negada'):
    expected_error(ValueError, action, root, 'prever', 'Disponível.dmg')
`);
});

test('Downloads separa também o nome final associado ao parcial ou controle', t => {
  const home = fixture(t);
  const downloads = join(home, 'Downloads');
  mkdirSync(downloads);
  const pairs = [
    ['Grande.iso', 'Grande.iso.PART'],
    ['Com controle.zip', 'Com controle.zip.aria2'],
    ['Instalador.pkg', 'Instalador.pkg.download'],
  ];
  for (const [name, sidecar] of pairs) {
    writeFileSync(join(downloads, name), '');
    writeFileSync(join(downloads, sidecar), 'transferindo');
  }
  writeFileSync(join(downloads, 'Completo.iso'), '');
  const { candidatos } = computador({ home });
  const byName = new Map(candidatos.map(item => [item.caminho, item]));
  for (const name of pairs.flat()) {
    const item = byName.get(join(downloads, name));
    assert.equal(item.categoria, 'Downloads incompletos', name);
    assert.equal(item.acao, 'preservar', name);
  }
  assert.equal(byName.get(join(downloads, 'Completo.iso')).acao, 'quarentena');

  runQuarantine(downloads, `
with idle:
    for name in ('Grande.iso', 'Com controle.zip', 'Instalador.pkg'):
        expected_error(ValueError, action, root, 'prever', name)
        assert (root / name).is_file()
    expected_error(ValueError, execute, root, 'prever', 'Instalador.pkg')

    regular = root / 'Completo.iso'
    plan = action(root, 'prever', regular.name)['plano']
    (root / (regular.name + '.part')).write_bytes(b'parcial surgiu depois da previa')
    expected_error(ValueError, action, root, 'guardar', regular.name, plan)
    assert regular.is_file() and not (root / '.higeia-quarentena').exists()

    (root / (regular.name + '.part')).unlink()
    plan = action(root, 'prever', regular.name)['plano']
    action(root, 'guardar', regular.name, plan)
    action(root, 'restaurar', regular.name)
    assert regular.is_file()
`);
});

test('falhas de origem e de reserva oferecem instrução de recuperação', t => {
  runQuarantine(fixture(t), `
a = root / 'Fotos.zip'
a.write_bytes(b'original')
other = root / 'Pasta errada'
other.mkdir()

def message(operation, *arguments):
    try:
        operation(*arguments)
    except (OSError, ValueError) as error:
        return str(error)
    raise AssertionError('A operação deveria falhar')

with idle:
    plan = action(root, 'prever', a.name)['plano']
    assert 'Repita a prévia na pasta correta' in message(action, other, 'guardar', a.name, plan)
    assert 'Use listar' in message(action, root, 'restaurar', a.name)

    target = root / 'Pasta desconhecida'
    target.mkdir()
    reserve = root / '.higeia-quarentena'
    reserve.symlink_to(target, target_is_directory=True)
    assert 'diretório real' in message(action, root, 'guardar', a.name, plan)
    assert a.read_bytes() == b'original' and not list(target.iterdir())
`);
});

test('quarentena protege um arquivo em escrita na reserva e orienta após verificação inconclusiva', t => {
  runQuarantine(fixture(t), `
a = root / 'Fotos.zip'
contents = b'original'
a.write_bytes(contents)
reserve = root / '.higeia-quarentena'
held = reserve / a.name
writing = nullcontext() if sys.platform == 'darwin' else fake_activity(0, b'p123\\x00\\nf3\\x00aw\\x00\\n')
with idle:
    plan = action(root, 'prever', a.name)['plano']
    action(root, 'guardar', a.name, plan)
    with held.open('ab'), writing:
        expected_error(ValueError, action, root, 'restaurar', a.name)
    assert held.read_bytes() == contents and not a.exists()

    # Simula uma mudança externa após o rename real, sem descartar o arquivo.
    renamed = root / 'Retirado depois da troca.zip'
    global_state = execute.__globals__
    move = global_state['mover']
    def move_then_relocate(source, destination, name, new_name):
        move(source, destination, name, new_name)
        a.rename(renamed)
    with patch.dict(global_state, {'mover': move_then_relocate}):
        try:
            action(root, 'restaurar', a.name)
        except (OSError, ValueError) as error:
            assert 'Confira' in str(error) and a.name in str(error), str(error)
        else:
            raise AssertionError('Relatou sucesso sem conferir o arquivo no destino')
    assert renamed.read_bytes() == contents and not a.exists() and not held.exists()
`);
});

test('CLI pessoal interpreta o escopo antes do subcomando e resolve a pasta da conta', t => {
  runQuarantine(fixture(t), `
import contextlib, io, json
folder = root / 'Documents'
folder.mkdir()
selected = folder / 'Fotos.zip'
selected.write_bytes(b'original')
with selected.open('r+b') as stream:
    stream.truncate(500_000_000)

with idle, patch.object(sys, 'platform', 'darwin'), patch.object(Path, 'home', return_value=root):
    arguments = [sys.argv[1], '--pasta', 'documentos', 'prever', '--', selected.name]
    with patch.object(sys, 'argv', arguments), contextlib.redirect_stdout(io.StringIO()) as stdout:
        runpy.run_path(arguments[0], run_name='__main__')
    preview = json.loads(stdout.getvalue())
assert preview['nome'] == selected.name and preview['tamanhoBytes'] == 500_000_000
assert not (folder / '.higeia-quarentena').exists()
`);
});
