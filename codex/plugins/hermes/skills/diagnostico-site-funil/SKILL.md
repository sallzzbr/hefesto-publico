---
name: diagnostico-site-funil
description: "Use para distinguir problema de site, anúncio ou destino cruzando comportamento GA4, custo Meta, registry e ledger."
---

# diagnostico-site-funil

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/diagnostico-site-funil/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Fixe janela igual entre GA4/Meta (default 28 dias). Localize coletor GA4 do workspace, conta, registry e ledger; sem coletor, pare a parte GA4 e declare o que falta. Nenhuma escrita em APIs.
2. Explique atribuições distintas: GA4 mede comportamento e Meta custo; compras não reconciliam 1:1. Colete canais/landing/funil/produtos e valide anúncios ativos nos três níveis.
3. Cruze id→tipo_destino/URL pelo registry sem chutar backfill. Tabela por destino: gasto/CTR/sessões/views/ATC/checkouts/compras GA4/ATC por sessão/compra por ATC. Compare histórico; sem ele, médias do período rotuladas.
4. Sempre inclua AOV: itens/pedido, combos, frete visível e impacto com unit-economics citado. Veredito SITE / ANÚNCIO / DESTINO / INCONCLUSIVO exige número e gasto suficiente (default R$50).
5. Grave inteligencia/site-funil/<data>.md append-only com fontes, tabela, AOV, pendências e recomendações. Recomendações relevantes ganham trilha local no registry; nenhuma mudança no destino real.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
