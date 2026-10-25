---
name: preparar-lancamento
description: "Assess game release readiness. Use when pedir preparar lançamento, avaliar uma versão candidata, organizar regressão e localização, conferir distribuição ou planejar recuperação de uma entrega defeituosa."
---

# Preparar lançamento

## Antes de agir
Leia `${CLAUDE_PLUGIN_ROOT}/references/contrato.md`, `${CLAUDE_PLUGIN_ROOT}/references/historico.md`, `${CLAUDE_PLUGIN_ROOT}/references/continuidade.md` e `${CLAUDE_PLUGIN_ROOT}/references/compartilhamento.md`. Resolver local_jogo conforme contrato e consultar GDD, histórico, plano, inventário de assets e evidências da versão candidata. Sem arquivos obrigatórios, entregar lacunas; não fabricar candidato.

## Input
Versão candidata/build identificada, plataformas/canais, idiomas aplicáveis, critérios aprovados, responsáveis, evidências e restrições reais. Preparar lançamento não autoriza publicar, enviar conteúdo a lojas, alterar contas ou contatar pessoas.

## Output
Criar producao/lancamentos/<versao>/README.md usando `${CLAUDE_PLUGIN_ROOT}/templates/lancamento.md`. Preservar rodadas anteriores com sufixo. Cada item registra requisito, build/versão de GDD, ambiente, procedimento, evidência/resultado, responsável e estado: verificado, falhou, nao_avaliado ou nao_aplicavel com justificativa. Evidência de outra build/versão afetada exige nova avaliação ou justificativa explícita de validade.

Cobrir instalação/inicialização, loop, controles/UX/acessibilidade, salvar/retomar, áudio e arte integrados, desempenho conforme orçamento do jogo e regressões dos defeitos relevantes. Separar inspeção documental, teste técnico e observação da experiência. Arquivo de bugs vazio não prova ausência de defeitos, e assertions verdes não provam comportamento não exercitado. Não impor zero warnings, contagem de testes ou limites técnicos universais.

Quando houver localização: inventariar texto/voz com contexto, plurais/placeholders, fontes, layout e expansão; conferir idiomas no fluxo real, fallback, troca/persistência e RTL quando aplicável. Mudança do texto-base marca traduções relacionadas para revisão. Origem/licença e obrigações de distribuição precisam estar conferidas para cada asset/dependência pertinente; dúvida material permanece pendente.

Listar problemas conhecidos com severidade contextual, cenário, alcance, mitigação e decisão humana. Separar bloqueio causal de risco aceito dentro da autonomia registrada. Veredito pronto apenas com critérios essenciais verificados e decisão cabível; bloqueado se falha/pendência impede entrega; nao_avaliado quando não há base para julgar. Ausência de build alvo nunca vira prontidão técnica.

Preparar recuperação: versão anterior conhecida (ou indisponível), responsável, sinal de interrupção, modo de suspender distribuição/retirar candidato, compatibilidade de saves/dados e procedimento verificável de rollback/hotfix. Se rollback for impossível, documentar limitação e alternativa; não inventar reversibilidade. Verificação da recuperação fica pendente enquanto não for ensaiada. Planejar acompanhamento limitado aos canais/dados autorizados, sem ativar monitoramento recorrente.

Entregar relatório, checklist rastreável, plano de distribuição/recuperação, bloqueios e próximo passo único. Produzir notas de versão a partir de mudanças confirmadas, sem dados privados indevidos. Aplicar titbits:avaliar-playtest e titbits:manter-aprendizados à retrospectiva. Publicar/instalar é outra ação explicitamente autorizada.

## Resolução de paths
Pedido explícito > local_jogo no CLAUDE.md do workspace > defaults pessoais local_* > exatamente uma convenção descoberta no cwd > default documentado docs/jogo/. Paths citados são ilustrativos. Múltiplos candidatos exigem esclarecimento. No Codex, usar AGENTS.md e defaults do RUNTIME.md. Acervo só por configuração explícita e autorização.
