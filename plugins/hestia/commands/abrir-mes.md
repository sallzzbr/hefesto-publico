---
description: Abre o mês do orçamento doméstico — lança recorrências em lote com uma confirmação do efeito completo, journal e reconciliação após falhas.
argument-hint: "[mês opcional AAAA-MM] ex.: 2026-08 (padrão: mês atual)"
---

Abrir o mês do orçamento doméstico usando a skill `orcamento`.

Mês (opcional, padrão = mês atual): $ARGUMENTS

Use a skill `orcamento`, fluxo "Abrir o mês (recorrências em lote)", e siga integralmente sua
referência canônica
`${CLAUDE_PLUGIN_ROOT}/skills/orcamento/references/abertura-mes-segura.md`.

Não reproduza nem simplifique o protocolo neste command. A referência governa seleção e itens
pulados, confirmação única do efeito completo, journal, efeitos no livro e nas parcelas,
releituras, resultados incertos, conflitos e retomada. Se `recorrencias.csv` não existir, ofereça
cadastrar recorrências primeiro com `/hestia:recorrencias`, como o fluxo determina.
