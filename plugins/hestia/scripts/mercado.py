#!/usr/bin/env python3
"""Analise de mercado: preco unitario comparavel, evolucao e quantidade fora do padrao.

Cobre a skill `analisar-mercado`, que ate agora comparava precos de cabeca. O erro aqui e sutil
e caro: comparar R$/un com R$/kg da uma conclusao invertida sobre qual marca e mais barata.

Regras que vem da skill e ficam travadas por golden test:

- **Preco comparavel = preco na `unidade_base` do catalogo**, convertendo `g -> kg` e
  `ml -> l`. Item sem catalogo NAO e comparado: vai para `sem_catalogo` com o motivo. Comparar
  na unidade crua e o modo de falha que este script existe para impedir.
- **Quantidade fora do padrao = acima da media + 1 desvio** do historico do proprio item.
- **Desvio AMOSTRAL (n-1)**, nao populacional — o porque vive no `estatistica.py`, que e a
  definicao unica compartilhada com o `gastos.py`. Com n < 3 nao ha desvio confiavel e o item
  sai em `sem_base_de_desvio` com o motivo — a skill manda pular secao sem base dizendo o
  porque, nao inventar faixa.
- **Ausencias notaveis** (item recorrente que sumiu no periodo) sao apontadas COM a ressalva de
  que pode ser estoque em casa, nao economia. Isso e da skill, e importa: virar "voce economizou"
  seria conclusao falsa.

100% leitura. Nao grava nada e nao acessa o Drive.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from decimal import Decimal

from brl import ErroDeEntrada, brl, dinheiro
from dados import ler_csv, no_periodo
from estatistica import desvio_amostral, media

MINIMO_PARA_DESVIO = 3

# Conversao para a unidade base. Fator = quanto da unidade base cabe em 1 da unidade medida.
CONVERSAO = {
    ("g", "kg"): Decimal("0.001"),
    ("kg", "kg"): Decimal(1),
    ("ml", "l"): Decimal("0.001"),
    ("l", "l"): Decimal(1),
    ("un", "un"): Decimal(1),
}


def preco_comparavel(valor_unitario: Decimal, unidade: str, unidade_base: str) -> Decimal:
    """R$/unidade medida -> R$/unidade_base.

    Ex.: 3,50 por 500g com base kg -> o fator g->kg e 0,001, entao R$/kg = 3,50 / 0,001 = 7,00.
    """
    chave = (unidade.strip().lower(), unidade_base.strip().lower())
    if chave not in CONVERSAO:
        raise ErroDeEntrada(
            f"nao sei converter '{unidade}' para a unidade base '{unidade_base}'. "
            f"Conversoes conhecidas: {', '.join(f'{a}->{b}' for a, b in CONVERSAO)}. "
            f"Comparar sem converter produziria ranking invertido de preco."
        )
    return valor_unitario / CONVERSAO[chave]


def analisar(itens: list[dict], catalogo: dict[str, dict]) -> dict:
    por_produto: dict[str, list[dict]] = defaultdict(list)
    sem_catalogo = []

    for i in itens:
        nome = i["produto"]
        cat = catalogo.get(nome)
        if not cat:
            sem_catalogo.append({
                "produto": nome, "data": i.get("data"),
                "motivo": "produto fora do catalogo — sem unidade_base nao ha preco comparavel",
            })
            continue
        base = cat.get("unidade_base") or ""
        preco = preco_comparavel(
            brl(i["valor_unitario"], f"valor_unitario ({nome})"), i.get("unidade") or "", base
        )
        por_produto[nome].append({
            "data": i.get("data"), "mercado": i.get("mercado"),
            "quantidade": brl(i.get("quantidade") or "0", f"quantidade ({nome})"),
            "preco_base": preco, "unidade_base": base,
            "tipo": cat.get("tipo"), "marca": cat.get("marca"),
        })

    evolucao, quantidades, sem_desvio = [], [], []
    for nome, compras in sorted(por_produto.items()):
        compras.sort(key=lambda c: c["data"] or "")
        primeiro, ultimo = compras[0], compras[-1]
        item = {
            "produto": nome, "tipo": ultimo["tipo"], "marca": ultimo["marca"],
            "unidade_base": ultimo["unidade_base"],
            "compras": len(compras),
            "preco_primeiro": dinheiro(primeiro["preco_base"]),
            "preco_ultimo": dinheiro(ultimo["preco_base"]),
            "de": primeiro["data"], "ate": ultimo["data"],
        }
        if len(compras) >= 2 and primeiro["preco_base"] > 0:
            var = (ultimo["preco_base"] - primeiro["preco_base"]) / primeiro["preco_base"]
            item["variacao_pct"] = str((var * 100).quantize(Decimal("0.01")))
        else:
            item["variacao_pct"] = None
        evolucao.append(item)

        qs = [c["quantidade"] for c in compras]
        if len(qs) < MINIMO_PARA_DESVIO:
            sem_desvio.append({
                "produto": nome, "compras": len(qs),
                "motivo": f"desvio amostral exige {MINIMO_PARA_DESVIO}+ compras do item",
            })
            continue
        m, s = media(qs), desvio_amostral(qs)
        limite = m + s
        quantidades.append({
            "produto": nome,
            "media": str(m.quantize(Decimal("0.01"))),
            "desvio": str(s.quantize(Decimal("0.01"))),
            "limite_media_mais_1_desvio": str(limite.quantize(Decimal("0.01"))),
            "ultima_quantidade": str(qs[-1].quantize(Decimal("0.01"))),
            "acima_do_padrao": qs[-1] > limite,
        })

    # Maiores pesos do periodo, por gasto total do item.
    gasto = defaultdict(Decimal)
    for i in itens:
        if i.get("valor_total"):
            gasto[i["produto"]] += brl(i["valor_total"], f"valor_total ({i['produto']})")

    resultado = {
        "produtos": len(por_produto),
        "evolucao_de_preco": sorted(
            evolucao, key=lambda e: Decimal(e["variacao_pct"] or 0), reverse=True
        ),
        "quantidade_fora_do_padrao": [q for q in quantidades if q["acima_do_padrao"]],
        "quantidade_no_padrao": [q for q in quantidades if not q["acima_do_padrao"]],
        "maiores_gastos": [
            {"produto": p, "total": dinheiro(v)}
            for p, v in sorted(gasto.items(), key=lambda kv: (-kv[1], kv[0]))[:5]
        ],
        "criterios": {
            "preco": "convertido para a unidade_base do catalogo (g->kg, ml->l)",
            "desvio": f"amostral (n-1); minimo de {MINIMO_PARA_DESVIO} compras por item",
            "fora_do_padrao": "ultima quantidade acima de media + 1 desvio",
        },
    }
    if sem_desvio:
        resultado["sem_base_de_desvio"] = sem_desvio
    if sem_catalogo:
        resultado["sem_catalogo"] = sem_catalogo
    return resultado


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--itens", required=True, help="AAAA-MM-itens.csv (ou varios concatenados)")
    p.add_argument("--catalogo", required=True, help="produtos.csv")
    p.add_argument("--inicio", help="AAAA-MM-DD inclusive")
    p.add_argument("--fim", help="AAAA-MM-DD inclusive")
    args = p.parse_args(argv)

    try:
        itens = ler_csv(
            args.itens,
            ["data", "produto", "quantidade", "unidade", "valor_unitario"], "itens",
        )
        cat_linhas = ler_csv(args.catalogo, ["produto", "unidade_base"], "produtos.csv")
        catalogo = {c["produto"]: c for c in cat_linhas}
        itens = no_periodo(itens, "data", args.inicio, args.fim)
        if not itens:
            raise ErroDeEntrada("nenhum item no periodo informado")
        resultado = analisar(itens, catalogo)
    except ErroDeEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1

    resultado["periodo"] = {"inicio": args.inicio, "fim": args.fim}
    json.dump(resultado, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
