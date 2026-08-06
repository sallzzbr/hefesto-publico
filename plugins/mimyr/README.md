# Mimyr

> Paths de workspace citados neste README resolvem pela regra única do plugin
> (`skills/gerar-curso/references/defaults.md`); os literais abaixo são ilustrativos do
> default, não hardcode.

> Plugin de cursos e didática. O nome vem de Mímir, o guardião do poço da sabedoria na mitologia nórdica — aqui moram as skills que transformam material acadêmico em mini-cursos HTML publicáveis.

Até a v3.1 do marketplace, estas skills viviam como skills locais do repo [mimyr](https://github.com/sallzzbr) (o workspace de cursos). Foram promovidas a plugin para servir qualquer workspace de curso no mesmo formato.

## Skills

| Skill | O que faz |
|---|---|
| `gerar-curso` | Orquestra a criação de um mini-curso completo em `./courses/<curso>/`: inventário de fontes, personas, diagnósticos, estrutura aprovada e, desde a v1.1, o harness multi-agente (capítulos em paralelo + checks + revisão adversarial), fechando com SEO e relatório. |
| `gerar-modulo` | Gera um módulo (índice + capítulos) a partir de transcrições, docx e diagnósticos. |
| `escrever-capitulo` | Escreve ou reescreve uma página de capítulo na voz do autor, com exercícios e checagem rápida. |
| `revisar-capitulo` | Revisa um capítulo antes da publicação: voz, personas, estrutura, links, acessibilidade, SEO. |
| `analise-de-aula` | Cruza docx + transcrição de uma unidade e produz diagnóstico pedagógico em `./diagnostics/`. |

## Harness do gerar-curso (v1.1)

O miolo da geração roda num script de Workflow (`skills/gerar-curso/harness/curso.mjs`) no
padrão do dev-loop do odin — invariantes em código, não em prosa:

- **Portão de estrutura** (análogo do portão TDD): `./courses/<curso>/estrutura.md` aprovada
  pelo humano, com objetivo, critérios verificáveis e contrato de pré-requisitos POR CAPÍTULO
  antes de qualquer prosa. Capítulo sem critério, ou com arquivo existente sem
  `reescrever: true`, bloqueia o run.
- **Um escritor por capítulo, em paralelo** (arquivos disjuntos por construção); escritor que
  toca arquivo fora do seu capítulo é bloqueante automático.
- **Checks mecânicos** por iteração (acentos, travessão, SVG, links — scripts do plugin em
  dry-run) e **revisão adversarial** fail-closed com lentes por perfil (didática; +voz no
  Balanceado; +precisão técnica no Máximo). Finding plausível é confirmado antes de reescrita.
- **Tiering de modelo/effort por step** com whitelist em código (tabela `MODELOS_STEP`):
  escritor sonnet com promoção a opus via defaults (`gerar_curso_escritor`), checks em haiku
  com rollback (`gerar_curso_haiku: desligado`), revisão opus·high sempre. Pedido fora da
  whitelist é recusado com registro; fallbacks desligam o tier pelo resto do run e ficam no
  relatório. Defaults do usuário: `~/.claude/mimyr/defaults.md`
  (contrato em `skills/gerar-curso/references/defaults.md`).
- **O harness nunca commita**; sidebar/índice/SEO rodam fora dele, pós-verde, e o relatório
  persiste em `./courses/<curso>/relatorio-geracao.md`.

### Agents (`agents/`)

| Agent | Modelo (piso) | Papel |
|---|---|---|
| `escritor-de-capitulo` | sonnet | Escreve UM capítulo por despacho a partir do contrato da estrutura. |
| `revisor-de-curso` | opus | Lentes adversariais (didática/voz/técnica) + confirmação de findings. |
| `mecanico-de-curso` | haiku | Roda os scripts de check e reporta; nos steps whitelisted do harness. |

## Instalação

    /plugin marketplace add sallzzbr/hefesto-publico
    /plugin install mimyr@hefesto

## Dependência: bragir

As skills de voz e personas vivem no plugin **bragir** (mesmo marketplace) e são consumidas via slug:

- `bragir:analisar-voz` — gera `./perfil-de-voz.md` no workspace.
- `bragir:escrever-como-antonio` — escreve a prosa final na voz do autor.
- `bragir:gerenciar-personas` — cria e edita personas em `./personas/`.

Instale junto: `/plugin install bragir@hefesto`.

## Contrato de workspace

As skills operam sobre um **workspace de curso** (o repo mimyr é o canônico) com esta estrutura mínima, relativa ao cwd:

- `./templates/` — `course-index.html`, `module-index.html`, `subpage.html`, `personas-curso.md`, `styles.css` (o design system é do workspace, não do plugin)
- `./courses/<curso>/` — output publicável
- `./personas/` e `./perfil-de-voz.md` — voz e audiência (geridos pelo bragir)
- `./transcriptions/` e `./diagnostics/` — fontes e análises

Se o workspace não tiver `./templates/`, as skills param com mensagem clara em vez de inventar um template.

## Scripts Python (`scripts/`)

Ferramentas determinísticas usadas pelas skills, referenciadas via `${CLAUDE_PLUGIN_ROOT}/scripts/`:

| Script | O que faz |
|---|---|
| `extrair_audio.py` | Extrai áudio de vídeo (ffmpeg, 16kHz mono WAV para Whisper). |
| `transcrever.py` | Transcreve áudio com Whisper local (GPU) para Markdown com timestamps. |
| `extract_docx.py` | Extrai texto de `.docx` (stdlib, sem deps). |
| `corrigir_acentos.py` | Restaura acentos no texto visível usando o próprio corpus do curso como dicionário. |
| `remover_travessao.py` | Remove travessões da prosa visível (contrato da voz do autor). |
| `melhorar_a11y.py` | Melhorias a11y em batch: aria-labels de navegação, scopes de tabela, table-wrap. |
| `atualizar_seo.py` | Injeta meta tags/JSON-LD a partir do `seo.json` do curso. |
| `checar_svg_overflow.py` | Detecta texto de SVG estourando o viewBox, medindo com as métricas reais das fontes do curso. |
| `injetar_sidebar.py` | Regenera a sidebar (`nav.chapter-toc`) de todos os capítulos de um curso. |
| `atualizar_indice_curso.py` | Sincroniza contagem de capítulos e tempo de leitura no índice do curso. |

### Bootstrap do ambiente Python (primeiro uso)

O plugin **não instala dependências** — quem instala é você, uma vez por workspace:

    python3 -m venv .venv
    .venv/bin/pip install -r "<plugin>/scripts/requirements.txt"

Transcrição de áudio é pesada (Whisper + torch, idealmente GPU) e fica fora do requirements core:

    .venv/bin/pip install -r "<plugin>/scripts/requirements-transcricao.txt"

`extrair_audio.py` exige `ffmpeg` no PATH (instalação por SO). Sem o venv, as skills degradam com mensagem clara indicando este bootstrap — nunca falham silenciosamente.

## Testes

Contratos das skills e testes dos scripts vivem em `tests/` (pytest). Para rodar, a partir da raiz do repo hefesto:

    python3 -m pytest plugins/mimyr/tests -q

Requer `pytest` + as deps de `scripts/requirements.txt` no ambiente.

## Consumidores conhecidos

- **mimyr** (workspace de cursos, repo homônimo) — cursos publicados em https://interfacedousuario.com.br/. O que é acoplado ao site (build, deploy, GA4, sitemap) continua no repo, fora do plugin.
