---
name: Central de Projetos
description: Sala de controle pessoal escura, calma e precisa para decidir o próximo trabalho.
colors:
  pulse-green: "#79dfb2"
  pulse-green-fill: "#16251f"
  operational-charcoal: "#090d0f"
  surface-base: "#0e1416"
  surface-raised: "#121a1d"
  surface-strong: "#172023"
  surface-sunken: "#0c1315"
  line: "#1f2a2e"
  line-strong: "#2b393e"
  text-primary: "#eef4f0"
  text-secondary: "#b6c2be"
  text-muted: "#8b9a9f"
  ink-on-accent: "#0c1612"
  warning-amber: "#f0ad5b"
  info-blue: "#7fb3ff"
  danger-rose: "#f3aaaa"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.1em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  4xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.pulse-green}"
    textColor: "{colors.ink-on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 15px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "9px 12px"
  input:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  badge:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 7px"
---

# Design System: Central de Projetos

## Overview

**Creative North Star: "Sala de Controle Silenciosa"**

A interface funciona como uma sala de controle pessoal: escura para sustentar horas de trabalho, silenciosa para não disputar atenção com as demandas e precisa para deixar projeto, prazo, bloqueio e próxima ação legíveis em poucos segundos. A personalidade confirmada é calma, precisa e confiável. Expressão vem da qualidade dos estados e da organização, não de ornamentação.

O sistema mantém densidade operacional alta, mas agrupa informação em camadas tonais claras. Componentes são táteis e confiantes: hover, foco e pressão respondem imediatamente, sem crescer a ponto de competir com o conteúdo. Glassmorphism e cápsulas generalizadas são anti-referências confirmadas.

**Key Characteristics:**
- Escuro operacional com contraste controlado.
- Verde raro, reservado a ação, seleção e confirmação.
- Hierarquia compacta em duas famílias tipográficas.
- Profundidade por camadas tonais; sombra só quando há elevação real.
- Respostas táteis curtas e previsíveis.

## Colors

A paleta combina **Carvão Operacional** como campo contínuo e **Verde Pulso** como sinal vivo. Azul, âmbar e rosa comunicam informação, atenção e risco; não substituem a voz principal.

### Primary
- **Verde Pulso:** ação primária, foco, item ativo e confirmação positiva.
- **Verde Pulso Profundo:** preenchimento discreto para seleção e contexto positivo.

### Secondary
- **Âmbar de Atenção:** prazo próximo, bloqueio ou cautela.
- **Azul de Informação:** contexto informativo e prioridade intermediária.
- **Rosa de Risco:** erro, remoção ou consequência destrutiva.

### Neutral
- **Carvão Operacional:** fundo contínuo da aplicação.
- **Superfícies Base, Elevada e Forte:** sequência tonal que separa shell, painel e item.
- **Superfície Rebaixada:** campos e áreas de entrada.
- **Linha e Linha Forte:** divisores e bordas funcionais.
- **Texto Primário, Secundário e Atenuado:** três níveis de leitura sem reduzir contraste do conteúdo essencial.

### Named Rules

**The One Signal Rule.** Verde Pulso significa ação, seleção ou confirmação; nunca vira decoração espalhada pela tela.

**The Project Color Rule.** Cores de projeto identificam origem local. Não podem assumir semântica global de sucesso, alerta ou erro.

## Typography

**Display Font:** Space Grotesk (com fallback sans-serif)  
**Body Font:** DM Sans (com fallback sans-serif)

**Character:** Space Grotesk dá estrutura e presença a títulos curtos. DM Sans mantém leitura funcional em listas, formulários e metadados densos. A dupla deve parecer ferramenta de trabalho, não painel promocional.

### Hierarchy
- **Display:** títulos de superfície principal; curto e sem texto auxiliar redundante.
- **Headline:** título de página e estados importantes.
- **Title:** cabeçalhos de painel, cards e modais.
- **Body:** tarefas, descrições e controles; prioriza leitura compacta.
- **Label:** grupos, metadados e cabeçalhos tabulares em caixa alta quando a orientação exige.

### Named Rules

**The Two Voices Rule.** Space Grotesk estrutura; DM Sans opera. Não introduzir terceira família como adorno técnico.

**The Quiet Metadata Rule.** Metadado pode recuar em tamanho e cor, mas nunca ficar ambíguo ou ilegível.

## Layout

Shell desktop com sidebar fixa (228px), topbar enxuta (68px), conteúdo central limitado (1480px) e gutter amplo (42px). A densidade nasce de blocos internos compactos; páginas não precisam ser comprimidas nas bordas.

Em larguras intermediárias, sidebar reduz para 192px e gutter para 24px. Abaixo de 760px, sidebar vira navegação horizontal, gutter cai para 16px e composições em colunas empilham. Tabelas e Kanban preservam leitura com rolagem local quando a estrutura não pode colapsar honestamente.

**The Task-First Rule.** Na tela operacional, a tarefa dominante recebe a maior área. Prazos, caixa de entrada e contexto apoiam; não disputam largura igual por simetria.

## Elevation & Depth

Profundidade é tonal por padrão. Fundo, superfície, borda e estado de interação definem camadas em repouso. Sombras são raras e estruturais: card levemente interativo, toast, modal e sheet podem elevar porque mudam a relação espacial; painel comum permanece assentado.

### Shadow Vocabulary
- **Contato:** sombra curta e discreta para controle ou card que responde ao toque.
- **Flutuação:** sombra ampla para toast e popover.
- **Interrupção:** sombra profunda para modal e sheet sobre backdrop.

### Named Rules

**The Resting Surface Rule.** Superfície em repouso usa tom ou borda. Sombra só aparece quando a camada realmente se move sobre outra.

## Shapes

Cantos são discretamente curvos: 6px para itens pequenos, 10px para controles e cards, 14px para painéis, 20px para modais centrais. Bordas finas de 1px descrevem estrutura sem simular vidro.

Cápsulas de 999px pertencem apenas a badges, tags e filtros curtos. Botões, abas de página, cards e campos mantêm cantos moderados. Essa restrição preserva densidade e hierarquia.

## Components

Componentes são **táteis e confiantes**: resposta rápida, deslocamento mínimo e foco visível. A ação responde; o layout não salta.

### Buttons
- **Shape:** cantos moderados e compactos.
- **Primary:** Verde Pulso com tinta escura; uma ação dominante por região.
- **Hover / Focus:** brilho tonal curto, elevação de 1px no hover e anel de foco derivado do verde.
- **Ghost:** transparente em repouso; ganha superfície e borda ao hover.
- **Danger:** superfície rosa profunda, borda própria e rótulo explícito da consequência.

### Chips
- **Style:** cápsulas pequenas, texto curto e cor semântica ou de projeto.
- **State:** preenchimento tonal leve; nunca substituir botão ou navegação extensa.

### Cards / Containers
- **Corner Style:** moderado.
- **Background:** sequência de superfícies tonais.
- **Shadow Strategy:** tonal e borda em repouso; sombra de contato apenas em item interativo.
- **Border:** 1px, reforçada no hover ou seleção.
- **Internal Padding:** compacto, normalmente 12–20px.

### Inputs / Fields
- **Style:** superfície rebaixada, borda forte, tipografia corporal.
- **Focus:** borda Verde Pulso e anel visível.
- **Error / Disabled:** cor semântica explícita; estado desabilitado reduz contraste e remove resposta tátil.

### Navigation

Sidebar agrupa rotas por função, usa ícones Phosphor consistentes e mantém item ativo com camada tonal mais traço verde interno. Em mobile, grupos viram faixa horizontal rolável; nomes permanecem visíveis.

### Modal / Sheet

Modal central protege decisões curtas; sheet lateral atende edição longa sem perder contexto. Ambos usam backdrop real, título Space Grotesk, acento superior fino e sombra de interrupção.

## Do's and Don'ts

### Do:
- **Do** reservar Verde Pulso para ação, foco, seleção e confirmação.
- **Do** usar camadas tonais antes de adicionar sombra.
- **Do** responder a hover, foco, pressão, erro, loading e disabled com estados claros.
- **Do** manter tarefa, projeto, prioridade e prazo escaneáveis na mesma passagem visual.
- **Do** usar cápsulas somente para tokens pequenos como status, tag e prioridade.

### Don't:
- **Don't** usar glassmorphism, blur decorativo ou transparência que enfraqueça contraste.
- **Don't** transformar botões, tabs, cards e campos em pílulas.
- **Don't** espalhar verde como ornamento ou fundo dominante.
- **Don't** criar profundidade duplicando borda e sombra larga na mesma superfície em repouso.
- **Don't** introduzir cards métricos, gráficos ou indicadores que não protejam uma decisão real do usuário.
