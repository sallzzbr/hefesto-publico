"""Contratos de prosa do hermes 1.5.0 (SPEC `hermes-pos-q4`, critérios A1-A8 e AG).

Skill é prosa: o teste cobra termos-chave, não frases longas, para não travar a redação. A
comparação ignora ênfase markdown (`*` e crase), quebra de linha e espaço repetido: sem isso, um
termo que a largura do parágrafo quebrou ao meio contaria como ausente, e uma proibição passaria
verde à toa (é o caso de hoje no `sintese-semanal`). A caixa só é livre na primeira letra (início
de frase ou de item); o resto casa exato, para vocabulário fechado (APROVA, BLOQUEIA), campo e
path não amolecerem. Número no marcador não casa com número maior (`R$50` não é `R$500`).

Cada teste junta todas as faltas antes de reprovar, e arquivo ausente entra como falta, nunca
como FileNotFoundError: antes da implementação, o vermelho tem de ser por asserção.

O QUE ESTE TESTE NÃO GARANTE: comportamento. Termo presente não prova que a skill aplica a regra.
A árvore de decisão e as lacunas do analisar-produto têm teste comportamental próprio
(`regua-decisao.test.mjs`, `analisar-produto.test.mjs`); aqui fica só o contrato da prosa que
os cita.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


PLUGIN_DIR = Path(__file__).parent.parent
REPO_ROOT = PLUGIN_DIR.parent.parent
MARKETPLACE = REPO_ROOT / ".claude-plugin" / "marketplace.json"

SKILLS_NOVAS = ("regua-decisao",)
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿⭐✅❌]")

# Régua decorada em skill (iteração 2): linha com termo de régua (CAC, ROAS, breakeven) e número
# com centavos. Mede o efeito (nenhuma régua com centavos no texto) sem citar o número de nenhuma
# conta: os valores reais ficam só no guard privado do espelho (`scripts/espelho-publico.json`).
TERMO_DE_REGUA = re.compile(r"CAC|ROAS|breakeven", re.IGNORECASE)
NUMERO_COM_CENTAVOS = re.compile(r"(?<![\d.,])\d+[,.]\d{2}(?![\d])")


def _skill(nome: str) -> str:
    return f"skills/{nome}/SKILL.md"


def _prosa(texto: str) -> str:
    texto = texto.replace("*", "").replace("`", "")
    texto = re.sub(r"R\$\s+(?=\d)", "R$", texto)
    return re.sub(r"\s+", " ", texto)


def _casa(texto: str, marcador: str) -> bool:
    primeira, resto = marcador[0], marcador[1:]
    padrao = (f"[{primeira.lower()}{primeira.upper()}]" if primeira.isalpha() else re.escape(primeira))
    padrao += re.escape(resto)
    if primeira.isdigit():
        padrao = r"(?<!\d)" + padrao
    if marcador[-1].isdigit():
        padrao += r"(?!\d)"
    return re.search(padrao, _prosa(texto)) is not None


def _ler(relativo: str, faltas: list[str]) -> str | None:
    caminho = PLUGIN_DIR / relativo
    if not caminho.is_file():
        faltas.append(f"{relativo}: arquivo ausente")
        return None
    return caminho.read_text(encoding="utf-8")


def _exige(relativo: str, marcadores: tuple[str, ...], faltas: list[str]) -> None:
    texto = _ler(relativo, faltas)
    if texto is not None:
        faltas.extend(f"{relativo}: falta {m!r}" for m in marcadores if not _casa(texto, m))


def _proibe(relativo: str, padroes: tuple[str, ...], faltas: list[str]) -> None:
    # proibição sem caixa nenhuma: mais estrita que a exigência, de propósito
    texto = _ler(relativo, faltas)
    if texto is not None:
        prosa = _prosa(texto)
        faltas.extend(
            f"{relativo}: ainda casa {p!r}" for p in padroes if re.search(p, prosa, re.IGNORECASE)
        )


def _skill_nova_valida(nome: str, faltas: list[str]) -> None:
    """Frontmatter no contrato do plugin (name = diretório, description entre aspas com
    gatilhos) e sem emoji: skill nova não ganha emoji (AGENTS.md, restrição da SPEC)."""
    relativo = _skill(nome)
    texto = _ler(relativo, faltas)
    if texto is None:
        return
    bloco = re.match(r"^---\n(.*?)\n---\n", texto, re.DOTALL)
    if not bloco:
        faltas.append(f"{relativo}: sem frontmatter")
        return
    if not re.search(rf"^name: {re.escape(nome)}$", bloco.group(1), re.MULTILINE):
        faltas.append(f"{relativo}: frontmatter sem 'name: {nome}'")
    descricao = re.search(r'^description: "(.+?)"$', bloco.group(1), re.MULTILINE)
    if not descricao or len(descricao.group(1)) <= 80 or "Use when" not in descricao.group(1):
        faltas.append(f"{relativo}: description entre aspas, com mais de 80 caracteres e 'Use when'")
    if EMOJI.search(texto):
        faltas.append(f"{relativo}: carrega emoji")


def _sem_faltas(faltas: list[str]) -> None:
    assert not faltas, "\n" + "\n".join(dict.fromkeys(faltas))


# ── A1: limiar de aprendizado configurável ───────────────────────────────────

def test_a1_regua_decisao_define_limiar_de_eventos_opcional_e_fallback_por_edicao() -> None:
    # o limiar de eventos vira campo opcional do workspace (desligado por default); sem ele, o
    # aprendizado se lê por edição recente + piso de gasto, e conta pequena volta a ter veredito
    faltas: list[str] = []
    _exige(_skill("regua-decisao"), ("eventos_minimos_aprendizado", "7 dias desde a última edição"), faltas)
    _sem_faltas(faltas)


def test_a1_fadiga_e_verba_trocam_a_guarda_de_50_eventos_pela_regua() -> None:
    # "menos de 50 eventos = em aprendizado" travava conta com poucas compras por semana: nenhum
    # conjunto saía do aprendizado. A regra mora na regua-decisao, não copiada na skill
    faltas: list[str] = []
    for nome in ("fadiga-criativa", "otimizar-verba"):
        _proibe(_skill(nome), (r"50\s*eventos",), faltas)
        _exige(_skill(nome), ("regua-decisao",), faltas)
    _sem_faltas(faltas)


# ── A2: pisos de gasto com papel, default e campo sobrescrevível ─────────────

def test_a2_regua_decisao_define_os_tres_pisos_com_papel_default_e_override() -> None:
    faltas: list[str] = []
    _exige(_skill("regua-decisao"), (
        "piso_diagnostico", "piso_opiniao_fadiga", "piso_veredito_pausa",
        "parâmetro do perfil", "moeda do perfil", "piso de veredito de pausa",
    ), faltas)
    _sem_faltas(faltas)


def test_a2_skills_consumidoras_citam_o_papel_do_piso_e_apontam_a_regua() -> None:
    # quem consome o piso diz o PAPEL e aponta a régua; o número fica na regua-decisao
    faltas: list[str] = []
    for nome in ("saude-do-funil", "otimizar-verba", "analise-diaria"):
        _exige(_skill(nome), ("piso de diagnóstico", "regua-decisao"), faltas)
    _exige(_skill("fadiga-criativa"), ("piso de opinião de fadiga", "regua-decisao"), faltas)
    _sem_faltas(faltas)


# ── A3: skill regua-decisao como fonte única da árvore ───────────────────────

def test_a3_regua_decisao_tem_frontmatter_saida_fechada_e_script() -> None:
    faltas: list[str] = []
    _skill_nova_valida("regua-decisao", faltas)
    _exige(_skill("regua-decisao"), (
        "pausar", "manter", "escalar", "reverter-degrau", "janela mínima", "7 dias",
        "${CLAUDE_PLUGIN_ROOT}/skills/regua-decisao/scripts/regua-decisao.mjs",
    ), faltas)
    if not (PLUGIN_DIR / "skills" / "regua-decisao" / "scripts" / "regua-decisao.mjs").is_file():
        faltas.append("skills/regua-decisao/scripts/regua-decisao.mjs: arquivo ausente")
    _sem_faltas(faltas)


def test_a3_regua_decisao_registra_heuristica_rejeitada_e_rotula_as_regras() -> None:
    # "pausar com gasto abaixo do breakeven em 3 dias" foi avaliada e rejeitada, com os dois motivos; cada
    # regra diz de onde vem, para ninguém promover heurística a regra de plataforma
    faltas: list[str] = []
    _exige(_skill("regua-decisao"), (
        "gasto abaixo de um CAC breakeven em 3 dias", "rejeitada", "primeira venda", "histórico de conta",
        "regra de plataforma", "heurística de mercado", "metodologia",
    ), faltas)
    _sem_faltas(faltas)


def test_a3_skills_apontam_a_regua_em_vez_de_copiar_a_regra() -> None:
    faltas: list[str] = []
    for nome in ("fadiga-criativa", "otimizar-verba", "analise-diaria", "sintese-semanal"):
        _exige(_skill(nome), ("regua-decisao",), faltas)
    for nome in ("fadiga-criativa", "otimizar-verba"):
        _proibe(_skill(nome), (r"≥\s*10\s*convers",), faltas)
    _proibe(_skill("analise-diaria"), (re.escape("menos de 7 dias de janela"),), faltas)
    _proibe(_skill("sintese-semanal"), (re.escape("as réguas exatas são das skills"),), faltas)
    # a rampa continua na skill (é dela), mas rotulada pela origem
    _exige(_skill("otimizar-verba"), ("heurística de mercado",), faltas)
    _sem_faltas(faltas)


def test_a3_preserva_a_regra_de_rampa_do_otimizar_verba() -> None:
    # controle: a rampa (3 a 7 dias entre degraus; salto grande reseta o aprendizado) já vale
    # hoje e não pode sair junto com a régua copiada
    faltas: list[str] = []
    _exige(_skill("otimizar-verba"), ("3 a 7 dias", "reseta"), faltas)
    _sem_faltas(faltas)


# ── A4: linha P/V no saude-do-funil ──────────────────────────────────────────

def test_a4_saude_do_funil_ganha_linha_p_v_rotulada_como_heuristica() -> None:
    faltas: list[str] = []
    _exige(_skill("saude-do-funil"), (
        "P/V", "visualizações de conteúdo", "visualizações da página de destino", "perto de 1",
        "heurística", "view_content", "landing_page_view",
    ), faltas)
    _sem_faltas(faltas)


# ── A7: analisar-produto com lacunas e re-estética ──────────────────────────

def test_a7_analisar_produto_documenta_lacunas_e_reestetica() -> None:
    faltas: list[str] = []
    base = "skills/analisar-produto"
    _exige(f"{base}/SKILL.md", ("lacunas de portfólio", "candidatas a re-estética"), faltas)
    _exige(f"{base}/references/contrato.md", (
        "lacunaMaxItens", "razaoCliqueAlta", "razaoCompraBaixa", "lacunas", "reestetica",
    ), faltas)
    _exige(f"{base}/references/template-relatorio.md", (
        "## Lacunas de portfólio", "## Candidatas a re-estética",
    ), faltas)
    _sem_faltas(faltas)


# ── A8: auditoria-cro ────────────────────────────────────────────────────────

def test_a8_auditoria_cro_tem_modos_estado_entre_rodadas_e_entradas_do_workspace() -> None:
    faltas: list[str] = []
    _exige(_skill("auditoria-cro"), (
        "proprio", "capacidades do painel", "decisões vigentes", "nota de 1 linha",
        "aberto há N rodadas", "resolvido", "390 px",
    ), faltas)
    _sem_faltas(faltas)


def test_a8_auditoria_cro_tem_checklist_de_loja_sob_demanda() -> None:
    faltas: list[str] = []
    _exige(_skill("auditoria-cro"), (
        "rótulos", "vitrine curada", "cupom", "Pix", "tema mobile", "página Sobre", "redes",
        "WhatsApp", "loja sazonal", "coerência de preço",
        # teste dos 3 segundos da oferta e as 4 condições
        "teste dos 3 segundos da oferta", "cabe numa frase", "sem conta", "uma oferta só",
        "data para acabar",
        "mesma frase de oferta", "uma contagem regressiva só",
    ), faltas)
    _sem_faltas(faltas)


def test_a8_preserva_modo_concorrente_e_caminho_do_carrinho() -> None:
    # controle: a auditoria de concorrente e o caminho até o carrinho já existem e ficam
    faltas: list[str] = []
    _exige(_skill("auditoria-cro"), ("concorrente", "carrinho"), faltas)
    _sem_faltas(faltas)


# ── AG: integração (README, versões, anti-vazamento) ─────────────────────────

def test_ag_readme_do_plugin_lista_as_skills_novas() -> None:
    faltas: list[str] = []
    texto = _ler("README.md", faltas)
    if texto is not None:
        faltas.extend(
            f"README.md: sem linha de tabela para `{nome}`" for nome in SKILLS_NOVAS
            if not re.search(rf"^\| `{re.escape(nome)}` \|", texto, re.MULTILINE)
        )
    _sem_faltas(faltas)


def _semver(texto: object) -> tuple[int, ...] | None:
    casado = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", str(texto))
    return tuple(int(parte) for parte in casado.groups()) if casado else None


def test_ag_hermes_1_5_0_no_plugin_no_marketplace_e_no_changelog() -> None:
    # A SPEC fixou a 1.5.0, já publicada na 3.24.0. Depois dela, bumps posteriores (1.5.1 em
    # diante) mantêm o controle: plugin e marketplace na mesma versão, nunca abaixo de 1.5.0, a
    # entrada 1.5.0 continua no CHANGELOG e a versão atual também tem a sua.
    faltas: list[str] = []
    plugin = json.loads((PLUGIN_DIR / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"))
    versao = plugin.get("version")
    if _semver(versao) is None or _semver(versao) < (1, 5, 0):
        faltas.append(f"plugin.json: version {versao!r}, esperado 1.5.0 ou posterior")
    marketplace = json.loads(MARKETPLACE.read_text(encoding="utf-8"))
    entrada = next((p for p in marketplace.get("plugins", []) if p.get("name") == "hermes"), {})
    if entrada.get("version") != versao:
        faltas.append(f"marketplace.json: hermes em {entrada.get('version')!r}, plugin.json em {versao!r}")
    changelog = _ler("CHANGELOG.md", faltas)
    if changelog is not None:
        for exigida in sorted({"1.5.0", str(versao)}):
            if not re.search(rf"^## {re.escape(exigida)}(?!\d)", changelog, re.MULTILINE):
                faltas.append(f"CHANGELOG.md: sem entrada '## {exigida}'")
    _sem_faltas(faltas)


def test_ag_preserva_skills_sem_plataforma_de_referencia_nem_regua_da_conta() -> None:
    # O nome real do fornecedor não pode estar neste arquivo público; \bINK\b só guarda a sigla. A
    # defesa contra o nome escrito junto, com separador ou em variante é o guard do espelho.
    # controle: hoje nenhuma skill nomeia a plataforma do fornecedor (o perfil vem do workspace)
    # nem carrega régua da conta; as três skills novas entram na mesma varredura
    arquivos = sorted((PLUGIN_DIR / "skills").glob("*/SKILL.md"))
    assert len(arquivos) >= 17, f"varredura viu só {len(arquivos)} SKILL.md; escopo quebrou"
    faltas: list[str] = []
    for caminho in arquivos:
        relativo = caminho.relative_to(PLUGIN_DIR).as_posix()
        texto = caminho.read_text(encoding="utf-8")
        if re.search(r"\bINK\b", texto):
            faltas.append(f"{relativo}: nomeia a plataforma de referência")
        faltas.extend(
            f"{relativo}:{numero}: régua com centavos no texto da skill: {linha.strip()[:120]}"
            for numero, linha in enumerate(texto.splitlines(), 1)
            if TERMO_DE_REGUA.search(linha) and NUMERO_COM_CENTAVOS.search(linha)
        )
    _sem_faltas(faltas)


def test_ag_preserva_marketplace_em_3_24_0() -> None:
    # controle: o hermes 1.5.0 entrou no marketplace 3.24.0, já publicado; versões posteriores do
    # marketplace não podem voltar para trás dela
    marketplace = json.loads(MARKETPLACE.read_text(encoding="utf-8"))
    versao = marketplace.get("metadata", {}).get("version")
    assert _semver(versao) is not None and _semver(versao) >= (3, 24, 0), (
        f"marketplace.json metadata.version {versao!r}, esperado 3.24.0 ou posterior"
    )


# ── Iteração 2 (revisão adversarial de 2026-11-01) ───────────────────────────
# Prosa que acompanha as correções dos scripts: a skill não pode prometer o que o script não
# faz (modelo trocado "sempre" bloqueia), nem deixar regra de régua copiada fora da régua.

def test_it2_regua_define_janela_edicao_e_degrau_para_entidade_nova() -> None:
    faltas: list[str] = []
    _exige(_skill("regua-decisao"), (
        "veiculou", "criação conta como edição", "aumento de verba ainda não revertido",
        "log de atividade",
    ), faltas)
    _sem_faltas(faltas)


def test_it2_regua_documenta_gatilhos_novos_e_comparacao_em_centavos() -> None:
    faltas: list[str] = []
    _exige(_skill("regua-decisao"), (
        "janela-mista", "piso-diagnostico", "piso-reversao", "intervalo-degrau", "consolidado",
        "14 dias", "centavos", "nos dois sentidos",
    ), faltas)
    _sem_faltas(faltas)


def test_it2_otimizar_verba_subordina_score_e_rampa_a_regua() -> None:
    faltas: list[str] = []
    _exige(_skill("otimizar-verba"), (
        "prioridade de revisão", "o veredito da regua-decisao prevalece", "intervalo_minimo_degrau_dias",
    ), faltas)
    _sem_faltas(faltas)


def test_it2_changelog_sem_volume_de_vendas_da_conta() -> None:
    faltas: list[str] = []
    _proibe("CHANGELOG.md", (r"\b\d+\s*a\s*\d+\s*compras\s*por\s*semana",), faltas)
    _proibe("tests/test_pos_q4_contracts.py", (r"\b6\s*a\s*8\s*compras",), faltas)
    _sem_faltas(faltas)


# ── Iteração 3 (adendo do material oficial da plataforma de referência) ─────────────────
# Prosa das skills que o adendo muda: a skill tem de dizer o que fazer, sem número de régua de
# CAC/ROAS e sem nomear a plataforma (os controles de AG continuam valendo).

def test_it3_regua_mostra_lucro_do_periodo_e_lucro_por_real() -> None:
    faltas: list[str] = []
    _exige(_skill("regua-decisao"), (
        "lucro do período", "lucro por real investido", "0,70 a 1,50", "lucro_por_real_referencia_min",
        "retorno menor por real", "não muda a árvore", "custo fixo",
    ), faltas)
    _exige(_skill("otimizar-verba"), ("lucro do período", "lucro por real investido", "mostre os dois"), faltas)
    for nome in ("fadiga-criativa", "analise-diaria", "sintese-semanal"):
        _exige(_skill(nome), ("lucro do período",), faltas)
    _sem_faltas(faltas)


def test_it3_auditoria_cro_cobre_margem_descontos_frete_prazo_e_site_proprio() -> None:
    faltas: list[str] = []
    _exige(_skill("auditoria-cro"), (
        "margem por pedido", "10%", "15%", "20%", "heurística de mercado", "unit-economics",
        "progressivo", "Pix", "cupom", "empilh",
        "ordem das opções de frete", "Black", "Natal", "mais barato", "mais rápido",
        "prazo de entrega por região", "carrinho",
        "site próprio", "favicon", "página Sobre", "ícones de confiança",
    ), faltas)
    _sem_faltas(faltas)


def test_it3b_regua_define_a_reversao_como_edicao_e_a_janela_do_degrau() -> None:
    # depois de reverter, a janela seguinte não pode julgar a verba revertida: a reversão conta
    # como edição; e com degrau em avaliação, qualquer veredito usa só os dias depois dele
    faltas: list[str] = []
    _exige(_skill("regua-decisao"), (
        "a reversão conta como edição significativa", "qualquer veredito",
        "janela_minima_veredito_dias + 7",
    ), faltas)
    _sem_faltas(faltas)


def test_it3c_auditoria_cro_usa_o_cac_real_do_periodo() -> None:
    faltas: list[str] = []
    _exige(_skill("auditoria-cro"), ("CAC real do período",), faltas)
    _sem_faltas(faltas)


def test_codex_analysis_keeps_financial_qualifiers():
    native = REPO_ROOT / 'codex/plugins/hermes/skills'
    def read(name):
        return (native / name / 'SKILL.md').read_text()
    pnl = read('pnl-mensal')
    assert 'antes de custos fixos' in pnl
    assert 'não declare mês positivo sem essa ressalva' in pnl
    assert 'nenhuma causa é confirmada sem conciliar por dia' in pnl
    assert 'pedidos por mês para cobrir os custos fixos' in read('unit-economics')
    assert 'intervalo_minimo_degrau_dias' in read('otimizar-verba')
    for name in ['analise-diaria', 'saude-do-funil']:
        assert 'CPA de plataforma' in read(name)
        assert 'fator ledger ÷ plataforma' in read(name)
        assert 'não o apresente como lucro' in read(name)
