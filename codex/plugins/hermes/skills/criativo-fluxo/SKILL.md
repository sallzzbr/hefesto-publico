---
name: criativo-fluxo
description: "Use para produzir criativo de anúncio de ponta a ponta, com aprovação de ideia, escolha visual de rota e validação."
---

# criativo-fluxo

Na primeira utilização, leia [RUNTIME.md](../../RUNTIME.md). Antes de executar este fluxo, leia o [contrato de domínio completo](../../shared/skills/criativo-fluxo/CONTRATO.md), incluindo os gates e formatos aplicáveis; abra as referências de domínio sob demanda. Os caminhos relativos no contrato são relativos à sua localização em shared, conforme RUNTIME. A instrução nativa deste arquivo e o RUNTIME governam ferramentas, paths, autorização e identidade de execução: referências históricas não autorizam chamadas de plataforma antigas, aliases de modelos ou configuração pessoal legada.

## Fluxo Codex

1. Resolva bases de marketing/branding/contexto/scripts e venv. Rode shared/scripts/verificar_workspace.py em leitura com todos os paths reais; JSON inválido, missing ou exit≠0 bloqueia antes de gasto. Leia contrato do workspace mínimo: scripts/credenciais/geração vêm do workspace, não do plugin.
2. Portão 1 é texto puro antes de QUALQUER imagem: objetivo, estágio, observação humana, headline nos quatro testes, produto, hierarquia, esboço textual e justificativa de elementos. Leia portao-de-ideia.md. Só OK humano permite aprovada_em na ficha __ideia.md; consolide os oito campos no brief que o controlador lerá.
3. Recomende perfil econômico/balanceado/máximo (2/3/3 rotas; 2/3/4 candidatos), estime agentes e chamadas de imagem, confirme orçamento/opt-in existentes. Texto nunca usa API de imagem. Rough/produção: uma tentativa por comando, sem repetição automática após falha ou resposta incerta; preserve parciais e reconcilie antes de nova decisão humana e orçamento. Leia [execução nativa](references/execucao.md) e inicie estágio rotas por bridge com dirs completos.
4. Resultado aguardando-rota exige abrir e apresentar roughs reais, ligados à ideia. Portão 2: humano escolhe VENDO; só então grave rota_aprovada e aprovada_em e inicie novo run produzir. Ficha não aprova visual; rough não aprova ideia.
5. Seleção é do validador, nunca produtor; overlay IA mantém {{BASE}} para substituição pelo controlador. Preflight e crítica A–Q a cada iteração, confirmação de achados, teto 3 iterações/rodadas. Overlay recompõe sem geração; correção inócua escala. Falha operacional/revisor ausente não vira verde.
6. Apresente pacote, render, grid, rationale/copy e findings. Registry aprovado somente após OK humano final. Aprendizado só vira regra com casos/variância, variantes e contraexemplo, senão OBSERVAÇÃO. Reports são persistidos inclusive em escalados com histórico. Subida é playbook do workspace e autorização própria; nunca publicar Meta/commitar automaticamente.

## Dependências e saída

Resolva inputs e destinos pelo RUNTIME: pedido explícito, AGENTS.md do workspace, defaults Codex do plugin, descoberta inequívoca, default do domínio. Artefatos pertencem ao workspace, nunca ao cache do pacote. Reutilize autorizações da sessão; dúvida necessária é uma pergunta curta após consultar as fontes existentes. Sem ferramenta/conector/dependência real, informe o passo bloqueado e a evidência faltante, sem inventar resultados ou instalar silenciosamente. O relatório distingue executado, proposto, bloqueado e não verificado, com paths e fontes reais.
