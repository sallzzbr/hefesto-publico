---
name: gerar-modulo
description: "Use para criar ou reorganizar módulo de curso, índice e capítulos a partir de fontes e diagnósticos existentes."
---

# gerar-modulo

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/gerar-modulo/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Exija templates resolvidos; leia module-index.html, subpage.html, styles.css, módulos existentes e diagnósticos. Confirme curso, número/título, escopo, fontes, voz e personas. Bragir fornece voz final e perfis ausentes quando disponível.
2. Defina lista de capítulos antes de prosa: um learning job por capítulo, leitura de 4–8 min, pré-requisitos e exclusões do diagnóstico atual, sem copiar currículo de outro curso.
3. Crie modulo-N/index.html pelo template e capítulos via escrever-capitulo. Encadeie navegação entre módulos e dentro do módulo. Redirect legado é opcional e nunca conteúdo canônico.
4. Depois de criar/remover/reordenar capítulos, execute shared/scripts/injetar_sidebar.py e atualizar_indice_curso.py com Python do workspace; preserve aria-current, contagem e tempos. Dependência ausente bloqueia o passo, sem instalar silenciosamente.
5. Confira arquivos e links. Relate índice, capítulos, redirect, lacunas e encaminhe revisar-capitulo. Sem publicação automática.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
