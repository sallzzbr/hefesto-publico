---
name: analisar-metricas
description: Use quando o usuário pedir análise de desempenho de posts, ranking por engajamento, padrões editoriais ou aprendizados para o perfil de voz a partir do CSV de métricas.
---

# Analisar Métricas

Na primeira utilização, leia `../../RUNTIME.md` e
`../../shared/skills/analisar-metricas/CONTRATO.md`. O contrato contém o cabeçalho de 11 colunas,
fórmulas, desempates e formato do relatório. Este entrypoint e o runtime prevalecem para paths,
ferramentas e autorizações.

## Fluxo nativo

1. Resolva `local_metricas` e `local_voz`. Se o CSV não existir, informe que o workspace
   editorial não está configurado e pare sem criar estrutura.
2. Valide o cabeçalho. Liste colunas ausentes e pare antes de calcular; com apenas o cabeçalho,
   informe que ainda não há dados.
3. Recalcule `taxa_engajamento`, sinalize divergências, ranqueie e extraia padrões sustentados
   pelos dados. Não invente valores para células vazias.
4. Produza o relatório datado. Escrever o relatório ou atualizar o perfil são mutações: mostre o
   conteúdo e peça aprovação somente se ainda não estiverem autorizadas.

O CSV é somente leitura. Dados e relatórios ficam no workspace, nunca no cache do plugin. Sem
ferramenta de escrita, devolva o relatório completo na conversa.
