---
name: revisar-capitulo
description: "Use antes de publicar capítulo HTML para revisar voz, personas, estrutura, navegação, acessibilidade, SEO e exercícios."
---

# revisar-capitulo

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/revisar-capitulo/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Leia HTML alvo, perfil de voz, manifesto/personas, vizinhos e styles.css. Review por padrão produz achados; não altere arquivos quando o pedido é somente leitura.
2. Verifique voz/ritmo, personas, Hook/Conceito/exemplos/mini-exercício, exercício seguro sem setup, todos os hrefs, headings/alt/aria/skip link, tabelas, SEO específico, navegação/progresso/breadcrumb e IDs/placeholders/classes.
3. Complemente com shared/scripts/corrigir_acentos.py <dir> --dry-run, remover_travessao.py <dir> --dry-run e checar_svg_overflow.py <curso>, usando venv existente. melhorar_a11y.py é transformador que escreve: só execute com pedido de correção; em revisão pura inspecione semanticamente ou teste cópia temporária autorizada.
4. Reporte nesta ordem: Bloqueadores, Melhorias recomendadas, Ajustes editoriais, Checks OK. Cada achado tem arquivo, linha ou marcador e correção concreta; liste verificações indisponíveis e risco residual. Ausência de achados não equivale a publicação aprovada.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
