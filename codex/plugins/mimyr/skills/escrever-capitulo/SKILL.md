---
name: escrever-capitulo
description: "Use para criar ou reescrever página HTML de capítulo de curso com estrutura, voz e personas já definidas."
---

# escrever-capitulo

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/escrever-capitulo/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Confirme templates/subpage.html e diretório do curso resolvidos; faltando, pare. Leia perfil-de-voz.md, personas.md do curso, perfis, styles.css e capítulo vizinho. Descubra bragir:escrever-como-antonio; indisponível bloqueia a etapa que exige essa dependência, sem fingir execução.
2. Fixe módulo, slug, posição X/Y, navegação, objetivo, fontes e profundidade. Escreva Hook → Conceito (afirmação, expansão, exemplo) → analogia concreta → cross-ref útil → mini-exercício seguro sem instalação. Capítulo conceitual pode ter 2–3 checagens em details/summary antes da navegação, zero JS.
3. Preserve shell canônico, seções semânticas e classes reais. Use você/pessoal, nunca aluno/estudante; traduza jargão na primeira ocorrência. Tempo = ceil(palavras/200); progresso = X/Y. Voz e restrições das personas calibram exemplos.
4. Grave modulo-N/<slug>.html no curso e confira hrefs relativos, anterior/próximo, placeholders e exercício. SVG modificado exige shared/scripts/checar_svg_overflow.py com fontes reais e Python do workspace, sem estimativa por caracteres.
5. Entregue arquivo, links checados, tempo e escolhas de persona. Não publique.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
