---
name: otimizar-verba
description: "Use para comparar eficiência de campanhas, propor realocação de verba e avaliar pacing mensal."
---

# otimizar-verba

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/otimizar-verba/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Leia CAC/ROAS alvo do unit-economics mais recente e cite arquivo/mês. Colete mês atual por campanha em modo leitura. Boost identificado por objetivo/optimization_goal fica fora do score e médias, com gasto real em linha própria.
2. Calcule score=(CAC alvo/CPA real)×100; variante ROAS=(ROAS real/ROAS alvo)×100 quando aplicável. >100 escalar; 80–100 manter; 60–79 reduzir; <60 candidata a pausa. Sem denominador/dado não fabrique score.
3. Aplique guardas antes de recomendar: <7 dias desde edição OU <50 eventos é learning; escala exige ≥10 conversões; mínimo default R$50, senão dados insuficientes. Incrementos R$5 ou 10%, maior deles; corte nunca >50% de uma vez.
4. Pacing esperado=(verba mensal/dias do mês)×dias decorridos; <80% ou >120% exige causa e ajuste. Plano de realocação explicita de onde→para onde→quanto→por quê, aritmética e itens protegidos por learning.
5. Compare anúncio em conjunto compatível antes de criar conjunto (novo exige ≥2 anúncios). Grave inteligencia/budget-optimizer/<data>.md, sinalize registry ausente. Apenas recomenda, nunca aplica verba.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
