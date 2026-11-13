#!/usr/bin/env python3
"""Resumo do mes do orcamento: receitas, despesas, aportes, resgates, caixa e taxa de poupanca.

Cobre os Fluxos 4 (status) e 5 (fechar o mes) da skill `orcamento`, que ate agora eram somados
pelo MODELO lendo o CSV. E o calculo mais usado do hestia — e o mais facil de errar em silencio,
porque ninguem confere uma soma de 40 linhas.

Regras que vem da skill e que ficam travadas por golden test:

- **Aporte e transferencia, nao gasto** (decisao do dono, achado HES-05). A linha de despesa na
  categoria `Investimentos` (espelho do aporte lancado pela skill `investimentos`) sai das
  despesas e da quebra por categoria e aparece em linha propria, `investido_no_mes`.
- **Resgate e a transferencia de volta, nao renda** (decisao do dono, simetrica). A linha de
  receita na categoria `Investimentos` (espelho do resgate) sai das receitas e aparece em linha
  propria, `resgatado_no_mes`. Com o resgate em receitas e o aporte como poupanca, o
  rebalanceamento (resgatar 10000 do CDB e aplicar no Tesouro no mesmo mes) contava o mesmo
  dinheiro duas vezes: receitas 18500 e taxa de 83,78% em vez de 8500 e 64,71%.
- **Saldo em caixa = receitas + resgates - despesas - aportes**: o aporte saiu da conta e o
  resgate entrou nela.
- **Taxa de poupanca = (receitas - despesas) / receitas**, ou seja, o aporte conta como
  poupanca e o resgate nao conta como renda. Com o aporte lido como gasto, a taxa caia justamente no mes em que o usuario poupou
  (8500 / 3000 / 2000: 41,18% contra os 64,71% corretos). Mes sem receita lancada devolve `null`
  com motivo: a skill diz "nunca divida por zero", e devolver 0% seria pior que devolver nada,
  porque 0% parece um fato ("voce nao poupou") quando a verdade e "nao da para calcular".
- **Quebra por categoria e so de DESPESA**, do maior para o menor, com % sobre o total de
  despesas. Misturar receita (ou aporte) ali inverteria o sentido dos percentuais.
- **Cabecalho antigo sem `tipo`** (ate a 0.2.0) e lido como tudo despesa, exatamente como a
  secao de compatibilidade da skill manda — e o resultado diz que aplicou isso.
- **Comprometido restante**: recorrencia de despesa conta como ja lancada quando existe linha
  com o mesmo nome NA DESCRICAO e o mesmo valor (estimativa do relatorio, nao a reconciliacao do journal). O que sobrar sai do
  saldo em caixa no saldo projetado.

100% leitura. Nao grava nada, nao acessa o Drive: o CSV chega por caminho ou stdin.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from decimal import Decimal

from brl import ErroDeEntrada, brl, dinheiro, pct
from dados import conferencia_proventos, CATEGORIA_APORTE, eh_aporte, eh_resgate, ler_csv

CABECALHO_ATUAL = ["data", "tipo", "categoria", "descricao", "valor", "metodo"]

MOTIVO_SEM_RECEITA = (
    "mes sem receita lancada (resgate nao conta: e dinheiro do proprio patrimonio voltando). A "
    "taxa exige dividir pelas receitas, e 0% seria uma afirmacao falsa em vez de uma ausencia"
)


def resumir(linhas: list[dict], legado: bool) -> dict:
    receitas = despesas = investido = resgatado = Decimal(0)
    por_categoria: dict[str, Decimal] = defaultdict(Decimal)
    despesas_individuais, aportes, resgates = [], [], []

    for l in linhas:
        v = brl(l["valor"], f"valor (linha {l.get('data', '?')})")
        tipo = (l.get("tipo") or "despesa").strip().lower()
        if eh_resgate(tipo, l.get("categoria")):
            resgatado += v
            resgates.append({
                "data": l.get("data"), "descricao": l.get("descricao"), "valor": dinheiro(v),
            })
            continue
        if tipo == "receita":
            receitas += v
            continue
        if tipo != "despesa":
            raise ErroDeEntrada(
                f"tipo '{tipo}' desconhecido em {l.get('data', '?')} — o contrato admite "
                f"'despesa' ou 'receita'. Linha com tipo invalido nao pode ser somada num "
                f"lado nem no outro sem inventar."
            )
        if eh_aporte(tipo, l.get("categoria")):
            investido += v
            aportes.append({
                "data": l.get("data"), "descricao": l.get("descricao"), "valor": dinheiro(v),
            })
            continue
        despesas += v
        por_categoria[l.get("categoria") or "(sem categoria)"] += v
        despesas_individuais.append((v, l))

    # Acumulados de forma independente, e nao `poupanca - investido + resgatado`: assim o
    # invariante "caixa = poupanca + resgatado - investido" mede algo no teste em vez de valer por
    # construcao.
    saldo_em_caixa = receitas + resgatado - despesas - investido
    poupanca = receitas - despesas

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
        "investido_no_mes": dinheiro(investido),
        "aportes": aportes,
        "resgatado_no_mes": dinheiro(resgatado),
        "resgates": resgates,
        "saldo_em_caixa": dinheiro(saldo_em_caixa),
        "poupanca_do_mes": dinheiro(poupanca),
        "taxa_de_poupanca_pct": pct(poupanca / receitas) if receitas > 0 else None,
        "despesas_por_categoria": categorias,
        "maiores_despesas": maiores,
        "criterios": {
            "aporte": (
                f"despesa na categoria '{CATEGORIA_APORTE}' (sem caixa nem acento) e aporte: "
                f"transferencia para o proprio patrimonio, fora de `despesas`, da quebra por "
                f"categoria e das maiores despesas, somada em `investido_no_mes`"
            ),
            "resgate": (
                f"receita na categoria '{CATEGORIA_APORTE}' (sem caixa nem acento) e resgate: "
                f"transferencia de volta do proprio patrimonio, fora de `receitas` e da taxa de "
                f"poupanca, somada em `resgatado_no_mes`"
            ),
            "saldo_em_caixa": (
                "receitas + resgatado_no_mes - despesas - investido_no_mes: o resgate entrou na "
                "conta e o aporte saiu dela"
            ),
            "taxa_de_poupanca": (
                "poupanca_do_mes / receitas, com poupanca_do_mes = receitas - despesas: o "
                "aporte conta como poupanca e o resgate nao conta como renda"
            ),
        },
    }
    if receitas <= 0:
        resultado["taxa_de_poupanca_motivo"] = MOTIVO_SEM_RECEITA
    if legado:
        resultado["compatibilidade"] = (
            "livro com cabecalho antigo (sem coluna `tipo`): todas as linhas lidas como despesa"
        )
    conferencia = conferencia_proventos(linhas)
    if conferencia:
        resultado["conferencia"] = conferencia
    return resultado


def comprometido_restante(linhas: list[dict], recorrencias: list[dict]) -> dict:
    """Recorrencias de despesa ainda nao lancadas, pela estimativa nome contido na descricao + valor; nao reconcilia o journal."""
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
        "criterio": "mesmo nome na descricao E mesmo valor (estimativa; abertura usa efeito completo e journal)",
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
                brl(resultado["saldo_em_caixa"]) - brl(comprometido["total_faltando"])
            )
    except ErroDeEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1

    json.dump(resultado, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
