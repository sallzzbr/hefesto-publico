"""Contract checks for hermes skills, manifests and portability (hermes 1.0)."""

from __future__ import annotations

import json
import re
from pathlib import Path


PLUGIN_DIR = Path(__file__).parent.parent
MARKETPLACE = PLUGIN_DIR.parent.parent / ".claude-plugin" / "marketplace.json"

EXPECTED_SKILLS = [
    # cluster criativo (fluxo de estúdio)
    "criativo-fluxo", "direcao-de-arte", "sugerir-criativos", "validar-criativo",
    "evoluir-vencedor", "analisar-criativos",
    # analíticas destiladas
    "unit-economics", "pnl-mensal", "fadiga-criativa", "otimizar-verba",
    "auditoria-de-estrutura", "auditoria-cro",
    # rituais promovidos do workspace (Fase 8)
    "analise-diaria", "saude-do-funil", "sintese-semanal", "diagnostico-site-funil",
]


def skill_dirs() -> list[Path]:
    return sorted(p for p in (PLUGIN_DIR / "skills").iterdir() if p.is_dir())


def test_expected_skills_exist_exactly() -> None:
    names = [p.name for p in skill_dirs()]
    assert sorted(names) == sorted(EXPECTED_SKILLS), f"skill set drifted: {set(names) ^ set(EXPECTED_SKILLS)}"


def test_every_skill_has_frontmatter_description_with_triggers() -> None:
    for d in skill_dirs():
        text = (d / "SKILL.md").read_text(encoding="utf-8")
        m = re.match(r'^---\ndescription: "(.+?)"\n---\n', text, re.DOTALL)
        assert m, f"{d.name}/SKILL.md must start with a quoted description frontmatter"
        desc = m.group(1)
        assert len(desc) > 80, f"{d.name} description too short to route"
        assert "Use when" in desc, f"{d.name} description must carry usage triggers"


def test_no_absolute_os_paths_in_plugin_files() -> None:
    token = "/" + "Users" + "/"  # montado em partes pra este arquivo não se autoacusar
    for path in PLUGIN_DIR.rglob("*"):
        if path.is_dir() or path.suffix in {".png", ".pyc"} or "__pycache__" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        assert token not in text, f"{path.relative_to(PLUGIN_DIR)} carries an absolute OS path"


def test_no_workspace_credentials_or_account_ids_in_plugin() -> None:
    # a regra da fase: o plugin não carrega dados/credenciais/IDs do workspace de origem —
    # nem nomes do negócio, do nicho ou de pessoa: metodologia que cita o caso concreto não é
    # metodologia, é operação vazada. Escopo: todo .md e .mjs do plugin (README, skills,
    # agents, references e harness), EXCETO CHANGELOG.md — histórico publicado não se
    # reescreve. plugin.json (author) fica fora por não ser .md/.mjs: autoria é legítima.
    forbidden = [
        "000000000000000", "CA_ExemploLoja", "META_ACCESS_TOKEN", "111111111", "exemplo.loja",
        "ExemploLoja", "Shih Tzu", "Fulana",
    ]
    scanned = 0
    for path in PLUGIN_DIR.rglob("*"):
        if path.is_dir() or path.suffix not in {".md", ".mjs"} or "__pycache__" in path.parts:
            continue
        if path.name == "CHANGELOG.md":
            continue
        scanned += 1
        text = path.read_text(encoding="utf-8")
        for token in forbidden:
            assert token not in text, f"{path.relative_to(PLUGIN_DIR)} leaks workspace-coupled token {token}"
    assert scanned > 20, f"varredura anti-vazamento viu só {scanned} arquivos — escopo quebrou"


def test_ruler_numbers_are_lookup_not_literals() -> None:
    # réguas de decisão vêm do unit-economics mais recente, nunca hardcoded (achado da Fase 7:
    # R$56 × R$63,57 inconsistentes entre commands do workspace)
    for d in skill_dirs():
        text = (d / "SKILL.md").read_text(encoding="utf-8")
        assert not re.search(r"CAC (alvo|máximo|max)[^.\n]*R\$\s*\d", text), (
            f"{d.name} hardcodes a CAC ruler — must be lookup do unit-economics"
        )


def test_plugin_json_and_marketplace_versions_agree() -> None:
    plugin = json.loads((PLUGIN_DIR / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"))
    assert plugin["name"] == "hermes"
    marketplace = json.loads(MARKETPLACE.read_text(encoding="utf-8"))
    entry = next(p for p in marketplace["plugins"] if p["name"] == "hermes")
    assert entry["version"] == plugin["version"], "plugin.json and marketplace.json disagree on version"
    assert entry["source"] == "./plugins/hermes"


def test_readme_documents_no_bragir_dependency_and_workspace_contract() -> None:
    text = (PLUGIN_DIR / "README.md").read_text(encoding="utf-8")
    assert "bragir" in text, "README must document the (non-)dependency on bragir explicitly"
    assert "workspace" in text.lower(), "README must document the workspace layout contract"


def test_boost_traffic_stays_out_of_the_rulers() -> None:
    # tráfego que não otimiza por conversão (boost/impulsionamento) fora de CPA/ROAS/CTR e de
    # veredito, identificado por optimization_goal (nunca pelo nome); gasto total sobrevive
    # rotulado. Gasto sem compra no denominador contamina a régua e derruba decisão boa.
    for name in ("analise-diaria", "saude-do-funil", "otimizar-verba", "pnl-mensal",
                 "analisar-criativos"):
        text = (PLUGIN_DIR / "skills" / name / "SKILL.md").read_text(encoding="utf-8")
        assert "optimization_goal" in text, (
            f"{name} must exclude non-conversion traffic from rulers via optimization_goal"
        )


def test_inference_clause_guards_measurement_to_rule_promotion() -> None:
    # os 3 pontos onde medição vira regra carregam a cláusula de inferência (3 perguntas);
    # sem as respostas, a medição entra como OBSERVAÇÃO, não como regra
    alvos = {
        "criativo-fluxo": "SKILL.md",
        "direcao-de-arte": "SKILL.md",
        "sintese-semanal": "SKILL.md",
    }
    for skill, arquivo in alvos.items():
        text = (PLUGIN_DIR / "skills" / skill / arquivo).read_text(encoding="utf-8")
        for termo in ("Cláusula de inferência", "variância", "variantes relevantes",
                      "contra-exemplo", "OBSERVAÇÃO, não como regra"):
            assert termo in text, f"{skill} lost inference-clause marker: {termo}"


def test_analise_diaria_preserves_the_snapshot_contract() -> None:
    text = (PLUGIN_DIR / "skills" / "analise-diaria" / "SKILL.md").read_text(encoding="utf-8")
    for marker in (
        "modo snapshot",
        "level=account",
        "level=campaign",
        "last_30d",
        "lifetime",
        "dados insuficientes",
    ):
        assert marker in text, f"analise-diaria lost snapshot contract marker: {marker}"
