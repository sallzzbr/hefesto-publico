# Avaliação sintética do contrato de qualidade

`cases.json` contém oito casos inteiramente sintéticos: defeito e controle de fronteiras,
comentários, decomposição e testes. Cada caso liga prompt e arquivos ao ID da regra,
status esperado e justificativa independente. A tabela de protocolo acima de 400 linhas
é um controle de coesão: tamanho exige decisão, não divisão automática.

## Aplicação

Entregue a um revisor independente somente `prompt` e `files` de um caso, junto da referência
quality-contract.md. Preserve `expected` fora desse contexto até receber status, localização,
cenário e justificativa. Compare depois com o oráculo, registrando caso, modelo/executor,
data, resposta observada, concordância ou divergência e limitações. Execute os oito casos;
não use o mesmo agente que escreveu a implementação para confirmar a própria conclusão.
Não copie código de projetos privados para ampliar o corpus.

`node --test plugins/odin/tests/quality-evals.test.mjs` verifica formato e cobertura do corpus.
Esse teste não executa avaliações com modelos e não prova a qualidade semântica deles.
Resultados de aplicação pertencem ao relatório da entrega, com evidência do executor real;
a presença deste corpus não significa que uma avaliação comportamental já ocorreu.

## Limitações e roadmap

O conjunto é pequeno, não estima taxa universal de acerto nem substitui pilotos de projetos.
Canary, memória/aprendizados e decision model permanecem adiados no roadmap; nenhum deles
é implementado por este corpus. Comparativos amplos de modelos são trabalho futuro.
