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
    proibidos = [re.compile(r"/Users/"), re.compile(r"@gmail\.com"), re.compile(r"evio\.salgado", re.I)]
    for path in PLUGIN.rglob("*"):
        if path.is_dir() or "tests" in path.parts or path.suffix in {".png", ".pyc"}:
            continue
        texto = path.read_text(encoding="utf-8", errors="ignore")
        for re_ in proibidos:
            assert not re_.search(texto), f"{path.relative_to(PLUGIN)} casa {re_.pattern}"
