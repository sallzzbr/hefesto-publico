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
import re
import sys
import unicodedata
from pathlib import Path

from brl import ErroDeEntrada

# Aporte e TRANSFERENCIA para o proprio patrimonio, nao gasto (decisao do dono, achado HES-05),
# e resgate e a transferencia de volta, nao renda (decisao do dono seguinte, simetrica). A skill
# `investimentos` lanca o espelho do aporte no livro como `despesa` nesta categoria e o do resgate
# como `receita`; os scripts tiram o aporte das despesas e o resgate das receitas e mostram os
# dois em separado ("investido no mes", "resgatado no mes"). Sem a simetria, aporte e resgate no
# mesmo mes (rebalanceamento) contavam o mesmo dinheiro duas vezes como poupanca.
CATEGORIA_APORTE = "Investimentos"


def _normalizar(texto: str) -> str:
    """Sem acento, sem caixa e sem espaco nas pontas: a mesma comparacao que a skill `orcamento`
    usa ao deduplicar categoria. "INVESTIMENTOS" digitado no Drive continua sendo aporte."""
    decomposto = unicodedata.normalize("NFD", texto)
    return "".join(c for c in decomposto if not unicodedata.combining(c)).strip().casefold()


def _na_categoria_de_investimentos(categoria: str | None) -> bool:
    return _normalizar(categoria or "") == _normalizar(CATEGORIA_APORTE)


def eh_aporte(tipo: str, categoria: str | None) -> bool:
    """Linha de despesa na categoria de investimentos: espelho de aporte."""
    return tipo == "despesa" and _na_categoria_de_investimentos(categoria)


def eh_resgate(tipo: str, categoria: str | None) -> bool:
    """Linha de receita na categoria de investimentos: espelho de resgate. Mesmo criterio de
    categoria do `eh_aporte`, para que as duas pontas da transferencia nunca discordem."""
    return tipo == "receita" and _na_categoria_de_investimentos(categoria)


def conferencia_proventos(linhas: list[dict]) -> dict | None:
    """Sinaliza ambiguidade textual, sem inferir classificação ou alterar lançamentos."""
    suspeitos = []
    termos = r"\b(?:dividendos?|proventos?|jcp|cupom|cupons|rendimentos?|juros sobre (?:o )?capital(?: proprio)?)\b"
    for indice, linha in enumerate(linhas, 1):
        tipo = (linha.get("tipo") or "despesa").strip().lower()
        if eh_resgate(tipo, linha.get("categoria")) and re.search(termos, _normalizar(linha.get("descricao") or "")):
            suspeitos.append({
                "indice_na_entrada": indice, "data": linha.get("data"),
                "mes": linha.get("_mes") or (linha.get("data") or "")[:7],
                "descricao": linha.get("descricao"), "categoria": linha.get("categoria"),
                "valor": linha.get("valor"),
            })
    if not suspeitos:
        return None
    return {
        "estado": "classificacao_pendente", "totais_provisorios": True,
        "lancamentos": suspeitos,
        "motivo": "Receita em Investimentos menciona possível provento; a categoria atual a soma como resgate. A descrição não prova a classificação.",
        "acao": "Antes de apresentar resumo ou comparação como conferidos, pedir ao dono a classificação: resgate permanece transferência; provento recebido é renda em outra categoria. Não alterar lançamentos automaticamente. Recalcular após correção autorizada.",
    }


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
