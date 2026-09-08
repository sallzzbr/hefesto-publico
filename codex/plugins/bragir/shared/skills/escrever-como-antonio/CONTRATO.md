---
name: escrever-como-antonio
description: "Write content in Antonio Salgado's authentic voice — blog posts, artigos, emails, copy de social media, newsletters, roteiros. Use sempre que o usuário pedir texto 'na minha voz', 'como o Antonio escreve', ou quiser manter consistência com o perfil de voz (perfil-de-voz.md). Descobre personas do projeto atual para calibrar audiência (Camila, Rafael, ou qualquer persona local em ./personas/)."
---

# Escrever como Antonio

Generate content in Antonio Salgado's authentic voice, calibrated for the target audience.

## Before writing

1. Resolver o perfil de voz (resolução única do bragir), na seguinte ordem de prioridade:
   - **a.** campo `local_voz` na seção `## Paths do workspace` do `CLAUDE.md` do projeto, se declarado (path de um perfil específico).
   - **b.** campo `local_voz` nos defaults do usuário (`~/.claude/bragir/defaults.md`).
   - **c.** convenção descoberta no cwd, nesta ordem: `./perfil-de-voz.md`, `./voz/perfil-de-voz.md`, `./voice-profile.md` legado. Se for o legado, use-o e ofereça renomear — nunca renomeie sem confirmação.
   - **d.** default documentado `${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md` (voz default do Antonio).

   Use o primeiro que existir **com conteúdo real**. Um perfil que seja só scaffold — placeholders
   (`<!-- ... -->`), instruções "Preencha..." ou seções vazias — conta como **AUSENTE**: avise em
   uma linha que o arquivo está em branco e siga para o próximo nível da cadeia (é o que salva um
   workspace recém-scaffoldado de escrever com perfil vazio). Se houver mais de um preenchido, o
   mais prioritário sobrescreve. Não mescle — o local é a verdade do projeto. Sempre há um perfil
   disponível (o fallback do plugin nunca falta), então a skill não trava por ausência de perfil.
   Os paths citados nos exemplos desta skill são ilustrativos do default, não hardcode.

   **Transparência:** se cair no default (d) — por ausência OU por scaffold vazio nos níveis anteriores — avise o usuário em uma linha que o texto usará a voz default do Antonio (do plugin), não um perfil específico deste projeto. Assim ele decide se vale rodar `analisar-voz` no projeto antes de gerar conteúdo em escala.
2. Descobrir personas no projeto atual (cwd):
   - Se o `CLAUDE.md` do workspace declarar `local_personas` na seção `## Paths do workspace`, use esse diretório.
   - Senão, consulte `local_personas` nos defaults do usuário (`~/.claude/bragir/defaults.md`).
   - Senão, aplique a convenção descoberta no cwd: `./personas/` (diretório) e depois `./personas.md` (arquivo único).
   - Senão, nenhuma persona está configurada neste projeto.

## Regra de composição

O perfil resolvido no passo 1 é a única fonte de regras de voz. Leia-o por inteiro antes de
escrever e aplique ao texto inteiro seu tom, registro, vocabulário, ritmo, estrutura, aberturas,
fechamentos, recursos retóricos e proibições. Não complete um perfil local com hábitos do perfil
default do Antonio e não preserve bordões, limites de parágrafo, analogias, idioma, pontuação ou
formato que o perfil selecionado não peça.

A persona resolvida calibra a audiência: conhecimento prévio, necessidades, objeções, exemplos e
o que evitar. Ela não troca a voz escolhida. Se uma instrução explícita do usuário conflitar com o
perfil ou a persona, a instrução do usuário para esta entrega prevalece; mantenha o restante do
perfil e diga em uma linha qual ajuste foi pedido.

## Adapting for audience

Se o usuário especificou uma audiência:

1. Procure a persona correspondente nos arquivos descobertos acima (match por nome ou pelo descritor — ex.: "pesquisadora com medo de tecnologia" casa com `camila.md`).
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

Write the requested content no formato, extensão, idioma e canal pedidos pelo usuário, sempre sob
o perfil e a audiência resolvidos. Quando algum desses elementos não vier no pedido, use primeiro
o que estiver definido no perfil selecionado. Se ainda faltar algo necessário, faça a menor
suposição compatível com o tipo de entrega e deixe-a explícita antes do texto.

Always ask if the user wants ajustes antes de considerar finalizado.
