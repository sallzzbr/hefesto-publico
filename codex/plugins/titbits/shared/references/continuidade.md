# Relações e continuidade consultiva

Leia [contrato.md](contrato.md) para resolver local_jogo. Paths abaixo são relativos à base resolvida, não hardcode. Markdown é a fonte humana; o índice é derivado. Hooks nunca aprovam design, alteram GDD, executam tarefas, chamam agentes, leem transcritos, acessam rede/Munin/acervos ou bloqueiam ações. Aprovação das mudanças segue [historico.md](historico.md).

## Relações explícitas
Cada ID estável tem uma única declaração nos documentos vigentes de gdd/ ou producao/. Use um bloco cercado por três crases na primeira coluna, linguagem `titbits-relacoes` sem outro texto na linha, com uma lista JSON. Declaração ativa com cerca indentada, com til ou com texto extra é recusada em vez de ignorada. Cercas dentro de outro bloco de código, inclusive em listas, são exemplos literais: não declaram IDs nem são validadas como relações. Use um delimitador externo mais longo ou de outro tipo ao mostrar exemplos. Exemplo sintético:

```titbits-relacoes
[
  {"id":"MEC-001","relacoes":[]},
  {"id":"FAS-001","relacoes":[{"alvo":"MEC-001","tipo":"depende_de"}]}
]
```

`id` usa os prefixos existentes MEC/ART/AUD/NAR/UX/TEC/FAS/DEC/EXP/APR e pelo menos três dígitos. Não introduzir ID concorrente para um requisito já existente. `relacoes` aceita alvo e tipo: depende_de, implementa, verifica ou representa. Todos os tipos significam que uma alteração no alvo pode afetar o declarante. Relações não aprovam os requisitos associados. IDs de SPEC/tarefa/evidência usam TEC com descrição do artefato na seção humana correspondente. Relação inferida pela análise deve ser proposta e conferida antes de virar declaração. Recursos independentes têm lista vazia, não dependências inventadas.

Criar gdd/sistemas.md com intenção, entradas, saídas e limites dos sistemas. Vincular requisitos às fases, fluxos, inventário de assets, SPECs, tarefas e evidências. Documento fora da base do jogo recebe ficha textual em producao/ com origem e revisão consumida; automação não inspeciona destinos externos. Arquivos binários são representados pelo inventário textual (versão/hash obtido na produção, origem/licença, responsável, estado e evidência de integração). Alteração binária sem atualização da ficha não é detectada automaticamente.

## Índice e baseline
`gdd/relacoes.json` formato 1 contém `gdd_versao`, `arquivos` (path relativo → SHA-256 do conteúdo Markdown) e `nos` (id, path, relacoes). Um nó pode ter várias relações; ciclos terminam por conjunto de visitados. O índice cobre Markdown não oculto em gdd/ e producao/, exceto producao/estado.md, até 2000 entradas lidas, 256 KiB por arquivo e 4 MiB total. O próprio índice também precisa caber em 256 KiB, o que limita na prática a cerca de 800 documentos com um nó cada. Histórico, aprendizados, modelos, referências e resumo de estado ficam fora da baseline de impacto: finalizar DEC e atualizar retomada não invalidam uma reconciliação. Continuam sujeitos à leitura/revisão humana. Candidato maior que o limite de leitura é recusado, sem baseline aproveitável. Sem nós conhecidos não existe baseline validada. Symlinks e arquivos especiais não são lidos. Índice alterado não é prova de integridade criptográfica: revisá-lo junto às fontes.

O cache não contém baseline nem decisões. Apagar cache não apaga alterações pendentes. Arquivos novos/removidos, mudanças não mapeadas, referências desconhecidas e divergências exigem revisão; nunca inferir “não afetado” só porque falta relação. `sem_alteracoes` significa apenas igualdade com a cobertura declarada, não completude de design nem qualidade do jogo. A propagação reúne relações antigas e atuais e identifica IDs potencialmente afetados; revisão humana confirma impacto sem invalidar domínios independentes. Mais de um requisito por arquivo compartilha o sinal de mudança do arquivo: conferir quais seções efetivamente mudaram.

## Operações explícitas
Node.js 22+ é opcional para os documentos e necessário para scripts/hooks. Não instalar automaticamente. Executar a CLI em scripts/continuidade.mjs da raiz do plugin (no Codex, shared/scripts/continuidade.mjs), com argumentos separados e paths devidamente citados:

```sh
node "<raiz-do-plugin>/scripts/continuidade.mjs" verificar --workspace "<workspace>" --jogo "<local_jogo-relativo>"
node "<raiz-do-plugin>/scripts/continuidade.mjs" reconciliar --workspace "<workspace>" --jogo "<local_jogo-relativo>"
```

`verificar` só lê; exit 0 sem alterações na cobertura declarada, 1 revisão necessária, 2 não avaliado. `reconciliar` só imprime candidato JSON (exit 0), não escreve arquivos nem concede aprovação. Com baseline existente, IDs afetados cujos documentos não foram alterados impedem o candidato: exit 1 lista `pendentes`. Revisar esses documentos (por exemplo, marcar a evidência como `revisao_necessaria`) ou confirmar explicitamente com `--confirmar ID,ID`, registrando a justificativa no DEC; ID não afetado, prefixo inválido ou confirmação sem baseline existente é recusado com exit 2; IDs repetidos são idempotentes. A mudança do hash de um documento não comprova revisão semântica: o DEC e a conferência humana continuam necessários. Baseline existente ilegível ou inconsistente não é substituída: exit 2, preservar e resolver antes. Não redirecionar stdout diretamente para a baseline: exit 1 e 2 contêm diagnóstico. Capturar, conferir exit, comparar candidato e então salvar pelo protocolo de atualização autorizado. Sem CLI, revisar relações manualmente e registrar automação não avaliada.

Em atualização aprovada: preservar baseline anterior no DEC preparando; executar verificar antes de editar; aplicar antes/depois e rever fontes; marcar tarefas/evidências afetadas; conferir relações/links; atualizar versão central; gerar e inspecionar candidato; salvar índice; finalizar DEC. Se interromper, conferir versão, DEC, documentos e índice antes de concluir. Reconciliação não torna evidência antiga válida nem encerra tarefa sem validação. Novo projeto/migração 0.1 usa operação explícita, sem reset de decisões/IDs.

## Ativação e limites dos hooks
Após pedido explícito de ativação, preparar-jogo resolve local_jogo pelo contrato comum e grava `.titbits/config.json` na raiz do workspace:

```json
{"formato":1,"enabled":true,"local_jogo":"docs/jogo"}
```

O exemplo de path é ilustrativo. A configuração sela o path já resolvido; hooks não consultam defaults pessoais nem descobrem outros jogos. O path deve ficar dentro do workspace, sem symlinks. Se mudar a configuração de paths, reconciliar explicitamente essa configuração também. Múltiplos jogos exigem escolha de um jogo para os hooks desse workspace. Base externa pode continuar documentalmente, mas não é elegível para estes hooks.

Adicionar somente `.titbits/cache/` ao .gitignore do workspace. Sem configuração, enabled diferente de true ou configuração inválida, não atuar. Desativar por enabled:false; preservar documentação. Não alterar permissões dos runtimes nem hooks de outros plugins. A descoberta ascendente para no primeiro .titbits ou limite .git, inclusive worktree; não herdar opt-in através de um repositório aninhado.

Somente SessionStart e UserPromptSubmit são registrados. SessionStart recupera estado e trechos dos índices locais mesmo quando a conferência falha; UserPromptSubmit compara fontes/baseline e avisa mudanças mesmo feitas externamente. Alertas são deduplicados enquanto estado/documentos se repetem na mesma sessão. Uma comparação sem alterações registra a transição limpa: se a mesma mudança reaparecer depois, ela volta a gerar alerta. Cache é isolado por path real e sessão, com gravação por arquivo temporário e rename relativos ao diretório fixado. A identidade da raiz do workspace é capturada antes da configuração e reutilizada em fontes, baseline e cache; uma raiz diferente é recusada mesmo quando a troca ocorre acima dela. Leitura/gravação ocorrem em processo síncrono dedicado: cada diretório é acessado e sua identidade conferida antes de operar com nomes relativos; arquivos abertos são conferidos por identidade antes da leitura. Trocar um ancestral por symlink não redireciona a operação para outro diretório. Concorrência na mesma sessão pode duplicar um aviso; nenhum dado canônico é escrito.

Supervisor limita entrada a 64 KiB e worker a 1,5 s, dentro de orçamento aproximado de 2 s; um prazo cooperativo de cerca de 1 s é compartilhado pela retomada e conferência, incluindo releitura da versão, baseline e propagação. O prazo é conferido antes/depois das leituras e durante a análise; ao exceder, a conferência responde não avaliado e mantém a retomada que já foi lida. Uma operação síncrona individual travada não pode ser interrompida por esse prazo: o supervisor pode encerrar o worker e deixar stdout vazio. Contexto até 4000 caracteres; truncamento é explícito. Falha/timeout não produz aprovação ou bloqueio. Falha de cache/configuração silencia o hook; falha de leitura do jogo gera “não avaliado” quando possível. Falta de alerta não comprova sucesso. Nunca depender do hook para um gate de aceitação: chamar verificar explicitamente e realizar revisão do design.

Compatibilidade exige teste de eventos reais nas versões de Claude e Codex usadas. Fixture de JSON e instalação não substituem esse aceite. Não usar PostToolUse, Stop, PreToolUse ou PermissionRequest; nenhum hook bloqueia ou reabre o loop.
