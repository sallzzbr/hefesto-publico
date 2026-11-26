"""Prévia e limpeza de caches locais de três aplicativos macOS, sem dependências externas."""
import argparse
from contextlib import contextmanager
import errno
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pwd
import stat
import subprocess
import sys
import time

APPS = {
    'chrome': ('Google Chrome', 'com.google.Chrome', ['Caches/Google/Chrome/Default', 'Application Support/Google/Chrome/Default']),
    'claude': ('Claude', 'com.anthropic.claudefordesktop', ['Application Support/Claude']),
    'slack': ('Slack', 'com.tinyspeck.slackmacgap', ['Application Support/Slack']),
}
CACHES = ('Cache/Cache_Data', 'Code Cache/js', 'Code Cache/wasm', 'GPUCache')
DIR = os.O_DIRECTORY | os.O_NOFOLLOW | os.O_RDONLY


def checar(st, dev):
    if st.st_uid != os.getuid() or st.st_dev != dev:
        raise ValueError('Proprietário ou volume inesperado.')


@contextmanager
def pasta(raiz, caminho):
    fd = os.open(raiz, DIR)
    try:
        dev = os.fstat(fd).st_dev
        checar(os.fstat(fd), dev)
        for parte in caminho.parts:
            novo = os.open(parte, DIR, dir_fd=fd)
            os.close(fd)
            fd = novo
            checar(os.fstat(fd), dev)
        yield fd
    finally:
        os.close(fd)


def arvore(fd, apagar=False):
    """O descritor ancora a travessia à árvore que foi aberta, sem seguir links."""
    dev = os.fstat(fd).st_dev
    total = 0
    for nome in os.listdir(fd):
        s = os.stat(nome, dir_fd=fd, follow_symlinks=False)
        checar(s, dev)
        if stat.S_ISDIR(s.st_mode):
            sub = os.open(nome, DIR, dir_fd=fd)
            try:
                if not os.path.samestat(s, os.fstat(sub)):
                    raise ValueError('Diretório substituído durante a medição.')
                total += arvore(sub, apagar)
            finally:
                os.close(sub)
            if apagar:
                os.rmdir(nome, dir_fd=fd)
        elif stat.S_ISREG(s.st_mode) and s.st_nlink == 1:
            if apagar:
                os.unlink(nome, dir_fd=fd)
        else:
            raise ValueError('Link ou arquivo especial no cache.')
        total += s.st_blocks * 512
    return total


def reserva(path):
    return path.with_name('.higeia-' + path.name + '.em-revisao')


def inventario(raiz, app):
    medidas, identidades = {}, {}
    for perfil in APPS[app][2]:
        for cache in CACHES:
            path = Path(perfil) / cache
            try:
                with pasta(raiz, path.parent) as pai:
                    try:
                        os.stat(reserva(path).name, dir_fd=pai, follow_symlinks=False)
                    except FileNotFoundError:
                        pass
                    else:
                        raise ValueError('Reserva anterior exige reconciliação: ' + str(raiz / reserva(path)))
                    with pasta(raiz, path) as fd:
                        st = os.fstat(fd)
                        identidades[str(path)] = [st.st_dev, st.st_ino]
                        medidas[str(path)] = arvore(fd)
            except FileNotFoundError:
                # Uma raiz pode estar ausente, mas medição interrompida é inconclusiva.
                if str(path) in identidades:
                    raise ValueError('Cache mudou durante a leitura. Repita a prévia.')
    return identidades, medidas


def volume(raiz):
    s = os.statvfs(raiz)
    return s.f_blocks * s.f_frsize, s.f_bavail * s.f_frsize


def previa(raiz, apps):
    capacidade, livre = volume(raiz)
    ids, medidas, por_app = {}, {}, {}
    for app in apps:
        try:
            ids[app], medidas[app] = inventario(raiz, app)
        except PermissionError as erro:
            por_app[app] = dict(estado='não medido', erro=errno.errorcode[erro.errno],
                                bytes=None, gb=None, percentual=None)
            continue
        tamanho = sum(medidas[app].values())
        por_app[app] = dict(estado='medido' if medidas[app] else 'sem pastas de cache',
                            bytes=tamanho, gb=tamanho / 1e9, percentual=100 * tamanho / capacidade)
    chave = None
    rotulo = 'SUBTOTAL MEDIDO' if medidas else 'NENHUM APP MEDIDO'
    if len(medidas) == len(apps):
        identidade = [str(raiz), os.getuid(), ids]
        chave = hashlib.sha256(json.dumps(identidade, sort_keys=True).encode()).hexdigest()
        rotulo = 'TOTAL'
    total = sum(sum(itens.values()) for itens in medidas.values()) if medidas else None
    return dict(plano=chave, apps=medidas, porApp=por_app, rotulo=rotulo,
                capacidadeBytes=capacidade, livreAntesBytes=livre, potencialBytes=total,
                potencialGB=total / 1e9 if total is not None else None,
                percentual=100 * total / capacidade if total is not None else None), ids


# AppKit verifica a identidade e o estado do aplicativo sem ler títulos ou mensagens.
JXA = """
ObjC.import('AppKit')
function run([id,path,acao]) {
  const bundle=$.NSBundle.bundleWithPath(path)
  if (!bundle || ObjC.unwrap(bundle.bundleIdentifier)!==id) throw Error('Aplicativo indisponível: '+path)
  const apps=$.NSRunningApplication.runningApplicationsWithBundleIdentifier(id)
  if (apps.count>1) throw Error('Múltiplas instâncias: '+id)
  if (!apps.count) return JSON.stringify({ativo:false})
  const a=apps.firstObject
  if (ObjC.unwrap(a.bundleURL.path)!==path) throw Error('Instância em outra instalação: '+id)
  if (acao==='sair' && !a.terminate) throw Error('Encerramento recusado: '+id)
  return JSON.stringify({ativo:true, pronto:!!a.isFinishedLaunching, pid:a.processIdentifier})
}
"""


class Aplicativo:
    def __init__(self, app):
        nome, self.id, _ = APPS[app]
        self.bundle = '/Applications/' + nome + '.app'

    def estado(self, acao='consultar'):
        saida = subprocess.check_output(['/usr/bin/osascript', '-l', 'JavaScript', '-e', JXA,
                                         self.id, self.bundle, acao], text=True, timeout=10)
        return json.loads(saida)

    def parado(self):
        processos = subprocess.check_output(['/bin/ps', '-axo', 'comm='], text=True, timeout=10)
        return not self.estado()['ativo'] and not any(
            p.strip().startswith(self.bundle + '/Contents/') for p in processos.splitlines())

    def fechar(self):
        self.estado('sair')
        aguardar(self.parado, 'O aplicativo ou um auxiliar continua em uso.')

    def abrir(self):
        subprocess.run(['/usr/bin/open', '-g', '-a', self.bundle], check=True, timeout=12)

    def pronto(self):
        estado = self.estado()
        if not estado.get('pronto'):
            return False
        saida = subprocess.check_output(['/bin/ps', '-Aww', '-o', 'pid=,ppid=,command='], text=True,
                                        errors='replace', timeout=10)
        pais, renderizadores = {}, []
        for linha in saida.splitlines():
            campos = linha.strip().split(None, 2)
            if len(campos) == 3:
                pid, pai, cmd = campos
                pais[int(pid)] = int(pai)
                if '--type=renderer' in cmd.split():
                    renderizadores.append(int(pid))
        for pid in renderizadores:
            while pid > 1 and pid in pais:
                if pid == estado['pid']:
                    return True
                pid = pais[pid]
        return False


def aguardar(condicao, erro):
    fim = time.monotonic() + 30
    while not condicao():
        if time.monotonic() >= fim:
            raise ValueError(erro)
        time.sleep(0.5)


def limpar_app(raiz, app, ids, controle):
    inicial = controle.estado()['ativo']
    isolados = []
    try:
        controle.fechar()
        atuais, antes = inventario(raiz, app)
        if atuais != ids:
            raise ValueError('Raízes mudaram. Repita a prévia.')
        for nome, identidade in atuais.items():
            path = Path(nome)
            with pasta(raiz, path.parent) as pai:
                if not controle.parado():
                    raise ValueError('Aplicativo reaberto durante o isolamento.')
                st = os.stat(path.name, dir_fd=pai, follow_symlinks=False)
                if [st.st_dev, st.st_ino] != identidade:
                    raise ValueError('Raiz substituída.')
                os.rename(path.name, reserva(path).name, src_dir_fd=pai, dst_dir_fd=pai)
                isolados.append((path, identidade))
        controle.abrir()
        aguardar(controle.pronto, 'Reabertura sem confirmação de renderização.')
        for path, identidade in isolados:
            salvo = reserva(path)
            with pasta(raiz, salvo.parent) as pai, pasta(raiz, salvo) as fd:
                st = os.fstat(fd)
                if [st.st_dev, st.st_ino] != identidade:
                    raise ValueError('Reserva substituída.')
                arvore(fd, apagar=True)
                os.rmdir(salvo.name, dir_fd=pai)
        return sum(antes.values())
    finally:
        # Em falha, restaure nomes livres. Preserve qualquer cache novo e a reserva
        # correspondente lado a lado para reconciliação. Nunca sobrescreva dados.
        pendentes = []
        try:
            for path, identidade in isolados:
                with pasta(raiz, path.parent) as pai:
                    try:
                        st = os.stat(reserva(path).name, dir_fd=pai, follow_symlinks=False)
                    except FileNotFoundError:
                        continue
                    if [st.st_dev, st.st_ino] == identidade and path.name not in os.listdir(pai):
                        os.rename(reserva(path).name, path.name, src_dir_fd=pai, dst_dir_fd=pai)
                    else:
                        pendentes.append(str(raiz / reserva(path)))
            if pendentes:
                raise ValueError('Recuperação parcial. Confira as reservas: ' + ', '.join(pendentes))
        finally:
            if inicial and not controle.estado()['ativo']:
                controle.abrir()


def aplicar(raiz, apps, chave, fabrica=Aplicativo):
    with pasta(raiz, Path('.')) as trava:
        fcntl.flock(trava, fcntl.LOCK_EX | fcntl.LOCK_NB)
        plano, ids = previa(raiz, apps)
        if plano['plano'] is None:
            raise ValueError('Prévia incompleta. Para limpar apenas os apps medidos, gere uma prévia dessa seleção.')
        if plano['plano'] != chave:
            raise ValueError('O plano diverge. Gere outra prévia.')
        resultados = {}
        controles = {}
        for app in apps:
            if not ids[app]:
                resultados[app] = {'estado': 'sem caches selecionados'}
                continue
            try:
                controles[app] = fabrica(app)
                antes = limpar_app(raiz, app, ids[app], controles[app])
                resultados[app] = {'estado': 'reaberto', 'antesBytes': antes}
            except (ValueError, OSError, subprocess.SubprocessError) as erro:
                resultados[app] = {'estado': 'inconclusivo', 'erro': str(erro)}
                break
        liquido = 0
        for app in apps:
            item = resultados.setdefault(app, {'estado': 'não processado'})
            if item['estado'] == 'reaberto':
                try:
                    if not controles[app].pronto():
                        raise ValueError('Aplicativo encerrou após a reabertura.')
                    _, medidas = inventario(raiz, app)
                    depois = sum(medidas.values())
                    ganho = item['antesBytes'] - depois
                    item.update(estado='verificado', depoisBytes=depois, reducaoBytes=ganho,
                                reducaoGB=ganho / 1e9, percentual=100 * ganho / plano['capacidadeBytes'])
                    liquido += ganho
                except (ValueError, OSError, subprocess.SubprocessError) as erro:
                    item.update(estado='inconclusivo', erro=str(erro))
        capacidade, livre = volume(raiz)
        delta = livre - plano['livreAntesBytes']
        return dict(apps=resultados, completo=all(r['estado'] in ('verificado','sem caches selecionados')
                    for r in resultados.values()), reducaoVerificadaBytes=liquido, reducaoGB=liquido / 1e9,
                    percentualReducao=100 * liquido / capacidade, capacidadeBytes=capacidade,
                    livreAntesBytes=plano['livreAntesBytes'], livreDepoisBytes=livre,
                    variacaoLivreGB=delta / 1e9, percentualVariacaoLivre=100 * delta / capacidade)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    comandos = parser.add_subparsers(dest='operacao', required=True)
    prever = comandos.add_parser('prever')
    executar = comandos.add_parser('aplicar')
    executar.add_argument('plano')
    for p in (prever, executar):
        p.add_argument('apps', nargs='+', choices=sorted(APPS))
    args = parser.parse_args()
    if sys.platform != 'darwin' or os.getuid() == 0:
        raise ValueError('Execute na conta do usuário do macOS.')
    raiz = Path(pwd.getpwuid(os.getuid()).pw_dir).resolve(strict=True) / 'Library'
    apps = sorted(set(args.apps))
    if args.operacao == 'prever':
        return previa(raiz, apps)[0]
    return aplicar(raiz, apps, args.plano)


if __name__ == '__main__':
    try:
        resultado = main()
        print(json.dumps(resultado, ensure_ascii=False))
        sys.exit(0 if resultado.get('completo', True) else 1)
    except (ValueError, OSError, subprocess.SubprocessError) as exc:
        sys.exit(str(exc))
