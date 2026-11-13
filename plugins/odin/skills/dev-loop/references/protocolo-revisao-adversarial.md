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
| R3 | **Ponytail & arquitetura** | "Procure código que não deveria existir: reuso ignorado (prove com o grep), abstração desnecessária, dependência nova injustificada, responsabilidades misturadas, decomposição inadequada, violação dos padrões do projeto. Cite arquivo:linha." |

## Regras

- Revisor é instruído que **na dúvida, reporta** — o filtro vem depois.
- **Verificação de findings:** finding sem `arquivo:linha` ou sem cenário concreto de falha é
  descartado. Finding plausível é CONFIRMADO pelo orquestrador (ou um 4º agente)
  reproduzindo/lendo o código antes de virar retrabalho — revisão adversarial sem verificação
  gera loop infinito de falso-positivo.
- **Afirmação mecânica se confere, não se presume.** "Uso único", "nenhum chamador", "já existe
  em X", "a mudança só afeta Y" são fatos contáveis: o finding cita a busca executada nos
  chamadores reais (comando e resultado, incluindo testes, reexports e imports dinâmicos; com
  `git grep -n -w --untracked <nome> -- .`, porque arquivo novo fora do índice também chama) e o
  confirmador reconta antes de virar retrabalho ou bloqueio. Contagem que não bate refuta o
  fato alegado. A contagem não decide a qualidade: interface de uso único pode proteger
  fronteira e testabilidade; explique o defeito concreto da abstração para propor mudança.
- R3 avalia necessidade, responsabilidade e manutenção; poucas linhas/arquivos não provam
  simplicidade. Use `quality-contract.md` e perfis selecionados em toda lente. Receba o
  contrato aprovado com recorte da unidade, convenções e `decomposition`, além da SPEC/diff.
- A auditoria já existente cobre cada check em `qualityReview`, confrontando `qualityInventory`
  e `qualityExecutions` literais, incluindo outputs, com os alvos aprovados de cada check.
  Citar arquivo alheio inventariado não cobre o alvo; a exceção da SPEC exige medição textual
  e linha existente. Exit não zero com relato completo é resultado, não falha estrutural:
  se funcional, volta à correção; se ambiental, preserva parada operacional.
  Arquivo tocado >400 linhas exige decisão explícita;
  não recomende divisão cega nem refatoração geral. Evidência incompleta impede verde,
  issue semântico é confirmado antes de retrabalho. P10 aceita fonte durável verificável
  em SPEC/plano/ADR/PR acessível; comentários de processo não são obrigatórios.
- Revisor que aprova tudo em rodada 1 de uma mudança grande é suspeito: orquestrador confere se
  ele realmente leu o diff (pede evidência de leitura).
- Cada revisor recebe: a spec inteira, o diff consolidado e as convenções do projeto. Nunca a
  conclusão das passadas anteriores — a independência vem dessa cegueira, não da simultaneidade.
