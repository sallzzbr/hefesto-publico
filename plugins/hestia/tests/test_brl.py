"""Leitura de dinheiro: as formas aceitas, as recusadas, e a que enganava.

O caso que motivou o arquivo: `brl("R$ 1.500")` devolvia `Decimal("1.500")` — um real e
cinquenta — porque o ponto so era tratado como milhar quando havia virgula. O docstring
prometia "1.234,56 (milhar com ponto)" e a entrada sem centavos escapava da promessa. Chega
pela CLI do juros_compostos (`--inicial "R$ 1.500"`), que recebe texto do usuario ou do modelo.
Zero se propaga como numero legitimo; 1,50 no lugar de 1.500 tambem.
"""

from __future__ import annotations

import sys
from decimal import Decimal
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from brl import ErroDeEntrada, brl, centavos_exatos, dinheiro, taxa  # noqa: E402


@pytest.mark.parametrize("texto,esperado", [
    ("1234,56", "1234.56"),        # padrao BR dos CSVs
    ("1.234,56", "1234.56"),       # milhar com ponto + virgula
    ("R$ 1.234,56", "1234.56"),
    ("R$ 1.500", "1500"),          # milhar com ponto SEM centavos — era lido como 1,50
    ("1.500", "1500"),
    ("12.345", "12345"),
    ("1.234.567", "1234567"),
    ("-1.500", "-1500"),
    ("1234.56", "1234.56"),        # ponto decimal (2 casas): nao e milhar
    ("1.5", "1.5"),                # ponto decimal (1 casa): nao e milhar
    ("0.500", "0.500"),            # grupo inicial zero nao e milhar: e quantidade (0,5 kg)
    ("1500", "1500"),
    ("-42,10", "-42.10"),
])
def test_brl_le_as_formas_reais(texto: str, esperado: str) -> None:
    assert brl(texto) == Decimal(esperado)


@pytest.mark.parametrize("texto", ["", "   ", "abc", "1,234.56", "1.23.4", "R$"])
def test_brl_recusa_o_que_nao_reconhece(texto: str) -> None:
    # `1,234.56` (EN) e ambiguo com o BR — o docstring ja prometia recusar, e o codigo lia
    # como 1234,56 por acidente da ordem dos replaces. Melhor parar do que inventar.
    with pytest.raises(ErroDeEntrada):
        brl(texto)


def test_brl_aceita_decimal_e_int_sem_reconverter() -> None:
    assert brl(Decimal("10.50")) == Decimal("10.50")
    assert brl(7) == Decimal(7)


def test_dinheiro_serializa_o_milhar_lido_com_duas_casas() -> None:
    assert dinheiro(brl("R$ 1.500")) == "1500.00"


def test_centavos_exatos_aceita_milhar_e_recusa_tres_casas() -> None:
    assert centavos_exatos("1.500", "valor", "estraga a soma") == Decimal("1500")
    with pytest.raises(ErroDeEntrada):
        centavos_exatos("10,505", "valor", "estraga a soma")


def test_taxa_converte_percentual_e_recusa_menos_cem() -> None:
    assert taxa("8,5") == Decimal("0.085")
    with pytest.raises(ErroDeEntrada):
        taxa("-100")
