---
name: criar-plugin
description: "Scaffold a new Claude Code plugin inside a marketplace repo. Use when the user asks to criar um plugin, scaffoldar um plugin novo, adicionar um plugin ao marketplace, ou transformar skills soltas em plugin distribuível."
---

# Criar Plugin

Scaffolda um plugin novo dentro de um repo-marketplace, com manifesto válido e registro no `marketplace.json`. Segue o layout canônico descrito em `${CLAUDE_PLUGIN_ROOT}/skills/criar-plugin/references/layout-canonico.md` — leia antes de gerar qualquer arquivo.

## Input

Pergunte ao usuário (o que ainda não tiver sido dito):

1. **Nome do plugin** — kebab-case, PT quando fizer sentido (ex.: `bragir`, `hestia`).
2. **Descrição curta** — uma frase; vai para `plugin.json` e para a entrada no `marketplace.json`.
3. **Categoria e tags** — ex.: `writing`, `productivity`; tags em PT/EN conforme o público.
4. **Primeira skill** — todo plugin nasce com pelo menos uma skill planejada (pode ser só o nome; o scaffold dela é da skill `criar-skill`).

## Before scaffolding

1. Localize a raiz do marketplace: suba a partir do cwd até achar `.claude-plugin/marketplace.json`.
   - **Se não existir marketplace**: ofereça scaffoldar o repo-marketplace mínimo primeiro (raiz com `.claude-plugin/marketplace.json`, `README.md`, `LICENSE`, `.gitignore`) e o plugin dentro de `plugins/<nome>/`. Confirme com o usuário antes.
2. Verifique colisão: `plugins/<nome>/` não pode existir, nem entrada homônima em `marketplace.json.plugins[]`.

## Scaffold determinístico e distribuição Codex

Em um repo-marketplace canônico (com `.claude-plugin/marketplace.json` e plugins locais), antes de escrever qualquer arquivo, execute o helper desta cópia a partir do workspace:

```sh
node "${CLAUDE_PLUGIN_ROOT}/skills/criar-plugin/scripts/scaffold-marketplace.mjs" --repo "<raiz-do-marketplace>" --kind plugin --plugin "<plugin>" --name "<plugin>" --description "<descricao>"
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

1. `plugins/<nome>/.claude-plugin/plugin.json`:

```json
{
  "name": "<nome>",
  "version": "0.1.0",
  "description": "<descrição>",
  "author": { "name": "<owner do marketplace>", "url": "<url do owner>" },
  "homepage": "<repository do marketplace>",
  "repository": "<repository do marketplace>",
  "license": "MIT",
  "keywords": ["<tag1>", "<tag2>"]
}
```

2. `plugins/<nome>/README.md` — stub com nome, propósito e tabela de skills (vazia ou com a primeira skill planejada).
3. Entrada em `marketplace.json.plugins[]` com `source` **string relativa** `"./plugins/<nome>"`, `version` alinhada ao `plugin.json`, `description`, `category` e `tags`.
4. Bump minor em `marketplace.json.metadata.version` (plugin novo = minor do marketplace).
5. Se o plugin já nasce com agentes fixos ou harness multi-agente, scaffold junto `agents/`, `tests/` e `skills/<skill>/harness/` no primeiro pacote de arquivos. Não deixe o contrato do harness só em prosa. Se não houver harness, não crie diretórios vazios à toa. Para escrever a `description` e o corpo de cada agente para o modelo que vai executá-lo, use a skill `iris:delegar-agente`. A forja declara o plugin `iris` em `dependencies` no Claude Code: ele é instalado com a forja.

## After

1. Se o pedido inclui a primeira skill, invoque `criar-skill` e conclua sua autochecagem obrigatória. Toda skill criada precisa de `name` igual ao diretório; não encerre com apenas a descrição no frontmatter.
2. Execute `node "${CLAUDE_PLUGIN_ROOT}/skills/validar-plugin/scripts/validar.mjs" "<raiz-do-marketplace>" --plugin "<plugin-criado>" e corrija todos os erros antes de anunciar pronto. Use o arquivo desta cópia, não uma instalação global.
3. Atualize a tabela de plugins/skills do `README.md` da raiz do marketplace.
4. Sugira commit: `feat: novo plugin <nome>`.

## Important

- Para paths de dados do workspace usados pela skill gerada, resolva `local_*` em `CLAUDE.md` → defaults do usuário → convenção descoberta no cwd → default documentado. Mais de um candidato exige esclarecimento; recurso obrigatório ausente interrompe salvo scaffold autorizado. Paths em exemplos são ilustrativos. Essa regra é para dados do consumidor; o layout canônico de distribuição é relativo à raiz explícita do marketplace.

- `source` no `marketplace.json` é sempre path relativo string; `"source": "."` não é spec-válido.
- `plugin.json` fica em `plugins/<nome>/.claude-plugin/`, nunca na raiz do plugin nem do repo.
- Nunca use paths absolutos de SO em nenhum arquivo gerado; recursos internos do plugin são referenciados via `${CLAUDE_PLUGIN_ROOT}`.
- Se o plugin novo depende de skills de outro plugin (ex.: `bragir:escrever-como-autor`), documente a dependência no README do plugin. Se ele não funciona sem esse plugin, declare-o também em `dependencies` do `plugin.json` (`"nome"` resolve no mesmo marketplace): instalar o plugin instala a dependência, e desativá-la desativa o plugin. O `validar.mjs` confere que o nome existe no marketplace.
- Se houver harness, o contrato fica em `skills/<skill>/harness/` e os agentes fixos em `agents/`; a forja não deve deixar esse padrão implícito.

Inventário de plugins/skills no README e no AGENTS.md é documentação de manutenção, distinto do inventário de arquivos do espelho público. Ausência de espelho público não dispensa atualizar essas contagens e linhas documentais quando o validador do alvo as exige. Preserve instruções existentes e acrescente somente o registro do novo pacote/capacidade; não interprete “sem inventário público” como proibição de atualizar README/AGENTS.
