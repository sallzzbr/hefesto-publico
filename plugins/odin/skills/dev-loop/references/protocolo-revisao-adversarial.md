# Protocolo de revisão adversarial (etapa 6 do dev-loop)

> Carregue este arquivo ao montar a revisão. A quantidade de passadas e o nível vêm
> do Plano de custo/rigor aprovado: Econômico usa 1 passada se houver risco relevante;
> Balanceado 1–2; Máximo 2–3 — sempre **sequenciais: 1 revisor Opus (effort high) por
> vez, NUNCA revisores em paralelo** (arquiteto roda sozinho). Revisar é julgar → é
> papel de **arquiteto** (Opus), nunca do operário que implementou. Cada passada é
> cega: o revisor não vê a conclusão das anteriores.

## As lentes (prompts)

Escolha as lentes conforme risco e perfil — **uma lente por passada, um revisor por vez** (R1 + R2 + R3 no Máximo = três passadas sequenciais, nunca três agentes juntos):

- **Econômico:** R1 é obrigatória quando houver revisão; adicionar R2 ou R3 só se o risco justificar.
- **Balanceado:** R1 + a lente mais relevante ao risco dominante.
- **Máximo:** R1 + R2 + R3.

| Revisor | Lente | Instrução |
|---------|-------|-----------|
| R1 | **Corretude vs spec** | "Tente REFUTAR que esta implementação satisfaz os critérios A1..An. Procure o caso de entrada/estado que quebra cada critério. Verifique também se a implementação OVERFITOU nos testes (passa no teste mas não satisfaz o critério — ex.: hardcode do valor esperado) e se os testes realmente cobrem os critérios. Cite arquivo:linha." |
| R2 | **Segurança & bordas** | "Tente quebrar: fronteiras de confiança, null/undefined, race conditions, estados de erro, perda de dados, a11y. Cite arquivo:linha." |
| R3 | **Ponytail & arquitetura** | "Procure código que não deveria existir: reuso ignorado (prove com o grep), abstração desnecessária, dependência nova injustificada, complexidade ciclomática, violação dos padrões do projeto. Cite arquivo:linha." |

## Regras

- Revisor é instruído que **na dúvida, reporta** — o filtro vem depois.
- **Verificação de findings:** finding sem `arquivo:linha` ou sem cenário concreto de falha é
  descartado. Finding plausível é CONFIRMADO pelo orquestrador (ou um 4º agente)
  reproduzindo/lendo o código antes de virar retrabalho — revisão adversarial sem verificação
  gera loop infinito de falso-positivo.
- Finding de R3 sobre "código demais" tem o mesmo peso que bug: código desnecessário É defeito
  neste protocolo.
- Revisor que aprova tudo em rodada 1 de uma mudança grande é suspeito: orquestrador confere se
  ele realmente leu o diff (pede evidência de leitura).
- Cada revisor recebe: a spec inteira, o diff consolidado e as convenções do projeto. Nunca a
  conclusão das passadas anteriores — a independência vem dessa cegueira, não da simultaneidade.
