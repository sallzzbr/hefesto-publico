# TitBits

Plugin de game design e produção documental. Versão 0.2.0. Independente de engine e de repositório de estúdio. Hooks consultivos opcionais recuperam contexto e alertam inconsistências. As skills são procedimentos executados pelo agente; não há serviço nem loop autônomo.

## Skills

| Skill | Entrega |
|---|---|
| `preparar-jogo` | Preparar estrutura e contratos locais sem engine obrigatória |
| `criar-gdd` | Criar visão e especificação multidisciplinar |
| `revisar-gdd` | Encontrar contradições e avaliar prontidão |
| `atualizar-gdd` | Aplicar mudança aprovada com histórico e retomada |
| `direcionar-arte` | Definir direção visual e briefs de assets |
| `planejar-audio` | Definir eventos, direção e contratos de áudio |
| `planejar-producao` | Derivar incrementos, SPECs e briefs |
| `avaliar-playtest` | Interpretar evidências sem confundir teste com mercado |
| `planejar-prototipo` | Planejar experimento com pergunta, limite e critério de decisão |
| `preparar-lancamento` | Avaliar candidato e preparar distribuição/recuperação, sem publicar |
| `manter-aprendizados` | Consultar, registrar e consolidar conhecimento privado autorizado |

## Fluxo
Preparar projeto → criar/revisar GDD → aprovar incremento → planejar produção → execução autorizada → playtest → propor/aplicar mudanças. Consultar histórico antes de tentar e registrar tentativas relevantes. Usuário pode invocar qualquer capacidade diretamente quando entradas estiverem disponíveis.

Seis papéis reutilizáveis em agents/: produtor, game-designer (inclui narrativa e fases), programador, artista, designer-sonoro e qa. O projeto registra responsabilidades reais; não exige seis agentes simultâneos. Copiar contratos mínimos para o jogo permite continuidade sem instalação do plugin.

## Dados e privacidade
GDD, históricos e aprendizados pertencem ao workspace. Acervo compartilhado opcional e explicitamente autorizado, fora deste pacote. Não incluir conteúdo real de projetos no plugin público, mesmo resumido, generalizado ou anonimizado. Grupo desconhecido, destino público ou autorização ausente bloqueia transferência. Acesso ao arquivo não concede autorização. Não há ACL implementada por este plugin: permissões reais dos repositórios continuam necessárias.

Leia [contrato](references/contrato.md), [histórico](references/historico.md) e [compartilhamento](references/compartilhamento.md). Templates em templates/ são vazios; cenários em evals/ são sintéticos independentes.

## Dependências
Filesystem/Markdown bastam para documentação. Engine, geradores, build e ferramentas audiovisuais são dependências da produção concreta, escolhidas por jogo. Munin é opcional; ausência não bloqueia. Odin é dependência opcional para executar dev-loop: sem ele, planejar-producao entrega SPEC documental sem simular execução. Não instala dependências automaticamente.

## Verificação
Validação de pacote não prova comportamento. Cenários e régua em [evals/cenarios.md](evals/cenarios.md); executar em workspace descartável e registrar observações/limitações. Não alegar instalação nativa a partir de teste de agente lendo Markdown. Publicação e instalação em perfil real são operações separadas.

## Resolução de paths
Pedido explícito > local_jogo no CLAUDE.md do workspace > defaults pessoais local_* > exatamente uma convenção descoberta no cwd > default documentado docs/jogo/. Paths citados são ilustrativos. Múltiplos candidatos exigem esclarecimento. No Codex, usar AGENTS.md e defaults do RUNTIME.md. Acervo só por configuração explícita e autorização.

## Agents

| Papel | Responsabilidade |
|---|---|
| `produtor` | Contrato em agents/produtor.md |
| `game-designer` | Contrato em agents/game-designer.md |
| `programador` | Contrato em agents/programador.md |
| `artista` | Contrato em agents/artista.md |
| `designer-sonoro` | Contrato em agents/designer-sonoro.md |
| `qa` | Contrato em agents/qa.md |

## Continuidade opcional
Mapa de relações, baseline persistente e hooks em [continuidade](references/continuidade.md). Node.js 22+ para automação; sem Node, documentação continua utilizável. Hooks exigem opt-in por projeto e nunca bloqueiam ações. Projetos 0.1 continuam funcionando; migração explícita preserva histórico. Testes de script não substituem aceite dos eventos reais em Claude e Codex.
