# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Primary user: uma única pessoa — o próprio dono do produto — que administra simultaneamente vários projetos de software e demandas institucionais (Intranet, Observa SEUMA, Guichê Virtual, PAX/VistaFor, Monitoramento do Ar, App Vistoria — CELAM/NUEE): correções, funcionalidades, solicitações externas, dependências e prazos.
- Confirmado em entrevista: uso pessoal, dono único dos dados, sem segunda audiência para projetar. Colaboração é explicitamente fora do MVP (PRD 7.2).
- [INFERENCE] Os nomes dos projetos sugerem contexto de órgão público/municipal; isso não é vínculo para o registro do produto.

## Product Purpose

Central pessoal que organiza projetos, demandas, tarefas, prazos, decisões, bloqueios e próximos passos. Substitui a planilha atual como principal interface de acompanhamento e transforma entradas desestruturadas (áudio, anotações, transcrições de reunião, mensagens, cards do Trello) em tarefas estruturadas dentro do projeto correto.

## Positioning

Agente contextual: o usuário informa o que aconteceu; o sistema entende onde aquilo pertence ("O usuário informa o que aconteceu; o sistema entende onde aquilo pertence" — PRD 2.3). O agente acumula contexto de cada projeto (aliases, módulos, vocabulário, decisões anteriores) para classificar a nova demanda (projeto, módulo, tipo, prioridade), apresentar evidências e confiança, e exigir confirmação antes de gravar. É o diferencial que uma planilha ou um quadro não copiam: a classificação usa memória contextual por projeto, não só o texto da entrada.

## Operating Context

- Hoje as demandas vivem espalhadas: planilha (acompanhamento principal), Trello (sincronizado bidirecionalmente), mensagens, anotações, áudios, reuniões e memória pessoal.
- A planilha atual tem estrutura inconsistente (colunas misturam status, etapa, responsável, bloqueios, próximas ações e prazos; nome do projeto só na primeira linha do grupo).
- Vários projetos têm nomes antigos/aliases e vocabulário próprio (ex.: "planta", "raster", "quadra", "loteamento" → VistaFor), que o agente precisa reconhecer mesmo quando o nome do projeto não é dito.
- O produto é um protótipo em desenvolvimento ativo: Next.js + Prisma/Postgres (Neon), autenticação própria, fila de jobs para IA/transcrição; o agente hoje é agnóstico de provedor (heuristic/DeepSeek/Groq). Status no PRD: Planejamento.
- Criação manual de tarefa precisa estar acessível de qualquer tela, mesmo com IA ou serviços externos fora do ar (PRD 6.5).

## Capabilities and Constraints

Escopo confirmado do MVP (PRD 7.1): autenticação; CRUD de projetos, módulos e tarefas; importação da planilha atual; visualização tabular, Kanban, roadmap e central de prazos sobre os mesmos dados; prioridade por projeto e prioridade opcional por tarefa; dependências entre tarefas; lembretes no app; integração bidirecional com Trello; upload/gravação de áudio com transcrição; caixa de entrada de informações não estruturadas; agente contextual (identificação automática de projeto/módulo; classificação em Tarefa, Bug, Melhoria, Funcionalidade, Decisão, Solicitação externa, Ideia futura, Pergunta); sugestão de cards estruturados; busca por demandas semelhantes; plano de ação gerado por IA; histórico de alterações e de decisões; memória contextual por projeto; MCP com operações controladas; layout responsivo e PWA instalável.

Fora do MVP (PRD 7.2): mobile nativo; colaboração em equipe; chat completo; controle de ponto/financeiro; substituição integral do Trello; alteração automática de prazos; alteração de código em produção; merge/deploy automáticos; integrações com WhatsApp, e-mail ou Google Calendar; gestão de capacidade; execução autônoma de decisões críticas.

Terminologia confirmada (PT-BR): projetos, módulos, aliases, etiquetas (pertencentes ao projeto), marcos, cards/tarefas (status: Backlog, Em andamento, Bloqueada, Em validação, Concluída, Cancelada), prioridades P0–P3, complexidade (Baixa/Média/Alta) que alimenta previsão (previsão é sugestão derivada; `due` é o único compromisso e só o usuário define), caixa de entrada, revisão IA, plano do dia ("Hoje"), contexto do projeto (visível para IA e MCP; nota é privada), dependências só entre cards do mesmo projeto.

Restrições e decisões confirmadas:
- Confirmação proporcional ao risco (PRD 6.3): classificar é confirmação simplificada; criar tarefa é normal; mudar prioridade/prazo é explícita; múltiplas atualizações são reforçadas; modificar código/executar comandos exige aprovação.
- IA nunca altera o banco diretamente: toda ação passa pelos serviços e regras de negócio (PRD 6.4).
- Toda classificação mostra evidências e confiança (PRD 6.2).
- Aprendizado corrigível: associações aprendidas são visualizáveis e editáveis; correções podem virar aliases, módulos ou tags estruturados (PRD 6.6).
- Vocabulário (aliases/módulos/etiquetas) é por projeto — o contexto de um projeto não vaza no outro.
- Nota é privada (auditoria registra só vínculos e chaves alteradas, nunca o texto); contexto do projeto fica disponível para IA/MCP.
- Não decidido: apps nativos Android/iOS (futuro); "Hermes ou tecnologia equivalente" no PRD não é vínculo — a implementação é agnóstica de provedor (heuristic/DeepSeek/Groq, escolha de LLM e STT separadas via config).

## Brand Commitments

- Nome provisório: "Central de Projetos" (usado no PRD e na base de código).
- Idioma da interface: PT-BR.
- Identidade visual incumbente (design-qa.md): identidade verde, tipografia e navegação próprias — preservar em refinamentos; não é spec de marca vinculante.
- Sem tagline, logo ou ativos de marca comprometidos além de `public/icon.svg`.

## Evidence on Hand

- `prd.md` — spec completa v2.0 (escopo, telas, princípios, fora de escopo).
- `arquitetura-navegacao.md` — decisão de navegação (uma tela, dois escopos: global vs. projeto).
- `design-qa.md` — evidência de QA visual da superfície de Notas (estilo Keep), interações validadas, sem findings P0–P2.
- Planilha real a importar: existe com o usuário (confirmado em entrevista); caminho a indicar quando a importação for implementada. Não há arquivo no repo — não fabricar amostra como se fosse a planilha real.
- `prisma/schema.prisma` + seed e a suíte de testes (domínio, servidor, caixa de entrada, tarefas, projetos, notas, harness de IA) como evidência de comportamento.
- Sem usuários em produção, depoimentos ou cases ainda.

## Product Principles

1. Contexto antes da automação: o agente consulta o contexto acumulado do projeto antes de criar ou alterar qualquer demanda.
2. IA com evidências: toda classificação se explica (evidências + confiança) e o usuário confirma antes de gravar.
3. Manual sempre disponível: falha de IA ou de serviços externos nunca impede o cadastro manual de projetos e tarefas.
4. Backend como fonte de verdade: o agente nunca toca o banco direto; toda ação passa pelas regras de negócio.
5. Uma ferramenta, dados honestos: prazo é compromisso (só o usuário define); previsão é sugestão derivada; progresso de projeto é sempre calculado, nunca gravado.

## Accessibility & Inclusion

Esforço razoável de acessibilidade, sem norma formal exigida (confirmado em entrevista). Layout responsivo e PWA instalável estão no escopo do MVP.
