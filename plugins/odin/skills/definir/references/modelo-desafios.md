# Modelo de desafios — referência

O porquê por trás do Odin: por que conduzir problemas, e não tarefas.

## Definições

**Desafio** — problema assumido por alguém com skill suficiente para levar até o resultado, de
ponta a ponta, buscando apoio quando necessário sem transformar apoio em handoff. O dono do
desafio responde pelo resultado mesmo que outras pessoas (ou IAs) contribuam.

**Tarefa** — unidade de execução com entrega pré-definida. Tarefas existem DENTRO de desafios
(cada uma testando uma hipótese); o anti-padrão é conduzir o desafio inteiro como se fosse uma
tarefa.

**Desafio técnico habilitador** — problema técnico assumido de ponta a ponta quando arquitetura,
plataforma, refactor, observabilidade, performance ou design system precisam destravar resultado.
A solução técnica é hipótese/alavanca, não ponto de partida. Exige placar técnico com régua
fixada e métrica ponte com impacto de produto/negócio/aprendizado.

**Priorização AI-era** — quando construir é barato com IA, esforço deixa de dizer sozinho o que
construir. No DEVELOP, alavancas são julgadas primeiro por valor de aprendizado e
reversibilidade; esforço/custo dimensiona a aposta e o perfil de execução.

**Eficácia vs eficiência** — eficiência é produtividade (já alta com IA). Eficácia é fazer
aquilo que de fato precisa ser feito, com profundidade. O risco da era da IA: alta eficiência
com baixa eficácia — resolver rápido os problemas errados.

## Comportamento esperado num desafio

1. **Entender o problema** (com IA) — contexto, evidência, indicadores de sucesso definidos
2. **Avançar com IA** — analisar dados, prototipar, simular; chegar com algo rodando, não com
   documento pedindo esforço
3. **Acionar o apoio certo** — co-validação com quem precisa validar, não handoff
4. **Integrar até o resultado** — funcionando ponta a ponta, com os indicadores evoluindo

## Estágios de evolução com IA

- **Estágio 1** — IA como assistente individual. *É aqui que mora o anti-padrão: a pessoa
  delega a SUA tarefa pra IA e ninguém olha o problema.*
- **Estágio 2** — humano direcionando IA (o modelo deste plugin). *Humano arquiteta o problema;
  IA executa a análise e a construção.*
- **Estágio 3** — humano como operador/supervisor de IA autônoma.

O Odin existe para operar no Estágio 2.

## Padrão-ouro de formalização (exemplo)

Um desafio bem formalizado numa loja online ficaria assim:

- **Problema:** a conversão Carrinho→Compra caiu de 3,1% para 2,4% nas últimas 6 semanas —
  clientes montam o carrinho e abandonam no frete.
- **Placar com régua fixada:** fonte = analytics da loja, painel de funil; janela = semanal,
  últimas 12 semanas; filtro = tráfego orgânico + pago, excluindo testes internos; grão =
  sessão com carrinho criado. (Sem régua fixada, a mesma transição pode medir 2,4% num corte
  e 4% noutro — o placar tem que ser incontestável.)
- **Alvo com tradução de impacto:** 2,4% → 3,0% ≈ +40 pedidos/mês no volume atual.
- **Hipóteses H1..H3:** frete caro aparece tarde demais (H1); checkout pede cadastro antes de
  mostrar o total (H2); tempo de carregamento da etapa de pagamento subiu na última release
  (H3) — cada uma com a evidência que a sustenta e a forma de teste.
- **Gaps de instrumentação como entregável:** a etapa de frete não emite evento — instrumentar
  virou entrega do desafio.
- **Ownership ponta a ponta:** o dono valida com quem precisa (ex.: quem opera a logística),
  sem transformar em handoff.

## Responsabilidade

Erros da IA são responsabilidade do humano. "Foi a IA que errou" não é justificativa. Quem não
valida e não testa, assume o risco.
