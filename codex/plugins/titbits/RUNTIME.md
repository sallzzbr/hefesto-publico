# Runtime Codex — TitBits

Leia este arquivo antes do contrato da skill. Use ferramentas disponíveis, sem presumir engine, CLI Claude, geradores ou conectores. Não há harness, hooks ou servidor no TitBits 0.1.0.

Recursos de domínio em shared/ são cópias verificadas pelo inventário; nunca editar pacote instalado. Nos contratos, `${CLAUDE_PLUGIN_ROOT}` resolve para shared/ deste pacote, apenas para leitura. SKILL.md legado em shared vira CONTRATO.md. Links relativos são resolvidos a partir do arquivo que contém o link.

## Configuração
Para leitura de configuração e resolução de paths, CLAUDE.md significa AGENTS.md do workspace. Essa adaptação não renomeia os arquivos de integração: preparar-jogo continua criando ou mesclando AGENTS.md e CLAUDE.md separadamente, preservando eventual import entre eles. Defaults pessoais são `~/.codex/hefesto/titbits/defaults.md`; não ler defaults Claude no Codex. Pedido explícito > local_* em Paths do workspace > defaults pessoais > exatamente um candidato descoberto no cwd > default documentado. Mais de um candidato exige esclarecimento. Recursos obrigatórios ausentes bloqueiam só operação dependente, salvo scaffold explícito.

Acervo é opcional e explicitamente configurado, sem descoberta fora do projeto. Dados reais, GDDs e aprendizados pertencem ao workspace/acervo autorizado; nunca ao pacote. Não criar configurações, instalar dependências, publicar ou contatar terceiros sem instrução correspondente. Sem Munin/acervo, continuar localmente.

## Papéis e modelos
Ler shared/agents/<papel>.md antes de exercê-lo. Contratos locais copiados para o projeto continuam utilizáveis sem plugin. Herdar modelo da sessão; não escolher modelos pagos nem fallback. Delegar somente com autorização e recursos efetivos. Se revisão independente não disponível, declarar pendente ou autoavaliação, nunca simular.

## Evidência
Uma chamada de skill produz documentos, não prova que código, arte ou áudio foi executado. Registrar arquivos/versão, evidência, limitações, pendências e próxima ação. Reconciliação de histórico é procedimento, não transação automática. Para Odin disponível, ler seu template vigente; sem ele, produzir SPEC documental e registrar execução não realizada.
