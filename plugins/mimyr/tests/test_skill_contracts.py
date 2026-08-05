"""Regression checks for the mimyr plugin skill contracts."""

from __future__ import annotations

import re
from pathlib import Path


PLUGIN_DIR = Path(__file__).parent.parent
SKILLS_DIR = PLUGIN_DIR / "skills"
SCRIPTS_DIR = PLUGIN_DIR / "scripts"

ALL_SKILLS = [
    "gerar-curso",
    "gerar-modulo",
    "escrever-capitulo",
    "revisar-capitulo",
    "analise-de-aula",
]


def read_skill(name: str) -> str:
    return (SKILLS_DIR / name / "SKILL.md").read_text(encoding="utf-8")


def test_paths_resolvem_pela_regra_unica() -> None:
    """Paths de workspace são resolvidos (workspace → defaults → convenção), nunca hardcode."""
    defaults = (
        SKILLS_DIR / "gerar-curso" / "references" / "defaults.md"
    ).read_text(encoding="utf-8")
    for campo in [
        "local_cursos",
        "local_templates",
        "local_personas",
        "local_transcricoes",
        "local_diagnosticos",
    ]:
        assert campo in defaults
    assert "## Paths do workspace" in defaults
    assert "ilustrativos" in defaults

    # As skills que assumem estrutura de workspace declaram a regra de resolução.
    for name in ["gerar-curso", "gerar-modulo", "escrever-capitulo"]:
        text = read_skill(name)
        assert "regra única" in text, name
        assert "ilustrativ" in text, name


def test_gerar_curso_skill_orchestrates_reusable_course_pipeline() -> None:
    text = read_skill("gerar-curso")

    for required in [
        "bragir:analisar-voz",
        "bragir:gerenciar-personas",
        "analise-de-aula",
        "gerar-modulo",
        "escrever-capitulo",
        "revisar-capitulo",
        "./courses/<curso>/personas.md",
        "./courses/<curso>/modulo-N/index.html",
        "./courses/<curso>/seo.json",
    ]:
        assert required in text


def test_gerar_curso_validates_prerequisites_and_multi_course() -> None:
    text = read_skill("gerar-curso")

    # Pré-checagens explícitas antes de gerar conteúdo
    assert "Pré-requisitos" in text
    assert "./perfil-de-voz.md" in text
    # Multi-curso: prefixo de scripts parametrizado, não hardcoded
    assert "--scripts-prefix" in text
    assert "./templates/personas-curso.md" in text


def test_revisar_capitulo_skill_covers_quality_gates() -> None:
    text = read_skill("revisar-capitulo")

    for required in [
        "perfil-de-voz.md",
        "./courses/<curso>/personas.md",
        "./personas/",
        "href",
        "acessibilidade",
        "SEO",
        "mini-exercicio",
    ]:
        assert required in text


def test_gerar_modulo_targets_current_directory_layout() -> None:
    text = read_skill("gerar-modulo")

    assert "./courses/<curso>/modulo-N/index.html" in text
    assert "./templates/module-index.html" in text
    assert "./templates/subpage.html" in text
    assert "redirect legado" in text
    assert "capítulos" in text
    assert "./courses/<curso>/modulo-N.html" not in text


def test_escrever_capitulo_delegates_voice_and_uses_template_file() -> None:
    text = read_skill("escrever-capitulo")

    assert "invoque `bragir:escrever-como-antonio`" in text
    assert "./templates/subpage.html" in text
    assert "<!DOCTYPE html>" not in text


def test_analise_de_aula_has_output_path_and_evidence_contract() -> None:
    text = read_skill("analise-de-aula")

    assert "./diagnostics/<slug-da-unidade>.md" in text
    assert "Evidências usadas" in text
    assert "timestamps" in text


def test_skills_do_not_leak_pilot_personas_or_topic_cuts() -> None:
    banned_terms = ["Camila", "Rafael", "quantum", "blockchain", "NFT", "UX e tecnologia"]

    for name in ALL_SKILLS:
        text = read_skill(name)
        for term in banned_terms:
            assert term not in text, f"{term!r} leaked into skill {name}"


def test_every_script_referenced_by_a_skill_exists() -> None:
    referenced = set()
    for name in ALL_SKILLS:
        referenced.update(re.findall(r"scripts/([a-z0-9_]+\.py)", read_skill(name)))

    assert referenced, "skills should reference plugin scripts"
    for script in sorted(referenced):
        assert (SCRIPTS_DIR / script).is_file(), f"{script} referenced but missing in scripts/"


def test_skills_reference_scripts_portably_and_document_bootstrap() -> None:
    for name in ALL_SKILLS:
        text = read_skill(name)
        if "scripts/" in text:
            assert "${CLAUDE_PLUGIN_ROOT}/scripts/" in text, f"{name} must use CLAUDE_PLUGIN_ROOT"
            assert "venv" in text, f"{name} invokes scripts but does not mention the venv bootstrap"
