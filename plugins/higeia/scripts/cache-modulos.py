"""Prévia e limpeza seletiva de módulos implícitos do Clang no macOS."""
import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

PASTA = re.compile(r"[0-9A-Z]+")
MODULO = re.compile(r"[A-Za-z_][A-Za-z0-9_]*-[0-9A-Z]+\.pcm")
COMPILADORES = re.compile(r"Xcode|xcodebuild|clang(?:\+\+|-[0-9]+)?|swift(?:c|-frontend|-build|-driver)?|XCBBuildService")


@contextmanager
def pasta(path):
    if path.resolve(strict=True) != path:
        raise ValueError("Caminho redirecionado: " + str(path))
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        if os.fstat(fd).st_uid != os.getuid():
            raise ValueError("Pasta de outro usuário.")
        yield fd
    finally:
        os.close(fd)


def identidade(s):
    return (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_blocks)


def atributos(fd, nome):
    return os.stat(nome, dir_fd=fd, follow_symlinks=False)


def inventario(root):
    itens = {}
    with pasta(root) as raiz:
        dispositivo = os.fstat(raiz).st_dev
        for grupo in sorted(os.listdir(raiz)):
            if not PASTA.fullmatch(grupo) or not stat.S_ISDIR(atributos(raiz, grupo).st_mode):
                continue
            with pasta(root / grupo) as fd:
                for nome in sorted(os.listdir(fd)):
                    if not MODULO.fullmatch(nome):
                        continue
                    s = atributos(fd, nome)
                    if not stat.S_ISREG(s.st_mode) or s.st_nlink != 1 or s.st_uid != os.getuid() or s.st_dev != dispositivo:
                        continue
                    arquivo = os.open(nome, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
                    try:
                        if identidade(os.fstat(arquivo)) != identidade(s):
                            raise ValueError("Arquivo mudou durante a inspeção.")
                        if os.read(arquivo, 4) == b"CPCH":
                            itens.setdefault(grupo, {})[nome] = identidade(s)
                    finally:
                        os.close(arquivo)
        chave = [str(root), dispositivo, os.fstat(raiz).st_ino, itens]
    return itens, hashlib.sha256(json.dumps(chave, sort_keys=True).encode()).hexdigest()


def blocos_do_cache(root):
    saida = subprocess.check_output(['/usr/bin/du', '-sk', str(root)], text=True, timeout=90)
    return int(saida.split()[0]) * 1024


def volume(root):
    s = os.statvfs(root)
    return s.f_blocks * s.f_frsize, s.f_bavail * s.f_frsize


def previa(root, itens, chave):
    capacidade, livre = volume(root)
    tamanho = sum(v[-1] * 512 for grupo in itens.values() for v in grupo.values())
    return dict(plano=chave, caminho=str(root), arquivos=sum(map(len, itens.values())),
                capacidadeBytes=capacidade, livreBytes=livre, potencialBytes=tamanho,
                potencialGB=tamanho / 1e9, percentualDaCapacidade=100 * tamanho / capacidade)


def conferir_uso(root):
    ps = subprocess.run(['/bin/ps', '-axo', 'comm='], check=True, capture_output=True, text=True, timeout=10)
    if any(COMPILADORES.fullmatch(Path(l.strip()).name) for l in ps.stdout.splitlines()):
        raise ValueError("Xcode ou compilador ativo. Aguarde a conclusão.")
    uso = subprocess.run(['/usr/sbin/lsof', '-nP', '-t', '+D', str(root)], capture_output=True, timeout=45)
    if uso.returncode != 1 or uso.stdout.strip() or uso.stderr.strip():
        raise ValueError("Cache em uso ou inspeção de arquivos abertos inconclusiva.")


def compilar(root):
    args = ['/usr/bin/xcrun', '--sdk', 'macosx', 'clang', '-fsyntax-only', '-x', 'objective-c',
            '-fmodules', '-fimplicit-module-maps', '-fmodules-prune-interval=0',
            '-Xclang', '-fmodule-format=raw', '-fmodules-cache-path=' + str(root), '-Rmodule-build', '-']
    proc = subprocess.run(args, input='@import Foundation; NSInteger higeia(void) { return NSNotFound; }\n',
                          capture_output=True, text=True, timeout=120)
    if proc.returncode:
        raise ValueError("Falha ao compilar com Foundation: " + proc.stderr[-500:])
    return "building module 'Foundation'" in proc.stderr


def devolver(root, reserva):
    # Um compilador pode já ter recriado o nome. Nunca sobrescreva o novo arquivo.
    for grupo in sorted(reserva.iterdir()):
        with pasta(grupo) as salvo, pasta(root / grupo.name) as destino:
            for nome in os.listdir(salvo):
                try:
                    os.link(nome, nome, src_dir_fd=salvo, dst_dir_fd=destino, follow_symlinks=False)
                except FileExistsError:
                    continue
                os.unlink(nome, dir_fd=salvo)
            vazio = not os.listdir(salvo)
        if vazio:
            grupo.rmdir()
    reserva.rmdir()


def aplicar(root, chave, checar=conferir_uso, testar=compilar):
    reserva = root.parent / '.higeia-modulos-em-revisao'
    checar(root)
    itens, atual = inventario(root)
    if chave != atual or not itens:
        raise ValueError("Plano vazio ou alterado. Gere outra prévia.")
    cache_antes = blocos_do_cache(root)
    resumo = previa(root, itens, chave)
    reserva.mkdir(mode=0o700)  # trava entre execuções e destino recuperável no mesmo volume
    try:
        for grupo, arquivos in itens.items():
            destino = reserva / grupo
            destino.mkdir(mode=0o700)
            with pasta(root / grupo) as origem, pasta(destino) as salvo:
                for nome, esperado in arquivos.items():
                    if identidade(atributos(origem, nome)) != esperado:
                        raise ValueError("O arquivo mudou antes do isolamento.")
                    os.rename(nome, nome, src_dir_fd=origem, dst_dir_fd=salvo)
                    if identidade(atributos(salvo, nome)) != esperado:
                        raise ValueError("O arquivo capturado diverge do plano.")
        if not testar(root):
            raise ValueError("A compilação não comprovou a reconstrução de Foundation.")
        checar(root)
        checar(reserva)
        for grupo, arquivos in itens.items():
            with pasta(reserva / grupo) as salvo:
                if set(os.listdir(salvo)) != set(arquivos) or any(
                        identidade(atributos(salvo, nome)) != esperado for nome, esperado in arquivos.items()):
                    raise ValueError("O conjunto isolado mudou.")
    except BaseException:
        try:
            devolver(root, reserva)
        except OSError as erro:
            raise RuntimeError("Recuperação parcial. Originais restantes em " + str(reserva)) from erro
        raise
    for grupo, arquivos in itens.items():
        with pasta(reserva / grupo) as salvo:
            for nome, esperado in arquivos.items():
                if identidade(atributos(salvo, nome)) != esperado:
                    raise ValueError("Expurgo interrompido. Confira " + str(reserva))
                os.unlink(nome, dir_fd=salvo)
        (reserva / grupo).rmdir()
    reserva.rmdir()
    try:
        testar(root)  # uso da ferramenta depois do expurgo
        verificacao = "Foundation reconstruído e compilação repetida após o expurgo"
        sucesso = True
    except (ValueError, OSError, subprocess.SubprocessError) as exc:
        verificacao = "Cache expurgado; a compilação final falhou: " + str(exc)
        sucesso = False
    capacidade, depois = volume(root)
    cache_depois = blocos_do_cache(root)
    ganho = depois - resumo['livreBytes']
    return dict(**resumo, cacheAntesBytes=cache_antes, cacheDepoisBytes=cache_depois,
                reducaoCacheBytes=cache_antes - cache_depois, livreDepoisBytes=depois, variacaoLivreBytes=ganho,
                variacaoLivreGB=ganho / 1e9, percentualLiberado=100 * ganho / capacidade,
                compilacaoFinalOk=sucesso, verificacao=verificacao)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='operacao', required=True)
    sub.add_parser('prever')
    sub.add_parser('aplicar').add_argument('plano')
    args = parser.parse_args()
    if sys.platform != 'darwin':
        raise ValueError("A operação requer macOS e o compilador do Xcode.")
    root = Path.home() / 'Library/Developer/Xcode/DerivedData/ModuleCache.noindex'
    if os.path.lexists(root.parent / '.higeia-modulos-em-revisao'):
        raise ValueError("Isolamento anterior presente em " + str(root.parent / '.higeia-modulos-em-revisao'))
    if args.operacao == 'prever':
        return previa(root, *inventario(root))
    return aplicar(root, args.plano)


if __name__ == '__main__':
    try:
        resultado = main()
        print(json.dumps(resultado, ensure_ascii=False))
        if resultado.get("compilacaoFinalOk") is False:
            sys.exit(1)
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError) as exc:
        print(json.dumps(dict(erro=str(exc)), ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
