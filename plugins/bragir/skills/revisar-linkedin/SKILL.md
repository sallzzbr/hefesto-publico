---
name: revisar-linkedin
description: "Review LinkedIn positioning. Use quando pedir para reescrever headline, Sobre, experiências ou destaques do LinkedIn, ou retomar uma revisão anterior do perfil profissional. Não pressupõe publicação nem vaga ativa."
---

# Revisar LinkedIn

## Input e contexto

Leia `${CLAUDE_PLUGIN_ROOT}/skills/mapear-perfil-profissional/references/carreira.md`. Consulte o perfil atual fornecido/acessível, proposta anterior, objetivos e evidências. Não faça o usuário recomeçar pelo currículo quando a seção e o problema já estiverem claros.

## Fluxo

1. Identifique separadamente texto atualmente publicado, último aprovado e rascunho mais recente. Se o exercício anterior não foi localizado, diga isso e preserve a pendência; não o reconstrua como se tivesse sido recuperado.
2. Combine objetivo e público: papel pretendido, competências comprovadas e exemplos. Vaga é contexto opcional. Distingua posicionamento profissional estável de linguagem específica de uma candidatura.
3. Revise somente as seções pedidas; quando a revisão for geral, priorize headline, Sobre, experiências e destaques. Use `bragir:escrever-como-antonio` para a prosa, respeitando o perfil de voz e idioma escolhidos, sem jargão ou números inventados.
4. Entregue texto pronto para copiar e breve justificativa das mudanças relevantes. Marque afirmações sem base fora do texto publicável, como pendências. Não prometa melhora de ranking ou resultado de algoritmo.
5. Só editar a plataforma quando essa ação estiver solicitada e houver acesso. Confira o texto no destino após editar; acesso ausente deixa o rascunho pronto, não aplicado. Não envie mensagens ou pedidos de conexão como parte da revisão.

## Output

Grave versão nova em `linkedin/<data>-<versao>.md` com status, seções, fontes e relação com a versão anterior; não sobrescreva aprovações. Atualize o estado com qual versão foi proposta/aprovada/aplicada e a evidência correspondente. Se duas versões conflitarem, preserve ambas e destaque a decisão pendente.

## Resolução de paths

Paths literais de saída são ilustrativos, relativos a `local_carreira` resolvido: CLAUDE.md do workspace (incluindo AGENTS.md importado) → defaults `local_*` do usuário → convenção descoberta no cwd → default documentado. Exatamente um candidato existente é usado; mais de um exige perguntar. Detalhes na referência canônica de carreira indicada acima; no Codex prevalece RUNTIME.md.
