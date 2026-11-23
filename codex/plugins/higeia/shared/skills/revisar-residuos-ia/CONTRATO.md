---
name: revisar-residuos-ia
description: "Review local Git worktrees and workflow leftovers. Use when o usuário pedir para revisar worktrees antigas, investigar branches sem merge, localizar temporários ou entender o que sobrou de sessões de IA."
---

# Revisar resíduos de IA

## Entrada e execução

Requer Node.js 22+ e Git. Use a raiz informada pelo usuário ou o diretório atual. O script entrega JSON na saída padrão. Execute no workspace do usuário, passando o caminho real da raiz escolhida.

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/diagnostico.mjs" residuos --root "<diretório>"
```

## Investigação e saída

A raiz pode ser um repositório ou uma coleção de projetos. O coletor procura repositórios até três níveis e lê as worktrees registradas em cada um. Para investigar diretórios do Codex fora da coleção de projetos, repita com a raiz de worktrees configurada no aplicativo. A opção `--base REF` seleciona uma referência de comparação conhecida. Reporte a base local e o commit examinado. Separe integração por ancestralidade, commits exclusivos, ausência de upstream e squash ou rebase inconclusivo. Quando o estado de um PR for relevante e houver acesso de leitura já autorizado, confira repositório, base e ponta exata pelo provedor. Se faltar acesso, mantenha essa limitação no relatório.

Dê prioridade a modificações locais, arquivos novos ou ignorados, submódulos, operações em curso, worktrees travadas e HEAD destacado. Uma referência com último commit há 14 dias entra para triagem. Identifique o dono, a atividade da sessão, o plano de recuperação e a natureza de arquivos exclusivos antes de sugerir qualquer descarte. Se o aplicativo tiver mecanismos próprios de preservação e restauração, indique onde conferir o chat. Para execuções e temporários, identifique pasta, executor e evidência de conclusão. Sem essa evidência, marque o estado desconhecido.

Entregue quantidades, exemplos com nome de projeto e branch, evidência local, dúvidas que alteram a recomendação e o próximo passo de leitura. Use “preservar”, “revisar” ou “integração confirmada na base local”.

Abra o relatório com o potencial condicional em bytes e em unidade legível, a capacidade do volume e a proporção `100 × potencialBytes / capacidadeBytes`. Use casas decimais suficientes para distinguir ganhos pequenos de zero. Mostre os itens que mais contribuem e as verificações pendentes. Informe à parte o volume a preservar, hard links excluídos, a métrica usada e quaisquer limites da varredura. Se houver vários volumes, apresente o percentual de cada um. Para totalizar ambientes e resíduos em várias raízes, use o mesmo coletor em modo `espaco --root "<raiz>" --root "<outra raiz>"`; ele desconta sobreposições. O ganho efetivo só pode ser medido após uma limpeza.

Para uma dúvida concreta de projeto, repita o diagnóstico na raiz desse projeto com `--memoria "termo"` e, se pertinente, `--branch "nome"`. O coletor usa `munin contexto` em leitura e filtra registros do projeto ou branch. Cite ID e data de uma nota relevante e confronte com evidência atual. Se faltar Munin, escopo ou resultado, siga com os dados locais. Evidência insuficiente mantém o item em revisão.

A skill opera em leitura. Mantenha a saída na conversa. Preserve diretórios, configuração, refs, acervo e remotos.
