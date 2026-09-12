"""Golden tests dos scripts de investimento do hestia.

O que golden test faz aqui, e por que ele e o gate certo para este codigo: congela a SAIDA
INTEIRA para uma entrada fixa. Qualquer mudanca de numero, de arredondamento, de nome de campo
ou de estrutura reprova — inclusive as que um teste de asserção pontual deixaria passar, porque
ninguem escreve assert para o campo que nem sabia que existia.

Isso importa mais aqui do que no resto do repo: ate 2026-07-28 estas contas eram feitas pelo
MODELO, lendo prosa do SKILL.md. Nao havia como duas execucoes divergirem e alguem notar. O
golden e o que torna "a conta mudou" um evento visivel.

REGRA AO VER ESTE TESTE VERMELHO: nao atualize o arquivo `.golden.json` por reflexo. Ou o
codigo regrediu, ou a mudanca e intencional — e se for intencional, o diff do golden e
exatamente a revisao que voce quer ler. Regravar sem olhar transforma o gate em carimbo.
Regrave com: pytest --golden-overwrite (flag deste arquivo, abaixo).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from executar import SCRIPTS, executar, falhar, rodar  # noqa: E402

AQUI = Path(__file__).resolve().parent
GOLDEN = AQUI / "golden"

# `--golden-overwrite` regrava os esperados. Existe para a atualizacao intencional ser um
# comando explicito, e nao alguem editando JSON na mao ate o teste calar.
SOBRESCREVER = "--golden-overwrite" in sys.argv




def conferir(nome: str, obtido: dict) -> None:
    esperado_path = GOLDEN / f"{nome}.golden.json"
    serializado = json.dumps(obtido, ensure_ascii=False, indent=2, sort_keys=True) + "\n"

    if SOBRESCREVER or not esperado_path.exists():
        esperado_path.write_text(serializado, encoding="utf-8")
        if not SOBRESCREVER:
            pytest.fail(
                f"golden {esperado_path.name} nao existia e foi CRIADO. Revise o conteudo e "
                f"rode de novo — teste que se auto-aprova na primeira execucao nao e gate."
            )
        return

    esperado = esperado_path.read_text(encoding="utf-8")
    assert serializado == esperado, (
        f"saida divergiu de {esperado_path.name}.\n"
        f"Se a mudanca for INTENCIONAL, revise o diff e regrave com --golden-overwrite.\n"
        f"Se nao for, o codigo regrediu."
    )


# --- juros compostos ---------------------------------------------------------------------

def test_golden_projecao():
    conferir("projecao", rodar(
        "juros_compostos.py", "projecao",
        "--inicial", "10000", "--aporte", "800", "--meses", "60", "--taxas", "8,10,12",
    ))


def test_golden_projecao_tributada_cdb():
    """IR por tranche: cada aporte tem idade propria e cai numa faixa propria."""
    conferir("projecao_cdb", rodar(
        "juros_compostos.py", "projecao",
        "--inicial", "10000", "--aporte", "800", "--meses", "60", "--taxas", "10",
        "--tributacao", "cdb",
    ))


def test_golden_projecao_isenta_lci():
    conferir("projecao_lci", rodar(
        "juros_compostos.py", "projecao",
        "--inicial", "10000", "--aporte", "800", "--meses", "60", "--taxas", "10",
        "--tributacao", "lci",
    ))


def test_sem_tributacao_o_liquido_e_null_e_o_aviso_aparece():
    """Nao aplicar imposto e uma ESCOLHA visivel, nao um silencio."""
    r = rodar("juros_compostos.py", "projecao",
              "--inicial", "1000", "--aporte", "0", "--meses", "12", "--taxas", "10")
    c = r["cenarios"][0]
    assert c["montante_final_liquido"] is None
    assert "NENHUM imposto aplicado" in c["nota_tributacao"]


def test_tributacao_recusada_sai_1():
    erro = falhar("juros_compostos.py", "projecao", "--inicial", "1000",
         "--aporte", "0", "--meses", "12", "--taxas", "10", "--tributacao", "fundo")
    assert "come-cotas" in erro


@pytest.mark.parametrize("args,pista", [
    # Lista de tranches VAZIA: capital zero e sem aporte, ou prazo de 1 mes. Antes, `tributar()`
    # nunca era chamado e o regime recusado passava com imposto 0,00 e exit 0.
    (("--inicial", "0", "--aporte", "0", "--meses", "60", "--tributacao", "fundo"), "come-cotas"),
    (("--inicial", "0", "--aporte", "500", "--meses", "1", "--tributacao", "acoes"), "20 mil"),
    (("--inicial", "0", "--aporte", "0", "--meses", "12", "--tributacao", "cripto"), "desconhecida"),
])
def test_recusa_nao_depende_de_haver_tranche(args, pista):
    """BLOQUEANTE achado na revisao: a validacao de regime nao pode morar dentro do laco."""
    assert pista in falhar("juros_compostos.py", "projecao", "--taxas", "10", *args)


def test_objetivo_nao_aceita_tributacao_em_silencio():
    """BLOQUEANTE: o flag era aceito e IGNORADO no modo objetivo — mesmo script, comportamento
    oposto conforme o subcomando, e o SKILL.md afirmava a recusa sem ressalva."""
    erro = falhar("juros_compostos.py", "objetivo", "--inicial", "10000",
         "--alvo", "30000", "--meses", "60", "--taxas", "10", "--tributacao", "cdb")
    assert "nao se aplica ao modo `objetivo`" in erro


@pytest.mark.parametrize("meses,dias,aliquota", [(6, 182, "20.0"), (12, 365, "17.500"), (24, 730, "15.00")])
def test_prazos_naturais_caem_na_faixa_CERTA(meses, dias, aliquota):
    """Com 30 dias/mes, 6/12/24 meses caiam sempre na faixa PIOR — vies sistematico contra o
    usuario (R$ 300 a mais num CDB de 12 meses com R$ 12k de rendimento). Agora usa 365/12."""
    sys.path.insert(0, str(SCRIPTS))
    from juros_compostos import idade_em_dias
    from ir import aliquota_ir
    assert idade_em_dias(meses) == dias
    assert str(aliquota_ir(dias) * 100) == aliquota


def test_golden_objetivo():
    conferir("objetivo", rodar(
        "juros_compostos.py", "objetivo",
        "--inicial", "10000", "--alvo", "30000", "--meses", "60", "--taxas", "8,10,12",
    ))


def test_golden_objetivo_ja_atingido():
    """Capital inicial que sozinho passa do alvo: aporte necessario e 0, com observacao."""
    conferir("objetivo_ja_atingido", rodar(
        "juros_compostos.py", "objetivo",
        "--inicial", "50000", "--alvo", "30000", "--meses", "60", "--taxas", "8,10,12",
    ))


def test_taxa_zero_nao_divide_por_zero():
    """Cenario legitimo ('e se nao render nada?') que a formula fechada quebraria."""
    r = rodar("juros_compostos.py", "projecao",
              "--inicial", "1000", "--aporte", "100", "--meses", "10", "--taxas", "0")
    assert r["cenarios"][0]["montante_final_bruto"] == "2000.00"
    assert r["cenarios"][0]["rendimento_bruto"] == "0.00"


def test_equivalencia_anual_fecha_exata():
    """12% a.a. capitalizado 12 meses tem que dar exatamente 12%.

    E o teste que separa taxa EQUIVALENTE de PROPORCIONAL: com `a/12` daria 12,68%.
    """
    r = rodar("juros_compostos.py", "projecao",
              "--inicial", "1000", "--aporte", "0", "--meses", "12", "--taxas", "12")
    assert r["cenarios"][0]["montante_final_bruto"] == "1120.00"


# --- rendimento --------------------------------------------------------------------------

def test_golden_rendimento():
    conferir("rendimento", rodar(
        "rendimento.py",
        "--snapshots", str(GOLDEN / "snapshots.csv"),
        "--movimentos", str(GOLDEN / "movimentos.csv"),
    ))


def test_ativo_com_um_snapshot_nao_inventa_rendimento():
    """Degradacao com aviso, como a skill manda — o Fundo Y Prev tem 1 snapshot so."""
    r = rodar("rendimento.py",
              "--snapshots", str(GOLDEN / "snapshots.csv"),
              "--movimentos", str(GOLDEN / "movimentos.csv"))
    sem_base = {i["ativo"] for i in r["sem_base_de_calculo"]}
    assert "Fundo Y Prev" in sem_base
    assert all(i["ativo"] != "Fundo Y Prev" for i in r["por_ativo"])


def test_total_fecha_com_a_soma_das_partes():
    """Regressao do bug que o golden pegou na primeira leitura.

    O ativo sem base tinha o APORTE somado no total sem o SALDO correspondente, entao o
    rendimento total saia 500 a menos que a soma por ativo — errado e calado, no campo que a
    pessoa mais olha. Agora o total cobre so ativos com base, e o resto vai para
    `fora_do_calculo` em vez de sumir.
    """
    from decimal import Decimal
    r = rodar("rendimento.py",
              "--snapshots", str(GOLDEN / "snapshots.csv"),
              "--movimentos", str(GOLDEN / "movimentos.csv"))
    soma = sum(Decimal(a["rendimento"]) for a in r["por_ativo"])
    assert Decimal(r["total"]["rendimento"]) == soma, (
        f"total {r['total']['rendimento']} != soma das partes {soma}"
    )
    # E o que ficou de fora continua visivel, com o valor certo.
    assert r["fora_do_calculo"]["aportes"] == "500.00"


def test_csv_com_ponto_e_virgula_entre_aspas_nao_desloca_colunas():
    """O motivo de usar o modulo csv e nao split(';').

    A fixture tem `"compra; parcela 1 de 3"` na observacao. Com split ingenuo, o valor lido
    viraria outro campo e o rendimento sairia errado — calado.
    """
    r = rodar("rendimento.py",
              "--snapshots", str(GOLDEN / "snapshots.csv"),
              "--movimentos", str(GOLDEN / "movimentos.csv"), "--ativo", "IVVB11")
    ivvb = r["por_ativo"][0]
    assert ivvb["aportes"] == "300.00"
    assert ivvb["proventos"] == "87.50"


# --- metas -------------------------------------------------------------------------------

def test_golden_meta():
    """Progresso de dois potes permanece; historico global nao inventa ritmo por meta."""
    conferir("meta", rodar(
        "meta.py",
        "--metas", str(GOLDEN / "metas.csv"),
        "--acumulado", "Reserva de emergência=18400",
        "--acumulado", "Entrada do apê=9200",
        "--movimentos", str(GOLDEN / "movimentos.csv"),
        "--hoje", "2026-07-28",
    ))


def test_acumulado_faltando_para_uma_meta_para_em_vez_de_reaproveitar():
    """Metas sao potes distintos. Antes, um `--acumulado` global era aplicado a todas e o
    dinheiro da reserva virava progresso da entrada do apê — errado e calado."""
    erro = falhar("meta.py", "--metas", str(GOLDEN / "metas.csv"),
         "--acumulado", "Reserva de emergência=18400", "--hoje", "2026-07-28")
    assert "Entrada do apê" in erro


def test_ritmo_exige_tres_meses():
    """Com 3 meses de movimento o ritmo sai; com menos, tem que sair null e dizer o porque."""
    com = rodar("meta.py", "--metas", str(GOLDEN / "metas.csv"), "--meta", "Reserva de emergência",
                "--acumulado", "18400",
                "--movimentos-da-meta", "Reserva de emergência",
                "--movimentos", str(GOLDEN / "movimentos.csv"), "--hoje", "2026-07-28")
    assert com["metas"][0]["ritmo_mensal"] is not None

    sem = rodar("meta.py", "--metas", str(GOLDEN / "metas.csv"), "--meta", "Reserva de emergência",
                "--acumulado", "18400", "--hoje", "2026-07-28")
    assert sem["metas"][0]["ritmo_mensal"] is None
    assert "movimentos.csv nao informado" in sem["metas"][0]["ritmo_motivo"]


def test_meta_atingida():
    r = rodar("meta.py", "--metas", str(GOLDEN / "metas.csv"), "--meta", "Reserva de emergência",
              "--acumulado", "30000", "--hoje", "2026-07-28")
    assert r["metas"][0]["situacao"] == "atingida"
    assert r["metas"][0]["falta"] == "0.00"


# --- entradas ruins param, nao chutam ------------------------------------------------------

@pytest.mark.parametrize("args", [
    ("juros_compostos.py", "projecao", "--aporte", "abc", "--meses", "12", "--taxas", "10"),
    ("juros_compostos.py", "projecao", "--aporte", "100", "--meses", "0", "--taxas", "10"),
    ("meta.py", "--metas", "/nao/existe.csv", "--acumulado", "100"),
    ("meta.py", "--metas", str(GOLDEN / "metas.csv"), "--acumulado", "100"),  # solto com 2 metas
])
def test_entrada_invalida_sai_1(args):
    assert "ERRO" in falhar(args[0], *args[1:])


# P1: expectativas calculadas sem usar helpers do produto.
@pytest.mark.parametrize("dia,esperado", [
    ("2026-02-03", "0.00"),  # aporte ja incorporado ao saldo inicial
    ("2026-02-12", "-200.00"),
    ("2026-02-25", "0.00"),  # aporte ainda fora do saldo final
])
def test_p1_rendimento_alinha_fluxos_aos_snapshots(tmp_path, dia, esperado):
    snaps = tmp_path / "snap.csv"
    snaps.write_text("data;ativo;saldo\n2026-02-08;Pote;1200,00\n2026-02-20;Pote;1200,00\n")
    movs = tmp_path / "mov.csv"
    movs.write_text(f"data;ativo;operacao;valor\n{dia};Pote;aporte;200,00\n")
    r = rodar("rendimento.py", "--snapshots", str(snaps), "--movimentos", str(movs),
              "--inicio", "2026-02-01", "--fim", "2026-02-28")
    assert r["total"]["rendimento"] == esperado
    assert r["por_ativo"][0]["rendimento"] == esperado
    if esperado == "0.00":
        assert r["movimentos_fora_do_intervalo"][0]["aportes"] == "200.00"
        assert r["movimentos_fora_do_intervalo"][0]["quantidade"] == 1


@pytest.mark.parametrize("dia", ["2026-02-08", "2026-02-20"])
def test_p1_rendimento_nao_inventa_ordem_intradiaria(tmp_path, dia):
    snaps = tmp_path / "snap.csv"
    snaps.write_text("data;ativo;saldo\n2026-02-08;Pote;1200,00\n2026-02-20;Pote;1200,00\n")
    movs = tmp_path / "mov.csv"
    movs.write_text(f"data;ativo;operacao;valor\n{dia};Pote;aporte;200,00\n")
    r = rodar("rendimento.py", "--snapshots", str(snaps), "--movimentos", str(movs))
    assert r["por_ativo"] == []
    assert r["sem_base_de_calculo"][0]["ativo"] == "Pote"
    assert "horario" in r["sem_base_de_calculo"][0]["motivo"]
    assert r["fora_do_calculo"]["aportes"] == "200.00"


def test_p1_rendimento_respeita_intervalo_de_cada_ativo(tmp_path):
    snaps = tmp_path / "snap.csv"
    snaps.write_text("data;ativo;saldo\n2026-02-08;A;1200,00\n2026-02-20;A;1200,00\n"
                     "2026-02-01;B;1200,00\n2026-02-28;B;1200,00\n")
    movs = tmp_path / "mov.csv"
    movs.write_text("data;ativo;operacao;valor\n2026-02-03;A;aporte;200,00\n2026-02-03;B;aporte;200,00\n")
    r = rodar("rendimento.py", "--snapshots", str(snaps), "--movimentos", str(movs))
    assert {a["ativo"]: a["rendimento"] for a in r["por_ativo"]} == {"A": "0.00", "B": "-200.00"}
    assert r["total"]["rendimento"] == "-200.00"


def test_p1_rendimento_preserva_fluxos_excluidos_por_tipo(tmp_path):
    snaps = tmp_path / "snap.csv"
    snaps.write_text("data;ativo;saldo\n2026-02-08;A;1200,00\n2026-02-20;A;1200,00\n")
    movs = tmp_path / "mov.csv"
    movs.write_text("data;ativo;operacao;valor\n2026-02-03;A;resgate;100,00\n"
                   "2026-02-25;A;provento;50,00\n2026-02-12;A;resgate;25,00\n")
    r = rodar("rendimento.py", "--snapshots", str(snaps), "--movimentos", str(movs))
    assert r["total"]["rendimento"] == "25.00"
    assert r["total"]["proventos"] == "0.00"
    excluido = r["movimentos_fora_do_intervalo"][0]
    assert (excluido["resgates"], excluido["proventos"], excluido["quantidade"]) == ("100.00", "50.00", 2)


def arquivos_metas_p1(tmp_path, varias=True):
    metas = tmp_path / "metas.csv"
    metas.write_text("meta;valor_alvo;data_alvo\nA;3600,00;2027-12-31\n" +
                    ("B;3600,00;2027-12-31\n" if varias else ""))
    movs = tmp_path / "mov.csv"
    movs.write_text("data;ativo;operacao;valor\n2026-01-05;Fundo;aporte;1200,00\n"
                   "2026-02-05;Fundo;aporte;1200,00\n2026-03-05;Fundo;aporte;1200,00\n")
    return metas, movs


def test_p1_meta_nao_multiplica_historico_global(tmp_path):
    metas, movs = arquivos_metas_p1(tmp_path)
    r = rodar("meta.py", "--metas", str(metas), "--movimentos", str(movs),
              "--acumulado", "A=0", "--acumulado", "B=0", "--hoje", "2026-09-09")
    assert len(r["metas"]) == 2
    for m in r["metas"]:
        assert m["progresso_pct"] == "0.00"
        assert m["ritmo_mensal"] is None
        assert m["projecao_chegada"] is None
        assert "recorte" in m["ritmo_motivo"]


def test_p1_meta_filtro_de_nome_nao_aloca_movimentos(tmp_path):
    metas, movs = arquivos_metas_p1(tmp_path)
    r = rodar("meta.py", "--metas", str(metas), "--meta", "A", "--movimentos", str(movs),
              "--acumulado", "0", "--hoje", "2026-09-09")
    assert r["metas"][0]["ritmo_mensal"] is None


def test_p1_meta_recorte_explicito_preserva_projecao_individual(tmp_path):
    metas, movs = arquivos_metas_p1(tmp_path)
    movs.write_text(movs.read_text().replace("1200,00", "300,00"))
    r = rodar("meta.py", "--metas", str(metas), "--meta", "A", "--movimentos", str(movs),
              "--movimentos-da-meta", "A", "--acumulado", "0", "--hoje", "2026-09-09")
    assert r["metas"][0]["ritmo_mensal"] == "300.00"
    assert r["metas"][0]["meses_no_ritmo"] == 12


def test_p1_meta_unica_preserva_historico_existente(tmp_path):
    metas, movs = arquivos_metas_p1(tmp_path, varias=False)
    r = rodar("meta.py", "--metas", str(metas), "--movimentos", str(movs),
              "--acumulado", "0", "--hoje", "2026-09-09")
    assert r["metas"][0]["ritmo_mensal"] == "1200.00"
    assert r["metas"][0]["meses_no_ritmo"] == 3


@pytest.mark.parametrize("extra", [
    ["--meta", "A", "--movimentos-da-meta", "B", "--acumulado", "0"],
    ["--movimentos-da-meta", "A", "--acumulado", "A=0", "--acumulado", "B=0"],
])
def test_p1_meta_recorte_incompativel_e_recusado(tmp_path, extra):
    metas, movs = arquivos_metas_p1(tmp_path)
    assert "recorte" in falhar("meta.py", "--metas", str(metas), "--movimentos", str(movs),
                              "--hoje", "2026-09-09", *extra)
