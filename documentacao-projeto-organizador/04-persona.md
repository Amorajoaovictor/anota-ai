# Persona (hipótese de design)

> **Status:** hipótese. Esta persona foi construída a partir do usuário real que motivou o projeto e das observações sobre sua planilha atual (PRD v2.0, seções 3 e 5). Ela **ainda não representa um público validado**: nenhuma etapa de pesquisa formal com usuários foi realizada até o momento. O documento serve para orientar decisões do MVP e para listar explicitamente o que precisa ser confirmado.

## Alex Dev — Programador solo

**Nome fictício:** Alex Dev
**Idade:** variável
**Ocupação:** programador e responsável pelos próprios projetos
**Contexto:** trabalha sozinho ou em equipes pequenas, administrando simultaneamente vários projetos de software, demandas institucionais, correções, funcionalidades, dependências externas e prazos.

### Responsabilidades

- Decidir o que fazer primeiro entre projetos concorrentes.
- Registrar demandas que chegam por texto, áudio, reuniões e mensagens.
- Manter o estado dos projetos em ferramentas como planilha e Trello.
- Resgatar decisões anteriores e o histórico de cada projeto.
- Identificar e comunicar bloqueios e dependências externas.

## Objetivos e tarefas

### Objetivos

- Saber rapidamente o que fazer hoje, sem reconstruir contexto de memória.
- Registrar uma demanda sem interromper o fluxo de trabalho.
- Ter uma visão única do trabalho: tarefas urgentes, bloqueios, prazos e entregas futuras.
- Reduzir o trabalho manual de classificação, sincronização e planejamento.

### Tarefas típicas

- Capturar uma nova demanda por texto ou áudio.
- Confirmar ou corrigir a classificação proposta pelo agente.
- Organizar tarefas por projeto, módulo, prioridade e status.
- Consultar demandas semelhantes e decisões anteriores.
- Atualizar Trello e a aplicação sem retrabalho.
- Revisar o plano quando as prioridades mudam.

## Fluxo atual

Hoje, Alex distribui as informações entre várias fontes sem um ponto central:

1. A demanda chega por mensagem, reunião, áudio ou anotação solta.
2. Parte vai para a planilha, parte para o Trello, parte fica só na memória.
3. Na planilha, um mesmo grupo de linhas mistura status, etapa, responsável, tarefas concluídas, pendências e observações.
4. Prazos ficam escondidos entre muitas linhas e poucos registros os possuem.
5. Para decidir o que fazer, Alex percorre várias ferramentas e reconstrói o contexto manualmente.

## Dores

- Demandas chegam sem classificação clara e dependem de contexto anterior.
- O mesmo projeto pode ser chamado por nomes diferentes (aliases), o que dificulta relacionar informações.
- Não existe uma visão única das tarefas mais urgentes.
- Tarefas, bloqueios, decisões e observações ficam misturados.
- Áudios precisam ser transformados manualmente em atividades.
- Decisões de reuniões podem ser esquecidas.
- Demandas semelhantes podem ser cadastradas mais de uma vez.
- Atualizar mais de uma ferramenta gera retrabalho.
- A quantidade de projetos dificulta priorizar.
- Uma IA sem contexto pode associar a demanda ao projeto errado.

## Necessidades

### Funcionais

- Captura rápida por texto ou áudio, sem sair do fluxo.
- Classificação automática de projeto, módulo e tipo da demanda, com evidências.
- Visualização tabular familiar, além de Kanban, roadmap e central de prazos sobre os mesmos dados.
- Busca de demandas semelhantes e acesso a decisões anteriores.
- Sincronização bidirecional com o Trello.
- Cadastro manual de projetos e tarefas disponível a partir de qualquer tela.
- Correção das classificações do agente, com aprendizado visível e editável.

### Emocionais

- Confiança de que nada se perde: toda informação registrada é rastreável.
- Segurança ao delegar interpretação à IA, sabendo que nada é gravado sem revisão.
- Tranquilidade de que uma falha de IA ou serviço externo nunca impede o trabalho manual.
- Sensação de controle sobre o próprio sistema de organização.

### Acessibilidade e responsividade

- Layout responsivo que funcione em desktop e celular, instalável como PWA.
- Captura por áudio como alternativa à digitação (por exemplo, em deslocamento).
- Confirmações claras e legíveis, proporcionais ao risco da ação.
- Interface que não exija treinamento para as operações principais.

## Relação com texto, áudio, Trello, IA e revisão

- **Texto:** forma preferencial de captura rápida; Alex digita ou cola o que aconteceu e espera que o sistema entenda onde aquilo pertence.
- **Áudio:** Alex grava ou envia áudios (reuniões, deslocamento); o sistema transcreve e trata o conteúdo como qualquer outra entrada não estruturada.
- **Trello:** continua em uso; Alex espera sincronização bidirecional para não manter dois sistemas divergentes, sem que o Trello seja integralmente substituído no MVP.
- **IA:** é assistente, não autoridade. Alex quer que o agente proponha projeto, módulo, tipo, prioridade e próximos passos, sempre mostrando as evidências e a confiança.
- **Revisão:** Alex é quem aprova. Classificação exige confirmação simplificada; criação de tarefa, confirmação normal; alteração de prioridade ou prazo, confirmação explícita; ações em lote, confirmação reforçada. Ele deve poder corrigir qualquer proposta e registrar a correção como contexto.

## Critérios de confiança

Alex só confiará no agente se o produto cumprir estes critérios (PRD v2.0, seção 6):

1. **Contexto antes da automação:** o agente consulta o contexto do projeto antes de propor qualquer ação.
2. **IA com evidências:** toda classificação mostra os elementos que levaram à conclusão e um nível de confiança.
3. **Confirmação proporcional ao risco:** quanto maior o impacto da ação, mais explícita é a aprovação.
4. **Backend como fonte de verdade:** o agente não altera dados diretamente; tudo passa pelas regras de negócio.
5. **Recursos manuais sempre disponíveis:** falhas do agente, do modelo ou de serviços externos nunca bloqueiam o cadastro manual.
6. **Aprendizado corrigível:** associações aprendidas são visualizáveis e editáveis; correções podem virar aliases, módulos ou tags.

## Cenários de uso

### Cenário 1 — Bug relatado por texto

Alex recebe um relato: “A planta principal continua carregando automaticamente e travando o mapa. Coloca isso como prioridade alta.” Ele cola o texto na caixa de entrada. O agente propõe projeto VistaFor (reconhecendo termos como “planta” e o alias “PAX”), módulo Loteamentos/Mapa, tipo Bug, prioridade alta e relação com demandas anteriores sobre raster. Alex vê as evidências, ajusta um campo e aprova.

### Cenário 2 — Reunião gravada em áudio

Ao fim de uma reunião, Alex grava um áudio resumindo o que foi combinado. O sistema transcreve, identifica decisões e novas tarefas e propõe um plano de ação. Alex revisa o plano completo, corrige o que for necessário e aprova somente as ações desejadas.

### Cenário 3 — Repriorização assistida

Um projeto ganha urgência inesperada. Alex pede à IA para reorganizar o plano. O agente propõe alterações de prioridade e prazo com confirmação explícita, e Alex decide o que aceitar, sabendo que pode desfazer e que a planilha/Kanban/roadmap refletem o mesmo dado.

## Barreiras de adoção

- Desconfiança de uma IA que classifique demandas no projeto errado.
- Custo percebido de migrar a planilha existente e manter o contexto alimentado.
- Hábito consolidado de usar planilha + Trello simultaneamente.
- Medo de perder o controle: automações que alterem prioridades, prazos ou código sem aprovação explícita.
- Dependência de serviços externos (transcrição, modelo de linguagem): se a aplicação ficar inutilizável sem eles, Alex não adotará.
- Dúvida sobre privacidade dos dados dos projetos.

## Evidências observadas versus hipóteses

### Evidências observadas

- Existência de uma planilha real com estrutura inconsistente (campos que misturam status, etapa, responsável, pendências e observações).
- Projetos reais na base inicial: Intranet, Observa SEUMA, Guichê Virtual, PAX/VistaFor, Monitoramento do Ar, App Vistoria — CELAM/NUEE.
- Projetos com nomes anteriores/aliases, módulos distintos e vocabulário específico (ex.: “planta”, “raster”, “quadra”, “loteamento” associados ao VistaFor).
- Uso simultâneo de planilha e Trello.

### Hipóteses (não validadas)

- Alex prefere confirmar propostas da IA a preencher campos manualmente.
- A captura por áudio é relevante no dia a dia, não apenas ocasional.
- A visualização tabular será suficiente como âncora familiar da transição.
- A sincronização bidirecional com o Trello é percebida como benefício e não como risco.
- O nível de confirmação definido no PRD corresponde à tolerância real de risco de Alex.
- Outros programadores solo ou equipes pequenas compartilham essas dores e fluxos.

## Perguntas para validação

1. Com que frequência novas demandas chegam por áudio versus texto, e em que situações?
2. Quais classificações erradas seriam mais danosas: projeto errado, tipo errado ou prioridade errada?
3. Que nível de confiança mínimo Alex aceitaria para aprovar uma proposta com um clique?
4. A revisão das evidências aumenta ou atrapalha a velocidade de captura?
5. Alex manteria o Trello como ferramenta principal para terceiros mesmo com a sincronização funcionando?
6. Que decisões do passado ele mais sente falta de consultar?
7. O que faria Alex abandonar o produto na primeira semana?

## Premissas que orientam o MVP

- **Controle do usuário:** Alex precisa manter controle em todos os momentos. O agente propõe; o usuário decide. Nenhuma ação relevante é executada sem revisão, e toda correção feita por ele alimenta o contexto de forma visível e editável.
- **IA não é gargalo:** falhas de IA, do modelo ou de serviços externos não bloqueiam o cadastro manual. A criação de tarefa é global, acessível de qualquer tela, e funciona sem o agente.
- **Escopo desta persona:** este documento descreve uma única hipótese de persona. Ela ainda não representa um público validado e será revisada assim que houver pesquisa com usuários reais. Novas personas só deverão ser criadas com evidências que as justifiquem.
