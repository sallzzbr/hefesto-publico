"""Tributacao de renda fixa: IOF regressivo + IR regressivo. REGRA, nao premissa.

A fronteira que este arquivo encarna, e que vale para todo calculo do hestia:

    valor entra na chamada        (taxa esperada, CDI de hoje, IPCA projetado)
    regra entra no plugin         (como o IR escalona, em que ordem IOF e IR incidem)
    tabela-que-muda-por-lei       (as aliquotas) entra versionada em `tabelas/*.json`

Se a aliquota chegasse como parametro — o modelo dizendo "aqui o IR e 15%" —, a conta teria
voltado para a cabeca do modelo, que e exatamente o que os scripts do hestia existem para
tirar de la. Aliquota errada produz numero plausivel, e numero plausivel e errado nao levanta
suspeita de ninguem.

SIMPLIFICACAO CONHECIDA no IOF: o Decreto 6.306/2007 define o imposto como 1% ao dia sobre o
valor do RESGATE, **limitado** ao percentual do rendimento da tabela regressiva. Aqui so o
limitador esta implementado. Em renda fixa o limitador sempre morde — o outro lado exigiria
rendimento acima de ~1% ao dia —, entao nao ha erro numerico na pratica; mas o modulo se
apresenta como "a regra mora no plugin" e codifica metade dela. Dito para nao se enganar.

ORDEM DE INCIDENCIA, que importa e e facil de inverter: o IOF incide sobre o rendimento BRUTO,
e o IR incide sobre o que SOBRA depois do IOF. Inverter da um valor menor de imposto, plausivel
e errado. Ha golden test travando essa ordem.

O QUE ESTE MODULO SE RECUSA A FAZER, e por que a recusa e o comportamento correto:

- **fundo de investimento**: come-cotas antecipa IR em maio e novembro, e a apuracao no resgate
  depende do que ja foi comido antes. Esse historico nao esta na entrada. Estimar daria numero
  plausivel e errado.
- **acoes**: a isencao mensal (vendas ate R$ 20 mil no mes) depende do TOTAL vendido naquele
  mes, nao da operacao isolada; e day trade tem aliquota propria. Nada disso esta na entrada.

Nos dois casos o script para com mensagem dizendo o que faltaria. Script que nao sabe e
aproxima e a fabrica de erro silencioso que este repo passou a semana fechando.
"""

from __future__ import annotations

import json
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from brl import ErroDeEntrada

TABELAS = Path(__file__).resolve().parent.parent / "tabelas"

# Regimes que este modulo sabe calcular, e os que ele reconhece mas recusa. Reconhecer e
# recusar e diferente de nao conhecer: a mensagem muda, e o usuario descobre que o caso existe.
# DOIS EIXOS, nao um. Colapsar "isento de IR" em "isento de tudo" foi erro conceitual da
# primeira versao: IR e IOF sao impostos DIFERENTES, com regras diferentes. LCI e isenta de IR
# — nao de IOF. Achado do Codex, e o tipo de engano que produz numero exato e errado.
#
# `iof: "incerto"` e uma terceira posicao deliberada. Para renda fixa comum a tabela e clara;
# para LCI/LCA/CRI/CRA/debenture ha divergencia de fonte sobre a incidencia dentro dos 30 dias,
# e eu nao tenho como resolver isso com confianca. Entao: acima de 30 dias o IOF e zero para
# todo mundo e nao ha ambiguidade; ABAIXO de 30 dias o modulo RECUSA. E a mesma politica do
# come-cotas — quando nao sei, paro, em vez de emitir numero plausivel.
REGIMES = {
    "renda-fixa":            {"ir": "regressivo", "iof": "regressivo"},
    "cdb":                   {"ir": "regressivo", "iof": "regressivo"},
    "tesouro":               {"ir": "regressivo", "iof": "regressivo"},
    "lc":                    {"ir": "regressivo", "iof": "regressivo"},
    "debenture":             {"ir": "regressivo", "iof": "incerto"},
    "lci":                   {"ir": "isento",     "iof": "incerto"},
    "lca":                   {"ir": "isento",     "iof": "incerto"},
    "cri":                   {"ir": "isento",     "iof": "incerto"},
    "cra":                   {"ir": "isento",     "iof": "incerto"},
    "debenture-incentivada": {"ir": "isento",     "iof": "incerto"},
    "isento":                {"ir": "isento",     "iof": "incerto"},
    # Poupanca nao entra na tabela de IOF de renda fixa nem paga IR para PF.
    "poupanca":              {"ir": "isento",     "iof": "isento"},
}
TRIBUTADOS = {k for k, v in REGIMES.items() if v["ir"] == "regressivo"}
ISENTOS = {k for k, v in REGIMES.items() if v["ir"] == "isento"}
RECUSADOS = {
    "fundo": (
        "fundo tem come-cotas (IR antecipado em maio e novembro) e a apuracao no resgate "
        "depende do que ja foi antecipado — historico que nao esta na entrada"
    ),
    "acoes": (
        "acoes tem isencao por volume VENDIDO no mes (ate R$ 20 mil) e aliquota propria de "
        "day trade — nenhum dos dois cabe numa operacao isolada"
    ),
    "fii": (
        "FII tem regra propria (rendimento isento para PF sob condicoes, ganho de capital "
        "tributado a 20% sem isencao por volume)"
    ),
    "previdencia": (
        "previdencia (PGBL/VGBL) tem tabela regressiva PROPRIA, de 35% a 10% por prazo "
        "(Lei 11.053/2004), e opcao pela tabela progressiva — nao e a tabela de renda fixa"
    ),
    "etf-renda-fixa": (
        "ETF de renda fixa tem faixas proprias de 25/20/15% por prazo medio da carteira "
        "(Lei 13.043/2014), nao pelo prazo da sua aplicacao"
    ),
}
# Aliases: quem escreve "pgbl" merece a recusa NOMEADA, nao o balde de "desconhecido".
RECUSADOS["pgbl"] = RECUSADOS["vgbl"] = RECUSADOS["previdencia"]
RECUSADOS["etf-rf"] = RECUSADOS["etf-renda-fixa"]


@lru_cache(maxsize=None)
def _carregar(nome: str) -> dict:
    """Cacheado: sem isso o JSON era relido e reparseado a cada consulta de aliquota — com 60
    tranches sao ~120 leituras de disco por cenario. Achado da revisao."""
    caminho = TABELAS / nome
    if not caminho.is_file():
        raise ErroDeEntrada(f"tabela {nome} nao encontrada em {TABELAS}")
    return json.loads(caminho.read_text(encoding="utf-8"))


def aliquota_ir(dias: int) -> Decimal:
    """Faixa regressiva pela idade do dinheiro. Le a tabela versionada, nao hardcode."""
    if dias < 0:
        raise ErroDeEntrada(f"dias: {dias} — idade nao pode ser negativa")
    for faixa in _carregar("ir_regressivo.json")["faixas"]:
        ate = faixa["ate_dias"]
        if ate is None or dias <= ate:
            return Decimal(faixa["aliquota_pct"]) / Decimal(100)
    raise ErroDeEntrada("tabela de IR sem faixa final (`ate_dias: null`) — tabela invalida")


def aliquota_iof(dias: int) -> Decimal:
    """% do rendimento retido por IOF. Zero a partir do 30o dia."""
    if dias < 0:
        raise ErroDeEntrada(f"dias: {dias} — idade nao pode ser negativa")
    tab = _carregar("iof_regressivo.json")
    if dias >= tab["zera_a_partir_de_dias"]:
        return Decimal(0)
    # Dia 0 (resgate no mesmo dia) usa a aliquota do dia 1: e o maximo da tabela.
    chave = str(max(1, dias))
    if chave not in tab["por_dia_pct"]:
        raise ErroDeEntrada(f"tabela de IOF sem entrada para o dia {chave}")
    return Decimal(tab["por_dia_pct"][chave]) / Decimal(100)


def validar_regime(regime: str) -> str:
    """Normaliza e VALIDA o regime, isolado de qualquer calculo.

    Existe porque a recusa era contornavel: quem chamava `tributar()` dentro de um laco sobre
    tranches nunca validava nada quando o laco saia vazio (capital zero, ou prazo de 1 mes), e
    um regime recusado como `fundo` passava com imposto 0,00. A validacao nao pode depender de
    haver o que calcular — achado bloqueante da revisao adversarial.
    """
    r = (regime or "").strip().lower()
    if r in RECUSADOS:
        raise ErroDeEntrada(
            f"tributacao '{r}' nao implementada: {RECUSADOS[r]}. "
            f"Este script prefere parar a estimar — numero plausivel e errado e pior que "
            f"numero ausente. Regimes suportados: {', '.join(sorted(TRIBUTADOS | ISENTOS))}."
        )
    if r not in TRIBUTADOS and r not in ISENTOS:
        raise ErroDeEntrada(
            f"tributacao '{r}' desconhecida. Suportados: "
            f"{', '.join(sorted(TRIBUTADOS | ISENTOS))}. Reconhecidos mas nao implementados: "
            f"{', '.join(sorted(set(RECUSADOS)))}."
        )
    return r


def tributar(rendimento: Decimal, dias: int, regime: str) -> dict:
    """Aplica IOF e depois IR sobre um rendimento de idade conhecida.

    Devolve os componentes separados de proposito: quem le precisa poder conferir a conta, e
    um `liquido` sozinho esconde onde o dinheiro foi.
    """
    r = validar_regime(regime)
    if dias < 0:
        raise ErroDeEntrada(f"dias: {dias} — idade nao pode ser negativa")
    if dias == 0 and rendimento > 0:
        # Rendimento positivo com prazo zero e entrada contraditoria. A versao anterior usava
        # `max(1, dias)` e cobrava os 96% do dia 1 — inventava aliquota para uma situacao que a
        # tabela nao descreve. Achado do Codex.
        raise ErroDeEntrada(
            "dias: 0 com rendimento positivo — aporte e resgate na mesma data nao rendem. "
            "Informe o prazo real em dias."
        )

    regra = REGIMES[r]

    def _base_zerada(observacao: str) -> dict:
        return {
            "regime": r, "dias": dias,
            "rendimento_bruto": rendimento,
            "iof": Decimal(0), "aliquota_iof_pct": Decimal(0),
            "base_ir": Decimal(0),
            "ir": Decimal(0), "aliquota_ir_pct": Decimal(0),
            "rendimento_liquido": rendimento,
            "observacao": observacao,
        }

    if rendimento <= 0:
        # Prejuizo ou rendimento zero nao geram imposto, em nenhum regime.
        return _base_zerada("sem rendimento positivo, nao ha base tributavel")

    # --- eixo IOF ---
    if regra["iof"] == "isento":
        a_iof = Decimal(0)
    elif regra["iof"] == "incerto" and dias < 30:
        raise ErroDeEntrada(
            f"tributacao '{r}' com {dias} dias: a incidencia de IOF nesse regime dentro dos "
            f"primeiros 30 dias nao esta modelada com confianca, e chutar produziria numero "
            f"exato e errado. Acima de 30 dias o IOF e zero e o calculo e seguro. "
            f"(A isencao de {r} e de IR; IOF e outro imposto, com outra regra.)"
        )
    else:
        a_iof = aliquota_iof(dias)

    iof = rendimento * a_iof

    # --- eixo IR ---
    if regra["ir"] == "isento":
        resultado = _base_zerada("regime isento de IR para pessoa fisica")
        resultado["iof"] = iof
        resultado["aliquota_iof_pct"] = a_iof * Decimal(100)
        resultado["rendimento_liquido"] = rendimento - iof
        return resultado

    base_ir = rendimento - iof          # <- a ordem que o golden test trava
    a_ir = aliquota_ir(dias)
    imposto = base_ir * a_ir

    return {
        "regime": r, "dias": dias,
        "rendimento_bruto": rendimento,
        "iof": iof, "aliquota_iof_pct": a_iof * Decimal(100),
        "base_ir": base_ir,
        "ir": imposto, "aliquota_ir_pct": a_ir * Decimal(100),
        "rendimento_liquido": rendimento - iof - imposto,
    }
