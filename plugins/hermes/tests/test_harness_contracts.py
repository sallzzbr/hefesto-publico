"""Contract checks for the criativo-fluxo harness and its fixed-role agents (hermes 1.0)."""

from __future__ import annotations

import re
from pathlib import Path


PLUGIN_DIR = Path(__file__).parent.parent
HARNESS = PLUGIN_DIR / "skills" / "criativo-fluxo" / "harness" / "criativo.mjs"
AGENTS_DIR = PLUGIN_DIR / "agents"
SKILL = PLUGIN_DIR / "skills" / "criativo-fluxo" / "SKILL.md"
DEFAULTS_REF = PLUGIN_DIR / "skills" / "criativo-fluxo" / "references" / "defaults.md"

# papel fixo → piso de modelo no frontmatter (promoções são override de runtime do harness)
EXPECTED_AGENTS = {
    "diretor-de-arte": "opus",
    "produtor-de-criativo": "sonnet",
    "validador-de-criativo": "opus",
    "mecanico-de-criativo": "haiku",
}

# steps whitelisted no harness — a tabela MODELOS_STEP é o enforcement
EXPECTED_STEPS = [
    "rotas", "roughs", "portao", "producao", "selecao", "composicao",
    "preflight", "crit", "confirmacao", "correcao", "pacote",
]

# critérios bloqueantes do validador endurecido (diagnóstico da Fase 7: G-J são os que
# pegam os defeitos que vazavam — concordância, thumbnail, completude, voz)
EXPECTED_CRITERIA = [
    "arquetipo_correto", "rosto_nao_coberto", "principios_duros", "fidelidade_referencia",
    "fidelidade_estampa", "naturalidade_ia", "texto_correto", "legibilidade_thumbnail",
    "mensagem_completa", "voz_da_marca",
]


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
    assert text.startswith("export const meta"), "meta must be the first statement"
    assert "name: 'hermes-criativo-fluxo'" in text


def test_harness_whitelists_every_step_with_closed_allowlist() -> None:
    text = HARNESS.read_text(encoding="utf-8")
    block = re.search(r"const MODELOS_STEP = \{(.*?)\n\}", text, re.DOTALL)
    assert block, "MODELOS_STEP table missing"
    for step in EXPECTED_STEPS:
        assert re.search(rf"^\s*{step}:", block.group(1), re.MULTILINE), f"step {step} missing from whitelist"
    # nenhum step além dos esperados (whitelist fechada dos dois lados)
    declared = re.findall(r"^\s*(\w+):\s*\{ papel:", block.group(1), re.MULTILINE)
    assert sorted(declared) == sorted(EXPECTED_STEPS), f"unexpected steps: {set(declared) ^ set(EXPECTED_STEPS)}"


def test_harness_hard_invariants_in_code() -> None:
    text = HARNESS.read_text(encoding="utf-8")
    assert "const MAX_ITERACOES = 3" in text, "iteration cap must be code, not prose"
    assert "const MAX_RODADAS_IA = 3" in text, "image-generation guard must be code"
    assert "coincide com o de itera" in text, "the derived IA cap must be documented honestly"
    assert "rota_aprovada" in text, "the route gate is the core invariant"
    assert text.count("resumeFromRunId") >= 3, "fail-closed aborts must be reinvocable"
    assert "tieringRecusado" in text, "whitelist refusals must be recorded, never silent"
    assert "effortPiso" in text, "judgment steps must carry an effort floor"
    assert "fallbacksModelo" in text, "model fallbacks must be reported"


def test_harness_1_0_1_hardening_in_code() -> None:
    """Cada fix da revisão adversarial 1.0.1 fica fixado aqui — regressão = teste vermelho."""
    text = HARNESS.read_text(encoding="utf-8")
    # B1: pre-flight que quebra (ok=false sem falha nomeada) aborta — pf.ok é lido
    assert "!pf.ok && (!pf.falhas || pf.falhas.length === 0)" in text, "pf.ok must be enforced (fail-open #1)"
    # B2: aprovado sem rota completa não é desreferenciado às cegas
    assert "!portao.rota || !portao.rota.arquetipo" in text, "portao.rota must be guarded before dereference"
    # B4: arquétipo texto nunca liga geração de imagem
    assert "custoIa && ehTexto" in text, "custo 'ia' must be coerced on texto archetype"
    assert "ehTexto || !promptIaAtual" in text, "generation block needs the texto/prompt belt guard"
    # B5: a troca da imagem-base é código, não prosa ao mecânico
    assert "split('{{BASE}}').join(baseEscolhida)" in text, "base substitution must be code via {{BASE}}"
    # E1: aprovação visual enforced — rough da rota aprovada precisa existir
    assert "roughExiste === false" in text, "visual approval must be enforced by the gate"
    # E2/E3: escalado de meio de loop passa pelo pacote; correção no-op escala
    assert "escaladoComPacote" in text, "mid-loop escalados must route through the pacote"
    assert "não produziu mudança executável" in text, "no-progress corrections must escalate"
    # E6: relatório de modelos vem do registro de execução real, não de flags globais
    assert "execucoesPorStep" in text, "per-step effective model must be recorded at execution time"
    # E7: texto livre em comando de shell passa por escape
    assert "const shq" in text and "shq(rota.textoEsperado)" in text, "free text into shell must be escaped"


def test_successful_routes_require_the_thematic_segment() -> None:
    """O schema chama o campo de raca por compatibilidade, mas ele não pode sumir no runtime."""
    text = HARNESS.read_text(encoding="utf-8")
    assert "!portao.rota.raca" in text, "approved route must carry the thematic render segment"
    assert "segmento temático" in text, "the runtime error must explain the generic meaning of raca"


def test_schemas_allow_refusal_and_require_guard_booleans() -> None:
    text = HARNESS.read_text(encoding="utf-8")
    m = re.search(r"const ROTAS_SCHEMA = \{[^\n]*required: \[([^\]]*)\]", text)
    assert m and [s.strip().strip("'") for s in m.group(1).split(",")] == ["ok"], (
        "ROTAS_SCHEMA must require only 'ok' — a refusal (brief vago) must be schema-legal"
    )
    m = re.search(r"const PORTAO_SCHEMA = \{[^\n]*required: \[([^\]]*)\]", text)
    assert m, "PORTAO_SCHEMA required list missing"
    required = {s.strip().strip("'") for s in m.group(1).split(",")}
    assert {"ok", "aprovada", "renderJaExiste", "reproduzir", "roughExiste"} <= required, (
        "guard booleans must be required — omissão schema-legal anularia as proteções"
    )


def test_harness_validador_is_opus_only_and_diretor_promotes_to_fable() -> None:
    text = HARNESS.read_text(encoding="utf-8")
    for step in ("selecao", "crit", "confirmacao"):
        m = re.search(rf"{step}:\s*\{{[^}}]*permitidos: \[([^\]]*)\]", text)
        assert m and m.group(1).strip() == "'opus'", f"{step} must allow opus only"
    m = re.search(r"rotas:\s*\{[^}]*padrao: '(\w+)'", text)
    assert m and m.group(1) == "fable", "diretor defaults to fable (odin arquiteto mirror)"


def test_harness_never_uses_forbidden_runtime_calls() -> None:
    text = HARNESS.read_text(encoding="utf-8")
    for forbidden in ("Date.now", "Math.random", "new Date("):
        assert forbidden not in text, f"{forbidden} breaks workflow resume"


def test_skill_documents_both_stages_and_optin() -> None:
    text = SKILL.read_text(encoding="utf-8")
    assert "estagio: \"rotas\"" in text and "estagio: \"produzir\"" in text
    assert "opt-in" in text, "cost opt-in is mandatory before invoking"
    assert "rota_aprovada" in text
    assert "${CLAUDE_PLUGIN_ROOT}/skills/criativo-fluxo/harness/criativo.mjs" in text


def test_defaults_reference_matches_harness_steps() -> None:
    text = DEFAULTS_REF.read_text(encoding="utf-8")
    for step in EXPECTED_STEPS:
        assert f"`{step}`" in text, f"defaults reference must document step {step}"
    for campo in ("criativo_diretor", "criativo_haiku", "criativo_perfil"):
        assert campo in text


def test_skill_translates_every_documented_default() -> None:
    """Campo documentado em references/defaults.md sem tradução na SKILL é contrato órfão."""
    skill = SKILL.read_text(encoding="utf-8")
    for campo in ("criativo_diretor", "criativo_haiku", "criativo_produtor", "criativo_perfil",
                  "criativo_modelo_por_step", "criativo_effort_por_step"):
        assert campo in skill, f"SKILL.md must teach how to translate {campo}"


def test_skill_always_injects_resolved_dirs_and_harness_only_defaults_for_legacy_callers() -> None:
    skill = SKILL.read_text(encoding="utf-8")
    harness = HARNESS.read_text(encoding="utf-8")
    assert "sempre injeta" in skill, "the skill must pass every resolved base through dirs"
    assert "retrocompatibilidade" in harness, "missing dirs must be documented as legacy fallback only"


def test_validador_agent_carries_hardened_criteria() -> None:
    text = (AGENTS_DIR / "validador-de-criativo.md").read_text(encoding="utf-8")
    for criterio in EXPECTED_CRITERIA:
        assert criterio in text, f"validador must define criterion {criterio}"
    assert "REFUTAR" in text, "adversarial posture must be explicit"
    assert "plausivel" in text, "plausible findings must exist (confirmation flow)"


def test_crit_schema_enum_matches_criteria_exactly() -> None:
    """O critério é ENUM no schema (contrato executável), não string livre num comentário."""
    text = HARNESS.read_text(encoding="utf-8")
    m = re.search(r"criterio: \{ enum: \[([^\]]+)\]", text)
    assert m, "CRIT_SCHEMA.criterio must be an enum"
    declared = sorted(s.strip().strip("'") for s in m.group(1).split(","))
    assert declared == sorted(EXPECTED_CRITERIA), f"enum drifted: {set(declared) ^ set(EXPECTED_CRITERIA)}"


def test_criteria_copies_stay_consistent() -> None:
    """As cópias dos critérios A-J (agent, skill avulsa, enum do harness) não podem divergir."""
    agent = (AGENTS_DIR / "validador-de-criativo.md").read_text(encoding="utf-8")
    skill = (PLUGIN_DIR / "skills" / "validar-criativo" / "SKILL.md").read_text(encoding="utf-8")
    for criterio in EXPECTED_CRITERIA:
        assert criterio in agent, f"agent lost criterion {criterio}"
        assert criterio in skill, f"skill validar-criativo lost criterion {criterio}"


def test_design_principles_mirrored_in_agent_and_skill() -> None:
    """Princípios de estúdio: espelho deliberado agent↔skill — este teste avisa se divergir."""
    agent = (AGENTS_DIR / "diretor-de-arte.md").read_text(encoding="utf-8").lower()
    skill = (PLUGIN_DIR / "skills" / "direcao-de-arte" / "SKILL.md").read_text(encoding="utf-8").lower()
    for marcador in ("uma mensagem por pe", "hierarquia", "respiro", "thumbnail", "proximidade"):
        assert marcador in agent, f"diretor agent lost principle marker '{marcador}'"
        assert marcador in skill, f"direcao-de-arte skill lost principle marker '{marcador}'"
