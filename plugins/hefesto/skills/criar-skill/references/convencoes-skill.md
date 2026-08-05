# Convenções de SKILL.md

Referência da forja para escrever skills que disparam e funcionam. Destilada do contrato do repo hefesto; vale para qualquer plugin.

## Frontmatter

Mínimo:

```yaml
---
description: "<verbo EN> <o que>. Use when <gatilho 1>, <gatilho 2>, <gatilho 3>."
---
```

Regras de `description`:

- Comece com verbo em inglês (`Write`, `Analyze`, `Create`, `Generate`, `Scaffold`, `Validate`) — o matcher favorece isso.
- Inclua gatilhos concretos: os termos que o usuário provavelmente usará quando precisar da skill ("na minha voz", "analisa esses docx", "cria uma persona").
- Máx 1024 chars; mire 200–400 úteis. Descrição vaga = skill que nunca dispara.
- Misture PT e EN quando a base de usuários é bilíngue — os dois disparam.

Campos opcionais úteis: `allowed-tools`, `argument-hint`, `paths` (glob para auto-load condicional), `disable-model-invocation` (para skills que só fazem sentido via comando explícito).

## Corpo

- Estrutura clara com progressão: `## Input` (o que perguntar/receber) → `## Before X` (pré-condições e checagens) → `## Output` (o que produzir, onde, com template quando couber) → `## Important` (armadilhas e limites).
- Liste pré-requisitos e dependências externas: skill oficial (`docx`), skill de outro plugin (`bragir:escrever-como-antonio`), ferramenta de sistema.
- Seja específico em I/O: "escreva `./perfil-de-voz.md`" em vez de "salve o perfil".
- Quando delegar para outra skill, diga o nome exato e o momento de invocar.
- Templates de arquivo gerado entram no corpo (ou em `references/` se longos).

## Nomenclatura e paths

- Diretório da skill: kebab-case, PT quando o público-alvo é PT-BR. O nome do diretório é o nome da skill.
- Recursos internos do plugin: `${CLAUDE_PLUGIN_ROOT}/...` (resolvido pelo runtime).
- Arquivos do projeto do usuário: paths relativos ao cwd (`./personas/`). Nunca assuma estrutura além do cwd.
- Nunca paths absolutos de SO em arquivo versionado.

## O que separa skill de command e de agent

- **Skill** = capacidade com instruções (dispara por contexto ou comando; carrega conhecimento).
- **Command** = atalho fino `/nome` que delega para a skill (padrão da casa: toda skill relevante tem um).
- **Agent** = papel com system prompt próprio para trabalho delegado (revisor, validador); só quando há delegação real.
- **Harness/script** = quando existe loop com fases fixas, agentes por fase e critério de parada (ex.: dev-loop do odin). Script sem deps e sem build.

## Anti-padrões

- Backwards-compat shims ao renomear (alias do nome antigo). Renomeou, renomeou em tudo.
- Seções comentadas "por enquanto" — delete ou implemente.
- Emojis sem pedido explícito.
- Dados do usuário dentro do plugin (personas, perfis de projeto) — pertencem ao projeto.
