---
name: revisar-naturalidade
description: "Review editorial drafts. Use when o usuário pedir para revisar a naturalidade, deixar mais humano, tirar cara de IA, evitar texto genérico ou preservar a própria voz em artigos, posts e outras comunicações."
---

# Revisar naturalidade

Revisar é preservar o raciocínio do autor e melhorar sua expressão. Naturalidade depende do
contexto e da voz; não é uma pontuação nem prova de autoria humana.

## Input

Receba o rascunho, objetivo, canal e público. Use o contexto já informado; pergunte apenas pelo
que muda a revisão. Sem rascunho, peça o texto. Pedido de diagnóstico entrega só diagnóstico.

## Antes de revisar

Resolva `local_voz` pela mesma cadeia declarada em `escrever-como-antonio`: configuração do
workspace, defaults do usuário, convenção descoberta e fallback documentado. Os paths são
resolvidos, nunca hardcoded. Leia a seção de resolução daquela skill, sem executar o escritor.
Use um único perfil preenchido; não mescle perfis. Instruções explícitas desta entrega prevalecem.

Sem perfil do autor, informe em uma frase: a revisão trata de clareza e naturalidade, sem
calibração autoral. Não atribua o fallback do Antonio a outro autor. Se ele for o autor e o
fallback for usado, anuncie esse uso. Persona calibra público, não substitui voz.

Identifique tese, fatos, opiniões, hipóteses e limites da entrega. Em compartilhamentos,
separe a legenda autoral do texto de terceiros. Um rascunho assistido por IA não é, por si só,
amostra comprovada da voz do autor.

## Fluxo

1. Leia o texto inteiro. Localize problemas reais de ritmo, clareza e voz: repetição,
   abstração sem explicação, promessa vaga, transição pronta, ressalva que quebra o argumento
   ou cadência uniforme. Julgue pelo efeito na leitura, não por palavras isoladas.
2. Faça a menor revisão útil. Desenvolva a ligação entre ideias e preserve as escolhas
   expressivas do autor. Listas, termos técnicos, paralelismos e frases breves podem funcionar.
   Não imponha gíria, metáfora, humor, emoção, erro ou pergunta de engajamento.
3. Confira o sentido contra o original e as fontes fornecidas. Preserve pessoa, acontecimento,
   resultado e grau de certeza. Não acrescente diálogos, experiências, métricas ou referências
   não sustentadas. Opinião continua opinião; proposta não vira resultado. Regra documentada
   não vira restrição aplicada no código. Lacuna factual pede confirmação, não preenchimento.
4. Se já funciona, conserve o texto e diga que não houve alteração necessária. Não use
   volume de mudanças como medida de qualidade.

## Output

Entregue a versão no formato e extensão pedidos, seguida de até três justificativas relevantes,
com trecho literal quando ajudar a localizar o problema. Informe lacunas factuais separadamente.
Se o usuário pedir somente o texto, omita as justificativas, mantendo o aviso de falta de
calibração autoral quando aplicável. Não crie nota de humanidade, garantia de alcance nem
promessa de passar por detector de IA.

## Exemplo fictício

Original: "Documentei a regra, mas não conferi se o código a aplica."
Revisão possível: "A regra está documentada. Falta conferir se o código a aplica."
"O código garante a regra" alteraria o fato e reprova a revisão.

## Limites

Edite arquivo apenas no escopo autorizado; sem autorização de escrita, entregue em conversa.
Perfis, amostras e correções pertencem ao workspace, nunca ao plugin ou ao cache.
Não publique, atualize o perfil nem registre memória automaticamente. A revisão não chama
`escrever-como-antonio` de volta e não se apresenta como revisão independente.
