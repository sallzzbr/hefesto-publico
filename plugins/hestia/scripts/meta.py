#!/usr/bin/env python3
"""Acompanhamento de meta: progresso, ritmo real, projecao de chegada e o aporte que corrige.

Responde a saida 4 da skill `analisar-investimentos`, que hoje o modelo faz de cabeca:

    progresso   R$ 18.400 de R$ 30.000 — 61%
    ritmo       aportes + rendimento dos ultimos N meses / N
    projecao    no ritmo atual voce chega em set/2027, 3 meses depois do alvo
    correcao    para voltar ao prazo, o aporte precisa ir de R$ 800 para R$ 1.050

Duas honestidades que a skill exige e que o script encarna em vez de prometer:

- **Ritmo pede 3+ meses de historico.** Com menos, devolve `ritmo: null` e diz o porque; o
  chamador mostra so o progresso simples. Media de dois meses e ruido com cara de tendencia.
- **A projecao usa o ritmo OBSERVADO, sem taxa de juros embutida.** Se o ritmo veio de aportes
  + rendimento passados, projetar com juros por cima contaria rendimento duas vezes. Para
  projecao com premissa de taxa existe o `juros_compostos.py`, onde a premissa e declarada.

Uso:
    meta.py --metas metas.csv --acumulado 18400 [--movimentos movimentos.csv] [--hoje 2026-07-28]

`--acumulado` e o patrimonio ja acumulado para a meta (vem da carteira; meta nao e vinculada a
ativo, entao quem decide o recorte e o chamador, nao este script).
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import date
from decimal import Decimal

from brl import ErroDeEntrada, brl, dinheiro, pct
from dados import ler_csv

MINIMO_MESES_RITMO = 3


def iso(texto: str, campo: str) -> date:
    try:
        a, m, d = (int(x) for x in texto.split("-"))
        return date(a, m, d)
    except Exception:
        raise ErroDeEntrada(f"{campo}: {texto!r} nao e uma data AAAA-MM-DD")


def meses_entre(a: date, b: date) -> int:
    """Meses cheios de `a` ate `b`. Negativo se b < a."""
    return (b.year - a.year) * 12 + (b.month - a.month) - (1 if b.day < a.day else 0)


def somar_mes(d: date, n: int) -> date:
    total = d.month - 1 + n
    ano, mes = d.year + total // 12, total % 12 + 1
    # Preserva o dia quando cabe; senao cai para o ultimo dia do mes (31 jan + 1 mes = 28 fev).
    for dia in range(d.day, 0, -1):
        try:
            return date(ano, mes, dia)
        except ValueError:
            continue
    raise ErroDeEntrada("data invalida ao somar meses")


def ritmo_observado(movimentos: list[dict], hoje: date) -> tuple[Decimal | None, str]:
    """Media mensal de aporte liquido (aportes - resgates) nos meses com movimento."""
    if not movimentos:
        return None, "sem movimentos registrados"
    por_mes: dict[str, Decimal] = defaultdict(Decimal)
    for m in movimentos:
        op = (m.get("operacao") or "").lower()
        if op not in ("aporte", "resgate"):
            continue
        competencia = m["data"][:7]
        v = brl(m["valor"], "movimentos.valor")
        por_mes[competencia] += v if op == "aporte" else -v
    if len(por_mes) < MINIMO_MESES_RITMO:
        return None, (
            f"ritmo exige {MINIMO_MESES_RITMO}+ meses com movimento; achei {len(por_mes)}"
        )
    return sum(por_mes.values()) / Decimal(len(por_mes)), f"media de {len(por_mes)} meses"


def avaliar(linha: dict, acumulado: Decimal, ritmo: Decimal | None, motivo: str, hoje: date) -> dict:
    alvo = brl(linha["valor_alvo"], "metas.valor_alvo")
    if alvo <= 0:
        raise ErroDeEntrada(f"metas.valor_alvo: {linha['valor_alvo']!r} precisa ser positivo")
    data_alvo = iso(linha["data_alvo"], "metas.data_alvo")
    falta = alvo - acumulado
    meses_ate_alvo = meses_entre(hoje, data_alvo)

    item = {
        "meta": linha["meta"],
        "valor_alvo": dinheiro(alvo),
        "acumulado": dinheiro(acumulado),
        "falta": dinheiro(max(Decimal(0), falta)),
        "progresso_pct": pct(acumulado / alvo),
        "data_alvo": linha["data_alvo"],
        "meses_ate_alvo": meses_ate_alvo,
        "aporte_mensal_planejado": (
            dinheiro(brl(linha["aporte_mensal_planejado"], "metas.aporte_mensal_planejado"))
            if linha.get("aporte_mensal_planejado") else None
        ),
    }

    if falta <= 0:
        item["situacao"] = "atingida"
        return item

    # Aporte que fecha no prazo, SEM juros — e o piso honesto. Com premissa de taxa, use o
    # juros_compostos.py, onde a premissa aparece.
    if meses_ate_alvo > 0:
        item["aporte_para_o_prazo_sem_juros"] = dinheiro(falta / Decimal(meses_ate_alvo))
    else:
        item["situacao"] = "prazo vencido"
        item["aporte_para_o_prazo_sem_juros"] = None

    if ritmo is None or ritmo <= 0:
        item["ritmo_mensal"] = None
        item["ritmo_motivo"] = motivo if ritmo is None else "ritmo nao positivo (resgates >= aportes)"
        item["projecao_chegada"] = None
        return item

    import math
    meses_no_ritmo = math.ceil(falta / ritmo)
    chegada = somar_mes(hoje, meses_no_ritmo)
    item["ritmo_mensal"] = dinheiro(ritmo)
    item["ritmo_motivo"] = motivo
    item["projecao_chegada"] = chegada.isoformat()
    item["meses_no_ritmo"] = meses_no_ritmo
    item["atraso_meses"] = meses_no_ritmo - meses_ate_alvo
    return item


def resolver_acumulados(entradas: list[str], metas: list[dict]) -> dict[str, Decimal]:
    """Casa cada meta com seu acumulado, e PARA se faltar alguma.

    Falhar aqui e o ponto: sem isso, uma meta sem valor herdaria o da outra e o progresso
    sairia errado sem nenhum sinal. Erro alto e melhor que porcentagem plausivel e falsa.
    """
    nomes = [m["meta"] for m in metas]
    soltos = [e for e in entradas if "=" not in e]
    pares = dict(e.split("=", 1) for e in entradas if "=" in e)

    if soltos:
        if len(entradas) > 1 or len(nomes) != 1:
            raise ErroDeEntrada(
                "--acumulado sem '=' so vale com exatamente uma meta. Com varias, passe "
                "'--acumulado \"<meta>=<valor>\"' para cada uma (ou filtre com --meta)."
            )
        return {nomes[0]: brl(soltos[0], "--acumulado")}

    desconhecidas = [n for n in pares if n not in nomes]
    if desconhecidas:
        raise ErroDeEntrada(
            f"--acumulado cita meta inexistente: {', '.join(desconhecidas)}. "
            f"No arquivo ha: {', '.join(nomes)}"
        )
    faltando = [n for n in nomes if n not in pares]
    if faltando:
        raise ErroDeEntrada(
            f"--acumulado nao informado para: {', '.join(faltando)}. Metas sao potes distintos; "
            f"reaproveitar o valor de uma na outra produziria progresso falso."
        )
    return {n: brl(v, f"--acumulado[{n}]") for n, v in pares.items()}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--metas", required=True, help="caminho do metas.csv, ou - para stdin")
    # Repetivel e POR META. Um valor global aplicado a varias metas produz numero errado calado:
    # com duas metas, o acumulado da reserva de emergencia virava progresso da entrada do apê.
    # Metas sao potes distintos e o CSV nao guarda o acumulado (meta nunca e vinculada a ativo,
    # por guardrail), entao quem sabe o recorte e o chamador — e agora precisa dizer por meta.
    p.add_argument(
        "--acumulado", required=True, action="append",
        help='"<meta>=<valor>", repetivel. Um valor solto so vale se houver exatamente 1 meta.',
    )
    p.add_argument("--meta", help="restringe a uma meta pelo nome")
    p.add_argument("--movimentos", help="movimentos.csv, para calcular o ritmo real")
    p.add_argument("--hoje", help="AAAA-MM-DD; default = data do sistema")
    args = p.parse_args(argv)

    try:
        hoje = iso(args.hoje, "--hoje") if args.hoje else date.today()
        metas = ler_csv(args.metas, ["meta", "valor_alvo", "data_alvo"], "metas.csv")
        if args.meta:
            metas = [m for m in metas if m["meta"] == args.meta]
            if not metas:
                raise ErroDeEntrada(f"--meta: nenhuma meta chamada {args.meta!r} no arquivo")

        acumulados = resolver_acumulados(args.acumulado, metas)

        ritmo, motivo = (None, "movimentos.csv nao informado")
        if args.movimentos:
            movs = ler_csv(args.movimentos, ["data", "ativo", "operacao", "valor"], "movimentos.csv")
            ritmo, motivo = ritmo_observado(movs, hoje)

        avaliadas = [avaliar(l, acumulados[l["meta"]], ritmo, motivo, hoje) for l in metas]
    except ErroDeEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1

    json.dump(
        {"hoje": hoje.isoformat(), "metas": avaliadas,
         "nota": "projecao usa o ritmo observado, sem premissa de juros; para cenarios com taxa, use juros_compostos.py"},
        sys.stdout, ensure_ascii=False, indent=2,
    )
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
