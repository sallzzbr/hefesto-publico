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


def create_complete_workspace(root: Path, *, generator: bool = True, perfil: bool = True, manifesto: bool = True) -> None:
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
    if manifesto:
        (root / "scripts" / "manifesto-scripts.json").write_text(
            json.dumps({"scripts": [{"nome": "compor_texto", "executavel": "scripts/compor_texto.py", "campos": {"saida": {"posicao": 0}}}]}), encoding="utf-8"
        )
    if generator:
        (root / "scripts" / "gerar_imagem.py").write_text(
            "raise RuntimeError('must not execute')\n", encoding="utf-8"
        )
    if perfil:
        escrever_perfil(root / "perfil-do-negocio.md")


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


def test_python_symlink_keeps_venv_entrypoint_and_rejects_other_environment(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    python = tmp_path / '.venv' / 'bin' / 'python'
    python.unlink()
    python.symlink_to(sys.executable)
    result = run_preflight(tmp_path, '--python', '.venv/bin/python')
    assert result.returncode == 0, result.stdout
    assert json.loads(result.stdout)['python'] == str(python)
    result = run_preflight(tmp_path, '--python', sys.executable)
    assert result.returncode == 1
    assert 'python.fora_do_venv' in {x['code'] for x in json.loads(result.stdout)['missing']}


# ── E3 (hermes 2.0.0), C1: perfil do negócio lido do workspace ───────────────
# Contrato fixado por estes testes: o script recebe o path JÁ RESOLVIDO do perfil em `--perfil`
# (relativo ao workspace ou absoluto, como os demais diretórios); o arquivo é Markdown com uma
# linha `chave: valor` por campo; cada campo ausente ou inválido entra em `missing` com o
# código `perfil.<campo>` e o script sai 1; perfil ausente nunca vira default silencioso.
# O relatório devolve o perfil lido em `perfil` (a skill injeta `eixos` e `segmentos` no harness).

CAMPOS_DO_PERFIL = (
    "modelo",
    "evento_conversao",
    "metrica_norte",
    "moeda",
    "pais",
    "canais_ativos",
    "aprovador",
    "segmentos",
    "eixos",
    "exclusao_vendas_internas",
)

# Sem consumidor no plugin: ausentes viram aviso, não bloqueio (revisão do PR 20, item 12).
CAMPOS_OPCIONAIS = ("modelo", "pais", "evento_conversao", "metrica_norte", "canais_ativos", "aprovador", "exclusao_vendas_internas")
CAMPOS_OBRIGATORIOS = tuple(c for c in CAMPOS_DO_PERFIL if c not in CAMPOS_OPCIONAIS)

PERFIL_VALIDO = {
    "modelo": "e-commerce",
    "evento_conversao": "purchase",
    "metrica_norte": "receita líquida",
    "moeda": "BRL",
    "pais": "BR",
    "canais_ativos": "meta-ads, analytics",
    "aprovador": "Responsável Exemplo",
    "segmentos": "acessorios, presentes",
    "eixos": "familia, acabamento, porte",
    "exclusao_vendas_internas": "pedidos com o cupom interno de teste",
}


def escrever_perfil(destino: Path, **sobrescritas: str | None) -> Path:
    """Grava um perfil; valor None remove o campo (campo ausente)."""
    campos = {**PERFIL_VALIDO, **sobrescritas}
    linhas = ["# Perfil do negócio", ""]
    linhas += [f"{chave}: {valor}" for chave, valor in campos.items() if valor is not None]
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    return destino


def codigos_ausentes(result: subprocess.CompletedProcess[str]) -> set[str]:
    assert result.stdout.strip(), f"o preflight deveria imprimir o relatório JSON (stderr: {result.stderr})"
    return {item["code"] for item in json.loads(result.stdout)["missing"]}


def test_c1_perfil_valido_deixa_o_workspace_pronto_e_expoe_o_perfil_lido(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    escrever_perfil(tmp_path / "config" / "perfil-do-negocio.md")

    relativo = run_preflight(tmp_path, "--perfil", "config/perfil-do-negocio.md")
    absoluto = run_preflight(tmp_path, "--perfil", str(tmp_path / "config" / "perfil-do-negocio.md"))

    for result in (relativo, absoluto):
        assert result.returncode == 0, result.stderr or result.stdout
        report = json.loads(result.stdout)
        assert report["ready"] is True
        assert report["missing"] == []
        assert report["perfil"]["eixos"] == ["familia", "acabamento", "porte"]
        assert report["perfil"]["segmentos"] == ["acessorios", "presentes"]
        assert report["perfil"]["moeda"] == "BRL"


def test_c1_cada_campo_ausente_do_perfil_e_nomeado_em_missing(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    falhas: list[str] = []
    for campo in CAMPOS_OBRIGATORIOS:
        perfil = escrever_perfil(tmp_path / "perfil-do-negocio.md", **{campo: None})
        result = run_preflight(tmp_path, "--perfil", str(perfil))
        if result.returncode != 1:
            falhas.append(f"{campo}: esperava exit 1, veio {result.returncode}")
            continue
        if f"perfil.{campo}" not in codigos_ausentes(result):
            falhas.append(f"{campo}: perfil.{campo} não aparece em missing")
    assert falhas == []


def test_c1_campo_invalido_do_perfil_e_nomeado_e_so_ele(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    invalidos = {
        "moeda": "reais",
        "pais": "Brasil",
        "canais_ativos": "",
        "segmentos": "acessorios, ../fora do workspace",
        "eixos": "familia, familia",
    }
    falhas: list[str] = []
    for campo, valor in invalidos.items():
        perfil = escrever_perfil(tmp_path / "perfil-do-negocio.md", **{campo: valor})
        result = run_preflight(tmp_path, "--perfil", str(perfil))
        if result.returncode != 1:
            falhas.append(f"{campo}={valor!r}: esperava exit 1, veio {result.returncode}")
            continue
        codigos = codigos_ausentes(result)
        if codigos != {f"perfil.{campo}"}:
            falhas.append(f"{campo}={valor!r}: missing deveria ser só perfil.{campo}, veio {sorted(codigos)}")
    assert falhas == []


def test_c1_eixos_vazio_e_segmentos_com_espaco_ou_repetidos_sao_invalidos(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    for campo, valor in (("eixos", ""), ("segmentos", "Com Espaco"), ("segmentos", "a, a"), ("segmentos", ""), ("segmentos", "a,,b")):
        perfil = escrever_perfil(tmp_path / "perfil-do-negocio.md", **{campo: valor})
        result = run_preflight(tmp_path, "--perfil", str(perfil))
        assert result.returncode == 1, f"{campo}={valor!r}: {result.stdout}"
        assert f"perfil.{campo}" in codigos_ausentes(result)


def test_c1_perfil_ausente_nunca_vira_default_silencioso(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path, perfil=False)

    sem_argumento = run_preflight(tmp_path)
    arquivo_inexistente = run_preflight(tmp_path, "--perfil", "nao-existe/perfil-do-negocio.md")

    for result in (sem_argumento, arquivo_inexistente):
        assert result.returncode == 1, "workspace sem perfil não pode ficar pronto"
        report = json.loads(result.stdout)
        assert report["ready"] is False
        assert any(codigo.startswith("perfil.") for codigo in codigos_ausentes(result)), (
            "perfil ausente precisa aparecer em missing com código perfil.*"
        )


def test_c1_campo_repetido_e_invalido_e_bom_utf8_nao_derruba_o_primeiro_campo(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    repetido = escrever_perfil(tmp_path / "perfil-do-negocio.md")
    repetido.write_text(repetido.read_text(encoding="utf-8") + "moeda: USD\n", encoding="utf-8")
    result = run_preflight(tmp_path, "--perfil", str(repetido))
    assert result.returncode == 1
    assert codigos_ausentes(result) == {"perfil.moeda"}, "campo repetido não escolhe valor em silêncio"

    com_bom = escrever_perfil(tmp_path / "bom.md")
    texto = "\n".join(linha for linha in com_bom.read_text(encoding="utf-8").splitlines() if linha != "# Perfil do negócio")
    com_bom.write_bytes(b"\xef\xbb\xbf" + (texto + "\n").encode("utf-8"))
    result = run_preflight(tmp_path, "--perfil", str(com_bom))
    assert result.returncode == 0, result.stdout
    assert json.loads(result.stdout)["perfil"]["modelo"] == "e-commerce"


# ── Revisão do PR 20: o manifesto de scripts é obrigatório no preflight ──────
def codigos(result: subprocess.CompletedProcess[str]) -> set[str]:
    return {item["code"] for item in json.loads(result.stdout)["missing"]}


def test_manifesto_ausente_reprova_o_preflight_antes_dos_roughs(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path, manifesto=False)

    result = run_preflight(tmp_path)

    assert result.returncode == 1
    assert codigos(result) == {"scripts.manifesto"}


def test_manifesto_invalido_ou_sem_lista_de_scripts_e_nomeado(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    alvo = tmp_path / "scripts" / "manifesto-scripts.json"
    for conteudo in ("{não é json", "[]", '{"scripts": []}', '{"scripts": "x"}', "{}"):
        alvo.write_text(conteudo, encoding="utf-8")
        result = run_preflight(tmp_path)
        assert result.returncode == 1, conteudo
        assert codigos(result) == {"scripts.manifesto"}, conteudo


def test_manifesto_com_entrada_fora_da_forma_do_harness_e_nomeado(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    alvo = tmp_path / "scripts" / "manifesto-scripts.json"
    base = {"nome": "c", "executavel": "scripts/c.py", "campos": {"saida": {"posicao": 0}}}
    invalidos = (
        [1],
        ["texto"],
        [None],
        [{**base, "nome": 3}],
        [{**base, "nome": ""}],
        [{**base, "executavel": None}],
        [{**base, "executavel": ["a"]}],
        [{**base, "campos": []}],
        [{"nome": "c", "executavel": "scripts/c.py"}],
        [base, {**base, "campos": "x"}],
    )
    for scripts in invalidos:
        alvo.write_text(json.dumps({"scripts": scripts}), encoding="utf-8")
        result = run_preflight(tmp_path)
        assert result.returncode == 1, scripts
        assert codigos(result) == {"scripts.manifesto"}, scripts
    alvo.write_text(json.dumps({"scripts": [base]}), encoding="utf-8")
    assert run_preflight(tmp_path).returncode == 0


def test_manifesto_em_outro_path_resolvido_pela_skill(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path, manifesto=False)
    outro = tmp_path / "config" / "manifesto.json"
    outro.parent.mkdir()
    outro.write_text('{"scripts": [{"nome": "compor_texto", "executavel": "scripts/compor_texto.py", "campos": {}}]}', encoding="utf-8")

    relativo = run_preflight(tmp_path, "--manifesto", "config/manifesto.json")
    absoluto = run_preflight(tmp_path, "--manifesto", str(outro))
    sem_flag = run_preflight(tmp_path)

    assert relativo.returncode == 0, relativo.stdout
    assert absoluto.returncode == 0, absoluto.stdout
    assert codigos(sem_flag) == {"scripts.manifesto"}


def test_campo_opcional_do_perfil_ausente_vira_aviso_e_invalido_continua_bloqueando(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    for campo in CAMPOS_OPCIONAIS:
        perfil = escrever_perfil(tmp_path / "perfil-do-negocio.md", **{campo: None})
        result = run_preflight(tmp_path, "--perfil", str(perfil))
        assert result.returncode == 0, f"{campo}: {result.stdout}"
        avisos = {item["code"] for item in json.loads(result.stdout)["warnings"]}
        assert f"perfil.{campo}" in avisos, campo
    invalido = escrever_perfil(tmp_path / "perfil-do-negocio.md", canais_ativos="")
    result = run_preflight(tmp_path, "--perfil", str(invalido))
    assert result.returncode == 1
    assert codigos(result) == {"perfil.canais_ativos"}


# ── Revisão do PR 20, item 9: preflight e analisar-produto concordam sobre os eixos ──────────────────
# A mesma lista (nomes reservados e formato) é lida dos dois lados de references/eixos.json; o teste do
# script (analisar-produto.test.mjs) recusa os mesmos nomes.
EIXOS_RECUSADOS = ("item, views, bloco", "familia, bloco", "views", "Familia", "a b", "familia;acabamento\\n", "x" * 90)


def test_eixos_reservados_ou_fora_do_formato_reprovam_o_perfil(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    for eixos in EIXOS_RECUSADOS:
        perfil = escrever_perfil(tmp_path / "perfil-do-negocio.md", eixos=eixos)
        result = run_preflight(tmp_path, "--perfil", str(perfil))
        assert result.returncode == 1, eixos
        assert codigos(result) == {"perfil.eixos"}, eixos


def test_eixos_do_preflight_e_reservados_do_script_vem_do_mesmo_arquivo() -> None:
    import re

    compartilhado = json.loads((PLUGIN_DIR / "references" / "eixos.json").read_text(encoding="utf-8"))
    script = (PLUGIN_DIR / "skills" / "analisar-produto" / "scripts" / "analisar-produto.mjs").read_text(encoding="utf-8")
    assert "references/eixos.json" in script
    assert not re.search(r"COLUNAS_FIXAS\s*=\s*\[", script), "o script não pode ter uma lista própria de reservados"
    assert compartilhado["reservados"] and compartilhado["formato"]


def test_c1_campo_unico_segmento_deixou_de_existir_sem_alias(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    perfil = escrever_perfil(tmp_path / "perfil-do-negocio.md", segmentos=None, segmento="acessorios")
    result = run_preflight(tmp_path, "--perfil", str(perfil))
    assert result.returncode == 1
    assert codigos_ausentes(result) == {"perfil.segmentos"}


def test_c1_modelo_e_pais_ausentes_viram_aviso_e_presentes_invalidos_continuam_bloqueando(tmp_path: Path) -> None:
    create_complete_workspace(tmp_path)
    perfil = escrever_perfil(tmp_path / "perfil-do-negocio.md", modelo=None, pais=None)
    result = run_preflight(tmp_path, "--perfil", str(perfil))
    assert result.returncode == 0, result.stdout
    avisos = {w["code"] for w in json.loads(result.stdout)["warnings"]}
    assert {"perfil.modelo", "perfil.pais"} <= avisos
    ruim = escrever_perfil(tmp_path / "perfil-do-negocio.md", pais="Brasil", modelo="")
    result = run_preflight(tmp_path, "--perfil", str(ruim))
    assert result.returncode == 1
    assert {"perfil.pais", "perfil.modelo"} <= codigos_ausentes(result)
