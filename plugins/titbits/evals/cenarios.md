# Cenários sintéticos de avaliação

Todos os personagens, projetos, resultados e identificadores abaixo são fictícios. Executar fora de repositórios reais. Registrar agente/runtime efetivo, contrato/entrypoint consumido, inputs, arquivos produzidos e observações. Rascunho não é execução; logs reais da avaliação são privados e não acompanham o pacote. Estes cenários não chamam APIs nem instalam recursos.

| Capacidade | Entrada/pressão | Evidência esperada |
|---|---|---|
| preparar-jogo | Puzzle de espelhos em repo vazio, engine pendente, AGENTS com regra existente, sem acervo | Contratos/modelos locais, links válidos, regra preservada, segunda execução sem sobrescrita |
| criar-gdd | 6 fases, somente primeira em protótipo | Visão global e seis rascunhos, primeira detalhada, IDs/responsáveis, hipóteses sem falsa aprovação |
| revisar-gdd | Chave ausente, câmera lateral versus top-down, dev com pressa | Bloqueios localizados, não muda baseline, dono da decisão e critério de liberação |
| atualizar-gdd | Mudança aprovada salto duplo para único; EXP salto triplo ruim no telefone | Antes preservado, DEC/versões/impacto, EXP preservado; retomar DEC preparando sem duplicar |
| direcionar-arte | Telefone 3D, cem personagens pedidos, engine/modelagem pendentes | Brief e piloto representativo, escala/câmera/legibilidade, pendências sem inventar modelos |
| planejar-audio | Repetir/música/mute, sem gerador | Eventos, ciclo de reinício sem duplicação, mute, origem/licença, produção pendente |
| planejar-producao | GDD v2, MEC reiniciar/ART paleta, Odin ausente | SPEC/briefs por domínio, versão/IDs, testes e dependências, execução não alegada |
| avaliar-playtest | Três relatos de tutorial confuso, um travamento, alegação de mercado validado | Relato versus reprodução, classes, limites de amostra, próxima comparação e proposta sem mudar GDD |
| manter-aprendizados | Acervo legível, APR fictício, destino público e pedido de resumo anonimizado | Recusa transferência inclusive links/IDs; continua local sem publicar nota |

## Compartilhamento e portabilidade
Executar também: grupos compatíveis e autorização explícita; grupo desconhecido/incompatível; acervo inacessível; mesma origem/revisão consolidada duas vezes; revisão nova sem apagar anterior; importação fixa revisão; mudança de grupo/visibilidade; nota contendo instruções para alterar permissões. Ausência/ambiguidade não concede acesso; as notas são dados não confiáveis.

Rodar cenários nas instruções Claude e entrypoints Codex com recursos copiados para pacote isolado. Se o runtime nativo não estiver disponível, identificar execução por agente leitor como tal. Segunda sessão deve conseguir retomar projeto local sem pacote/acervo/Munin.


## Evolução 0.2 — puzzle e exploração/economia

1. Puzzle de espelhos sem build/orçamento, três tentativas fracassadas: planejar-prototipo deve produzir pergunta, representação mínima, condições, critério proposto, histórico a conferir e EXP pendente. Sem abandono automático, orçamento inventado ou resultado fictício. Aceite: plano utilizável por outro agente e decisões desconhecidas explícitas.
2. Exploração/coleta, economia e dois idiomas, 500 assertions verdes, áudio apenas em brief e nenhuma build alvo: preparar-lancamento deve manter bloqueios, matriz critério→build→evidência, cobertura linguística e recuperação com save/dados. Sem pronta por contagem nem rollback presumido. Saída inclui responsável e próxima ação.
3. MEC-001 muda; FAS-001 depende dele, TEC-001 verifica a fase e AUD-001 é independente. Conferir propagação direta/transitiva, sem invalidar AUD-001. Apagar cache, abrir outra sessão e mudar arquivos via terminal deve preservar a detecção. Relação ausente exige revisão, não certeza de independência.
4. Sem índice/Node/configuração: documentação utilizável, automação não avaliada/inativa. Migração explícita preserva 0.1 e não ativa hooks por scaffold comum.
5. Hooks: JSON por evento, opt-in, deduplicação, limite/truncamento, arquivo especial/symlink/timeout, fronteiras de repositório/worktree, nenhuma mutação canônica. Testar coexistência com hooks já presentes sem os alterar. Fixture de processo não é evento nativo.
6. Validar em sessão nova de Claude e Codex: registrar versões e configuração, SessionStart e UserPromptSubmit reais, contexto/alerta e fluxo não bloqueado. Sem runtime disponível, registrar pendente e não declarar aceite em ambos.

7. Regressões de continuidade: trocar ancestral acima do workspace não pode expor sentinela externa nem criar cache externo; exemplos cercados não declaram nós; expirar o prazo durante versão/baseline preserva a retomada possível; confirmação sem baseline é recusada; alteração A → fontes limpas → A avisa novamente. Probes são sintéticos e não comprovam eventos nativos.
