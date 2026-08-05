"""Tributacao: faixas de IR, degraus de IOF, isentos e as recusas.

Estes testes sao a razao de a tabela morar em `tabelas/*.json` versionado e nao no codigo nem
num parametro. Se a aliquota chegasse na chamada, nao haveria o que testar: o gate estaria na
cabeca de quem monta a chamada.

As FRONTEIRAS sao o alvo principal. Faixa de IR muda em 180, 360 e 720 dias, e erro de um dia
para cada lado (`<` em vez de `<=`) e o classico que ninguem ve: produz aliquota vizinha, valor
plausivel, diferenca de centenas de reais.
"""

from __future__ import annotations

import json as json_mod
import sys
from decimal import Decimal
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from brl import ErroDeEntrada  # noqa: E402
from ir import aliquota_ir, aliquota_iof, tributar  # noqa: E402


def d(x: str) -> Decimal:
    return Decimal(x)


# --- IR: as faixas e, sobretudo, as fronteiras ---------------------------------------------

@pytest.mark.parametrize("dias,esperado", [
    (0, "22.5"), (1, "22.5"), (179, "22.5"),
    (180, "22.5"),   # fronteira: 180 AINDA e 22,5% ("ate 180 dias")
    (181, "20.0"),   # so a partir do 181 cai
    (359, "20.0"), (360, "20.0"), (361, "17.5"),
    (719, "17.5"), (720, "17.5"), (721, "15.0"),
    (3650, "15.0"),
])
def test_faixas_de_ir_e_fronteiras(dias, esperado):
    assert aliquota_ir(dias) * 100 == d(esperado)


def test_dias_negativos_param():
    with pytest.raises(ErroDeEntrada):
        aliquota_ir(-1)


# --- IOF: degraus e o corte no 30o dia -----------------------------------------------------

@pytest.mark.parametrize("dias,esperado", [
    (0, "96"),    # resgate no mesmo dia usa o topo da tabela
    (1, "96"), (2, "93"), (15, "50"), (29, "3"),
    (30, "0"),    # fronteira: a partir do 30o dia, zero
    (31, "0"), (365, "0"),
])
def test_degraus_de_iof(dias, esperado):
    assert aliquota_iof(dias) * 100 == d(esperado)


# --- a ordem de incidencia -----------------------------------------------------------------

def test_iof_incide_antes_do_ir():
    """Inverter a ordem da imposto MENOR e plausivel. Este teste trava a ordem correta.

    Rendimento 1000, 10 dias: IOF 66% = 660; base do IR = 340; IR 22,5% = 76,50.
    Se o IR viesse primeiro (225) e o IOF sobre o resto, o total seria outro.
    """
    t = tributar(d("1000"), 10, "cdb")
    assert t["iof"] == d("660.0")
    assert t["base_ir"] == d("340.0")
    assert t["ir"] == d("76.500")
    assert t["rendimento_liquido"] == d("263.500")


def test_longo_prazo_sem_iof():
    """721 dias: IOF zero, IR 15% sobre o rendimento cheio."""
    t = tributar(d("1000"), 721, "cdb")
    assert t["iof"] == 0
    assert t["ir"] == d("150.00")
    assert t["rendimento_liquido"] == d("850.00")


# --- isentos e casos sem base --------------------------------------------------------------

@pytest.mark.parametrize("regime", ["isento", "lci", "lca", "poupanca", "cri", "cra"])
def test_isentos_de_ir_nao_pagam_ir(regime):
    """Acima de 30 dias o IOF e zero para todos, entao o liquido e o bruto."""
    t = tributar(d("1000"), 400, regime)
    assert t["ir"] == 0 and t["iof"] == 0
    assert t["rendimento_liquido"] == d("1000")


@pytest.mark.parametrize("regime", ["lci", "lca", "cri", "cra", "debenture", "isento"])
def test_isencao_de_ir_nao_e_isencao_de_iof(regime):
    """ERRO CONCEITUAL da primeira versao: "isento" virou isento de TUDO, e LCI em 10 dias saia
    com liquido igual ao bruto. IR e IOF sao impostos DIFERENTES. Onde a incidencia dentro dos
    30 dias nao esta modelada com confianca, o modulo recusa em vez de chutar."""
    with pytest.raises(ErroDeEntrada) as e:
        tributar(d("1000"), 10, regime)
    assert "IOF" in str(e.value)


def test_poupanca_e_isenta_dos_dois():
    """Unico regime marcado isento nos dois eixos — nao entra na tabela de IOF de renda fixa."""
    t = tributar(d("1000"), 10, "poupanca")
    assert t["iof"] == 0 and t["ir"] == 0
    assert t["rendimento_liquido"] == d("1000")


def test_dia_zero_com_rendimento_positivo_recusa():
    """Antes, `max(1, dias)` cobrava os 96% do dia 1 — inventava aliquota para uma situacao que
    a tabela nao descreve. Achado do Codex."""
    with pytest.raises(ErroDeEntrada) as e:
        tributar(d("1000"), 0, "cdb")
    assert "mesma data" in str(e.value)


def test_isento_tambem_valida_dias():
    """Antes, o branch isento retornava antes de qualquer validacao: `tributar(1000, -50, "lci")`
    devolvia resultado com dias negativo sem reclamar."""
    with pytest.raises(ErroDeEntrada):
        tributar(d("1000"), -50, "lci")


def test_shape_consistente_entre_regimes():
    """`base_ir` existia so no retorno tributado; consumidor que o lesse quebrava conforme o
    regime."""
    chaves = {frozenset(tributar(d("1000"), 400, r)) for r in ("cdb", "lci")}
    chaves |= {frozenset(tributar(d("-1"), 400, "cdb"))}
    campos_comuns = {"regime", "dias", "rendimento_bruto", "iof", "ir", "base_ir", "rendimento_liquido"}
    for c in chaves:
        assert campos_comuns <= set(c), f"faltam campos: {campos_comuns - set(c)}"


def test_prejuizo_nao_gera_imposto_negativo():
    t = tributar(d("-500"), 400, "cdb")
    assert t["ir"] == 0 and t["iof"] == 0
    assert t["rendimento_liquido"] == d("-500")


# --- as recusas, que sao o comportamento correto -------------------------------------------

@pytest.mark.parametrize("regime,pista", [
    ("fundo", "come-cotas"),
    ("acoes", "20 mil"),
    ("fii", "20%"),
    ("pgbl", "35%"),
    ("vgbl", "Lei 11.053"),
    ("etf-rf", "prazo medio"),
])
def test_regime_reconhecido_mas_nao_implementado_recusa(regime, pista):
    """Recusar e o certo: come-cotas e isencao por volume dependem de dado que nao esta na
    entrada, e estimar produziria numero plausivel e errado."""
    with pytest.raises(ErroDeEntrada) as e:
        tributar(d("1000"), 400, regime)
    assert pista in str(e.value)
    assert "nao implementada" in str(e.value)


def test_regime_desconhecido_recusa_e_lista_os_validos():
    with pytest.raises(ErroDeEntrada) as e:
        tributar(d("1000"), 400, "cripto")
    msg = str(e.value)
    assert "desconhecida" in msg and "lci" in msg and "fundo" in msg


# --- a tabela e a fonte da verdade, nao o codigo -------------------------------------------

def test_a_tabela_e_mesmo_lida_e_nao_ha_aliquota_hardcoded(tmp_path, monkeypatch):
    """PROVA que `aliquota_ir` le o JSON, trocando o JSON e exigindo que a resposta mude.

    A versao anterior deste arquivo tinha um teste cujo docstring afirmava cobrir isso e NAO
    cobria: hardcodar as faixas dentro do `ir.py` deixava a suite inteira verde. A revisao
    adversarial provou por mutacao. Teste que afirma o que nao faz e pior que teste ausente,
    porque desliga a desconfianca.
    """
    import ir as mod

    tabelas = tmp_path / "tabelas"
    tabelas.mkdir()
    (tabelas / "ir_regressivo.json").write_text(json_mod.dumps({
        "vigencia_inicio": "2099-01-01", "fonte": "tabela ficticia de teste",
        "faixas": [{"ate_dias": 100, "aliquota_pct": "99.0"},
                   {"ate_dias": None, "aliquota_pct": "1.0"}],
    }), encoding="utf-8")

    monkeypatch.setattr(mod, "TABELAS", tabelas)
    mod._carregar.cache_clear()
    try:
        assert aliquota_ir(50) * 100 == d("99.0"), (
            "aliquota nao mudou ao trocar a tabela — logo ela NAO vem do JSON, e a alegacao "
            "central do modulo ('a regra mora em tabela versionada') e falsa"
        )
        assert aliquota_ir(500) * 100 == d("1.0")
    finally:
        mod._carregar.cache_clear()


def test_estrutura_da_tabela_de_ir():
    """A tabela precisa ter as 4 faixas e terminar aberta, senao ha prazo sem aliquota."""
    tab = json_mod.loads(
        (Path(__file__).resolve().parent.parent / "tabelas" / "ir_regressivo.json").read_text()
    )
    faixas = tab["faixas"]
    assert len(faixas) == 4, "a tabela regressiva de renda fixa tem 4 faixas"
    assert faixas[-1]["ate_dias"] is None, (
        "a ultima faixa precisa ser aberta (`ate_dias: null`), senao existe prazo sem aliquota "
        "e o aliquota_ir levanta erro em vez de tributar"
    )
    assert [f["aliquota_pct"] for f in faixas] == ["22.5", "20.0", "17.5", "15.0"]
    assert tab.get("fonte"), "tabela de lei sem fonte citada nao e auditavel"


def test_tabela_de_iof_cobre_todos_os_dias_ate_o_corte():
    """Buraco na tabela viraria erro em runtime numa data especifica — o pior tipo de bug."""
    tab = json_mod.loads(
        (Path(__file__).resolve().parent.parent / "tabelas" / "iof_regressivo.json").read_text()
    )
    corte = tab["zera_a_partir_de_dias"]
    faltando = [d for d in range(1, corte) if str(d) not in tab["por_dia_pct"]]
    assert not faltando, f"dias sem aliquota de IOF na tabela: {faltando}"
