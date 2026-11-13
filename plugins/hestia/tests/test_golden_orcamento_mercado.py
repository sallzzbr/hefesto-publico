"""Golden tests do resumo do mes e da analise de mercado.

Mesmo desenho do `test_golden_investimentos.py`: congela a saida INTEIRA, e o `conferir()`
FALHA na primeira execucao ao criar o esperado — teste que aceita a propria saida na estreia e
carimbo, nao gate. Atualizacao intencional exige `--golden-overwrite`, e o diff do golden e a
revisao.

Duas fixtures reproduzem exemplos ESCRITOS nas proprias skills. Se esses goldens mudarem, a
documentacao passou a mentir:

- `analisar-mercado` diz "cafe: Pilao R$ 43,60/kg vs Melitta R$ 39,80/kg" e "Leite Itambe:
  R$ 4,89/l nesta compra, R$ 4,49/l ha 3 semanas (+8,9%)".
- `orcamento` define taxa de poupanca = (receitas - despesas) / receitas, com o aporte contado
  como poupanca e o resgate fora das receitas, e manda omiti-la sem receita. Os tres exemplos
  dela (aporte 2000, resgate 2000, rebalanceamento de 10000) estao travados aqui.
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
    """8500 + 1200 de receita; 3083,55 de despesa; sem aporte, caixa 6616,45; poupanca 68,21%."""
    r = rodar("resumo_mes.py", "--livro", str(GOLDEN / "livro.csv"))
    assert r["receitas"] == "9700.00"
    assert r["despesas"] == "3083.55"
    assert r["investido_no_mes"] == "0.00"
    assert r["saldo_em_caixa"] == "6616.45"
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


# --- aporte e transferencia, nao gasto (decisao do dono, achado HES-05) ----------------------

LIVRO_APORTE = str(GOLDEN / "livro_aporte.csv")


def test_golden_resumo_mes_com_aporte():
    conferir("resumo_mes_aporte", rodar("resumo_mes.py", "--livro", LIVRO_APORTE))


def test_aporte_conta_como_poupanca_e_continua_saindo_do_caixa():
    """Receita 8500, aluguel 3000, aporte 2000 no livro (categoria Investimentos).

    Lido como gasto, o aporte derrubava a taxa para 3500 / 8500 = 41,18%: o usuario via a
    poupanca cair justamente no mes em que poupou. Decisao do dono: aporte e transferencia para
    o proprio patrimonio. Conta como poupanca (5500 / 8500 = 64,71%) e continua descontado do
    saldo em caixa (3500), porque o dinheiro saiu da conta.
    """
    r = rodar("resumo_mes.py", "--livro", LIVRO_APORTE)
    assert r["receitas"] == "8500.00"
    assert r["despesas"] == "3000.00"
    assert r["investido_no_mes"] == "2000.00"
    assert r["saldo_em_caixa"] == "3500.00"
    assert r["poupanca_do_mes"] == "5500.00"
    assert r["taxa_de_poupanca_pct"] == "64.71" != "41.18"


def test_aporte_fica_visivel_e_fora_da_quebra_de_despesas():
    """Visivel em linha propria, e fora da quebra: com ele dentro, o aluguel viraria 60% das
    "despesas" e o aporte apareceria como a segunda maior despesa do mes."""
    r = rodar("resumo_mes.py", "--livro", LIVRO_APORTE)
    assert [c["categoria"] for c in r["despesas_por_categoria"]] == ["Moradia"]
    assert r["despesas_por_categoria"][0]["pct_das_despesas"] == "100.00"
    assert all(m["categoria"] != "Investimentos" for m in r["maiores_despesas"])
    assert r["aportes"] == [
        {"data": "2026-07-06", "descricao": "Aporte CDB Banco X", "valor": "2000.00"},
    ]


def test_saldo_em_caixa_e_poupanca_fecham_com_as_parcelas():
    """Invariante em todos os livros: caixa = receitas + resgatado - despesas - investido, e
    poupanca = caixa + investido - resgatado. Um aporte ou resgate que caisse fora dos dois lados
    sumiria sem sintoma."""
    for livro in (str(GOLDEN / "livro.csv"), LIVRO_APORTE, LIVRO_REBALANCEAMENTO, LIVRO_RESGATE):
        r = rodar("resumo_mes.py", "--livro", livro)
        receitas, despesas = Decimal(r["receitas"]), Decimal(r["despesas"])
        investido, resgatado = Decimal(r["investido_no_mes"]), Decimal(r["resgatado_no_mes"])
        caixa = Decimal(r["saldo_em_caixa"])
        assert caixa == receitas + resgatado - despesas - investido, livro
        assert Decimal(r["poupanca_do_mes"]) == caixa + investido - resgatado, livro
        assert investido == sum((Decimal(a["valor"]) for a in r["aportes"]), Decimal(0)), livro
        assert resgatado == sum((Decimal(g["valor"]) for g in r["resgates"]), Decimal(0)), livro


def test_categoria_de_aporte_casa_sem_caixa_nem_acento(tmp_path):
    """O orcamento deduplica categoria ignorando caixa e acento; o criterio do aporte segue a
    mesma regra para que "INVESTIMENTOS" digitado no Drive nao volte a ser gasto."""
    livro = tmp_path / "x.csv"
    livro.write_text("data;tipo;categoria;descricao;valor;metodo\n"
                     "2026-07-01;receita;Salário;Salário;1000,00;pix\n"
                     "2026-07-02;despesa; INVESTIMENTOS ;Aporte Tesouro;300,00;pix\n",
                     encoding="utf-8")
    r = rodar("resumo_mes.py", "--livro", str(livro))
    assert r["investido_no_mes"] == "300.00" and r["despesas"] == "0.00"
    assert r["taxa_de_poupanca_pct"] == "100.00"


# --- resgate e transferencia de volta (decisao do dono, simetrica a do aporte) ------------------

LIVRO_REBALANCEAMENTO = str(GOLDEN / "livro_rebalanceamento.csv")
LIVRO_RESGATE = str(GOLDEN / "livro_resgate.csv")


def test_golden_resumo_mes_rebalanceamento():
    conferir("resumo_mes_rebalanceamento", rodar("resumo_mes.py", "--livro", LIVRO_REBALANCEAMENTO))


def test_golden_resumo_mes_resgate():
    conferir("resumo_mes_resgate", rodar("resumo_mes.py", "--livro", LIVRO_RESGATE))


def test_rebalanceamento_nao_conta_o_mesmo_dinheiro_duas_vezes():
    """Receita 8500, aluguel 3000, resgate 10000 e aporte 10000 no mesmo mes (o usuario tirou do
    CDB e pos no Tesouro). Com o resgate em receitas e o aporte como poupanca, os mesmos 10000
    contavam duas vezes: receitas 18500 e taxa 15500 / 18500 = 83,78%. O resgate e transferencia
    de volta: sai das receitas, aparece em linha propria e soma no caixa."""
    r = rodar("resumo_mes.py", "--livro", LIVRO_REBALANCEAMENTO)
    assert r["receitas"] == "8500.00" != "18500.00"
    assert r["despesas"] == "3000.00"
    assert r["investido_no_mes"] == "10000.00"
    assert r["resgatado_no_mes"] == "10000.00"
    assert r["poupanca_do_mes"] == "5500.00"
    assert r["saldo_em_caixa"] == "5500.00"
    assert r["taxa_de_poupanca_pct"] == "64.71" != "83.78"


def test_resgate_sem_aporte_entra_no_caixa_e_nao_na_poupanca():
    """Receita 8500, despesas 3000 e resgate 2000. A poupanca e a do salario (5500, 64,71%); o
    resgate nao e renda do mes, mas o dinheiro voltou para a conta: caixa 7500."""
    r = rodar("resumo_mes.py", "--livro", LIVRO_RESGATE)
    assert r["receitas"] == "8500.00"
    assert r["resgatado_no_mes"] == "2000.00" and r["investido_no_mes"] == "0.00"
    assert r["poupanca_do_mes"] == "5500.00"
    assert r["taxa_de_poupanca_pct"] == "64.71"
    assert r["saldo_em_caixa"] == "7500.00"
    assert r["resgates"] == [
        {"data": "2026-09-12", "descricao": "Resgate CDB Banco X", "valor": "2000.00"},
    ]
    assert r["aportes"] == []


def test_mes_so_com_resgate_nao_tem_taxa_e_o_motivo_explica(tmp_path):
    """Resgate nao e receita: um mes cuja unica entrada e o resgate nao tem base para a taxa, e o
    motivo diz por que a linha de receita do livro nao conta, em vez de parecer um erro."""
    livro = tmp_path / "x.csv"
    livro.write_text("data;tipo;categoria;descricao;valor;metodo\n"
                     "2026-07-01;receita;Investimentos;Resgate CDB;500,00;pix\n"
                     "2026-07-02;despesa;Lazer;Cinema;100,00;pix\n",
                     encoding="utf-8")
    r = rodar("resumo_mes.py", "--livro", str(livro))
    assert r["receitas"] == "0.00" and r["resgatado_no_mes"] == "500.00"
    assert r["saldo_em_caixa"] == "400.00"
    assert r["taxa_de_poupanca_pct"] is None
    assert "sem receita" in r["taxa_de_poupanca_motivo"]
    assert "resgate" in r["taxa_de_poupanca_motivo"]


def test_criterio_de_resgate_exige_receita_na_categoria():
    """O reconhecedor simetrico do aporte, com o mesmo criterio de categoria (sem caixa nem
    acento), isolado da ordem dos ramos nos scripts."""
    from dados import eh_resgate

    assert eh_resgate("receita", "Investimentos") is True
    assert eh_resgate("receita", " INVESTÍMENTOS ") is True
    assert eh_resgate("despesa", "Investimentos") is False
    assert eh_resgate("receita", "Investimentos pessoais") is False
    assert eh_resgate("receita", "Salário") is False
    assert eh_resgate("receita", None) is False


def test_criterio_de_aporte_exige_despesa_na_categoria():
    """O criterio isolado, sem depender da ordem dos ramos nos scripts: receita na categoria
    nao e aporte, e categoria parecida mas diferente tambem nao."""
    from dados import eh_aporte

    assert eh_aporte("despesa", "Investimentos") is True
    assert eh_aporte("despesa", "investímentos") is True
    assert eh_aporte("receita", "Investimentos") is False
    assert eh_aporte("despesa", "Investimentos pessoais") is False
    assert eh_aporte("despesa", None) is False


def test_aporte_em_livro_legado_tambem_e_transferencia(tmp_path):
    """Livro sem `tipo` e lido como tudo despesa; a linha de Investimentos dali tambem e
    aporte, e a compatibilidade continua declarada."""
    livro = tmp_path / "x.csv"
    livro.write_text("data;categoria;descricao;valor;metodo\n"
                     "2026-05-03;Alimentação;Mercado;300,00;crédito\n"
                     "2026-05-04;Investimentos;Aporte CDB;1000,00;pix\n",
                     encoding="utf-8")
    r = rodar("resumo_mes.py", "--livro", str(livro))
    assert r["despesas"] == "300.00" and r["investido_no_mes"] == "1000.00"
    assert r["saldo_em_caixa"] == "-1300.00"
    assert "cabecalho antigo" in r["compatibilidade"]


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

@pytest.mark.parametrize('descricao', ['Dividendo ETF SINTETICO B', 'DIVIDENDOS', 'JCP empresa', 'juros sobre capital próprio', 'cupom semestral', 'Cupons', 'rendimento de FII', 'proventos do mês'])
def test_provento_em_investimentos_exige_classificacao_sem_reclassificar(descricao):
    from resumo_mes import resumir
    linha = {'data': '2026-10-02', 'tipo': 'Receita', 'categoria': ' INVESTIMÉNTOS ', 'descricao': descricao, 'valor': '87,50'}
    antes = dict(linha)
    resultado = resumir([linha], False)
    assert resultado['conferencia']['estado'] == 'classificacao_pendente'
    assert resultado['conferencia']['totais_provisorios'] is True
    assert resultado['conferencia']['lancamentos'][0]['descricao'] == descricao
    assert resultado['receitas'] == '0.00'
    assert resultado['resgatado_no_mes'] == '87.50'
    assert linha == antes


def test_resgate_e_provento_em_outra_categoria_nao_disparam_alerta():
    from resumo_mes import resumir
    linhas = [
        {'tipo':'receita','categoria':'Investimentos','descricao':'Resgate CDB','valor':'200,00'},
        {'tipo':'receita','categoria':'Rendimentos','descricao':'Dividendos','valor':'87,50'},
        {'tipo':'despesa','categoria':'Investimentos','descricao':'Aporte com dividendos','valor':'50,00'},
    ]
    resultado = resumir(linhas, False)
    assert 'conferencia' not in resultado
    assert resultado['receitas'] == '87.50'
    assert resultado['resgatado_no_mes'] == '200.00'


def test_analise_historica_sinaliza_provento_no_mes_anterior():
    from gastos import analisar
    linhas = [
        {'data':'2026-09-02','_mes':'2026-09','tipo':'receita','categoria':'Investimentos','descricao':'JCP','valor':'90,00'},
        {'data':'2026-10-02','_mes':'2026-10','tipo':'receita','categoria':'Salário','descricao':'Salário','valor':'1000,00'},
    ]
    r = analisar(linhas, '2026-10', ['2026-09','2026-10'], None)
    assert r['conferencia']['estado'] == 'classificacao_pendente'
    assert r['conferencia']['lancamentos'][0]['mes'] == '2026-09'
    assert r['conferencia']['totais_provisorios'] is True

@pytest.mark.parametrize('distribuicao', ['claude', 'codex'])
def test_cli_alerta_sem_alterar_csv(tmp_path, distribuicao):
    import subprocess
    livro = tmp_path / '2026-10.csv'
    conteudo = 'data;tipo;categoria;descricao;valor;metodo\n2026-10-02;receita;Investimentos;Dividendos;87,50;pix\n'
    livro.write_text(conteudo, encoding='utf-8')
    raiz = Path(__file__).resolve().parents[3]
    script = (SCRIPTS if distribuicao == 'claude' else raiz / 'codex/plugins/hestia/shared/scripts') / 'resumo_mes.py'
    r = subprocess.run([sys.executable, str(script), '--livro', str(livro)], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    assert json.loads(r.stdout)['conferencia']['estado'] == 'classificacao_pendente'
    assert livro.read_text(encoding='utf-8') == conteudo
    assert list(tmp_path.iterdir()) == [livro]
