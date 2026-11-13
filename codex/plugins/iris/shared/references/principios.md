---
destino: comum
aplicaA: "Base de qualquer prompt; as orientações por destino ajustam ou contrariam este núcleo"
consultadoEm: 2026-11-01
revisarAte: 2027-02-01
fontes: [A1, A2, A3, A4, A5, A7, A8, A9, A10, O1, O2, O3, O4, O6]
---

# Princípios comuns

Só entra aqui o que Anthropic e OpenAI dizem nas próprias fontes. Diferenças entre provedores
ficam nos cartões de `destinos/`; preferência sem fonte fica marcada como preferência.

## O núcleo

1. **Resultado antes do processo.** Diga o objetivo, o que conta como pronto e as restrições
   reais. Modelos atuais preenchem o caminho; passo a passo fixo só onde a ordem importa ou o
   fluxo é frágil [A1][O3].
2. **Só o que o destino não sabe.** Contexto que muda decisões (por que existe a restrição, o
   que já foi descartado, onde estão os arquivos) entra; conselho genérico, repetição e caso
   hipotético saem. Teste: o que daria errado sem esta linha? [A1][A7][O3][O6]
3. **Sem ênfase agressiva.** Caixa alta, "CRITICAL", "MUST" e "na dúvida, faça X" produzem
   excesso nos modelos atuais; linguagem absoluta fica reservada a segurança, permissão e
   correção inegociável [A1][O3][O6].
4. **Regra que não pode falhar vira mecanismo.** Hook, validador, regra de bloqueio ou restrição
   de ferramenta garantem; texto no prompt, por mais enfático, é lido e interpretado [A8][O4].
5. **Nada de instrução conflitante.** Com duas instruções contraditórias, o Claude pode seguir
   qualquer uma [A10] e o GPT-6 tende a pausar e bloquear cedo [O1]; quando prompt, skill e
   `AGENTS.md`/`CLAUDE.md` podem divergir, diga qual vence.
6. **Escopo como entregável.** Diga o que fica de fora; ambos os provedores relatam modelos que
   acrescentam o que não foi pedido ou param cedo pedindo confirmação [A3][O1].
7. **Exemplos quando formato ou tom importam**, poucos, variados e separados da instrução [A1].
8. **Configuração separada do texto.** Effort/raciocínio, verbosidade, ferramentas e limites de
   tokens são parâmetros da chamada; o texto não substitui o parâmetro [A2][O2].
9. **Mudança de prompt por evidência.** Prompt que funciona não se reescreve por estilo; edite o
   trecho ligado a uma falha observada. Os blocos por modelo dos dois provedores vêm condicionados
   ao desvio visto ("se o modelo fizer X, acrescente") [A4][A5][O2].

## Frases que costumam sobrar

Antes de entregar, procure e justifique ou corte: "pense passo a passo", "pense bem", "seja
minucioso" (o controle é effort/raciocínio) [A8][O6]; IMPORTANTE, CRÍTICO, CAIXA ALTA (excesso de
aplicação) [A1][A8]; "confira duas vezes", "inclua uma etapa final de verificação", "use um
subagente para verificar" quando o destino já verifica sozinho e tende a verificar demais (Opus 5,
e o Opus 5.5 que parte dele; GPT-6) [A2][A9][O1] — para Haiku 5.5 e Sonnet 5.5 em effort baixo
vale o contrário, peça uma checagem real antes de dar por pronto [A4][A5], e a versão portátil
mantém um critério de pronto verificável; "continue até terminar", "não seja preguiçoso" fora de agente autônomo [A8]; "na
dúvida, use X" (aciona demais) [A1]; regra repetida em mais de um lugar [O6].

## Tamanho proporcional

Não há comprimento ideal publicado por nenhum provedor. O critério operacional desta skill:

- Tarefa pontual e bem definida → poucas linhas: objetivo, entrada, formato de saída.
- Tarefa ambígua ou com decisão de produto → objetivo + critérios de pronto + restrições + o que
  ficou decidido. Perguntas abertas vão como perguntas, não como suposição.
- Agente autônomo de longa duração → acrescentar condição de parada, o que pode fazer sem
  perguntar, o que exige confirmação e como reportar. É aqui que os provedores dão blocos
  prontos por modelo (ver `destinos/`).
- Prompt reutilizável (skill, agente fixo, prompt de sistema) → cada linha é custo recorrente;
  corte mais e mova material condicional para referência carregada sob demanda [A7][O3].

Isto é heurística desta skill, não regra de fornecedor.

## O que não universalizar

- Bloco pronto de um modelo (ex.: "continue até concluir" do Haiku 5.5, "você opera
  autonomamente" do Fable 5.1, "aja sem pedir permissão" do GPT-6) resolve o desvio **daquele**
  modelo; em outro destino pode causar o desvio oposto [A1][O1].
- Tags XML são recomendação Anthropic para prompts que misturam partes; não são requisito de
  outros destinos [A1].
- "Explique o porquê" (Anthropic, para prompts) e "diga o que fazer, não narre" (Claude Code,
  para corpo de skill) não se contradizem: o porquê entra quando muda a decisão do modelo [A1][A7].
