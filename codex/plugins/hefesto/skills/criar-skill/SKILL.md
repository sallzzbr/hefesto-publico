---
name: criar-skill
description: "Use when o usuário pedir para criar, adicionar ou scaffoldar uma skill nativa do Codex em um plugin existente."
---

# Criar Skill

Na primeira utilização, leia `../../RUNTIME.md` e o [contrato de domínio](../../shared/skills/criar-skill/CONTRATO.md) e `../../shared/skills/criar-skill/references/convencoes-skill.md`. Aplique o formato nativo: frontmatter com `name` e `description`, corpo focado e recursos locais descobertos por links relativos.

Leia também [as dependências](../../DEPENDENCIAS.md) e confira a disponibilidade real de `iris:escrever-prompt` antes de gerar corpo e descrição. Dependência ausente deve ser informada e resolvida conforme esse contrato; não instale nem substitua silenciosamente.

## Entrada

Obtenha raiz do plugin, nome em kebab-case, gatilhos concretos para a descrição, entradas, saídas e dependências reais. Verifique se já existe skill sobreposta antes de criar outra.

## Fluxo

Execute da raiz do workspace (nunca de dentro do pacote instalado: path relativo criaria ou leria arquivos no cache do plugin), com o caminho real do script resolvido a partir desta skill (`PLUGIN_DIR` no RUNTIME):

```sh
node "<PLUGIN_DIR>/skills/criar-skill/scripts/scaffold-skill.mjs" --plugin <raiz-do-plugin> --name <nome> --description <descricao>
```

Substitua o corpo mínimo pelo fluxo específico da capacidade. Mova apenas material condicional ou extenso para `references/`; scripts devem ser standalone quando possível. Rode `validar-plugin` ao terminar.

## Convenção de atalhos

Siga a convenção de comandos do plugin de destino, respeitando primeiro a instrução explícita do usuário. Confira o README, as instruções do plugin e os comandos de operações comparáveis: uma pasta vazia de comandos não prova que o plugin adota atalhos. Se a convenção é usar comandos explícitos, crie o atalho fino em `commands/<nome>.md` delegando para a skill, no mesmo formato dos existentes. Se a convenção é invocar skills pelo contexto, mantenha apenas a skill. Pergunte somente quando o padrão não estiver claro, inclusive quando as evidências forem conflitantes; a pergunta encerra o turno e a resposta deve ser reaproveitada.

Em pacote somente Codex, não crie `commands/`: a skill nativa já é o ponto de entrada. Em marketplace dual, aplique a convenção de comandos à distribuição Claude e mantenha a entrada nativa Codex, sem duplicá-la para simular um atalho.

## Limites

- `name` deve coincidir com o diretório e `description` deve explicar quando usar a skill.
- O script recusa colisões e não sobrescreve `SKILL.md` existente.
- Não declare skills globais, conectores, modelos ou credenciais como disponíveis sem evidência do ambiente.

## Marketplace com duas distribuições

Quando o destino canônico está em `codex/plugins/` de um repo com `codex/resources.json`, o script detecta esse contrato e gera também a fonte Claude em `plugins/`. Colisões em qualquer distribuição ou inventário interrompem antes de escrever. Para destino Claude, use o helper de marketplace descrito no contrato de domínio. Um pacote nativo standalone continua nativo e não ganha árvore Claude.

No modo dual, complete fonte e entrada nativa, declare recursos adicionais no inventário e execute `npm --prefix codex run sync`. Siga a seção “Scaffold determinístico e distribuição Codex” do contrato: README, bumps e CHANGELOG dos dois pacotes, contagens exatas de check/smoke/distribution, revisão do inventário público e validação das duas distribuições. Não edite `shared/` diretamente e não anuncie o scaffold completo antes desses passos.

Inventário de plugins/skills no README e no AGENTS.md é documentação de manutenção, distinto do inventário de arquivos do espelho público. Ausência de espelho público não dispensa atualizar essas contagens e linhas documentais quando o validador do alvo as exige. Preserve instruções existentes e acrescente somente o registro do novo pacote/capacidade; não interprete “sem inventário público” como proibição de atualizar README/AGENTS.
