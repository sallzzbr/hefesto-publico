---
name: planejar-producao
description: "Plan game production increments from an approved GDD. Use when pedir fasear desenvolvimento, criar tarefas, SPECs para Odin, briefs de arte e áudio ou organizar dependências e critérios de aceite por disciplina."
---

# Planejar produção

## Antes de agir
Leia `${CLAUDE_PLUGIN_ROOT}/references/contrato.md`, `${CLAUDE_PLUGIN_ROOT}/references/historico.md` e `${CLAUDE_PLUGIN_ROOT}/references/compartilhamento.md`. Consulte o GDD e histórico relacionados antes de nova tentativa; registre resultado relevante conforme o contrato comum.

## Input
GDD vigente e incremento aprovado, orçamento/autonomia, dependências, responsáveis e ferramentas disponíveis. Sem aprovação de escopo, plano fica proposto. Consulta do histórico evita reabrir alternativas sem motivo.

## Output
Usar `${CLAUDE_PLUGIN_ROOT}/templates/incremento.md` em producao/<incremento>/README.md. Cada tarefa referencia versão e IDs GDD, objetivo observável, dependências, responsável, arquivos que pode alterar, contrato de saída, critério de aceite/evidência, orçamento de tentativas/tempo/custo e parada. Número não definido fica pendente; não inventar orçamento aprovado. Distinguir protótipo, fatia vertical e produção de conteúdo conforme risco, sem confundir com fases jogáveis.

Código recebe SPEC técnica separada. Se Odin disponível, ler seu formato vigente e preparar objetivo, critérios/testes, restrições, unidades/interfaces, validações, riscos, dependências e prontidão; encaminhar a odin:dev-loop apenas quando execução autorizada e pré-requisitos satisfeitos. Se Odin ausente, entregar SPEC documental com os mesmos campos essenciais e execução não realizada. Nunca instalar Odin nem alterar seu contrato para encaixar o GDD.

Arte/áudio recebem briefs ligados à direção aprovada e formatos de integração; QA recebe build/cenário/resultado esperado e protocolo de evidência. Explicitar ordem entre entregas e ponto de integração. Um escritor integra arquivos compartilhados. Tarefa só pronta quando critérios, aprovação e dependências resolvidos; aceita exige evidência real. Mudança de GDD marca tarefas afetadas revisao_necessaria.

Atualizar producao/estado.md: última ação, arquivos, impedimentos, próxima ação e responsável. Interrupção exige conferir efeito real antes de repetir geração ou outra operação externa. Sem scheduler, hook ou execução recorrente nesta skill.

## Exemplo sintético
GDD v2 MEC-001 reiniciar e ART-002 paleta: SPEC de restauração de estado, brief de aplicação visual e QA de reinício/legibilidade, cada um referenciado. Sem Odin disponível, entregar pacote; nenhuma execução ou teste é presumido.

## Resolução de paths
Pedido explícito > local_jogo no CLAUDE.md do workspace > defaults pessoais local_* > exatamente uma convenção descoberta no cwd > default documentado docs/jogo/. Paths citados são ilustrativos. Múltiplos candidatos exigem esclarecimento. No Codex, usar AGENTS.md e defaults do RUNTIME.md. Acervo só por configuração explícita e autorização.
