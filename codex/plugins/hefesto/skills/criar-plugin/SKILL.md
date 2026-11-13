---
name: criar-plugin
description: "Use when o usuário pedir para criar, scaffoldar ou iniciar um plugin nativo do Codex dentro de um diretório de desenvolvimento."
---

# Criar Plugin

Na primeira utilização, leia `../../RUNTIME.md` e o [contrato de domínio](../../shared/skills/criar-plugin/CONTRATO.md). Leia também `../../shared/skills/criar-plugin/references/layout-canonico.md` para o contexto legado e [o layout Codex](references/layout-codex.md) para as diferenças nativas.

Leia também [as dependências](../../DEPENDENCIAS.md) e confira a disponibilidade real de `iris:delegar-agente` antes de gerar agentes, se houver. Dependência ausente deve ser informada e resolvida conforme esse contrato; não instale nem substitua silenciosamente.

## Entrada

Obtenha nome em kebab-case, descrição e diretório pai. Confirme capacidades opcionais antes de declarar apps ou servidores MCP; não invente conectores nem credenciais.

## Fluxo

Execute da raiz do workspace (nunca de dentro do pacote instalado: path relativo criaria ou leria arquivos no cache do plugin), com o caminho real do script resolvido a partir desta skill (`PLUGIN_DIR` no RUNTIME):

```sh
node "<PLUGIN_DIR>/skills/criar-plugin/scripts/scaffold-plugin.mjs" --path <diretorio-pai> --name <nome> --description <descricao>
```

Fora de um marketplace dual, o scaffold cria `.codex-plugin/plugin.json` e `skills/`, sem marketplace. Só crie ou altere um marketplace externo quando isso fizer parte explícita do pedido.

Depois, adicione as skills solicitadas com `criar-skill` e rode `validar-plugin` contra a raiz criada.

## Limites

- O script recusa nome ausente, nome fora de kebab-case e diretório já existente.
- Não use opção de sobrescrita. Preserve arquivos existentes e resolva colisões com o usuário.
- Dados do usuário ficam no workspace dele, fora do plugin.

## Marketplace com duas distribuições

Quando o destino canônico está em `codex/plugins/` de um repo com `codex/resources.json`, o script detecta esse contrato e gera também a fonte Claude em `plugins/`. Colisões em qualquer distribuição ou inventário interrompem antes de escrever. Para destino Claude, use o helper de marketplace descrito no contrato de domínio. Um pacote nativo standalone continua nativo e não ganha árvore Claude.

No modo dual, complete fonte e entrada nativa, declare recursos adicionais no inventário e execute `npm --prefix codex run sync`. Siga a seção “Scaffold determinístico e distribuição Codex” do contrato: README, bumps e CHANGELOG dos dois pacotes, contagens exatas de check/smoke/distribution, revisão do inventário público e validação das duas distribuições. Não edite `shared/` diretamente e não anuncie o scaffold completo antes desses passos.

Inventário de plugins/skills no README e no AGENTS.md é documentação de manutenção, distinto do inventário de arquivos do espelho público. Ausência de espelho público não dispensa atualizar essas contagens e linhas documentais quando o validador do alvo as exige. Preserve instruções existentes e acrescente somente o registro do novo pacote/capacidade; não interprete “sem inventário público” como proibição de atualizar README/AGENTS.
