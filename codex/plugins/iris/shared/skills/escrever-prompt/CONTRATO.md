---
name: escrever-prompt
description: "Write or improve a prompt sized for its target model (Claude, GPT/Codex, Gemini or unknown). Use when pedir criar um prompt, melhorar ou encurtar um prompt, escrever prompt de sistema, instruções para um modelo, prompt para o Claude/Codex/ChatGPT, ou quando o prompt está longo demais."
argument-hint: "[modelo de destino] [objetivo ou prompt atual]"
---

# Escrever prompt

Produz um prompt pronto para colar no modelo de destino, com o nível de detalhe que a tarefa
pede — nem mais, nem menos. Para brief de subagente, definição de agente ou passagem de bastão
entre sessões, use `iris:delegar-agente`.

## Input

- **Objetivo** — o que o prompt deve fazer o modelo produzir, e para quem.
- **Destino** — modelo ou superfície (ex.: Claude Opus, Sonnet, Haiku, Fable; GPT-6; Codex;
  ChatGPT; API; prompt de sistema de produto). Se o usuário já disse, **não pergunte de novo**.
- **Prompt atual**, quando é melhoria.
- **Contexto** que o destino terá ou não terá (arquivos, histórico, ferramentas).

## Antes de escrever

1. **Destino.** Informado → use. Não informado → pergunte uma vez, com o porquê, só se mudar o
   resultado (agente autônomo, prompt de produção, configuração a recomendar); senão escreva a
   versão portátil e diga isso. Informado só pela família ou superfície ("Codex", "Claude") ou
   para mais de um destino → seção própria de
   `${CLAUDE_PLUGIN_ROOT}/references/destinos/desconhecido.md`, que tem as demais regras.
2. **Leia** `${CLAUDE_PLUGIN_ROOT}/references/principios.md` e o cartão do destino em
   `${CLAUDE_PLUGIN_ROOT}/references/destinos/` (`claude.md`, `openai.md`, `gemini.md`).
3. **Data.** Se hoje passou do `revisarAte` do cartão, avise que a orientação pode estar
   desatualizada e diga a data da consulta.
4. **Lacunas reais.** Falta algo que só o usuário sabe e que muda o prompt (critério de pronto,
   público, restrição)? Uma pergunta por vez, com o porquê. O que der para inferir, infira e
   declare como suposição.

## Escrever

- Comece pelo resultado esperado e pelo critério de pronto; depois contexto que o destino não
  tem; depois restrições reais e formato de saída.
- Cada linha responde "o que daria errado sem ela?". Sem resposta → corte.
- Restrição não óbvia leva o porquê em meia frase.
- Sem caixa alta, "MUST", "CRITICAL" ou "na dúvida, faça X"; absoluto só para segurança,
  permissão e correção inegociável.
- Exemplos só se formato ou tom importam: poucos, variados, marcados como exemplo.
- Ajustes do cartão do destino só para o desvio que aquele modelo tem; não cole bloco pronto
  de um modelo em outro.
- Effort/raciocínio, verbosidade e ferramentas vão em **Configuração recomendada**, fora do texto.
- Antes de entregar, passe o checklist "Frases que costumam sobrar" de `principios.md`.
- Melhoria de prompt existente: preserve o que funciona; mude o trecho ligado ao problema
  relatado e diga o que cortou e por quê.

Ao cortar perguntas redundantes, preserve no prompt entregue a fronteira de permissões: leitura e testes locais autorizados seguem sem nova pergunta; ações destrutivas e efeitos externos exigem aprovação quando a autorização específica ainda não foi dada. Reutilize a autorização já dada na sessão; não crie aprovação a cada ação. A redução de pausas não amplia o escopo autorizado.

## Output

1. O prompt, num bloco de código, pronto para colar.
2. **Configuração recomendada** — só quando o destino aceita (API, frontmatter de agente) e o
   cartão sustenta a recomendação.
3. **Por que assim** — até 5 itens curtos ligando escolhas a orientações (cite o cartão).
   Na melhoria: tamanho antes → depois e o que saiu.
4. **Incertezas** — destino não confirmado, cartão vencido, orientação inexistente para o caso,
   suposições feitas.

## Important

- Não invente regra de modelo: o que não está nos cartões é heurística e deve ser dito como tal.
- Exemplos e dados do prompt são do usuário; nada deste plugin contém dados de projetos reais.
- Pedido de "prompt" que é na verdade delegação a agente → `iris:delegar-agente`.

## Exemplo sintético

Pedido: "melhora esse prompt pro Haiku, ele para no meio" (prompt de agente com 120 linhas).
Saída: prompt com 45 linhas — removidos avisos repetidos e caixa alta, mantidos critérios de
pronto; acrescentada a linha do cartão Claude para Haiku 5.5 sobre continuar até concluir.
Configuração: subir effort de `low` para `medium` se a parada continuar (cartão Claude, A5).
Incerteza: efeito medido pelo fornecedor, não neste agente.
