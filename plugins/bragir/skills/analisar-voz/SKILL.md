---
name: analisar-voz
description: "Analyze an author's writing style from docx/markdown samples and generate a structured voice profile. Use when the user has 3-5 writing samples and wants a perfil-de-voz.md (voice profile) capturing tone, structure, vocabulary, analogies and pedagogical patterns — útil para clonar a voz de um autor."
---

# Analisar Voz

Read the provided documents and extract a structured voice profile for the author.

## Input

Analise 3-5 amostras escolhidas pelo usuário (docx, markdown, txt ou publicações acessíveis).
Leia o texto completo com as ferramentas disponíveis. Para DOCX, use uma skill ou leitor
compatível com o runtime; não instale dependências automaticamente. Para URLs, registre
limites de acesso e não trate título ou snippet como leitura integral.

Registre título, canal, referência, data disponível e data da leitura. Em compartilhamentos,
analise a legenda do autor, separada do corpo de terceiros. Material editorial ou rascunho
assistido por IA não comprova sozinho a voz autoral; identifique essa limitação.

## Analysis dimensions

For each document, identify patterns in:

1. **Tom e registro** — formal/informal, nivel de formalidade, uso de "voce" vs "senhor"
2. **Abertura de secoes** — como o autor comeca capitulos, topicos, paragrafos
3. **Estrutura de frase** — comprimento medio, uso de perguntas retoricas, listas
4. **Fechamento de secoes** — como encerra (motivacional, reflexivo, resumo)
5. **Analogias e metaforas** — exemplos recorrentes, fontes de analogia (cotidiano, profissional)
6. **Vocabulario caracteristico** — palavras e expressoes frequentes, bordoes
7. **Relacao com o leitor** — como se posiciona (professor, mentor, colega), como trata duvidas
8. **Citacoes e referencias** — como integra fontes academicas no texto
9. **Elementos pedagogicos** — caixas (Saiba Mais, Na Pratica, Reflita), check-ins, exercicios
10. **Marcadores de personalidade** — humor, empatia, assertividade, humildade

## Output format

### Destino do perfil

Grave no `local_voz` resolvido pela regra única, a mesma cadeia que as skills de escrita leem:

1. `local_voz` na seção `## Paths do workspace` do `CLAUDE.md` do repo atual.
2. `local_voz` nos defaults do usuário (`~/.claude/bragir/defaults.md`), somente se o usuário já o tiver configurado.
3. Convenção descoberta no cwd: perfil existente em `./perfil-de-voz.md`, `./voz/perfil-de-voz.md` ou no legado `./voice-profile.md`. Exatamente um candidato existente é usado; mais de um candidato concorrente exige perguntar.
4. Nenhum candidato cai no default documentado, o perfil pessoal `~/.claude/bragir/perfil-de-voz.md`, fora do plugin, que sobrevive à atualização e que as skills de escrita leem sem depender do plugin.

Os paths literais são ilustrativos do default, não hardcode. Um arquivo só de scaffold
(placeholders `<!-- -->`) conta como existente para ESCRITA: é exatamente ele que você vai
preencher. Se resolver o nome legado, ofereça renomear para `perfil-de-voz.md` em vez de criar um
segundo arquivo.

Pedido explícito do usuário define o destino. Se ele pedir o perfil deste projeto e nenhum
existir, crie `./perfil-de-voz.md` no cwd. Uma skill que delega a análise exigindo
`./perfil-de-voz.md` no projeto (como o preflight de cursos do mimyr) conta como esse pedido. Se
o usuário pedir o perfil padrão pessoal (ex.: "atualiza meu perfil de voz padrão"), grave no
`local_voz` dos defaults, quando já configurado, ou no nível 4, e avise que projetos com perfil
próprio continuam usando o deles.

Anuncie o destino resolvido e de qual nível ele veio antes de gravar; se o arquivo já existir,
anuncie destino e nível e peça ok antes de sobrescrever.

Não ofereça registrar `local_voz` nos defaults e não edite `~/.claude/bragir/defaults.md`: um
`local_voz` ali prevalece sobre `./perfil-de-voz.md` e `./voz/perfil-de-voz.md` de todo projeto sem
`local_voz` no `CLAUDE.md`. O nível 4 já é lido sem esse registro.

Em sessão de nuvem, `~/.claude` não sobrevive entre sessões: lá só persiste o perfil gravado no
projeto e commitado no repo. Quando o destino ficar fora do projeto, diga isso ao usuário e
ofereça gravar em `./perfil-de-voz.md`.

Nunca grave perfil em `${CLAUDE_PLUGIN_ROOT}` nem no cache. O pacote não contém perfil de voz. No Codex, prevalecem o `RUNTIME.md` e a skill nativa.

Após gerar um perfil dentro do projeto, sugira ao usuário commitar o arquivo no repo do projeto.

### Estrutura do perfil

Use esta estrutura:

```
# Perfil de Voz — [Nome do Autor]

## Resumo (2-3 frases)

## Tom e registro
## Como abre secoes
## Como fecha secoes
## Analogias recorrentes
## Vocabulario caracteristico
## Estrutura de frase
## Relacao com o leitor
## Uso de citacoes
## Elementos pedagogicos
## Exemplos reais (trechos representativos)
```

Include 2-3 **trechos reais** (curtos, <30 palavras) dos documentos analisados como exemplos concretos do estilo.

## Important

- Extract patterns, not individual instances. The profile should generalize.
- Note contradictions or register shifts between documents (e.g., more formal in e-book vs. informal in video script).
- Separe padrões por canal quando as amostras sustentarem a distinção. Não transfira caixas,
  bordões e cadência de aula para artigos ou posts sem evidência. Um canal não amostrado fica
  explicitamente não calibrado.
- Acrescente fontes e limites da análise ao perfil. Preserve 2-3 trechos literais curtos com
  procedência, sem fabricar exemplos como se fossem falas do autor. Observação inicial não é
  validação humana: convide o autor a reconhecer e corrigir o perfil.
- The profile will be used as input for content generation — be specific enough that another AI could replicate the voice.

## Escolha entre perfis locais

Configuração explícita de `local_voz` mantém prioridade sobre a descoberta local; pedido explícito do dono prevalece. Não perguntar por concorrência em níveis inferiores quando o perfil já foi resolvido por um nível superior. Se nenhum perfil de leitura tiver sido resolvido por configuração explícita (inclusive quando ela aponta para scaffold vazio), e houver dois ou mais perfis locais preenchidos entre `./perfil-de-voz.md`, `./voz/perfil-de-voz.md` e `./voice-profile.md`, liste os caminhos e pergunte qual perfil usar; encerre o turno e aguarde. Não escolher pelo nome, ordem da lista, data ou tamanho, nem mesclar conteúdo. Um único perfil local preenchido resolve a leitura; scaffold vazio não conta como perfil de leitura.

Reaproveite a escolha na mesma sessão e no mesmo workspace, inclusive ao passar entre analisar-voz, escrever-como-autor e revisar-naturalidade, sem repetir a pergunta. Reconfira o path: se sumiu, se o workspace mudou, se há nova configuração explícita ou se o dono pediu outra voz, resolva novamente pelos dados atuais. Não grave essa preferência em defaults ou configuração sem pedido explícito. Não mescle perfis nem sobrescreva o não escolhido.

Escolher o perfil não autoriza sobrescrever seu arquivo. Em analisar-voz, continue mostrando destino e pedindo OK antes de sobrescrever. Scaffold existente continua candidato de destino para escrita: se houver múltiplos destinos e nenhuma escolha prévia que resolva, pergunte qual preencher. Uma escolha já dada de perfil resolve o destino correspondente; não substitua silenciosamente o perfil escolhido por um scaffold. A diferença entre leitura e destino de escrita não altera a prioridade da configuração explícita.

## Agendamento opcional

Ao concluir a análise, ofereça uma vez revisão mensal do perfil por material publicado novo, conforme a referência somente leitura [rotina mensal](${CLAUDE_PLUGIN_ROOT}/skills/analisar-voz/references/rotina-mensal.md). Se o dono recusar ou adiar, não insista. Só um pedido explícito seguido da aprovação da prévia concreta autoriza criar a rotina local; não criar na instalação nem alterar defaults ou instalar ferramentas. Reutilize decisões já dadas na sessão, sem presumir autorização para push/PR. Sem ferramenta local compatível, mostre passo a passo manual apoiado na documentação atual, sem declarar agendamento realizado. O teste da rotina exige autorização separada; configurar não é executar.
