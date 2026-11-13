---
destino: desconhecido
aplicaA: "Destino não informado, indisponível ou sem cartão nesta versão"
consultadoEm: 2026-11-01
revisarAte: 2027-02-01
fontes: [A1, O1, O3]
---

# Destino desconhecido

Quando não se sabe qual modelo vai receber o prompt, a regra é **não fingir que sabe**.

## Quando perguntar

Pergunte o destino uma vez, dizendo por quê, só se a resposta muda o resultado de verdade:

- prompt de agente autônomo ou de longa duração (cada família tem desvios opostos: uns param
  cedo, outros fazem demais);
- prompt de produção que vai rodar muitas vezes;
- quando há configuração a recomendar (effort/raciocínio, ferramentas).

Para pedido pontual, não pergunte: escreva a versão portátil e diga que é portátil.

## Versão portátil

Use só o núcleo de `../principios.md` (resultado, contexto necessário, restrições reais,
formato de saída, escopo) e evite:

- blocos prontos de um modelo específico;
- ênfase agressiva e linguagem absoluta fora de segurança/permissão;
- dependência de sintaxe de um produto (tags especiais, nomes de ferramenta, `$skill`,
  `/comando`) sem dizer que é daquele produto;
- recomendações de configuração (effort, raciocínio) — não há como acertar sem o destino.

## Destino só pela família, pela superfície ou mais de um

"Codex", "ChatGPT", "Claude" e "API" dizem a família, não o modelo, e os cartões têm linhas por
modelo que se contradizem (Haiku × Sonnet em effort alto; GPT-5.x × GPT-6). Use o que vale para a
família inteira e declare isso. Se a versão muda o prompt e ele é de agente autônomo ou de
produção, uma pergunta curta pela versão é permitida: ela refina o destino informado, não repete
a pergunta. Prompt para mais de um destino (ex.: skill publicada para Claude e Codex) → versão
portátil, com ajuste de família só onde os dois não se contradizem.

## O que dizer ao usuário

Uma linha: "Escrevi a versão portátil porque o destino não foi informado; se for <exemplos>,
há ajustes específicos." Nunca atribua a recomendação a um modelo que não foi confirmado.

## Destino informado, mas sem cartão

Se o usuário nomeou um modelo que não tem cartão aqui (outro provedor, modelo local, versão
mais nova), use a versão portátil, diga que não há orientação específica verificada nesta
versão do plugin e, se houver acesso à documentação oficial desse provedor, consulte-a e cite a
fonte e a data — sem transformar a consulta em regra permanente do plugin.
