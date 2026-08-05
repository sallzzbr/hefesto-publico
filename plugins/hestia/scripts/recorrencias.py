#!/usr/bin/env python3
"""Totais do cadastro de recorrencias: fixas x parceladas, comprometido e receita recorrente.

Cobre o Fluxo 3 da skill `orcamento` ("apresente em BRL, agrupando fixas e parceladas, com o
total mensal comprometido (despesas) e o total recorrente de receitas"), que era a ultima soma
em prosa do plugin depois que o `nota.py` fechou a do mercado.

E script separado do `resumo_mes.py` de proposito, ainda que os dois leiam `recorrencias.csv`:
o `resumo_mes` responde "o que do cadastro AINDA NAO caiu neste mes?" e para isso precisa do
livro. Aqui a pergunta e outra e nao envolve livro nenhum — "quanto o cadastro compromete por
mes?". Dobrar `--livro` como opcional la para caber esta pergunta borraria o contrato de um
script que hoje e obrigado a receber o mes que resume.

Fixa x parcelada sai do contrato: `parcelas_restantes` **vazio** = conta fixa (repete
indefinidamente), **numero** = parcelamento.

Onde este script recusa e onde apenas avisa, e por que a linha esta ai:

- **Recusa o que muda um numero.** `tipo` fora de despesa/receita decide de que lado a linha
  soma; `parcelas_restantes` nao numerico decide se ela e fixa ou parcelada, e portanto em qual
  subtotal cai. Chutar qualquer um dos dois produz total errado com cara de certo.
- **Avisa sobre o que nao muda numero nenhum.** `dia` fora de 1-31 viola o contrato, mas nao
  entra em soma alguma aqui — e travar uma LISTAGEM so-leitura por causa de um campo decorativo
  seria desproporcional. Ele sai em `avisos`, com o valor errado a vista.

100% leitura. Nao grava nada e nao acessa o Drive: o CSV chega por caminho ou stdin.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from decimal import Decimal

from brl import ErroDeEntrada, brl, dinheiro
from dados import ler_csv


def classificar(linha: dict) -> tuple[str, int | None]:
    """Devolve (tipo, parcelas_restantes). `parcelas_restantes` None = conta fixa."""
    nome = (linha.get("nome") or "").strip() or "(sem nome)"

    tipo = (linha.get("tipo") or "").strip().lower()
    if tipo not in ("despesa", "receita"):
        raise ErroDeEntrada(
            f"recorrencia '{nome}': tipo '{tipo}' desconhecido — o contrato admite 'despesa' ou "
            f"'receita'. Linha com tipo invalido nao pode entrar num total nem no outro sem "
            f"inventar de que lado ela esta."
        )

    bruto = (linha.get("parcelas_restantes") or "").strip()
    if not bruto:
        return tipo, None
    if not bruto.isdigit():
        raise ErroDeEntrada(
            f"recorrencia '{nome}': parcelas_restantes {bruto!r} nao e numero nem vazio. E ele "
            f"que separa conta fixa de parcelamento, entao chutar troca a linha de subtotal."
        )
    return tipo, int(bruto)


def resumir(linhas: list[dict]) -> dict:
    grupos: dict[str, list[dict]] = {"fixas": [], "parceladas": []}
    totais: dict[tuple[str, str], Decimal] = {
        (t, g): Decimal(0) for t in ("despesa", "receita") for g in ("fixas", "parceladas")
    }
    avisos, zeradas = [], []

    # `nome` e "identificador legivel e UNICO" no contrato, e nao e decoracao: o `resumo_mes.py`
    # e o `gastos.py` casam recorrencia com lancamento POR NOME. Nome vazio ou repetido nao muda
    # nenhum total daqui — por isso vira aviso e nao recusa —, mas quebra aqueles dois. Melhor
    # o usuario descobrir na listagem do cadastro que na analise de tres meses depois.
    vistos: dict[str, int] = defaultdict(int)
    for linha in linhas:
        vistos[(linha.get("nome") or "").strip()] += 1
    for nome_visto, quantas in sorted(vistos.items()):
        if not nome_visto:
            avisos.append({
                "nome": "(sem nome)", "campo": "nome", "valor": "",
                "motivo": f"{quantas} recorrencia(s) sem `nome`; o contrato pede identificador "
                          f"unico, e o casamento por nome de outras skills nao acha a linha",
            })
        elif quantas > 1:
            avisos.append({
                "nome": nome_visto, "campo": "nome", "valor": nome_visto,
                "motivo": f"nome repetido em {quantas} linhas; o contrato pede unico, e o "
                          f"casamento por nome de outras skills nao distingue as duas",
            })

    for linha in linhas:
        tipo, parcelas = classificar(linha)
        nome = (linha.get("nome") or "").strip() or "(sem nome)"
        valor = brl(linha["valor"], f"recorrencias.valor ({nome})")
        grupo = "fixas" if parcelas is None else "parceladas"

        dia = (linha.get("dia") or "").strip()
        if not (dia.isdigit() and 1 <= int(dia) <= 31):
            avisos.append({
                "nome": nome,
                "campo": "dia",
                "valor": dia,
                "motivo": "o contrato pede o dia do mes (1-31); nao entra em soma nenhuma aqui, "
                          "por isso vira aviso e nao recusa",
            })

        ficha = {
            "nome": nome,
            "tipo": tipo,
            "categoria": linha.get("categoria"),
            "descricao": linha.get("descricao"),
            "valor": dinheiro(valor),
            "dia": dia or None,
            "metodo": linha.get("metodo"),
        }
        if parcelas is not None:
            ficha["parcelas_restantes"] = parcelas
            if parcelas == 0:
                zeradas.append({
                    "nome": nome,
                    "motivo": "parcelamento com 0 parcelas restantes ainda no cadastro — o "
                              "contrato manda remover a linha ao chegar a zero (com "
                              "confirmacao). Ela AINDA entra no total comprometido, porque "
                              "e isso que o arquivo diz hoje.",
                })
        grupos[grupo].append(ficha)
        totais[(tipo, grupo)] += valor

    despesas = totais[("despesa", "fixas")] + totais[("despesa", "parceladas")]
    receitas = totais[("receita", "fixas")] + totais[("receita", "parceladas")]

    resultado = {
        "recorrencias": len(linhas),
        "fixas": grupos["fixas"],
        "parceladas": grupos["parceladas"],
        "total_comprometido_despesas": dinheiro(despesas),
        "subtotal_despesas_fixas": dinheiro(totais[("despesa", "fixas")]),
        "subtotal_despesas_parceladas": dinheiro(totais[("despesa", "parceladas")]),
        "total_recorrente_receitas": dinheiro(receitas),
        "subtotal_receitas_fixas": dinheiro(totais[("receita", "fixas")]),
        "subtotal_receitas_parceladas": dinheiro(totais[("receita", "parceladas")]),
        "diferenca_receitas_menos_despesas": dinheiro(receitas - despesas),
        "criterios": {
            "fixa_ou_parcelada": "`parcelas_restantes` vazio = fixa; numero = parcelamento "
                                 "(contrato da skill orcamento)",
            "totais": "o comprometido soma as despesas dos DOIS grupos — parcela tambem "
                      "compromete o mes; os subtotais ficam ao lado para a leitura por grupo",
            "diferenca": "receitas recorrentes menos despesas recorrentes. E o que o CADASTRO "
                         "diz, nao previsao do mes: o mes real tem gasto variavel que nao esta "
                         "aqui, e para a foto do mes o script e o resumo_mes.py",
        },
    }
    if zeradas:
        resultado["parcelas_zeradas"] = zeradas
    if avisos:
        resultado["avisos"] = avisos
    return resultado


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--recorrencias", required=True, help="recorrencias.csv, ou - para stdin")
    args = p.parse_args(argv)

    try:
        linhas = ler_csv(
            args.recorrencias, ["nome", "tipo", "valor"], "recorrencias.csv"
        )
        resultado = resumir(linhas)
    except ErroDeEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1

    json.dump(resultado, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
