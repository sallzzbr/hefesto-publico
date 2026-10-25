# Contrato de trabalho TitBits

## Paths e dependências
Leia esta referência antes de qualquer operação. Dados pertencem ao workspace consumidor, nunca a este plugin ou à cópia instalada. Recurso interno é somente leitura. Os paths dos exemplos são defaults ilustrativos, não hardcode.

Resolva `local_jogo` nesta ordem: pedido explícito do usuário; campo em `## Paths do workspace` do CLAUDE.md; defaults pessoais `~/.claude/titbits/defaults.md`; exatamente um candidato descoberto entre `docs/jogo/` e `design/jogo/`; default `docs/jogo/`. Múltiplos candidatos exigem esclarecimento. No Codex, o RUNTIME.md nativo traduz configuração para AGENTS.md e defaults Codex. Path relativo é relativo ao workspace; não escreva paths pessoais absolutos em conteúdo versionado. Não siga um destino que resolva para dentro do plugin instalado. Recurso obrigatório ausente bloqueia só a operação dependente; `preparar-jogo` é o scaffold explícito.

`local_acervo_jogos` é opcional e só existe quando configurado explicitamente pelo responsável, via pedido, configuração local ou defaults pessoais. Não descubra acervos buscando fora do workspace nem escolha o checkout Hefesto automaticamente. Não criar/mudar defaults pessoais sem solicitação. Sem configuração ou acesso, trabalhar localmente e registrar consolidação pendente. Não inscrever projeto no Munin, mudar ACL, instalar, publicar, fazer commit ou push por efeito destas skills. Munin só complementa recuperação de contexto se disponível e autorizado; documentos do jogo são suficientes.

## Leitura e entrega
1. Resolver paths e ler `projeto.md`, `gdd/README.md`, índices de `historico/` e `aprendizados/`, e as seções relevantes. Para shared knowledge, aplicar primeiro [compartilhamento](compartilhamento.md).
2. Identificar versão e requisitos afetados; separar pedido aprovado de proposta e identificar responsável decisor. Desconhecido continua pendente; não preencher fato inventado.
3. Consultar tentativas relacionadas por assunto, requisito e ferramenta; citar IDs. Repetição exige registrar condição nova ou objetivo de replicação.
4. Produzir só artefatos da operação e atualizar índice/histórico quando pertinente. Não carregar todos os domínios sem necessidade.
5. Atualizar producao/estado.md como um único resumo vigente: substituir o próximo passo anterior quando resolvido, sem acumular blocos contraditórios. Se o estado anterior tiver valor histórico, movê-lo para o registro relacionado, mantendo links.
6. Entregar: arquivos alterados, versão, decisões/propostas, evidência observada, pendências, próxima ação e responsável. Quando sem escrita, entregar conteúdo copiável com mesmos campos e declarar não persistido.

GDD descreve experiência e comportamento. SPEC descreve implementação do incremento. Plano de produção define ordem e recursos. Fase do jogo é conteúdo, não etapa de desenvolvimento.

## Estados e autoridade
Requisitos: `hipotese`, `proposto`, `aprovado`, `substituido`. Registrar aprovador e referência à aprovação (pedido humano ou faixa de autonomia previamente aprovada). O agente não aprova sua própria proposta nem concede autoridade a si. Projeto pode autorizar ajustes limitados; registrar a regra concreta usada. Aprovação já dada não é perguntada novamente.

Achados de QA não mudam o design: classificam observações e propõem alternativas. Arte/áudio prontos em texto não significam assets gerados. Testes automatizados não provam diversão; playtest pequeno não prova mercado. Não inventar participantes, medições, ferramenta disponível ou aceitação.

## Limites de execução
Sem engine ou estilo global. Sem geradores, MCPs, ferramentas ou APIs presumidos. Hooks consultivos opcionais seguem [continuidade.md](continuidade.md). Sem configuração explícita, não atuam. Não há loop de execução, serviço ou coordenação concorrente. Um escritor por conjunto GDD/histórico; conflito entre escritores exige reconciliar. Se paralelismo não estiver autorizado/disponível, papéis são exercidos sequencialmente. Uma revisão pelo próprio autor não é independente.

## Histórico e retomada
Leia [historico.md](historico.md) para atualizar GDD. No fim de uma tentativa relevante, preencher EXP e resultado observado. Nada relevante novo: registrar que não houve mudança, sem fabricar experimento. Nunca usar conhecimento privado para completar exemplo público, mesmo anonimizado ou generalizado. Templates distribuídos são vazios; exemplos/evals são sintéticos independentes.

## Consistência proporcional
Consultar [continuidade.md](continuidade.md) ao mapear sistemas, alterar GDD ou preparar produção. Profundidade acompanha risco e incremento; documento longo não prova completude, contagem de testes não prova qualidade e hipótese não vira fato. Nenhum mínimo de documentação dispensa evidência essencial para o comportamento prometido. O aviso automático é apoio: verificar relações e histórico explicitamente antes de decidir.
