# Espaço do problema

Este documento mapeia o espaço do problema: como o trabalho é capturado, organizado e acompanhado hoje, onde a informação se fragmenta, quais atores e sistemas participam do fluxo e onde o contexto se perde. Ele expande a descrição resumida do documento `01-descricao-do-problema.md` e antecede a coleta de dados (`03-coleta-de-dados.md`). A solução proposta não faz parte deste mapa: ela aparece apenas no final, como referência de oportunidade, e está detalhada no PRD v2.0.

## 1. Contexto

O usuário-alvo administra simultaneamente vários projetos de software, com demandas institucionais, correções, funcionalidades, dependências externas e prazos. A base real observada inclui projetos como Intranet, Observa SEUMA, Guichê Virtual, PAX/VistaFor, Monitoramento do Ar e App Vistoria — CELAM/NUEE. Alguns projetos têm muitos registros, nomes anteriores, módulos diferentes e vocabulários próprios.

Nesse cenário, o planejamento vive dividido entre planilhas, Trello, anotações, áudios, reuniões e memória pessoal. Cada ferramenta resolve uma parte do problema, mas não existe continuidade entre capturar uma informação, classificá-la, transformá-la em tarefa e acompanhar sua evolução.

## 2. Situação atual ponta a ponta

O fluxo real, da chegada da demanda até o acompanhamento, acontece assim:

1. **Captura.** A demanda surge durante o trabalho: uma mensagem, um áudio, uma reunião, uma descoberta durante o desenvolvimento ou uma solicitação externa. O registro, quando acontece, é improvisado — uma anotação rápida, um card no Trello, uma linha na planilha ou apenas a memória do usuário.
2. **Transcrição e tradução.** Áudios e reuniões precisam ser convertidos manualmente em texto e atividades. Decisões tomadas em reunião dependem de o usuário lembrar de registrá-las depois.
3. **Classificação manual.** O usuário decide, sozinho e sem apoio, a qual projeto a demanda pertence, se é tarefa, bug, decisão ou bloqueio, qual a prioridade e se já existe algo semelhante registrado. Nada verifica duplicidade nem relaciona a demanda com histórico anterior.
4. **Registro.** A informação entra em uma das ferramentas disponíveis, frequentemente no campo errado da planilha (ver seção 3.1) ou como card solto no Trello.
5. **Organização e planejamento.** Tarefas são distribuídas em um Kanban; o roadmap é atualizado separadamente. Prazos e dependências raramente são registrados de forma estruturada.
6. **Execução.** O trabalho acontece nos repositórios e sistemas dos projetos; a ligação entre o que foi executado e o que foi planejado depende de atualização manual.
7. **Acompanhamento.** Para saber o estado real, o usuário precisa percorrer várias ferramentas, reconciliar informações inconsistentes e reconstruir mentalmente o contexto de cada projeto.

O ponto central do mapa: **não existe um momento em que a informação "nova" seja interpretada com base no contexto acumulado**. Cada etapa é manual, e o custo cognitivo de ligar as etapas recai inteiramente sobre o usuário.

## 3. Fontes de informação e fragmentação

As demandas chegam por múltiplas fontes, sem ponto único de entrada:

- Texto digitado ou colado em anotações soltas.
- Áudios gravados, que exigem transcrição manual.
- Reuniões, cujas decisões e encaminhamentos podem ser esquecidos.
- Mensagens e solicitações externas.
- Cards do Trello.
- A planilha de acompanhamento.
- Memória pessoal do usuário.

### 3.1 A planilha como síntese da fragmentação

A planilha atual é a principal interface de acompanhamento, mas sua estrutura é pouco consistente:

| Campo atual | Problema identificado |
|---|---|
| Demanda | Funciona como nome do projeto, mas aparece apenas na primeira linha do grupo. |
| Etapa/Responsável | Mistura status, etapa e responsável no mesmo campo. |
| Realizado | Contém atividades concluídas e tarefas ainda não executadas. |
| Pendências | Mistura bloqueios, próximas ações e solicitações. |
| Prazo | Poucos registros possuem prazo preenchido. |
| Observação | Contém dependências, retornos externos e informações operacionais. |

Ou seja, a ferramenta que deveria dar visão única concentra, em campos ambíguos, informações de naturezas diferentes — e é justamente por ela que o usuário tenta se orientar.

## 4. Tipos de demanda misturados

Uma mesma frase ou linha de planilha pode conter informações de naturezas distintas, que hoje recebem o mesmo tratamento. Os tipos que aparecem na prática incluem:

- Nova tarefa, bug, melhoria ou funcionalidade.
- Decisão tomada.
- Bloqueio ou dependência (inclusive de outros setores).
- Observação ou informação de contexto.
- Atualização de status, alteração de prioridade ou de prazo.
- Solicitação externa.
- Ideia futura e pergunta ainda não resolvida.

Como não há classificação estruturada, tarefas, bloqueios, decisões e observações ficam misturados nas mesmas linhas e campos. Consequência direta: não existe uma visão única das tarefas mais urgentes, e o usuário não consegue separar "o que fazer" de "o que está esperando terceiros" ou "o que já foi decidido".

## 5. Atores, sistemas e fronteiras

### 5.1 Atores

- **Usuário principal:** pessoa que administra todos os projetos; único usuário no cenário atual. É ao mesmo tempo quem captura, classifica, prioriza, executa e acompanha.
- **Setores e responsáveis externos:** retornos externos e validações aparecem como pendências e observações (por exemplo, validações que dependem de outros setores), mas sem entidade própria que os represente.

### 5.2 Sistemas envolvidos

- **Planilha:** acompanhamento geral, com os problemas da seção 3.1.
- **Trello:** quadros e cards por projeto; precisa ser atualizado manualmente em paralelo à planilha.
- **Repositórios de código e sistemas dos projetos:** onde o trabalho é executado; sem vínculo estruturado com tarefas e decisões.
- **Ferramentas de reunião/áudio/mensagens:** origem de grande parte das demandas, sem canal de entrada organizado.

### 5.3 Fronteiras do espaço do problema

**Dentro do espaço:** captura de informações desestruturadas; classificação de demandas por projeto, módulo e tipo; reconhecimento de aliases e vocabulário; organização de tarefas, prioridades, prazos, dependências e decisões; acompanhamento unificado; sincronização com o Trello.

**Fora do espaço (por decisão do PRD v2.0, não por limitação técnica):** colaboração simultânea entre equipes; chat entre usuários; controle de ponto ou financeiro; substituição integral do Trello; integrações com WhatsApp, e-mail ou Google Calendar; gestão avançada de capacidade de equipes; alteração automática de código, deploy ou decisões críticas sem aprovação.

## 6. Onde o contexto é perdido

O contexto é o ativo mais valioso e o mais frágil do fluxo atual. Ele se perde em pontos específicos:

- **Aliases e nomes anteriores.** O mesmo projeto pode ser chamado por nomes diferentes ("PAX" é o nome anterior de VistaFor). Sem cadastro de aliases, uma demanda que menciona o nome antigo não é ligada ao projeto correto.
- **Módulos e vocabulário.** Projetos possuem módulos (ex.: Loteamentos, Mapa) e termos próprios ("planta", "raster", "quadra", "loteamento"). Uma demanda que menciona esses termos provavelmente pertence a um projeto específico, mas esse conhecimento só existe na cabeça do usuário.
- **Decisões.** Decisões de reuniões podem ser esquecidas ou ficar enterradas em observações. Quando uma nova demanda chega, não há como consultar decisões anteriores que a influenciam — nem saber qual decisão foi substituída por outra.
- **Dependências e bloqueios.** Ficam registrados como texto livre em "Pendências" ou "Observação", sem vínculo com a tarefa dependente; não é possível saber o que está bloqueado por quê.
- **Prazos.** Poucos registros possuem prazo preenchido, e os existentes ficam escondidos entre várias linhas. Não há visão do que está atrasado, do que vence em breve ou do que está sem prazo.
- **Demandas semelhantes.** Sem busca por similaridade, demandas parecidas podem ser cadastradas mais de uma vez.

Qualquer ferramenta ou IA que opere sem esse contexto acumulado comete erros básicos — por exemplo, associar uma demanda ao projeto errado.

## 7. Dores, causas e impactos

Mapa causal do espaço do problema:

| Causa raiz | Dor experimentada | Impacto |
|---|---|---|
| Múltiplas fontes sem ponto único de entrada | Não saber onde registrar cada demanda; registrar de forma improvisada | Ideias dispersas ou esquecidas |
| Falta de classificação estruturada | Tarefas, bloqueios, decisões e observações misturados | Sem visão única do que é urgente ou do que está bloqueado |
| Contexto (aliases, módulos, vocabulário) apenas na memória do usuário | Cada registro exige decisões manuais repetidas; risco de classificação errada | Alto custo cognitivo; retrabalho; erros de associação |
| Decisões não registradas como entidade | Decisões de reuniões esquecidas | Novas demandas ignoram decisões anteriores; decisões duplicadas ou contraditórias |
| Prazos e dependências sem estrutura | Prazos escondidos entre linhas; bloqueios invisíveis | Atrasos não percebidos; planejamento não acompanha a execução |
| Mais de uma ferramenta para atualizar | Sincronização manual entre planilha e Trello | Tempo perdido; informações divergentes entre ferramentas |
| Áudio e reunião sem canal de entrada | Transcrição manual de áudios em atividades | Demandas vindas de voz/reunião sub-registradas |
| Muitas demandas sem priorização comparável | Dificuldade de decidir o que fazer primeiro | Progresso real difícil de visualizar; sensação de falta de controle |

## 8. Oportunidade

O espaço do problema aponta para uma oportunidade clara: **unificar captura, classificação, organização e acompanhamento em um único lugar que acumule contexto**. O princípio que dela decorre, adotado pelo PRD v2.0, é: o usuário informa o que aconteceu; o sistema entende onde aquilo pertence.

Isso implica, no nível do problema (não da implementação):

- Uma entrada única para qualquer tipo de informação (texto, áudio, reunião, Trello).
- Interpretação baseada em contexto acumulado por projeto: aliases, módulos, vocabulário, histórico, decisões e tarefas semelhantes.
- Classificação sempre acompanhada de confiança e evidências, com o usuário confirmando ou corrigindo — quanto mais sensível a ação, mais explícita a confirmação.
- Registro estruturado que diferencie tarefa, bug, decisão, bloqueio, dependência, prazo e observação.
- Visões múltiplas (tabular, Kanban, roadmap e prazos) sobre os mesmos dados, incluindo o que é familiar ao usuário hoje (a planilha).
- Falhas de IA ou de serviços externos nunca bloqueando o registro manual.

### 8.1 Limites da oportunidade

- A oportunidade é de organização **individual**: o espaço não contempla colaboração simultânea nem multiusuário.
- O Trello continua existindo como sistema sincronizado; a oportunidade não é substituí-lo integralmente.
- Automação não significa autonomia: ações sensíveis (alterar prioridade ou prazo, atualizar várias tarefas, tocar em código) dependem de aprovação do usuário; o backend permanece como fonte de verdade.
- O aprendizado do sistema com correções precisa ser sempre visualizável e editável pelo usuário.

## 9. Problema atual × solução proposta

Para evitar confundir o diagnóstico com a resposta, o quadro abaixo separa o que existe hoje do que o PRD v2.0 propõe:

| Problema atual | Resposta no PRD v2.0 / MVP |
|---|---|
| Demandas espalhadas por planilha, Trello, áudios, reuniões e memória | Caixa de entrada única de informações não estruturadas + importação da planilha atual |
| Classificação manual de projeto, módulo e tipo | Agente contextual que identifica projeto, módulo e tipo com confiança e evidências |
| Aliases e nomes anteriores não reconhecidos | Cadastro de aliases por projeto, confirmados pelo usuário e alimentados por correções |
| Módulos e vocabulário só na cabeça do usuário | Módulos e memória contextual por projeto, editáveis |
| Decisões esquecidas ou misturadas em observações | Entidade própria de decisão, com histórico e relações com tarefas |
| Dependências e bloqueios como texto livre | Dependências entre tarefas e status específicos (bloqueada, aguardando outro setor) |
| Prazos escondidos ou ausentes | Central de prazos, destaque de atrasadas/próximas/sem prazo, roadmap temporal |
| Atualização manual duplicada entre ferramentas | Integração bidirecional com o Trello sobre o mesmo dado |
| Áudio transcrito manualmente | Upload/gravação de áudio com transcrição automática |
| Sem visão única do que fazer hoje | Tela "Hoje" com plano de ação recomendado pela IA |
| Risco de duplicidade | Busca de demandas semelhantes antes da criação |
| IA sem contexto erraria o projeto | Confiança, evidências e confirmação proporcional ao risco; recursos manuais sempre disponíveis |

A validação dessas hipóteses sobre o comportamento do usuário segue em `03-coleta-de-dados.md`; a ideação e as funcionalidades decorrentes deste mapa estão em `05-ideacao-e-funcionalidades.md`.
