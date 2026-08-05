---
description: "Generate or scaffold a new Mimyr mini-course. Use when starting a new course in a course workspace from raw academic material, transcripts, diagnostics, personas, and templates — criar um curso, gerar um mini-curso, refazer a jornada de um curso, gerar capítulos em paralelo com revisão adversarial."
---

# Gerar Curso

Scaffold and orchestrate a complete mini-course under `./courses/<curso>/` of the current
course workspace. Desde a v1.1, o miolo da geração (capítulos em paralelo + checks mecânicos +
revisão adversarial) roda no **harness** `harness/curso.mjs` — invariantes em código, não em
prosa, no padrão do dev-loop do odin.

## Workspace

Esta skill opera sobre um workspace de curso (o repo mimyr é o canônico). Os paths se resolvem
pela **regra única** do plugin (`references/defaults.md`): (1) campos `local_*` na seção
`## Paths do workspace` do `CLAUDE.md` do workspace; (2) campos `local_*` dos defaults do
usuário (`~/.claude/mimyr/defaults.md`); (3) convenção descoberta no cwd — `./templates/`,
`./courses/`, `./personas/`, `./transcriptions/`, `./diagnostics/`. Os paths citados nesta
skill são ilustrativos do default, não hardcode. Se o diretório de templates **resolvido**
não existir no cwd, **PARE** e informe que o cwd não é um workspace de curso — não invente
templates.

## Pré-requisitos (validar ANTES de gerar qualquer conteúdo)

Confirme cada item e **PARE com mensagem clara** se faltar — isso evita falhas
silenciosas vários passos adiante (capítulos sem voz, personas inexistentes):

1. **Perfil de voz** — `./perfil-de-voz.md` existe no projeto. Se não, ofereça
   rodar `bragir:analisar-voz` (gera o arquivo a partir de 3-5 docx do autor).
   Sem perfil de voz, a prosa sai genérica; **não prossiga** gerando capítulos.
2. **Personas** — existe `./courses/<curso>/personas.md` (manifesto do curso) e
   os arquivos referenciados em `./personas/`. Se faltar, crie a partir de
   `./templates/personas-curso.md` e use `bragir:gerenciar-personas` para os
   perfis em `./personas/`.
3. **Bragir instalado** — as skills `bragir:*` estão disponíveis. Se não,
   oriente: `/plugin install bragir@hefesto`.
4. **Venv do workspace** — obrigatório antes de invocar o harness (o step de
   checks roda os scripts Python; sem venv o run "falha" por defeito de setup,
   não do conteúdo). Bootstrap abaixo.

## Ambiente Python (scripts do plugin)

Os scripts em `${CLAUDE_PLUGIN_ROOT}/scripts/` rodam no venv do workspace. Primeiro uso:

    python3 -m venv .venv
    .venv/bin/pip install -r "${CLAUDE_PLUGIN_ROOT}/scripts/requirements.txt"

Transcrição de áudio (Whisper + torch, pesado, ideal com GPU) tem requirements próprio
(`requirements-transcricao.txt`) e exige `ffmpeg` no PATH. Sem venv, informe o bootstrap
e pare o passo que depende do script — nunca falhe silenciosamente.

## Skills externas (bragir)

Esta skill consome o plugin bragir (mesmo marketplace):

- **`bragir:analisar-voz`** — run only if the project lacks `./perfil-de-voz.md` or the user explicitly wants to refresh it.
- **`bragir:gerenciar-personas`** — create missing project-level persona files in `./personas/`.
- **`bragir:escrever-como-antonio`** — used by the `escritor-de-capitulo` agent (and by `mimyr:gerar-modulo`/`mimyr:escrever-capitulo`) for final prose.

## Skills deste plugin usadas

- **`mimyr:analise-de-aula`** — produce diagnostics in `./diagnostics/`.
- **`mimyr:gerar-modulo`** — avulso: create a single module outside the harness flow.
- **`mimyr:escrever-capitulo`** — avulso: write/rewrite one chapter by hand; é também o padrão de conteúdo que o agent `escritor-de-capitulo` segue.
- **`mimyr:revisar-capitulo`** — avulso: review one chapter; é o checklist-base das lentes do agent `revisor-de-curso`.

## Input

The user should provide:
1. Course title and slug (`<curso>`)
2. Source map: docx/video/transcript files by unit
3. Target audience and personas
4. Desired module count or journey shape
5. Publishing constraints: SEO, GA4, hosting, deadline

## Course setup (shells — ANTES do harness)

Create or verify:

- `./courses/<curso>/index.html` (usando `./templates/course-index.html`)
- `./courses/<curso>/personas.md`
- `./courses/<curso>/seo.json`
- `./courses/<curso>/styles.css` (copy/adapt from an existing course only when appropriate)
- `./courses/<curso>/modulo-N/index.html` for each planned module
- `./courses/<curso>/estrutura.md` — a estrutura do curso (abaixo)

Os shells são criados AQUI, 1×, fora do harness: são arquivos compartilhados — os escritores
de capítulo nunca os tocam (é a disjunção por capítulo que permite o paralelo).

Do not copy any existing course curriculum blindly. Reuse structure and templates, not topic content.

## 🚪 Portão de ESTRUTURA (o análogo do portão TDD)

Curso não tem teste executável; o "vermelho" que trava a escrita é a **definição fechada antes
da prosa**. Autore `./courses/<curso>/estrutura.md` com o humano e **aprove antes de invocar o
harness** — capítulo sem critério = portão aberto = nada escreve (o harness bloqueia em código).

Por capítulo, registre ANTES de qualquer prosa:

- `id` e `titulo`; `arquivo` (relativo ao curso, ex.: `modulo-1/o-que-e.html` — **disjunto**
  dos demais, é o que permite escritores em paralelo);
- **objetivo de aprendizagem** — UM learning job;
- **critérios verificáveis** — checklist que uma revisão consegue julgar;
- **pré-requisitos** — o que assume que os capítulos anteriores ensinaram (o contrato entre
  capítulos, análogo do contrato entre unidades do dev-loop);
- **não cobre** (non-goals do capítulo), **tom**, **personas**, **fontes** (diagnóstico/
  transcrição/docx);
- `reescrever: true` quando o arquivo já existe e o run deve sobrescrevê-lo — sem essa marca,
  arquivo existente bloqueia o run (o análogo do teste que nasce verde).

Feche com a marca literal `Status: aprovada` só depois do OK do humano — o harness valida a
marca e bloqueia sem ela.

**Regra do planner:** a estrutura é autorada pelo titular **Fable** — sessão Fable autora
direto; sessão não-Fable despacha um agente promovido via `model: "fable"` pra decompor e
consolida o retorno. Erro de estrutura multiplica em TODOS os capítulos.

## 💸 Plano de custo/rigor (OBRIGATÓRIO antes de invocar)

Leia os defaults do usuário (`~/.claude/mimyr/defaults.md`, campos `gerar_curso_*` — contrato
em `references/defaults.md`) e monte o arg `tiering` a partir deles:
`gerar_curso_haiku: desligado` → `checks=sonnet` (e `estrutura=sonnet`);
`gerar_curso_escritor: opus` → `escrever=opus`. Arquivo/campos ausentes → **não pergunte nada
e não monte `tiering`**: os defaults embutidos do script já são o comportamento certo
(escrever=sonnet, checks=haiku·low, revisão opus·high).

| Perfil | Quando sugerir | O que muda no harness |
|---|---|---|
| **Econômico** | curso pequeno (≤3 capítulos), reescrita pontual | escritores sequenciais · 1 lente (didática) |
| **Balanceado** | caso comum | escritores em paralelo · 2 lentes (didática + voz) |
| **Máximo** | curso técnico denso, material novo, muitos módulos | escritores em paralelo · 3 lentes (+ precisão técnica) |

Invariantes que NENHUM perfil remove (estão no script): portão de estrutura fechado, escritor
não toca arquivo fora do seu capítulo (bloqueante automático em código), teto de 3 iterações,
revisor nunca é o autor, checks mecânicos em toda iteração, lente/confirmação/checks que não
retornam ABORTAM o run (fail-closed, reinvocável), e **Haiku somente nos steps mecânicos
whitelisted em código** — `checks` por default e `estrutura` (validação de formato) só sob
opt-in nos defaults. Escrita e revisão nunca rebaixam; a promoção do escritor (sonnet→opus) só
entra via `gerar_curso_escritor`/`tiering`, e a whitelist `MODELOS_STEP` recusa (com registro
em `modelos.recusados`) qualquer pedido fora do permitido do step. O effort tem piso `high`
nos steps de julgamento (`lente`, `confirmacao`).

**Piso de agentes** (nenhuma confirmação de finding): `1 + iterações × (capítulos + lentes + 1)`
— o `+1` por iteração é o agente de checks. Ex.: 3 capítulos, Balanceado (2 lentes), até 3
iterações → `1 + 3×(3+2+1)` = **19** (run que fecha na 1ª iteração: 7). Cada confirmação de
finding plausível soma 1 por cima. Estime o piso, diga que é piso e faça a pergunta de
**opt-in explícito**: *"posso orquestrar com multi-agentes? (~N agentes)"*. Sem opt-in →
fallback sequencial (abaixo).

## ▶️ Invocar o harness (caminho principal)

Com estrutura aprovada + venv validado + perfil + opt-in, invoque a tool **Workflow**:

```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/skills/gerar-curso/harness/curso.mjs",
  args: {
    cursoDir: "./courses/<curso>",
    estruturaPath: "./courses/<curso>/estrutura.md",   // já APROVADA (Status: aprovada)
    perfil: "economico" | "balanceado" | "maximo",
    scriptsDir: "<${CLAUDE_PLUGIN_ROOT}/scripts JÁ EXPANDIDO>",  // o script não tem filesystem/env
    python: ".venv/bin/python",                        // venv validado ANTES de invocar
    hoje: "<data ISO de hoje>",
    tiering: {                                         // OPCIONAL — só quando defaults/rodada divergem
      modelos: { "escrever": "opus", "checks": "sonnet" },
      efforts: { "lente": "xhigh" }
    }
  }
})
```

Steps: `estrutura`, `escrever`, `checks`, `lente`, `confirmacao`. Fallbacks são do script:
chamada promovida (escrever=opus) que não retorna cai pro piso sonnet e desliga a promoção
pelo resto do run; chamada haiku que não retorna cai pro escritor Sonnet e desliga o haiku —
tudo registrado em `fallbacks`. **Não trate você o fallback**, não pergunte ao usuário, não
faça probe de modelo. Ressalva honesta: o script não distingue "tier/agente indisponível" de
"schema inválido/timeout" — `fallbacks[].causa` diz isso.

O script roda em background e devolve um resultado estruturado. Trate os 4 desfechos:

- **`status: "verde"`** → capítulos escritos com critérios cobertos, checks mecânicos ok,
  revisão sem bloqueante confirmado. Retome o pós-verde (abaixo) e persista o relatório.
- **`status: "bloqueado"`** (fase Estrutura) → estrutura sem aprovação, capítulo sem
  objetivo/critérios, arquivo já existente sem `reescrever: true`. Corrija a estrutura COM o
  humano e reinvoque — o harness não improvisa.
- **`status: "escalado"`** → teto de iterações, escritor bloqueado (fonte ausente), falha de
  check em arquivo fora dos capítulos (shell/asset — correção é sua, não dos escritores), ou
  finding bloqueante sem capítulo mapeável (furo de ESTRUTURA). Apresente o diagnóstico ao
  humano e espere decisão — loop que não converge é sinal de estrutura ruim.
- **`status: "erro"`** → falha de infraestrutura de um agente (fail-closed); reinvocar com
  `resumeFromRunId` aproveita tudo que já completou.

## Pós-verde (fora do harness — arquivos compartilhados, 1×)

1. Sidebar e índice: `python ${CLAUDE_PLUGIN_ROOT}/scripts/injetar_sidebar.py ./courses/<curso>`
   e `python ${CLAUDE_PLUGIN_ROOT}/scripts/atualizar_indice_curso.py ./courses/<curso>`.
2. **SEO** — update `./courses/<curso>/seo.json` and page meta descriptions
   (`${CLAUDE_PLUGIN_ROOT}/scripts/atualizar_seo.py`, com `--default-image` quando aplicável).
3. Correções mecânicas apontadas como não-bloqueantes: os scripts de check podem rodar SEM
   `--dry-run` agora (`corrigir_acentos.py`, `remover_travessao.py`), mais `melhorar_a11y.py`.
4. Validation — run tests and local link checks; rode também
   `${CLAUDE_PLUGIN_ROOT}/scripts/checar_svg_overflow.py ./courses/<curso>` se houver diagramas SVG.
5. **Persista o relatório** em `./courses/<curso>/relatorio-geracao.md`: por capítulo
   (critérios, findings confirmados × refutados com veredito, iterações), modelos/efforts
   efetivos por step, fallbacks, recusas de tiering, e a lista do que o humano revisa antes de
   publicar (findings não-bloqueantes + build/deploy do workspace). Relatório sem casa é
   rastro perdido.
6. Commit/push e build/deploy do site são do workspace e do humano — **o harness nunca
   commita**.

## Multi-curso (prefixos de caminho e scripts)

Cada curso é publicado sob seu próprio prefixo (`/<curso>/`). Ao criar um curso
novo, não assuma o caminho do curso piloto do workspace:

- copie `analytics.js` e `cookie-consent.js` para `./courses/<curso>/` (são
  servidos a partir de `/<curso>/`);
- ao injetar GA4, passe `--scripts-prefix /<curso>` para `tools/injetar_ga4.py`
  (script do workspace, acoplado ao site — o default dele aponta para o curso piloto);
- mantenha `og:image` própria em `./courses/<curso>/og-image.png` e use
  `--default-image` ao rodar `${CLAUDE_PLUGIN_ROOT}/scripts/atualizar_seo.py`.

## Workflow (visão completa)

1. **Voice** — confirm `./perfil-de-voz.md`; if absent, offer `bragir:analisar-voz`.
2. **Personas** — create/confirm files in `./personas/`; then create `./courses/<curso>/personas.md`.
3. **Source inventory** — map docx, transcripts, and diagnostics by unit. Para fontes ainda em vídeo/docx: `${CLAUDE_PLUGIN_ROOT}/scripts/extrair_audio.py`, `transcrever.py` e `extract_docx.py` (venv).
4. **Diagnostics** — run `mimyr:analise-de-aula` for each source unit if diagnostics do not exist.
5. **Estrutura** — autorar `./courses/<curso>/estrutura.md` com o humano (portão acima) e aprovar.
6. **Shells** — course setup acima (índice, módulos, seo.json, styles).
7. **Plano de custo + opt-in** — perfil, tiering via defaults, piso de agentes.
8. **Harness** — invocar `harness/curso.mjs` (escrever ∥ → checks → revisar, até verde).
9. **Pós-verde** — sidebar/índice/SEO/relatório (acima).

## 🔁 Fallback sem multi-agente (sem opt-in ou sem a tool Workflow)

O protocolo não muda; só o paralelismo. Execute você mesmo, sequencial:

1. 🚪 Portão de estrutura: `estrutura.md` aprovada, critérios por capítulo fechados. Sem isso,
   nada de prosa.
2. Por capítulo, na ordem: `mimyr:escrever-capitulo` com o contrato do capítulo (objetivo,
   critérios, tom, personas, pré-requisitos, não-cobre) — nunca tocar arquivo de outro capítulo.
3. Checks mecânicos em dry-run: `corrigir_acentos.py --dry-run`, `remover_travessao.py
   --dry-run`, `checar_svg_overflow.py`, links/placeholders (venv).
4. Revisão adversarial: as lentes do perfil, uma por vez, tentando refutar — didática sobre o
   curso inteiro (progressão × contratos), voz contra `./perfil-de-voz.md`, técnica se Máximo
   (`mimyr:revisar-capitulo` como checklist-base); finding sem arquivo + cenário é descartado;
   plausível é confirmado antes de reescrever.
5. Não fechou → próxima iteração só nos capítulos com falha (máx 3); estourou → escalar ao
   humano com diagnóstico. Verde → pós-verde acima, mesmo relatório, mesmo destino.

## NUNCA fazer

- ❌ Invocar o harness sem estrutura aprovada, sem venv validado, ou sem opt-in de custo
- ❌ Escrever capítulo com o portão de estrutura aberto (capítulo sem critérios)
- ❌ Re-implementar o loop em prosa quando a tool Workflow existe — o script É o protocolo
- ❌ Tocar templates/build/deploy do workspace de dentro do fluxo de geração
- ❌ Ignorar um `status: "escalado"` e reinvocar sem decisão humana
- ❌ Commit/push por conta própria (o harness aplica prosa na working tree; commits são do humano)
- ❌ Relatório sem casa: todo run persiste em `./courses/<curso>/relatorio-geracao.md`

## Output

Produce a concise course build report:

- Course path
- Persona manifesto path
- Module list
- Diagnostics created/reused
- Pages created/reused (com iterações e findings por capítulo, vindos do relatório do harness)
- Review gaps
- Next concrete action
