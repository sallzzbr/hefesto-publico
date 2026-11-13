"""Golden tests dos transformadores de HTML do mimyr.

Os testes que ja existiam (`test_remover_travessao.py`, `test_melhorar_a11y.py`) afirmam regras
pontuais: "travessao entre palavras vira virgula", "tabela ganha scope". Sao bons e continuam
valendo. O que eles NAO pegam e o efeito colateral: a regra que voce testou continua certa
enquanto o transformador estraga outra coisa do documento — um atributo perdido, uma tag
reordenada, um espaco a mais dentro de <pre>. Ninguem escreve assert para o que nao imaginou.

Golden test cobre exatamente esse vao: congela o DOCUMENTO INTEIRO depois da transformacao.
Qualquer diferenca aparece, inclusive a que voce nao teria pensado em procurar.

A fixture e deliberadamente cheia de armadilha: `<pre>` e `<code>` (onde nada pode ser
reescrito), entidade HTML, atributo com aspas, tabela com cabecalho, link de navegacao,
travessao em contexto de termo e em contexto de frase.

REGRA AO VER VERMELHO: leia o diff antes de regravar. Se a mudanca for intencional, o proprio
diff e a revisao. Regravar por reflexo transforma o gate em carimbo.
Regrave com: pytest --golden-overwrite
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

AQUI = Path(__file__).resolve().parent
GOLDEN = AQUI / "golden"
sys.path.insert(0, str(AQUI.parent / "scripts"))

from melhorar_a11y import improve_html  # noqa: E402
from remover_travessao import process_html  # noqa: E402

SOBRESCREVER = "--golden-overwrite" in sys.argv


def conferir(nome: str, obtido: str) -> None:
    caminho = GOLDEN / f"{nome}.golden.html"
    if SOBRESCREVER or not caminho.exists():
        caminho.parent.mkdir(parents=True, exist_ok=True)
        caminho.write_text(obtido, encoding="utf-8")
        if not SOBRESCREVER:
            pytest.fail(
                f"golden {caminho.name} nao existia e foi CRIADO. Revise o conteudo e rode de "
                f"novo — teste que se auto-aprova na primeira execucao nao e gate."
            )
        return
    assert obtido == caminho.read_text(encoding="utf-8"), (
        f"saida divergiu de {caminho.name}. Se a mudanca for INTENCIONAL, revise o diff e "
        f"regrave com --golden-overwrite. Se nao for, o transformador regrediu."
    )


def entrada() -> str:
    return (AQUI / "golden" / "capitulo.entrada.html").read_text(encoding="utf-8")


def test_golden_remover_travessao():
    saida, _mudancas = process_html(entrada())
    conferir("capitulo.remover_travessao", saida)


def test_golden_melhorar_a11y():
    conferir("capitulo.melhorar_a11y", improve_html(entrada()))


def test_golden_pipeline_completo():
    """Os dois em sequencia, que e como o gerar-curso roda de verdade.

    Rodar isolado esconde interacao: o segundo transformador opera sobre a saida do primeiro, e
    e ai que efeito colateral costuma aparecer.
    """
    intermediario, _ = process_html(entrada())
    conferir("capitulo.pipeline", improve_html(intermediario))


# DOIS EFEITOS COLATERAIS QUE ESTE GOLDEN REVELOU na primeira leitura, e que nenhum teste
# pontual pegava. Ficam registrados como comportamento CONHECIDO, nao como bug corrigido de
# contrabando — mexer neles muda a saida de todo capitulo ja publicado.
#
# 1. Os dois transformadores passam o documento inteiro pelo parser e reserializam. O efeito e
#    normalizacao geral: `<meta charset="utf-8">` vira `<meta charset="utf-8"/>`, `<img ...>`
#    ganha `/>`, `&mdash;` vira o caractere `—`, e entra uma linha em branco apos o DOCTYPE.
#    Nada disso muda a renderizacao, mas muda o diff de QUALQUER arquivo tocado — quem revisa
#    um capitulo vai ver ruido junto da mudanca real.
# 2. `melhorar_a11y` NAO adiciona `alt` em imagem que nao tem (a fixture tem `<img
#    src="grafico.png">` sem alt e ele sai intacto). Imagem sem alt e a falha de acessibilidade
#    mais comum que existe. Pode ser escopo deliberado — alt bom exige entender a imagem, e
#    inventar texto alternativo e pior que nao ter. Mas hoje isso nao esta escrito em lugar
#    nenhum, e este golden e o registro de que e conhecido.


def test_conteudo_de_pre_e_code_nao_e_reescrito():
    """Invariante que o golden congela mas que merece assert proprio, por ser o mais caro de
    quebrar: reescrever dentro de <pre>/<code> corrompe exemplo de codigo do curso."""
    saida, _ = process_html(entrada())
    assert "cmd --flag — literal" in saida, "o travessao dentro de <pre> foi alterado"
