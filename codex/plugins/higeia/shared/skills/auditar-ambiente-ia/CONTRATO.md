---
name: auditar-ambiente-ia
description: "Audit AI skill origins, scopes and overlaps. Use when o usuário pedir para auditar o Claude ou Codex, entender de onde vêm suas skills, conferir plugins e versões, investigar skills duplicadas ou saber por que o hook Stop não limpou um rascunho."
---

# Auditar ambiente de IA

## Entrada e execução

Requer Node.js 22+. Use a raiz informada pelo usuário ou o diretório atual. O script entrega JSON na saída padrão. Execute no workspace do usuário, passando o caminho real da raiz escolhida.

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/diagnostico.mjs" ambiente --hooks-codex --root "<diretório>"
```

## Hooks do Higeia no Codex

Com `--hooks-codex`, a auditoria pede a lista de hooks ao Codex CLI instalado para a pasta examinada. Leia `hooksCodex` e relate cada `SessionStart` e `Stop` com sua origem, habilitação e confiança. Para um rascunho que sobrou, comece pelo `Stop`. Se estiver desabilitado, indique a habilitação em `/hooks`. Para `untrusted` ou `modified`, peça que o usuário revise a origem ou alteração em `/hooks` e decida se confia. Para `managed`, identifique a política administrada. Um evento ausente de uma consulta completa aparece como “não listado”. Nesse caso confira o plugin e o projeto consultados. Se ambos estiverem ausentes, confira também a flag global `hooks` com `codex features list` no mesmo projeto.

A consulta observa a configuração do CLI para aquela pasta. Para verificar a execução no cliente em uso, use o resultado de um teste na mesma sessão ou o registro do evento. Em caso de aviso, erro, cliente ausente ou versão incompatível, informe o limite e continue o inventário. Para um inventário restrito à leitura direta dos arquivos, omita `--hooks-codex`. A opção abre um processo local do Codex que pode manter seus próprios logs e caches.

## Investigação e saída

Agrupe por runtime, origem e projeto. Compare o arquivo real, o conteúdo e a descrição das skills sobrepostas. Para nomes diferentes, procure gatilhos iguais entre as descrições relevantes ao pedido e identifique exemplos como hipóteses. Quando houver uma skill própria, mostre qual comportamento seria útil incorporar na fonte do usuário e como testar o gatilho. Diferencie configuração declarada, versões em cache, anúncio na sessão e invocações observadas. Se o cliente fornecer a lista de skills da sessão ou o relatório nativo de uso do Claude, informe a fonte e o período. Ausência de medição recebe “uso desconhecido”.

Para esclarecer por que uma skill esperada falta no Codex, consulte a origem com `codex plugin marketplace list --json` e o inventário com `codex plugin list --marketplace "<nome>" --available --json` quando as consultas estiverem disponíveis dentro do escopo autorizado. Compare os grupos instalados e disponíveis, versão e habilitação com o catálogo da sessão. Uma origem que aponta para outro checkout pode oferecer uma versão diferente. No Claude, use `claude plugin list --json` e a lista da sessão para a mesma pergunta. Mostre somente os campos pertinentes do diagnóstico.

Entregue um mapa curto das pastas, as sobreposições mais relevantes, os caminhos de origem e o ponto de configuração que o usuário poderia revisar. Declare quais perfis, projetos e fontes de uso foram observados.

Abra o relatório com o potencial condicional em bytes e em unidade legível, a capacidade do volume e a proporção `100 × potencialBytes / capacidadeBytes`. Use casas decimais suficientes para distinguir ganhos pequenos de zero. Mostre os itens que mais contribuem e as verificações pendentes. Informe à parte o volume a preservar, hard links excluídos, a métrica usada e quaisquer limites da varredura. Se houver vários volumes, apresente o percentual de cada um. Para totalizar ambientes e resíduos em várias raízes, use o mesmo coletor em modo `espaco --root "<raiz>" --root "<outra raiz>"`; ele desconta sobreposições. O ganho efetivo só pode ser medido após uma limpeza.

Para uma dúvida concreta de projeto, repita o diagnóstico na raiz desse projeto com `--memoria "termo"` e, se pertinente, `--branch "nome"`. O coletor usa `munin contexto` em leitura e filtra registros do projeto ou branch. Cite ID e data de uma nota relevante e confronte com evidência atual. Se faltar Munin, escopo ou resultado, siga com os dados locais. Evidência insuficiente mantém o item em revisão.

A skill opera em leitura. Mantenha a saída na conversa. Preserve diretórios, configuração, refs, acervo e remotos.
