"""Contract checks for the gerar-curso harness and its fixed-role agents (mimyr 1.1)."""

from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest


PLUGIN_DIR = Path(__file__).parent.parent
HARNESS = PLUGIN_DIR / "skills" / "gerar-curso" / "harness" / "curso.mjs"
AGENTS_DIR = PLUGIN_DIR / "agents"
SKILL = PLUGIN_DIR / "skills" / "gerar-curso" / "SKILL.md"
DEFAULTS_REF = PLUGIN_DIR / "skills" / "gerar-curso" / "references" / "defaults.md"

# papel fixo → piso de modelo no frontmatter (a promoção é override de runtime do harness)
EXPECTED_AGENTS = {
    "escritor-de-capitulo": "sonnet",
    "revisor-de-curso": "opus",
    "mecanico-de-curso": "haiku",
}


def frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    assert match, f"{path.name} must start with YAML frontmatter"
    fields = {}
    for line in match.group(1).splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip()
    return fields


def test_agents_exist_with_model_floor_in_frontmatter() -> None:
    for name, model in EXPECTED_AGENTS.items():
        path = AGENTS_DIR / f"{name}.md"
        assert path.is_file(), f"agent {name} missing"
        fields = frontmatter(path)
        assert fields.get("name") == name
        assert fields.get("model") == model, f"{name} floor must be {model}"
        assert len(fields.get("description", "")) > 40, f"{name} needs a real description"


def test_agents_carry_structured_output_contract() -> None:
    for name in EXPECTED_AGENTS:
        text = (AGENTS_DIR / f"{name}.md").read_text(encoding="utf-8")
        assert "StructuredOutput" in text, f"{name} must state the structured-output contract"
        assert "harness" in text, f"{name} must state it is dispatched by the harness"


def test_harness_exists_and_declares_meta() -> None:
    assert HARNESS.is_file()
    text = HARNESS.read_text(encoding="utf-8")
    assert text.startswith("export const meta")
    assert "'mimyr-gerar-curso'" in text


def test_harness_encodes_the_invariants_in_code() -> None:
    text = HARNESS.read_text(encoding="utf-8")
    # portão de estrutura fail-closed + whitelist de tiering + rede tentar() + fallbacks
    for marker in [
        "MODELOS_STEP",
        "effortPiso",
        "const tentar",
        "fallbacksModelo",
        "tieringRecusado",
        "resumeFromRunId",
        "MAX_ITERACOES = 3",
        "capitulosComArquivoExistente",
    ]:
        assert marker in text, f"harness lost invariant marker: {marker}"
    # revisão nunca rebaixa; escrita promove só até opus; mecânicos só até haiku
    assert re.search(r"lente:\s*\{[^}]*permitidos: \['opus'\]", text)
    assert re.search(r"confirmacao:\s*\{[^}]*permitidos: \['opus'\]", text)
    assert re.search(r"escrever:\s*\{[^}]*permitidos: \['sonnet', 'opus'\]", text)
    assert re.search(r"checks:\s*\{[^}]*permitidos: \['haiku', 'sonnet'\]", text)
    # o harness nunca commita
    assert "nunca commita" in text.lower() or "NUNCA commita" in text


@pytest.mark.skipif(shutil.which("node") is None, reason="node not available")
def test_harness_parses_as_javascript() -> None:
    # O corpo do script roda em contexto async com globals do Workflow (agent, parallel, log,
    # phase, args) e usa top-level return — pra checar sintaxe, embrulha o corpo num async fn.
    text = HARNESS.read_text(encoding="utf-8")
    lines = text.split("\n")
    meta_end = next(i for i, line in enumerate(lines) if line == "}")
    meta = "\n".join(lines[: meta_end + 1])
    body = "\n".join(lines[meta_end + 1 :])
    wrapped = (
        meta
        + "\nconst args = {}; const agent = async () => {}; const parallel = async () => {};"
        + " const log = () => {}; const phase = () => {};\n"
        + "async function __check() {\n"
        + body
        + "\n}\n"
    )
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False) as handle:
        handle.write(wrapped)
        tmp = handle.name
    result = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
    assert result.returncode == 0, f"node --check failed:\n{result.stderr}"


def test_skill_wires_the_harness_and_cost_plan() -> None:
    text = SKILL.read_text(encoding="utf-8")
    for required in [
        "harness/curso.mjs",
        "Workflow({",
        "estrutura.md",
        "Status: aprovada",
        "opt-in",
        "resumeFromRunId",
        "relatorio-geracao.md",
        "Fallback sem multi-agente",
        "~/.claude/mimyr/defaults.md",
    ]:
        assert required in text, f"gerar-curso SKILL.md missing: {required}"


def test_defaults_reference_matches_harness_steps() -> None:
    text = DEFAULTS_REF.read_text(encoding="utf-8")
    for field in [
        "gerar_curso_perfil_padrao",
        "gerar_curso_haiku",
        "gerar_curso_escritor",
        "gerar_curso_modelo_por_step",
        "gerar_curso_effort_por_step",
    ]:
        assert field in text, f"defaults reference missing field: {field}"
    harness = HARNESS.read_text(encoding="utf-8")
    steps = re.findall(r"^  (\w[\w-]*):\s*\{ papel:", harness, re.MULTILINE)
    assert steps, "could not extract steps from MODELOS_STEP"
    for step in steps:
        assert f"`{step}`" in text, f"step {step} not documented in defaults reference"
