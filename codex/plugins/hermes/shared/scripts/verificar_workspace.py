#!/usr/bin/env python3
"""Validate the filesystem contract required by criativo-fluxo without executing it."""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Iterable


CAPABILITIES = ("texto", "imagem-ia")

# Perfil do negócio (E3, C1): uma linha `chave: valor` por campo, em Markdown. O path chega
# resolvido pela skill (regra única de path: CLAUDE.md, defaults, cwd, default documentado).
SLUG = re.compile(r"^[a-z0-9][a-z0-9_-]{0,80}$")
# Formato e nomes reservados dos eixos: a MESMA fonte que o analisar-produto.mjs lê (references/eixos.json),
# para o preflight não aprovar um perfil que o script recusa.
_EIXOS = json.loads((Path(__file__).resolve().parent.parent / "references" / "eixos.json").read_text(encoding="utf-8"))
FORMATO_EIXO = re.compile(_EIXOS["formato"])
EIXOS_RESERVADOS = frozenset(_EIXOS["reservados"])
LINHA_DO_PERFIL = re.compile(r"^\s*([a-z_]+)\s*:\s*(.*?)\s*$")
CAMPOS_TEXTO = ("modelo", "evento_conversao", "metrica_norte", "aprovador", "exclusao_vendas_internas")
CAMPOS_DO_PERFIL = (*CAMPOS_TEXTO, "moeda", "pais", "canais_ativos", "segmentos", "eixos")
# Campos que nenhuma skill ou script do plugin consome hoje: ausentes viram aviso (`perfil.<campo>`), não
# bloqueio; presentes e inválidos continuam bloqueando. moeda, segmentos e eixos alimentam a régua, o harness
# e o analisar-produto, por isso seguem obrigatórios.
CAMPOS_OPCIONAIS = ("modelo", "pais", "evento_conversao", "metrica_norte", "canais_ativos", "aprovador", "exclusao_vendas_internas")


def lista(valor: str) -> list[str]:
    return [item.strip() for item in valor.split(",")]


def ler_perfil(path: Path) -> tuple[dict[str, object], list[dict[str, str]], list[dict[str, str]]]:
    """Lê o perfil e devolve (campos válidos, pendências, avisos). Nunca assume default."""
    if not path.is_file():
        return {}, [{"code": "perfil.arquivo", "path": str(path), "expected": "file"}], []
    brutos: dict[str, str] = {}
    duplicados: set[str] = set()
    for linha in path.read_text(encoding="utf-8-sig").splitlines():
        achou = LINHA_DO_PERFIL.match(linha)
        if achou and achou.group(1) in CAMPOS_DO_PERFIL:
            if achou.group(1) in brutos:
                duplicados.add(achou.group(1))
            brutos[achou.group(1)] = achou.group(2)
    perfil: dict[str, object] = {}
    pendencias: list[dict[str, str]] = []
    avisos: list[dict[str, str]] = []
    for campo in CAMPOS_DO_PERFIL:
        valor = brutos.get(campo)
        if valor is None and campo in CAMPOS_OPCIONAIS:
            avisos.append({"code": f"perfil.{campo}", "path": str(path), "effect": "campo opcional ausente: nenhuma skill do plugin o consome hoje"})
            continue
        if valor is None:
            pendencias.append({"code": f"perfil.{campo}", "path": str(path), "expected": "campo presente"})
            continue
        if campo in duplicados:
            pendencias.append({"code": f"perfil.{campo}", "path": str(path), "expected": "um único valor (campo repetido)"})
            continue
        if campo in CAMPOS_TEXTO:
            valido: object = valor if valor else None
        elif campo == "moeda":
            valido = valor if re.fullmatch(r"[A-Z]{3}", valor) else None
        elif campo == "pais":
            valido = valor if re.fullmatch(r"[A-Z]{2}", valor) else None
        else:
            itens = lista(valor)
            unicos = len(set(itens)) == len(itens)
            if campo == "segmentos":
                bom = bool(valor) and unicos and all(SLUG.match(item) for item in itens)
            elif campo == "eixos":
                bom = bool(valor) and unicos and all(FORMATO_EIXO.match(item) and item not in EIXOS_RESERVADOS for item in itens)
            else:
                bom = bool(valor) and unicos and all(itens)
            valido = itens if bom else None
        if valido is None:
            pendencias.append({"code": f"perfil.{campo}", "path": str(path), "expected": "valor válido"})
        else:
            perfil[campo] = valido
    return perfil, pendencias, avisos


def resolve_from(workspace: Path, configured: str) -> Path:
    path = Path(configured).expanduser()
    return path.resolve() if path.is_absolute() else (workspace / path).resolve()


def missing_file(items: list[dict[str, str]], code: str, path: Path) -> None:
    if not path.is_file():
        items.append({"code": code, "path": str(path), "expected": "file"})


def missing_dir(items: list[dict[str, str]], code: str, path: Path) -> None:
    if not path.is_dir():
        items.append({"code": code, "path": str(path), "expected": "directory"})


def manifesto_pendencia(path: Path) -> dict[str, str] | None:
    """O manifesto de scripts é obrigatório: sem ele o harness bloqueia no portão, depois dos roughs pagos."""
    if not path.is_file():
        return {"code": "scripts.manifesto", "path": str(path), "expected": "file"}
    try:
        dados = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return {"code": "scripts.manifesto", "path": str(path), "expected": "JSON válido"}
    scripts = dados.get("scripts") if isinstance(dados, dict) else None
    if not isinstance(scripts, list) or not scripts:
        return {"code": "scripts.manifesto", "path": str(path), "expected": "objeto JSON com a lista não vazia `scripts`"}
    for posicao, entrada in enumerate(scripts):
        motivo = entrada_invalida(entrada)
        if motivo:
            return {"code": "scripts.manifesto", "path": str(path), "expected": f"entrada {posicao} de `scripts`: {motivo}"}
    return None


def entrada_invalida(entrada: object) -> str | None:
    """Forma que o harness exige de cada compositor: nome e executavel em texto, campos em objeto."""
    if not isinstance(entrada, dict):
        return "objeto com `nome`, `executavel` e `campos`"
    for chave in ("nome", "executavel"):
        valor = entrada.get(chave)
        if not isinstance(valor, str) or not valor.strip():
            return f"`{chave}` deve ser texto não vazio"
    if not isinstance(entrada.get("campos"), dict):
        return "`campos` deve ser um objeto"
    return None


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
    manifesto = resolve_from(workspace, args.manifesto) if args.manifesto else dirs["scripts"] / "manifesto-scripts.json"
    if args.python:
        configured_python = Path(args.python).expanduser()
        python = Path(os.path.abspath(configured_python if configured_python.is_absolute() else workspace / configured_python))
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
    pendencia_manifesto = manifesto_pendencia(manifesto)
    if pendencia_manifesto:
        common.append(pendencia_manifesto)
    if python.parent.resolve() not in {(venv / "bin").resolve(), (venv / "Scripts").resolve()}:
        common.append({"code": "python.fora_do_venv", "path": str(python), "expected": "Python entrypoint inside the selected venv bin or Scripts directory"})
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

    perfil, pendencias_do_perfil, avisos_do_perfil = ler_perfil(resolve_from(workspace, args.perfil))
    for capability in selected:
        per_capability[capability].extend(pendencias_do_perfil)
    missing = []
    seen = set()
    for capability in selected:
        for item in per_capability[capability]:
            if item["code"] not in seen:
                missing.append(item)
                seen.add(item["code"])

    warnings: list[dict[str, str]] = list(avisos_do_perfil)
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
        "perfil": perfil,
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
    parser.add_argument("--perfil", default="perfil-do-negocio.md", help="resolved local_perfil (business profile)")
    parser.add_argument("--manifesto", help="resolved local_manifesto (default: manifesto-scripts.json inside --scripts)")
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
