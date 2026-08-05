#!/usr/bin/env python3
"""Simulacao de juros compostos com aportes mensais — os dois sentidos da skill `simular`.

    projecao: aportando X/mes a Y% a.a. por N meses, chego em quanto?
    objetivo: para chegar em W em N meses, preciso aportar quanto por mes?

Convencoes fixadas aqui, porque simulacao sem premissa explicita e chute com cara de conta:

- **Aporte POSTECIPADO** (fim de cada mes). E o caso real de quem investe o que sobra do mes.
  Antecipado renderia um mes a mais de juros em cada aporte e inflaria o resultado.
- **Taxa mensal EQUIVALENTE**, nao proporcional (ver `brl.mensal_equivalente`).
- **Tres cenarios sempre**, porque a skill exige — e as taxas vem de FORA, do usuario. Este
  script nao tem taxa default de proposito: premissa e decisao humana, e embutir um numero
  aqui seria a IA prevendo mercado, que o guardrail do hestia proibe.

Uso:
    juros_compostos.py projecao --inicial 10000 --aporte 800 --meses 60 --taxas 8,10,12
    juros_compostos.py objetivo --inicial 10000 --alvo 30000 --meses 60 --taxas 8,10,12

Saida: JSON em stdout. Erro: mensagem em stderr e exit 1 — nunca numero inventado.
"""

from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal

from brl import ErroDeEntrada, brl, dinheiro, mensal_equivalente, pct, taxa

NOMES = ["conservador", "base", "otimista"]


def montante(inicial: Decimal, aporte: Decimal, i: Decimal, n: int) -> Decimal:
    """Valor futuro: capital inicial capitalizado + serie de aportes postecipados.

    FV = P*(1+i)^n + PMT * ((1+i)^n - 1) / i   — com o caso i=0 tratado a parte, senao divide
    por zero. Taxa zero e cenario legitimo ("e se nao render nada?").
    """
    fator = (Decimal(1) + i) ** n
    if i == 0:
        return inicial + aporte * n
    return inicial * fator + aporte * (fator - Decimal(1)) / i


def aporte_necessario(inicial: Decimal, alvo: Decimal, i: Decimal, n: int) -> Decimal:
    """Inverte `montante` para PMT. Devolve 0 quando o capital inicial ja chega sozinho."""
    fator = (Decimal(1) + i) ** n
    if i == 0:
        falta = alvo - inicial
        return max(Decimal(0), falta / n)
    falta = alvo - inicial * fator
    if falta <= 0:
        return Decimal(0)
    return falta * i / (fator - Decimal(1))


def cenarios(taxas: list[Decimal]) -> list[tuple[str, Decimal]]:
    """Rotula as taxas. Ordena por valor para o rotulo nao mentir se vierem fora de ordem."""
    ordenadas = sorted(taxas)
    if len(ordenadas) == 3:
        return list(zip(NOMES, ordenadas))
    return [(f"cenario_{n + 1}", t) for n, t in enumerate(ordenadas)]


# 365/12, nao 30. Com 30 dias/mes o vies NAO era aleatorio: empurrava todo prazo natural para a
# faixa PIOR, sempre contra o usuario. 6 meses (~182d) caiam em 180 -> 22,5% em vez de 20%; 12
# meses (~365d) caiam em 360 -> 20% em vez de 17,5%; 24 meses (~730d) caiam em 720 -> 17,5% em
# vez de 15%. Num CDB de 12 meses com R$ 12.000 de rendimento isso era R$ 300 a mais de imposto,
# 14% de erro, sempre na mesma direcao. Achado da revisao adversarial.
# Continua sendo aproximacao — o calculo real usa dias corridos entre datas, com meses de
# tamanho diferente e ano bissexto — mas agora sem vies sistematico.
DIAS_POR_MES = Decimal(365) / Decimal(12)


def idade_em_dias(meses: int) -> int:
    return int(Decimal(meses) * DIAS_POR_MES)


def tributar_por_tranche(inicial: Decimal, aporte: Decimal, i: Decimal, n: int, regime: str) -> dict:
    """IR pela idade de CADA aporte, nao pela idade media — e o que a skill descreve.

    Cada aporte mensal envelhece diferente: o do mes 1 fica n-1 meses aplicado e pode cair na
    faixa de 15%, enquanto o do penultimo mes fica 1 mes e paga 22,5% + IOF. Tratar o bolo como
    uma coisa so erraria para menos, de forma plausivel.

    SIMPLIFICACAO DECLARADA: a idade vem em meses e vira dias por `meses * 30`. O calculo real
    usa dias corridos entre a data de cada aporte e a do resgate, que dependem do calendario.
    Isso pode deslocar um aporte que esta na fronteira de uma faixa (180, 360, 720 dias). Esta
    dito na saida, porque simplificacao nao declarada e mentira.
    """
    from ir import tributar, validar_regime

    # Valida ANTES do laco. A recusa nao pode depender de existir tranche: com capital zero ou
    # prazo de 1 mes a lista sai vazia, `tributar()` nunca era chamado, e um regime recusado
    # como `fundo` passava com imposto 0,00 e exit 0 — a recusa contornada pelo caminho feliz.
    # Achado BLOQUEANTE da revisao adversarial.
    validar_regime(regime)

    tranches = []
    # Capital inicial: envelhece o periodo inteiro.
    if inicial > 0:
        rend = inicial * ((Decimal(1) + i) ** n - Decimal(1))
        tranches.append((rend, idade_em_dias(n)))
    # Aporte do mes k (k = 1..n), postecipado: rende por (n - k) meses.
    for k in range(1, n + 1):
        meses = n - k
        if aporte > 0 and meses > 0:
            rend = aporte * ((Decimal(1) + i) ** meses - Decimal(1))
            tranches.append((rend, idade_em_dias(meses)))

    total_iof = total_ir = Decimal(0)
    for rend, dias in tranches:
        t = tributar(rend, dias, regime)
        total_iof += t["iof"]
        total_ir += t["ir"]
    # NOTA: `total_iof` e sempre zero por construcao neste caminho — a tranche mais nova tem
    # 1 mes (~30 dias) e o IOF ja zerou no 30o dia. A soma fica porque `tributar` e a regra
    # geral e o IOF vale quando ela e usada com idades menores (ha teste direto em test_ir.py);
    # aqui ela e estruturalmente inalcancavel, e dizer isso e melhor que parecer codigo morto.
    return {"iof": total_iof, "ir": total_ir, "tranches": len(tranches)}


def projetar(args) -> dict:
    inicial, aporte = brl(args.inicial, "inicial"), brl(args.aporte, "aporte")
    n = args.meses
    saida = []
    for nome, a in cenarios([taxa(t, "taxa") for t in args.taxas.split(",")]):
        i = mensal_equivalente(a)
        fv = montante(inicial, aporte, i, n)
        aportado = inicial + aporte * n
        item = {
            "cenario": nome,
            "taxa_anual_pct": pct(a),
            "taxa_mensal_equivalente_pct": pct(i, "0.0001"),
            # BRUTO no nome, sempre. A versao anterior chamava isto de `montante_final` e nao
            # dizia que era bruto — quem lesse para um CDB veria um numero que nunca vai
            # receber. Omissao com cara de resultado.
            "montante_final_bruto": dinheiro(fv),
            "total_aportado": dinheiro(aportado),
            "rendimento_bruto": dinheiro(fv - aportado),
        }
        if args.tributacao:
            t = tributar_por_tranche(inicial, aporte, i, n, args.tributacao)
            item["imposto"] = {
                "regime": args.tributacao,
                "iof": dinheiro(t["iof"]),
                "ir": dinheiro(t["ir"]),
                "total": dinheiro(t["iof"] + t["ir"]),
                "tranches_tributadas": t["tranches"],
                "criterio": "IR pela idade de CADA aporte; IOF antes do IR",
                "simplificacao": (
                    "idade convertida por 365/12 dias/mes; o calculo real usa dias corridos "
                    "entre a data de cada aporte e a do resgate"
                ),
                "iof_inalcancavel_aqui": (
                    "a tranche mais nova tem ~30 dias, e o IOF ja zerou no 30o dia"
                ),
            }
            item["montante_final_liquido"] = dinheiro(fv - t["iof"] - t["ir"])
        else:
            item["montante_final_liquido"] = None
            item["nota_tributacao"] = (
                "NENHUM imposto aplicado. Para CDB, Tesouro ou debenture o valor recebido sera "
                "MENOR que o bruto acima — passe --tributacao para calcular."
            )
        saida.append(item)
    return {
        "modo": "projecao",
        "premissas": {
            "capital_inicial": dinheiro(inicial),
            "aporte_mensal": dinheiro(aporte),
            "meses": n,
            "regime": "aporte postecipado (fim do mes), taxa mensal equivalente",
        },
        "cenarios": saida,
        "aviso": "Simulacao e hipotese, nao promessa. Rentabilidade passada nao garante futura.",
    }


def objetivar(args) -> dict:
    # `--tributacao` era ACEITO e IGNORADO aqui: mesmo flag, mesmo script, comportamento oposto
    # conforme o subcomando — e o SKILL.md afirmava a recusa sem ressalva. Recusar explicitamente
    # e melhor que fingir: calcular o aporte que atinge o alvo LIQUIDO exige saber quando o
    # resgate acontece (a idade de cada aporte no saque), que nao esta na entrada. Achado
    # BLOQUEANTE da revisao adversarial.
    if args.tributacao:
        raise ErroDeEntrada(
            "--tributacao nao se aplica ao modo `objetivo`: o aporte calculado leva ao alvo "
            "BRUTO, e chegar ao alvo LIQUIDO exigiria saber a data do resgate para envelhecer "
            "cada aporte. Rode sem o flag e depois confira o liquido com "
            "`projecao --tributacao <regime>`."
        )
    inicial, alvo = brl(args.inicial, "inicial"), brl(args.alvo, "alvo")
    n = args.meses
    saida = []
    for nome, a in cenarios([taxa(t, "taxa") for t in args.taxas.split(",")]):
        i = mensal_equivalente(a)
        pmt = aporte_necessario(inicial, alvo, i, n)
        item = {
            "cenario": nome,
            "taxa_anual_pct": pct(a),
            "taxa_mensal_equivalente_pct": pct(i, "0.0001"),
            "aporte_mensal_necessario_bruto": dinheiro(pmt),
        }
        if pmt == 0:
            item["observacao"] = (
                "o capital inicial ja atinge o alvo no prazo sem aporte novo"
            )
        saida.append(item)
    return {
        "modo": "objetivo",
        "premissas": {
            "capital_inicial": dinheiro(inicial),
            "valor_alvo": dinheiro(alvo),
            "meses": n,
            "regime": "aporte postecipado (fim do mes), taxa mensal equivalente",
        },
        "cenarios": saida,
        "nota_tributacao": (
            "O aporte acima leva ao alvo BRUTO. Em regime tributado o valor liquido no resgate "
            "sera menor, entao o aporte real precisa ser maior — calcular isso exige saber a "
            "idade de cada aporte no resgate, que depende de quando voce saca."
        ),
        "aviso": "Simulacao e hipotese, nao promessa. Rentabilidade passada nao garante futura.",
    }


def montar_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="modo", required=True)

    def comuns(sp):
        sp.add_argument("--inicial", default="0", help="capital inicial (default 0)")
        sp.add_argument("--meses", type=int, required=True)
        sp.add_argument("--taxas", required=True, help="taxas a.a. separadas por virgula: 8,10,12")
        # Sem default: nao aplicar imposto e uma ESCOLHA que precisa ser visivel, e o resultado
        # sem `--tributacao` vem rotulado como bruto com aviso. Um default silencioso (nem
        # "isento" nem "renda-fixa") faria o script decidir tributacao no lugar do usuario.
        sp.add_argument("--tributacao", help="renda-fixa | cdb | tesouro | debenture | isento | lci | lca | poupanca")

    pr = sub.add_parser("projecao")
    comuns(pr)
    pr.add_argument("--aporte", required=True)

    ob = sub.add_parser("objetivo")
    comuns(ob)
    ob.add_argument("--alvo", required=True)

    return p


def main(argv=None) -> int:
    args = montar_parser().parse_args(argv)
    try:
        if args.meses <= 0:
            raise ErroDeEntrada("meses: precisa ser positivo")
        if not args.taxas.strip():
            raise ErroDeEntrada("taxas: precisa de ao menos uma taxa a.a.")
        resultado = projetar(args) if args.modo == "projecao" else objetivar(args)
    except ErroDeEntrada as e:
        print(f"ERRO: {e}", file=sys.stderr)
        return 1
    json.dump(resultado, sys.stdout, ensure_ascii=False, indent=2)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
