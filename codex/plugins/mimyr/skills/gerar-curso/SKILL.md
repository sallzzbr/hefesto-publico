---
name: gerar-curso
description: "Use para iniciar, reestruturar ou gerar curso completo a partir de material acadêmico, fontes, personas e templates."
---

# gerar-curso

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/gerar-curso/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Resolva paths e valide templates, perfil-de-voz.md local, manifesto/personas, Bragir disponível e venv do workspace. Sem voz não gere prosa; fonte em vídeo exige ffmpeg e ambiente de transcrição separado. Não instale dependências por conta própria.
2. Inventarie docx/vídeo/transcrições e reutilize diagnósticos válidos; analise-de-aula cobre lacunas. Confirme título/slug, público, jornada e restrições. Estrutura é trabalho de arquitetura pedagógica com ferramentas Codex reais.
3. Antes da prosa, autore estrutura.md com id/título/arquivo disjunto, um objetivo, critérios verificáveis, pré-requisitos, não cobre, tom, personas e fontes por capítulo. Arquivo existente exige reescrever: true autorizado. Status: aprovada só após OK humano.
4. Crie uma vez shells compartilhados (índice do curso/módulos, personas, seo.json, styles.css) fora dos escritores. Não copie currículo de outro curso. Recomende perfil Econômico/Balanceado/Máximo com 1/2/3 lentes e máximo 4 escritores simultâneos; piso = 1 + iterações × (capítulos + lentes + 1), confirmações à parte. Reaproveite opt-in já dado.
5. Leia [execução nativa](references/execucao.md), monte workspaceRoot absoluto, cursoDir e demais args reais e use bridge. Critérios/estrutura são portão bloqueante; escritor só toca seu capítulo; checks por iteração, confirmação de achados e teto 3 não são opcionais.
6. Pós-verde: sidebar/índice/SEO, correções autorizadas de acento/travessão/a11y, links e SVG. Use scripts de shared/scripts; GA4/analytics/cookie-consent e deploy são do workspace, com prefixo próprio /<curso>/, nunca o piloto por engano.
7. Persista relatorio-geracao.md no curso com critérios/findings/iterações por capítulo, modelo real ou desconhecido, recusas e lacunas de revisão. Sem commit/deploy automático; bloqueio ou escala não é curso pronto.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
