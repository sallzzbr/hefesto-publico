"""Contrato dos agents de papel fixo do mimyr.

Espelha `plugins/odin/tests/contratos-de-agente.test.mjs` — mesmo contrato, linguagem do
plugin. Por que existe: `disallowedTools` num frontmatter que ninguém verifica volta a ser
prosa no primeiro PR que "limpar" o arquivo, e nada falharia.

A lista é por EXCECAO: o teste varre `agents/` e cobra a restricao de todo agent que nao
esteja em PODE_ESCREVER. Enumerar os restritos por nome deixaria agent NOVO de julgamento
nascer sem restricao com a suite verde — o modo de falha por lista que apodrece.

O QUE ESTE TESTE **NAO** GARANTE: nada sobre o furo do `Bash`. Quem tem shell escreve
arquivo; isto fecha a escrita acidental, nao a deliberada. O que ele garante e que a
declaracao existe e nao regride. O enforcement de runtime foi verificado uma vez, em
2026-07-28, despachando `odin:revisor` numa sessao limpa: `Write`/`Edit`/`NotebookEdit` nao
aparecem no pool. Ver o design doc do cerco.
"""

from pathlib import Path
import re

import pytest

AGENTS_DIR = Path(__file__).resolve().parents[1] / "agents"

# Quem PRODUZ artefato. Todo o resto julga ou executa check, e nao escreve.
PODE_ESCREVER = {"escritor-de-capitulo"}

# Piso de modelo por papel. Promocoes/rebaixamentos sao override de runtime do harness; o
# frontmatter guarda o PISO.
PISO_DE_MODELO = {
    "escritor-de-capitulo": "sonnet",
    "revisor-de-curso": "opus",
    "mecanico-de-curso": "haiku",
}

# `Task` E `Agent`: a tool chamava-se `Task` e virou `Agent`, com `Task(...)` valendo como
# alias. Nome desconhecido em denylist e no-op silencioso, entao declarar ambos custa nada e
# cobre as duas versoes. Spawnar subagent e escrever por procuracao: sem essa entrada, o
# revisor despacha um `escritor-de-capitulo` e edita o que esta julgando.
TOOLS_DE_ESCRITA = ["Write", "Edit", "NotebookEdit", "Task", "Agent"]


def frontmatter(caminho: Path) -> dict:
    """Le o frontmatter YAML sem depender de pyyaml (o CI nao instala a dep para isto).

    Aceita as quatro formas validas do campo e RECUSA tabulacao, que YAML nao permite como
    indentacao: parser que aceita invalido aprova config que o runtime pode ignorar.
    """
    texto = caminho.read_text(encoding="utf-8")
    bloco = re.match(r"---\r?\n(.*?)\r?\n---\r?\n", texto, re.S)
    assert bloco, f"{caminho.name}: precisa comecar com frontmatter YAML"
    campos: dict[str, str] = {}
    chave_aberta = None
    for linha in bloco.group(1).split("\n"):
        if not linha.strip():
            continue
        assert not re.match(r"^ *\t", linha), (
            f"{caminho.name}: frontmatter usa TAB para indentar — YAML nao aceita, e o runtime "
            f"pode recusar o bloco inteiro. Use espacos. Linha: {linha!r}"
        )
        item = re.match(r"^ +-\s+(.*)$", linha)
        if item and chave_aberta:
            valor = _desaspar(item.group(1))
            campos[chave_aberta] = f"{campos[chave_aberta]}, {valor}" if campos[chave_aberta] else valor
            continue
        if ":" not in linha:
            continue
        chave, _, bruto = linha.partition(":")
        chave = chave.strip()
        if not chave:
            continue
        valor = _desflow(_desaspar(bruto.strip()))
        if valor == "":
            chave_aberta = chave
            campos[chave] = ""
            continue
        chave_aberta = None
        campos[chave] = valor
    return campos


def _desaspar(v: str) -> str:
    m = re.match(r"^([\"'])(.*)\1$", v)
    return m.group(2) if m else v


def _desflow(v: str) -> str:
    """`[Write, Edit]` -> `Write, Edit`. Normaliza a sequencia inline para a forma das outras."""
    m = re.match(r"^\[(.*)\]$", v)
    return ", ".join(_desaspar(t.strip()) for t in m.group(1).split(",")) if m else v


def todos_os_agents() -> list[Path]:
    arquivos = sorted(AGENTS_DIR.glob("*.md"))
    # Diretorio vazio passaria todo `for` em silencio. Piso explicito.
    assert len(arquivos) >= 3, f"esperado ao menos 3 agents em {AGENTS_DIR}, achei {len(arquivos)}"
    return arquivos


def test_todo_agent_declara_nome_e_piso_de_modelo():
    """Varre o diretorio, nao a tabela: agent novo sem `model` passaria despercebido."""
    for caminho in todos_os_agents():
        campos = frontmatter(caminho)
        nome = caminho.stem
        assert campos.get("name") == nome, f"{caminho.name}: campo name divergente"
        assert campos.get("model"), (
            f"{caminho.name}: agent sem campo model. O piso de modelo e contrato de papel — sem "
            f"ele o agente herda o modelo da sessao e o custo/qualidade do step vira acidente."
        )
        esperado = PISO_DE_MODELO.get(nome)
        if esperado:
            assert campos["model"] == esperado, f"{caminho.name}: piso deve ser {esperado}"


@pytest.mark.parametrize(
    "caminho", [c for c in sorted(AGENTS_DIR.glob("*.md")) if c.stem not in PODE_ESCREVER],
    ids=lambda c: c.stem,
)
def test_agents_que_julgam_sao_read_only_por_configuracao(caminho: Path):
    declarado = frontmatter(caminho).get("disallowedTools")
    assert declarado, (
        f"{caminho.name} nao declara disallowedTools — sem ele o agente herda Write/Edit e o "
        f"read-only volta a ser so a frase na prosa"
    )
    # Grafia exata importa: o campo e case-sensitive e um typo nao gera erro, so deixa de
    # restringir. Comparar contra a lista literal e o que pega "Wrtie".
    tools = [t.strip() for t in declarado.split(",")]
    for tool in TOOLS_DE_ESCRITA:
        assert tool in tools, f"{caminho.name}: disallowedTools precisa negar {tool} (declarado: {declarado!r})"


def test_o_escritor_mantem_escrita():
    """A assimetria e o ponto: quem julga nao toca no artefato que julga."""
    campos = frontmatter(AGENTS_DIR / "escritor-de-capitulo.md")
    assert campos.get("disallowedTools") is None, (
        "escritor-de-capitulo.md nao pode negar tools de escrita: e o unico agente do mimyr que "
        "produz capitulo. Se este teste falhar porque alguem 'uniformizou' os agents, o "
        "gerar-curso parou de escrever."
    )
