"""Contratos das skills e commands do hestia — o plugin so tinha golden test de script.

O que trava (auditoria de 2026-09-01): toda escrita confirma antes de gravar; skills de
analise sao 100% leitura; investimentos nunca recomenda ativo; cada command aponta para uma
skill que existe; todo script citado nas skills existe em scripts/; versoes em sincronia; sem
dado pessoal. E o codigo que mexe com dinheiro — a prosa que o modelo carrega e contrato.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

PLUGIN = Path(__file__).resolve().parent.parent
RAIZ = PLUGIN.parent.parent
SKILLS = sorted(p.name for p in (PLUGIN / "skills").iterdir() if p.is_dir())
COMMANDS = sorted(p.stem for p in (PLUGIN / "commands").glob("*.md"))
ESCREVEM = {"orcamento", "mercado", "investimentos"}
SO_LEITURA = {"analisar-gastos", "analisar-mercado", "analisar-investimentos"}


def skill(nome: str) -> str:
    return (PLUGIN / "skills" / nome / "SKILL.md").read_text(encoding="utf-8")


def descricao(texto: str) -> str:
    m = re.match(r"^---\n(.*?)\n---", texto, re.S)
    assert m, "SKILL.md sem frontmatter"
    d = re.search(r"^description:\s*(.*)$", m.group(1), re.M)
    assert d, "frontmatter sem description"
    return d.group(1).strip().strip('"')


def test_inventario_de_skills_e_o_esperado() -> None:
    assert SKILLS == sorted(ESCREVEM | SO_LEITURA), SKILLS


@pytest.mark.parametrize("nome", SKILLS)
def test_description_tem_gatilho_e_tamanho_de_roteamento(nome: str) -> None:
    d = descricao(skill(nome))
    assert len(d) >= 80, f"{nome}: description curta ({len(d)})"
    assert re.search(r"Use (when|quando|para)", d), f"{nome}: sem gatilho de uso"


@pytest.mark.parametrize("nome", sorted(ESCREVEM))
def test_skill_que_escreve_confirma_antes_de_gravar(nome: str) -> None:
    texto = skill(nome)
    assert re.search(r"Confirme antes de QUALQUER escrita|confirma(ção)? antes de (toda )?escrita", texto), (
        f"{nome}: a regra 'confirma antes de gravar' sumiu do SKILL.md"
    )


@pytest.mark.parametrize("nome", sorted(SO_LEITURA))
def test_skill_de_analise_e_so_leitura(nome: str) -> None:
    texto = skill(nome)
    assert "100% leitura" in texto, f"{nome}: perdeu a declaracao '100% leitura'"
    assert re.search(r"[Nn]unca cria, edita ou apaga|[Úu]nica escrita poss[íi]vel", texto), (
        f"{nome}: perdeu a proibicao de escrita (ou a excecao unica: relatorio em arquivo separado)"
    )


# --- distribuicao Codex: gravar exige mostrar e confirmar (achado CX-01) ----------------------

CODEX_SKILLS = RAIZ / "codex" / "plugins" / "hestia" / "skills"
# Formas de "o pedido ja autoriza a escrita" que as skills nativas usavam ate a 0.1.5. Comparadas
# sem caixa e com espacos colapsados, para que quebra de linha nao esconda a volta do texto.
REAPROVEITA_AUTORIZACAO = [
    "execute se já autorizado",
    "já estiver autorizada",
    "dentro da autorização existente",
    "aprovação apenas para mutações novas",
    "quando já autorizado",
    "segue a autorização já dada",
    "segue autorização",
]


def skill_codex(nome: str) -> str:
    return " ".join((CODEX_SKILLS / nome / "SKILL.md").read_text(encoding="utf-8").split())


def test_inventario_codex_e_o_mesmo_do_claude() -> None:
    assert sorted(p.name for p in CODEX_SKILLS.iterdir() if p.is_dir()) == SKILLS


@pytest.mark.parametrize("nome", SKILLS)
def test_skill_codex_nao_trata_o_pedido_como_autorizacao_de_escrita(nome: str) -> None:
    """No Claude, toda escrita mostra a linha exata e espera o ok. As skills nativas Codex diziam
    "execute se ja autorizado", e o proprio pedido de lancar virava autorizacao: tipo ou valor
    mal lido ia direto para o livro financeiro. Decisao do dono: o Codex volta a mostrar e pedir
    ok, salvo o usuario dizer explicitamente na sessao que pode gravar sem mostrar."""
    texto = skill_codex(nome).lower()
    for frase in REAPROVEITA_AUTORIZACAO:
        assert frase not in texto, f"codex/{nome}: voltou '{frase}'"
    assert "espere o ok do usuário" in texto, f"codex/{nome}: sem a confirmacao antes de gravar"
    assert "não autoriza a escrita" in texto, f"codex/{nome}: pedido ainda vale como autorizacao"
    assert "explicitamente, nesta sessão, que pode gravar sem mostrar" in texto, (
        f"codex/{nome}: a unica excecao (dispensa explicita na sessao) sumiu ou mudou"
    )
    assert "prevalece sobre o reaproveitamento de autorização do runtime" in texto, (
        f"codex/{nome}: a regra precisa dizer que vence o RUNTIME compartilhado"
    )


@pytest.mark.parametrize("nome", sorted(ESCREVEM))
def test_skill_codex_que_grava_no_livro_mostra_a_linha_ou_o_lote_final(nome: str) -> None:
    texto = skill_codex(nome).lower()
    assert "mostre a linha ou o lote final exato" in texto, (
        f"codex/{nome}: a confirmacao precisa mostrar o que sera gravado, nao so perguntar"
    )


# --- resgate como transferencia e nota antiga em arquivo migrado (Claude e Codex) -------------

def _colapsado(caminho: Path) -> str:
    return " ".join(caminho.read_text(encoding="utf-8").split())


TEXTOS_DO_PLUGIN = sorted(
    [*(PLUGIN / "skills").rglob("*.md"), *(PLUGIN / "commands").glob("*.md"), PLUGIN / "README.md",
     *CODEX_SKILLS.glob("*/SKILL.md")]
)
# Formas de "resgate e receita" que a 0.13.0 escreveu antes da decisao de trata-lo como
# transferencia de volta. Voltar a qualquer uma delas faria a skill narrar o contrario do script.
RESGATE_COMO_RECEITA = [
    "resgate continua somando em receitas",
    "resgate) continua somando em receitas",
    "resgate) continua receita",
    "resgate (receita em `investimentos`) continua receita",
]


def test_nenhum_texto_diz_que_resgate_e_receita() -> None:
    for caminho in TEXTOS_DO_PLUGIN:
        texto = _colapsado(caminho).lower()
        for frase in RESGATE_COMO_RECEITA:
            assert frase not in texto, f"{caminho.relative_to(RAIZ)}: voltou '{frase}'"


def test_resumo_do_mes_nomeia_o_resgatado_nas_duas_distribuicoes() -> None:
    assert "**Resgatado no mês**" in _colapsado(PLUGIN / "skills" / "orcamento" / "SKILL.md")
    assert "`resgatado_no_mes`" in _colapsado(CODEX_SKILLS / "orcamento" / "SKILL.md")
    assert "`resgatado_no_mes`" in _colapsado(CODEX_SKILLS / "analisar-gastos" / "SKILL.md")


def test_analisar_gastos_diz_qual_saldo_vai_no_exemplo() -> None:
    """O exemplo "saldo R$ 1.240,00, R$ 380,00 acima de maio" e a poupanca do mes; a queda do
    caixa explicada pelo aporte nao e piora. Sem isso a skill compara o caixa e le o mes em que
    o usuario mais investiu como o pior."""
    for caminho in (PLUGIN / "skills" / "analisar-gastos" / "SKILL.md",
                    CODEX_SKILLS / "analisar-gastos" / "SKILL.md"):
        texto = _colapsado(caminho)
        assert "`poupanca_delta`" in texto, caminho.relative_to(RAIZ)
        assert "`investido_delta`" in texto and "não é piora" in texto, caminho.relative_to(RAIZ)


def test_mercado_cita_o_filtro_das_linhas_sem_identificador() -> None:
    for caminho in (PLUGIN / "skills" / "mercado" / "SKILL.md",
                    CODEX_SKILLS / "mercado" / "SKILL.md"):
        texto = _colapsado(caminho)
        assert "--sem-nota" in texto, f"{caminho.relative_to(RAIZ)}: sem o filtro --sem-nota"


def test_investimentos_nunca_recomenda_ativo() -> None:
    # A lista do que a skill NAO faz e o guardrail; a frase e a mesma nas duas skills de proposito.
    for nome in ("investimentos", "analisar-investimentos"):
        texto = skill(nome)
        assert re.search(r"recomendar ativo, papel, fundo ou corretora espec[íi]ficos", texto), (
            f"{nome}: guardrail 'nao recomenda ativo/papel/fundo/corretora' sumiu"
        )


def test_todo_command_aponta_para_skill_existente() -> None:
    assert len(COMMANDS) == 14, COMMANDS
    for cmd in COMMANDS:
        texto = (PLUGIN / "commands" / f"{cmd}.md").read_text(encoding="utf-8")
        m = re.search(r"skill `([a-z-]+)`", texto)
        assert m, f"/{cmd}: nao diz qual skill invoca"
        assert m.group(1) in SKILLS, f"/{cmd}: aponta para skill inexistente {m.group(1)}"


def test_scripts_citados_nas_skills_existem() -> None:
    existentes = {p.name for p in (PLUGIN / "scripts").glob("*.py")}
    for nome in SKILLS:
        for citado in set(re.findall(r"\b([a-z_]+\.py)\b", skill(nome))):
            assert citado in existentes, f"{nome} cita {citado}, que nao existe em scripts/"


def test_versoes_em_sincronia() -> None:
    pj = json.loads((PLUGIN / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"))
    mp = json.loads((RAIZ / ".claude-plugin" / "marketplace.json").read_text(encoding="utf-8"))
    entrada = next(p for p in mp["plugins"] if p["name"] == "hestia")
    assert pj["version"] == entrada["version"]


def test_sem_dado_pessoal_no_plugin() -> None:
    proibidos = [re.compile(r"/Users/"), re.compile(r"@gmail\.com")]
    for path in PLUGIN.rglob("*"):
        if path.is_dir() or "tests" in path.parts or path.suffix in {".png", ".pyc"}:
            continue
        texto = path.read_text(encoding="utf-8", errors="ignore")
        for re_ in proibidos:
            assert not re_.search(texto), f"{path.relative_to(PLUGIN)} casa {re_.pattern}"


def test_abertura_descricao_usa_nome_para_relatorios_sem_substituir_journal():
    from pathlib import Path
    texto = (Path(__file__).parent.parent / 'skills/orcamento/references/abertura-mes-segura.md').read_text()
    assert 'descrição da linha no livro é o `nome` da recorrência' in texto
    assert 'não substitui a comparação do efeito completo e o journal' in texto
