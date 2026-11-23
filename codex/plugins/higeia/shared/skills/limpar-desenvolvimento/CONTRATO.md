---
name: limpar-desenvolvimento
description: "Measure development caches and older simulator runtimes on macOS. Use when o usuário pedir para medir caches de desenvolvimento, simuladores antigos, espaço liberável em GB ou percentual do disco por categoria."
---

# Diagnosticar caches de desenvolvimento e simuladores

No macOS, mostre quanto espaço cada ferramenta pode devolver e quanto depende de aposentar simuladores. Execute com Node.js 22+ no workspace atual:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/diagnostico.mjs" desenvolvimento
```

Para incluir skills, worktrees e resíduos de IA no mesmo total, execute o coletor em modo `espaco --desenvolvimento` com `--root "<diretório>"` para cada raiz de projetos ou worktrees do pedido. Use a saída JSON dessa execução para descontar sobreposições. O diagnóstico usa as pastas padrão locais e o registro de imagens do CoreSimulator. Ele lê os plists com o plutil do macOS e dispensa iniciar o simulador.

## Saída

Agrupe por ferramenta em cada volume. Mostre `potencialGB` e `percentualDaCapacidade` dos caches ou candidatos condicionais. Adicione uma coluna com `revisarGB` e `percentualEmRevisao` para os dispositivos ou versões que ainda requerem decisão. Identifique a versão substituta, os dispositivos associados e se o tamanho vem da imagem, dos dados locais ou do cache do sistema. Mostre os subtotais, a soma dos dois cenários e a capacidade usada no denominador. Use GB decimais e arredonde só para exibição.

## Como orientar a decisão

- Explique o que pode ser reconstruído. Uma imagem de iOS fornece o sistema a vários iPhones e iPads virtuais. Cada dispositivo tem identificador e dados próprios. Recriar o mesmo modelo com uma imagem compatível produz um dispositivo novo. Apps podem ser reinstalados, e o estado anterior exige recuperação própria.
- Por versão, informe modelos, quantidade com inicialização registrada e apps observados. Para dispositivos desligados sem inicialização, apps ou contêineres de dados observados, mostre o espaço real do grupo e confira referências ao identificador antes de sugerir recriação. A ausência desses sinais ainda permite existir mídia ou configuração local. Aparelho com sinais de uso, estado ativo ou leitura inconclusiva fica preservado até esclarecer o valor dos dados.
- Para avaliar uma imagem anterior, explique quais aparelhos e testes dependem dela. Procure o modelo, versão ou identificador nos scripts dos projetos pertinentes quando conhecidos. A configuração permite indicar um consumidor provável. A data isolada não comprova abandono. O tamanho da imagem, o cache do sistema e os dados de cada aparelho são parcelas distintas.
- O uv instala programas Python e mantém um cache compartilhado de pacotes e de ambientes que podem conter muitos pacotes. Se a dúvida for sobre um programa específico, confira o executável, seu recibo de instalação e onde ele grava os dados do usuário. A lista de ferramentas instaladas ajuda a localizar consumidores. Para atribuir bytes, identifique o pacote ou o executável dentro do ambiente medido e informe se ele aparece em mais de um. Mantenha em revisão a parcela cuja liberação a ferramenta ainda precisa apurar. Comandos de manutenção podem efetivamente apagar dados.
- Quando a pergunta for sobre os GB dos ambientes do uv, rode o coletor no modo `uv --executavel "<comando>" --root "<projeto>"`. Use uma raiz por projeto consumidor, repetindo a opção. Omita o filtro de executável para medir todos os ambientes arquivados. O resultado detalha a parcela do arquivo de pacotes já inventariada pelo modo desenvolvimento. Somá-la novamente duplica a contagem. Separe ambientes com arquivos abertos, dependentes conhecidos, evidência incompleta e candidatos recriáveis. Compare as assinaturas de Python e dos nomes e versões de pacotes. Uma composição igual não demonstra igualdade dos arquivos nem ausência de dados locais. Confira a configuração de quem chama a ferramenta, o caminho do banco persistente e as condições para reinstalar. O prune do uv alcança também outros ambientes em cache. Explique esse alcance antes de propor manutenção.
- Para decidir sobre um ambiente de ferramenta conhecido, confira o comando e as versões exigidas pelo consumidor. Quando possível, ensaie a recriação fora do cache real, com a execução restrita a uma área descartável, sem reutilizar o ambiente antigo ou acessar o banco pessoal. Confira primeiro a inicialização e depois uma operação representativa sobre dados descartáveis. Se a receita atual falhar, preserve as combinações funcionais até que o consumidor use uma receita testada. Um ensaio do prune em uma cópia dos índices mostra quais entradas seriam atingidas. Só o teste funcional mostra se o consumidor voltaria a operar.
- Quando o pedido for reduzir a quantidade de simuladores, consulte o comando de teste do projeto. Identifique se cria um aparelho, abre um existente ou exige um já ligado, e se uma tarefa especializada exige um modelo ou versão. Proponha o conjunto mínimo para o trabalho habitual e os modelos a recriar sob demanda. Para um cenário de retirada, some os aparelhos dispensáveis. Inclua a imagem e o cache associado apenas se toda a versão puder sair. Apresente esse cenário à parte da estimativa padrão até o dono dispensar o estado local.
- Indique as lacunas da leitura. Blocos compartilhados pelo APFS podem reduzir o ganho real.

## Verificações executáveis no macOS

Para o Claude-Mem local com Chroma, use Python 3 e o Node do diagnóstico. Com a saída do inventário uv já obtida no workspace do diagnóstico, rode:

```sh
python3 -B "${CLAUDE_PLUGIN_ROOT}/scripts/verificar-claude-mem.py"
python3 -B "${CLAUDE_PLUGIN_ROOT}/scripts/provar-ambientes-uv.py" < inventario-uv.json
node "${CLAUDE_PLUGIN_ROOT}/scripts/plano-ios.mjs" "<modelo a manter>" "<versão do iOS>"
```

A primeira prova confere uma observação existente pelo ID, recupera a observação por busca e exige que uma consulta sem correspondência textual encontre memórias. A opção `--dados` aponta para a pasta do Claude-Mem quando o usuário usa um local personalizado. A saída omite os textos. Código de saída diferente de zero deixa a retirada dos ambientes pendente.

A segunda prova isola a inicialização de cada chroma-mcp com o sandbox do macOS. A regra reconhece a combinação chroma-mcp 0.2.6, mcp 1.6.0 e Pydantic 2.14.x com erro de importação de eval_type_backport. Um candidato precisa ter apenas referências de cache nas fontes examinadas e arquivos explicados pelos recibos ou pela estrutura do ambiente. Preserve as combinações que funcionam, os erros diferentes e os itens inconclusivos.

Para essa falha específica no Claude-Mem 13.6.0, ensaie a receita do consumidor acrescentando `--with pydantic==2.13.5` ao uvx que inicia `chroma-mcp==0.2.6`. Com o ensaio aprovado, use a opção de processo `CLAUDE_MEM_CHROMA_UVX_PATH` apontando para um lançador privado chamado `uvx`: ele delega ao executável real do uv com `tool run`, acrescentando a restrição somente para esse pacote e versão. Configure a variável no ambiente do host que inicia o worker. Espere uma fila vazia, pare e inicie o worker com esse ambiente, confira o novo processo e rode a prova de consulta. Para outra versão, investigue a receita atual. Preserve a configuração do uv dos demais consumidores.

O plano de iOS exige um aparelho disponível e identificável pelo modelo e versão. A saída traz seu UDID, os demais aparelhos iOS desligados e as imagens de iOS fora da versão pedida. Um estado ativo ou uma identidade ambígua suspende o plano. Com autorização explícita para executar, releia o plano e compare os IDs. Use o simctl do Xcode para remover somente os IDs aprovados. Confira de novo o aparelho, os apps e o registro de imagens quando a remoção terminar.

Em uma limpeza de ambientes já autorizada, teste o consumidor corrigido com o acervo real, obtenha a trava exclusiva do uv e confira novamente identidades, índices, referências e arquivos em uso. Isole os candidatos e seus links em um cache temporário no mesmo volume. Teste a consulta com os ambientes isolados antes de expurgar esse cache com o uv. Conserve o mapa de origem e destino para reverter a etapa caso o teste falhe. Meça o espaço disponível no mesmo volume antes e depois de cada categoria, aguardando a remoção assíncrona. Informe o ganho líquido, seu percentual da capacidade e as exceções que precisam de decisão.

O resultado vai para a conversa. Esta skill só mede. Em outra plataforma, informe que a medição de desenvolvimento desta versão cobre macOS.
