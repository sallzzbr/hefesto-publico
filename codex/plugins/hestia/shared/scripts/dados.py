"""Leitura dos CSVs do hestia. Contratos definidos nas skills `orcamento` e `investimentos`.

Usa o modulo `csv` da stdlib de proposito, e nao `split(";")`: os campos de texto
(`descricao`, `observacao`) podem conter ponto e virgula, e o parser ingenuo quebraria calado,
deslocando as colunas e produzindo numero errado com cara de numero certo. E o modo de falha
mais perigoso que existe aqui, porque nada reclama.

Os scripts nao acessam o Google Drive: quem busca o arquivo e o conector, e o caminho chega
como argumento (ou `-` para stdin). Isso mantem a regra da skill — "ela nao le nem escreve
arquivos sozinha" — e deixa a funcao pura, que e o que golden test consegue congelar.
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

from brl import ErroDeEntrada


def ler_csv(caminho: str, obrigatorias: list[str], rotulo: str) -> list[dict]:
    """Le CSV `;`-separado com cabecalho e devolve lista de dicts.

    Cobra as colunas obrigatorias pelo NOME, nao pela posicao: arquivo com coluna a mais (ou em
    outra ordem) continua valendo, arquivo sem coluna essencial para na hora com mensagem que
    diz o que faltou. Silenciar isso e como o `tipo` do livro sumiu na 0.2.0 sem ninguem ver.
    """
    if caminho == "-":
        texto = sys.stdin.read()
    else:
        p = Path(caminho)
        if not p.is_file():
            raise ErroDeEntrada(f"{rotulo}: arquivo nao encontrado em {caminho}")
        texto = p.read_text(encoding="utf-8-sig")

    if not texto.strip():
        raise ErroDeEntrada(f"{rotulo}: arquivo vazio")

    linhas = list(csv.DictReader(texto.splitlines(), delimiter=";"))
    if not linhas:
        raise ErroDeEntrada(f"{rotulo}: nenhuma linha de dados (so cabecalho?)")

    presentes = {c.strip() for c in (linhas[0].keys() or []) if c}
    faltando = [c for c in obrigatorias if c not in presentes]
    if faltando:
        raise ErroDeEntrada(
            f"{rotulo}: faltam as colunas {', '.join(faltando)}. Achei: {', '.join(sorted(presentes))}"
        )

    return [{(k.strip() if k else k): (v.strip() if isinstance(v, str) else v)
             for k, v in linha.items()} for linha in linhas]


def no_periodo(linhas: list[dict], campo: str, inicio: str | None, fim: str | None) -> list[dict]:
    """Filtra por data em ISO (AAAA-MM-DD). Comparacao de string funciona porque ISO ordena
    lexicograficamente — e evita depender de parse de data para um filtro."""
    def dentro(l):
        d = l.get(campo, "")
        if inicio and d < inicio:
            return False
        if fim and d > fim:
            return False
        return True
    return [l for l in linhas if dentro(l)]
