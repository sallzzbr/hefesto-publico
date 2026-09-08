---
name: validar-criativo
description: "Use para validar render de anúncio com preflight, crítica adversarial de acabamento e testes pós-render de ideia."
---

# validar-criativo

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/validar-criativo/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Colete render, brief, rota, copy e baseline/mockup aplicáveis; obrigatório ausente bloqueia. Leia o contrato integral A–Q. Não altere render, copy ou registry canônico.
2. Execute Python do venv com scripts/validar_criativo.py do workspace, formato/arquétipo e texto/baseline reais. Capture exit/JSON; erro operacional não é aprovação. Valide banda central 1:1, margens do produto e checks bloqueantes.
3. Com subagentes autorizados, revisor isolado do produtor abre imagens e julga A–J (arquétipo, rosto, regras da marca, baseline, estampa, naturalidade, texto, thumbnail, mensagem, voz) E K–Q (3s, miniatura, desfoque, exclusão, coerência, verdade comercial, headline nos quatro testes). Plausível exige confirmação independente. Sem revisor disponível/autorizado, registre revisão independente pendente e não declare PASS completo.
4. Qualquer bloqueante confirmado é FAIL, nunca borderline. PASS precisa dizer em uma frase a ideia comunicada em 3s. Acabamento impecável/ideia vazia reprova. Ação: overlay/copy/IA conforme causa; furo de ideia que não resolve por headline/composição volta à rota/brief.
5. Grave SEMPRE <slug>__validacao_iterN.md e append _validacoes.csv com header slug,iteracao,veredito,criterios_falhos,criado_em. Revisor falho/lixo é FAIL com revisão manual necessária. Alteração futura de critério exige calibração com defeitos conhecidos e caso impecável sem ideia.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
