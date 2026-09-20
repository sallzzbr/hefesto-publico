---
name: direcionar-comunicacao-visual
description: "Define visual communication direction. Use quando pedir linguagem visual para portfólio, apresentação de cases, banner profissional ou alinhamento entre posicionamento, texto e imagem. Não substitui voz escrita nem cria identidade fixa por inferência."
---

# Direcionar Comunicação Visual

## Input e contexto

Leia `${CLAUDE_PLUGIN_ROOT}/skills/mapear-perfil-profissional/references/carreira.md`. Receba artefato, público, objetivo e materiais existentes. A direção pode ser pessoal ou específica de uma aplicação; pergunte só se essa distinção mudar a entrega.

## Fluxo

1. Leia posicionamento, conteúdo, referências visuais acessíveis e regras do projeto. Se só houver descrição verbal, trate a proposta como hipótese visual; não alegue ter visto imagens inacessíveis.
2. Traduza o objetivo em hierarquia, densidade, tipografia, cores, uso de imagens, composição e legibilidade. Preserve o sistema existente quando o pedido for ajustar uma peça, sem impor redesign.
3. Proponha uma direção fundamentada e alternativas apenas quando houver uma decisão real em aberto. Explique o que cada escolha comunica; não deduza estética automaticamente da voz ou de características pessoais.
4. Produza uma aplicação demonstrativa quando solicitada e houver ferramenta adequada. Descubra as capacidades disponíveis; não prometa Figma, gerador ou editor ausente. Use ferramentas especializadas para produzir, respeitando autorização de custos e escopo.
5. Verifique a peça no contexto de uso: leitura, contraste, hierarquia, coerência texto/imagem e comportamento responsivo quando aplicável. Avaliação só textual não equivale a validação visual. Não extrapole teste de uma peça para identidade inteira aprovada.

## Output

Registre `visual/direcao.md` com objetivo, referências, princípios, escolhas propostas/aprovadas, aplicação e pendências. Assets/código ficam no projeto canônico. Perfil de voz e direção visual são recursos separados; a aprovação de uma direção não aprova publicação.

## Resolução de paths

Paths literais de saída são ilustrativos, relativos a `local_carreira` resolvido: CLAUDE.md do workspace (incluindo AGENTS.md importado) → defaults `local_*` do usuário → convenção descoberta no cwd → default documentado. Exatamente um candidato existente é usado; mais de um exige perguntar. Detalhes na referência canônica de carreira indicada acima; no Codex prevalece RUNTIME.md.
