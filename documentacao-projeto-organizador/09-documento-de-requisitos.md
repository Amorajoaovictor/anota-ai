# Documento de requisitos

## Objetivo

Definir os requisitos do **Central de Projetos** — organizador pessoal inteligente de projetos, inicialmente uma aplicação web responsiva/PWA, preparada para mobile futuro.

O produto transforma informações desestruturadas — áudios, anotações, transcrições de reuniões, mensagens e cards do Trello — em demandas organizadas no projeto correto. Um agente contextual de IA interpreta a entrada, consulta o contexto acumulado, classifica e propõe ações estruturadas que só são executadas após confirmação do usuário.

Princípio central: **o usuário informa o que aconteceu; o sistema entende onde aquilo pertence.**

---

## Escopo do MVP

### Incluído

- Autenticação.
- Cadastro e edição de projetos.
- Cadastro de módulos dentro dos projetos.
- Cadastro e edição de tarefas.
- Importação da planilha atual.
- Visualização tabular.
- Visualização Kanban.
- Visualização de roadmap.
- Central de prazos.
- Prioridade por projeto.
- Prioridade opcional por tarefa.
- Dependências entre tarefas.
- Lembretes dentro da aplicação.
- Integração bidirecional com Trello.
- Upload ou gravação de áudio.
- Transcrição de áudio.
- Caixa de entrada de informações não estruturadas.
- Agente contextual de projetos.
- Identificação automática do projeto e módulo.
- Classificação de tarefa, bug, decisão, bloqueio ou observação.
- Sugestão de cards estruturados.
- Busca por demandas semelhantes.
- Plano de ação gerado por IA.
- Histórico de alterações.
- Histórico de decisões.
- Memória contextual por projeto.
- MCP com operações controladas.
- Layout responsivo e instalável como PWA.

### Fora do MVP

- Aplicativo mobile nativo.
- Colaboração simultânea entre equipes.
- Chat completo entre usuários.
- Controle de ponto ou financeiro.
- Substituição integral do Trello.
- Alteração automática de prazos sem aprovação.
- Alteração automática de código em produção.
- Merge automático de código.
- Deploy automático iniciado pelo agente.
- Integrações com WhatsApp, e-mail ou Google Calendar.
- Gestão avançada de capacidade de equipes.
- Execução autônoma de decisões críticas.
- Agente de desenvolvimento de código (evolução posterior, isolada do MVP).

---

## Requisitos funcionais

### 1. Entidades básicas

**RF01 — Criar nota**

O sistema deve permitir criar, editar e excluir notas. Notas são privadas e não entram em IA/MCP por padrão.

**RF02 — Criar tarefa**

O sistema deve permitir criar tarefas (cards) com título, descrição, status, prioridade e prazo.

**RF05 — Relacionar informações**

O sistema deve permitir relacionar notas, tarefas e objetivos do roadmap, bem como registrar dependências entre tarefas e vínculos de uma entrada com as entidades que ela originou.

### 2. Projetos

**RF09 — Gerenciar projetos**

O sistema deve permitir criar, editar e arquivar projetos, com os campos:

- Nome (obrigatório), descrição, status, prioridade, cor ou ícone.
- Data de início, data-alvo, responsável principal, objetivo.
- Quadro Trello vinculado, repositórios vinculados.
- Progresso (calculado), última atualização (automática), arquivado (automático/manual).

**RF10 — Gerenciar aliases**

O sistema deve permitir cadastrar nomes alternativos, nomes antigos e siglas de um projeto, registrando origem do alias, data de criação, se foi criado automática ou manualmente e se foi confirmado pelo usuário.

**RF11 — Gerenciar módulos**

O sistema deve permitir cadastrar módulos de um projeto com nome, descrição, termos relacionados, responsáveis, repositórios relacionados, documentação e status.

### 3. Tarefas e entidades de apoio

**RF12 — Tipos e campos de tarefa**

O sistema deve permitir tarefas com os campos: título, descrição, projeto, módulo, tipo, status, prioridade (herdada ou específica), responsável, data de início, prazo, estimativa de esforço, etiquetas, bloqueadores, dependências, subtarefas, origem da informação, entrada contextual de origem, link do Trello, repositório e pull request relacionados, data da última sincronização, observações, anexos e histórico de alterações.

Tipos de card suportados: Tarefa, Bug, Melhoria, Funcionalidade, Decisão, Solicitação externa, Ideia futura e Pergunta.

**RF13 — Prioridades**

O sistema deve suportar as prioridades P0 (Crítica), P1 (Alta), P2 (Média), P3 (Baixa) e "Sem prioridade". Uma tarefa herda inicialmente a prioridade do projeto, mas pode ter prioridade própria.

**RF14 — Status**

O sistema deve suportar os status: Caixa de entrada, A revisar, Backlog, Planejada, Em andamento, Bloqueada, Aguardando outro setor, Em validação, Concluída e Cancelada.

O Kanban utiliza Backlog, Em andamento, Bloqueada, Em validação, Concluída e Cancelada. O status "A revisar" pertence somente à aba Revisão IA.

**RF15 — Dependências e bloqueios**

O sistema deve permitir vincular dependências entre cards e projetos, e registrar bloqueios. Bloqueio é um status, não apenas um campo.

**RF16 — Subtarefas**

O sistema deve permitir criar subtarefas dentro de uma tarefa.

**RF17 — Histórico de alterações**

O sistema deve registrar e exibir o histórico de alterações de projetos, tarefas e demais entidades.

**RF18 — Decisões**

O sistema deve permitir registrar decisões com título, projeto, módulo, descrição, data, participantes, origem, motivo, consequências, tarefas relacionadas e, quando aplicável, a decisão substituída. Deve haver histórico de decisões consultável.

**RF19 — Marcos**

O sistema deve permitir criar marcos com nome, projeto, data de início opcional, data prevista, status (Planejado, Em andamento, Atingido, Adiado, Cancelado), dependências, descrição do resultado esperado, cor herdada do projeto e arquivamento separado do status.

- Tarefas vinculadas em relação muitos-para-muitos: uma tarefa pode participar de vários marcos do mesmo projeto.
- Progresso calculado pela proporção de tarefas vinculadas concluídas; marco sem tarefas permanece com 0%.
- Marcos representam pontos-chave de resultado, não etapas do fluxo: não substituem status, tarefas ou prazos.
- Ao remover um marco, as tarefas são preservadas e somente o vínculo é removido.

**RF20 — Reuniões**

O sistema deve permitir criar reuniões como lembretes simples (não atas nem transcrições) com título, descrição, link opcional, data e horário (usados por lembretes e notificações) e projeto opcional.

Reuniões devem aparecer em uma visão global e, quando vinculadas a um projeto, também na aba de reuniões desse projeto. Decisões, regras, vocabulário e tarefas extraídos de um áudio permanecem entidades próprias, não campos da reunião.

### 4. Visualizações

**RF03 — Organizar Kanban**

O sistema deve permitir visualizar e mover tarefas entre colunas do Kanban, com:

- Colunas correspondentes aos status.
- Arrastar e soltar cards.
- Filtro por projeto, módulo, prioridade, responsável e marco (incluindo a opção "Sem marco").
- Badge dos marcos vinculados em cada card.
- Criação de card a partir do cabeçalho de uma coluna, herdando o status daquela coluna.
- Criação de card com filtro de marco ativo vincula o novo card ao marco.
- Limite visual de tarefas em andamento.
- Destaque para prazo vencido e bloqueios.
- Agrupamento opcional por projeto.
- Sincronização com o Trello.

**RF04 — Criar roadmap**

O sistema deve permitir criar objetivos, marcos e períodos de planejamento, com modos de visualização por semana, mês, trimestre e ano, exibindo:

- Faixa de duração do projeto, módulos, marcos, tarefas e dependências.
- Data atual, projetos atrasados, progresso planejado e realizado.
- Tarefas sem data.
- Filtros por prioridade, projeto e status.
- Marcador do marco na data prevista, com nome, status e progresso agregado; clique abre resumo e tarefas vinculadas sem sair do roadmap.
- Filtro por marco destaca as tarefas participantes.

**RF24 — Visão de marcos**

O sistema deve oferecer página própria de marcos por projeto e visão consolidada, permitindo criar, editar, atingir, adiar, cancelar, arquivar e remover marcos, além de:

- Painel de detalhe com datas, resultado esperado, progresso e tarefas vinculadas.
- Edição de nome, data de início, data prevista, status e resultado esperado no painel.
- Projeto imutável durante a edição, para preservar os vínculos das tarefas.
- Listagem e abertura de tarefas vinculadas.
- Vínculo de uma tarefa a vários marcos do mesmo projeto.
- Remoção de marco sem remover tarefas.

**RF25 — Central de prazos**

O sistema deve centralizar prazos nas seções: Atrasadas, Vencem hoje, Próximos três dias, Próximos sete dias, Próximos trinta dias, Sem prazo e Aguardando retorno externo, com as funcionalidades:

- Adiar prazo com justificativa.
- Marcar como concluída.
- Criar lembrete.
- Filtrar por projeto.
- Exibir quantidade de adiamentos.
- Mostrar tarefas bloqueadoras.
- Mostrar prazo original e atual.
- Registrar histórico.

Nenhum prazo deve ser alterado automaticamente pelo agente.

**RF26 — Tela "Hoje"**

O sistema deve ter a tela "Hoje" como página inicial, exibindo:

- Saudação e data.
- Tarefas atrasadas.
- Prazos dos próximos sete dias.
- Projetos prioritários.
- Plano de ação recomendado.
- Tarefas bloqueadas.
- Entradas aguardando classificação.
- Classificações de baixa confiança.
- Alterações recentes no Trello.
- Ações rápidas: nova tarefa, novo projeto, gravar áudio, colar texto, sincronizar Trello, recalcular plano.

Cada recomendação do plano diário deve apresentar: tarefa, projeto, módulo, motivo da posição, prazo, esforço estimado, dependências, próxima ação concreta e alternativa em caso de bloqueio.

**RF27 — Detalhe do projeto**

Cada projeto deve ter uma página com: objetivo, prioridade, status, responsável, progresso, data-alvo, próximo marco, próxima ação, tarefas por status, tarefas atrasadas, tarefas bloqueadas, roadmap, Trello conectado, repositórios, histórico recente, decisões recentes, resumo gerado por IA, vocabulário e aliases, memórias contextuais e classificações recentes.

**RF28 — Agenda/calendário**

O sistema deve oferecer uma agenda/calendário derivada de cards, roadmap, prazos, previsões e reuniões. A edição na agenda deve atualizar a entidade de origem.

### 5. Caixa de entrada e agente contextual

**RF06 — Sugerir estrutura com IA**

O sistema deve permitir enviar texto para a inteligência artificial e receber sugestões de tarefas, prioridades e próximos passos.

**RF29 — Caixa de entrada inteligente**

O sistema deve armazenar na caixa de entrada todas as informações capturadas rapidamente, pelas formas: texto digitado, texto colado, áudio gravado, arquivo de áudio, card recebido do Trello, entrada criada por MCP e importação de planilha.

Estados da entrada: Recebida, Transcrevendo, Analisando contexto, Aguardando confirmação, Processada, Descartada e Com erro.

Informações exibidas: conteúdo original, projeto sugerido, módulo sugerido, tipo sugerido, confiança, evidências, possíveis duplicidades e ação sugerida.

**RF30 — Agente contextual**

O agente deve, para cada entrada, responder: a qual projeto pertence, qual módulo é mencionado, que tipo de informação foi recebida, se existe demanda semelhante, se a entrada complementa uma tarefa existente, se existe decisão anterior relacionada, qual prioridade foi informada ou sugerida, se há prazo explícito, qual ação deve ser realizada e qual é a confiança da classificação.

Tipos de entrada reconhecidos: nova tarefa, bug, melhoria, funcionalidade, decisão, bloqueio, dependência, observação, atualização de status, alteração de prioridade, alteração de prazo, solicitação externa, ideia futura, pergunta ainda não resolvida e informação de contexto.

**RF31 — Confiança e evidências**

Toda classificação deve exibir confiança e evidências (quais elementos levaram à conclusão). Níveis:

- **Alta (≥ 85%):** o sistema pode selecionar automaticamente o projeto, mas deve mostrar a classificação antes da confirmação final da tarefa.
- **Média (60% a 84%):** o sistema deve destacar os projetos mais prováveis e solicitar confirmação simples.
- **Baixa (< 60%):** o sistema deve manter a entrada na caixa de entrada e perguntar ao usuário a qual projeto ela pertence.

**RF32 — Desambiguação**

Quando houver projetos candidatos próximos, o sistema deve perguntar ao usuário qual projeto é o correto e usar a resposta como sinal para classificações futuras.

**RF33 — Detecção de duplicidade**

Antes de criar uma tarefa, o agente deve pesquisar títulos semelhantes, descrições semanticamente relacionadas, mesmo módulo, mesmo erro, mesma origem e cards relacionados no Trello. Resultados possíveis: criar nova tarefa, atualizar tarefa existente, criar subtarefa, adicionar observação, relacionar as demandas ou descartar como duplicada.

**RF34 — Revisão contextual**

O sistema deve oferecer uma tela de revisão com: texto original, transcrição, resumo, projeto sugerido, projetos alternativos, módulo sugerido, tipo da entrada, cards sugeridos, reuniões identificadas, notas sugeridas, marcos sugeridos, decisões identificadas, contextos e tags de apoio, prioridade sugerida, prazo identificado, responsável identificado, dependências, demandas semelhantes, evidências, nível de confiança e trechos que originaram cada informação.

A revisão deve permitir: confirmar, editar, escolher outro projeto, escolher outro módulo, criar nova tarefa, atualizar tarefa existente, criar subtarefa, registrar apenas como observação, registrar como decisão, unir sugestões, dividir sugestões, descartar e enviar ao Trello.

**RF07 — Revisar sugestões**

O sistema deve exigir confirmação do usuário antes de criar ou alterar tarefas e objetivos com base nas sugestões da IA. A revisão deve mostrar o plano completo, permitir correções e executar somente as ações aprovadas, respeitando a ordem de dependência entre elas.

**RF35 — Memória contextual**

O sistema deve manter, por projeto:

- **Contexto permanente:** nome oficial, nomes anteriores, aliases, descrição, objetivo, vocabulário relacionado, módulos, sistemas envolvidos, repositórios, tecnologias, responsáveis, setores envolvidos, integrações e documentações relacionadas.
- **Contexto operacional:** tarefas abertas, bugs recentes, prazos, bloqueios, últimas decisões, alterações recentes, marcos, responsáveis atuais, pull requests relacionados, estado das integrações e próximos passos.
- **Memória de conversa:** correções e informações temporárias do usuário, promovíveis ao contexto permanente mediante aprovação.

**RF36 — Gestão de contexto**

O usuário deve conseguir consultar e editar o que o agente conhece sobre cada projeto: descrição, nomes e aliases, módulos, termos relacionados, pessoas e setores, tecnologias, repositórios, decisões importantes, regras aprendidas, memórias sugeridas e informações desatualizadas.

Ações: adicionar memória, corrigir memória, confirmar informação aprendida, remover informação, definir expiração, promover memória temporária para permanente e visualizar quais classificações utilizaram a informação.

**RF37 — Plano de ação**

O sistema deve gerar uma ordem de execução combinando regras determinísticas e análise contextual:

- Score inicial: urgência do prazo (até 40 pontos), prioridade do projeto (até 25), impacto sobre outras tarefas (até 20), possibilidade de conclusão rápida (até 10), tempo sem atualização (até 5) e penalidade para tarefas bloqueadas.
- O agente avalia o contexto, detecta conflitos, organiza a sequência, explica a recomendação, sugere a próxima ação, identifica informações faltantes e oferece alternativa para tarefas bloqueadas.
- O usuário pode alterar a ordem do plano a qualquer momento.

### 6. Áudio e extração contextual

**RF38 — Áudio e transcrição**

O sistema deve permitir gravar ou enviar áudio e obter transcrição, com o fluxo: validação do arquivo, armazenamento temporário, transcrição por serviço de speech-to-text (provedor inicial Gemini 2.5 Flash, Whisper ou equivalente, substituível), preservação do texto original e envio da transcrição ao agente contextual.

Requisitos da transcrição: português brasileiro como idioma padrão, pontuação automática, identificação de falantes quando disponível, timestamps quando disponíveis, destaque de trechos incertos, possibilidade de edição, política configurável de retenção do áudio e reprocessamento com outro provedor.

**RF39 — Extração contextual**

Uma única entrada deve poder gerar várias entidades relacionadas, inclusive em projetos diferentes. Cards (principalmente tarefas) são a saída principal; quando a entrada mencionar uma reunião, o sistema deve propor a criação da reunião; quando houver informação importante ou relevante que não seja tarefa, reunião ou marco, deve propor uma nota.

O agente pode identificar: tarefas, reuniões, notas, marcos, bugs, decisões, bloqueios, perguntas, prazos, prioridades, atualizações de status, dependências, informações para a memória do projeto, projetos, aliases, módulos, tags, regras, vocabulário e contextos de apoio.

O agente pode criar qualquer entidade de negócio necessária, exceto usuários ou entidades de pessoas. Registros internos de infraestrutura (jobs, auditoria) permanecem sob controle exclusivo da aplicação.

### 7. Integrações

**RF40 — Trello bidirecional**

O sistema deve sincronizar com o Trello nos dois sentidos, com o mapeamento: projeto→quadro, status→lista, tarefa→card, subtarefa→checklist, responsável→membro, etiqueta→label, prazo→due date, descrição→description e anexo→attachment.

- Aplicativo → Trello: criar tarefa cria card; alterar título, mover no Kanban, alterar prazo, concluir e arquivar atualizam o card correspondente.
- Trello → aplicativo: novo card cria tarefa ou entrada; movimento altera status; prazo, descrição, arquivamento e membros atualizam o estado local.
- Cards criados diretamente no Trello podem passar pelo agente para identificar projeto interno, módulo, duplicidades e prioridade, e atualizar contexto.
- Conflitos não devem ser sobrescritos silenciosamente: o sistema deve permitir manter valor do aplicativo, manter valor do Trello, mesclar ou adiar a resolução.
- Eventos repetidos não devem criar tarefas duplicadas (webhooks idempotentes).

**RF41 — Importação da planilha**

O sistema deve importar a planilha existente com o mapeamento: Demanda→Projeto, Etapa/Responsável→Status ou responsável, Realizado→Título inicial, Pendências→Bloqueador, observação ou tarefa, Prazo→Prazo e Observação→Observação ou contexto.

Tratamentos: preencher o projeto nas linhas seguintes, converter datas do Excel, tratar hífen e células vazias, preservar quebras de linha, detectar duplicidades, não considerar automaticamente "Realizado" como concluído, criar status "A revisar", permitir correção em massa, exibir quantidade por projeto, gerar relatório de falhas, criar aliases quando nomes antigos forem identificados, sugerir módulos com base no vocabulário e usar os registros importados para construir o contexto inicial.

**RF42 — MCP**

O sistema deve expor operações estruturadas e controladas por MCP para o agente e clientes autorizados:

- Projetos: `projects.list`, `projects.get`, `projects.create`, `projects.update`, `projects.search_context`.
- Módulos e contexto: `modules.list`, `modules.get`, `context.search`, `context.add`, `context.update`, `context.confirm`, `context.delete`.
- Tarefas: `tasks.list`, `tasks.get`, `tasks.search_similar`, `tasks.create`, `tasks.update`, `tasks.move`, `tasks.complete`, `tasks.add_dependency`.
- Decisões: `decisions.list`, `decisions.create`, `decisions.link_task`.
- Prazos e roadmap: `deadlines.list`, `roadmap.get`, `action_plan.generate`.
- Caixa de entrada: `inbox.create`, `inbox.classify`, `inbox.confirm`, `inbox.discard`.
- Integrações: `trello.sync`, `sync.conflicts.list`, `repositories.list`.

Permissões: leitura, classificação, criação, atualização, sincronização, administração de contexto e operações sensíveis.

Operações sensíveis que exigem confirmação: alterar prazos, alterar prioridades críticas, atualizar várias tarefas, arquivar informações, alterar memória permanente, enviar informações para serviços externos, criar ou modificar código e executar comandos.

Toda chamada deve registrar em auditoria: usuário, agente ou cliente, ferramenta, parâmetros, resultado, data, alterações, confirmação e contexto utilizado.

### 8. Operação do produto

**RF43 — Criação rápida de tarefa**

O sistema deve permitir criar um card de qualquer tela, sem depender do agente, através de: ação global fixa na barra superior (em todas as telas e escopos), atalho de teclado dedicado (ignorado enquanto o foco estiver em campo de texto), cabeçalho de cada coluna do Kanban, cabeçalho de cada dia do roadmap, cabeçalho das telas Planilha e Prazos e plano de ação da tela "Hoje".

- Campos obrigatórios: título e projeto. Opcionais: status, módulo, tipo, prioridade, prazo e marcos.
- No escopo de projeto, o campo projeto vem travado com o projeto aberto.
- Marcos limitados ao projeto escolhido; trocar o projeto limpa a seleção anterior.
- Pré-preenchimento por contexto: escopo define o projeto, coluna do Kanban define o status, filtro de marco ativo define o marco vinculado, dia do roadmap define o prazo e filtro de módulo da planilha define o módulo.
- Autopreenchimento pela IA é opcional: preenche apenas campos ainda no valor padrão, nunca sobrescreve o que o usuário digitou, o projeto escolhido pelo usuário prevalece sobre a hipótese da IA, exibe valores propostos com confiança e ação de desfazer, e sua falha não bloqueia a criação.
- Sem informação em contrário, o card nasce em `Backlog`, tipo `Tarefa` e prioridade `P3`.
- Card criado já em `Concluída` ou `Cancelada` não entra no plano de ação.
- Marcos inválidos para o projeto são descartados sem impedir a criação.

**RF08 — Funcionar sem IA**

O sistema deve permitir o uso manual de notas, tarefas e roadmap quando a IA estiver indisponível. Falhas do agente, do modelo ou dos serviços externos não podem impedir o cadastro manual de projetos e tarefas.

**RF44 — Autenticação**

O sistema deve possuir autenticação de usuário, preparada para aplicativo mobile futuro. A primeira versão é individual (uso de um único usuário).

**RF45 — Auditoria e explicabilidade**

O sistema deve registrar, para toda ação proposta pelo agente: contexto consultado, evidências utilizadas, projeto escolhido, confiança, correções realizadas pelo usuário e ferramentas executadas.

**RF46 — Busca**

O sistema deve oferecer busca contextual por tarefas, projetos, módulos e decisões, com resposta adequada ao uso interativo.

**RF47 — PWA e mobile**

O sistema deve ser instalável como PWA, responsivo, com notificações, cache e conectividade limitada, mantendo contratos preparados para aplicativo mobile futuro.

---

## Regras de negócio

**RN01 — Nascimento de card**

Cards exigem título e projeto. Sem informação em contrário, nascem em `Backlog`, com prioridade `P3`, tipo `Tarefa` e complexidade vazia até análise da IA.

**RN02 — Prioridade herdada**

Uma tarefa herda inicialmente a prioridade do projeto, mas pode ter prioridade própria.

**RN03 — Confirmação proporcional ao risco**

A necessidade de confirmação varia conforme a ação:

- Apenas classificar uma entrada: confirmação simplificada.
- Criar uma tarefa: confirmação normal.
- Alterar prioridade ou prazo: confirmação explícita.
- Atualizar várias tarefas: confirmação reforçada.
- Modificar código ou executar comandos: aprovação obrigatória.

Uma entrada pode produzir uma proposta única com várias ações relacionadas; a revisão mostra o plano completo, permite correções e executa somente as ações aprovadas, respeitando a ordem de dependência.

**RN04 — Backend como fonte de verdade**

O agente não altera o banco diretamente; todas as ações passam pelos serviços e regras de negócio da aplicação.

**RN05 — Manual sempre disponível**

Falhas do agente, do modelo ou de serviços externos não impedem o cadastro manual. A criação manual de tarefa está acessível de qualquer tela.

**RN06 — Prazo intocável pela IA**

Nenhum prazo é alterado automaticamente pelo agente. Adiamentos exigem justificativa e registro histórico.

**RN07 — Marcos**

Marcos têm vínculo muitos-para-muitos com tarefas do mesmo projeto; remoção de marco não remove tarefas; progresso é calculado pela proporção de tarefas vinculadas concluídas; o projeto é imutável durante a edição do marco.

**RN08 — Notas privadas**

Notas são privadas e não entram em IA/MCP por padrão. Contextos exigem projeto, podem vincular card e ficam disponíveis para IA e MCP.

**RN09 — Prazo confirmado × previsão de entrega**

São campos distintos. Complexidade (baixa, média, alta) alimenta a previsão de entrega. Previsão vencida é alerta, não atraso.

**RN10 — Autopreenchimento pela IA**

A sugestão preenche apenas campos no valor padrão, nunca sobrescreve a entrada do usuário e exibe valores propostos com confiança e ação de desfazer. Falha da sugestão não bloqueia a criação.

**RN11 — Proibição de entidades de pessoas**

O agente nunca cria usuários ou entidades de pessoas. Correções de nomes podem originar aliases, módulos ou tags estruturados.

**RN12 — Aprendizado corrigível**

O agente aprende com correções do usuário, mas toda associação aprendida é visualizável e editável. Correções manuais que revelam regras, vocabulário ou associações recorrentes podem ser registradas como contexto do projeto.

---

## Requisitos não funcionais

### Desempenho

- Telas principais carregadas em até três segundos.
- Alterações refletidas imediatamente.
- Listas extensas virtualizadas.
- Classificação contextual com status visível.
- Operações de IA processadas em fila.
- Webhooks idempotentes.
- Busca contextual com resposta adequada ao uso interativo.

### Disponibilidade

- Falhas do Trello não impedem o uso local.
- Falhas do agente não impedem a criação manual.
- Falhas do STT não impedem a entrada de texto.
- Operações pendentes são reenviadas.
- Estado de sincronização permanece visível.

### Segurança

- Segredos nunca expostos no frontend.
- Credenciais criptografadas.
- Escopos por ferramenta MCP.
- Confirmação para escrita sensível.
- Logs de auditoria.
- Proteção contra repetição.
- Política de retenção de áudio.
- Isolamento do agente de código.
- Bloqueio de acesso direto ao banco pelo agente.
- Filtros contra instruções maliciosas em conteúdos importados.
- Controle de quais documentos podem compor o contexto.

### Explicabilidade

Toda ação proposta pelo agente deve registrar: contexto consultado, evidências utilizadas, projeto escolhido, confiança, correções realizadas pelo usuário e ferramentas executadas.

### Portabilidade

- API independente do frontend.
- Contratos documentados.
- Componentes responsivos.
- Autenticação preparada para mobile.
- Modelos de IA substituíveis.
- Provedor de STT substituível.
- Agente contextual desacoplado do banco.

### Experiência e compatibilidade

- Interface simples e rápida.
- Dados persistidos com segurança.
- Alterações importantes reversíveis ou editáveis.
- Resposta clara quando a IA falhar ou estiver indisponível.
- Compatibilidade com telas de computador e celular.

---

## Critérios de aceitação do fluxo principal

1. Usuário escreve uma ideia.
2. Sistema mostra sugestões estruturadas.
3. Usuário pode editar ou rejeitar sugestões.
4. Sistema salva somente após confirmação.
5. Nota, tarefas e roadmap permanecem vinculados.

## Critérios de aceitação por módulo

### Projetos e tarefas

- É possível criar, editar e arquivar projetos.
- Projetos podem possuir aliases e módulos.
- É possível criar e editar tarefas.
- É possível criar uma tarefa a partir de qualquer tela, informando apenas título e projeto.
- A criação a partir de uma coluna do Kanban ou de um dia do roadmap já nasce com o status ou o prazo daquele contexto.
- A mesma tarefa aparece na tabela, Kanban e roadmap.
- Alterações aparecem em todas as visualizações.

### Contexto

- Cada projeto possui uma página de contexto.
- O usuário pode adicionar e remover aliases.
- O usuário pode cadastrar termos relacionados.
- O agente consulta o contexto antes de classificar.
- Correções do usuário ficam registradas.
- Informações aprendidas podem ser confirmadas ou removidas.

### Classificação

- Uma entrada pode ser associada automaticamente a um projeto.
- A classificação mostra confiança.
- A classificação mostra evidências.
- Projetos alternativos são exibidos quando necessário.
- Entradas de baixa confiança permanecem na caixa de entrada.
- O usuário pode corrigir a classificação.
- O sistema procura tarefas semelhantes.

### Áudio

- O usuário consegue gravar ou enviar áudio.
- O áudio é transcrito.
- A transcrição pode ser editada.
- A transcrição é analisada pelo agente contextual.
- Um áudio pode produzir várias entidades relacionadas, priorizando cards, reuniões, notas e marcos.
- Reuniões mencionadas aparecem como propostas de reunião; informações importantes ou relevantes aparecem como propostas de nota.
- Contextos e tags podem ser propostos como apoio para tarefas futuras, sem substituir as saídas principais.
- Contextos, tarefas e demais entidades só são criados após confirmação.
- O agente não cria usuários ou entidades de pessoas.

### Reuniões e notificações

- É possível criar reunião com título, descrição, link opcional, data e horário.
- Projeto é opcional.
- Existe uma aba global de reuniões.
- Cada projeto possui uma aba com suas reuniões vinculadas.
- Reuniões e prazos geram lembretes e notificações.

### Trello

- O usuário consegue conectar um quadro.
- Listas são associadas a status.
- Cards podem ser importados.
- Alterações sincronizam nos dois sentidos.
- Conflitos não provocam perda silenciosa.
- Eventos repetidos não criam tarefas duplicadas.

### Planejamento

- O sistema gera um plano diário.
- Toda recomendação possui motivo.
- Toda recomendação possui próxima ação.
- Tarefas bloqueadas possuem alternativa.
- O usuário pode alterar a ordem.

### MCP

- Um cliente autorizado consegue consultar projetos.
- O agente consegue buscar contexto.
- Operações de escrita respeitam permissões.
- Ações sensíveis exigem confirmação.
- Toda operação fica registrada.

---

## Indicadores de sucesso

| Indicador | Meta |
|---|---:|
| Projetos visíveis em todas as visualizações | 100% |
| Tarefas com status definido após revisão | 95% |
| Tarefas importantes com prazo ou justificativa | 80% |
| Alterações sincronizadas com Trello | 95% |
| Conflitos com perda silenciosa | 0 |
| Entradas classificadas no projeto correto | 85% |
| Classificações de alta confiança aceitas sem troca de projeto | 90% |
| Sugestões aceitas após edição mínima | 70% |
| Duplicidades identificadas antes da criação | 80% |
| Plano diário gerado adequadamente | 95% |
| Redução de atualizações manuais duplicadas | 80% |
| Correções do usuário refletidas em classificações futuras | 80% |

---

## Definição de pronto do MVP

O MVP será considerado pronto quando o usuário conseguir:

1. Importar a planilha atual.
2. Revisar e organizar os registros.
3. Criar projetos, aliases e módulos.
4. Visualizar as demandas como tabela.
5. Mover as mesmas tarefas no Kanban.
6. Visualizar projetos e marcos no roadmap.
7. Encontrar todos os prazos em uma tela.
8. Registrar uma informação em texto.
9. Gravar um áudio e obter a transcrição.
10. Fazer o agente identificar o projeto mais provável.
11. Visualizar confiança e evidências.
12. Corrigir a classificação quando necessário.
13. Transformar a entrada em tarefa, decisão, bloqueio ou observação.
14. Encontrar possíveis demandas duplicadas.
15. Aprovar os cards antes da criação.
16. Sincronizar tarefas com o Trello.
17. Receber uma ordem de ação diária explicada.
18. Consultar e alterar dados por um cliente MCP autorizado.
19. Visualizar e editar o contexto conhecido pelo agente.
20. Utilizar a aplicação no computador e no navegador do celular.
