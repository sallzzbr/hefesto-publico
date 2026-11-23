"""Reservas de arquivos descartáveis por sessão. Somente a biblioteca padrão POSIX."""
import fcntl
import hashlib
import json
import os
import re
import secrets
import shlex
import stat
import sys
import tempfile
from contextlib import ExitStack
from pathlib import Path
from urllib.parse import unquote


NOME = re.compile(r"rascunho-[0-9a-f]{32}\.[A-Za-z0-9]{1,12}")
DIRETORIO = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW


def abrir_pasta(pilha, pai, nome, criar):
    if criar:
        try:
            os.mkdir(nome, 0o700, dir_fd=pai)
        except FileExistsError:
            pass
    fd = os.open(nome, DIRETORIO, dir_fd=pai)
    pilha.callback(os.close, fd)
    atributos = os.fstat(fd)
    if atributos.st_uid != os.getuid() or atributos.st_mode & 0o077:
        raise ValueError("A pasta de temporários precisa ser privada e pertencer ao usuário.")
    return fd


def atributos(fd, nome):
    try:
        return os.stat(nome, dir_fd=fd, follow_symlinks=False)
    except FileNotFoundError:
        return None


def mesmo_arquivo(a, b):
    return a and b and stat.S_ISREG(a.st_mode) and stat.S_ISREG(b.st_mode) and os.path.samestat(a, b)


def coletar(sessao, recibos, pasta, mensagem):
    # O segundo link mantém o inode vivo inclusive após uma substituição atômica.
    # A coleta captura o nome e reconfere a identidade antes de desvinculá-lo.
    resposta = unquote(mensagem)
    citados = []
    pasta_citada = re.search(re.escape(pasta.name) + r"(?:/)?(?=$|[\s)\]>`\"'#?])", resposta)
    for recibo in os.listdir(recibos):
        estado, _, nome = recibo.partition(".")
        if estado not in ("fim", "reter") or not NOME.fullmatch(nome):
            continue
        original = atributos(recibos, recibo)
        if not original or not stat.S_ISREG(original.st_mode):
            continue
        captura = "coleta." + nome
        capturado = atributos(recibos, captura)
        if capturado is None:
            atual = atributos(sessao, nome)
            if atual is None or not mesmo_arquivo(original, atual):
                os.unlink(recibo, dir_fd=recibos)
                continue
            if estado == "reter":
                continue
            if nome in resposta or pasta_citada:
                os.rename(recibo, "reter." + nome, src_dir_fd=recibos, dst_dir_fd=recibos)
                citados.append(nome)
                continue
            os.rename(nome, captura, src_dir_fd=sessao, dst_dir_fd=recibos)
            capturado = atributos(recibos, captura)
        if mesmo_arquivo(original, capturado):
            os.unlink(captura, dir_fd=recibos)
        elif capturado:
            # Um escritor externo trocou o arquivo durante a captura. Nunca sobrescreva
            # um terceiro arquivo que tenha surgido enquanto o nome estava livre.
            try:
                os.link(captura, nome, src_dir_fd=recibos, dst_dir_fd=sessao, follow_symlinks=False)
            except OSError:
                print(f"Higeia: item preservado em .recibos/{captura}.", file=sys.stderr)
                continue
            os.unlink(captura, dir_fd=recibos)
        os.unlink(recibo, dir_fd=recibos)
    return citados


def duracao(sessao, recibos, caminho, pasta, reter):
    nome = os.path.basename(caminho)
    if not NOME.fullmatch(nome) or caminho not in (nome, str(pasta / nome)):
        raise ValueError("O caminho precisa pertencer a esta sessão.")
    destino, origem = ("reter.", "fim.") if reter else ("fim.", "reter.")
    atual = atributos(sessao, nome)
    if mesmo_arquivo(atual, atributos(recibos, destino + nome)):
        return
    if not mesmo_arquivo(atual, atributos(recibos, origem + nome)):
        raise ValueError("A identidade do arquivo divergiu da reserva.")
    os.rename(origem + nome, destino + nome, src_dir_fd=recibos, dst_dir_fd=recibos)


def operar(raiz, chave, acao, arg=None):
    criar = acao == "novo"
    pasta = raiz / chave
    with ExitStack() as pilha:
        pai = os.open(raiz.parent, DIRETORIO)
        pilha.callback(os.close, pai)
        try:
            base = abrir_pasta(pilha, pai, raiz.name, criar)
            # O lock do SO é liberado se o hook cair. Abrange reservar, reter e limpar.
            fcntl.flock(base, fcntl.LOCK_EX)
            sessao = abrir_pasta(pilha, base, chave, criar)
            recibos = abrir_pasta(pilha, sessao, ".recibos", criar)
        except FileNotFoundError:
            if acao in ("listar", "limpar"):
                return []
            raise
        if criar:
            extensao = arg or "tmp"
            if not re.fullmatch(r"[A-Za-z0-9]{1,12}", extensao):
                raise ValueError("Extensão inválida.")
            nome = "rascunho-" + secrets.token_hex(16) + "." + extensao
            recibo = "fim." + nome
            fd = os.open(recibo, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=recibos)
            os.close(fd)
            try:
                os.link(recibo, nome, src_dir_fd=recibos, dst_dir_fd=sessao, follow_symlinks=False)
            except OSError:
                os.unlink(recibo, dir_fd=recibos)
                raise
            return str(pasta / nome)
        if acao in ("reter", "liberar"):
            duracao(sessao, recibos, arg, pasta, acao == "reter")
        elif acao == "listar":
            arquivos = []
            for nome in sorted(os.listdir(sessao)):
                if nome == ".recibos":
                    continue
                atual = atributos(sessao, nome)
                estado = "sem registro"
                for prefixo, descricao in [("fim.", "descartável"), ("reter.", "retido")]:
                    if mesmo_arquivo(atual, atributos(recibos, prefixo + nome)):
                        estado = descricao
                        break
                arquivos.append({"caminho": str(pasta / nome), "estado": estado})
            return arquivos
        elif acao == "limpar":
            citados = coletar(sessao, recibos, pasta, arg)
            if not os.listdir(recibos) and os.listdir(sessao) == [".recibos"]:
                os.rmdir(".recibos", dir_fd=sessao)
                os.rmdir(chave, dir_fd=base)
            return citados


def principal():
    runtime, *args = sys.argv[1:]
    if runtime not in ("claude", "codex"):
        raise ValueError("Cliente desconhecido.")
    raiz = Path(tempfile.gettempdir()).resolve() / f"higeia-sessoes-{os.getuid()}"
    if args:
        if len(args) < 2:
            raise ValueError("Informe a chave e a operação da sessão.")
        chave, acao, *resto = args
        if (not re.fullmatch(r"[a-f0-9]{64}", chave) or acao not in ("novo", "reter", "liberar", "listar")
                or len(resto) not in {"novo": (0, 1), "listar": (0,), "reter": (1,), "liberar": (1,)}[acao]):
            raise ValueError("Reserva ou operação inválida.")
        saida = operar(raiz, chave, acao, next(iter(resto), None))
        if saida is not None:
            print(json.dumps(saida, ensure_ascii=False) if isinstance(saida, list) else saida)
        return
    entrada = sys.stdin.buffer.read(1024 * 1024 + 1)
    if len(entrada) > 1024 * 1024:
        raise ValueError("Evento excedeu o limite de leitura.")
    evento = json.loads(entrada)
    if not isinstance(evento, dict):
        raise ValueError("Evento inválido.")
    sid = evento.get("session_id")
    if not isinstance(sid, str) or not 0 < len(sid) <= 512:
        raise ValueError("Identificador de sessão ausente ou inválido.")
    chave = hashlib.sha256((runtime + "\0" + sid).encode()).hexdigest()
    tipo = evento.get("hook_event_name")
    if tipo == "SessionStart":
        itens = operar(raiz, chave, "listar")
        comando = shlex.join(["env", "TMPDIR=" + str(raiz.parent), "python3", "-I", "-S", "-B",
                              str(Path(__file__).resolve()), runtime, chave])
        contexto = (f"Higeia: para cada arquivo descartável deste turno execute {comando} novo [extensão] "
                    "(omita os colchetes). Escreva no caminho devolvido. O Stop limpa a reserva automaticamente. "
                    "Para trabalho em segundo plano ou entre turnos, use o mesmo comando com reter CAMINHO antes de iniciar "
                    "e liberar CAMINHO quando terminar. Grave entregas no destino final ou mova-as para lá antes de concluir. "
                    "Use listar para revisar a área desta sessão. Preserve arquivos de origem desconhecida.")
        if itens:
            contexto += f" Há {len(itens)} arquivo(s) anterior(es) na área {raiz / chave}. Confira a continuidade."
        print(json.dumps({"hookSpecificOutput": {"hookEventName": tipo, "additionalContext": contexto}}))
    elif tipo == "Stop":
        mensagem = evento.get("last_assistant_message")
        if not isinstance(mensagem, str) or evento.get("background_tasks") or evento.get("session_crons"):
            return
        citados = operar(raiz, chave, "limpar", mensagem)
        if citados and not evento.get("stop_hook_active"):
            print(json.dumps({"decision": "block", "reason":
                "Higeia reteve um rascunho citado na resposta. Copie a entrega ao destino permanente do pedido, "
                "confira a cópia e atualize o link. Libere o original quando a entrega estiver confirmada."}))


if __name__ == "__main__":
    try:
        principal()
    except (OSError, ValueError, TypeError) as exc:
        print(f"Higeia: {exc}", file=sys.stderr)
        sys.exit(1)
