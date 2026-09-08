#!/usr/bin/env python3
"""Resumo do mes do orcamento: receitas, despesas, saldo, taxa de poupanca, categorias.

Cobre os Fluxos 4 (status) e 5 (fechar o mes) da skill `orcamento`, que ate agora eram somados
pelo MODELO lendo o CSV. E o calculo mais usado do hestia — e o mais facil de errar em silencio,
porque ninguem confere uma soma de 40 linhas.

Regras que vem da skill e que ficam travadas por golden test:

- **Taxa de poupanca = saldo / receitas.** Mes sem receita lancada devolve `null` com motivo:
  a skill diz "nunca divida por zero", e devolver 0% seria pior que devolver nada — 0% parece
  um fato ("voce nao poupou") quando a verdade e "nao da para calcular".
- **Quebra por categoria e so de DESPESA**, do maior para o menor, com % sobre o total de
  despesas. Misturar receita ali inverteria o sentido dos percentuais.
- **Cabecalho antigo sem `tipo`** (ate a 0.2.0) e lido como tudo despesa, exatamente como a
  secao de compatibilidade da skill manda — e o resultado diz que aplicou isso.
- **Comprometido restante**: recorrencia de despesa conta como ja lancada quando existe linha
  com o mesmo nome NA DESCRICAO e o mesmo valor (a checagem do Fluxo 2). O que sobrar entra no
  saldo projetado.

100% leitura. Nao grava nada, nao acessa o Drive: o CSV chega por caminho ou stdin.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from decimal import Decimal

from brl import ErroDeEntrada, brl, dinheiro, pct
from dados import ler_csv

CABECALHO_ATUAL = ["data", "tipo", "categoria", "descricao", "valor", "metodo"]


def resumir(linhas: list[dict], legado: bool) -> dict:
    receitas = despesas = Decimal(0)
    por_categoria: dict[str, Decimal] = defaultdict(Decimal)
    despesas_individuais = []

    for l in linhas:
        v = brl(l["valor"], f"valor (linha {l.get('data', '?')})")
        tipo = (l.get("tipo") or "despesa").strip().lower()
        if tipo == "receita":
            receitas += v
            continue
        if tipo != "despesa":
            raise ErroDeEntrada(
                f"tipo '{tipo}' desconhecido em {l.get('data', '?')} — o contrato admite "
                f"'despesa' ou 'receita'. Linha com tipo invalido nao pode ser somada num "
                f"lado nem no outro sem inventar."
            )
        despesas += v
        por_categoria[l.get("categoria") or "(sem categoria)"] += v
        despesas_individuais.append((v, l))

    saldo = receitas - despesas

    categorias = [
        {
            "categoria": c,
            "valor": dinheiro(v),
            "pct_das_despesas": pct(v / despesas) if despesas > 0 else None,
        }
        for c, v in sorted(por_categoria.items(), key=lambda kv: (-kv[1], kv[0]))
    ]

    despesas_individuais.sort(key=lambda t: (-t[0], t[1].get("data", "")))
    maiores = [
        {
            "data": l.get("data"), "categoria": l.get("categoria"),
            "descricao": l.get("descricao"), "valor": dinheiro(v),
        }
        for v, l in despesas_individuais[:5]
    ]

    resultado = {
        "lancamentos": len(linhas),
        "receitas": dinheiro(receitas),
        "despesas": dinheiro(despesas),
        "saldo": dinheiro(saldo),
        "taxa_de_poupanca_pct": pct(saldo / receitas) if receitas > 0 else None,
        "despesas_por_categoria": categorias,
        "maiores_despesas": maiores,
    }
    if receitas <= 0:
        resultado["taxa_de_poupanca_motivo"] = (
            "mes sem receita lancada — a taxa exige dividir pelas receitas, e 0% seria uma "
            "afirmacao falsa em vez de uma ausencia"
        )
    if legado:
        resultado["compatibilidade"] = (
            "livro com cabecalho antigo (sem coluna `tipo`): todas as linhas lidas como despesa"
        )
    return resultado


def comprometido_restante(linhas: list[dict], recorrencias: list[dict]) -> dict:
    """Recorrencias de despesa ainda nao lancadas, pela checagem nome+valor do Fluxo 2."""
    lancadas, faltando = [], []
    for r in recorrencias:
        if (r.get("tipo") or "").strip().lower() != "despesa":
            continue
        nome = (r.get("nome") or "").strip()
        valor = brl(r["valor"], f"recorrencias.valor ({nome})")
        achou = any(
            nome and nome.lower() in (l.get("descricao") or "").lower()
            and brl(l["valor"], "valor") == valor
            for l in linhas
        )
        (lancadas if achou else faltando).append({
            "nome": nome, "valor": dinheiro(valor),
            "categoria": r.get("categoria"), "dia": r.get("dia"),
            "parcelas_restantes": r.get("parcelas_restantes") or None,
        })
    total = sum((brl(f["valor"]) for f in faltando), Decimal(0))
    return {
        "ja_lancadas": lancadas,
        "faltando": faltando,
        "total_faltando": dinheiro(total),
        "criterio": "mesmo nome na descricao E mesmo valor (Fluxo 2 da skill orcamento)",
    }


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--livro", required=True, help="CSV do mes, ou - para stdin")
    p.add_argument("--recorrencias", help="recorrencias.csv, para o comprometido restante")
    args = p.parse_args(argv)

    try:
        # Cabecalho antigo (sem `tipo`) e contrato valido ate a 0.2.0 — cobrar `tipo` aqui
        # quebraria livro legitimo. Cobramos o que existe nos dois, e detectamos o legado.
        linhas = ler_csv(args.livro, ["data", "categoria", "valor"], "livro do mes")
        legado = "tipo" not in linhas[0]
        resultado = resumir(linhas, legado)

        if args.recorrencias:
            rec = ler_csv(args.recorrencias, ["nome", "tipo", "valor"], "recorrencias.csv")
            comprometido = comprometido_restante(linhas, rec)
            resultado["comprometido_restante"] = comprometido
            resultado["saldo_projetado"] = dinheiro(
                brl(resultado["saldo"]) - brl(comprometido["total_faltando"])
            )
    except ErroDeEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1

    json.dump(resultado, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
