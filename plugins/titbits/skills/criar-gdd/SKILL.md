---
name: criar-gdd
description: "Write a multidisciplinary game design document. Use when pedir criar GDD, documentar mecânicas, desenhar fases ou organizar visão e progressão de um jogo; explicitar decisões, hipóteses e pendências por disciplina."
---

# Criar GDD

## Antes de agir
Leia `${CLAUDE_PLUGIN_ROOT}/references/contrato.md`, `${CLAUDE_PLUGIN_ROOT}/references/historico.md` e `${CLAUDE_PLUGIN_ROOT}/references/compartilhamento.md`. Consulte o GDD e histórico relacionados antes de nova tentativa; registre resultado relevante conforme o contrato comum.

## Input
Brief, público, plataforma/controles, referências permitidas, papéis e escopo conhecido. Se não houver base documental, usar titbits:preparar-jogo. Nunca escolher engine/estilo como padrão do plugin.

## Output
Usar `${CLAUDE_PLUGIN_ROOT}/templates/gdd.md` para gdd/README.md e criar os documentos referenciados. Registrar versão 1 apenas em jogo sem GDD; documento existente passa por revisão/atualização, sem reiniciar histórico. Cada requisito recebe ID estável, estado, responsável e verificação. Definir loop, controles, estados, recursos, vitória/derrota/reinício, câmera, espaço, narrativa, audiovisual, UX/acessibilidade, técnica e validação. Se domínio não se aplica, registrar decisão explícita.

Visão global descreve campanha/progressão inteira; detalhe é progressivo. Para fases fixas, criar um rascunho por fase planejada usando `${CLAUDE_PLUGIN_ROOT}/templates/fase.md`; registrar desconhecidos. Para jogo sem fases, descrever ciclos, eventos, regiões ou geração. Fase do próximo incremento precisa de estado inicial, ações/regras, objetivos, desafios, critérios de conclusão e hipóteses a testar. Fases futuras não precisam de arte final. Exemplos inventados são propostas identificadas, nunca decisões aprovadas.

Consultar os responsáveis pelas disciplinas e separar propostas por responsável. Entregar pendências bloqueantes, hipótese/protocolo de protótipo, limites e perguntas decisórias. Só registrar aprovação com fonte humana ou faixa já autorizada. Atualizar estado de produção com próximo passo.

## Exemplo sintético
Puzzle de seis fases: índice global com objetivo de aprendizado de cada uma, FAS-001 detalhada com um espelho e receptor como proposta, FAS-002 a FAS-006 em rascunho. MEC-001 rotação é hipótese até aprovação. Direção visual tem intenção e placeholders; engine pendente impede escolher formato final de assets, não impede documentar o jogo.

## Resolução de paths
Pedido explícito > local_jogo no CLAUDE.md do workspace > defaults pessoais local_* > exatamente uma convenção descoberta no cwd > default documentado docs/jogo/. Paths citados são ilustrativos. Múltiplos candidatos exigem esclarecimento. No Codex, usar AGENTS.md e defaults do RUNTIME.md. Acervo só por configuração explícita e autorização.
