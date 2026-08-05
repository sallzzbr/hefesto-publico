"""Dinheiro em BRL, sem float. Base compartilhada pelos scripts do hestia.

Por que existe: ate 2026-07-28 toda conta do hestia era feita pelo MODELO lendo prosa do
SKILL.md. Duas execucoes da mesma pergunta podiam dar numeros diferentes, e nada percebia. O
gate que fecha isso e golden test, e golden test so vale sobre funcao pura e deterministica —
por isso os scripts aqui nao leem Drive, nao acessam rede e nao tem estado: CSV entra por
stdin, JSON sai por stdout.

Decisoes que ficam escritas para o golden test nao congelar acidente:

- **Decimal, nunca float.** `0.1 + 0.2 != 0.3` em binario; com dinheiro isso vira divergencia
  de centavos que ninguem rastreia. Aqui todo valor monetario e Decimal do parse ate a saida.
- **Precisao alta no meio, arredondamento so na borda.** A capitalizacao mensal roda com 28
  digitos; o arredondamento para 2 casas acontece uma vez, ao serializar. Arredondar a cada mes
  acumula vies (num horizonte de 20 anos da diferenca visivel).
- **ROUND_HALF_UP**, nao o `ROUND_HALF_EVEN` que e o default do Python. Meio para cima e o que
  o usuario espera de dinheiro no Brasil (e o que a calculadora e o extrato fazem); "banker's
  rounding" surpreende.
- **Saida monetaria como STRING** no JSON. JSON nao tem decimal: numero vira float de 64 bits
  na desserializacao e o valor exato se perde. String preserva o que foi calculado.
"""

from __future__ import annotations

import re
from decimal import Decimal, ROUND_HALF_UP, getcontext

# 28 digitos: folga larga para capitalizacao mensal em horizonte de decadas sem perda visivel.
getcontext().prec = 28

CENTAVO = Decimal("0.01")


class ErroDeEntrada(ValueError):
    """Entrada malformada. Sobe ate o main e vira exit 1 com mensagem, nunca numero inventado."""


def brl(texto: str | Decimal | int, campo: str = "valor") -> Decimal:
    """Converte valor monetario para Decimal, aceitando as formas que aparecem na vida real.

    Aceita `1234,56` (padrao BR nos CSVs), `1234.56`, `1.234,56` (milhar com ponto),
    `R$ 1.234,56` e negativos. Recusa o resto — silenciosamente virar zero seria pior que
    parar, porque zero se propaga como numero legitimo.
    """
    if isinstance(texto, (Decimal, int)):
        return Decimal(texto)

    bruto = (texto or "").strip()
    if not bruto:
        raise ErroDeEntrada(f"{campo}: vazio")

    limpo = bruto.replace("R$", "").replace(" ", "").replace(" ", "")

    # `1.234,56` -> ponto e milhar, virgula e decimal. `1234,56` -> virgula e decimal.
    # `1,234.56` (formato EN) NAO e aceito: seria ambiguo com o BR e o dado do hestia e BR.
    if "," in limpo:
        limpo = limpo.replace(".", "").replace(",", ".")

    if not re.fullmatch(r"-?\d+(\.\d+)?", limpo):
        raise ErroDeEntrada(f"{campo}: {bruto!r} nao e um valor monetario reconhecido")

    return Decimal(limpo)


def taxa(texto: str | Decimal, campo: str = "taxa") -> Decimal:
    """Percentual ao ano para fracao decimal. `8,5` ou `8.5` -> Decimal('0.085')."""
    v = brl(texto, campo)
    if v <= -100:
        raise ErroDeEntrada(f"{campo}: {texto!r} — taxa de -100% ou menos zera o capital")
    return v / Decimal(100)


def mensal_equivalente(taxa_anual: Decimal) -> Decimal:
    """Taxa anual -> mensal EQUIVALENTE (composta), nao proporcional.

    `(1 + a) ** (1/12) - 1`, e nao `a / 12`. A diferenca nao e detalhe: a 12% a.a., a
    equivalente da 0,9489% a.m. e a proporcional da 1% a.m. — em 30 anos de aportes isso
    separa as duas contas em dezenas de milhares. Equivalente e a convencao do mercado
    brasileiro e a unica que fecha com "12% a.a." de fato virando 12% em doze meses.
    """
    return (Decimal(1) + taxa_anual) ** (Decimal(1) / Decimal(12)) - Decimal(1)


def centavos_exatos(bruto: str, campo: str, porque: str) -> Decimal:
    """Como `brl`, mas recusa mais de 2 casas decimais.

    Existe para os valores que vao ser GRAVADOS. Arredondar em silencio um valor de 3 casas faz
    a soma das linhas gravadas divergir do total de origem em centavos que ninguem rastreia
    depois — e quando ha mais de uma linha, cada uma arredonda para o seu lado. Um valor pago
    ou um saldo de extrato tem centavo exato; quem tem casa a mais e preco unitario
    (combustivel) ou quantidade de cota, e esses continuam passando pelo `brl` normal.

    `porque` e a consequencia concreta no contexto de quem chama — a mensagem de erro precisa
    dizer o que estraga, nao so que a regra existe.
    """
    v = brl(bruto, campo)
    if -v.as_tuple().exponent > 2:
        raise ErroDeEntrada(
            f"{campo}: {bruto!r} tem mais de 2 casas decimais. Nao e um valor em centavos, e "
            f"arredondar por conta propria {porque}"
        )
    return v


def arredondar(v: Decimal) -> Decimal:
    return v.quantize(CENTAVO, rounding=ROUND_HALF_UP)


def dinheiro(v: Decimal) -> str:
    """Serializa para o JSON. String, nao float — ver o cabecalho deste arquivo."""
    return str(arredondar(v))


def pct(v: Decimal, casas: str = "0.01") -> str:
    return str((v * Decimal(100)).quantize(Decimal(casas), rounding=ROUND_HALF_UP))
