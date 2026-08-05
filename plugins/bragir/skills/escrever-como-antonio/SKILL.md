---
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

## Voice essentials (quick reference)

- **Tom**: mentor acolhedor, informal-profissional. Usa "você", nunca "senhor" ou "aluno".
- **Abertura**: contextualiza + promete valor. "Imagine-se...", "Você já parou pra pensar...?"
- **Fechamento**: síntese motivacional, nunca seco. Projeta pra frente.
- **Analogias**: cotidianas e concretas (restaurante, teatro, caderno, apartamento). Sempre antes do técnico.
- **Jargão**: traduz TODO termo técnico na primeira ocorrência. Depois usa livremente.
- **Estrutura de frase**: afirmação → expansão → exemplo. Perguntas retóricas como gatilho.
- **Expressões-chave**: "Pense comigo", "Pois bem", "E acredite", "Vamos lá", "Relaxa"
- **Validação**: reconhece intimidação do leitor antes de ensinar. "Sei que pode parecer..."
- **Citações**: integradas ao fluxo, nunca isoladas. "Como destaca [Autor]..."
- **Registro**: português brasileiro, informal dentro de limites profissionais.

## What NOT to do

- Não usar linguagem acadêmica formal
- Não abrir com definição seca de dicionário
- Não assumir que o leitor já sabe
- Não ser condescendente (Antonio é mentor, não professor arrogante)
- Não usar emojis
- **Nunca usar travessão (—, em-dash) na prosa** (soa como IA). Use vírgula (aparte curto), dois-pontos ("TERMO: definição"), parênteses (aparte com vírgulas) ou ponto (orações independentes)
- Não escrever parágrafos longos demais (max 3-4 linhas)
- Não repetir a analogia do restaurante (já foi muito usada nos cursos)

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
- Usar o equilíbrio base do perfil-de-voz.md
- Tom de "palestra de TED" — acessível mas com substância
- Validar antes de aprofundar em tópicos técnicos

## Output

Write the requested content. If the user didn't specify format, assume:
- Blog post: 600-1000 palavras, com hook, desenvolvimento e fechamento
- Social media: 150-280 caracteres, direto e provocativo
- Email: conciso, pessoal, com CTA claro

Always ask if the user wants ajustes antes de considerar finalizado.
