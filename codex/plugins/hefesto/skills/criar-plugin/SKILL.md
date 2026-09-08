---
name: criar-plugin
description: "Use when o usuário pedir para criar, scaffoldar ou iniciar um plugin nativo do Codex dentro de um diretório de desenvolvimento."
---

# Criar Plugin

Na primeira utilização, leia `../../RUNTIME.md`. Leia também `../../shared/skills/criar-plugin/references/layout-canonico.md` para o contexto legado e [o layout Codex](references/layout-codex.md) para as diferenças nativas.

## Entrada

Obtenha nome em kebab-case, descrição e diretório pai. Confirme capacidades opcionais antes de declarar apps ou servidores MCP; não invente conectores nem credenciais.

## Fluxo

Execute, a partir do diretório desta skill:

```sh
node scripts/scaffold-plugin.mjs --path <diretorio-pai> --name <nome> --description <descricao>
```

O scaffold cria `.codex-plugin/plugin.json` e `skills/`, sem marketplace. Só crie ou altere um marketplace quando isso fizer parte explícita do pedido.

Depois, adicione as skills solicitadas com `criar-skill` e rode `validar-plugin` contra a raiz criada.

## Limites

- O script recusa nome ausente, nome fora de kebab-case e diretório já existente.
- Não use opção de sobrescrita. Preserve arquivos existentes e resolva colisões com o usuário.
- Dados do usuário ficam no workspace dele, fora do plugin.
