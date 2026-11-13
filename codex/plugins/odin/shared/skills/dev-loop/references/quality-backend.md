# Perfil backend

Acrescente `backend` ao perfil `base` de `quality-contract.md` quando tocar servidor ou
persistência. Planeje limites e falhas antes de implementar; mantenha a arquitetura do projeto.

| ID | Aplicação e evidência |
|---|---|
| BE-BOUNDARIES | Valide entrada, autorização e saída na fronteira correta; domínio recebe contrato mínimo. Teste entrada hostil e acesso negado sem vazamento de segredo; transporte não define regra de negócio. |
| BE-CONSISTENCY | Declare invariantes, atomicidade, concorrência e idempotência onde exigidas pelo fluxo. Teste falha parcial, repetição e disputa; não acrescente transação ou retry sem necessidade. |
| BE-MIGRATIONS | Para mudança persistida, planeje compatibilidade entre versões, migração, recuperação e verificação dos dados. Execute ensaio autorizado em fixture; nunca use dado real nem aplique migração por implicação do checklist. |

Exemplo sintético: repetir a mesma solicitação de reserva não pode debitar duas vezes quando
o contrato exige idempotência. BE-MIGRATIONS sem mudança de esquema/dados pode ser
not-applicable com justificativa; não instalar banco ou biblioteca para cumprir o perfil.
