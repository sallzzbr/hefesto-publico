"""Golden tests do resumo do mes e da analise de mercado.

Mesmo desenho do `test_golden_investimentos.py`: congela a saida INTEIRA, e o `conferir()`
FALHA na primeira execucao ao criar o esperado — teste que aceita a propria saida na estreia e
carimbo, nao gate. Atualizacao intencional exige `--golden-overwrite`, e o diff do golden e a
revisao.

Duas fixtures reproduzem exemplos ESCRITOS nas proprias skills. Se esses goldens mudarem, a
documentacao passou a mentir:

- `analisar-mercado` diz "cafe: Pilao R$ 43,60/kg vs Melitta R$ 39,80/kg" e "Leite Itambe:
  R$ 4,89/l nesta compra, R$ 4,49/l ha 3 semanas (+8,9%)".
- `orcamento` define taxa de poupanca = saldo / receitas, e manda omiti-la sem receita.
"""

from __future__ import annotations

import json
import sys
from decimal import Decimal
from pathlib import Path

import pytest

from executar import SCRIPTS, executar, falhar, rodar  # noqa: E402

AQUI = Path(__file__).resolve().parent
GOLDEN = AQUI / "golden"

SOBRESCREVER = "--golden-overwrite" in sys.argv




def conferir(nome: str, obtido: dict) -> None:
    caminho = GOLDEN / f"{nome}.golden.json"
    serializado = json.dumps(obtido, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if SOBRESCREVER or not caminho.exists():
        caminho.write_text(serializado, encoding="utf-8")
        if not SOBRESCREVER:
            pytest.fail(f"golden {caminho.name} nao existia e foi CRIADO. Revise e rode de novo.")
        return
    assert serializado == caminho.read_text(encoding="utf-8"), (
        f"saida divergiu de {caminho.name}. Intencional? revise o diff e use --golden-overwrite."
    )


# --- resumo do mes -------------------------------------------------------------------------

def test_golden_resumo_mes():
    conferir("resumo_mes", rodar(
        "resumo_mes.py", "--livro", str(GOLDEN / "livro.csv"),
        "--recorrencias", str(GOLDEN / "recorrencias.csv"),
    ))


def test_soma_bate_com_a_conta_a_mao():
    """8500 + 1200 de receita; 3083,55 de despesa; saldo 6616,45; poupanca 68,21%."""
    r = rodar("resumo_mes.py", "--livro", str(GOLDEN / "livro.csv"))
    assert r["receitas"] == "9700.00"
    assert r["despesas"] == "3083.55"
    assert r["saldo"] == "6616.45"
    assert r["taxa_de_poupanca_pct"] == "68.21"


def test_categorias_somam_o_total_de_despesas():
    """Invariante que um assert pontual por categoria nao pegaria: se uma linha cair fora da
    quebra, o total continua certo e a quebra fica errada em silencio."""
    r = rodar("resumo_mes.py", "--livro", str(GOLDEN / "livro.csv"))
    soma = sum(Decimal(c["valor"]) for c in r["despesas_por_categoria"])
    assert soma == Decimal(r["despesas"])
    pcts = sum(Decimal(c["pct_das_despesas"]) for c in r["despesas_por_categoria"])
    assert abs(pcts - 100) < Decimal("0.05"), f"percentuais somam {pcts}, nao ~100"


def test_mes_sem_receita_nao_divide_por_zero():
    """A skill: "se o mes nao tiver receitas lancadas, diga isso e omita a taxa". Devolver 0%
    seria uma afirmacao falsa ("voce nao poupou") no lugar de uma ausencia."""
    r = rodar("resumo_mes.py", "--livro", str(GOLDEN / "livro_legado.csv"))
    assert r["taxa_de_poupanca_pct"] is None
    assert "sem receita" in r["taxa_de_poupanca_motivo"]


def test_cabecalho_antigo_e_lido_como_despesa_e_isso_e_declarado():
    """Livro anterior a 0.2.0 nao tem coluna `tipo`. A skill manda ler tudo como despesa."""
    r = rodar("resumo_mes.py", "--livro", str(GOLDEN / "livro_legado.csv"))
    assert r["despesas"] == "2500.00" and r["receitas"] == "0.00"
    assert "cabecalho antigo" in r["compatibilidade"]


def test_recorrencia_lancada_nao_entra_no_comprometido():
    """Aluguel e Netflix ja estao no livro com o mesmo nome e valor; Internet e Sofa nao."""
    r = rodar("resumo_mes.py", "--livro", str(GOLDEN / "livro.csv"),
              "--recorrencias", str(GOLDEN / "recorrencias.csv"))
    c = r["comprometido_restante"]
    assert {f["nome"] for f in c["ja_lancadas"]} == {"Aluguel", "Netflix"}
    assert {f["nome"] for f in c["faltando"]} == {"Internet", "Sofá 6x"}
    assert c["total_faltando"] == "479.90"
    assert r["saldo_projetado"] == "6136.55"
    # Recorrencia de RECEITA nao entra no comprometido — comprometido e despesa.
    assert all(f["nome"] != "Salário" for f in c["ja_lancadas"] + c["faltando"])


def test_tipo_invalido_para_em_vez_de_escolher_um_lado(tmp_path):
    livro = tmp_path / "x.csv"
    livro.write_text("data;tipo;categoria;descricao;valor;metodo\n"
                     "2026-06-01;transferencia;X;Y;10,00;pix\n", encoding="utf-8")
    erro = falhar("resumo_mes.py", "--livro", str(livro))
    assert "tipo 'transferencia' desconhecido" in erro


# --- mercado -------------------------------------------------------------------------------

def test_golden_mercado():
    conferir("mercado", rodar(
        "mercado.py", "--itens", str(GOLDEN / "itens.csv"),
        "--catalogo", str(GOLDEN / "produtos.csv"),
    ))


def test_preco_comparavel_reproduz_o_exemplo_da_skill():
    """A skill escreve: "cafe: Pilao R$ 43,60/kg vs Melitta R$ 39,80/kg".

    As duas compras sao de 500 g com preco por grama diferente — comparar sem converter para a
    unidade_base daria ranking invertido, que e o erro que este script existe para impedir.
    """
    r = rodar("mercado.py", "--itens", str(GOLDEN / "itens.csv"),
              "--catalogo", str(GOLDEN / "produtos.csv"))
    cafes = {e["marca"]: e["preco_ultimo"] for e in r["evolucao_de_preco"] if e["tipo"] == "café"}
    assert cafes == {"Pilão": "43.60", "Melitta": "39.80"}


def test_evolucao_de_preco_reproduz_o_exemplo_da_skill():
    """A skill: "Leite Itambe: R$ 4,89/l nesta compra, R$ 4,49/l ha 3 semanas (+8,9%)"."""
    r = rodar("mercado.py", "--itens", str(GOLDEN / "itens.csv"),
              "--catalogo", str(GOLDEN / "produtos.csv"))
    leite = next(e for e in r["evolucao_de_preco"] if e["tipo"] == "leite")
    assert leite["preco_primeiro"] == "4.49" and leite["preco_ultimo"] == "4.89"
    assert leite["variacao_pct"] == "8.91"


def test_quantidade_acima_de_media_mais_um_desvio():
    """Cerveja: 3, 3, 6 -> media 4, desvio amostral sqrt(3) = 1,73, limite 5,73. 6 esta acima."""
    r = rodar("mercado.py", "--itens", str(GOLDEN / "itens.csv"),
              "--catalogo", str(GOLDEN / "produtos.csv"))
    cerveja = next(q for q in r["quantidade_fora_do_padrao"] if "Heineken" in q["produto"])
    assert cerveja["media"] == "4.00" and cerveja["desvio"] == "1.73"
    assert cerveja["limite_media_mais_1_desvio"] == "5.73"


def test_desvio_e_amostral_e_nao_populacional():
    """Com n=3 e valores 3,3,6: amostral (n-1) = 1,73; populacional (n) = 1,41.

    A diferenca importa: populacional produz limite mais baixo e acusa "fora do padrao" com mais
    facilidade — falso positivo em habito de compra.
    """
    sys.path.insert(0, str(SCRIPTS))
    from mercado import desvio_amostral
    vals = [Decimal(3), Decimal(3), Decimal(6)]
    assert desvio_amostral(vals).quantize(Decimal("0.01")) == Decimal("1.73")


def test_item_fora_do_catalogo_nao_e_comparado():
    """Sem `unidade_base` nao ha preco comparavel. Vai para `sem_catalogo` com o motivo, em vez
    de ser comparado na unidade crua."""
    r = rodar("mercado.py", "--itens", str(GOLDEN / "itens.csv"),
              "--catalogo", str(GOLDEN / "produtos.csv"))
    assert [s["produto"] for s in r["sem_catalogo"]] == ["Sal Cisne 1kg"]
    assert all(e["produto"] != "Sal Cisne 1kg" for e in r["evolucao_de_preco"])


def test_poucas_compras_nao_geram_desvio():
    """Menos de 3 compras: sem base para media +- desvio. A skill manda pular dizendo o porque."""
    r = rodar("mercado.py", "--itens", str(GOLDEN / "itens.csv"),
              "--catalogo", str(GOLDEN / "produtos.csv"))
    sem = {s["produto"] for s in r["sem_base_de_desvio"]}
    assert "Café Melitta 500g" in sem and "Café Pilão 500g" in sem


def test_unidade_sem_conversao_conhecida_para(tmp_path):
    """Comparar sem saber converter produziria ranking invertido — melhor parar."""
    itens = tmp_path / "i.csv"
    itens.write_text("data;mercado;produto;quantidade;unidade;valor_unitario;valor_total\n"
                     "2026-06-01;X;Café Pilão 500g;1;duzia;10,00;10,00\n", encoding="utf-8")
    erro = falhar("mercado.py", "--itens", str(itens),
         "--catalogo", str(GOLDEN / "produtos.csv"))
    assert "nao sei converter" in erro
