"""Quarentena de instaladores e arquivos pessoais no macOS."""
import argparse
from contextlib import ExitStack
import ctypes
import errno
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import unicodedata

RESERVA = '.higeia-instaladores'
PERSONAL_RESERVE = '.higeia-quarentena'
PERSONAL_FOLDERS = {'downloads': 'Downloads', 'mesa': 'Desktop', 'documentos': 'Documents', 'filmes': 'Movies'}
LARGE_FILE_BYTES = 500_000_000
PARTIAL_SUFFIXES = ('.crdownload', '.download', '.part', '.partial', '.filepart', '.opdownload', '.aria2')
DIRETORIO = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW


def elegivel(nome):
    return (nome == os.path.basename(nome) and not nome.startswith('.')
            and Path(nome).suffix.lower() in ('.dmg', '.pkg', '.mpkg'))


def personal_name(name):
    return (bool(name) and name == os.path.basename(name) and not name.startswith('.')
            and not name.lower().endswith(PARTIAL_SUFFIXES))


def check_partial_transfer(folder_fd, name):
    normalized = unicodedata.normalize('NFC', name).lower()
    related_names = {normalized + suffix for suffix in PARTIAL_SUFFIXES}
    for entry in os.listdir(folder_fd):
        if unicodedata.normalize('NFC', entry).lower() in related_names:
            raise ValueError('Há um download parcial ou arquivo de controle associado. Aguarde a transferência.')


def check_writers(path):
    # Consulta pontual dos processos visíveis à conta, sem encerrar aplicativos.
    try:
        result = subprocess.run(
            ['/usr/sbin/lsof', '-nP', '-F0a', '--', path],
            capture_output=True, timeout=10, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ValueError('Atividade do arquivo não pôde ser verificada. Repita a prévia.') from error

    if result.returncode == 1 and not result.stdout and not result.stderr:
        return
    if result.returncode != 0 or result.stderr or not result.stdout:
        raise ValueError('Atividade do arquivo não pôde ser verificada. Repita a prévia.')

    fields = result.stdout.split(b'\x00')
    if any(field.startswith(b'a') and field != b'ar' for field in fields):
        raise ValueError('Arquivo aberto para escrita ou com acesso indeterminado. Tente quando estiver fechado.')


def mover(origem, destino, nome, nome_destino):
    # As duas APIs fazem a verificação de colisão e a troca numa única operação.
    libc = ctypes.CDLL(None, use_errno=True)
    if sys.platform == 'darwin':
        rename, exclusivo = libc.renameatx_np, 4
    elif sys.platform.startswith('linux'):
        rename, exclusivo = libc.renameat2, 1
    else:
        raise ValueError('Sistema sem movimentação exclusiva suportada.')
    nome_fs = os.fsencode(nome)
    if rename(origem, nome_fs, destino, os.fsencode(nome_destino), exclusivo):
        erro = ctypes.get_errno()
        raise OSError(erro, os.strerror(erro), nome)


def executar(downloads, acao, nome=None, plano=None, novo_nome=None, *, scope=None):
    personal = scope is not None
    if personal and scope not in PERSONAL_FOLDERS:
        raise ValueError('Pasta fora dos escopos de quarentena pessoal.')

    reserve_name = PERSONAL_RESERVE if personal else RESERVA
    folder_name = PERSONAL_FOLDERS[scope] if personal else 'Downloads'
    eligible = personal_name if personal else elegivel

    with ExitStack() as recursos:
        def abrir(path, pai=None):
            fd = os.open(path, DIRETORIO, dir_fd=pai)
            recursos.callback(os.close, fd)
            return fd

        try:
            raiz = abrir(downloads)
        except OSError as erro:
            if Path(downloads).is_symlink():
                raise ValueError(f'{folder_name} é um link simbólico. Escolha uma pasta real.') from erro
            raise
        if acao != 'listar' and not eligible(nome):
            message = ('Selecione um arquivo visível e completo no primeiro nível da pasta.'
                       if personal else 'Selecione um arquivo .dmg, .pkg ou .mpkg direto de Downloads.')
            raise ValueError(message)

        nome_destino = nome if novo_nome is None else novo_nome
        if novo_nome is not None and (acao != 'restaurar' or not eligible(novo_nome)
                                      or Path(novo_nome).suffix.lower() != Path(nome).suffix.lower()):
            raise ValueError('Escolha um nome de arquivo simples com a mesma extensão do original.')

        root_stat = os.fstat(raiz)

        def inspect_item(parent, recovery):
            try:
                return os.stat(nome, dir_fd=parent, follow_symlinks=False)
            except FileNotFoundError as erro:
                raise FileNotFoundError(f'Arquivo {nome!r} não encontrado. {recovery}') from erro

        def validate_source(parent, initial, activity_path=None):
            if activity_path is not None:
                # O lsof recebe um caminho, enquanto a movimentação usa descritores ancorados.
                parent_stat = os.fstat(parent)
                if not os.path.samestat(os.stat(activity_path.parent, follow_symlinks=False), parent_stat):
                    raise ValueError('Pasta alterada durante a operação. Confira o caminho novamente.')
                check_writers(activity_path)
                if not os.path.samestat(os.stat(activity_path, follow_symlinks=False), initial):
                    raise ValueError('Arquivo alterado durante a consulta de atividade. Repita a prévia.')

            current = os.stat(nome, dir_fd=parent, follow_symlinks=False)
            if not os.path.samestat(initial, current) or initial.st_ctime_ns != current.st_ctime_ns:
                raise ValueError('Arquivo alterado durante a operação. Confira o item novamente.')

        if acao in ('guardar', 'prever'):
            item = inspect_item(raiz, 'Repita a prévia na pasta correta.')
            if not stat.S_ISREG(item.st_mode):
                raise ValueError('Selecione um arquivo regular.')
            if personal and (item.st_dev != root_stat.st_dev or item.st_nlink != 1):
                raise ValueError('Selecione um arquivo do mesmo volume com um único vínculo no disco.')
            if personal and scope != 'downloads' and item.st_size < LARGE_FILE_BYTES:
                raise ValueError('Nesta pasta a quarentena aceita arquivos de pelo menos 500 MB.')

            identidade = [nome, item.st_dev, item.st_ino, item.st_ctime_ns, item.st_size]
            if personal:
                identidade.extend([scope, root_stat.st_ino, item.st_mtime_ns])
            token = hashlib.sha256(json.dumps(identidade).encode()).hexdigest()
            if acao == 'guardar' and plano != token:
                raise ValueError('O arquivo mudou ou o plano não corresponde. Repita a prévia.')

            activity_path = Path(downloads) / nome if personal else None
            validate_source(raiz, item, activity_path)
            if scope in (None, 'downloads'):
                check_partial_transfer(raiz, nome)
            if acao == 'prever':
                return dict(nome=nome, tamanhoBytes=item.st_size, plano=token)

            try:
                os.mkdir(reserve_name, 0o700, dir_fd=raiz)
            except FileExistsError:
                pass
        try:
            reserva = abrir(reserve_name, raiz)
        except FileNotFoundError as erro:
            if acao == 'listar':
                return []
            raise FileNotFoundError('Reserva ausente nessa pasta. Use listar para conferir o escopo.') from erro
        except OSError as erro:
            if erro.errno in (errno.ELOOP, errno.ENOTDIR):
                raise NotADirectoryError('A reserva precisa ser um diretório real. Confira a pasta antes de tentar novamente.') from erro
            raise

        dados = os.fstat(reserva)
        if dados.st_uid != os.getuid() or dados.st_mode & 0o077 or dados.st_dev != root_stat.st_dev:
            raise ValueError('Quarentena exige diretório privado do usuário no mesmo volume.')
        if acao == 'listar':
            return sorted(os.listdir(reserva))

        if acao == 'restaurar':
            item = inspect_item(reserva, 'Use listar para conferir a reserva.')
            if not stat.S_ISREG(item.st_mode):
                raise ValueError('A reserva não contém um arquivo regular com esse nome.')
            if personal and item.st_dev != root_stat.st_dev:
                raise ValueError('Arquivo em quarentena está em outro volume.')
            origem, destino = reserva, raiz
            activity_path = Path(downloads) / reserve_name / nome if personal else None
            validate_source(origem, item, activity_path)
        else:
            origem, destino = raiz, reserva
            validate_source(origem, item)

        if personal and not os.path.samestat(dados, os.stat(reserve_name, dir_fd=raiz, follow_symlinks=False)):
            raise ValueError('Quarentena alterada durante a operação. Confira o diretório novamente.')

        try:
            mover(origem, destino, nome, nome_destino)
        except FileExistsError as erro:
            if acao == 'restaurar':
                raise FileExistsError(f'Destino ocupado em {folder_name}. Escolha outro nome com --como.') from erro
            raise FileExistsError('Nome ocupado na quarentena. Use listar para conferir a reserva existente.') from erro

        local = 'quarentena' if acao == 'guardar' else f'pasta {folder_name}'
        try:
            movido = os.stat(nome_destino, dir_fd=destino, follow_symlinks=False)
        except OSError as erro:
            raise ValueError(f'Movimentação sem confirmação. Confira {nome_destino!r} na {local} '
                             'e verifique o conteúdo antes de tentar novamente.') from erro
        if not os.path.samestat(item, movido):
            raise ValueError(f'O arquivo mudou durante a movimentação. Confira {nome_destino!r} na {local} '
                             'e verifique o conteúdo antes de decidir onde guardá-lo.')
        return dict(nome=nome_destino, acao=acao, bytesLiberados=0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pasta', dest='scope', choices=PERSONAL_FOLDERS)
    comandos = parser.add_subparsers(dest='acao', required=True)
    comandos.add_parser('listar')
    for verbo in ('prever', 'guardar', 'restaurar'):
        comando = comandos.add_parser(verbo)
        comando.add_argument('nome')
        if verbo == 'restaurar':
            comando.add_argument('--como', dest='novo_nome')
        if verbo == 'guardar':
            comando.add_argument('plano')
    args = parser.parse_args()
    if sys.platform != 'darwin':
        parser.exit(1, 'Este comando requer macOS.\n')
    try:
        folder = Path.home().resolve() / PERSONAL_FOLDERS.get(args.scope, 'Downloads')
        print(json.dumps(executar(folder, **vars(args)), ensure_ascii=False))
    except (ValueError, OSError) as erro:
        parser.exit(1, f'{erro}\n')
