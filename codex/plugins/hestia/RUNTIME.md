# Runtime Codex do Hefesto

Leia este arquivo antes do contrato de domínio. Ele governa a execução das skills deste pacote no Codex. Os recursos em `shared/` são cópias verificadas da distribuição Claude; suas regras de domínio continuam valendo, mas as instruções nativas desta distribuição governam ferramentas, paths, modelos e despacho.

## Localização e recursos

- Resolva a raiz do pacote a partir do arquivo da skill carregada: dois diretórios acima de `skills/<nome>/SKILL.md`. Nos comandos, `PLUGIN_DIR` representa esse caminho real, entre aspas, e não uma variável fornecida pelo Codex. Descubra o caminho antes de executar.
- Resolva links relativos ao arquivo que os contém. `../../shared/` dentro de uma skill aponta para os recursos empacotados. Nunca presuma checkout deste repositório na máquina de quem instalou.
- Nas referências legadas, `${CLAUDE_PLUGIN_ROOT}` significa a raiz `shared/` deste pacote **somente para localizar recursos**. Todo `skills/<nome>/SKILL.md` legado foi copiado como `skills/<nome>/CONTRATO.md`; traduza esse sufixo ao ler referências. Não tente executar o contrato como outra skill.
- Nas referências legadas, `CLAUDE.md` significa `AGENTS.md` do workspace, e defaults pessoais se resolvem em `~/.codex/hefesto/<plugin>/defaults.md`. Não leia configurações Claude como defaults Codex.
- Paths de dados: pedido explícito do usuário > campos `local_*` em `## Paths do workspace` de `AGENTS.md` > defaults Codex > exatamente um candidato descoberto no workspace > default do domínio. Mais de um candidato exige esclarecimento. Dependência obrigatória ausente bloqueia, salvo scaffold solicitado.
- Personas, dados financeiros, cursos, relatórios, briefs e estado de execução pertencem ao workspace ou ao armazenamento escolhido pelo usuário. Não escreva no pacote instalado. Para analisar recursos Python sem produzir cache no pacote, use `python -B` ou `PYTHONDONTWRITEBYTECODE=1`.

## Ferramentas e autorização

Use ferramentas disponíveis nesta sessão para leitura, escrita, terminal, navegação e conectores. Chamadas legadas `Workflow`, `SlashCommand` e `AskUserQuestion` descrevem intenções, não ferramentas exigidas no Codex. Use a skill nativa pelo nome e suas instruções; faça perguntas com a ferramenta de interação disponível ou uma pergunta direta.

Use apenas subagentes realmente disponíveis e permitidos pelas instruções da sessão. Quando um contrato exigir revisão independente, faça-a em um contexto separado; se isso não estiver disponível, registre a revisão como pendente, sem simular independência. Execução solo só vale onde o contrato permitir e deve ser declarada. Não interprete uma lista de ferramentas legada como concessão de acesso.

Antes de um papel de agente, leia `shared/agents/<papel-sem-prefixo>.md` quando existir. Preserve as responsabilidades e restrições de domínio. Ignore bindings Claude do frontmatter e instruções de modelo, effort e fallback também no corpo; aplique [MODELOS.md](MODELOS.md) e as capacidades efetivas da sessão. Um revisor não altera o artefato que revisa.

Reaproveite autorização explícita já dada pelo usuário. Para mutação externa ainda não autorizada, prepare o resultado verificável e obtenha aprovação antes de executar. Hestia mantém journal, reconciliação e idempotência; Hermes mantém os portões de ideia e orçamento antes da produção paga. Falta de conector, credencial ou gerador é dependência ausente, nunca sucesso presumido. Não instale dependências, configure contas ou publique automaticamente.

## Modelos

Leia [MODELOS.md](MODELOS.md). Por padrão, herde modelo e esforço de raciocínio da sessão, sem transportar os defaults históricos dos controladores. Preferência explícita por papel é opcional; identidade efetiva só é registrada quando informada pelo executor. Perfis de domínio preservam rigor e lotes.

## Controladores de Odin, Mimyr e Hermes

Pré-requisito: Node.js 22 ou posterior. O adaptador `runtime/bridge.mjs` reutiliza os controladores de domínio e emite solicitações JSON para o Codex executar. Não chama modelo/API. O estado contém argumentos/respostas e fica num diretório novo escolhido no workspace; trate-o como dado do projeto.

1. Resolva inputs, permissões e pré-requisitos na skill nativa. Escreva `args.json` com os argumentos do controlador indicado pela skill e, somente se solicitado, `execucaoCodex` conforme MODELOS.md. O pacote seleciona seu próprio controlador.
2. Inicie com `node "<PLUGIN_DIR>/runtime/bridge.mjs" iniciar "<run-dir-novo>" "<args.json>"`. O diretório pai deve existir; o diretório do run deve ser novo.
3. Se `status` for `aguardando`, leia `solicitacoes`. Cada uma contém `id`, `label`, `papel`, `prompt`, `schema`, `modeloSolicitado`, `effort` e `fase`. Leia o papel e execute o prompt com ferramentas reais. Prompts podem mencionar paths legados: aplique a tradução acima antes de executar comandos. Preserve caminhos de workspace e argumentos específicos do usuário.
4. Grave a resposta em JSON: `{"resultado": <objeto conforme schema>, "modeloEfetivo": "<nome conhecido>"}`. Omita modelo desconhecido. Em falha operacional, use `{"erro": "causa observada"}`. Isso encerra o run sem fallback; preserve e reconcilie respostas e solicitações interrompidas conforme MODELOS.md. Não invente resultados, hashes, execução de testes ou aprovações. Os helpers de hashes/IDs devem ser realmente executados; anexe sua saída literal.
5. Entregue: `node "<PLUGIN_DIR>/runtime/bridge.mjs" responder "<run-dir>" "<id>" "<resposta.json>"`. O adaptador valida o envelope e schema antes de salvar; rejeita ID que não esteja pendente e pacote alterado durante o run.
6. Para retomar, use `node "<PLUGIN_DIR>/runtime/bridge.mjs" proximo "<run-dir>"`. Respostas salvas são reproduzidas; não execute de novo trabalho já respondido. Se houve efeito externo mas a resposta não foi salva, primeiro reconcilie o estado real antes de repetir a ação. O adaptador não oferece transação sobre ferramentas externas.
7. `status: concluido` significa que o controlador terminou. Confira `resultado.status` e os bloqueios: encerramento não significa aprovação. Registre o relatório e pendências. Não promova bloqueado/escalado/revisão pendente a validado.

Solicitações independentes podem ser executadas em paralelo quando autorizado; envie as respostas ao estado uma por vez. A trava impede duas gravações simultâneas. Se ocorrer interrupção durante a gravação, preserve e examine `state.json`, `state.tmp` e `.lock` antes de retomar; não apague evidências nem force replay de efeitos externos.

### Recuperação manual após interrupção

Não há remoção automática de trava órfã. Um processo encerrado à força pode deixar `.lock` ou `state.tmp`; `EEXIST` indica que é preciso reconciliar antes de gravar de novo.

1. Leia `.lock`: contém PID, host e início da operação. Confirme no host indicado que esse processo terminou e que não há outro comando bridge usando o run. PID existente, host diferente ou arquivo incompleto exigem investigação; não remova a trava por idade. Se o arquivo estiver vazio, use a evidência do processo que foi interrompido, sem presumir encerramento.
2. Preserve cópias de `state.json`, `.lock`, eventual `state.tmp` e da resposta JSON que seria entregue em uma pasta de diagnóstico do workspace. Leia `state.json` e execute `proximo` (somente leitura). Se o ID já não estiver pendente, a resposta pode ter sido salva antes da interrupção; siga apenas o trabalho ainda emitido.
3. Depois de confirmar a ausência de processo escritor, renomeie `.lock` e eventual `state.tmp` para nomes únicos de diagnóstico, fora dos nomes reservados. Não promova `state.tmp` sobre `state.json`: a versão persistida é a autoridade de replay. Renomear preserva a evidência e libera a próxima gravação atômica.
4. Se o ID continuar pendente e houver resposta JSON completa, reenvie a mesma resposta usando `responder`. Não execute o trabalho externo outra vez. Se a resposta se perdeu, reconcilie os artefatos/efeitos já existentes para reconstruir evidência antes de qualquer repetição.

O schema verifica estrutura, não veracidade. A evidência depende da execução observável pelo Codex. Testes técnicos com respostas sintéticas não substituem avaliação comportamental com modelos, conectores e dados sintéticos na etapa 3.
