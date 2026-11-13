---
name: analise-de-aula
description: "Use para analisar aula, docx e transcrição e diagnosticar adequação pedagógica antes de gerar conteúdo de curso."
---

# analise-de-aula

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/analise-de-aula/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Resolva curso, fontes docx/transcrição e materiais de apoio. Leia tudo antes do diagnóstico; preserve timestamps úteis. Leia manifesto de personas do curso e perfis referidos, mais diagnósticos existentes.
2. Fonte bruta: extract_docx.py é standalone; extrair_audio.py exige ffmpeg; transcrever.py exige ambiente de transcrição/Whisper. Use scripts em shared/scripts com Python do workspace; não instale nada por inferência. Personas ausentes: encaminhe bragir:gerenciar-personas quando disponível ou declare a limitação/manifesto pendente.
3. Avalie objetivos mensuráveis para 5–7 min, coerência docx↔vídeo, desatualização, pré-requisitos/jargão, melhorias, personas e mapeamento de microcapítulos.
4. Escreva no diretório de diagnósticos resolvido <slug-da-unidade>.md com Resumo, Evidências usadas, as sete dimensões e três recomendações prioritárias. Separe fonte e recomendação; cite trechos curtos e timestamps, sem inventar conteúdo.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
