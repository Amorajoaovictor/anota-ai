# Documento de requisitos

## Objetivo

Definir requisitos iniciais do aplicativo de organização para programadores.

## Requisitos funcionais

### RF01 — Criar nota

O sistema deve permitir criar, editar e excluir notas.

### RF02 — Criar tarefa

O sistema deve permitir criar tarefas com título, descrição, status, prioridade e prazo.

### RF03 — Organizar Kanban

O sistema deve permitir visualizar e mover tarefas entre colunas do Kanban.

### RF04 — Criar roadmap

O sistema deve permitir criar objetivos, marcos e períodos de planejamento.

### RF05 — Relacionar informações

O sistema deve permitir relacionar notas, tarefas e objetivos do roadmap.

### RF06 — Sugerir estrutura com IA

O sistema deve permitir enviar texto para a inteligência artificial e receber sugestões de tarefas, prioridades e próximos passos.

### RF07 — Revisar sugestões

O sistema deve exigir confirmação do usuário antes de criar ou alterar tarefas e objetivos com base nas sugestões da IA.

### RF08 — Funcionar sem IA

O sistema deve permitir o uso manual de notas, tarefas e roadmap quando a IA estiver indisponível.

## Requisitos não funcionais

- Interface simples e rápida.
- Dados persistidos com segurança.
- Alterações importantes reversíveis ou editáveis.
- Resposta clara quando a IA falhar ou estiver indisponível.
- Compatibilidade com telas de computador e celular.

## Critérios de aceitação do fluxo principal

1. Usuário escreve uma ideia.
2. Sistema mostra sugestões estruturadas.
3. Usuário pode editar ou rejeitar sugestões.
4. Sistema salva somente após confirmação.
5. Nota, tarefas e roadmap permanecem vinculados.
