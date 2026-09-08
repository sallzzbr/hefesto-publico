"""Behavioral tests for the read-only Hermes workspace preflight."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


PLUGIN_DIR = Path(__file__).parent.parent
SCRIPT = PLUGIN_DIR / "scripts" / "verificar_workspace.py"


def run_preflight(workspace: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--workspace", str(workspace), *args],
        capture_output=True,
        check=False,
        text=True,
    )


def create_complete_workspace(root: Path, *, generator: bool = True) -> None:
    for relative in (
        "branding/principios-criativos.md",
        "branding/arquetipos-criativos.md",
        "branding/tom-de-voz-aplicado.md",
        "contexto/identidade-visual.md",
        "marketing/criativos/briefs/.keep",
        "marketing/criativos/base/.keep",
        "marketing/criativos/renders/.keep",
        "marketing/registry/criativos/.keep",
        "marketing/producao/pacotes-aprovacao/.keep",
        "scripts/compor_texto.py",
        "scripts/validar_criativo.py",
        ".venv/bin/python",
        ".venv/lib/python3.11/site-packages/PIL/__init__.py",
    ):
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("raise RuntimeError('must not execute')\n", encoding="utf-8")
    if generator:
        (root / "scripts" / "gerar_imagem.py").write_text(
            "raise RuntimeError('must not execute')\n", encoding="utf-8"
        )


def test_incomplete_workspace_reports_every_missing_prerequisite(tmp_path: Path) -> None:
    result = run_preflight(tmp_path)

    assert result.returncode == 1
    report = json.loads(result.stdout)
    assert report["ready"] is False
    assert {item["code"] for item in report["missing"]} >= {
        "branding.principios",
        "contexto.identidade_visual",
        "scripts.gerador",
        "scripts.compositor",
        "scripts.validador",
        "python.executavel",
        "python.pillow",
    }


def test_complete_synthetic_workspace_is_ready_without_executing_consumer_scripts(
    tmp_path: Path,
) -> None:
    create_complete_workspace(tmp_path)

    result = run_preflight(tmp_path)

    assert result.returncode == 0, result.stderr or result.stdout
    report = json.loads(result.stdout)
    assert report["ready"] is True
    assert report["missing"] == []
    assert report["capabilities"] == {"imagem-ia": True, "texto": True}


def test_requested_capability_only_requires_the_scripts_it_consumes(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path, generator=False)

    text_result = run_preflight(tmp_path, "--capability", "texto")
    image_result = run_preflight(tmp_path, "--capability", "imagem-ia")

    assert text_result.returncode == 0
    assert json.loads(text_result.stdout)["ready"] is True
    assert image_result.returncode == 1
    image_report = json.loads(image_result.stdout)
    assert image_report["ready"] is False
    assert [item["code"] for item in image_report["missing"]] == ["scripts.gerador"]


def test_configured_directories_are_resolved_relative_to_workspace(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    (tmp_path / "brand-custom").mkdir()
    for source in (tmp_path / "branding").iterdir():
        source.rename(tmp_path / "brand-custom" / source.name)
    (tmp_path / "branding").rmdir()
    (tmp_path / ".venv").rename(tmp_path / "env-custom")

    result = run_preflight(
        tmp_path,
        "--branding",
        "brand-custom",
        "--venv",
        "env-custom",
        "--python",
        "env-custom/bin/python",
    )

    assert result.returncode == 0, result.stdout
    report = json.loads(result.stdout)
    assert report["dirs"]["branding"] == str((tmp_path / "brand-custom").resolve())
    assert report["python"] == str((tmp_path / "env-custom" / "bin" / "python").resolve())


def test_directory_named_like_compositor_does_not_satisfy_script_contract(
    tmp_path: Path,
) -> None:
    create_complete_workspace(tmp_path)
    compositor = tmp_path / "scripts" / "compor_texto.py"
    compositor.unlink()
    compositor.mkdir()

    result = run_preflight(tmp_path, "--capability", "texto")

    assert result.returncode == 1
    report = json.loads(result.stdout)
    assert "scripts.compositor" in {item["code"] for item in report["missing"]}


def test_file_named_pil_does_not_satisfy_installed_package_contract(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    pil = tmp_path / ".venv" / "lib" / "python3.11" / "site-packages" / "PIL"
    (pil / "__init__.py").unlink()
    pil.rmdir()
    pil.write_text("not a package\n", encoding="utf-8")

    result = run_preflight(tmp_path, "--capability", "texto")

    assert result.returncode == 1
    report = json.loads(result.stdout)
    assert "python.pillow" in {item["code"] for item in report["missing"]}
