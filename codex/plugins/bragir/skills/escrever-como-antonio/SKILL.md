---
name: escrever-como-antonio
description: Use quando o usuário pedir conteúdo na própria voz, na voz de Antonio Salgado ou consistente com um perfil-de-voz.md, com possível calibração para personas locais.
---

# Escrever como Antonio

Na primeira utilização, leia `../../RUNTIME.md` e
`../../shared/skills/escrever-como-antonio/CONTRATO.md`. Este entrypoint e o runtime prevalecem
para paths, ferramentas e autorização.

## Fluxo nativo

1. Resolva `local_voz`. Ignore scaffold vazio. Use o primeiro perfil preenchido, leia-o por
   inteiro e não mescle perfis.
2. Sem perfil do usuário, leia `../../shared/perfil-de-voz.md` e avise antes do texto: "Vou usar
   a voz default do Antonio incluída no Bragir." Esse fallback pessoal é intencional e incluído na distribuição.
3. Resolva personas no workspace. A persona calibra conhecimento, objeções e exemplos; ela não
   substitui a voz. Sem persona compatível, anuncie a ausência e use a audiência do pedido ou
   perfil.
4. Aplique a voz ao texto inteiro. Exceção explícita do usuário prevalece nesta entrega;
   declare o ajuste e preserve o restante do perfil.
5. Entregue no formato, idioma, canal e extensão pedidos. Declare qualquer suposição necessária.

Personas e perfis ficam no workspace ou path pessoal configurado, nunca no cache. Para criar uma
persona, use `gerenciar-personas`.
