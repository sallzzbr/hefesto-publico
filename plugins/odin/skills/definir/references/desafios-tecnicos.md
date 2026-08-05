# Desafios técnicos habilitadores

Use esta referência quando o pedido vier como arquitetura, BFF, refactor, plataforma, observabilidade, performance, dívida técnica, design system ou qualquer melhoria técnica que prometa destravar resultado.

## Regra central

Não procure métricas para justificar uma solução já escolhida. Trate a solução técnica como hipótese e pergunte:

> Qual problema observável esta solução resolve melhor que alternativas menores?

Um desafio técnico só passa pelo portão quando tem:

1. **Problema técnico observável** — acoplamento, lentidão, fragilidade, incidentes, retrabalho, baixa cadência de experimento.
2. **Placar técnico com régua fixada** — fonte, janela, filtro e grão.
3. **Métrica ponte de negócio/produto** — por que esse placar técnico importa para conversão, retenção, receita, NPS, custo operacional ou velocidade de aprendizado.
4. **Hipóteses testáveis** — como a mudança técnica moveria o placar.
5. **Alternativas menores consideradas** — ponytail também vale para arquitetura; se a decisão for difícil de reverter, prototipe/pilote antes.

## Placar técnico: exemplos

| Tema | Métrica possível | Fonte/régua | Ponte de negócio |
|---|---|---|---|
| Lead time | dias de idea-to-prod por jornada | tracker/GitHub, últimos 90 dias, entregas da jornada | mais ciclos de teste por mês |
| Confiabilidade | incidentes por contrato de API | incident tracker, por mês, jornada afetada | menos queda de conversão/NPS |
| Performance | p95/p99 até renderizar oferta | observabilidade, por versão/plataforma | menos abandono no funil |
| Manutenibilidade | regras duplicadas no app/backend | grep/code search, por domínio | menos retrabalho e bug escapado |
| Experimentação | experimentos bloqueados por release mobile | roadmap/feature flags, por trimestre | aprendizado mais rápido |
| Design system | divergências de componente em produção | auditoria de UI, por componente/tela | consistência + menor custo de manutenção |

## Exemplo: BFF no app

Pedido inicial:

> "Implementar arquitetura BFF no app."

Reformulação possível:

> "Mudanças em jornadas mobile críticas dependem de coordenação app+backend e release mobile, gerando lead time alto, bugs de contrato e baixa velocidade de experimento."

Placar:

- **KPI primário:** lead time de alteração em jornadas mobile críticas.
- **Régua:** tracker + GitHub, entregas com label `mobile-jornada`, últimos 90 dias, grão por entrega.
- **Baseline:** 12 dias medianos de pedido aprovado até produção.
- **Alvo:** 5 dias.
- **Métrica ponte:** dobrar ciclos de teste de hipótese por mês em jornadas de oferta/contratação.

Hipóteses:

- H1: centralizar composição no BFF reduz dependência de release mobile para regras de oferta.
- H2: contrato por jornada reduz bugs de integração app/backend.
- H3: payload dedicado reduz p95 de renderização em telas críticas.

Alavancas concorrentes:

- BFF por jornada crítica.
- Contract tests sem BFF.
- Adapter fino no backend existente.
- Feature flags/config remota.
- Refatorar endpoints genéricos atuais.
- Instrumentar primeiro para medir gargalo real.

Na matriz de priorização AI-era (`../../desenvolver/references/priorizacao-ai-era.md`), BFF completo tende a ser alto aprendizado mas difícil reversão; normalmente deve passar por piloto, fake backend, feature flag ou uma jornada crítica antes de virar arquitetura padrão.

## Contraexemplos ruins

- "Vamos fazer BFF porque é boa prática." — autoridade, não evidência.
- "Refatorar para ficar mais limpo." — subjetivo, sem placar.
- "Criar design system novo." — solução pronta; primeiro medir divergência, custo e impacto.
- "Melhorar performance." — direção válida, mas sem fonte/janela/grão ainda não é placar.

## Perguntas de arquiteto

1. Qual dor observável existe hoje, com exemplo real?
2. Quem perde tempo, receita, confiabilidade ou aprendizado por causa disso?
3. Qual número mostraria que a dor melhorou?
4. Qual baseline temos agora?
5. Qual alternativa menor pode resolver antes de criar uma camada/arquitetura nova?
6. Como saberemos que a solução técnica não apenas mudou a complexidade de lugar?
