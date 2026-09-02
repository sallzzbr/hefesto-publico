# Convenções de SKILL.md

Referência da forja para escrever skills que disparam e funcionam. Destilada do contrato do repo hefesto; vale para qualquer plugin.

## Frontmatter

Mínimo:

```yaml
---
description: "<verbo EN> <o que>. Use when <gatilho 1>, <gatilho 2>, <gatilho 3>."
---
```

Regras de `description` — separadas entre o que o `validar.mjs` **cobra** e o que é **recomendação**:

- **Cobrado:** presente, não vazia, 60–1024 chars (abaixo de 60 é aviso, acima de 1024 é erro).
- **Cobrado nos plugins com teste de contrato:** contém um gatilho de uso explícito — `Use when …` (EN) ou `Use quando/para …` (PT). Os dois dialetos disparam; o repo tem os dois de propósito: hefesto, bragir e mimyr abrem com verbo em inglês (`Write`, `Analyze`, `Scaffold`); hestia e odin abrem com `Use quando …` porque o público é 100% PT-BR e as frases de gatilho são as que o usuário fala.
- Recomendação: gatilhos concretos — os termos que o usuário provavelmente usará quando precisar da skill ("na minha voz", "analisa esses docx", "cria uma persona"). Descrição vaga = skill que nunca dispara.
- Recomendação: mire 200–500 chars úteis. Skills com muitos gatilhos (hestia) passam de 500 e tudo bem — o limite duro é 1024.
- Misture PT e EN quando a base de usuários é bilíngue.

Campos opcionais úteis: `allowed-tools`, `argument-hint`, `paths` (glob para auto-load condicional), `disable-model-invocation` (para skills que só fazem sentido via comando explícito).

## Corpo

- Estrutura clara com progressão. O molde default é `## Input` (o que perguntar/receber) → `## Before X` (pré-condições e checagens) → `## Output` (o que produzir, onde, com template quando couber) → `## Important` (armadilhas e limites) — é o que hefesto, mimyr e bragir usam. Os plugins de domínio (hestia, odin) usam seções próprias (regras inegociáveis, base de leitura, fluxo por operação, banner de ativação); o que não muda é a progressão pré-condições → operação → saída → limites. Skill nova segue o dialeto do plugin onde nasce.
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
- **Command** = atalho fino `/nome` que delega para a skill. É decisão **por plugin**, não regra: hefesto, hestia e odin têm um command por operação (o usuário invoca de propósito); bragir, mimyr e hermes roteiam só pela `description` (a skill dispara pelo contexto da conversa). Crie command quando a operação é chamada pelo nome; não crie só para cumprir tabela.
- **Agent** = papel com system prompt próprio para trabalho delegado (revisor, validador); só quando há delegação real.
- **Harness/script** = quando existe loop com fases fixas, agentes por fase e critério de parada (ex.: dev-loop do odin). Script sem deps e sem build.

## Anti-padrões

- Backwards-compat shims ao renomear (alias do nome antigo). Renomeou, renomeou em tudo.
- Seções comentadas "por enquanto" — delete ou implemente.
- Emojis decorativos. Exceções nomeadas: o banner de ativação do odin (📍 🆘 🔴 etc., herdado do design de origem) e marcadores **funcionais de estado** (✅ ⚠️ 🛑) em tabelas de veredito do hermes e do mimyr — são enum, não enfeite. Não adicione novos.
- Dados do usuário dentro do plugin (personas, perfis de projeto) — pertencem ao projeto.
