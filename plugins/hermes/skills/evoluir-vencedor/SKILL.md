---
description: "Evolve a winning ad creative with controlled variations. Use when the user wants to scale or iterate a proven creative — evoluir vencedor, variações de um criativo que converte, escalar anúncio vencedor, testar variação controlada."
---

# Evoluir Vencedor

> Paths do workspace (`marketing/`, `branding/`, `contexto/`, `financeiro/`, `scripts/`) resolvem pela regra única do plugin (`criativo-fluxo/references/defaults.md`: CLAUDE.md do workspace → defaults `local_*` → convenção descoberta no cwd → default documentado); as menções nesta skill são ilustrativas do default, não hardcode.


Dado um criativo **vencedor sustentado**, propõe **3 variações controladas** — cada uma
mudando **exatamente UMA variável**. Extrai volume do que já converte sem destruir o sinal
do teste. Não chama API de ads e não produz arte: entrega hipóteses prontas pro fluxo.

## Guarda de entrada

Só evolui criativo com status `vencedor` **sustentado por ≥ 7 dias** (registro do workspace
ou confirmação do usuário com número). Criativo novo/instável → devolva "cedo demais" com o
que falta. Evoluir ruído gasta verba em cima de acaso.

## Método (3 passos)

1. **Diagnosticar por que venceu** — leia o registry do criativo (hipótese original,
   arquétipo, copy, métricas) e a narrativa de vencedoras do workspace. Nomeie o mecanismo:
   hook? identidade do segmento? oferta? formato? Sem entender o porquê, variação é chute.
   Rode aqui os 4 testes de copy na headline do pai (seção abaixo) — frase que reprova não é
   o mecanismo, e isso muda o diagnóstico.
2. **Listar variáveis evoluíveis** do arquétipo: copy da arte, imagem-base/cena, paleta,
   oferta/claim, formato (feed/story), público. O que NÃO pode mudar: o mecanismo
   diagnosticado no passo 1 (é ele que está sendo escalado).
3. **Propor 3 variações**, cada uma com: a variável única mudada (declarada), hipótese
   ("mudando X, apostamos Y porque Z"), sinal de sucesso e critério de pausa **ancorados no
   CAC alvo do unit-economics mais recente** (nunca de memória), e slug versionado
   (`v<N+1>` do mesmo tema/arquétipo, convenção do registry do workspace). Variação que muda
   copy/oferta só entra no plano com a frase nova **aprovada nos 4 testes** — declare a
   **categoria da headline** (hook ou afirmação direta) e o resultado do teste de troca do termo
   definidor junto da hipótese; em afirmação direta o teste não se aplica, e isso se registra
   explicitamente em vez de ficar em silêncio.

## A headline do pai não é herança automática

O vencedor venceu como **peça**, não como frase. No passo 1, passe a headline do pai pelos **4
testes de copy** (contrato completo em `hermes:sugerir-criativos`): (a) **troca do termo
definidor** — trocar o termo que deveria tornar a peça específica por outro do mesmo tipo
mantém a frase de pé? então ela não fala do sujeito; (b) **fala humana** — lida em voz alta,
soa traduzida ou gerada por modelo?; (c) **"e daí?"** — a frase afirma uma ideia ou só nomeia
uma categoria?; (d) **verdade comercial** — sugere produto, variação ou personalização que a
loja não oferece? (catálogo e claims do workspace **por lookup**, nunca de memória).

- **Passou** → a frase é candidata a mecanismo e pode ser herdada literalmente nas variações
  que testam outra variável.
- **Reprovou** → isso é **informação, não desculpa**. Performance não valida frase: a peça
  provavelmente vence pela imagem, pela oferta ou pela segmentação. Registre no diagnóstico do
  passo 1, **não herde a frase por inércia**, e converta em hipótese — uma das 3 variações
  passa a ser "mesma imagem, mesmo público, headline com verdade específica", que mede quanto
  da vitória era a frase.
- Rejeite (no pai e nas variações) headline que cria **cumplicidade sem verdade específica** —
  "quem tem X entende" convida pro clube e nunca diz o que o sujeito reconheceu. Copy nova sai
  de comportamento observável, situação, contradição ou característica reconhecível; nunca de
  adjetivo afetivo genérico. A lista de frases banidas é do **workspace** (camada de marca) e
  se consulta por lookup; o padrão a barrar é a fórmula que caberia em qualquer concorrente
  trocando só o nome da marca.

## Regras

- **1 variável por variação. Não 2. Sem exceção.** Duas mudanças = teste ilegível.
- Nunca reescreva a headline do pai "de leve" numa variação que testa outra coisa: ou a frase
  é a variável declarada, ou fica idêntica.
- Variação herda do pai tudo que não é a variável testada (documente `baseado_em`).
- Grave o plano em `marketing/evolucoes/vencedores/<slug-pai>-evolucao-<data>.md`.
- Próximo passo: brief da variação escolhida → `hermes:criativo-fluxo` (a rota tende a ser
  "clone estrutural do pai", e a baseline do crit é o próprio pai).
- Português BR.
