---
name: revisar-residuos-ia
description: "Review local Git worktrees and workflow leftovers. Use when o usuário pedir para arquivar worktrees abandonadas, conferir push antes de remover, revisar worktrees antigas, localizar temporários ou entender o que sobrou de sessões de IA."
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

O diagnóstico termina aqui. Mantenha a saída na conversa.

## Conferir uma execução de workflow

O inventário reconhece registros nas pastas de artefatos do projeto. Para examinar uma execução em outro local, acrescente `--execucao "<caminho>"` ao comando de resíduos. Um caminho relativo parte da raiz examinada. No Claude, indique o arquivo `wf_*.json` da execução. Os registros locais também podem estar em `projects/<projeto>/<sessão>/workflows/` no perfil do Claude. O registro informa o estado e o desfecho mesmo quando a origem está em conferência.

Para verificar os arquivos, o coletor usa a pasta declarada no registro ou o evento da transcrição com os mesmos IDs de sessão, execução e tarefa. Se a origem estiver fora do escopo, rode a consulta com `--root` em uma pasta que a inclua. Origem desconhecida, divergente ou com link no caminho exige confirmar a pasta física na sessão original. Um caminho relatado só identifica um arquivo local quando há `caminhoVerificado`. Se a pasta registrada foi removida, recupere-a antes de reinvocar e confira os efeitos anteriores na mesma sessão.

No Codex, indique o diretório do run ou seu `state.json`. Para uma execução identificada do Hefesto, repita a consulta com `--execucao "<diretório do run>" --pacote-codex "<instalação do plugin de origem>"`. Localize a instalação de Odin, Mimyr ou Hermes pelas informações do cliente. Use somente o pacote de confiança que executou o workflow. O coletor chama o comando de leitura `proximo` do controlador instalado. Esse comando reproduz as respostas salvas em memória e mostra as próximas solicitações. Se a versão divergir, mantenha o estado desconhecido.

Informe o executor, o ID, o registro consultado e o estado observado. Em execução concluída, mostre o desfecho do controlador, inclusive bloqueio ou erro. Atribua os caminhos de `entregas`, `paraRevisao` e `intermediarios` ao relato do executor. No Hermes, um render escalado e seu pacote aguardam decisão humana. Mesmo um resultado verde precisa de aprovação humana antes da publicação. No Codex, `arquivosTocados` identifica trabalho já registrado nas respostas. O coletor confere se o arquivo existe na raiz informada. Caminhos externos, links e caminhos ambíguos exigem conferência à parte. A presença de um arquivo ainda deixa o conteúdo e a aprovação para revisão. Conserve as definições do projeto, o checkpoint, os intermediários e os itens sem origem comprovada.

Apresente `proximaAcao` quando o diagnóstico orientar uma nova validação. Se o pré-voo do Hermes ou os checks do Mimyr já devolveram uma resposta, a mesma chamada pode repetir o resultado salvo depois da correção do ambiente. Preserve o render ou os capítulos e valide os arquivos existentes. Fazer o workflow inteiro de novo exige conferir os efeitos, o escopo e os custos. Quando houver `retomar`, apresente a orientação com suas condições e o ID indicado. No Claude, confira atividade, pausa e falha da chamada no painel da sessão original. [Como o Claude decide quais agentes executar de novo](https://code.claude.com/docs/en/workflows#which-agents-run-again)

No Claude, um erro que o controlador tolerou pode ser o ponto de início do replay. A partir dele, até as chamadas já concluídas podem repetir trabalho e custos. Para um run encerrado em erro, indique `resumeFromRunId` apenas quando o controlador pedir, relatar falta de resposta e o histórico completo mostrar que só a chamada final falhou na fase correspondente. Identifique essa chamada pelo índice e pelo nome. Histórico incompleto ou inconclusivo pede conferência em `/workflows`.

No Codex, `aguardando` indica pedidos pendentes. A atividade da sessão fica desconhecida. Confira quem está atendendo ao pedido antes de sugerir qualquer continuação. Uma trava sem escritor confirmado ou um `state.tmp` exige conferir a recuperação no runtime do executor.

## Arquivamento solicitado

Para preparar um arquivamento, trabalhe fora da worktree alvo. Identifique repositório, caminho físico, branch de destino do merge e remoto do projeto. Confira o dono e o estado da sessão no executor. Um chat encerrado ou a confirmação explícita de quem usa a worktree pode estabelecer inatividade. Idade e ausência de resposta do Munin, sozinhas, deixam a sessão em revisão. Worktrees administradas por aplicativos devem seguir o fluxo do aplicativo.

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/arquivar-worktree.mjs" prever --repo "<projeto>" --worktree "<worktree>" --remoto "<remoto>" --base "<branch-base>"
```

A prévia consulta a ponta atual da base no servidor. Se o commit da base faltar localmente, informe a necessidade de fetch e repita a prévia após a atualização. Para squash ou rebase de um PR conhecido do mesmo repositório no GitHub, acrescente `--pr <número>` com o CLI gh autenticado. A prova exige a ponta exata enviada ao PR e o commit integrado alcançável na base atual. Sem prova de merge, trate o trabalho como exclusivo. Com menos de 14 dias desde o sinal Git mais recente (commit, HEAD, índice ou reflog), preserve.

Para aplicar, use os mesmos argumentos com `aplicar --plano <id> --inativa`. Faça isso somente com inatividade confirmada e autorização para a ação e o destino apresentados. Uma política já autorizada que cubra o alvo e o destino dispensa repetir a pergunta. Um pedido de diagnóstico ou prévia termina na leitura. Em caso de arquivos modificados, novos ou ignorados, informe a pendência. Se houver autorização para salvar arquivos específicos, revise-os com o usuário, faça o commit desses arquivos e produza outra prévia. Preserve arquivos incertos e segredos locais.

Em uma branch exclusiva, o executor faz um push normal quando necessário e lê novamente a referência no destino de envio. Só remove o checkout quando o commit confere. Se houver erro após o push, reporte o estado e gere outra prévia para retomar. Informe o caminho retirado, base, branch e commit de recuperação. A branch local permite restaurar com `git worktree add <nova-pasta> <branch>`.
