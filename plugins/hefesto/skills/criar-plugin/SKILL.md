---
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
5. Se o plugin já nasce com agentes fixos ou harness multi-agente, scaffold junto `agents/`, `tests/` e `skills/<skill>/harness/` no primeiro pacote de arquivos. Não deixe o contrato do harness só em prosa. Se não houver harness, não crie diretórios vazios à toa.

## After

1. Invoque `criar-skill` para a primeira skill, se o usuário quiser já.
2. Invoque `validar-plugin` para conferir o resultado.
3. Atualize a tabela de plugins/skills do `README.md` da raiz do marketplace.
4. Sugira commit: `feat: novo plugin <nome>`.

## Important

- `source` no `marketplace.json` é sempre path relativo string; `"source": "."` não é spec-válido.
- `plugin.json` fica em `plugins/<nome>/.claude-plugin/`, nunca na raiz do plugin nem do repo.
- Nunca use paths absolutos de SO em nenhum arquivo gerado; recursos internos do plugin são referenciados via `${CLAUDE_PLUGIN_ROOT}`.
- Se o plugin novo depende de skills de outro plugin (ex.: `bragir:escrever-como-antonio`), documente a dependência no README do plugin.
- Se houver harness, o contrato fica em `skills/<skill>/harness/` e os agentes fixos em `agents/`; a forja não deve deixar esse padrão implícito.
