# GDD vivo e histórico

Fonte de verdade: `gdd/README.md` contém versão vigente e mapa de requisitos/seções. Use versões locais inteiras crescentes (1, 2, 3); não confundir com versão semver do plugin. IDs estáveis por projeto: MEC, ART, AUD, NAR, UX, TEC, FAS; registros DEC, EXP e APR com sequência de três dígitos. Consultar índice e arquivos antes de alocar ID; nunca reutilizar nem sobrescrever registro de outro autor. Em conflito parar a escrita e reconciliar, sem alegar trava automática.

Cada índice tem ID, assunto, requisitos, estado/revisão, path relativo e resumo. Cada seção vigente contém links curtos para DEC/EXP pertinentes. Índice não duplica o conteúdo da nota. APR distingue registro local de revisão curada do acervo.

## Atualização revisável
1. Ler versão vigente, referências, aprovação e arquivos afetados (regras, fases, arte, som, SPECs e tarefas).
2. Criar DEC em estado `preparando`, com versão de origem, destino, aprovação, motivo, antes/depois e lista de arquivos. Copiar o conteúdo substituído para o registro ou anexo histórico; hash Git sozinho não basta para leitor sem histórico Git.
3. Para mudança não aprovada, manter DEC `proposto` e GDD vigente intacto. Para mudança aprovada, atualizar seções, referências e índice de requisitos; incrementar a versão só depois de reconciliar os arquivos.
4. Registrar tarefas/evidências afetadas como `revisao_necessaria`, preservando resultados antigos e sua versão. Não invalidar trabalho não afetado.
5. Conferir links, ausência de regras antigas como vigentes e coerência das versões. Finalizar DEC `aplicado`, com versão vigente no índice central. Essa sequência é procedimento de agente, não transação de filesystem.

## Retomada
Antes de qualquer mutação, procurar DEC `preparando`. Conferir versão central, antes/depois e cada arquivo da lista. Completar somente alterações já aprovadas ou restaurar conteúdo de origem preservado; se houver edições concorrentes, aprovação incerta ou diferença não explicada, registrar conflito e pedir decisão. Não criar outro DEC para repetir operação parcialmente aplicada. Não apagar evidência para fabricar consistência.

Uma falha de experiência é localizada: EXP registra contexto, amostra, ferramenta/versão, condições, resultado e limitações. “Não funcionou neste cenário” não significa proibição universal; novo experimento referencia o anterior e o que mudou. O template de [registro](../templates/registro.md) serve para DEC/EXP/APR com campos específicos.

## Relações e baseline
Aplicar [continuidade.md](continuidade.md) quando o projeto adotar índice de relações. Preservar baseline no DEC antes de editar. Comparar relações antigas e atuais, rever impactos diretos e transitivos em fases, UX, assets, SPEC, tarefas e evidências. Distinguir afetado confirmado, possível impacto e cobertura não avaliada. Após conferir fontes e versão, gerar candidato de índice e salvá-lo somente com reconciliação autorizada. Reconciliar índice não aprova design nem revalida evidência antiga. Falha entre escritas exige retomada pelo DEC preparando.
