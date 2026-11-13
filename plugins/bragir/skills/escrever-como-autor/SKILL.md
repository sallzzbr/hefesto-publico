---
name: escrever-como-autor
description: "Write content in the author's voice. Use when o usuário pedir texto na minha voz, artigo, post, email ou roteiro consistente com seu perfil de voz e com personas do projeto."
---

# Escrever como autor

Escreva com o perfil preenchido do autor, calibrado para a audiência do projeto.

## Before writing

1. Resolver o perfil de voz (resolução única do bragir), na seguinte ordem de prioridade:
   - **a.** campo `local_voz` na seção `## Paths do workspace` do `CLAUDE.md` do projeto, se declarado (path de um perfil específico).
   - **b.** campo `local_voz` nos defaults do usuário (`~/.claude/bragir/defaults.md`).
   - **c.** convenção descoberta no cwd, sem prioridade entre os nomes: `./perfil-de-voz.md`, `./voz/perfil-de-voz.md`, `./voice-profile.md` legado. Se for o legado, use-o e ofereça renomear — nunca renomeie sem confirmação.
   - **d.** default documentado: o perfil pessoal `~/.claude/bragir/perfil-de-voz.md`, fora do plugin, onde `analisar-voz` grava quando nenhum nível anterior existe. Vale sem registro nos defaults.

   Respeite a prioridade entre os níveis **a**, **b**, **c** e **d**, usando conteúdo real; no nível **c**, resolva concorrência pela regra abaixo. Um perfil que seja só scaffold — placeholders
   (`<!-- ... -->`), instruções "Preencha..." ou seções vazias — conta como **AUSENTE**: avise em
   uma linha que o arquivo está em branco e siga para o próximo nível da cadeia (é o que salva um
   workspace recém-scaffoldado de escrever com perfil vazio). Dois perfis preenchidos no mesmo nível de descoberta não se resolvem pela ordem dos nomes. Não mescle — o local é a verdade do projeto. Sem perfil preenchido, pare antes de escrever na voz do autor e ofereça `bragir:analisar-voz` com amostras fornecidas pelo usuário.
   Os paths citados nos exemplos desta skill são ilustrativos do default, não hardcode.

   O pacote não distribui perfil de voz. Scaffold vazio não permite inventar voz nem usar voz de outra pessoa.
2. Descobrir personas no projeto atual (cwd):
   - Se o `CLAUDE.md` do workspace declarar `local_personas` na seção `## Paths do workspace`, use esse diretório.
   - Senão, consulte `local_personas` nos defaults do usuário (`~/.claude/bragir/defaults.md`).
   - Senão, aplique a convenção descoberta no cwd: `./personas/` (diretório) e depois `./personas.md` (arquivo único).
   - Senão, nenhuma persona está configurada neste projeto.

## Regra de composição

O perfil resolvido no passo 1 é a única fonte de regras de voz. Leia-o por inteiro antes de
escrever e aplique ao texto inteiro seu tom, registro, vocabulário, ritmo, estrutura, aberturas,
fechamentos, recursos retóricos e proibições. Não complete um perfil local com hábitos do perfil
de outra pessoa e não preserve bordões, limites de parágrafo, analogias, idioma, pontuação ou
formato que o perfil selecionado não peça.

A persona resolvida calibra a audiência: conhecimento prévio, necessidades, objeções, exemplos e
o que evitar. Ela não troca a voz escolhida. Se uma instrução explícita do usuário conflitar com o
perfil ou a persona, a instrução do usuário para esta entrega prevalece; mantenha o restante do
perfil e diga em uma linha qual ajuste foi pedido.

## Adapting for audience

Se o usuário especificou uma audiência:

1. Procure a persona correspondente nos arquivos descobertos acima (match por nome ou pelo descritor — ex.: "pesquisadora com medo de tecnologia" casa com `persona-pesquisa.md`).
2. Se encontrou: leia o `.md` da persona e calibre tom, gatilhos e o que evitar conforme os marcadores listados.
3. Se NÃO encontrou nenhuma persona adequada:
   - Avise o usuário: "Não achei uma persona pra essa audiência neste projeto."
   - Ofereça criar agora — ao aceitar, invoque a skill `gerenciar-personas` passando o
     descritor desejado; ela resolverá o destino e cuidará do scaffolding.
   - Se o usuário recusar, use o fallback genérico abaixo.

### Fallback: público geral

Sem persona adequada, escreva para o público descrito no pedido. Se o pedido também não definir
público, use apenas as indicações de audiência presentes no perfil selecionado; se ele não trouxer
nenhuma, escreva para uma pessoa adulta sem conhecimento especializado, sem acrescentar uma voz,
um formato ou uma metáfora por conta própria.

## Output

Antes de entregar artigos e posts, aplique `bragir:revisar-naturalidade` ao rascunho com o
perfil já resolvido, as fontes e as restrições do pedido. É uma revisão do mesmo texto, não
uma segunda geração: preserve tese, fatos, opinião e incertezas. Na entrega normal, mostre o
texto final; justificativas de revisão entram quando solicitadas. A skill revisora não chama
este escritor de volta. Não alegue revisão independente quando for o mesmo agente.

Write the requested content no formato, extensão, idioma e canal pedidos pelo usuário, sempre sob
o perfil e a audiência resolvidos. Quando algum desses elementos não vier no pedido, use primeiro
o que estiver definido no perfil selecionado. Se ainda faltar algo necessário, faça a menor
suposição compatível com o tipo de entrega e deixe-a explícita antes do texto.

Always ask if the user wants ajustes antes de considerar finalizado.

## Escolha entre perfis locais

Configuração explícita de `local_voz` mantém prioridade sobre a descoberta local; pedido explícito do dono prevalece. Não perguntar por concorrência em níveis inferiores quando o perfil já foi resolvido por um nível superior. Se nenhum perfil de leitura tiver sido resolvido por configuração explícita (inclusive quando ela aponta para scaffold vazio), e houver dois ou mais perfis locais preenchidos entre `./perfil-de-voz.md`, `./voz/perfil-de-voz.md` e `./voice-profile.md`, liste os caminhos e pergunte qual perfil usar; encerre o turno e aguarde. Não escolher pelo nome, ordem da lista, data ou tamanho, nem mesclar conteúdo. Um único perfil local preenchido resolve a leitura; scaffold vazio não conta como perfil de leitura.

Reaproveite a escolha na mesma sessão e no mesmo workspace, inclusive ao passar entre analisar-voz, escrever-como-autor e revisar-naturalidade, sem repetir a pergunta. Reconfira o path: se sumiu, se o workspace mudou, se há nova configuração explícita ou se o dono pediu outra voz, resolva novamente pelos dados atuais. Não grave essa preferência em defaults ou configuração sem pedido explícito. Não mescle perfis nem sobrescreva o não escolhido.

Escolher o perfil não autoriza sobrescrever seu arquivo. Em analisar-voz, continue mostrando destino e pedindo OK antes de sobrescrever. Scaffold existente continua candidato de destino para escrita: se houver múltiplos destinos e nenhuma escolha prévia que resolva, pergunte qual preencher. Uma escolha já dada de perfil resolve o destino correspondente; não substitua silenciosamente o perfil escolhido por um scaffold. A diferença entre leitura e destino de escrita não altera a prioridade da configuração explícita.
