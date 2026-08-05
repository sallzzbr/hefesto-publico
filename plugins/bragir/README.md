# Bragir

> Paths de workspace citados neste README resolvem pela regra única do plugin
> (`skills/analisar-metricas/SKILL.md` e `skills/gerenciar-personas/SKILL.md`: CLAUDE.md do
> workspace → defaults `local_*` do usuário → convenção descoberta no cwd → default
> documentado); os literais abaixo são ilustrativos do default, não hardcode.

> Plugin de voz, escrita e editorial. O nome vem de Bragi, o deus nórdico da poesia e da eloquência — aqui moram as skills que escrevem na voz do Antonio, calibram para cada audiência e operam o ciclo editorial de um workspace de conteúdo.

Até a v2.x do marketplace, as skills de voz viviam no plugin `hefesto`. Migraram para cá quando o hefesto virou a forja de plugins. As skills editoriais (`planejar-agenda`, `analisar-metricas`) nasceram como comandos do workspace bragir e foram promovidas ao plugin.

## Skills

| Skill | O que faz |
|---|---|
| `escrever-como-antonio` | Escreve na voz do Antonio. Resolve o perfil na ordem `local_voz` (CLAUDE.md do workspace) → `./perfil-de-voz.md` (projeto) → `./voz/perfil-de-voz.md` (workspace de conteúdo) → `./voice-profile.md` (nome legado, só leitura) → `${CLAUDE_PLUGIN_ROOT}/perfil-de-voz.md` (default Antonio). Perfil só-scaffold (placeholders) conta como ausente. Descobre personas em `./personas/`. |
| `analisar-voz` | Analisa documentos de um autor e gera `./perfil-de-voz.md` no projeto consumidor (default). Pode atualizar o perfil default do plugin se pedido explicitamente. Requer a skill oficial `docx` para arquivos `.docx`. |
| `gerenciar-personas` | Cria, lista e edita personas de audiência em `./personas/` do projeto atual. |
| `planejar-agenda` | Planeja o ciclo do calendário editorial (12 slots, 3 posts/semana, 4 semanas) a partir de ideias e rascunhos. Opera sobre `./agenda/calendario.md` do workspace; sem a estrutura, PARA. |
| `analisar-metricas` | Analisa o CSV de métricas do workspace, ranqueia posts, aponta padrões e gera relatório datado; propõe aprendizados para o perfil de voz. Só leitura no CSV; sem a estrutura, PARA. |

## Instalação

    /plugin marketplace add sallzzbr/hefesto
    /plugin install bragir@hefesto

## Contratos

- **Personas são do projeto**, nunca do plugin: `./personas/<nome>.md` (preferido) ou `./personas.md` (fallback).
- **Perfil de voz é do projeto** quando existe (`./perfil-de-voz.md`, ou `./voz/perfil-de-voz.md` em workspaces de conteúdo); o plugin só carrega o default do Antonio como fallback.
- Projetos com `./voice-profile.md` legado continuam funcionando; as skills oferecem renomear, nunca renomeiam sozinhas.

## Consumidores conhecidos

- **mimyr** (pipeline de cursos) — usa as skills de voz e personas para os cursos.
- **bragir** (workspace LinkedIn, repo homônimo) — usa as skills de voz para posts e as editoriais (`planejar-agenda`, `analisar-metricas`) para o ciclo.
