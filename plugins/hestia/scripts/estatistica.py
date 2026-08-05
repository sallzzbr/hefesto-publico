"""Media e desvio das analises do hestia. Uma definicao so, usada por `mercado` e `gastos`.

Nasceu dentro do `mercado.py`. Saiu de la quando o `gastos.py` precisou da MESMA regra: duas
copias da mesma formula estatistica e a forma mais barata de as duas divergirem sem ninguem ver
— e o hestia inteiro existe para nao ter conta que diverge em silencio.

**Desvio AMOSTRAL (n-1), nao populacional.** O historico do usuario e uma AMOSTRA do habito,
nao a populacao inteira de meses/compras que ele viveria. Com n=3 e valores 3, 3, 6, o amostral
da 1,73 e o populacional da 1,41 — e o populacional produz limite mais baixo, ou seja, acusa
"fora do padrao" com mais facilidade. Num habito de compra isso e falso positivo, e falso
positivo em analise de gasto ensina o usuario a ignorar a analise.

Tudo em Decimal, como o resto do hestia: ver o cabecalho do `brl.py`.
"""

from __future__ import annotations

from decimal import Decimal

from brl import ErroDeEntrada


def media(vals: list[Decimal]) -> Decimal:
    if not vals:
        raise ErroDeEntrada("media de lista vazia — nao ha base para uma media")
    return sum(vals, Decimal(0)) / Decimal(len(vals))


def desvio_amostral(vals: list[Decimal]) -> Decimal:
    """Raiz da variancia com n-1.

    O guarda de n >= 2 esta aqui, e nao so em quem chama, porque o modo de falha e feio: com
    n = 1 o divisor n-1 e zero e o Decimal levanta `DivisionByZero`, que sobe como traceback
    em vez do exit 1 com mensagem que os scripts do hestia prometem. Cada chamador tem o seu
    minimo (3 compras no `mercado`, 2 meses de base no `gastos`); este e o piso do piso.
    """
    if len(vals) < 2:
        raise ErroDeEntrada(
            f"desvio amostral exige pelo menos 2 valores; vieram {len(vals)}. Com um valor so "
            f"nao existe dispersao a medir, e devolver 0 afirmaria 'sem variacao'."
        )
    m = media(vals)
    var = sum(((v - m) ** 2 for v in vals), Decimal(0)) / Decimal(len(vals) - 1)
    return var.sqrt()
