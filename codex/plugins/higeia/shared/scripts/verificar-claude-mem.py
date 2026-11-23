"""Confere o worker local e a busca de uma memória existente sem imprimir conteúdo."""
import argparse
import json
import re
import secrets
import sqlite3
import sys
from contextlib import closing
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, ProxyHandler, build_opener


class SomenteLocal(HTTPRedirectHandler):
    def redirect_request(self, *args):
        raise ValueError("O worker tentou redirecionar a consulta.")


def verificar(raiz):
    porta = json.loads((raiz / "worker.pid").read_text())["port"]
    if type(porta) is not int or not 0 < porta < 65536:
        raise ValueError("Porta do worker inválida.")
    cliente = build_opener(ProxyHandler({}), SomenteLocal())

    def consultar(rota, **params):
        url = f"http://127.0.0.1:{porta}/api/{rota}?" + urlencode(params)
        with cliente.open(url, timeout=60) as resposta:
            return json.load(resposta)

    def banco(nome):
        return sqlite3.connect((raiz / nome).resolve().as_uri() + "?mode=ro", uri=True)

    saude = consultar("health")
    if not saude.get("initialized") or not saude.get("mcpReady"):
        raise ValueError("Worker ainda não está pronto.")
    with closing(banco("chroma/chroma.sqlite3")) as indice, closing(banco("claude-mem.db")) as db:
        controle = "higeia" + secrets.token_hex(16)
        if db.execute("select count(*) from observations_fts where observations_fts match ?", (controle,)).fetchone()[0]:
            raise ValueError("Controle já existe no índice textual.")
        for (chave,) in indice.execute("select embedding_id from embeddings where embedding_id like 'obs_%' order by id desc limit 1024"):
            m = re.fullmatch(r"obs_(\d+)(?:_.+)?", chave)
            if m:
                obs = db.execute("select id,title,project from observations where id=? and length(title)>0", (m[1],)).fetchone()
                if obs:
                    break
        else:
            raise ValueError("Sem observação identificável nos dois bancos.")
        ident, titulo, projeto = obs
        contagem = db.execute("select count(*) from observations").fetchone()[0]
        def buscar(texto):
            return consultar("search", query=texto, type="observations", project=projeto,
                             dateStart="1970-01-01", format="json", limit=100)["observations"]
        if consultar(f"observation/{ident}").get("title") != titulo:
            raise ValueError("Leitura da observação pelo worker divergiu do acervo.")
        if ident not in [item["id"] for item in buscar(titulo)]:
            raise ValueError("A busca não recuperou a observação conhecida.")
        semanticos = buscar(controle)
        if not semanticos:
            raise ValueError("Busca vetorial inconclusiva. A palavra de controle não tem resultado textual.")
        return dict(verificado=True, versao=saude["version"], observacoes=contagem, idConfirmado=ident,
                    resultadosSemanticosDoControle=len(semanticos), resultadosTextuaisDoControle=0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dados", type=Path, default=Path.home() / ".claude-mem")
    try:
        print(json.dumps(verificar(parser.parse_args().dados)))
    except Exception as erro:
        # Mensagens de bibliotecas podem conter a URL com o título privado.
        mensagem = str(erro) if isinstance(erro, ValueError) and type(erro) is ValueError else type(erro).__name__
        print(json.dumps(dict(verificado=False, erro=mensagem)))
        sys.exit(1)
