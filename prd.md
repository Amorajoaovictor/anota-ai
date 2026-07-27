# PRD — Organizador Pessoal Inteligente de Projetos

**Versão:** 2.0  
**Plataforma inicial:** Aplicação web responsiva / PWA  
**Plataformas futuras:** Android e iOS  
**Status:** Planejamento  
**Nome provisório:** Central de Projetos  
**Componente central de IA:** Agente contextual baseado em Hermes ou tecnologia equivalente  

---

# 1. Resumo executivo

O produto será uma central pessoal inteligente para organizar projetos, demandas, tarefas, prazos, decisões, bloqueios e próximos passos.

A aplicação deverá transformar informações desestruturadas — como áudios, anotações, transcrições de reuniões, mensagens e cards do Trello — em informações organizadas dentro do projeto correto.

O principal diferencial do produto será um **agente contextual de projetos**, inicialmente baseado em Hermes ou tecnologia equivalente.

Esse agente deverá acumular e consultar o contexto de cada projeto para compreender:

- A qual projeto uma nova demanda pertence.
- Qual módulo do projeto está sendo mencionado.
- Se a informação representa uma tarefa, bug, decisão, bloqueio, observação ou novo requisito.
- Se já existe uma demanda semelhante.
- Quais pessoas, sistemas e repositórios estão relacionados.
- Quais decisões anteriores influenciam a nova demanda.
- Qual deve ser a próxima ação recomendada.

O usuário poderá registrar uma demanda de forma natural, sem precisar informar manualmente todos os campos.

Exemplo:

> “A planta principal continua carregando automaticamente e travando o mapa. Coloca isso como prioridade alta.”

Com base no contexto acumulado, o agente deverá ser capaz de inferir:

- Projeto: VistaFor.
- Nome anterior ou alias: PAX.
- Módulo: Loteamentos / Mapa.
- Tipo: Bug.
- Prioridade: Alta.
- Possível relação com demandas anteriores sobre raster.
- Ação recomendada: revisar o carregamento padrão das plantas georreferenciadas.

Antes de criar ou alterar informações, o sistema deverá mostrar a classificação proposta e permitir que o usuário confirme ou corrija o resultado.

A aplicação combinará quatro formas principais de visualizar o trabalho:

1. Visualização semelhante a uma planilha.
2. Quadro Kanban.
3. Roadmap temporal.
4. Central de prazos e lembretes.

Também haverá integração bidirecional com o Trello, ferramentas MCP, transcrição de áudio, planejamento de ações por IA e, futuramente, um agente separado para auxiliar em alterações de código.

---

# 2. Visão do produto

## 2.1 Visão

Criar uma aplicação capaz de entender o contexto dos projetos do usuário e transformar qualquer nova informação em uma ação organizada, rastreável e relacionada ao projeto correto.

## 2.2 Proposta de valor

O usuário não deverá precisar lembrar onde registrar cada demanda.

Ele poderá simplesmente informar o que aconteceu.

O agente será responsável por:

1. Interpretar a informação.
2. Encontrar o projeto relacionado.
3. Identificar o tipo da demanda.
4. Verificar informações anteriores.
5. Propor uma tarefa estruturada.
6. Relacionar a demanda a outras tarefas ou decisões.
7. Registrar a informação após aprovação.

## 2.3 Princípio central

> O usuário informa o que aconteceu; o sistema entende onde aquilo pertence.

---

# 3. Problema

Atualmente, as demandas estão distribuídas entre planilhas, Trello, mensagens, anotações, áudios, reuniões e memória pessoal.

A planilha existente apresenta uma estrutura pouco consistente:

| Campo atual | Problema identificado |
|---|---|
| Demanda | Funciona como nome do projeto, mas aparece apenas na primeira linha do grupo |
| Etapa/Responsável | Mistura status, etapa e responsável |
| Realizado | Contém atividades concluídas e tarefas ainda não executadas |
| Pendências | Mistura bloqueios, próximas ações e solicitações |
| Prazo | Poucos registros possuem prazo preenchido |
| Observação | Contém dependências, retornos externos e informações operacionais |

A base inicial possui projetos como:

- Intranet.
- Observa SEUMA.
- Guichê Virtual.
- PAX / VistaFor.
- Monitoramento do Ar.
- App Vistoria — CELAM/NUEE.

Alguns projetos possuem muitos registros, nomes anteriores, módulos diferentes e vocabulários específicos.

Por exemplo, uma demanda que menciona “planta”, “raster”, “quadra” ou “loteamento” provavelmente está relacionada ao VistaFor, mesmo que o nome do projeto não seja informado.

## 3.1 Dificuldades atuais

- As demandas chegam sem uma classificação clara.
- Muitas informações dependem de contexto anterior.
- O mesmo projeto pode ser chamado por nomes diferentes.
- Não existe uma visão única das tarefas mais urgentes.
- Prazos ficam escondidos entre várias linhas.
- Tarefas, bloqueios, decisões e observações são misturados.
- O usuário precisa atualizar mais de uma ferramenta.
- Áudios precisam ser transformados manualmente em atividades.
- Decisões de reuniões podem ser esquecidas.
- Demandas semelhantes podem ser cadastradas mais de uma vez.
- A quantidade de projetos dificulta decidir o que fazer primeiro.
- Uma IA sem contexto pode associar a demanda ao projeto errado.

---

# 4. Objetivos do produto

## 4.1 Objetivo principal

Centralizar os projetos do usuário em uma aplicação capaz de compreender contexto, classificar novas demandas e transformá-las em um plano de execução claro.

## 4.2 Objetivos específicos

- Substituir a planilha como principal interface de acompanhamento.
- Preservar uma visualização tabular familiar.
- Oferecer Kanban, roadmap e central de prazos sobre os mesmos dados.
- Criar uma memória contextual para cada projeto.
- Identificar automaticamente a origem de novas demandas.
- Reconhecer nomes antigos, aliases, módulos e termos relacionados.
- Relacionar novas demandas a tarefas e decisões anteriores.
- Destacar tarefas atrasadas, próximas do prazo e sem prazo.
- Sincronizar projetos e tarefas com o Trello.
- Permitir criação de tarefas a partir de áudio ou texto.
- Usar IA para sugerir prioridades e próximos passos.
- Disponibilizar operações controladas por MCP.
- Preparar a arquitetura para um aplicativo mobile.
- Permitir, futuramente, alterações de código por um agente isolado e supervisionado.

---

# 5. Usuário-alvo

## 5.1 Usuário principal

Pessoa que administra simultaneamente vários projetos de software, demandas institucionais, correções, funcionalidades, dependências externas e prazos.

## 5.2 Necessidades principais

- Saber rapidamente o que fazer hoje.
- Registrar uma demanda sem interromper o fluxo de trabalho.
- Não precisar selecionar manualmente o projeto em toda nova entrada.
- Encontrar todas as demandas relacionadas a um projeto ou módulo.
- Transformar uma reunião ou áudio em atividades.
- Identificar o que está bloqueado.
- Consultar decisões tomadas anteriormente.
- Visualizar entregas futuras.
- Evitar demandas duplicadas.
- Atualizar Trello e aplicativo sem repetir trabalho.
- Pedir para uma IA reorganizar o plano quando as prioridades mudarem.
- Corrigir o agente quando uma demanda for classificada incorretamente.
- Fazer com que o sistema aprenda os termos usados em cada projeto.

---

# 6. Princípios do produto

## 6.1 Contexto antes da automação

O agente deverá consultar o contexto dos projetos antes de criar ou alterar qualquer demanda.

## 6.2 IA com evidências

Toda classificação deverá informar quais elementos levaram o agente à conclusão.

Exemplo:

```text
Projeto sugerido: VistaFor
Confiança: 93%

Evidências:
- O texto menciona “planta”.
- O texto menciona carregamento do mapa.
- Existem demandas anteriores sobre raster no VistaFor.
- “PAX” está cadastrado como alias do VistaFor.
```

## 6.3 Confirmação proporcional ao risco

A necessidade de confirmação deverá variar conforme a ação:

- Apenas classificar uma entrada: confirmação simplificada.
- Criar uma tarefa: confirmação normal.
- Alterar prioridade ou prazo: confirmação explícita.
- Atualizar várias tarefas: confirmação reforçada.
- Modificar código ou executar comandos: aprovação obrigatória.

## 6.4 Backend como fonte de verdade

O agente não deverá alterar o banco diretamente.

Todas as ações deverão passar pelos serviços e regras de negócio da aplicação.

## 6.5 Recursos manuais sempre disponíveis

Falhas do agente, do modelo ou dos serviços externos não poderão impedir o cadastro manual de projetos e tarefas.

## 6.6 Aprendizado corrigível

O agente deverá aprender com correções do usuário, mas toda associação aprendida deverá ser visualizável e editável.

---

# 7. Escopo do MVP

## 7.1 Incluído

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

## 7.2 Fora do MVP

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

---

# 8. Arquitetura conceitual

```text
Entradas
├── Texto digitado
├── Texto colado
├── Áudio gravado
├── Arquivo de áudio
├── Trello
├── Planilha
└── Cliente MCP
        ↓
Caixa de entrada
        ↓
Speech-to-text, quando necessário
        ↓
Agente contextual — Hermes ou equivalente
├── Consulta projetos
├── Consulta aliases
├── Consulta módulos
├── Consulta histórico
├── Consulta decisões
├── Consulta tarefas semelhantes
├── Identifica intenção
├── Calcula confiança
└── Propõe ação estruturada
        ↓
Revisão do usuário
        ↓
Serviços do backend
├── Projetos
├── Tarefas
├── Prazos
├── Roadmap
├── Trello
├── Memória contextual
└── Auditoria
```

## 8.1 Componentes principais

### Frontend

Responsável por:

- Visualizações.
- Formulários.
- Gravação de áudio.
- Revisão das sugestões.
- Exibição de confiança e evidências.
- Aprovação das ações.
- Administração da memória dos projetos.

### Backend principal

Responsável por:

- Regras de negócio.
- Autenticação.
- Projetos e tarefas.
- Prazos.
- Dependências.
- Auditoria.
- Sincronização.
- Controle de permissões.
- Execução das ações propostas pelo agente.

### Agente contextual

Responsável por:

- Interpretar informações não estruturadas.
- Consultar ferramentas e contexto.
- Escolher o projeto mais provável.
- Identificar o módulo.
- Detectar o tipo da entrada.
- Encontrar relações com dados existentes.
- Produzir uma proposta estruturada.
- Explicar a classificação.
- Solicitar esclarecimento quando necessário.

### Serviço de speech-to-text

Responsável apenas por transformar áudio em texto.

O provedor inicial poderá ser Gemini 2.5 Flash, Whisper ou serviço equivalente.

O agente contextual não deverá ser acoplado permanentemente ao provedor de transcrição.

### Modelo de linguagem

O agente poderá utilizar DeepSeek, Gemini, modelos locais ou outro provedor configurável.

O modelo será um componente interno do agente, e não uma dependência fixa do domínio da aplicação.

### MCP

Responsável por disponibilizar ferramentas estruturadas para o agente e clientes autorizados.

### Integração com Trello

Responsável pela sincronização determinística de cards, listas, prazos, membros e etiquetas.

---

# 9. Agente contextual de projetos

## 9.1 Responsabilidade

O agente contextual será o núcleo inteligente de entrada do sistema.

Ele deverá responder às seguintes perguntas:

1. A qual projeto essa informação pertence?
2. Qual módulo está sendo mencionado?
3. Que tipo de informação foi recebida?
4. Existe alguma demanda semelhante?
5. A entrada complementa uma tarefa existente?
6. Existe alguma decisão anterior relacionada?
7. Qual prioridade foi informada ou pode ser sugerida?
8. Existe um prazo explícito?
9. Qual ação deverá ser realizada?
10. Qual é a confiança da classificação?

## 9.2 Tipos de entrada reconhecidos

- Nova tarefa.
- Bug.
- Melhoria.
- Funcionalidade.
- Decisão.
- Bloqueio.
- Dependência.
- Observação.
- Atualização de status.
- Alteração de prioridade.
- Alteração de prazo.
- Solicitação externa.
- Ideia futura.
- Pergunta ainda não resolvida.
- Informação de contexto.

## 9.3 Contexto permanente

Cada projeto deverá possuir informações relativamente estáveis:

- Nome oficial.
- Nomes anteriores.
- Aliases.
- Descrição.
- Objetivo.
- Vocabulário relacionado.
- Módulos.
- Sistemas envolvidos.
- Repositórios.
- Tecnologias.
- Responsáveis.
- Setores envolvidos.
- Integrações.
- Documentações relacionadas.

Exemplo:

```yaml
project:
  name: VistaFor
  aliases:
    - PAX
    - Plataforma de loteamentos
    - Plataforma de logradouros

  terms:
    - planta
    - raster
    - loteamento
    - quadra
    - matrícula
    - logradouro
    - mapa
    - georreferenciamento

  modules:
    - Loteamentos
    - Logradouros
    - Normas jurídicas
    - Mapa
```

## 9.4 Contexto operacional

Informações atualizadas constantemente:

- Tarefas abertas.
- Bugs recentes.
- Prazos.
- Bloqueios.
- Últimas decisões.
- Alterações recentes.
- Marcos.
- Responsáveis atuais.
- Pull requests relacionados.
- Estado das integrações.
- Próximos passos.

## 9.5 Memória de conversa

Informações temporárias ou correções dadas pelo usuário:

- “Quando eu falar PAX, considere VistaFor.”
- “Essa demanda pertence ao módulo de loteamentos.”
- “Esse problema já foi resolvido.”
- “Toda demanda sobre medidas deve ir para validação da CEGEO.”

Essas informações poderão ser promovidas para o contexto permanente mediante aprovação.

## 9.6 Fluxo de classificação

1. Receber texto ou transcrição.
2. Detectar entidades relevantes.
3. Buscar projetos candidatos.
4. Consultar aliases e vocabulário.
5. Consultar tarefas semelhantes.
6. Consultar decisões anteriores.
7. Calcular confiança por projeto.
8. Identificar o tipo da entrada.
9. Extrair prioridade, prazo e responsável.
10. Gerar proposta estruturada.
11. Exibir evidências.
12. Solicitar confirmação ou esclarecimento.
13. Executar a ação por meio do backend.
14. Registrar a classificação e a correção do usuário.

## 9.7 Níveis de confiança

### Confiança alta — 85% ou mais

O sistema poderá selecionar automaticamente o projeto, mas deverá mostrar a classificação antes da confirmação final da tarefa.

### Confiança média — entre 60% e 84%

O sistema deverá destacar os projetos mais prováveis e solicitar uma confirmação simples.

### Confiança baixa — abaixo de 60%

O sistema deverá manter a entrada na caixa de entrada e perguntar ao usuário a qual projeto ela pertence.

## 9.8 Desambiguação

Exemplo:

```text
Demanda:
“A tela de processos não está mostrando o prazo.”

Projetos candidatos:
1. Processos Acompanhados — 72%
2. ARPA 2 — 25%
3. Outro projeto — 3%
```

O sistema deverá perguntar:

> Essa demanda pertence ao ARPA 2 ou ao Processos Acompanhados?

A resposta deverá ser utilizada como sinal para classificações futuras.

## 9.9 Detecção de duplicidade

Antes da criação de uma tarefa, o agente deverá pesquisar:

- Títulos semelhantes.
- Descrições semanticamente relacionadas.
- Mesmo módulo.
- Mesmo erro.
- Mesma origem.
- Cards relacionados no Trello.

Possíveis resultados:

- Criar nova tarefa.
- Atualizar tarefa existente.
- Criar subtarefa.
- Adicionar observação.
- Relacionar as duas demandas.
- Descartar como duplicada.

## 9.10 Saída estruturada

```json
{
  "inputType": "bug",
  "suggestedProject": {
    "id": "project-id",
    "name": "VistaFor",
    "confidence": 0.93
  },
  "suggestedModule": {
    "name": "Mapa / Loteamentos",
    "confidence": 0.88
  },
  "task": {
    "title": "Impedir carregamento automático da planta principal",
    "description": "A planta principal continua carregando automaticamente e causando travamentos no mapa.",
    "priority": "P1",
    "deadline": null
  },
  "relatedItems": [],
  "evidence": [
    "O texto menciona planta principal.",
    "O texto menciona travamento do mapa.",
    "Existem tarefas anteriores sobre raster no projeto."
  ],
  "questions": [],
  "requiresConfirmation": true
}
```

---

# 10. Estrutura de informações

## 10.1 Projeto

Cada projeto deverá possuir:

| Campo | Obrigatório |
|---|---:|
| Nome | Sim |
| Descrição | Não |
| Status | Sim |
| Prioridade | Sim |
| Cor ou ícone | Não |
| Data de início | Não |
| Data-alvo | Não |
| Responsável principal | Não |
| Objetivo | Não |
| Quadro Trello vinculado | Não |
| Repositórios vinculados | Não |
| Progresso | Calculado |
| Última atualização | Automático |
| Arquivado | Automático/manual |

## 10.2 Alias do projeto

- Nome alternativo.
- Nome antigo.
- Sigla.
- Origem do alias.
- Data de criação.
- Criado automaticamente ou manualmente.
- Confirmado pelo usuário.

## 10.3 Módulo

- Nome.
- Projeto.
- Descrição.
- Termos relacionados.
- Responsáveis.
- Repositórios relacionados.
- Documentação.
- Status.

## 10.4 Entrada contextual

Representa qualquer informação recebida antes de ser transformada em uma entidade definitiva.

Campos:

- Conteúdo original.
- Tipo de origem.
- Transcrição.
- Data.
- Projetos candidatos.
- Classificação sugerida.
- Confiança.
- Evidências.
- Status da revisão.
- Ação executada.
- Correções do usuário.

## 10.5 Tarefa

Cada tarefa deverá possuir:

- Título.
- Descrição.
- Projeto.
- Módulo.
- Tipo.
- Status.
- Prioridade herdada ou específica.
- Responsável.
- Data de início.
- Prazo.
- Estimativa de esforço.
- Etiquetas.
- Bloqueadores.
- Dependências.
- Subtarefas.
- Origem da informação.
- Entrada contextual de origem.
- Link do Trello.
- Repositório relacionado.
- Pull request relacionado.
- Data da última sincronização.
- Observações.
- Anexos.
- Histórico de alterações.

## 10.6 Decisão

- Título.
- Projeto.
- Módulo.
- Descrição.
- Data.
- Participantes.
- Origem.
- Motivo.
- Consequências.
- Tarefas relacionadas.
- Decisão substituída, quando aplicável.

## 10.7 Memória contextual

- Projeto.
- Categoria.
- Informação.
- Fonte.
- Confiança.
- Data de criação.
- Última utilização.
- Status de confirmação.
- Expiração opcional.
- Editável pelo usuário.

## 10.8 Marco

- Nome.
- Projeto.
- Data de início opcional.
- Data prevista.
- Status: `Planejado`, `Em andamento`, `Atingido`, `Adiado` ou `Cancelado`.
- Tarefas vinculadas em relação muitos-para-muitos: uma tarefa pode participar de vários marcos do mesmo projeto.
- Dependências.
- Descrição do resultado esperado.
- Cor herdada do projeto.
- Arquivamento separado do status.
- Progresso calculado pela proporção de tarefas vinculadas concluídas; marco sem tarefas permanece com 0%.

Marcos representam pontos-chave de resultado, não etapas do fluxo. Portanto, não substituem status, tarefas ou prazos. Ao remover um marco, as tarefas são preservadas e somente o vínculo é removido.

---

# 11. Prioridades e status

## 11.1 Prioridades

- **P0 — Crítica:** precisa de ação imediata.
- **P1 — Alta:** deve avançar na semana atual.
- **P2 — Média:** importante, mas não urgente.
- **P3 — Baixa:** pode esperar.
- **Sem prioridade:** ainda não classificada.

Uma tarefa herdará inicialmente a prioridade do projeto, mas poderá ter uma prioridade própria.

## 11.2 Status padrão

- Caixa de entrada.
- A revisar.
- Backlog.
- Planejada.
- Em andamento.
- Bloqueada.
- Aguardando outro setor.
- Em validação.
- Concluída.
- Cancelada.

---

# 12. Telas do produto

## 12.1 Tela “Hoje”

Será a página inicial.

### Componentes

- Saudação e data.
- Tarefas atrasadas.
- Prazos dos próximos sete dias.
- Projetos prioritários.
- Plano de ação recomendado.
- Tarefas bloqueadas.
- Entradas aguardando classificação.
- Classificações de baixa confiança.
- Alterações recentes no Trello.
- Ações rápidas:
  - Nova tarefa.
  - Novo projeto.
  - Gravar áudio.
  - Colar texto.
  - Sincronizar Trello.
  - Recalcular plano.

### Plano diário

Cada recomendação deverá apresentar:

1. Tarefa.
2. Projeto.
3. Módulo.
4. Motivo da posição.
5. Prazo.
6. Esforço estimado.
7. Dependências.
8. Próxima ação concreta.
9. Alternativa em caso de bloqueio.

## 12.2 Caixa de entrada inteligente

Todas as informações capturadas rapidamente serão armazenadas inicialmente na caixa de entrada.

### Formas de entrada

- Texto digitado.
- Texto colado.
- Áudio gravado.
- Arquivo de áudio.
- Card recebido do Trello.
- Entrada criada por MCP.
- Importação de planilha.

### Estados

- Recebida.
- Transcrevendo.
- Analisando contexto.
- Aguardando confirmação.
- Processada.
- Descartada.
- Com erro.

### Informações exibidas

- Conteúdo original.
- Projeto sugerido.
- Módulo sugerido.
- Tipo sugerido.
- Confiança.
- Evidências.
- Possíveis duplicidades.
- Ação sugerida.

## 12.3 Tela de revisão contextual

A tela deverá apresentar:

- Texto original.
- Transcrição.
- Resumo.
- Projeto sugerido.
- Projetos alternativos.
- Módulo sugerido.
- Tipo da entrada.
- Cards sugeridos.
- Decisões identificadas.
- Prioridade sugerida.
- Prazo identificado.
- Responsável identificado.
- Dependências.
- Demandas semelhantes.
- Evidências da classificação.
- Nível de confiança.
- Trechos que originaram cada informação.

### Ações

- Confirmar.
- Editar.
- Escolher outro projeto.
- Escolher outro módulo.
- Criar nova tarefa.
- Atualizar tarefa existente.
- Criar subtarefa.
- Registrar apenas como observação.
- Registrar como decisão.
- Unir sugestões.
- Dividir sugestões.
- Descartar.
- Enviar ao Trello.

## 12.4 Visualização em planilha

### Colunas iniciais

- Projeto.
- Módulo.
- Tipo.
- Tarefa.
- Status.
- Responsável.
- Prioridade.
- Início.
- Prazo.
- Dias restantes.
- Bloqueio.
- Etiquetas.
- Origem.
- Trello.
- Confiança da classificação.
- Última atualização.
- Observação.

### Funcionalidades

- Ordenação.
- Filtros salvos.
- Edição direta.
- Seleção múltipla.
- Alteração em massa.
- Agrupamento por projeto.
- Agrupamento por módulo.
- Agrupamento por status.
- Colunas configuráveis.
- Exportação para XLSX e CSV.
- Destaque visual para atrasos.
- Indicador de sincronização.
- Indicador de origem por IA.
- Abertura em painel lateral.

## 12.5 Kanban

O Kanban utilizará os mesmos registros da visualização tabular.

### Funcionalidades

- Colunas correspondentes aos status.
- Arrastar e soltar cards.
- Filtro por projeto.
- Filtro por módulo.
- Filtro por prioridade.
- Filtro por responsável.
- Filtro por marco, incluindo a opção `Sem marco`.
- Badge dos marcos vinculados em cada card.
- Criação de card com filtro de marco ativo vincula o novo card ao marco.
- Limite visual de tarefas em andamento.
- Destaque para prazo vencido.
- Destaque para bloqueios.
- Agrupamento opcional por projeto.
- Sincronização com o Trello.

## 12.6 Roadmap

### Modos de visualização

- Semana.
- Mês.
- Trimestre.
- Ano.

### Elementos

- Faixa de duração do projeto.
- Módulos.
- Marcos.
- Tarefas.
- Dependências.
- Data atual.
- Projetos atrasados.
- Progresso planejado e realizado.
- Tarefas sem data.
- Filtros por prioridade, projeto e status.
- Marcador do marco na data prevista, com nome, status e progresso agregado.
- Clique no marcador abre resumo e tarefas vinculadas sem sair do roadmap.
- Filtro por marco destaca as tarefas participantes.

## 12.6.1 Visão de marcos

- Página própria por projeto e visão consolidada.
- Criar, editar, atingir, adiar, cancelar, arquivar e remover marco.
- Abrir painel de detalhe com datas, resultado esperado, progresso e tarefas vinculadas.
- Editar nome, data de início, data prevista, status e resultado esperado no painel de detalhe.
- Projeto permanece imutável durante a edição para preservar os vínculos das tarefas.
- Exibir data prevista, resultado esperado, status e progresso.
- Listar e abrir tarefas vinculadas.
- Permitir vínculo de uma tarefa a vários marcos do mesmo projeto.
- Remoção de marco não remove tarefas.

## 12.7 Central de prazos

### Seções

- Atrasadas.
- Vencem hoje.
- Próximos três dias.
- Próximos sete dias.
- Próximos trinta dias.
- Sem prazo.
- Aguardando retorno externo.

### Funcionalidades

- Adiar prazo com justificativa.
- Marcar como concluída.
- Criar lembrete.
- Filtrar por projeto.
- Exibir quantidade de adiamentos.
- Mostrar tarefas bloqueadoras.
- Mostrar prazo original e atual.
- Registrar histórico.

Nenhum prazo deverá ser alterado automaticamente pelo agente.

## 12.8 Detalhe do projeto

Cada projeto terá uma página com:

- Objetivo.
- Prioridade.
- Status.
- Responsável.
- Progresso.
- Data-alvo.
- Próximo marco.
- Próxima ação.
- Tarefas por status.
- Tarefas atrasadas.
- Tarefas bloqueadas.
- Roadmap.
- Trello conectado.
- Repositórios.
- Histórico recente.
- Decisões recentes.
- Resumo gerado por IA.
- Vocabulário e aliases.
- Memórias contextuais.
- Classificações recentes.

## 12.9 Gestão de contexto

O usuário deverá conseguir consultar e editar o que o agente conhece sobre cada projeto.

### Seções

- Descrição do projeto.
- Nomes e aliases.
- Módulos.
- Termos relacionados.
- Pessoas e setores.
- Tecnologias.
- Repositórios.
- Decisões importantes.
- Regras aprendidas.
- Memórias sugeridas.
- Informações desatualizadas.

### Ações

- Adicionar memória.
- Corrigir memória.
- Confirmar informação aprendida.
- Remover informação.
- Definir expiração.
- Promover memória temporária para permanente.
- Visualizar quais classificações utilizaram a informação.

---

# 13. Fluxo de áudio e texto

## 13.1 Áudio para transcrição

1. Usuário grava ou envia áudio.
2. Arquivo é validado.
3. Áudio é armazenado temporariamente.
4. Serviço de speech-to-text gera a transcrição.
5. Texto original é preservado.
6. A transcrição é enviada ao agente contextual.
7. O agente consulta os projetos.
8. O sistema mostra a classificação.
9. O usuário confirma ou corrige.
10. As ações aprovadas são executadas.

## 13.2 Requisitos da transcrição

- Português brasileiro como idioma padrão.
- Pontuação automática.
- Identificação de falantes quando disponível.
- Timestamps quando disponíveis.
- Destaque de trechos incertos.
- Possibilidade de edição.
- Política configurável de retenção do áudio.
- Reprocessamento com outro provedor.

## 13.3 Extração contextual

A extração não deverá ser limitada à criação de cards.

O agente poderá identificar:

- Tarefas.
- Bugs.
- Decisões.
- Bloqueios.
- Perguntas.
- Prazos.
- Prioridades.
- Atualizações de status.
- Dependências.
- Informações para a memória do projeto.

---

# 14. Integração com Trello

## 14.1 Papel do Trello

O Trello continuará sendo uma ferramenta operacional sincronizada.

O banco do aplicativo será a fonte principal para:

- Memória contextual.
- Dependências.
- Prioridade calculada.
- Roadmap.
- Histórico de IA.
- Decisões.
- Transcrições.
- Auditoria.
- Classificações.
- Evidências.

## 14.2 Mapeamento

| Aplicativo | Trello |
|---|---|
| Projeto | Quadro |
| Status | Lista |
| Tarefa | Card |
| Subtarefa | Checklist |
| Responsável | Membro |
| Etiqueta | Label |
| Prazo | Due date |
| Descrição | Description |
| Anexo | Attachment |

## 14.3 Sincronização aplicativo → Trello

- Criar tarefa cria card.
- Alterar título atualiza card.
- Mover no Kanban move card.
- Alterar prazo atualiza due date.
- Concluir tarefa atualiza o card.
- Arquivar tarefa arquiva card.

## 14.4 Sincronização Trello → aplicativo

- Novo card cria tarefa ou entrada.
- Movimento altera status.
- Alteração de prazo atualiza tarefa.
- Alteração de descrição atualiza descrição.
- Card arquivado altera o estado local.
- Membros atualizam responsáveis.

## 14.5 Trello como entrada contextual

Cards criados diretamente no Trello poderão passar pelo agente para:

- Identificar o projeto interno.
- Identificar o módulo.
- Detectar duplicidades.
- Relacionar com tarefas existentes.
- Sugerir prioridade.
- Atualizar contexto.

## 14.6 Conflitos

O sistema não deverá sobrescrever informações silenciosamente.

Deverá permitir:

- Manter valor do aplicativo.
- Manter valor do Trello.
- Mesclar.
- Adiar a resolução.

---

# 15. MCP

## 15.1 Objetivo

Permitir que o agente contextual e clientes externos consultem e alterem informações de forma estruturada e controlada.

## 15.2 Ferramentas principais

### Projetos

- `projects.list`
- `projects.get`
- `projects.create`
- `projects.update`
- `projects.search_context`

### Módulos e contexto

- `modules.list`
- `modules.get`
- `context.search`
- `context.add`
- `context.update`
- `context.confirm`
- `context.delete`

### Tarefas

- `tasks.list`
- `tasks.get`
- `tasks.search_similar`
- `tasks.create`
- `tasks.update`
- `tasks.move`
- `tasks.complete`
- `tasks.add_dependency`

### Decisões

- `decisions.list`
- `decisions.create`
- `decisions.link_task`

### Prazos e roadmap

- `deadlines.list`
- `roadmap.get`
- `action_plan.generate`

### Caixa de entrada

- `inbox.create`
- `inbox.classify`
- `inbox.confirm`
- `inbox.discard`

### Integrações

- `trello.sync`
- `sync.conflicts.list`
- `repositories.list`

## 15.3 Permissões

- Leitura.
- Classificação.
- Criação.
- Atualização.
- Sincronização.
- Administração de contexto.
- Operações sensíveis.

## 15.4 Operações sensíveis

Exigirão confirmação:

- Alterar prazos.
- Alterar prioridades críticas.
- Atualizar várias tarefas.
- Arquivar informações.
- Alterar memória permanente.
- Enviar informações para serviços externos.
- Criar ou modificar código.
- Executar comandos.

## 15.5 Auditoria

Toda chamada deverá registrar:

- Usuário.
- Agente ou cliente.
- Ferramenta.
- Parâmetros.
- Resultado.
- Data.
- Alterações.
- Confirmação.
- Contexto utilizado.

---

# 16. Planejador de ação

## 16.1 Objetivo

Responder de forma confiável:

> O que devo fazer agora?

## 16.2 Entradas

- Prioridade do projeto.
- Prioridade da tarefa.
- Prazo.
- Esforço estimado.
- Dependências.
- Bloqueios.
- Tempo sem atualização.
- Quantidade de tarefas dependentes.
- Status.
- Disponibilidade do usuário.
- Decisões recentes.
- Contexto operacional.

## 16.3 Estratégia

A ordenação deverá combinar regras determinísticas e análise contextual.

### Score inicial

- Urgência do prazo: até 40 pontos.
- Prioridade do projeto: até 25 pontos.
- Impacto sobre outras tarefas: até 20 pontos.
- Possibilidade de conclusão rápida: até 10 pontos.
- Tempo sem atualização: até 5 pontos.
- Penalidade para tarefas bloqueadas.

### Papel do agente

- Avaliar o contexto.
- Detectar conflitos.
- Organizar a sequência.
- Explicar a recomendação.
- Sugerir próxima ação.
- Identificar informações faltantes.
- Oferecer alternativa para tarefas bloqueadas.

---

# 17. Agente de desenvolvimento de código

## 17.1 Diretriz

A alteração de código não deverá ser executada pelo mesmo perfil de agente que administra os projetos.

Deverão existir dois ambientes isolados.

## 17.2 Agente pessoal

Poderá acessar:

- Projetos.
- Tarefas.
- Contexto.
- Trello.
- Prazos.
- Roadmap.
- Decisões.

Não poderá:

- Executar shell.
- Alterar repositórios.
- Fazer deploy.
- Ler segredos.
- Acessar produção diretamente.

## 17.3 Agente desenvolvedor

Poderá acessar:

- Clone controlado do repositório.
- Documentação.
- Issues.
- Tarefas aprovadas.
- Testes.
- Lint.
- Build.
- Git.

## 17.4 Regras obrigatórias

- Nunca editar diretamente a branch principal.
- Criar branch própria.
- Mostrar plano antes da alteração.
- Gerar diff.
- Executar testes relevantes.
- Não acessar segredos.
- Não fazer deploy automático.
- Não realizar merge automático.
- Solicitar aprovação antes de publicar alterações.
- Registrar quais tarefas e decisões originaram a mudança.

## 17.5 Escopo

A integração com código deverá ser tratada como evolução posterior ao MVP principal.

---

# 18. Importação da planilha existente

## Regras propostas

| Coluna original | Destino |
|---|---|
| Demanda | Projeto |
| Etapa/Responsável | Status ou responsável |
| Realizado | Título inicial |
| Pendências | Bloqueador, observação ou tarefa |
| Prazo | Prazo |
| Observação | Observação ou contexto |

## Tratamentos

- Preencher o projeto nas linhas seguintes.
- Converter datas do Excel.
- Tratar hífen e células vazias.
- Preservar quebras de linha.
- Detectar duplicidades.
- Não considerar automaticamente “Realizado” como concluído.
- Criar status “A revisar”.
- Permitir correção em massa.
- Exibir quantidade por projeto.
- Gerar relatório de falhas.
- Criar aliases quando nomes antigos forem identificados.
- Sugerir módulos com base no vocabulário.
- Utilizar os registros importados para construir o contexto inicial.

---

# 19. Requisitos não funcionais

## 19.1 Desempenho

- Telas principais carregadas em até três segundos.
- Alterações refletidas imediatamente.
- Listas extensas virtualizadas.
- Classificação contextual com status visível.
- Operações de IA processadas em fila.
- Webhooks idempotentes.
- Busca contextual com resposta adequada ao uso interativo.

## 19.2 Disponibilidade

- Falhas do Trello não impedem uso local.
- Falhas do agente não impedem criação manual.
- Falhas do STT não impedem entrada de texto.
- Operações pendentes são reenviadas.
- Estado de sincronização permanece visível.

## 19.3 Segurança

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

## 19.4 Explicabilidade

Toda ação proposta pelo agente deverá registrar:

- Contexto consultado.
- Evidências utilizadas.
- Projeto escolhido.
- Confiança.
- Correções realizadas pelo usuário.
- Ferramentas executadas.

## 19.5 Portabilidade

- API independente do frontend.
- Contratos documentados.
- Componentes responsivos.
- Autenticação preparada para mobile.
- Modelos de IA substituíveis.
- Provedor de STT substituível.
- Agente contextual desacoplado do banco.

---

# 20. Indicadores de sucesso

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

# 21. Critérios de aceite do MVP

## 21.1 Projetos e tarefas

- É possível criar, editar e arquivar projetos.
- Projetos podem possuir aliases e módulos.
- É possível criar e editar tarefas.
- A mesma tarefa aparece na tabela, Kanban e roadmap.
- Alterações aparecem em todas as visualizações.

## 21.2 Contexto

- Cada projeto possui uma página de contexto.
- O usuário pode adicionar e remover aliases.
- O usuário pode cadastrar termos relacionados.
- O agente consulta o contexto antes de classificar.
- Correções do usuário ficam registradas.
- Informações aprendidas podem ser confirmadas ou removidas.

## 21.3 Classificação

- Uma entrada pode ser associada automaticamente a um projeto.
- A classificação mostra confiança.
- A classificação mostra evidências.
- Projetos alternativos são exibidos quando necessário.
- Entradas de baixa confiança permanecem na caixa de entrada.
- O usuário pode corrigir a classificação.
- O sistema procura tarefas semelhantes.

## 21.4 Áudio

- O usuário consegue gravar ou enviar áudio.
- O áudio é transcrito.
- A transcrição pode ser editada.
- A transcrição é analisada pelo agente contextual.
- Tarefas só são criadas após confirmação.

## 21.5 Trello

- O usuário consegue conectar um quadro.
- Listas são associadas a status.
- Cards podem ser importados.
- Alterações sincronizam nos dois sentidos.
- Conflitos não provocam perda silenciosa.
- Eventos repetidos não criam tarefas duplicadas.

## 21.6 Planejamento

- O sistema gera um plano diário.
- Toda recomendação possui motivo.
- Toda recomendação possui próxima ação.
- Tarefas bloqueadas possuem alternativa.
- O usuário pode alterar a ordem.

## 21.7 MCP

- Um cliente autorizado consegue consultar projetos.
- O agente consegue buscar contexto.
- Operações de escrita respeitam permissões.
- Ações sensíveis exigem confirmação.
- Toda operação fica registrada.

---

# 22. Plano de execução

## Fase 0 — Regras do produto

**Situação: concluída em discussão.**

- Projetos são quadros ativos ou arquivados; não entram no Kanban.
- Cards exigem título e projeto. Nascem em `Backlog`, com prioridade `P3`, tipo `Tarefa` e complexidade vazia até análise da IA.
- Kanban usa `Backlog`, `Em andamento`, `Bloqueada`, `Em validação`, `Concluída` e `Cancelada`. `A revisar` pertence somente à aba `Revisão IA`.
- Ações da IA são propostas completas para aprovação única. Tags e aliases podem ser criados automaticamente.
- Cards usam tipos: Tarefa, Bug, Melhoria, Funcionalidade, Decisão, Solicitação externa, Ideia futura e Pergunta.
- Dependências são vínculos entre cards e projetos. Marcos aparecem na visão própria, no roadmap, no histórico e como filtro/badge no Kanban. Bloqueio é um status.
- Notas são privadas; Contextos exigem projeto, podem vincular card e ficam disponíveis para IA e MCP.
- Prazo confirmado e previsão de entrega são campos distintos. Complexidade baixa, média ou alta alimenta a previsão.

## Fase 1 — Protótipos e experiência

- Criar wireframes e protótipo navegável dos módulos: Hoje, Projetos, Planilha, Kanban, Marcos, Roadmap, Prazos, Calendário, Notas e Revisão IA.
- Definir navegação, design system e fluxos principais: criar card, converter nota, aprovar ação da IA e editar pela agenda.
- Validar protótipos com demandas reais antes de implementação.

## Fase 2 — Fundação técnica

- Criar aplicação web responsiva/PWA, autenticação, API, banco de dados, armazenamento de anexos e auditoria.
- Preparar fila para IA, transcrição e lembretes.
- Criar estrutura de testes para regras de negócio, permissões, integrações e erros.

## Fase 3 — Projetos e cards

- Criar projetos, arquivamento, prioridades de projetos, aliases e tags.
- Criar cards, tipos, prioridades, status, complexidade, prazos, previsões, dependências e histórico.
- Criar notas privadas e contextos vinculados a projeto e, opcionalmente, card.
- Implementar visualização Planilha e Kanban como duas visões dos mesmos cards.

## Fase 4 — IA, áudio e Revisão IA

- Receber texto, áudio e anexos; transcrever e excluir áudio de entrada após processamento.
- IA produz uma proposta única de classificação, prazo, previsão, complexidade e ação.
- Criar aba Revisão IA para aprovar, editar ou rejeitar propostas antes de executar ações sensíveis.
- Permitir criação automática de tags e aliases; manter notas manuais fora de IA/MCP por padrão.

## Fase 5 — Roadmap, prazos, agenda e lembretes

- Criar visão de Marcos, vínculos muitos-para-muitos com cards, Roadmap e histórico de marcos.
- Criar telas Hoje e Prazos.
- Criar agenda/calendário derivada de cards, roadmap, prazos, previsões e reuniões; edição nela atualiza origem.
- Lembrar metade do prazo, 7, 3 e 1 dia antes para prazo confirmado e previsão. Previsão vencida é alerta, não atraso.

## Fase 6 — Plano de ação

- Gerar ordem de execução por prioridade da tarefa, prioridade do projeto e data do card.
- Permitir intercalar cards de projetos diferentes.
- Usar complexidade, dependências, bloqueios e previsão vencida para recomendação e estimativa de entrega.
- Usuário pode alterar plano e metas a qualquer momento.

## Fase 7 — MCP

- Disponibilizar leitura e escrita controlada de projetos, cards e contextos.
- Aplicar escopos, aprovações, auditoria e regra de privacidade das notas.

## Fase 8 — PWA e mobile

- Implementar instalação, responsividade, notificações, cache e conectividade limitada.
- Manter contratos preparados para aplicativo mobile futuro.

## Fase 9 — Agente desenvolvedor

**Evolução futura.**

- Integrar repositórios em ambiente isolado.
- Criar branches, diffs, testes e pull requests somente após aprovação.

## Fase 10 — Google Calendar

**Última fase do plano.**

- Integrar Google Calendar em duas vias.
- Sincronizar prazos limite e reuniões.
- Alterações feitas no Google Calendar vencem conflitos com aplicativo.
- Prevenir duplicidades e registrar sincronizações.

---

# 23. Backlog priorizado

## P0 — Primeiro uso

- Projetos.
- Módulos.
- Tarefas.
- Prioridades.
- Status.
- Planilha.
- Importação.
- Kanban.
- Prazos.
- Busca.
- Histórico.
- Layout responsivo.

## P1 — Diferencial principal

- Caixa de entrada inteligente.
- Agente contextual.
- Memória por projeto.
- Aliases.
- Classificação automática.
- Confiança e evidências.
- Áudio para texto.
- Revisão contextual.
- Busca de duplicidades.
- Plano de ação.

## P2 — Integrações e expansão

- Trello bidirecional.
- Roadmap.
- MCP.
- PWA.
- Notificações.
- Decisões.
- Aprendizado com correções.
- Resumos automáticos.

## P3 — Evolução futura

- Agente desenvolvedor.
- Aplicativo mobile.
- Google Calendar.
- E-mail.
- WhatsApp.
- Colaboração.
- Calendário compartilhado.
- Automações avançadas.

---

# 24. Riscos principais

| Risco | Mitigação |
|---|---|
| Agente associar demanda ao projeto errado | Confiança, evidências e confirmação |
| Memória ficar desatualizada | Gestão de contexto e expiração |
| Contexto de projetos diferentes se misturar | Isolamento por projeto e módulo |
| IA criar informações inexistentes | Schema, evidências e revisão |
| Criação de tarefas duplicadas | Busca semântica antes da criação |
| Dados inconsistentes da planilha | Importação com revisão |
| Ciclo entre aplicativo e Trello | Idempotência e origem da operação |
| Perda em conflitos | Versionamento e resolução manual |
| Agente alterar prazo indevidamente | Confirmação explícita |
| Modelo específico deixar de existir | Camada de adaptação |
| Áudios conterem dados sensíveis | Retenção e exclusão configuráveis |
| MCP executar ação indevida | Escopos e auditoria |
| Agente de código causar regressões | Isolamento, testes, diff e aprovação |
| Contexto malicioso em documentos | Validação e proteção contra instruções externas |
| Excesso de escopo no MVP | Implementação por fases |

---

# 25. Decisões de produto

1. O agente contextual será uma funcionalidade central.
2. Hermes será uma implementação possível, não uma dependência obrigatória do domínio.
3. O speech-to-text será um serviço separado.
4. O modelo de linguagem poderá ser substituído.
5. O aplicativo será a fonte principal para contexto, roadmap, dependências e histórico.
6. O Trello será uma ferramenta sincronizada.
7. Cada projeto poderá possuir aliases e módulos.
8. Toda classificação deverá possuir confiança e evidências.
9. Classificações incertas exigirão confirmação.
10. Toda ação sensível exigirá aprovação.
11. O agente não terá acesso direto ao banco.
12. A primeira versão será individual.
13. Tarefas sem prazo continuarão visíveis.
14. MCP será a interface estruturada entre agente e aplicação.
15. O agente pessoal e o agente desenvolvedor serão separados.
16. Alterações de código não farão parte do MVP inicial.
17. A arquitetura será preparada para mobile desde o início.

---

# 26. Definição de pronto do MVP

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
