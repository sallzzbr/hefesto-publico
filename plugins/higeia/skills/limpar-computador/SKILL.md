---
name: limpar-computador
description: "Preview disk cleanup on macOS and clean rebuildable Chrome, Claude Desktop and Slack caches. Use when o usuário pedir limpar o computador, medir Downloads ou Lixeira, guardar ou restaurar instaladores em quarentena, limpar caches dos apps e conferir o ganho depois de reabri-los."
---

# limpar-computador

## Diagnóstico no macOS

Requer Node.js 22 ou posterior. Execute o coletor na conta do usuário em modo de leitura.

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/diagnostico.mjs" computador
```

O coletor mede blocos alocados em diretórios conhecidos de cache de navegadores e aplicativos. Em Downloads, separa instaladores, compactados e demais entradas visíveis do primeiro nível, incluindo o conteúdo de pastas. Transferências incompletas reconhecidas pelo nome no primeiro nível ficam fora do potencial. A Lixeira da conta exige decisão. Em Mesa, Documentos e Filmes, considera arquivos diretos de pelo menos 500 MB. Relatórios de falha com pelo menos 30 dias também entram para revisão. Para caches de compiladores e simuladores, use `limpar-desenvolvimento`.

## Resultado

Use `espaco.porVolume` para mostrar o potencial dos caches recriáveis, o subtotal que depende de escolha pessoal e a soma por volume. Mostre cada categoria em GB decimais e como percentual da capacidade total do volume. Arredonde só ao apresentar. Para categorias com dados pessoais, explique a decisão necessária sem expor nomes de arquivos por padrão.

Informe os limites em `espaco.limites` e `espaco.limitesInventario`. Uma pasta inacessível fica com valor desconhecido. Exclua itens a preservar da soma. Caches podem voltar a crescer, e blocos compartilhados pelo APFS podem reduzir o ganho efetivo. Trate a soma como prévia. Para um pedido de diagnóstico ou somente leitura, encerre com esse relatório.

## Limpar caches de apps selecionados

No macOS com Python 3, em conta de usuário, use os identificadores `chrome`, `claude` e `slack` para Google Chrome, Claude Desktop e Slack instalados em Aplicativos. Passe apenas os apps pedidos. A lista abaixo exemplifica os três.

```sh
python3 -I -B "${CLAUDE_PLUGIN_ROOT}/scripts/caches-apps.py" prever chrome claude slack
```

Mostre uma linha para cada app de `porApp`, com estado, GB decimais e percentual da capacidade do volume. Acesso negado resulta em “não medido” com o código do erro. Um app sem pastas de cache reconhecidas conta como medido com zero bytes. Use `rotulo`, `potencialGB` e `percentual` para apresentar TOTAL ou SUBTOTAL MEDIDO. Se nenhum app foi medido, informe que o potencial é desconhecido. O comando já consulta todos os apps selecionados em uma chamada.

Quando houver EPERM ou EACCES, entregue primeiro o subtotal e acrescente uma orientação breve da seção “Acesso negado no Mac”, adequada ao aplicativo em que a sessão está aberta. O usuário pode ficar com o subtotal sem tomar nenhuma ação. Para limpar um subconjunto autorizado, gere uma prévia com esses apps. O identificador de plano só existe para uma seleção medida por inteiro.

O plano identifica as pastas existentes na conta atual. O conteúdo de um cache ativo pode variar. O executor se limita a cache HTTP, código JavaScript e WebAssembly e GPU. Para Chrome, o escopo é o perfil Default. Contas, cookies, armazenamento offline, conversas e Downloads ficam fora do lote.

A prévia é só leitura. Quando houver autorização explícita para a limpeza desses apps, use o identificador retornado pela prévia e a mesma seleção. O executor pede o encerramento normal e abre os aplicativos selecionados, inclusive se estavam fechados e tinham cache.

```sh
python3 -I -B "${CLAUDE_PLUGIN_ROOT}/scripts/caches-apps.py" aplicar <plano> chrome claude slack
```

O executor isola as pastas após o encerramento e aguarda o app reabrir com um processo de renderização antes de expurgar os caches isolados. Mostre por aplicativo os bytes alocados antes da limpeza e depois da reabertura. Informe o ganho líquido em GB decimais e percentual do disco e, separadamente, a variação do espaço livre de todo o volume. Outros processos podem alterar essa última medida. A verificação cobre inicialização e renderização. Identifique apps sem cache, falhas e subtotais parciais na saída.

Em caso de interrupção, preserve qualquer reserva `.higeia-*.em-revisao`. Confira o caminho informado, o estado do app e a existência de um cache novo antes de propor recuperação. Uma reserva existente bloqueia outra aplicação nesse escopo.

## Acesso negado no Mac

Identifique o app que hospeda a sessão. Uma sessão iniciada no Terminal usa o Terminal; uma sessão aberta dentro do Claude Desktop ou do Codex usa o respectivo app. Se o contexto for desconhecido, descreva as opções em uma frase. A permissão de leitura é do app responsável pelo acesso. O nome do cache bloqueado identifica o que o Higeia tentou medir.

- Para conferir a permissão no macOS, indique **menu Apple → Ajustes do Sistema → Privacidade e Segurança → Arquivos e Pastas**. Abra os detalhes do app que executa a sessão. Se houver uma opção referente à leitura bloqueada, o usuário pode ativá-la. O macOS define quais categorias aparecem nessa tela; a pasta de cache pode não ter um controle próprio.
- Se o usuário quiser investigar, ofereça o comando de prévia somente do app bloqueado, usando o caminho real do executor instalado. Se a mesma prévia funcionar no Terminal e falhar dentro do Claude Code, indique a consulta a `/sandbox` no Claude Code antes de sugerir mudanças no macOS. Essa diferença orienta a investigação. O código de erro sozinho não identifica a causa.
- Se o usuário decidir conceder acesso amplo ao app, o caminho é **Privacidade e Segurança → Acesso Total ao Disco**. Oriente a selecionar o app que hospeda a sessão (ou adicioná-lo pelo botão **+**) e ativar a opção. Se o macOS oferecer a escolha de pastas específicas, prefira limitar o acesso às pastas necessárias. Explique que o acesso total amplia as permissões do app inteiro. Após uma alteração, oriente a encerrar e reabrir esse app e repetir somente a prévia bloqueada. Em Mac gerenciado, uma opção travada pode depender do administrador.

O Higeia apenas orienta. Preserve o subtotal quando o usuário preferir manter os ajustes atuais.

## Quarentena de instaladores

Quando o usuário quiser revisar Downloads, use os itens individuais do diagnóstico para escolher um arquivo regular .dmg, .pkg ou .mpkg no primeiro nível. Execute o script com Python 3 no macOS. Passe o nome exato como um argumento, preservando espaços.

```sh
python3 -I -B "${CLAUDE_PLUGIN_ROOT}/scripts/instaladores.py" prever -- "<nome>"
python3 -I -B "${CLAUDE_PLUGIN_ROOT}/scripts/instaladores.py" guardar -- "<nome>" "<plano>"
python3 -I -B "${CLAUDE_PLUGIN_ROOT}/scripts/instaladores.py" listar
python3 -I -B "${CLAUDE_PLUGIN_ROOT}/scripts/instaladores.py" restaurar -- "<nome>"
```

Apresente nome e tamanho antes da escolha. Guarde somente o instalador autorizado, usando o plano da prévia. A reserva privada fica em Downloads/.higeia-instaladores. A movimentação libera zero bytes. Use listar para retomar em outra sessão e restaurar a pedido do usuário. Quando houver ocupação na categoria Quarentena de instaladores, mostre preservarBytes como espaço ainda ocupado no volume. Se o destino estiver ocupado, ofereça restaurar sob um nome escolhido com a mesma extensão usando `restaurar --como "<novo nome>" -- "<nome original>"`. Se o executor detectar troca durante a movimentação, informe a localização indicada e confirme o conteúdo com o usuário antes de qualquer nova movimentação.
