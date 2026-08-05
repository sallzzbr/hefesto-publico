---
description: "Scaffold a new skill (SKILL.md) inside a Claude Code plugin, with valid frontmatter and effective description. Use when the user asks to criar uma skill, adicionar skill a um plugin, escrever um SKILL.md, ou melhorar a description/gatilhos de uma skill existente."
---

# Criar Skill

Scaffolda uma skill nova dentro de um plugin, com frontmatter válido e corpo no padrão da casa. As convenções completas estão em `${CLAUDE_PLUGIN_ROOT}/skills/criar-skill/references/convencoes-skill.md` — leia antes de escrever.

## Input

Pergunte ao usuário (o que ainda não tiver sido dito):

1. **Plugin de destino** — se houver mais de um em `plugins/`, confirme qual.
2. **Nome da skill** — kebab-case, PT quando o público é PT-BR (ex.: `analisar-voz`).
3. **O que ela faz** — uma frase de capacidade ("escreve X", "valida Y").
4. **Gatilhos** — 3+ frases que o usuário diria quando precisa dela ("na minha voz", "analisa esses docx").
5. **I/O** — o que a skill lê e o que escreve, e onde (projeto do usuário vs `${CLAUDE_PLUGIN_ROOT}`).

## Before writing

1. Confirme que `plugins/<plugin>/skills/<nome>/` não existe.
2. Verifique se já existe skill com propósito sobreposto no plugin — se sim, proponha estender em vez de duplicar.

## Output

1. `plugins/<plugin>/skills/<nome>/SKILL.md` com:
   - Frontmatter mínimo: `description` iniciando com **verbo em inglês** + gatilhos concretos em PT/EN (200–400 chars úteis, máx 1024). Campos opcionais quando fizer sentido: `allowed-tools`, `argument-hint`, `disable-model-invocation`.
   - Corpo estruturado: `## Input`, `## Before X`, `## Output`, `## Important` (adapte os títulos à natureza da skill, mantendo a progressão entrada → pré-condições → saída → armadilhas).
   - Dependências externas declaradas no corpo (ex.: precisa da skill oficial `docx`; consome `bragir:escrever-como-antonio`).
2. Se a skill tiver material de apoio longo, mova para `references/<tema>.md` no diretório da skill e referencie via `${CLAUDE_PLUGIN_ROOT}`.
3. Se a skill precisar de script, coloque em `scripts/` no diretório da skill — sem dependências externas, sem build step.
4. Command atalho opcional em `plugins/<plugin>/commands/<nome>.md` (pergunte ao usuário; padrão da casa é ter).

## After

1. Atualize a tabela de skills no `README.md` da raiz do marketplace (e no README do plugin, se houver).
2. Invoque `versionar-plugin` (minor: skill nova).
3. Invoque `validar-plugin` para conferir.
4. Sugira commit: `feat: nova skill <nome>`.

## Important

- Description vaga não dispara auto-invocação — gatilhos concretos são o que faz a skill existir na prática.
- Instruções de I/O específicas: "escreva `./foo.md`" é melhor que "salve em algum lugar".
- Nunca hardcode paths absolutos; dados do usuário ficam no projeto dele, recursos da skill ficam no plugin.
- Sem emojis, salvo pedido explícito do dono do plugin.
