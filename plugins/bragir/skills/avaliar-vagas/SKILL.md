---
name: avaliar-vagas
description: "Evaluate job fit. Use quando pedir para encontrar vagas compatíveis, comparar oportunidades ou avaliar aderência de uma vaga ao perfil profissional. Não aciona para escrever posts ou avaliar candidatos de recrutamento."
---

# Avaliar Vagas

## Input e contexto

Leia `${CLAUDE_PLUGIN_ROOT}/skills/mapear-perfil-profissional/references/carreira.md`. Receba uma vaga ou critérios de busca e o perfil/evidências disponíveis. Não descarte a vaga por faltar um cadastro completo.

## Fluxo

1. Para busca, confirme apenas critérios ausentes que mudam a seleção: função, localização/modalidade, senioridade e restrições. Pesquise com ferramenta disponível, priorizando a página da empresa ou ATS oficial; registre URL e data consultada. Sem busca disponível, analise vagas fornecidas e declare cobertura limitada.
2. Para vaga fornecida, leia seu conteúdo. Se a URL estiver inacessível, peça o texto ou avalie apenas o trecho disponível; não complete requisitos de memória. Estado aberto/encerrado fica não verificado se a fonte não permitir confirmar. Deduplicate empresa + id da vaga ou URL canônica, preservando origens.
3. Separe requisitos obrigatórios, desejáveis e ambiguidades. Compare cada um com evidência: `atende | parcial | lacuna | não verificado`, origem e implicação. Lacuna é ausência confirmada de competência/requisito; falta de evidência é não verificado.
4. Distinga liderança de projeto de gestão de pessoas. Não sugira inflar cargo, duração, resultados ou experiência para passar filtro. Não estime chance de contratação nem use pontuação opaca como decisão.
5. Entregue recomendação `priorizar | investigar | não priorizar` com motivos, critérios eliminatórios confirmados e perguntas úteis. O usuário decide candidatar-se; diferenças negociáveis não viram veto automático.

## Output

Salve avaliação em `oportunidades/<id>.md`, com empresa, função, id/URL, data da consulta, estado da vaga, matriz de aderência e próximo passo. Reuse o id existente; em colisão, confirme identidade antes de atualizar. Busca não envia candidaturas. Para preparar materiais da oportunidade escolhida, use `bragir:preparar-candidatura`.

## Resolução de paths

Paths literais de saída são ilustrativos, relativos a `local_carreira` resolvido: CLAUDE.md do workspace (incluindo AGENTS.md importado) → defaults `local_*` do usuário → convenção descoberta no cwd → default documentado. Exatamente um candidato existente é usado; mais de um exige perguntar. Detalhes na referência canônica de carreira indicada acima; no Codex prevalece RUNTIME.md.
