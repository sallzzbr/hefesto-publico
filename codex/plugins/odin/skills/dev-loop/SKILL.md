---
name: dev-loop
description: "Use com SPEC ou plano aprovado para implementação de software em loop, revisão independente e perfis de rigor."
---

# dev-loop

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/dev-loop/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Confirme SPEC aprovada, critérios executáveis, prontidão, unidades disjuntas e branch de trabalho fora da principal. Trabalho novo sem SPEC volta a entregar; plano aprovado pode ser formalizado com o dono. SPEC-lite não entra.
2. Leia spec-template.md, escada-ponytail.md (P1–P18) e protocolo-revisao-adversarial.md do domínio. Recomende perfil Econômico/Balanceado/Máximo: 1/2/3 lentes, unidades sequenciais no econômico, máximo 4 operários simultâneos nos demais. Piso de chamadas: 3 + iterações × (unidades + lentes + 2); consultas e confirmações aumentam o piso. Reaproveite opt-in multiagentes já concedido.
3. Leia [execução nativa](references/execucao.md), monte args reais e opere o bridge até concluir. Ele preserva TDD vermelho confirmado por execução independente, hashes reais dos testes, auditoria ponytail e revisão adversarial antes de verde.
4. Teto de 3 iterações e 2 consultas por unidade/iteração. Consultas de arquitetura ficam serializadas; mudança de SPEC escala. Dependência sem justificativa e teste alterado são bloqueantes automáticos. Revisão/auditoria/confirmador ausente é erro, nunca ausência de finding.
5. Grave resultado, evidências, bloco ponytail completo, revisões e executor/modelo real no Log da entrega ou Relatório dev-loop da SPEC avulsa. Pendências fora do escopo têm destino próprio. Concluído no bridge não significa verde no domínio; trate bloqueado/escalado/erro. Retorne a entregar Step 8, sem commit automático.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
