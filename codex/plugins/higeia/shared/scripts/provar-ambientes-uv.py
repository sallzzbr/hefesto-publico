"""Classifica ambientes do chroma-mcp a partir do JSON de diagnostico.mjs uv no macOS."""
import csv
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

PERFIL = "(version 1)(allow default)(deny network*)(deny file-write*)(deny process-fork)"


def arquivos_conhecidos(raiz, site):
    # RECORD descreve os arquivos instalados por cada distribuição Python.
    registrados = set()
    for recibo in site.glob("*.dist-info/RECORD"):
        with recibo.open(newline="", encoding="utf-8") as f:
            registrados.update(os.path.normpath(site / linha[0]) for linha in csv.reader(f) if linha)
    base = {"pyvenv.cfg", "CACHEDIR.TAG", ".gitignore"}
    base.update("bin/" + nome for nome in (
        "activate", "activate.bat", "activate.ps1", "activate.fish", "activate.nu", "activate_this.py",
        "deactivate.bat", "pydoc.bat", "python", "python3", site.parent.name))
    base.update(str((site / nome).relative_to(raiz)) for nome in ("_virtualenv.py", "_virtualenv.pth"))
    def falhou(erro):
        raise erro
    for pasta, dirs, arquivos in os.walk(raiz, onerror=falhou):
        for nome in arquivos + [d for d in dirs if os.path.islink(os.path.join(pasta, d))]:
            local = os.path.join(pasta, nome)
            if local in registrados or os.path.relpath(local, raiz) in base:
                continue
            if nome.endswith(".pyc") and Path(pasta).name == "__pycache__" and not os.path.islink(local):
                continue
            return False
    return bool(registrados)


def classificar(item, arquivo):
    caminho = Path(item["caminho"])
    resultado = dict(caminho=str(caminho), bytes=item["bytes"], decisao="preservar")
    if (item["classe"] != "revisar" or not item["completa"] or not item["indices"]
        or item["dependentes"] or item["arquivoAberto"] or item["itensExtrasNaRaiz"] or item["fontesDiretas"]
        or caminho.parent != arquivo or caminho.resolve() != caminho):
        return dict(resultado, motivo="vínculo ativo ou inventário insuficiente")
    sites = list(caminho.glob("lib/python*/site-packages"))
    if len(sites) != 1 or not (sites[0] / "chroma_mcp-0.2.6.dist-info").is_dir():
        return dict(resultado, motivo="versão de Chroma fora da regra")
    cmd = caminho / "bin" / "chroma-mcp"
    try:
        r = subprocess.run(["/usr/bin/sandbox-exec", "-p", PERFIL, str(caminho / "bin/python"),
                            "-I", "-B", str(cmd), "--help"], cwd="/", stdin=subprocess.DEVNULL,
                           capture_output=True, env={"PATH": "/usr/bin:/bin", "HOME": str(Path.home())}, timeout=45)
    except (OSError, subprocess.TimeoutExpired):
        return dict(resultado, motivo="teste inconclusivo")
    if r.returncode == 0 and b"--client-type" in r.stdout:
        return dict(resultado, motivo="funcional")
    falha = b"ImportError: cannot import name 'eval_type_backport'" in r.stderr
    if falha and r.returncode == 1 and (sites[0] / "mcp-1.6.0.dist-info").is_dir() and list(sites[0].glob("pydantic-2.14.*.dist-info")):
        if not arquivos_conhecidos(caminho, sites[0]):
            return dict(resultado, motivo="arquivo fora dos recibos de instalação")
        st = caminho.stat()
        return dict(resultado, decisao="candidato", motivo="incompatibilidade confirmada", indices=item["indices"],
                    dispositivo=st.st_dev, inode=st.st_ino, composicao=item["composicao"])
    return dict(resultado, motivo="outra falha exige investigação")


def planejar(relatorio):
    if sys.platform != "darwin" or relatorio["espaco"]["parcial"] or relatorio["uv"]["executavel"] != "chroma-mcp":
        raise ValueError("É necessário um inventário completo de chroma-mcp no macOS.")
    arquivo = Path(relatorio["uv"]["cache"]).resolve() / "archive-v0"
    with ThreadPoolExecutor(max_workers=min(4, os.cpu_count() or 1)) as pool:
        return list(pool.map(lambda item: classificar(item, arquivo), relatorio["espaco"]["itens"]))


if __name__ == "__main__":
    try:
        print(json.dumps(planejar(json.load(sys.stdin)), indent=2))
    except (OSError, KeyError, ValueError) as erro:
        sys.exit(str(erro))
