"""Golden tests do lancamento da nota de mercado e dos totais do cadastro de recorrencias.

Mesmo desenho dos outros arquivos de golden: congela a saida INTEIRA, e o `conferir()` FALHA na
primeira execucao ao criar o esperado. Atualizacao intencional exige `--golden-overwrite`, e o
diff do golden e a revisao.

A fixture da nota reproduz o exemplo ESCRITO na skill `mercado`, Fluxo 2:

    Lancar no orcamento? `12/07 — Alimentacao R$ 312,40 · Limpeza R$ 48,90 · Higiene R$ 27,30`
    (descricao: "Mercado Pao de Acucar — nota de 12/07")

Os tres totais E a descricao saem do script. Se este golden mudar, a skill passou a mentir.

O que se testa aqui e a unica conta do hestia cujo resultado e GRAVADO: as linhas propostas vao
para o livro do orcamento, e de la viram base das medias, desvios e tendencias do `gastos.py`.
Erro aqui nao produz uma frase errada — produz um historico errado.
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

ITENS = str(GOLDEN / "nota_itens.csv")
CATALOGO = str(GOLDEN / "nota_produtos.csv")
REC = str(GOLDEN / "recorrencias_gastos.csv")
REC_BORDAS = str(GOLDEN / "recorrencias_bordas.csv")


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


def nota(*extra: str) -> dict:
    return rodar("nota.py", "--itens", ITENS, "--catalogo", CATALOGO, *extra)


def nota_12() -> dict:
    return nota("--data", "2026-07-12", "--mercado", "Pão de Açúcar")


# --- goldens -------------------------------------------------------------------------------

def test_golden_nota():
    conferir("nota", nota("--data", "2026-07-12", "--mercado", "Pão de Açúcar",
                          "--total-da-nota", "578,50"))


def test_golden_nota_com_divergencia():
    conferir("nota_divergencia", nota("--data", "2026-07-19"))


def test_golden_nota_selecao_com_duas_notas():
    conferir("nota_duas", nota())


def test_golden_recorrencias():
    conferir("recorrencias", rodar("recorrencias.py", "--recorrencias", REC))


def test_golden_recorrencias_bordas():
    conferir("recorrencias_bordas", rodar("recorrencias.py", "--recorrencias", REC_BORDAS))


# --- o exemplo escrito na skill --------------------------------------------------------------

def test_agrupamento_reproduz_o_exemplo_da_skill():
    """A skill escreve: "Alimentacao R$ 312,40 · Limpeza R$ 48,90 · Higiene R$ 27,30"."""
    grupos = {g["categoria"]: g["valor"] for g in nota_12()["por_categoria"]}
    assert grupos == {"Alimentação": "312.40", "Limpeza": "48.90", "Higiene": "27.30"}


def test_descricao_reproduz_o_formato_da_skill():
    """A skill escreve: (descricao: "Mercado Pao de Acucar — nota de 12/07")."""
    proposto = nota_12()["lancamento_proposto"]
    assert proposto["descricao"] == "Mercado Pão de Açúcar — nota de 12/07"
    assert all(linha["descricao"] == proposto["descricao"] for linha in proposto["linhas"])
    assert {linha["tipo"] for linha in proposto["linhas"]} == {"despesa"}
    assert {linha["data"] for linha in proposto["linhas"]} == {"2026-07-12"}


def test_metodo_fica_nulo_porque_a_skill_manda_perguntar():
    """O script nao ve a nota, so o CSV. Preencher `metodo` aqui seria adivinhar o que a skill
    manda perguntar quando ele nao esta visivel."""
    proposto = nota_12()["lancamento_proposto"]
    assert proposto["metodo"] is None
    assert "pergunte" in proposto["metodo_motivo"]


# --- invariantes ----------------------------------------------------------------------------

def test_agrupado_mais_orfaos_fecha_com_o_total_dos_itens():
    """Invariante que assert por categoria nao pega: se um item cair fora do agrupamento E fora
    dos orfaos, os dois totais continuam plausiveis e o dinheiro desaparece em silencio."""
    r = nota_12()
    assert Decimal(r["total_agrupado"]) + Decimal(r["total_sem_categoria"]) == Decimal(
        r["total_dos_itens"]
    )


def test_linhas_propostas_somam_exatamente_o_total_agrupado():
    """O que vai ser GRAVADO tem que fechar com o que foi somado. Uma categoria perdida entre o
    agrupamento e a proposta lancaria menos do que se gastou."""
    r = nota_12()
    proposto = r["lancamento_proposto"]
    soma = sum(Decimal(linha["valor"]) for linha in proposto["linhas"])
    assert soma == Decimal(proposto["total"]) == Decimal(r["total_agrupado"])
    assert len(proposto["linhas"]) == len(r["por_categoria"])


def test_percentuais_dos_grupos_somam_cem():
    pcts = sum(Decimal(g["pct_do_agrupado"]) for g in nota_12()["por_categoria"])
    assert abs(pcts - 100) < Decimal("0.05"), f"percentuais somam {pcts}, nao ~100"


def test_soma_por_categoria_bate_com_a_conta_a_mao():
    """312,40 + 48,90 + 27,30 = 388,60 agrupado; racao de 189,90 fora; nota de 578,50."""
    r = nota_12()
    assert r["total_agrupado"] == "388.60"
    assert r["total_sem_categoria"] == "189.90"
    assert r["total_dos_itens"] == "578.50"
    assert r["itens_considerados"] == 17


# --- item orfao: segrega e denuncia ----------------------------------------------------------

def test_item_orfao_sai_do_grupo_e_o_nao_coberto_anda_junto_do_lancamento():
    """A racao nao esta no catalogo. Ela nao derruba a nota, mas o valor que o lancamento NAO
    cobre fica dentro do proprio `lancamento_proposto` — nao numa secao separada que se esquece
    de ler. Lancar menos do que se gastou e o modo de falha desta funcao."""
    r = nota_12()
    assert [s["produto"] for s in r["sem_categoria"]] == ["Ração Golden 15kg"]
    assert r["sem_categoria"][0]["valor_total"] == "189.90"
    assert r["lancamento_proposto"]["nao_coberto"] == "189.90"
    assert all(g["categoria"] for g in r["por_categoria"])


# --- conferencia da extracao (o motivo de guardar unitario E total) ---------------------------

def test_arredondamento_de_balanca_nao_e_divergencia():
    """File de frango: 0,850 kg x 24,90 = 21,165, e a nota escreve 21,17 — 0,005 de diferenca,
    dentro do 1 centavo. Sem tolerancia, TODO item de peso fracionario acusaria divergencia e a
    conferencia viraria ruido que se aprende a ignorar."""
    r = nota_12()
    acusados = {d["produto"] for d in r["divergencias_de_extracao"]}
    assert "Filé de frango" not in acusados
    assert "Queijo mussarela" not in acusados
    assert "Banana prata" not in acusados
    assert r["divergencias_de_extracao"] == []


def test_divergencia_acima_da_tolerancia_e_apontada_mas_nao_recusada():
    """Cafe no Atacadao: 1 x 22,50 = 22,50 e a nota diz 22,55. Sao 5 centavos, cinco vezes a
    tolerancia — extracao errada. A skill manda "mostre e pergunte antes de seguir", entao o
    script relata e sai 0: recusar trocaria o julgamento do usuario pelo meu."""
    r = nota("--data", "2026-07-19")
    assert len(r["divergencias_de_extracao"]) == 1
    d = r["divergencias_de_extracao"][0]
    assert d["produto"] == "Café Pilão 500g"
    assert d["esperado"] == "22.50" and d["valor_total"] == "22.55"
    assert d["diferenca"] == "0.05" and d["tolerancia"] == "0.01"
    # O lancamento continua sendo proposto — a decisao e do usuario, nao do script.
    assert r["lancamento_proposto"] is not None


def test_item_sem_quantidade_fica_fora_da_conferencia_e_e_contado():
    """Contrato da skill: item sem quantidade legivel entra so com `valor_total`. Conferir esse
    item exigiria inventar a quantidade; ele sai da conferencia e e contado a parte."""
    r = nota_12()
    assert [i["produto"] for i in r["itens_sem_quantidade"]] == ["Pão de forma Wickbold"]
    assert r["itens_sem_quantidade"][0]["valor_total"] == "25.80"
    # ...mas continua somando no grupo: nao conferir nao e o mesmo que ignorar.
    alimentacao = next(g for g in r["por_categoria"] if g["categoria"] == "Alimentação")
    assert alimentacao["valor"] == "312.40"


# --- conferencia do total da nota -------------------------------------------------------------

def test_total_da_nota_que_confere():
    c = nota("--data", "2026-07-12", "--mercado", "Pão de Açúcar",
             "--total-da-nota", "578,50")["conferencia_do_total_da_nota"]
    assert c["confere"] is True and c["diferenca"] == "0.00"


def test_total_da_nota_que_nao_confere_e_relatado_com_a_diferenca():
    """Divergencia contra o total impresso e informacao, nao recusa (Fluxo 1, passo 2)."""
    c = nota("--data", "2026-07-12", "--mercado", "Pão de Açúcar",
             "--total-da-nota", "600,00")["conferencia_do_total_da_nota"]
    assert c["confere"] is False
    assert c["soma_dos_itens"] == "578.50" and c["diferenca"] == "-21.50"


def test_total_da_nota_compara_com_os_orfaos_dentro():
    """A nota impressa cobra a racao tambem. Comparar o total impresso contra o AGRUPADO
    (R$ 388,60) acusaria uma divergencia de R$ 189,90 que nao existe."""
    c = nota("--data", "2026-07-12", "--mercado", "Pão de Açúcar",
             "--total-da-nota", "578,50")["conferencia_do_total_da_nota"]
    assert c["soma_dos_itens"] == "578.50" != "388.60"


# --- selecao de nota ---------------------------------------------------------------------------

def test_duas_notas_na_selecao_nao_ganham_lancamento_inventado():
    """A descricao nomeia mercado e data; duas notas no lote nao tem descricao unica que seja
    verdade. Em vez de um rotulo guarda-chuva, devolve as notas para quem chama filtrar."""
    r = nota()
    assert r["lancamento_proposto"] is None
    assert "uma nota por vez" in r["lancamento_motivo"]
    assert r["notas_na_selecao"] == [
        {"data": "2026-07-12", "mercado": "Pão de Açúcar"},
        {"data": "2026-07-19", "mercado": "Atacadão"},
    ]
    # O agrupamento continua valendo como informacao.
    assert r["itens_considerados"] == 21


def test_filtro_de_mercado_isola_a_nota():
    r = nota("--mercado", "Atacadão")
    assert r["itens_considerados"] == 4
    assert r["lancamento_proposto"]["mercado"] == "Atacadão"


def test_selecao_vazia_recusa_em_vez_de_propor_zero():
    """Um lancamento de R$ 0,00 passa por "nota sem nada" em vez de "filtro errado"."""
    erro = falhar("nota.py", "--itens", ITENS, "--catalogo", CATALOGO, "--data", "2026-07-01")
    assert "nenhum item na selecao" in erro


def test_item_sem_valor_total_recusa(tmp_path):
    """`valor_total` e o unico campo que todo item tem. Estimar pelo unitario inventaria
    dinheiro que vai ser gravado no livro."""
    itens = tmp_path / "i.csv"
    itens.write_text("data;mercado;produto;quantidade;unidade;valor_unitario;valor_total\n"
                     "2026-07-12;X;Arroz Camil 5kg;1;un;18,90;\n", encoding="utf-8")
    erro = falhar("nota.py", "--itens", str(itens), "--catalogo", CATALOGO)
    assert "sem `valor_total`" in erro


def test_valor_total_com_tres_casas_recusa(tmp_path):
    """As linhas propostas vao GRAVADAS com 2 casas. Aceitar 21,165 e arredondar por conta
    propria faz a soma das linhas gravadas divergir do total da nota, e cada grupo arredonda
    para o seu lado. Preco UNITARIO com 3 casas (combustivel) segue aceito — o total pago, nao.
    """
    itens = tmp_path / "i.csv"
    itens.write_text("data;mercado;produto;quantidade;unidade;valor_unitario;valor_total\n"
                     "2026-07-12;X;Arroz Camil 5kg;0,850;kg;24,90;21,165\n", encoding="utf-8")
    erro = falhar("nota.py", "--itens", str(itens), "--catalogo", CATALOGO)
    assert "mais de 2 casas decimais" in erro and "divergir do total da nota" in erro


def test_unitario_com_tres_casas_continua_aceito(tmp_path):
    """1,5 l x R$ 5,899 = R$ 8,8485; a nota cobra 8,85 (0,0015 de diferenca, dentro do centavo).
    Recusar isso barraria nota legitima de combustivel."""
    itens = tmp_path / "i.csv"
    itens.write_text("data;mercado;produto;quantidade;unidade;valor_unitario;valor_total\n"
                     "2026-07-12;X;Arroz Camil 5kg;1,5;l;5,899;8,85\n", encoding="utf-8")
    r = rodar("nota.py", "--itens", str(itens), "--catalogo", CATALOGO)
    assert r["divergencias_de_extracao"] == []
    assert r["total_dos_itens"] == "8.85"


def test_catalogo_sem_coluna_categoria_recusa(tmp_path):
    """Sem `categoria` no catalogo nao ha agrupamento nenhum a fazer."""
    cat = tmp_path / "c.csv"
    cat.write_text("produto;tipo;marca;unidade_base\nArroz Camil 5kg;arroz;Camil;kg\n",
                   encoding="utf-8")
    erro = falhar("nota.py", "--itens", ITENS, "--catalogo", str(cat))
    assert "faltam as colunas categoria" in erro


# --- recorrencias: totais do cadastro ----------------------------------------------------------

def test_totais_das_recorrencias_batem_com_a_conta_a_mao():
    """Fixas: 2200 + 44,90 + 19,90 + 129,90 + 99 = 2493,70. Parcelada: 350 (Sofa 6x).
    Comprometido 2843,70; receita recorrente 8500; diferenca 5656,30."""
    r = rodar("recorrencias.py", "--recorrencias", REC)
    assert r["subtotal_despesas_fixas"] == "2493.70"
    assert r["subtotal_despesas_parceladas"] == "350.00"
    assert r["total_comprometido_despesas"] == "2843.70"
    assert r["total_recorrente_receitas"] == "8500.00"
    assert r["diferenca_receitas_menos_despesas"] == "5656.30"


def test_subtotais_fecham_com_os_totais_e_com_as_fichas():
    """Invariante em dois nives: subtotal + subtotal = total, e a soma das fichas de cada grupo
    reproduz o subtotal. Uma linha que caia fora de um grupo mantem os dois totais plausiveis."""
    for arquivo in (REC, REC_BORDAS):
        r = rodar("recorrencias.py", "--recorrencias", arquivo)
        for tipo, total in (("despesa", "total_comprometido_despesas"),
                            ("receita", "total_recorrente_receitas")):
            fixas = sum(Decimal(f["valor"]) for f in r["fixas"] if f["tipo"] == tipo)
            parc = sum(Decimal(f["valor"]) for f in r["parceladas"] if f["tipo"] == tipo)
            assert fixas == Decimal(r[f"subtotal_{tipo}s_fixas"]), (arquivo, tipo)
            assert parc == Decimal(r[f"subtotal_{tipo}s_parceladas"]), (arquivo, tipo)
            assert fixas + parc == Decimal(r[total]), (arquivo, tipo)
        assert len(r["fixas"]) + len(r["parceladas"]) == r["recorrencias"]


def test_fixa_e_parcelada_saem_do_parcelas_restantes():
    """Contrato da skill: vazio = fixa, numero = parcelamento."""
    r = rodar("recorrencias.py", "--recorrencias", REC)
    assert [f["nome"] for f in r["parceladas"]] == ["Sofá 6x"]
    assert r["parceladas"][0]["parcelas_restantes"] == 3
    assert "Sofá 6x" not in {f["nome"] for f in r["fixas"]}
    assert all("parcelas_restantes" not in f for f in r["fixas"])


def test_parcela_zerada_e_apontada_e_ainda_conta_no_total():
    """O contrato manda remover a linha ao chegar a zero, mas ela esta no arquivo — e o total
    tem que dizer o que o arquivo diz hoje, nao o que ele deveria dizer. Some-la calada faria o
    comprometido cair R$ 480,00 sem o usuario pedir nada."""
    r = rodar("recorrencias.py", "--recorrencias", REC_BORDAS)
    assert [z["nome"] for z in r["parcelas_zeradas"]] == ["Curso 12x"]
    assert r["subtotal_despesas_parceladas"] == "1380.00"  # 480 (zerada) + 900
    assert r["total_comprometido_despesas"] == "3580.00"


def test_dia_invalido_avisa_sem_travar_a_listagem():
    """`dia` nao entra em soma nenhuma aqui. Recusar uma listagem so-leitura por causa de um
    campo decorativo seria desproporcional — some o que da para somar e mostre o campo errado."""
    r = rodar("recorrencias.py", "--recorrencias", REC_BORDAS)
    assert [(a["nome"], a["campo"], a["valor"]) for a in r["avisos"]] == [
        ("Consórcio", "dia", "45"),
    ]
    assert r["total_comprometido_despesas"] == "3580.00"


def test_receita_parcelada_cai_no_subtotal_certo():
    """Bonus em 3x e receita E parcelada: os dois eixos sao independentes, e cruzar errado
    jogaria R$ 2.000,00 no lado das despesas."""
    r = rodar("recorrencias.py", "--recorrencias", REC_BORDAS)
    assert r["subtotal_receitas_parceladas"] == "2000.00"
    assert r["subtotal_receitas_fixas"] == "1800.00"
    assert r["total_recorrente_receitas"] == "3800.00"
    assert "Bônus 3x" in {f["nome"] for f in r["parceladas"]}


def test_nome_repetido_ou_vazio_avisa_porque_quebra_OUTRAS_skills():
    """`nome` e identificador unico no contrato, e o `resumo_mes.py` e o `gastos.py` casam
    recorrencia com lancamento POR NOME. Nome vazio ou repetido nao muda total nenhum AQUI — daí
    ser aviso —, mas cega aqueles dois; melhor descobrir na listagem que na analise de 3 meses.
    """
    from pathlib import Path as _P
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        rec = _P(d) / "r.csv"
        rec.write_text(
            "nome;tipo;categoria;valor;dia;parcelas_restantes\n"
            "Netflix;despesa;Assinaturas;44,90;12;\n"
            "Netflix;despesa;Assinaturas;21,90;12;\n"
            ";despesa;Outros;10,00;3;\n",
            encoding="utf-8",
        )
        r = rodar("recorrencias.py", "--recorrencias", str(rec))

    campos = {(a["nome"], a["campo"]) for a in r["avisos"]}
    assert ("Netflix", "nome") in campos and ("(sem nome)", "nome") in campos
    # ...e os totais continuam somando o que o arquivo diz: 44,90 + 21,90 + 10,00.
    assert r["total_comprometido_despesas"] == "76.80"


def test_tipo_invalido_recusa(tmp_path):
    """Muda de que lado a linha soma: tem que parar."""
    rec = tmp_path / "r.csv"
    rec.write_text("nome;tipo;categoria;valor;dia;parcelas_restantes\n"
                   "X;transferencia;Y;10,00;5;\n", encoding="utf-8")
    erro = falhar("recorrencias.py", "--recorrencias", str(rec))
    assert "tipo 'transferencia' desconhecido" in erro


def test_parcelas_restantes_nao_numerico_recusa(tmp_path):
    """Decide fixa x parcelada, e portanto em qual subtotal a linha cai."""
    rec = tmp_path / "r.csv"
    rec.write_text("nome;tipo;categoria;valor;dia;parcelas_restantes\n"
                   "X;despesa;Y;10,00;5;varias\n", encoding="utf-8")
    erro = falhar("recorrencias.py", "--recorrencias", str(rec))
    assert "nao e numero nem vazio" in erro
