---
name: auditoria-cro
description: "Use para auditar conversão de site de e-commerce próprio ou concorrente, desktop e mobile, com evidência visual."
---

# auditoria-cro

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/auditoria-cro/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Confirme alvo e colete screenshots desktop/mobile de home, categoria, PDP e carrinho com ferramentas disponíveis; abra imagens. Leia copy literal e meça performance mobile via ferramenta real (PSI/lighthouse quando disponível). Sem captura/medição, declare lacuna.
2. Aplique os dez itens fixos: above the fold em 3s, oferta, âncora de frete, prova social real, fricção contada, voz/benefício, mobile, PSI mobile ≥50 como régua do contrato, produto em ≤2 cliques e PDP completa.
3. Cada status exige screenshot ou trecho citado. No site próprio, faça lookup de economia/funil para impacto. Priorize P1/P2/P3 por impacto×esforço, sem atribuir perda medida onde só há hipótese.
4. Separe CONFIGURÁVEL de TRAVADO na plataforma. Concorrente vira hipótese para testar, sem copiar arte/copy.
5. Grave inteligencia/site-auditorias/<data>-<alvo>.md com evidência/correção/esforço e limitações. Respeite política local de screenshots fora do git; não altere o site.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
