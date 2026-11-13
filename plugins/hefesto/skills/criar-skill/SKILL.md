---
name: criar-skill
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

## Scaffold determinístico e distribuição Codex

Em um repo-marketplace canônico (com `.claude-plugin/marketplace.json` e plugins locais), antes de escrever qualquer arquivo, execute o helper desta cópia a partir do workspace:

```sh
node "${CLAUDE_PLUGIN_ROOT}/skills/criar-plugin/scripts/scaffold-marketplace.mjs" --repo "<raiz-do-marketplace>" --kind skill --plugin "<plugin>" --name "<nome-da-skill>" --description "<descricao>"
```

Fora desse layout, preserve o fluxo manual desta skill para o plugin de destino; não exija nem crie um marketplace adicional.

O helper verifica colisões antes de alterar arquivos. Sem `codex/resources.json`, gera somente Claude e não cria `codex/`. Com esse inventário, cria as duas distribuições: fonte Claude, entrada nativa Codex com links para `../../RUNTIME.md` e contrato em `shared/`, mapeamentos e cópias iniciais dos recursos. Plugin novo também recebe manifesto e registro no marketplace Codex. Complete os arquivos gerados conforme o Output; não repita a criação nem o bump inicial do marketplace.

Antes de concluir no repositório dual:

1. Complete a skill nativa para a capacidade; declare referências e scripts adicionais em `codex/resources.json`. Não edite cópias de `shared/`.
2. Execute `npm --prefix codex run sync` após finalizar as fontes.
3. Atualize README/inventários Claude e Codex; skill nova exige minor nos dois pacotes existentes e CHANGELOG, além do marketplace Claude. Plugin novo começa em `0.1.0` em ambas as distribuições. Use `versionar-plugin` e confira ambos os manifestos.
4. Atualize contagens exatas de plugins/skills/recursos em `codex/scripts/check.mjs`, `codex/scripts/smoke-install.mjs` e `codex/tests/distribution.test.mjs` conforme existirem no alvo; se acrescentar testes, ajuste o piso de testes executados, sem reduzir cobertura.
5. Revise cada arquivo novo e classifique-o em `scripts/espelho-publico.json` quando o alvo usar esse inventário. Não aprove arquivos privados automaticamente.
6. Rode o validador Claude abaixo e `npm --prefix codex test`. Scaffold técnico não comprova execução comportamental da skill. Não conclua enquanto faltar a integração.

## Output

1. `plugins/<plugin>/skills/<nome>/SKILL.md` com:
   - Frontmatter mínimo: `name` igual ao nome do diretório (kebab-case, até 64 caracteres) e `description` iniciando com **verbo em inglês** + gatilhos concretos em PT/EN (200–400 chars úteis, máx 1024). Campos opcionais quando fizer sentido: `allowed-tools`, `argument-hint`, `disable-model-invocation`.
   - Corpo estruturado: `## Input`, `## Before X`, `## Output`, `## Important` (adapte os títulos à natureza da skill, mantendo a progressão entrada → pré-condições → saída → armadilhas).
   - Dependências externas declaradas no corpo (ex.: precisa da skill oficial `docx`; consome `bragir:escrever-como-autor`).
2. Se a skill tiver material de apoio longo, mova para `references/<tema>.md` no diretório da skill e referencie via `${CLAUDE_PLUGIN_ROOT}`. O corpo da skill é prompt carregado a cada uso: corte o que o modelo já faz sozinho. Use `iris:escrever-prompt` para calibrar corpo e `description` ao modelo de destino; a `iris` é dependência declarada da forja no Claude Code.
3. Se a skill precisar de script, coloque em `scripts/` no diretório da skill — sem dependências externas, sem build step.
4. Atalho conforme a convenção do plugin, seguindo a seção abaixo.

## Convenção de atalhos

Siga a convenção de comandos do plugin de destino, respeitando primeiro a instrução explícita do usuário. Confira o README, as instruções do plugin e os comandos de operações comparáveis: uma pasta vazia de comandos não prova que o plugin adota atalhos. Se a convenção é usar comandos explícitos, crie o atalho fino em `commands/<nome>.md` delegando para a skill, no mesmo formato dos existentes. Se a convenção é invocar skills pelo contexto, mantenha apenas a skill. Pergunte somente quando o padrão não estiver claro, inclusive quando as evidências forem conflitantes; a pergunta encerra o turno e a resposta deve ser reaproveitada.

Em pacote somente Codex, não crie `commands/`: a skill nativa já é o ponto de entrada. Em marketplace dual, aplique a convenção de comandos à distribuição Claude e mantenha a entrada nativa Codex, sem duplicá-la para simular um atalho.

## Autochecagem obrigatória antes de concluir

Use este molde de frontmatter, substituindo o nome pelo diretório criado:

```yaml
---
name: nome-da-skill
description: "Write the requested content. Use when o usuário pedir esta capacidade."
---
```

Depois de escrever, releia o arquivo gerado e execute o validador DESTA cópia do plugin:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/validar-plugin/scripts/validar.mjs" "<raiz-do-marketplace>" --plugin "<plugin-criado>"
```

Ausência ou divergência de `name` é erro. Corrija e execute novamente antes de anunciar o
scaffold pronto. Não substitua este comando por `claude plugin validate`: o parser nativo não
cobra este contrato da forja. Não procure outra instalação global do validador.

## After

1. Atualize a tabela de skills no `README.md` da raiz do marketplace (e no README do plugin, se houver).
2. Invoque `versionar-plugin` (minor: skill nova).
3. Invoque `validar-plugin` para conferir.
4. Sugira commit: `feat: nova skill <nome>`.

## Important

- Para paths de dados do workspace usados pela skill gerada, resolva `local_*` em `CLAUDE.md` → defaults do usuário → convenção descoberta no cwd → default documentado. Mais de um candidato exige esclarecimento; recurso obrigatório ausente interrompe salvo scaffold autorizado. Paths em exemplos são ilustrativos. Essa regra é para dados do consumidor; o layout canônico de distribuição é relativo à raiz explícita do marketplace.

- Description vaga não dispara auto-invocação — gatilhos concretos são o que faz a skill existir na prática.
- Instruções de I/O específicas: "escreva `./foo.md`" é melhor que "salve em algum lugar".
- Nunca hardcode paths absolutos; dados do usuário ficam no projeto dele, recursos da skill ficam no plugin.
- Sem emojis, salvo pedido explícito do dono do plugin.

Inventário de plugins/skills no README e no AGENTS.md é documentação de manutenção, distinto do inventário de arquivos do espelho público. Ausência de espelho público não dispensa atualizar essas contagens e linhas documentais quando o validador do alvo as exige. Preserve instruções existentes e acrescente somente o registro do novo pacote/capacidade; não interprete “sem inventário público” como proibição de atualizar README/AGENTS.
