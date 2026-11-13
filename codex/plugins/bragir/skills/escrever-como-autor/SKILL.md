---
name: escrever-como-autor
description: Use quando o usuário pedir conteúdo na própria voz, consistente com um perfil-de-voz.md, com possível calibração para personas locais.
---

# Escrever como autor

Na primeira utilização, leia `../../RUNTIME.md` e
`../../shared/skills/escrever-como-autor/CONTRATO.md`. Este entrypoint e o runtime prevalecem
para paths, ferramentas e autorização.

## Fluxo nativo

1. Resolva `local_voz` nesta ordem: `local_voz` no `AGENTS.md` do workspace; `local_voz` nos
   defaults Codex (`<CODEX_HOME>/hefesto/bragir/defaults.md` com `CODEX_HOME` definido e não vazio; senão `~/.codex/hefesto/bragir/defaults.md`); perfil no workspace
   (`./perfil-de-voz.md`, `./voz/perfil-de-voz.md`, legado `./voice-profile.md`); e, como default
   documentado, o perfil pessoal `<CODEX_HOME>/hefesto/bragir/perfil-de-voz.md` (com `CODEX_HOME` definido e não vazio; senão `~/.codex/hefesto/bragir/perfil-de-voz.md`), que vale sem registro
   nos defaults. Com `CODEX_HOME` explícito, arquivo ausente ali não autoriza fallback para `~/.codex`. Ignore scaffold vazio. Respeite a prioridade entre níveis; dentro da descoberta local, resolva concorrência pela regra abaixo. Leia o perfil escolhido por inteiro e não mescle perfis.
2. Sem perfil preenchido, pare antes de escrever na voz do autor e ofereça `bragir:analisar-voz` com amostras do usuário. O pacote não distribui perfil de voz. Scaffold vazio não é perfil.
3. Resolva personas no workspace. A persona calibra conhecimento, objeções e exemplos; ela não
   substitui a voz. Sem persona compatível, anuncie a ausência e use a audiência do pedido ou
   perfil.
4. Aplique a voz ao texto inteiro. Exceção explícita do usuário prevalece nesta entrega;
   declare o ajuste e preserve o restante do perfil.
5. Antes de entregar artigos e posts, aplique `bragir:revisar-naturalidade` com o perfil e
   as fontes já resolvidos. Preserve tese, fatos, opiniões e incertezas; não gere um segundo
   texto nem alegue revisão independente. A revisão não chama este escritor de volta.
6. Entregue no formato, idioma, canal e extensão pedidos. Declare qualquer suposição necessária.

Personas e perfis ficam no workspace ou path pessoal configurado, nunca no cache. Para criar uma
persona, use `gerenciar-personas`.

## Escolha entre perfis locais

Configuração explícita de `local_voz` mantém prioridade sobre a descoberta local; pedido explícito do dono prevalece. Não perguntar por concorrência em níveis inferiores quando o perfil já foi resolvido por um nível superior. Se nenhum perfil de leitura tiver sido resolvido por configuração explícita (inclusive quando ela aponta para scaffold vazio), e houver dois ou mais perfis locais preenchidos entre `./perfil-de-voz.md`, `./voz/perfil-de-voz.md` e `./voice-profile.md`, liste os caminhos e pergunte qual perfil usar; encerre o turno e aguarde. Não escolher pelo nome, ordem da lista, data ou tamanho, nem mesclar conteúdo. Um único perfil local preenchido resolve a leitura; scaffold vazio não conta como perfil de leitura.

Reaproveite a escolha na mesma sessão e no mesmo workspace, inclusive ao passar entre analisar-voz, escrever-como-autor e revisar-naturalidade, sem repetir a pergunta. Reconfira o path: se sumiu, se o workspace mudou, se há nova configuração explícita ou se o dono pediu outra voz, resolva novamente pelos dados atuais. Não grave essa preferência em defaults ou configuração sem pedido explícito. Não mescle perfis nem sobrescreva o não escolhido.

Escolher o perfil não autoriza sobrescrever seu arquivo. Em analisar-voz, continue mostrando destino e pedindo OK antes de sobrescrever. Scaffold existente continua candidato de destino para escrita: se houver múltiplos destinos e nenhuma escolha prévia que resolva, pergunte qual preencher. Uma escolha já dada de perfil resolve o destino correspondente; não substitua silenciosamente o perfil escolhido por um scaffold. A diferença entre leitura e destino de escrita não altera a prioridade da configuração explícita.
