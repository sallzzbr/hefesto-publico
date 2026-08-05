---
description: "Bump plugin and marketplace versions in sync (semver) across plugin.json, marketplace.json entry and metadata. Use when the user asks to versionar um plugin, subir versão, fazer bump minor/patch/major, ou depois de adicionar/alterar/remover skills."
---

# Versionar Plugin

Faz o bump semver de um plugin mantendo os três lugares em sincronia. Versão dessincronizada é o erro mais comum do fluxo manual — esta skill existe para eliminá-lo.

## Input

1. **Plugin** a versionar.
2. **Natureza da mudança**, para derivar o bump:
   - `patch` — ajuste em skill/command/agent existente, correção de texto, fix de script.
   - `minor` — skill, command, agent ou script novo.
   - `major` — quebra de contrato: renomear/remover skill que outros consomem, mudar onde dados do usuário ficam, mudar formato de artefato gerado.

Se o usuário não souber classificar, olhe o `git diff` do plugin e proponha o bump com justificativa.

## Os três lugares (sempre juntos)

1. `plugins/<nome>/.claude-plugin/plugin.json` → `version`.
2. `.claude-plugin/marketplace.json` → `plugins[]` na entrada do plugin → `version` (igual ao plugin.json).
3. `.claude-plugin/marketplace.json` → `metadata.version` (versão do **marketplace**): minor quando entra plugin ou skill nova em qualquer plugin; patch para ajustes; major se o marketplace muda de forma incompatível.

## Output

1. Os dois JSONs editados, com as versões novas.
2. Se o plugin tiver `CHANGELOG.md`, adicione a entrada no topo (`## X.Y.Z — <data>` + bullets do que mudou). Não crie changelog se não existir, a menos que o usuário peça.
3. Se o bump for major, aponte no README do plugin o que quebrou e como migrar.
4. Rode `validar-plugin` (o script checa a sincronia) e mostre a saída.
5. Sugira commit no padrão do repo: `feat:`/`fix:`/`docs:` + corpo com o porquê; major ganha `!` (`feat(<plugin>)!: ...`).

## Important

- Nunca bump só num lugar "pra ajustar depois" — os três mudam no mesmo commit.
- Bump de versão não é changelog: a mensagem de commit explica o porquê da mudança, a versão só codifica o tamanho dela.
- Ao mexer em vários plugins de uma vez, cada plugin tem seu próprio bump; o `metadata.version` do marketplace sobe uma vez só, pelo maior grau entre eles.
