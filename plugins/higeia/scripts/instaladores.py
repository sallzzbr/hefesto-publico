"""Quarentena de instaladores no mesmo volume de Downloads."""
import argparse
from contextlib import ExitStack
import ctypes
import hashlib
import json
import os
from pathlib import Path
import stat
import sys

RESERVA = '.higeia-instaladores'
DIRETORIO = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW


def elegivel(nome):
    return (nome == os.path.basename(nome) and not nome.startswith('.')
            and Path(nome).suffix.lower() in ('.dmg', '.pkg', '.mpkg'))


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


def executar(downloads, acao, nome=None, plano=None, novo_nome=None):
    with ExitStack() as recursos:
        def abrir(path, pai=None):
            fd = os.open(path, DIRETORIO, dir_fd=pai)
            recursos.callback(os.close, fd)
            return fd

        try:
            raiz = abrir(downloads)
        except OSError as erro:
            if Path(downloads).is_symlink():
                raise ValueError('Downloads é um link simbólico. Use uma pasta Downloads real para a quarentena.') from erro
            raise
        if acao != 'listar' and not elegivel(nome):
            raise ValueError('Selecione um arquivo .dmg, .pkg ou .mpkg direto de Downloads.')
        nome_destino = nome if novo_nome is None else novo_nome
        if novo_nome is not None and (acao != 'restaurar' or not elegivel(novo_nome)
                                      or Path(novo_nome).suffix.lower() != Path(nome).suffix.lower()):
            raise ValueError('Escolha um nome de arquivo simples com a mesma extensão do instalador.')
        if acao in ('guardar', 'prever'):
            item = os.stat(nome, dir_fd=raiz, follow_symlinks=False)
            if not stat.S_ISREG(item.st_mode):
                raise ValueError('Selecione um arquivo regular.')
            identidade = [nome, item.st_dev, item.st_ino, item.st_ctime_ns, item.st_size]
            token = hashlib.sha256(json.dumps(identidade).encode()).hexdigest()
            if acao == 'prever':
                return dict(nome=nome, tamanhoBytes=item.st_size, plano=token)
            if plano != token:
                raise ValueError('O instalador mudou ou o plano não corresponde. Repita a prévia.')
            try:
                os.mkdir(RESERVA, 0o700, dir_fd=raiz)
            except FileExistsError:
                pass
        try:
            reserva = abrir(RESERVA, raiz)
        except FileNotFoundError:
            if acao == 'listar':
                return []
            raise
        dados = os.fstat(reserva)
        if dados.st_uid != os.getuid() or dados.st_mode & 0o077 or dados.st_dev != os.fstat(raiz).st_dev:
            raise ValueError('Quarentena exige diretório privado do usuário no mesmo volume.')
        if acao == 'listar':
            return sorted(os.listdir(reserva))
        if acao == 'restaurar':
            item = os.stat(nome, dir_fd=reserva, follow_symlinks=False)
            if not stat.S_ISREG(item.st_mode):
                raise ValueError('A reserva não contém um arquivo regular com esse nome.')
            origem, destino = reserva, raiz
        else:
            origem, destino = raiz, reserva
        atual = os.stat(nome, dir_fd=origem, follow_symlinks=False)
        if not os.path.samestat(item, atual) or item.st_ctime_ns != atual.st_ctime_ns:
            raise ValueError('Arquivo alterado durante a operação. Confira o item novamente.')
        try:
            mover(origem, destino, nome, nome_destino)
        except FileExistsError as erro:
            if acao == 'restaurar':
                raise FileExistsError('Destino ocupado em Downloads. Escolha outro nome com --como.') from erro
            raise FileExistsError('Nome ocupado na quarentena. Use listar para conferir a reserva existente.') from erro
        movido = os.stat(nome_destino, dir_fd=destino, follow_symlinks=False)
        if not os.path.samestat(item, movido):
            local = 'quarentena' if acao == 'guardar' else 'pasta Downloads'
            raise ValueError(f'O arquivo mudou durante a movimentação. Confira {nome_destino!r} na {local} '
                             'e verifique o conteúdo antes de decidir onde guardá-lo.')
        return dict(nome=nome_destino, acao=acao, bytesLiberados=0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
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
        print(json.dumps(executar(Path.home() / 'Downloads', **vars(args)), ensure_ascii=False))
    except (ValueError, OSError) as erro:
        parser.exit(1, f'{erro}\n')
