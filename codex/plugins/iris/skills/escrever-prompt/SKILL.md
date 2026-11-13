---
name: escrever-prompt
description: "Write or improve a prompt sized for its target model (Claude, GPT/Codex, Gemini or unknown). Use when pedir criar um prompt, melhorar ou encurtar um prompt, escrever prompt de sistema, instruções para um modelo, prompt para o Claude/Codex/ChatGPT, ou quando o prompt está longo demais."
---

# escrever-prompt

Leia [RUNTIME.md](../../RUNTIME.md) e o [contrato da skill](../../shared/skills/escrever-prompt/CONTRATO.md). As referências citadas pelo contrato estão em [shared/references](../../shared/references/principios.md); `${CLAUDE_PLUGIN_ROOT}` nelas significa `shared/`.

Destino informado não se pergunta de novo. Destino desconhecido que mude o resultado: uma pergunta curta, que encerra o turno; senão, versão portátil declarada. "Codex", "ChatGPT" ou "Claude" sem versão é família, não modelo: siga a seção correspondente de `destinos/desconhecido.md`. Entregue o prompt pronto, a configuração recomendada separada do texto só quando o destino a aceita e o cartão a sustenta (nunca para destino desconhecido), até cinco porquês citando o cartão e as incertezas. Não atribua a recomendação a um modelo não confirmado.

Ao cortar perguntas redundantes, preserve no prompt entregue a fronteira de permissões: leitura e testes locais autorizados seguem sem nova pergunta; ações destrutivas e efeitos externos exigem aprovação quando a autorização específica ainda não foi dada. Reutilize a autorização já dada na sessão; não crie aprovação a cada ação. A redução de pausas não amplia o escopo autorizado.
