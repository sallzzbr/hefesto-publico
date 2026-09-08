#!/usr/bin/env python3
"""Validate the filesystem contract required by criativo-fluxo without executing it."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable


CAPABILITIES = ("texto", "imagem-ia")


def resolve_from(workspace: Path, configured: str) -> Path:
    path = Path(configured).expanduser()
    return path.resolve() if path.is_absolute() else (workspace / path).resolve()


def missing_file(items: list[dict[str, str]], code: str, path: Path) -> None:
    if not path.is_file():
        items.append({"code": code, "path": str(path), "expected": "file"})


def missing_dir(items: list[dict[str, str]], code: str, path: Path) -> None:
    if not path.is_dir():
        items.append({"code": code, "path": str(path), "expected": "directory"})


def pillow_present(venv: Path) -> bool:
    candidates: Iterable[Path] = (
        venv / "Lib" / "site-packages" / "PIL",
        venv / "lib" / "site-packages" / "PIL",
    )
    if any(path.is_dir() for path in candidates):
        return True
    lib = venv / "lib"
    return lib.is_dir() and any(
        path.is_dir() for path in lib.glob("python*/site-packages/PIL")
    )


def inspect_workspace(args: argparse.Namespace) -> dict[str, object]:
    workspace = Path(args.workspace).expanduser().resolve()
    dirs = {
        "marketing": resolve_from(workspace, args.marketing),
        "branding": resolve_from(workspace, args.branding),
        "contexto": resolve_from(workspace, args.contexto),
        "scripts": resolve_from(workspace, args.scripts),
    }
    venv = resolve_from(workspace, args.venv)
    if args.python:
        python = resolve_from(workspace, args.python)
    else:
        unix_python = venv / "bin" / "python"
        windows_python = venv / "Scripts" / "python.exe"
        python = unix_python if unix_python.is_file() or not windows_python.is_file() else windows_python

    common: list[dict[str, str]] = []
    for code, path in (
        ("branding.principios", dirs["branding"] / "principios-criativos.md"),
        ("branding.arquetipos", dirs["branding"] / "arquetipos-criativos.md"),
        ("branding.tom_de_voz", dirs["branding"] / "tom-de-voz-aplicado.md"),
        ("contexto.identidade_visual", dirs["contexto"] / "identidade-visual.md"),
        ("scripts.validador", dirs["scripts"] / "validar_criativo.py"),
    ):
        missing_file(common, code, path)
    for code, path in (
        ("marketing.briefs", dirs["marketing"] / "criativos" / "briefs"),
        ("marketing.base", dirs["marketing"] / "criativos" / "base"),
        ("marketing.renders", dirs["marketing"] / "criativos" / "renders"),
        ("marketing.registry", dirs["marketing"] / "registry" / "criativos"),
        ("marketing.pacotes", dirs["marketing"] / "producao" / "pacotes-aprovacao"),
    ):
        missing_dir(common, code, path)
    if not any(path.is_file() for path in dirs["scripts"].glob("compor_*.py")):
        common.append({
            "code": "scripts.compositor",
            "path": str(dirs["scripts"] / "compor_*.py"),
            "expected": "at least one matching file",
        })
    missing_file(common, "python.executavel", python)
    if not pillow_present(venv):
        common.append({
            "code": "python.pillow",
            "path": str(venv),
            "expected": "PIL package in the workspace virtual environment",
        })

    per_capability: dict[str, list[dict[str, str]]] = {
        "texto": list(common),
        "imagem-ia": list(common),
    }
    missing_file(
        per_capability["imagem-ia"],
        "scripts.gerador",
        dirs["scripts"] / "gerar_imagem.py",
    )
    selected = args.capability or list(CAPABILITIES)
    missing = []
    seen: set[str] = set()
    for capability in selected:
        for item in per_capability[capability]:
            if item["code"] not in seen:
                missing.append(item)
                seen.add(item["code"])

    warnings: list[dict[str, str]] = []
    visual_bank = dirs["marketing"] / "referencias" / "banco-visual"
    if not visual_bank.is_dir() or not any(path.is_file() for path in visual_bank.iterdir()):
        warnings.append({
            "code": "marketing.banco_visual_vazio",
            "path": str(visual_bank),
            "effect": "allowed, but reference anchoring is degraded",
        })

    return {
        "ready": not missing,
        "workspace": str(workspace),
        "dirs": {name: str(path) for name, path in dirs.items()},
        "python": str(python),
        "selected_capabilities": selected,
        "capabilities": {
            capability: not per_capability[capability] for capability in CAPABILITIES
        },
        "missing": missing,
        "warnings": warnings,
        "scope": "filesystem presence and consumer contract only; no scripts were executed",
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Check the consumer workspace required by Hermes before generation."
    )
    parser.add_argument("--workspace", default=".", help="consumer workspace root")
    parser.add_argument("--marketing", default="marketing", help="resolved local_marketing")
    parser.add_argument("--branding", default="branding", help="resolved local_branding")
    parser.add_argument("--contexto", default="contexto", help="resolved local_contexto")
    parser.add_argument("--scripts", default="scripts", help="resolved local_scripts")
    parser.add_argument("--venv", default=".venv", help="workspace virtual environment")
    parser.add_argument("--python", help="resolved Python executable (default: inside --venv)")
    parser.add_argument(
        "--capability",
        action="append",
        choices=CAPABILITIES,
        help="capability to require; repeatable, defaults to both",
    )
    return parser


def main() -> int:
    report = inspect_workspace(build_parser().parse_args())
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if report["ready"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
