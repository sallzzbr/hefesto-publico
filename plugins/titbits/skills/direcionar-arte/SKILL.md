---
name: direcionar-arte
description: "Define game art direction and asset briefs. Use when pedir estilo visual, referências, personagens, cenários, modelagem 3D, pixel art ou critérios de produção; alinhar câmera, legibilidade, ferramentas e custo antes de ampliar lotes."
---

# Direcionar arte

## Antes de agir
Leia `${CLAUDE_PLUGIN_ROOT}/references/contrato.md`, `${CLAUDE_PLUGIN_ROOT}/references/historico.md` e `${CLAUDE_PLUGIN_ROOT}/references/compartilhamento.md`. Consulte o GDD e histórico relacionados antes de nova tentativa; registre resultado relevante conforme o contrato comum.

## Input
GDD e câmera, intenção visual, plataforma/escala, inventário e restrições. Ferramentas/engine ausentes são pendências, não motivo para inventar especificações técnicas finais.

## Output
Usar `${CLAUDE_PLUGIN_ROOT}/templates/brief-arte.md` para producao/arte/<id>.md. Se direção aberta, comparar 2–3 rotas concretas para mesma câmera e escala, com referências e licença/proveniência. Escolher representante pequeno: personagem, trecho de ambiente, UI e animação pertinente. Critérios incluem silhueta, contraste, leitura no tamanho real, consistência, integração e custo de revisão. Quantidade solicitada não autoriza produzir lote antes de validar direção e amostra.

Para 3D, especificar intenção de topologia/deformação, rig/material, desempenho e exportação; parâmetros finais dependem da engine e prova de importação. Para 2D/pixel art, tratar grade/resolução, escala, filtro, pivô e frames quando pertinente. Não impor estética do plugin. Contratos de assets distinguem fonte editável, exportação, nomenclatura, origem/licença e critérios. Não prometer que imagem conceitual já é sprite/modelo utilizável.

Verificar tentativas anteriores, registrar novo experimento e o que mudou. Sem ferramenta/produção autorizada, entregar direção e brief, assets pendentes. Direção aprovada que muda GDD segue titbits:atualizar-gdd; não aprovar a própria rota.

## Exemplo sintético
Cem personagens 3D para telefone: entregar plano de amostra representativa antes do lote, câmera top-down e limites de leitura. Engine/modelador pendentes; nenhuma malha produzida, desempenho ainda não medido.

## Resolução de paths
Pedido explícito > local_jogo no CLAUDE.md do workspace > defaults pessoais local_* > exatamente uma convenção descoberta no cwd > default documentado docs/jogo/. Paths citados são ilustrativos. Múltiplos candidatos exigem esclarecimento. No Codex, usar AGENTS.md e defaults do RUNTIME.md. Acervo só por configuração explícita e autorização.
