"""Golden tests da atualizacao de posicoes (skill `investimentos`, Fluxo 2).

Mesmo desenho dos outros goldens: congela a saida INTEIRA, e o `conferir()` FALHA na primeira
execucao ao criar o esperado. Atualizacao intencional exige `--golden-overwrite`.

O que esta em jogo aqui e diferente das analises: e a tela de CONFIRMACAO de uma escrita. O
usuario ve o antes/depois e aprova reescrever `carteira.csv` e apendar em `snapshots.csv` — um
percentual errado ali e um update ruim aprovado com numero bonito. E o `snapshots.csv` e
exatamente o que o `rendimento.py` le depois para separar aporte de rendimento, entao um
snapshot a mais ou a menos aqui envenena aquela conta tambem.

A fixture cobre os tres casos do Fluxo 2 de uma vez: quatro posicoes confirmadas pelo print
(uma subindo, uma caindo, uma saindo do zero, uma de bolsa com quantidade nova), uma ausente do
print e uma nova no print.
"""

from __future__ import annotations

import json
import sys
from decimal import Decimal
from pathlib import Path

import pytest

from executar import falhar, rodar  # noqa: E402

AQUI = Path(__file__).resolve().parent
GOLDEN = AQUI / "golden"

SOBRESCREVER = "--golden-overwrite" in sys.argv

CARTEIRA = str(GOLDEN / "carteira.csv")
LIDAS = str(GOLDEN / "posicoes_lidas.csv")
DATA = "2026-06-30"


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


def atualizar(*extra: str) -> dict:
    return rodar("posicoes.py", "--carteira", CARTEIRA, "--print", LIDAS, "--data", DATA, *extra)


def por_ativo(r: dict) -> dict:
    return {a["ativo"]: a for a in r["atualizadas"]}


# --- golden ---------------------------------------------------------------------------------

def test_golden_posicoes():
    conferir("posicoes", atualizar())


# --- a conta que a skill pede: antes/depois em BRL e % ----------------------------------------

def test_variacao_em_brl_e_pct_por_ativo():
    """A skill: "mostre antes/depois (saldo antigo → novo, com a variacao em BRL e %)".

    CDB 1000 -> 1100 = +100 (+10%). ETF SINTETICO B 2000 -> 1800 = -200 (-10%).
    Titulo 3000 -> 3300 = +300 (+10%).
    """
    a = por_ativo(atualizar())
    assert (a["CDB Sintetico A"]["variacao"],
            a["CDB Sintetico A"]["variacao_pct"]) == ("100.00", "10.00")
    assert (a["ETF SINTETICO B"]["variacao"], a["ETF SINTETICO B"]["variacao_pct"]) == ("-200.00", "-10.00")
    assert (a["Titulo Sintetico C"]["variacao"],
            a["Titulo Sintetico C"]["variacao_pct"]) == ("300.00", "10.00")


def test_percentual_e_sobre_o_saldo_ANTERIOR():
    """Dividir pelo saldo NOVO daria -200/1800 = -11,11% em vez de -10%.
    A base correta é o saldo anterior."""
    ivvb = por_ativo(atualizar())["ETF SINTETICO B"]
    assert ivvb["saldo_antes"] == "2000.00" and ivvb["saldo_depois"] == "1800.00"
    assert ivvb["variacao_pct"] == "-10.00" != "-11.11"


def test_saldo_anterior_zero_nao_divide_por_zero():
    """Mesmo tratamento da taxa de poupanca do `resumo_mes.py`: 0% afirmaria "nao mudou" sobre
    uma posicao que saiu do zero, o que e falso. Devolve null com motivo."""
    fundo = por_ativo(atualizar())["Fundo Sintetico D"]
    assert fundo["saldo_antes"] == "0.00" and fundo["variacao"] == "500.00"
    assert fundo["variacao_pct"] is None
    assert "saiu do zero" in fundo["variacao_pct_motivo"]


def test_patrimonio_e_a_variacao_confirmada_batem_com_a_conta_a_mao():
    """Antes 10000. Depois 11300. Confirmadas: 6000 -> 6700, +700 (+11,67%). O ativo novo tem saldo 600."""
    r = atualizar()
    assert r["patrimonio_antes"] == "10000.00"
    assert r["patrimonio_depois"] == "11300.00"
    assert r["patrimonio_variacao"] == "1300.00"
    c = r["variacao_das_posicoes_confirmadas"]
    assert (c["saldo_antes"], c["saldo_depois"]) == ("6000.00", "6700.00")
    assert (c["variacao"], c["variacao_pct"], c["posicoes"]) == ("700.00", "11.67", 4)


# --- ausente do print: "NUNCA remova sozinho" --------------------------------------------------

def test_ausente_do_print_fica_na_carteira_com_saldo_E_data_antigos():
    """A skill: "NUNCA remova sozinho". Manter o saldo e obvio; manter a DATA e o ponto fino —
    bumpar `atualizado_em` afirmaria que a posicao foi conferida neste print, e ela nao foi."""
    r = atualizar()
    assert [x["ativo"] for x in r["ausentes_do_print"]] == ["LCI Sintetica E"]
    lci = next(l for l in r["carteira_proposta"] if l["ativo"] == "LCI Sintetica E")
    assert Decimal(lci["saldo"]) == Decimal("4000.00")   # valor intacto
    assert lci["atualizado_em"] == "2026-03-31" != DATA


def test_carteira_proposta_sai_toda_no_MESMO_formato_de_numero():
    """A linha intacta vem de `dict(atual)`, ou seja, do texto CRU do CSV — com vírgula decimal,
    enquanto as atualizadas passam pelo `dinheiro()` e saem com ponto. Duas linhas em formatos
    diferentes no MESMO array que a skill vai gravar é sujeira que ninguém revisa, e uma
    planilha em pt-BR lê '3000.00' e '3000,00' como números diferentes por três ordens de
    grandeza. Este teste existe porque o golden saiu com a mistura na primeira execução.
    """
    r = atualizar()
    saldos = [l["saldo"] for l in r["carteira_proposta"]]
    assert all("," not in s for s in saldos), saldos
    assert all(len(s.split(".")[1]) == 2 for s in saldos), saldos


def test_ausente_do_print_nao_ganha_snapshot():
    """Consequencia direta da data nao avancar, e a que protege outro script: um snapshot com o
    saldo velho na data de hoje faria o `rendimento.py` calcular variacao zero e reportar
    "estavel" onde a verdade e "nao sei"."""
    r = atualizar()
    assert "LCI Sintetica E" not in {s["ativo"] for s in r["snapshots_propostos"]}
    assert len(r["snapshots_propostos"]) == len(r["atualizadas"]) == 4
    assert {s["data"] for s in r["snapshots_propostos"]} == {DATA}


# --- novo no print: propor cadastrar, nao inventar ---------------------------------------------

def test_novo_no_print_fica_fora_da_carteira_proposta_com_os_campos_que_faltam():
    """A skill manda PROPOR CADASTRAR (classe, instituicao, indexador/vencimento). Nada disso
    esta no print — montar a linha com `classe` chutada gravaria dado inventado."""
    r = atualizar()
    assert [n["ativo"] for n in r["novos_no_print"]] == ["Fundo Sintetico F"]
    novo = r["novos_no_print"][0]
    assert novo["saldo"] == "600.00"
    assert novo["falta_cadastrar"] == ["classe", "instituicao", "indexador", "vencimento"]
    assert "Fundo Sintetico F" not in {l["ativo"] for l in r["carteira_proposta"]}
    assert "Fundo Sintetico F" not in {s["ativo"] for s in r["snapshots_propostos"]}


# --- quantidade: bandeira, nao conta nova ------------------------------------------------------

def test_quantidade_que_muda_e_sinalizada_porque_mistura_aporte_com_rendimento():
    """ETF SINTETICO B vai de 20 para 24 cotas: parte do +23,46% e compra do usuario, nao mercado. O
    script sinaliza; separar os dois exige `movimentos.csv`, que e o `rendimento.py`."""
    a = por_ativo(atualizar())
    assert a["ETF SINTETICO B"]["quantidade_antes"] == "10"
    assert a["ETF SINTETICO B"]["quantidade_depois"] == "12"
    assert a["ETF SINTETICO B"]["quantidade_mudou"] is True
    # Renda fixa nao tem quantidade: o campo nem aparece, em vez de vir zero ou False.
    assert "quantidade_mudou" not in a["CDB Sintetico A"]


def test_quantidade_nova_entra_na_carteira_proposta():
    ivvb = next(l for l in atualizar()["carteira_proposta"] if l["ativo"] == "ETF SINTETICO B")
    assert ivvb["quantidade"] == "12" and ivvb["saldo"] == "1800.00"
    assert ivvb["atualizado_em"] == DATA
    # Os campos que o print nao traz seguem intactos, vindos da carteira.
    assert ivvb["classe"] == "bolsa" and ivvb["instituicao"] == "Instituicao Sintetica"


# --- invariantes -------------------------------------------------------------------------------

def test_nenhuma_posicao_desaparece_da_carteira_proposta():
    """Invariante que assert por ativo nao pega: uma linha perdida entre a leitura e a proposta
    sumiria da carteira na reescrita, e o patrimonio cairia sem ninguem ter resgatado nada."""
    r = atualizar()
    import csv
    with open(CARTEIRA, encoding="utf-8") as f:
        originais = {l["ativo"] for l in csv.DictReader(f, delimiter=";")}
    assert {l["ativo"] for l in r["carteira_proposta"]} == originais
    assert len(r["carteira_proposta"]) == len(originais) == 5


def test_carteira_proposta_mais_novos_fecha_com_o_patrimonio_depois():
    """O que vai ser GRAVADO tem que fechar com o total anunciado."""
    r = atualizar()
    soma = sum(Decimal(l["saldo"]) for l in r["carteira_proposta"])
    novos = sum(Decimal(n["saldo"]) for n in r["novos_no_print"])
    assert soma + novos == Decimal(r["patrimonio_depois"])


def test_variacao_confirmada_mais_novos_fecha_com_a_variacao_do_patrimonio():
    """Decomposicao do 5.260: 3.060 mexeram de fato, 2.200 sao ativo novo que apareceu, e o
    ausente contribui 0 porque nao foi tocado."""
    r = atualizar()
    confirmada = Decimal(r["variacao_das_posicoes_confirmadas"]["variacao"])
    novos = sum(Decimal(n["saldo"]) for n in r["novos_no_print"])
    assert confirmada + novos == Decimal(r["patrimonio_variacao"])


def test_soma_dos_snapshots_bate_com_os_saldos_confirmados():
    r = atualizar()
    por_snap = {s["ativo"]: Decimal(s["saldo"]) for s in r["snapshots_propostos"]}
    for ficha in r["atualizadas"]:
        assert por_snap[ficha["ativo"]] == Decimal(ficha["saldo_depois"])


def test_a_mistura_do_patrimonio_depois_e_declarada():
    """`patrimonio_depois` soma conferido com nao conferido (o ausente entra pelo saldo antigo).
    Isso e simplificacao, e simplificacao nao declarada e mentira."""
    r = atualizar()
    assert any("ausentes do print pelo saldo ANTIGO" in s for s in r["simplificacoes"])
    assert any("variacao_das_posicoes_confirmadas" in s for s in r["simplificacoes"])


# --- recusas -----------------------------------------------------------------------------------

def test_ativo_repetido_na_carteira_recusa(tmp_path):
    """Contrato: `ativo` e nome unico. Repetido infla o patrimonio somando a mesma posicao."""
    c = tmp_path / "c.csv"
    c.write_text("ativo;classe;saldo;atualizado_em\n"
                 "ETF SINTETICO B;bolsa;5200,00;2026-03-31\n"
                 "ETF SINTETICO B;bolsa;3000,00;2026-03-31\n", encoding="utf-8")
    erro = falhar("posicoes.py", "--carteira", str(c), "--print", LIDAS, "--data", DATA)
    assert "aparece duas vezes" in erro and "inflaria o patrimonio" in erro


def test_ativo_repetido_no_print_recusa(tmp_path):
    """Dois saldos para o mesmo ativo: qual vale? Escolher exigiria adivinhar."""
    pr = tmp_path / "p.csv"
    pr.write_text("ativo;saldo\nETF SINTETICO B;6420,00\nETF SINTETICO B;6500,00\n", encoding="utf-8")
    erro = falhar("posicoes.py", "--carteira", CARTEIRA, "--print", str(pr), "--data", DATA)
    assert "aparece duas vezes" in erro


def test_ativo_sem_nome_recusa(tmp_path):
    pr = tmp_path / "p.csv"
    pr.write_text("ativo;saldo\n;6420,00\n", encoding="utf-8")
    erro = falhar("posicoes.py", "--carteira", CARTEIRA, "--print", str(pr), "--data", DATA)
    assert "linha sem `ativo`" in erro


def test_data_malformada_recusa():
    """A data vira `atualizado_em` e a data do snapshot: errada, desalinha a serie que o
    rendimento.py le."""
    erro = falhar("posicoes.py", "--carteira", CARTEIRA, "--print", LIDAS, "--data", "30/06/2026")
    assert "nao esta em AAAA-MM-DD" in erro


def test_saldo_com_tres_casas_recusa(tmp_path):
    """Saldo de extrato tem centavo exato, e ele vai ser GRAVADO: arredondar em silencio faria o
    patrimonio divergir da soma das linhas gravadas."""
    pr = tmp_path / "p.csv"
    pr.write_text("ativo;saldo\nETF SINTETICO B;6420,005\n", encoding="utf-8")
    erro = falhar("posicoes.py", "--carteira", CARTEIRA, "--print", str(pr), "--data", DATA)
    assert "mais de 2 casas decimais" in erro
    assert "divergir da soma das linhas gravadas" in erro
