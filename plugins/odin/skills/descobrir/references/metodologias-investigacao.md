# Metodologias de investigação — como levantar evidência

> Paths do workspace resolvem pela regra única em `capa-template.md`; os literais nesta
> referência são ilustrativos do default, não hardcode.

> Referência **compartilhada**: usada pela skill `descobrir` (investigar o *problema*) e pela etapa de exploração da skill `entregar` (investigar o *código* antes da spec). Carregue sob demanda.
>
> Princípio: **investigar é executar** — a IA (operário) levanta o dado; o humano (arquiteto) decide o que ele significa. Nunca peça ao humano "levantar os dados". E todo achado vale mais **triangulado**: uma fonte é indício, duas que batem é evidência.

## Como escolher o método (pela pergunta, não pela ferramenta)

| A pergunta é… | Comece por |
|---|---|
| "Alguém já mediu / já mexeu nisso?" | **Histórico próprio** (§1) — sempre primeiro |
| "Onde no funil o número sangra?" | **Produto & dados** (§2) — funil + coorte |
| "Por que este código está assim / quem mexeu / o que quebra se eu mexer?" | **Código do app** (§3) — arqueologia + dependências |
| "O que o usuário vê / qual conteúdo está no ar?" | **Conteúdo & configuração** (§4) |
| "O que o cliente reclama / como o mercado resolve?" | **Fora do app** (§5) — VOC + mercado |
| "Isto está sequer instrumentado?" | **Gaps de instrumentação** (§6) — gap é achado |

> Ferramentas MCP mudam de prefixo entre máquinas — refira-se pelo **sufixo** e carregue via `ToolSearch` se necessário. Conectores atrás de auth (analytics, banco de dados, e-commerce) podem estar desconectados na sessão — se precisar deles e não responderem, avise que o conector precisa ser autorizado; não invente o dado.

---

## §1. Histórico próprio — antes de qualquer análise

**Responde:** eu já sei disso? já medi, já tentei, decidi algo parecido antes?

- `docs/desafios/*/` do projeto — desafios anteriores: dossiês, placares, hipóteses já testadas.
- `git log` / `git log -S` — decisões passadas registradas no código.
- Notas/memória do usuário — o que ele já sabe ou já decidiu sobre o tema.
- **Sinal de qualidade:** encontrar (ou confirmar a ausência de) baseline, régua e hipóteses já testadas — ausência confirmada também é achado.

## §2. Produto & dados — onde o número sangra

**Responde:** em qual etapa/segmento/coorte o resultado se perde, e há quanto tempo.

- **Análise de funil:** liste as etapas da jornada e a conversão etapa→etapa. Corte por plataforma (iOS/Android/web), canal, segmento e coorte de entrada. Uma queda concentrada numa etapa/segmento vale mais que uma média.
  - Eventos/telemetria de produto → **ferramenta de analytics do projeto** (via MCP quando conectada).
  - Dados transacionais/coortes → **banco/warehouse do projeto** (SQL read-only via MCP ou CLI) — sem acesso na sessão, pedir export CSV citando exatamente fonte/janela/filtro/grão. Volume, recorrência, coortes de safra.
- **Análise de coorte:** compare safras (quem entrou em jan vs mar) na mesma régua — separa "mudou o produto" de "mudou o público".
- **Régua fixada (inegociável):** toda métrica citada declara **fonte + janela + filtro + grão** (a mesma transição pode medir 44% num painel e 78% noutro só por régua solta — fonte, janela, filtro e grão mudam o número). Sem régua, o número não entra no dossiê.
- **Sinal de qualidade:** consigo reproduzir o número rodando a query? Duas fontes independentes (funil + transacional) concordam?

## §3. Código do app — arqueologia e mapa de risco

**Responde:** por que o código está assim, quem mexeu por último, o que reusar, e o que quebra se eu tocar. Base da investigação técnica da skill `descobrir` e da etapa de exploração da skill `entregar`.

- **Reuso primeiro (regra ponytail P2):** `grep`/`find` por componente/hook/util/função equivalente **antes de propor código novo**. O melhor código é o que não se escreve.
- **Arqueologia git:**
  - `git log --oneline -- <path>` e `git log -S"<trecho>"` — quando e por que aquele trecho nasceu.
  - `git blame <arquivo>` — quem tocou por último a linha suspeita (contexto, não culpa).
  - `git log --follow` — história através de renomeações.
- **Mapa de dependências/acoplamento:** quem importa o módulo, quem ele importa; `knip`/`knip:diff` se existir para código morto e exports órfãos. Alto acoplamento num ponto que você vai tocar = risco de regressão a declarar.
- **Tracing de eventos:** siga um evento da UI até o backend — onde é disparado, com que payload, quem consome. Cruza com §2: o funil mede o evento que o código realmente emite?
- **Contratos / BFF / integração:** mapeie os contratos entre camadas (tipos, endpoints, schemas). Em desafio técnico, é aqui que mora a "métrica ponte": p95/p99, lead time, PRs bloqueados, dependências entre módulos/times.
- **Crash / erro em produção:** plataforma de crash/erro do projeto (via MCP quando conectada) — crash rate, issues por versão/dispositivo, breadcrumbs, regressões por release.
- **Sinal de qualidade:** sei apontar arquivo:linha do ponto que sangra e o raio de regressão de mexer nele.

## §4. Conteúdo & configuração — o que está no ar

**Responde:** qual conteúdo/configuração o usuário realmente vê, e o que uma mudança sem deploy poderia testar barato.

- **CMS/e-commerce da stack:** páginas, produtos, coleções, temas — mapeie a jornada configurada e o que já existe pronto pra reusar ou ajustar sem código.
- **Regras de segmentação/feature flags:** o que cada público vê — uma alavanca de teste barata, sem release.
- **Histórico de mudanças de conteúdo:** o que mudou, quando, por quem — correlacione com quebra de métrica do §2: uma queda pode nascer de edição de conteúdo, não de deploy.
- **Sinal de qualidade:** distingo "problema de código" de "problema de conteúdo/configuração" — muda a alavanca inteira.

## §5. Fora do app — VOC e mercado

**Responde:** o que o cliente sente e como o problema é resolvido lá fora.

- **VOC (Voice of Customer):** tickets/mensagens de suporte, reviews e avaliações públicas, NPS, comentários em redes sociais. Agrupe por tema e frequência — reclamação recorrente é hipótese com evidência.
- **Mercado/concorrência:** como concorrentes resolvem a mesma etapa; benchmarks públicos. Use `WebSearch`/`WebFetch` para o que for público.
- **Regulatório/contexto externo:** alguma mudança de regra, sazonalidade ou evento externo explica o fenômeno na janela em que ele apareceu?
- **Sinal de qualidade:** a dor do cliente (§5) bate com onde o número sangra (§2)? Convergência aponta a hipótese forte.

## §6. Gaps de instrumentação — o que NÃO está medido

**Responde:** dá pra decidir com o que existe, ou o primeiro entregável é medir?

- Percorra a jornada e marque cada etapa sem evento/log confiável. Gap de dado **é achado** — e às vezes o entregável do desafio é instrumentar antes de "otimizar" no escuro.
- Cheque discrepância entre o que o produto acha que mede e o que o código emite (cruzamento §2 × §3).
- **Sinal de qualidade:** consigo nomear os buracos de medição — e proponho fechá-los como parte do plano, não como pré-requisito ignorado.

---

## Fechamento — do levantamento ao mapa

O entregável da investigação é um **mapa do problema/código**: onde o número (ou o risco) sangra, o que explica, o que já existe pra reusar, e o que ainda é buraco. Toda afirmação carrega **evidência** (query rodada + output, arquivo:linha, ticket, print) — separando **achado** de **opinião**. É esse mapa que alimenta o GATE 1 da skill `descobrir` e a SPEC da skill `entregar`.
