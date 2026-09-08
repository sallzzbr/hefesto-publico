#!/usr/bin/env python3
"""Separa RENDIMENTO de APORTE num periodo, e extrai proventos. Skill `analisar-investimentos`.

A formula esta escrita na skill e agora e executavel:

    rendimento = (saldo_final - saldo_inicial) - aportes + resgates

O ponto dela e responder "meu patrimonio subiu 12.400: quanto disso eu botei e quanto o
dinheiro fez sozinho?". Sem separar, aporte alto parece performance boa.

Degradacao com aviso, como a skill manda: rendimento de um ativo exige **2+ snapshots** dele.
Com menos, o script devolve o ativo em `sem_base_de_calculo` com o motivo — e NAO chuta. Numero
ausente e dito e melhor que numero inventado.

Uso:
    rendimento.py --snapshots snapshots.csv --movimentos movimentos.csv \\
                  [--inicio 2026-01-01] [--fim 2026-03-31] [--ativo IVVB11]

Saida: JSON em stdout. Erro: stderr e exit 1.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from decimal import Decimal

from brl import ErroDeEntrada, brl, dinheiro, pct
from dados import ler_csv, no_periodo

APORTE, RESGATE, PROVENTO = "aporte", "resgate", "provento"


def por_ativo(snapshots: list[dict]) -> dict[str, list[dict]]:
    agrupado = defaultdict(list)
    for s in snapshots:
        agrupado[s["ativo"]].append(s)
    # Ordena por data: o arquivo e append-only, mas nada garante ordem cronologica nele.
    for ativo in agrupado:
        agrupado[ativo].sort(key=lambda s: s["data"])
    return agrupado


def calcular(snapshots: list[dict], movimentos: list[dict]) -> dict:
    agrupado = por_ativo(snapshots)

    movs = defaultdict(lambda: {APORTE: Decimal(0), RESGATE: Decimal(0), PROVENTO: Decimal(0)})
    desconhecidas = set()
    for m in movimentos:
        op = (m.get("operacao") or "").lower()
        if op not in (APORTE, RESGATE, PROVENTO):
            desconhecidas.add(op or "(vazia)")
            continue
        movs[m["ativo"]][op] += brl(m["valor"], f"movimentos.valor ({m.get('ativo')})")

    detalhe, sem_base = [], []
    tot_ini = tot_fim = tot_ap = tot_res = tot_prov = Decimal(0)

    for ativo in sorted(set(agrupado) | set(movs)):
        serie = agrupado.get(ativo, [])
        ap = movs[ativo][APORTE]
        res = movs[ativo][RESGATE]
        prov = movs[ativo][PROVENTO]

        if len(serie) < 2:
            # NAO soma nos totais. Esta linha e o conserto de um bug que o golden test pegou na
            # primeira leitura: os aportes do ativo sem base entravam em `tot_ap`, mas o saldo
            # dele nao entrava em `tot_ini`/`tot_fim` — aporte subtraido sem o saldo
            # correspondente. O total saia 500 a menos que a soma das partes, calado. O total
            # agora cobre SO os ativos com base, e por isso fecha com a soma por ativo; o que
            # ficou de fora aparece em `fora_do_calculo` para nao sumir da vista.
            sem_base.append({
                "ativo": ativo,
                "snapshots_no_periodo": len(serie),
                "motivo": "rendimento exige 2+ snapshots do ativo no periodo",
                "aportes": dinheiro(ap),
                "resgates": dinheiro(res),
                "proventos": dinheiro(prov),
            })
            continue

        tot_ap += ap
        tot_res += res
        tot_prov += prov

        ini = brl(serie[0]["saldo"], f"snapshots.saldo ({ativo})")
        fim = brl(serie[-1]["saldo"], f"snapshots.saldo ({ativo})")
        tot_ini += ini
        tot_fim += fim
        rend = (fim - ini) - ap + res

        # Yield sobre a base investida do periodo. Denominador zero (saldo inicial 0 e nenhum
        # aporte) nao rende percentual — devolve null em vez de dividir por zero ou fingir 0%.
        base = ini + ap
        detalhe.append({
            "ativo": ativo,
            "saldo_inicial": dinheiro(ini),
            "saldo_final": dinheiro(fim),
            "aportes": dinheiro(ap),
            "resgates": dinheiro(res),
            "proventos": dinheiro(prov),
            "rendimento": dinheiro(rend),
            "rendimento_pct_sobre_base": pct(rend / base) if base > 0 else None,
            "primeiro_snapshot": serie[0]["data"],
            "ultimo_snapshot": serie[-1]["data"],
        })

    rend_total = (tot_fim - tot_ini) - tot_ap + tot_res
    base_total = tot_ini + tot_ap

    saida = {
        "total": {
            "saldo_inicial": dinheiro(tot_ini),
            "saldo_final": dinheiro(tot_fim),
            "aportes": dinheiro(tot_ap),
            "resgates": dinheiro(tot_res),
            "proventos": dinheiro(tot_prov),
            "rendimento": dinheiro(rend_total),
            "rendimento_pct_sobre_base": pct(rend_total / base_total) if base_total > 0 else None,
        },
        "por_ativo": detalhe,
        "formula": "rendimento = (saldo_final - saldo_inicial) - aportes + resgates",
    }
    saida["total"]["cobertura"] = (
        "so ativos com 2+ snapshots no periodo; o resto esta em fora_do_calculo"
    )
    if sem_base:
        saida["sem_base_de_calculo"] = sem_base
        saida["fora_do_calculo"] = {
            "aportes": dinheiro(sum((brl(i["aportes"]) for i in sem_base), Decimal(0))),
            "resgates": dinheiro(sum((brl(i["resgates"]) for i in sem_base), Decimal(0))),
            "proventos": dinheiro(sum((brl(i["proventos"]) for i in sem_base), Decimal(0))),
            "nota": "movimentos reais, fora do total porque o rendimento deles nao e calculavel",
        }
    if desconhecidas:
        saida["avisos"] = [
            f"operacao nao reconhecida ignorada: {o}" for o in sorted(desconhecidas)
        ]
    return saida


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--snapshots", required=True, help="caminho do snapshots.csv, ou - para stdin")
    p.add_argument("--movimentos", required=True, help="caminho do movimentos.csv, ou - para stdin")
    p.add_argument("--inicio", help="AAAA-MM-DD inclusive")
    p.add_argument("--fim", help="AAAA-MM-DD inclusive")
    p.add_argument("--ativo", help="restringe a um ativo")
    args = p.parse_args(argv)

    if args.snapshots == "-" and args.movimentos == "-":
        print("ERRO: so um dos dois pode vir por stdin", file=sys.stderr)
        return 1

    try:
        snaps = ler_csv(args.snapshots, ["data", "ativo", "saldo"], "snapshots.csv")
        movs = ler_csv(args.movimentos, ["data", "ativo", "operacao", "valor"], "movimentos.csv")

        snaps = no_periodo(snaps, "data", args.inicio, args.fim)
        movs = no_periodo(movs, "data", args.inicio, args.fim)
        if args.ativo:
            snaps = [s for s in snaps if s["ativo"] == args.ativo]
            movs = [m for m in movs if m["ativo"] == args.ativo]

        resultado = calcular(snaps, movs)
    except ErroDeEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1

    resultado["periodo"] = {"inicio": args.inicio, "fim": args.fim, "ativo": args.ativo}
    json.dump(resultado, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
