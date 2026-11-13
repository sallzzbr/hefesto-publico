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
EXPECTED_CRITERIA_A_J = [
    "arquetipo_correto", "rosto_nao_coberto", "principios_duros", "fidelidade_referencia", "fidelidade_mockup",
    "naturalidade_ia", "texto_correto", "legibilidade_thumbnail",
    "mensagem_completa", "voz_da_marca",
]
# lente de ideia (K-Q): contrato executável desde o hermes 1.5.2 (HERMES-1, decisão 14 do
# dono). Antes o enum tinha só A-J e o validador remapeava K-Q para slugs vizinhos; com a
# headline travada, "[P verdade_comercial]" remapeado para voz_da_marca virava sinalização.
EXPECTED_CRITERIA_K_Q = [
    "tres_segundos", "miniatura", "desfoque", "exclusao", "coerencia_imagem_copy",
    "verdade_comercial", "headline_tem_ideia",
]
EXPECTED_CRITERIA = EXPECTED_CRITERIA_A_J + EXPECTED_CRITERIA_K_Q


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
    assert "c.base === '{{BASE}}' ? base : c.base" in text, "base substitution must be code via {{BASE}}"
    # E1: aprovação visual enforced — rough da rota aprovada precisa existir
    assert "roughExiste === false" in text, "visual approval must be enforced by the gate"
    # E2/E3: escalado de meio de loop passa pelo pacote; correção no-op escala
    assert "escaladoComPacote" in text, "mid-loop escalados must route through the pacote"
    assert "não produziu mudança executável" in text, "no-progress corrections must escalate"
    # E6: relatório de modelos vem do registro de execução real, não de flags globais
    assert "execucoesPorStep" in text, "per-step effective model must be recorded at execution time"
    # E7: texto livre em comando de shell passa por escape
    assert "const shq" in text and "q(textoPf)" in text, "free text into shell must be escaped"


def test_successful_routes_require_the_segment_and_acoes() -> None:
    """O segmento nomeia a subpasta de renders e as acoes são o único contrato de comando: nenhum dos dois pode sumir no runtime."""
    text = HARNESS.read_text(encoding="utf-8")
    assert "!portao.rota.segmento" in text, "approved route must carry the render segment"
    assert "!rotaTemAcoes" in text, "approved route must carry the structured actions"
    assert "segmento e acoes são obrigatórios" in text, "the runtime error must name both fields"


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
    """As cópias dos critérios A-Q (agent, skill avulsa, enum do harness) não podem divergir."""
    agent = (AGENTS_DIR / "validador-de-criativo.md").read_text(encoding="utf-8")
    skill = (PLUGIN_DIR / "skills" / "validar-criativo" / "SKILL.md").read_text(encoding="utf-8")
    for criterio in EXPECTED_CRITERIA:
        assert criterio in agent, f"agent lost criterion {criterio}"
        assert criterio in skill, f"skill validar-criativo lost criterion {criterio}"


def test_no_hermes_file_tells_to_remap_k_q_into_a_j_slugs() -> None:
    """K-Q têm slug próprio no enum: instrução de remapear para um slug A-J é contrato morto.

    O remapeamento antigo (K/O para mensagem_completa, L/M/N para legibilidade_thumbnail, P/Q
    para voz_da_marca) fazia a trava de headline engolir verdade comercial. CHANGELOG fica de
    fora porque é histórico; tests/ fica de fora porque cita o padrão para proibi-lo.
    """
    proibidos = [
        re.compile(r"slug mais pr[oó]ximo"),
        re.compile(r"\b[K-Q](?:/[K-Q])+\s*(?:→|->)"),
        re.compile(r"restringir `?criterio`? aos slugs A-J"),
    ]
    vistos = 0
    faltas = []
    for path in sorted(PLUGIN_DIR.rglob("*")):
        if path.is_dir() or path.suffix not in {".md", ".mjs"} or path.name == "CHANGELOG.md":
            continue
        if "tests" in path.relative_to(PLUGIN_DIR).parts:
            continue
        vistos += 1
        texto = path.read_text(encoding="utf-8")
        for padrao in proibidos:
            if padrao.search(texto):
                faltas.append(f"{path.relative_to(PLUGIN_DIR)}: {padrao.pattern}")
    assert vistos > 20, f"varredura viu só {vistos} arquivos: escopo quebrou"
    assert not faltas, f"instrução de remapear K-Q ainda presente: {faltas}"
    agent = (AGENTS_DIR / "validador-de-criativo.md").read_text(encoding="utf-8")
    assert "slug próprio" in agent, "validador must say each criterion uses its own slug"


def _prosa(texto: str) -> str:
    """Ênfase markdown e quebra de linha não contam na comparação de prosa."""
    return re.sub(r"\s+", " ", re.sub(r"[*`]", "", texto))


def test_q_sends_the_commercial_truth_test_to_p() -> None:
    """O 4º teste de copy de Q (verdade comercial) é julgado e reportado em P.

    Revisão do HERMES-1: Q listava verdade comercial entre os seus testes, então a promessa falsa
    da headline podia sair como headline_tem_ideia, que a trava de headline rebaixa a sinalização.
    """
    for path in (AGENTS_DIR / "validador-de-criativo.md", PLUGIN_DIR / "skills" / "validar-criativo" / "SKILL.md"):
        texto = _prosa(path.read_text(encoding="utf-8"))
        assert "verdade comercial, que é julgada e reportada em P" in texto, f"{path.name}: Q must hand the 4th copy test to P"
        assert "é finding verdade_comercial, nunca headline_tem_ideia" in texto, f"{path.name}: false promise must keep the P slug"
        assert "verdade comercial. Headline reprovada" not in texto, f"{path.name}: Q still owns the commercial truth test"


def test_skill_ties_copy_discard_to_the_trava_and_lists_k_o() -> None:
    """Revisão do HERMES-1: o descarte de copyCorrigida é efeito da trava, não da verdade comercial
    sem trava; K e O entram na lista do que a trava rebaixa."""
    texto = _prosa(_skill_text())
    descarte = texto.find("Com a trava, copyCorrigida da correção é descartada")
    sem_trava = texto.find("Verdade comercial sem a trava")
    assert descarte >= 0, "SKILL must tie the copyCorrigida discard to the trava"
    assert sem_trava > descarte, "the no-trava commercial truth sentence must come after the discard"
    for slug in ("tres_segundos", "coerencia_imagem_copy"):
        assert f"/ {slug}" in texto, f"SKILL must list {slug} among the criteria the trava rebaixa"


def test_design_principles_mirrored_in_agent_and_skill() -> None:
    """Princípios de estúdio: espelho deliberado agent↔skill — este teste avisa se divergir."""
    agent = (AGENTS_DIR / "diretor-de-arte.md").read_text(encoding="utf-8").lower()
    skill = (PLUGIN_DIR / "skills" / "direcao-de-arte" / "SKILL.md").read_text(encoding="utf-8").lower()
    for marcador in ("uma mensagem por pe", "hierarquia", "respiro", "thumbnail", "proximidade"):
        assert marcador in agent, f"diretor agent lost principle marker '{marcador}'"
        assert marcador in skill, f"direcao-de-arte skill lost principle marker '{marcador}'"


# ── hermes 1.4.0 (A3, A5, A6) ────────────────────────────────────────────────

def _skill_text() -> str:
    return SKILL.read_text(encoding="utf-8")


def test_a3_harness_reads_reproduzir_and_headline_args() -> None:
    text = HARNESS.read_text(encoding="utf-8")
    assert "ARGS.reproduzir" in text, "args.reproduzir must release an existing render at the gate"
    assert "ARGS.headline" in text, "args.headline must override the copy of the run"


def test_a3_skill_documents_the_reexecution_roteiro() -> None:
    text = _skill_text()
    assert "args.reproduzir" in text, "SKILL must teach args.reproduzir"
    assert "args.headline" in text, "SKILL must teach args.headline"
    assert "reexecu" in text.lower(), "SKILL must carry the re-execution roteiro"
    assert "rota_aprovada" in text and "reproduzir" in text


def test_a5_catalog_sales_text_does_not_prescribe_cloning() -> None:
    text = _skill_text()
    assert "clonagem de conjunto" not in text, "SKILL must not prescribe adset cloning for Catalog Sales"
    assert "Catalog Sales" in text
    assert "do zero" in text, "SKILL must say the adset is created from scratch"
    assert "imutável" in text, "SKILL must say the promoted product is immutable when cloning"
    assert "herda" in text, "SKILL must say cloning inherits the promoted product"


def test_a5_historic_changelog_stays_intact() -> None:
    changelog = (PLUGIN_DIR / "CHANGELOG.md").read_text(encoding="utf-8")
    assert "exige formato de creative e clonagem de conjunto" in changelog, "historic entry must not be rewritten"


def test_a6_skill_documents_invocation_without_cache_copy() -> None:
    text = _skill_text()
    assert "recusad" in text, "SKILL must cover a refused scriptPath"
    assert re.search(r"`script`", text), "SKILL must tell to pass the .mjs source in `script`"
    assert "ler o `.mjs`" in text or "ler o .mjs" in text, "SKILL must tell to read the .mjs"


def test_a6_harness_is_self_contained_and_parses() -> None:
    import shutil
    import subprocess
    import tempfile

    text = HARNESS.read_text(encoding="utf-8")
    assert not re.search(r"^\s*import\s", text, re.MULTILINE), "harness must not import"
    assert not re.search(r"\brequire\(", text), "harness must not require"
    node = shutil.which("node")
    if node is None:
        import pytest
        pytest.skip("node not available")
    lines = text.split("\n")
    meta_end = next(i for i, line in enumerate(lines) if line == "}")
    wrapped = (
        "\n".join(lines[: meta_end + 1])
        + "\nconst args = {}; const agent = async () => {}; const parallel = async () => {};"
        + " const log = () => {}; const phase = () => {};\nasync function __check() {\n"
        + "\n".join(lines[meta_end + 1 :])
        + "\n}\n"
    )
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False) as handle:
        handle.write(wrapped)
        tmp = handle.name
    result = subprocess.run([node, "--check", tmp], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr


def test_u1_skill_documents_real_headline_trava_and_flag_behavior() -> None:
    text = _skill_text()
    assert "Subheadline" in text, "SKILL must say args.headline never replaces the Subheadline"
    assert "Limitação" in text and "textos" in text, "SKILL must state the honest limit of headlineTravada"
    assert "sobrescrever: true" in text, "SKILL must say how the compositor overwrite flag is requested"
    assert "gerar_imagem.py" in text and "semGeracao" in text


# ── decisões 17A e 18C do dono (2026-11-03) ──────────────────────────────────

def _schema_line(text: str, nome: str) -> str:
    match = re.search(rf"^const {nome} = (.*)$", text, re.MULTILINE)
    assert match, f"{nome} missing from the harness"
    return match.group(1)


def test_17a_18c_every_verdict_schema_requires_a_non_empty_porque() -> None:
    """17A: refutação sem porque descartava o finding. Todo schema de veredito exige porque não
    vazio; o controlador recusa porque só com espaços (casos 17A no teste comportamental)."""
    text = HARNESS.read_text(encoding="utf-8")
    veredito = _schema_line(text, "VEREDITO_SCHEMA")
    assert "required: ['real', 'porque']" in veredito, "VEREDITO_SCHEMA must require porque"
    assert "porque: { type: 'string', minLength: 20 }" in veredito, "porque must require at least 20 characters"
    promessa = _schema_line(text, "PROMESSA_SCHEMA")
    assert "required: ['promessaFalsa', 'porque']" in promessa, "PROMESSA_SCHEMA must require promessaFalsa and porque"
    assert "porque: { type: 'string', minLength: 20 }" in promessa, "porque must require at least 20 characters"
    assert "additionalProperties: false" in veredito and "additionalProperties: false" in promessa
    assert "label: `promessa:i${iteracao}`" in text, "the promise confirmation needs its own label"


def test_18c_docs_describe_the_promise_confirmation_and_17a() -> None:
    """A trava descrita na SKILL e no validador precisa dizer que headline_tem_ideia passa pela
    confirmação de promessa, e a T3 precisa dizer que refutação sem porque não descarta."""
    skill = _prosa(_skill_text())
    agent = _prosa((AGENTS_DIR / "validador-de-criativo.md").read_text(encoding="utf-8"))
    for nome, texto in (("SKILL.md", skill), ("validador-de-criativo.md", agent)):
        assert "confirmação de promessa" in texto, f"{nome} must describe the promise confirmation"
        assert "produto, variação, serviço ou condição" in texto, f"{nome} must state the promise question"
        assert "refutação sem porque" in texto, f"{nome} must say a refutation without porque is refused"
