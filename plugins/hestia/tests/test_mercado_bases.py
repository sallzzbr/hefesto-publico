"""Regressões de comparação com bases incompletas ou unidades diferentes."""

import pytest
from decimal import Decimal

from executar import falhar, rodar


def entradas(tmp_path, linhas, base="kg"):
    itens = tmp_path / "itens.csv"
    catalogo = tmp_path / "produtos.csv"
    itens.write_text(
        "data;mercado;produto;quantidade;unidade;valor_unitario;valor_total\n"
        + linhas, encoding="utf-8",
    )
    catalogo.write_text(
        f"produto;tipo;marca;unidade_base\nProduto;alimento;Sintética;{base}\n",
        encoding="utf-8",
    )
    return itens, catalogo


@pytest.mark.parametrize("quantidade,preco", [("", ""), ("", "0,04"), ("500", ""), (" ", " ")])
def test_linha_incompleta_preserva_gasto_sem_fabricar_base(tmp_path, quantidade, preco):
    itens, catalogo = entradas(tmp_path,
        "2099-07-01;Teste;Produto;500;g;0,04;20,00\n"
        "2099-07-08;Teste;Produto;1;kg;42,00;42,00\n"
        f"2099-07-15;Teste;Produto;{quantidade};g;{preco};9,00\n")
    antes = (itens.read_bytes(), catalogo.read_bytes())
    r = rodar("mercado.py", "--itens", str(itens), "--catalogo", str(catalogo))
    assert r["maiores_gastos"] == [{"produto": "Produto", "total": "71.00"}]
    assert r["evolucao_de_preco"][0]["compras"] == 2
    assert r["evolucao_de_preco"][0]["preco_ultimo"] == "42.00"
    assert r["sem_base_de_desvio"][0]["compras"] == 2
    assert r["quantidade_no_padrao"] == r["quantidade_fora_do_padrao"] == []
    assert len(r["sem_comparacao"]) == 1
    omitida = r["sem_comparacao"][0]
    assert omitida["produto"] == "Produto" and omitida["data"] == "2099-07-15"
    assert set(omitida["campos_ausentes"]) == {
        campo for campo, valor in [("quantidade", quantidade), ("valor_unitario", preco)]
        if not valor.strip()
    }
    assert omitida["motivo"]
    assert (itens.read_bytes(), catalogo.read_bytes()) == antes


@pytest.mark.parametrize("pequena,base", [("g", "kg"), ("ml", "l"), (" G ", " KG ")])
def test_quantidades_equivalentes_usam_a_mesma_base(tmp_path, pequena, base):
    itens, catalogo = entradas(tmp_path,
        f"2099-07-01;Teste;Produto;500;{pequena};0,04;20,00\n"
        f"2099-07-08;Teste;Produto;1;{base};42,00;42,00\n"
        f"2099-07-15;Teste;Produto;500;{pequena};0,046;23,00\n", base)
    r = rodar("mercado.py", "--itens", str(itens), "--catalogo", str(catalogo))
    assert r["quantidade_fora_do_padrao"] == []
    assert r["quantidade_no_padrao"] == [{
        "produto": "Produto", "unidade_base": base.strip().lower(),
        "media": "0.67", "desvio": "0.29",
        "limite_media_mais_1_desvio": "0.96", "ultima_quantidade": "0.50",
        "acima_do_padrao": False,
    }]
    assert r["evolucao_de_preco"][0]["preco_primeiro"] == "40.00"
    assert r["evolucao_de_preco"][0]["preco_ultimo"] == "46.00"


@pytest.mark.parametrize("quantidade,preco", [("ilegível", "0,04"), ("500", "ilegível")])
def test_numero_malformado_nao_vira_omissao_silenciosa(tmp_path, quantidade, preco):
    itens, catalogo = entradas(tmp_path,
        f"2099-07-01;Teste;Produto;{quantidade};g;{preco};20,00\n")
    erro = falhar("mercado.py", "--itens", str(itens), "--catalogo", str(catalogo))
    assert "nao e um valor monetario reconhecido" in erro


@pytest.mark.parametrize("unidade,base,quantidade,dobro,ultima", [
    ("g", "kg", "2", "4", "0.004"),
    ("ml", "l", "2", "4", "0.004"),
    ("g", "kg", "0,002", "0,004", "0.000004"),
    ("g", "kg", "6", "12", "0.012"),
])
def test_quantidade_pequena_nao_vira_zero_apos_conversao(tmp_path, unidade, base, quantidade, dobro, ultima):
    itens, catalogo = entradas(tmp_path,
        f"2099-07-01;Teste;Produto;{quantidade};{unidade};1;2,00\n"
        f"2099-07-08;Teste;Produto;{quantidade};{unidade};1;2,00\n"
        f"2099-07-15;Teste;Produto;{dobro};{unidade};1;4,00\n", base)
    r = rodar("mercado.py", "--itens", str(itens), "--catalogo", str(catalogo))
    q = r["quantidade_fora_do_padrao"][0]
    assert Decimal(q["ultima_quantidade"]) == Decimal(ultima)
    assert Decimal(q["media"]) > 0 and Decimal(q["desvio"]) > 0
    assert Decimal(q["ultima_quantidade"]) > Decimal(q["limite_media_mais_1_desvio"])
    assert q["unidade_base"] == base
