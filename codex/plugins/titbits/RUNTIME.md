# Runtime Codex — TitBits

Leia este arquivo antes do contrato da skill. Use ferramentas disponíveis, sem presumir engine, CLI Claude, geradores ou conectores. Hooks consultivos opcionais seguem shared/references/continuidade.md. Não há harness de execução nem servidor.

Recursos de domínio em shared/ são cópias verificadas pelo inventário; nunca editar pacote instalado. Nos contratos, `${CLAUDE_PLUGIN_ROOT}` resolve para shared/ deste pacote, apenas para leitura. SKILL.md legado em shared vira CONTRATO.md. Links relativos são resolvidos a partir do arquivo que contém o link.

## Configuração
Para leitura de configuração e resolução de paths, CLAUDE.md significa AGENTS.md do workspace. Essa adaptação não renomeia os arquivos de integração: preparar-jogo continua criando ou mesclando AGENTS.md e CLAUDE.md separadamente, preservando eventual import entre eles. Defaults pessoais são `~/.codex/hefesto/titbits/defaults.md`; não ler defaults Claude no Codex. Pedido explícito > local_* em Paths do workspace > defaults pessoais > exatamente um candidato descoberto no cwd > default documentado. Mais de um candidato exige esclarecimento. Recursos obrigatórios ausentes bloqueiam só operação dependente, salvo scaffold explícito.

Acervo é opcional e explicitamente configurado, sem descoberta fora do projeto. Dados reais, GDDs e aprendizados pertencem ao workspace/acervo autorizado; nunca ao pacote. Não criar configurações, instalar dependências, publicar ou contatar terceiros sem instrução correspondente. Sem Munin/acervo, continuar localmente.

## Papéis e modelos
Ler shared/agents/<papel>.md antes de exercê-lo. Contratos locais copiados para o projeto continuam utilizáveis sem plugin. Herdar modelo da sessão; não escolher modelos pagos nem fallback. Delegar somente com autorização e recursos efetivos. Se revisão independente não disponível, declarar pendente ou autoavaliação, nunca simular.

## Evidência
Uma chamada de skill produz documentos, não prova que código, arte ou áudio foi executado. Registrar arquivos/versão, evidência, limitações, pendências e próxima ação. Reconciliação de histórico é procedimento, não transação automática. Para Odin disponível, ler seu template vigente; sem ele, produzir SPEC documental e registrar execução não realizada.

## Scripts e hooks
CLI documental em shared/scripts/continuidade.mjs. Hooks nativos em hooks/hooks.json usam o adaptador Codex, com Node.js 22+, opt-in por workspace e sem bloqueio. Não instalar runtime ou alterar confiança/permissões automaticamente. Somente SessionStart e UserPromptSubmit são registrados e emitem contexto. O Codex só executa hooks de plugin depois que o usuário revisa e confia neles; não alterar essa confiança. A mesma identidade de workspace acompanha configuração, fontes e cache; o prazo cooperativo inclui versão e baseline. I/O síncrono travado pode produzir silêncio pelo timeout do supervisor. Aceite de runtime deve registrar eventos reais, não apenas fixtures.
