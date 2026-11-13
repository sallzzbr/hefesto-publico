# Convenções de SKILL.md

Referência da forja para escrever skills que disparam e funcionam. Destilada do contrato do repo hefesto; vale para qualquer plugin.

## Frontmatter

Mínimo:

```yaml
---
name: nome-da-skill
description: "<verbo EN> <o que>. Use when <gatilho 1>, <gatilho 2>, <gatilho 3>."
---
```

`name` é obrigatório na convenção do Hefesto: kebab-case, até 64 caracteres e igual ao diretório. O validador exige presença, formato e correspondência também nos plugins externos que ele valida; arquivos legados precisam acrescentar o campo.

Regras de `description` — separadas entre o que o `validar.mjs` **cobra** e o que é **recomendação**:

- **Cobrado:** presente, não vazia, 60–1024 chars (abaixo de 60 é aviso, acima de 1024 é erro).
- **Cobrado nos plugins com teste de contrato:** contém um gatilho de uso explícito — `Use when …` (EN) ou `Use quando/para …` (PT). Os dois dialetos disparam; o repo tem os dois de propósito: hefesto, bragir e mimyr abrem com verbo em inglês (`Write`, `Analyze`, `Scaffold`); hestia e odin abrem com `Use quando …` porque o público é 100% PT-BR e as frases de gatilho são as que o usuário fala.
- Recomendação: gatilhos concretos — os termos que o usuário provavelmente usará quando precisar da skill ("na minha voz", "analisa esses docx", "cria uma persona"). Descrição vaga = skill que nunca dispara.
- Recomendação: mire 200–500 chars úteis. Skills com muitos gatilhos (hestia) passam de 500 e tudo bem — o limite duro é 1024.
- Misture PT e EN quando a base de usuários é bilíngue.

Use aspas em valores textuais com colchetes ou dois-pontos, inclusive `argument-hint: "[nome] [opções]"`. Valide também com `claude plugin validate <diretório-do-plugin>` quando o CLI estiver disponível: o validador standalone não substitui o parser YAML do runtime.

Campos opcionais úteis: `allowed-tools`, `argument-hint`, `paths` (glob para auto-load condicional), `disable-model-invocation` (para skills que só fazem sentido via comando explícito).

## Corpo

- Estrutura clara com progressão. O molde default é `## Input` (o que perguntar/receber) → `## Before X` (pré-condições e checagens) → `## Output` (o que produzir, onde, com template quando couber) → `## Important` (armadilhas e limites) — é o que hefesto, mimyr e bragir usam. Os plugins de domínio (hestia, odin) usam seções próprias (regras inegociáveis, base de leitura, fluxo por operação, banner de ativação); o que não muda é a progressão pré-condições → operação → saída → limites. Skill nova segue o dialeto do plugin onde nasce.
- Liste pré-requisitos e dependências externas: skill oficial (`docx`), skill de outro plugin (`bragir:escrever-como-autor`), ferramenta de sistema.
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
- **Command** = atalho fino `/nome` que delega para a skill. A decisão segue a convenção do plugin conforme a seção abaixo.
- **Agent** = papel com system prompt próprio para trabalho delegado (revisor, validador); só quando há delegação real.
- **Harness/script** = quando existe loop com fases fixas, agentes por fase e critério de parada (ex.: dev-loop do odin). Script sem deps e sem build.

## Convenção de atalhos

Siga a convenção de comandos do plugin de destino, respeitando primeiro a instrução explícita do usuário. Confira o README, as instruções do plugin e os comandos de operações comparáveis: uma pasta vazia de comandos não prova que o plugin adota atalhos. Se a convenção é usar comandos explícitos, crie o atalho fino em `commands/<nome>.md` delegando para a skill, no mesmo formato dos existentes. Se a convenção é invocar skills pelo contexto, mantenha apenas a skill. Pergunte somente quando o padrão não estiver claro, inclusive quando as evidências forem conflitantes; a pergunta encerra o turno e a resposta deve ser reaproveitada.

Em pacote somente Codex, não crie `commands/`: a skill nativa já é o ponto de entrada. Em marketplace dual, aplique a convenção de comandos à distribuição Claude e mantenha a entrada nativa Codex, sem duplicá-la para simular um atalho.

## Anti-padrões

- Backwards-compat shims ao renomear (alias do nome antigo). Renomeou, renomeou em tudo.
- Seções comentadas "por enquanto" — delete ou implemente.
- Emojis decorativos. Exceções nomeadas: o banner de ativação do odin (📍 🆘 🔴 etc., herdado do design de origem) e marcadores **funcionais de estado** (✅ ⚠️ 🛑) em tabelas de veredito do hermes e do mimyr — são enum, não enfeite. Não adicione novos.
- Dados do usuário dentro do plugin (personas, perfis de projeto) — pertencem ao projeto.
