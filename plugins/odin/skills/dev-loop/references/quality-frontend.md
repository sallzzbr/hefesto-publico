# Perfil frontend

Acrescente `frontend` ao perfil `base` de `quality-contract.md` quando tocar UI; combine com
`typescript` quando necessário. Preserve framework e convenções existentes, sem biblioteca nova.

| ID | Aplicação e evidência |
|---|---|
| FE-STATE | Defina fonte única do estado, derivados e transições de loading/empty/error/success. Não duplique estado calculável; teste transições observáveis e preservação de entrada do usuário. |
| FE-EFFECTS | Efeito sincroniza fronteira externa; cálculo puro fica fora dele. Defina dependências, limpeza e resposta obsoleta; teste troca rápida e desmontagem quando pertinentes. |
| FE-ACCESSIBILITY | Use semântica nativa, rótulo, foco, teclado e anúncio de estado. Confira o fluxo real por teclado e tecnologia/validação disponível; screenshot sozinho não prova acessibilidade. |

Exemplo sintético: numa busca, uma resposta antiga não pode substituir a consulta atual;
a mensagem de erro permite tentar novamente e mantém foco previsível. FE-EFFECTS sem efeito
externo admite dispensa motivada; a ausência de teste disponível vira limitação explícita.
