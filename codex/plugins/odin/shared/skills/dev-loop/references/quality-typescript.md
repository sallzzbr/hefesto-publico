# Perfil TypeScript

Acrescente `typescript` ao perfil `base` de `quality-contract.md` quando tocar TypeScript.
Preencha os três checks no contrato antes da implementação; use a configuração do projeto.

| ID | Aplicação e evidência |
|---|---|
| TS-TYPES | Modele estados válidos, restrinja `unknown` na fronteira e evite `any`/casts que escondem erro. Interfaces mínimas do consumidor são legítimas mesmo com uso único. Confira contratos públicos e casos inválidos; não reescreva todos os tipos do legado. |
| TS-IMPORTS | Preserve limites de módulos e separação de tipo/valor conforme configuração existente; evite ciclo e dependência em detalhe interno. Confira caminhos e imports reais, inclusive reexports. |
| TS-ASYNC | Explicite await, propagação de rejeição, concorrência e cancelamento quando houver async. Teste falha e ordem relevante; nenhuma promise pode ser ignorada por acidente. |

Exemplo sintético: validar `unknown` recebido de uma API antes de construir `Receipt`, em vez
de usar `as Receipt`. Rode typecheck existente quando autorizado, sem instalar ferramenta.
TS-ASYNC sem fluxo assíncrono pode ser not-applicable com motivo e alvos na SPEC.
