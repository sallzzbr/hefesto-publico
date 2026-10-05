---
name: analisar-voz
description: Use quando o usuário fornecer amostras e quiser extrair ou atualizar um perfil de voz estruturado, inclusive a partir de DOCX, Markdown ou texto.
---

# Analisar Voz

Na primeira utilização, leia `../../RUNTIME.md` e
`../../shared/skills/analisar-voz/CONTRATO.md`. O contrato preserva dimensões de análise e formato;
este entrypoint e o runtime prevalecem para paths, ferramentas e autorização.

## Fluxo nativo

1. Leia integralmente as 3 a 5 amostras, inclusive publicações acessíveis. Para `.docx`, use a skill de documentos do Codex se
   disponível; sem leitor compatível, identifique a lacuna e não alegue análise.
2. Registre título, canal, referência, data disponível, data da leitura e limites de acesso.
   Separe legenda autoral de texto compartilhado de terceiros. Rascunho assistido por IA não
   comprova sozinho a voz. Extraia padrões recorrentes por canal; registre contradições,
   ocorrências isoladas e canais não calibrados.
3. Resolva `local_voz`; por padrão, escreva no workspace. Inclua 2 a 3 trechos reais curtos.
4. Mostre o perfil antes de uma escrita ainda não autorizada. Sem escrita, entregue o conteúdo
   pronto e o path de destino.

`../../shared/perfil-de-voz.md` é fallback empacotado e somente leitura. Para atualizar um padrão
pessoal, use um arquivo fora do pacote, como `~/.codex/hefesto/bragir/perfil-de-voz.md`, e registre
`local_voz` nos defaults apenas quando autorizado. Nunca grave dados no cache do plugin.
