"""Golden tests da analise de gastos.

Mesmo desenho dos outros dois arquivos de golden: congela a saida INTEIRA, e o `conferir()`
FALHA na primeira execucao ao criar o esperado — teste que aceita a propria saida na estreia e
carimbo, nao gate. Atualizacao intencional exige `--golden-overwrite`, e o diff do golden e a
revisao.

As fixtures `gastos-*.csv` foram construidas para reproduzir os DOIS exemplos numericos escritos
na skill `analisar-gastos`. Se esses goldens mudarem, a skill passou a mentir:

- "Alimentacao esta 32% acima da tua media de 6 meses (R$ 2.640,00 vs R$ 2.000,00)";
- "saldo R$ 1.240,00, R$ 380,00 acima de maio".

O primeiro so fecha porque a base da media exclui o proprio mes analisado: sao 7 livros
(2025-12 a 2026-06), o mes e junho e a base tem os 6 anteriores. Com o mes incluso na base a
media daria R$ 2.091,43 e o exemplo da skill nao sairia — o teste `test_media_e_de_6_meses_e_o_
mes_analisado_nao_entra_na_propria_base` existe para travar exatamente isso.
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

LIVROS = [str(GOLDEN / f"gastos-{m}.csv") for m in (
    "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
)]
RECORRENCIAS = str(GOLDEN / "recorrencias_gastos.csv")


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


def analise(*extra: str) -> dict:
    return rodar("gastos.py", "--livros", *LIVROS, *extra)


# --- goldens -------------------------------------------------------------------------------

def test_golden_gastos():
    conferir("gastos", analise("--recorrencias", RECORRENCIAS))


def test_golden_gastos_um_mes_so():
    """Base de 1 mes: a skill manda dar so a visao do mes e dizer que comparar pede 2+."""
    conferir("gastos_um_mes", rodar(
        "gastos.py", "--livros", str(GOLDEN / "gastos-2026-06.csv"),
    ))


def test_golden_gastos_cabecalho_legado():
    """Janela de 2 meses com cabecalho MISTO: o de maio e anterior a 0.2.0 (sem `tipo`)."""
    conferir("gastos_legado", rodar(
        "gastos.py",
        "--livros", str(GOLDEN / "livro_legado.csv"), str(GOLDEN / "gastos-2026-06.csv"),
    ))


# --- os dois exemplos escritos na skill -----------------------------------------------------

def test_variacao_reproduz_o_exemplo_da_skill():
    """A skill escreve: "Alimentacao esta 32% acima da tua media de 6 meses
    (R$ 2.640,00 vs R$ 2.000,00)". Os tres numeros saem do script, nao da prosa."""
    r = analise()
    alimentacao = next(
        v for v in r["variacoes_fora_do_padrao"] if v["categoria"] == "Alimentação"
    )
    assert alimentacao["valor"] == "2640.00"
    assert alimentacao["media"] == "2000.00"
    assert alimentacao["media_de_n_meses"] == 6
    assert alimentacao["variacao_pct"] == "32.00"
    assert alimentacao["direcao"] == "acima"


def test_saldo_reproduz_o_exemplo_da_skill():
    """A skill escreve: "saldo R$ 1.240,00, R$ 380,00 acima de maio"."""
    comparacao = analise()["visao_do_mes"]["comparacao_com_mes_anterior"]
    assert analise()["visao_do_mes"]["saldo"] == "1240.00"
    assert comparacao["mes_anterior"] == "2026-05"
    assert comparacao["saldo_anterior"] == "860.00"
    assert comparacao["saldo_delta"] == "380.00"


# --- as tres decisoes tomadas fora da skill --------------------------------------------------

def test_media_e_de_6_meses_e_o_mes_analisado_nao_entra_na_propria_base():
    """Decisao 1: a base sao SO os meses anteriores.

    Com o mes incluso a media de Alimentacao daria 14640/7 = R$ 2.091,43 e o "32% acima" da
    skill viraria "26,2% acima" — o mes puxando a media na propria direcao, sempre a favor de
    nao acusar. Este teste falha se alguem trocar a base.
    """
    r = analise()
    assert r["meses_de_base"] == [
        "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05",
    ]
    assert "2026-06" not in r["meses_de_base"]
    alimentacao = next(
        v for v in r["variacoes_fora_do_padrao"] if v["categoria"] == "Alimentação"
    )
    assert alimentacao["media"] == "2000.00" != "2091.43"


def test_mes_sem_gasto_na_categoria_conta_como_zero_na_media():
    """Decisao 2: Lazer aparece em 3 dos 6 meses da base (180 + 240 + 290 = 710).

    Com zeros: 710/6 = R$ 118,33. Sem zeros (so os meses em que apareceu): 710/3 = R$ 236,67,
    e a base teria n=3 numa linha que diz "media de 6 meses".
    """
    lazer = next(v for v in analise()["variacoes_fora_do_padrao"] if v["categoria"] == "Lazer")
    assert lazer["media"] == "118.33"
    assert lazer["media_de_n_meses"] == 6
    assert lazer["meses_com_gasto_na_base"] == 3
    assert lazer["base_esparsa"] is True


def test_tendencia_e_monotonicidade_estrita_nos_ultimos_3_meses():
    """Decisao 3. Educacao cai 500 -> 450 -> 400; Moradia sobe; Alimentacao faz 2100 -> 2080 ->
    2640, que sobe no total mas nao e monotona — e por isso e 'estavel', nao 'subindo'."""
    por_categoria = {e["categoria"]: e for e in analise()["evolucao_por_categoria"]}
    assert por_categoria["Educação"]["tendencia"] == "caindo"
    assert por_categoria["Moradia"]["tendencia"] == "subindo"
    assert por_categoria["Alimentação"]["tendencia"] == "estavel"
    assert por_categoria["Alimentação"]["tendencia_base"] == ["2026-04", "2026-05", "2026-06"]


# --- invariantes ----------------------------------------------------------------------------

def test_serie_por_categoria_fecha_com_o_total_de_despesas_do_mes():
    """Invariante que assert pontual por categoria nao pega: se uma linha cair fora da serie, o
    total do mes continua certo e a evolucao fica errada em silencio."""
    r = analise()
    for mes, esperado in (
        (r["mes"], r["visao_do_mes"]["despesas"]),
        ("2026-05", r["visao_do_mes"]["comparacao_com_mes_anterior"]["despesas_anterior"]),
    ):
        soma = sum(
            Decimal(p["valor"])
            for e in r["evolucao_por_categoria"]
            for p in e["serie"] if p["mes"] == mes
        )
        assert soma == Decimal(esperado), f"serie de {mes} soma {soma}, e o total diz {esperado}"


def test_saldo_fecha_com_receitas_menos_despesas_em_todo_lugar():
    v = analise()["visao_do_mes"]
    assert Decimal(v["saldo"]) == Decimal(v["receitas"]) - Decimal(v["despesas"])
    c = v["comparacao_com_mes_anterior"]
    assert Decimal(c["saldo_anterior"]) == Decimal(c["receitas_anterior"]) - Decimal(
        c["despesas_anterior"]
    )
    assert Decimal(c["saldo_delta"]) == Decimal(v["saldo"]) - Decimal(c["saldo_anterior"])


def test_direcao_da_variacao_concorda_com_o_sinal_do_percentual():
    for v in analise()["variacoes_fora_do_padrao"]:
        sinal = Decimal(v["variacao_pct"])
        assert (sinal > 0) == (v["direcao"] == "acima"), v
        assert (Decimal(v["valor"]) > Decimal(v["media"])) == (v["direcao"] == "acima"), v


def test_delta_das_maiores_mudancas_fecha_com_os_dois_valores():
    for lista in ("mais_subiram", "mais_cairam"):
        for m in analise()["maiores_mudancas"][lista]:
            assert Decimal(m["delta"]) == Decimal(m["valor"]) - Decimal(m["valor_anterior"])


# --- variacoes fora do padrao ----------------------------------------------------------------

def test_os_dois_limiares_sao_independentes_e_a_saida_diz_qual_bateu():
    """A skill da dois criterios ligados por OU. Quando so um bate, o caso e mais fraco — e a
    skill manda narrar isso como observacao. O script diz qual bateu; nao rotula 'limitrofe'.

    Alimentacao bate os dois (+32%, acima de media+1s). Transporte so o desvio (+14,99%, longe
    dos 30%). Saude so o percentual (-33,76%, mas dentro de 1 desvio, que ficou enorme por causa
    do dentista de maio).
    """
    por_categoria = {v["categoria"]: v for v in analise()["variacoes_fora_do_padrao"]}
    assert por_categoria["Alimentação"]["criterios_atingidos"] == ["desvio", "pct"]
    assert por_categoria["Transporte"]["criterios_atingidos"] == ["desvio"]
    assert por_categoria["Saúde"]["criterios_atingidos"] == ["pct"]
    assert por_categoria["Saúde"]["direcao"] == "abaixo"
    assert all("limitrofe" not in v for v in por_categoria.values())


def test_folga_e_a_distancia_ate_o_limiar_atingido():
    """Alimentacao passou dos 30% (R$ 2.600,00) por R$ 40,00, e de media+1s (R$ 2.097,78) por
    R$ 542,22. A folga reportada e a MENOR: e ela que diz o quao perto da chamada o caso foi."""
    alimentacao = next(
        v for v in analise()["variacoes_fora_do_padrao"] if v["categoria"] == "Alimentação"
    )
    assert alimentacao["limites"]["pct_acima"] == "2600.00"
    assert alimentacao["limites"]["media_mais_1_desvio"] == "2097.78"
    assert alimentacao["folga_sobre_o_limite"] == "40.00"


def test_desvio_para_baixo_e_apontado_e_nao_lido_como_economia():
    """A skill: "aponte tambem o desvio para baixo quando for notavel (pode ser conta que nao
    chegou, nao economia)". Saude cai de R$ 1.947,80 (com dentista) para R$ 480,00."""
    abaixo = [v for v in analise()["variacoes_fora_do_padrao"] if v["direcao"] == "abaixo"]
    assert {v["categoria"] for v in abaixo} == {"Saúde", "Educação"}


def test_categoria_estavel_nao_e_acusada():
    """Assinaturas e R$ 66,80 nos 7 meses: media 66,80, desvio zero. O teste e de comparacao
    ESTRITA — com `>=` no lugar de `>`, a categoria mais estavel do livro viraria variacao."""
    r = analise()
    assert all(v["categoria"] != "Assinaturas" for v in r["variacoes_fora_do_padrao"])
    assert all(n["categoria"] != "Assinaturas" for n in r["categorias_novas_no_mes"])


def test_categoria_nova_nao_vira_percentual_inventado():
    """Casa aparece pela primeira vez em junho. Media zero: nao existe "X% acima da media", e
    media + desvio (zero) acusaria qualquer centavo. Vai para lista propria, com o motivo."""
    r = analise()
    assert [n["categoria"] for n in r["categorias_novas_no_mes"]] == ["Casa"]
    assert r["categorias_novas_no_mes"][0]["valor"] == "350.00"
    assert "nao ha media" in r["categorias_novas_no_mes"][0]["motivo"]
    assert all(v["categoria"] != "Casa" for v in r["variacoes_fora_do_padrao"])


def test_maiores_mudancas_lista_so_movimento_real():
    """3 que mais subiram e 3 que mais cairam. So duas categorias cairam de maio para junho, e a
    lista sai com duas — encher com delta zero seria apresentar "nao mudou" como mudanca."""
    m = analise()["maiores_mudancas"]
    assert [x["categoria"] for x in m["mais_subiram"]] == ["Alimentação", "Casa", "Moradia"]
    assert [x["categoria"] for x in m["mais_cairam"]] == ["Saúde", "Educação"]
    assert m["mais_cairam"][0]["delta"] == "-1467.80"


# --- degradacao por tamanho de base ----------------------------------------------------------

def test_um_mes_so_da_a_visao_do_mes_e_diz_o_que_falta():
    """A skill: "1 mes de dados -> so a visao do mes; diga que comparacao precisa de 2"."""
    r = rodar("gastos.py", "--livros", str(GOLDEN / "gastos-2026-06.csv"))
    assert r["visao_do_mes"]["saldo"] == "1240.00"
    assert r["visao_do_mes"]["comparacao_com_mes_anterior"] is None
    assert r["variacoes_fora_do_padrao"] is None
    assert r["maiores_mudancas"] is None
    puladas = r["secoes_puladas"]
    assert "pelo menos 2" in puladas["visao_do_mes.comparacao_com_mes_anterior"]
    assert "meses ANTERIORES" in puladas["variacoes_fora_do_padrao"]
    assert r["evolucao_por_categoria"][0]["tendencia"] is None


def test_dois_meses_comparam_mas_nao_tem_media_historica():
    """A skill: "2 meses -> variacoes mes a mes, SEM media historica". Base de 1 mes nao sustenta
    media + desvio: o desvio amostral de uma amostra so nem existe (divisao por n-1 = 0)."""
    r = rodar("gastos.py", "--livros",
              str(GOLDEN / "gastos-2026-05.csv"), str(GOLDEN / "gastos-2026-06.csv"))
    assert r["variacoes_fora_do_padrao"] is None
    assert "variacoes_fora_do_padrao" in r["secoes_puladas"]
    assert r["maiores_mudancas"]["mes_anterior"] == "2026-05"


def test_tres_meses_ja_trazem_media_e_desvio():
    """O limiar exato da skill: 3 meses de dados = 2 meses de base."""
    r = rodar("gastos.py", "--livros",
              str(GOLDEN / "gastos-2026-04.csv"), str(GOLDEN / "gastos-2026-05.csv"),
              str(GOLDEN / "gastos-2026-06.csv"))
    assert r["variacoes_fora_do_padrao"] is not None
    assert all(v["media_de_n_meses"] == 2 for v in r["variacoes_fora_do_padrao"])
    assert "variacoes_fora_do_padrao" not in r.get("secoes_puladas", {})


# --- recorrencias x realidade -----------------------------------------------------------------

def test_recorrencia_que_subiu_de_preco_e_divergencia_e_nao_ausencia():
    """O exemplo da propria skill ("assinatura que subiu de preco"). Spotify esta cadastrado a
    R$ 19,90 e foi lancado a R$ 21,90.

    Se o casamento incluisse o valor — como faz a checagem do `resumo_mes.py`, que responde outra
    pergunta —, este caso cairia em "nao apareceu" e o aumento ficaria invisivel.
    """
    rec = analise("--recorrencias", RECORRENCIAS)["recorrencias_x_realidade"]
    spotify = next(d for d in rec["divergencias"] if d["nome"] == "Spotify")
    assert spotify["valor_cadastrado"] == "19.90"
    assert spotify["lancado"] == [{
        "data": "2026-06-12", "descricao": "Spotify",
        "valor": "21.90", "diferenca": "2.00",
    }]
    assert all(n["nome"] != "Spotify" for n in rec["nao_apareceram"])


def test_recorrencia_prevista_que_nao_apareceu():
    rec = analise("--recorrencias", RECORRENCIAS)["recorrencias_x_realidade"]
    assert [n["nome"] for n in rec["nao_apareceram"]] == ["Academia"]
    assert {c["nome"] for c in rec["conferem"]} == {
        "Aluguel", "Netflix", "Internet", "Sofá 6x", "Salário",
    }


def test_recorrencia_de_receita_tambem_e_conferida():
    """Diferente do "comprometido restante" do `resumo_mes.py`, que e so despesa: aqui a
    pergunta e "o previsto aconteceu?", e salario que nao caiu e noticia."""
    rec = analise("--recorrencias", RECORRENCIAS)["recorrencias_x_realidade"]
    salario = next(c for c in rec["conferem"] if c["nome"] == "Salário")
    assert salario["tipo"] == "receita"


def test_sem_cadastro_a_secao_e_pulada_com_o_motivo():
    """A skill: "sem cadastro, pule a secao avisando que nao ha recorrencias cadastradas"."""
    r = analise()
    assert r["recorrencias_x_realidade"] is None
    assert "nao ha recorrencias cadastradas" in r["secoes_puladas"]["recorrencias_x_realidade"]


# --- compatibilidade e janela ------------------------------------------------------------------

def test_cabecalho_legado_e_por_arquivo_e_e_declarado():
    """Janela com um livro antigo (sem `tipo`) e um novo. Ler tudo como despesa por causa do
    antigo apagaria o salario de junho; ler tudo como novo faria o CSV antigo estourar."""
    r = rodar("gastos.py", "--livros",
              str(GOLDEN / "livro_legado.csv"), str(GOLDEN / "gastos-2026-06.csv"))
    assert "cabecalho antigo" in r["compatibilidade"]
    assert r["visao_do_mes"]["receitas"] == "8500.00"
    anterior = r["visao_do_mes"]["comparacao_com_mes_anterior"]
    assert anterior["receitas_anterior"] == "0.00"
    assert anterior["despesas_anterior"] == "2500.00"


def test_mes_sem_receita_nao_divide_por_zero():
    """Mesma regra do `resumo_mes.py`, e ela precisa valer aqui tambem: 0% afirma "voce nao
    poupou" onde a verdade e "nao da para calcular". O livro legado de maio nao tem receita."""
    r = rodar("gastos.py", "--mes", "2026-05", "--livros",
              str(GOLDEN / "livro_legado.csv"), str(GOLDEN / "gastos-2026-06.csv"))
    assert r["visao_do_mes"]["receitas"] == "0.00"
    assert r["visao_do_mes"]["taxa_de_poupanca_pct"] is None
    assert "sem receita" in r["visao_do_mes"]["taxa_de_poupanca_motivo"]


def test_mes_explicito_ignora_os_posteriores_em_vez_de_os_misturar():
    """Analisar maio com julho na mao nao pode deixar julho entrar na base — media historica e
    passado. O mes ignorado sai declarado."""
    r = analise("--mes", "2026-05")
    assert r["mes"] == "2026-05"
    assert r["meses_posteriores_ignorados"] == ["2026-06"]
    assert "2026-06" not in r["janela"]
    assert r["visao_do_mes"]["saldo"] == "860.00"


def test_descricao_com_ponto_e_virgula_nao_desloca_coluna():
    """Junho tem `"Cinema; jantar e bar"` entre aspas. Com `split(";")` a coluna `valor` viraria
    " jantar e bar" e o mes inteiro sairia errado sem nenhum sintoma."""
    lazer = next(e for e in analise()["evolucao_por_categoria"] if e["categoria"] == "Lazer")
    assert lazer["serie"][-1] == {"mes": "2026-06", "valor": "320.00"}


# --- recusas ------------------------------------------------------------------------------------

def test_mes_sem_dado_recusa_em_vez_de_analisar_vazio():
    erro = falhar("gastos.py", "--livros", *LIVROS, "--mes", "2026-09")
    assert "nao tem nenhum lancamento" in erro and "2026-06" in erro


def test_data_malformada_recusa(tmp_path):
    livro = tmp_path / "x.csv"
    livro.write_text("data;tipo;categoria;descricao;valor;metodo\n"
                     "junho de 2026;despesa;X;Y;10,00;pix\n", encoding="utf-8")
    assert "nao esta em AAAA-MM-DD" in falhar("gastos.py", "--livros", str(livro))


def test_tipo_invalido_recusa(tmp_path):
    livro = tmp_path / "x.csv"
    livro.write_text("data;tipo;categoria;descricao;valor;metodo\n"
                     "2026-06-01;transferencia;X;Y;10,00;pix\n", encoding="utf-8")
    assert "tipo 'transferencia' desconhecido" in falhar("gastos.py", "--livros", str(livro))


def test_mes_repetido_em_dois_arquivos_recusa():
    """O mesmo livro passado duas vezes dobraria o mes inteiro, e R$ 14.520,00 de despesa em
    junho passa perfeitamente por gasto real. Escolher um exigiria adivinhar qual e o bom."""
    erro = falhar("gastos.py", "--livros",
                  str(GOLDEN / "gastos-2026-06.csv"), str(GOLDEN / "gastos-2026-06.csv"))
    assert "o mes 2026-06 vem de duas entradas de --livros" in erro


def test_mes_fora_de_01_12_recusa(tmp_path):
    """`2026-13-05` passa em "tem hifen na posicao certa e digitos dos dois lados", e abriria um
    mes a mais na janela — empurrando a base e somando uma categoria num balde inexistente."""
    livro = tmp_path / "x.csv"
    livro.write_text("data;tipo;categoria;descricao;valor;metodo\n"
                     "2026-13-05;despesa;X;Y;10,00;pix\n", encoding="utf-8")
    assert "fora de 01-12" in falhar("gastos.py", "--livros", str(livro))


def test_desvio_de_um_valor_so_recusa_em_vez_de_devolver_zero():
    """Guarda do modulo compartilhado. Sem ela, n=1 divide por n-1=0 e o Decimal levanta
    `DivisionByZero` — traceback no lugar do exit 1 com mensagem que os scripts prometem.
    Devolver 0 seria pior ainda: afirmaria "sem variacao" onde nao ha o que medir."""
    from estatistica import ErroDeEntrada as _E, desvio_amostral, media

    with pytest.raises(_E, match="pelo menos 2 valores"):
        desvio_amostral([Decimal(10)])
    with pytest.raises(_E, match="lista vazia"):
        media([])


def test_recorrencia_sem_nome_recusa(tmp_path):
    """Nome vazio casa com toda descricao do mes (`"" in qualquer_string` e True), e a secao
    inteira viraria "tudo confere"."""
    rec = tmp_path / "r.csv"
    rec.write_text("nome;tipo;categoria;valor;dia\n;despesa;X;10,00;1\n", encoding="utf-8")
    erro = falhar("gastos.py", "--livros", str(GOLDEN / "gastos-2026-06.csv"),
                  "--recorrencias", str(rec))
    assert "linha sem `nome`" in erro
