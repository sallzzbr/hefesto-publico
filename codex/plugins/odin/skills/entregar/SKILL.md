---
name: entregar
description: "Deliver ou retome entrega concreta: implementa botão/feature, corrige bug, pega issue e implementa, faz entrega do plano, continua/retoma entrega, resume work on the delivery. Artefato encomendado: me pediram uma tela/página/feature; mesmo sem hipótese, entre aqui para portão 0.5. Inclui dashboard, skill, agente, prompt, script, automação, processo, documento e configurar experimento A/B. Escreve SPEC sem implementar termina no gate. Não use para resumo/status de issue ou entrega, hotfix urgente em produção, workshop/apresentação/documento SOBRE desafio, problema vago (descobrir), solução técnica BFF/arquitetura/design system sem placar (definir), alavancas/fake door (desenvolver), loop de software com SPEC aprovada (dev-loop), ler resultados/placar (acompanhar) ou mudar defaults."
---

# entregar

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/entregar/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Procure entrega não-terminal antes de iniciar. Retome pelo Estado e Log (Log prevalece), sem recriar descrição/SPEC; registre retomada sem duplicar eventos. Leia capa e mostre 📍 quando existir desafio.
2. Faça preflight de git, working tree e gh quando houver PR; preserve alterações existentes e resolva conflito de escopo antes de branch. Detecte validações, branch principal, idioma, scopes e template. Classifique tarefa/problema/solução pronta e tipo de entrega pelo contrato.
3. Leia steps-detalhados.md, tipos-de-entrega.md e convenções necessárias. Em pedido só de SPEC, execute primeiro a seção "SPEC com branch local" abaixo, antes de qualquer escrita. Crie arquivo da entrega no path resolvido após aprovação do conteúdo; registre branchBase. Explore, faça brainstorming quando disponível e escreva SPEC pelo template, com critérios, coluna `Tipo` (reprodução ou preservação, decidida com o dono), testes executáveis, restrições, non-goals e unidades disjuntas. Planner é papel Codex de arquitetura, sem exigir alias de outro provedor; para o brief dele, exija a skill `iris:delegar-agente` do pacote iris disponível no ambiente desta sessão e siga a [verificação de dependência](../../DEPENDENCIAS.md). Ausência bloqueia a autoria do brief, sem fallback silencioso. Pedido só de SPEC termina aqui.
4. Se o pedido for somente SPEC, seguir a seção abaixo e parar após aprovação. Para implementar, obtenha aprovação da SPEC, modo Solo/Loop e perfil/opt-in quando Loop, aproveitando autorização existente. Registre contrato da sessão no Log. Garanta branch de trabalho autorizada; branch existente não é descartada nem renomeada silenciosamente.
5. Software exige testes de reprodução vermelhos por asserção, ao lado de controles de preservação verdes, antes da implementação; implementador não afrouxa testes. Implementação já existente numa retomada nunca se reverte: o vermelho é medido numa cópia da base (dev-loop com `baseRef` + `vermelhoNaBase`; no Solo, `copia-base.mjs` do domínio), e rebaseline declarado só quando a base não pode ser medida. Sem nenhuma reprodução vermelha e com o dono querendo seguir, a entrega nunca segue no Solo (decisão do dono, 2026-11-03; regra canônica no resumo do portão de [escada-ponytail.md](../../shared/skills/dev-loop/references/escada-ponytail.md)): passa para o Loop (dev-loop) no perfil `maximo`, em run novo com `autorizacoesTdd` (autorização no Log, frase do dono citada literalmente), depois do opt-in de custo pedido e registrado no Log como em qualquer Loop (reaproveitado quando escopo e custo não aumentaram); sem esse opt-in, ou sem subagentes para o Loop (aí sem pedir o opt-in), fica bloqueada no portão. Vale por fase, critério a critério: basta uma reprodução da fase que não fica vermelha e que o dono quer manter, em vez de cortar o critério já atendido ou reescrever o teste inútil, mesmo ao lado de outras vermelhas. Quando a entrega passa para o Loop com fases já implementadas no Solo, elas contam como implementação anterior: o run leva o `baseRef` do Log com `vermelhoNaBase: true`, e `autorizacoesTdd` cobre só os critérios sem vermelho; sem `vermelhoNaBase`, o portão bloqueia com `implementacao-preexistente`. Loop encaminha dev-loop e seu bridge passando `baseRef` (SHA completo de `git merge-base <branchBase> HEAD`, 40 ou 64 hex, calculado uma vez e gravado no Log, nunca o nome da branch; nome de ref, tag ou SHA abreviado é erro de Args) e `pendenciasPath` (o arquivo de pendências resolvido, o mesmo em todo run). Solo aplica fases, self-review e os oito gates ponytail P1/P2/P13/P17, aninhamento, P10/P11/P12/P14, com log por fase. Não-software usa SPEC-lite e evidência por tipo, nunca harness de software.
6. Execute validações reais e registre limitações/manuais; validação local é passo mecânico, sem pedir OK. Se o dev-loop fechou verde com `validacaoFinal` (verde, `impressao` não nula), recalcule `node "<PLUGIN_ROOT>/shared/skills/dev-loop/scripts/hashes-testes.mjs" --impressao '<validacaoFinal.excluidos em JSON>' '<validacaoFinal.excluidosNaoRastreados em JSON>'` da raiz do workspace: valor igual por inteiro dispensa os comandos que estão em `validacaoFinal.comandos` (registre o reuso no Log); impressão diferente ou nula, exit não zero ou dúvida sobre o ambiente roda tudo. Falha de ambiente (cache, temporário ou estado sem escrita, ferramenta ausente) é reportada como ambiente, com path e variável; corrigir é corrigir o ambiente, nunca código ou teste. Pendências fora do escopo vão ao arquivo resolvido, nunca ao commit. Commit/push/PR/publicação exigem autorização explícita; apresente artefato concreto e valide antes. Antes de preparar stage, leia todo o índice e preserve conteúdo preexistente. Apresente o diff e a lista exata de arquivos autorizados; mesmo path autorizado pode conter trechos alheios. Prepare somente esses paths com `git --literal-pathspecs add -- <paths-específicos>`. Resolva PLUGIN_ROOT como a raiz física do pacote a partir desta skill e execute `node "<PLUGIN_ROOT>/shared/skills/dev-loop/scripts/inspecionar-git.mjs" staged '<array JSON dos paths autorizados>'` da raiz do workspace (rename exige origem e destino). Exit não zero bloqueia commit: não limpe nem inclua alterações alheias silenciosamente. Use template real de PR e atribuição real, sem identidade de plataforma inventada.
7. Confirme efeitos externos antes de repeti-los na retomada. Só feche Estado/checklist/capa com evidências; próximo checkpoint é acompanhar quando houver dado.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações registradas no Log para a mesma entrega, ação e custo igual ou menor, inclusive na retomada; commit, push, PR e publicação continuam exigindo OK na sessão corrente e conferência do estado real. Verifique por leitura ou comando o que é mecânico (branch principal, validações, branch da entrega, `baseRef`) em vez de perguntar. Pergunta necessária segue o [contrato de conversa](../../shared/skills/descobrir/references/contrato-de-conversa.md): é curta, completa, registrada como `[pendente]` no Log quando muda args, escopo ou custo, fecha a mensagem e encerra o turno; o trabalho que não depende dela vem antes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.

## SPEC com branch local

Para `/spec` ou planejamento sem implementação, seguir [Branch local no planejamento /spec](../../shared/skills/entregar/references/steps-detalhados.md): detectar `branchBase`, propor `branchTrabalho` legível e obter OK antes de gravar a SPEC ou criar/entrar na branch. Não trocar com alterações pendentes, nem executar stash, reset ou pull automáticos. Conferir associação de branch existente à mesma entrega antes de reutilizar; colisão exige decisão. Registrar `[branch-spec]` com base, branch, path e autorização; reaproveitar na implementação, sem refazer SPEC aprovada ou recriar branch. SPEC legada com campos ausentes exige resolver os campos e obter autorização antes de criar/trocar branch; gravar a associação só após conferir a branch correta. Parar na SPEC aprovada, sem commit automático, implementação, push ou PR; modo e opt-in de execução ficam para o pedido posterior. Arquivo sem commit continua na árvore de trabalho, e esse estado deve ser informado.

## Piso de qualidade do software

Planejamento e Solo usam o [contrato canônico](../../shared/skills/dev-loop/references/quality-contract.md):
base, especialidades pertinentes, fontes das convenções, alvos/comandos e decisões de decomposição.
Valide a seção com `spec-ids.mjs --quality`; contrato antigo incompleto bloqueia antes de implementar.
No Solo registre comandos reais, inventário seguro e cobertura de cada check, com limitações claras;
sem revisor independente não declare independência. Não dispense qualidade pelo perfil de custo.
Mais de 400 linhas exige examinar coesão, não dividir automaticamente. P10 aceita fonte verificável
em SPEC, plano, ADR, PR ou código (arquivo:linha/URL com âncora e contexto), sem comentário de processo.
P11/P12 preservam fronteiras e testabilidade mesmo com um consumidor; P13 mede escopo e responsabilidade.

O inventário usa `inspecionar-git.mjs quality <paths-json> [base [pendenciasPath]]` no diretório
`shared/skills/dev-loop/scripts/` do pacote resolvido. O argumento final é um único arquivo
de pendências local; passe `HEAD` quando não houver base explícita. Loop o encaminha pelo
harness; Solo aplica a mesma elegibilidade do [contrato](../../shared/skills/dev-loop/references/quality-contract.md):
fora de alvos, arquivos tocados/declarados, testes, apoio, SPEC e área de implementação.
O helper dispensa somente arquivo regular não rastreado ou ausente. Pendência exata regular
em HEAD ou índice segue o inventário normal, inclusive mudanças e remoções; recusa entrada
somente na base, diretório, symlink ou fuga. Flags `skip-worktree` ou `assume-unchanged` em alvos ou pendências recusam
a inspeção. Arquivos alheios marcados só passam com bytes literais, tipo e modo iguais ao
índice; ausência fora das regras sparse sem mudança base–índice é permitida. Diferenças ocultas, erro de
leitura ou índice unmerged recusam com diagnóstico, sem alterar bits Git. Preserve o JSON literal e todas as outras omissões.


Ausências sparse elegíveis usam um único lote NUL de membership; fallback prepara regras
e configuração uma vez por inventário, sem cache persistente. Symlink interno válido para
arquivo regular é objeto `symlink`, com zero linhas e bytes positivos de `readlink`, sem
ler conteúdo do alvo. No diff, novo link declarado usa `{path,type:"symlink",targetBase64}`.
Registre classificação, destino literal observado (ou bytes escapados/hex identificados),
resolução interna, limitação e inspeção na SPEC local inventariada. Evidência nontext cita
essa linha real da SPEC; nunca uma linha inventada no link. Links externos, dangling,
diretórios, tipos especiais e pendência-link continuam recusados.
