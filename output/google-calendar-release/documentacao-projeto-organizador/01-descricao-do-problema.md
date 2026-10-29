# Descrição do problema

Este documento descreve o problema que motiva o Organizador Pessoal Inteligente de Projetos (PRD v2.0). O foco aqui é o problema em si — contexto, causas, consequências, quem é afetado e a oportunidade — sem detalhar a solução, que é tratada nos demais documentos da série.

## Contexto: como o trabalho é organizado hoje

Hoje, as demandas de vários projetos vivem espalhadas em múltiplos lugares:

- **Planilha**: principal instrumento de acompanhamento, com uma estrutura pouco consistente (ver abaixo).
- **Trello**: quadros usados para parte das tarefas, que precisam ser atualizados em paralelo.
- **Anotações e notas**: registros rápidos, soltos, sem vínculo formal com projeto ou tarefa.
- **Áudios**: demandas ditadas que precisam ser transcritas e transformadas manualmente em atividades.
- **Reuniões e mensagens**: decisões e combinações que dependem de alguém lembrá-las para registrá-las.
- **Memória pessoal**: prazos, pendências e dependências que não estão escritos em lugar nenhum.

A planilha existente — base inicial do problema — apresenta inconsistências estruturais concretas:

| Campo atual | Problema identificado |
|---|---|
| Demanda | Funciona como nome do projeto, mas aparece apenas na primeira linha do grupo |
| Etapa/Responsável | Mistura status, etapa e responsável |
| Realizado | Contém atividades concluídas e tarefas ainda não executadas |
| Pendências | Mistura bloqueios, próximas ações e solicitações |
| Prazo | Poucos registros possuem prazo preenchido |
| Observação | Contém dependências, retornos externos e informações operacionais |

Essa planilha concentra projetos como Intranet, Observa SEUMA, Guichê Virtual, PAX / VistaFor, Monitoramento do Ar e App Vistoria — CELAM/NUEE. Alguns possuem muitos registros, nomes anteriores (aliases), módulos diferentes e vocabulários próprios — por exemplo, termos como "planta", "raster", "quadra" ou "loteamento" apontam para o VistaFor mesmo quando o nome do projeto não é citado.

## Problema central

> As demandas de vários projetos chegam de forma desestruturada (texto, áudio, reunião, mensagem) e ficam distribuídas entre planilha, Trello, notas e memória pessoal; sem um lugar único que entenda o contexto de cada projeto, organizar, priorizar e acompanhar o trabalho exige esforço manual constante e sujeito a falhas.

### Causas principais

1. **Fragmentação de ferramentas**: nenhuma delas sozinha concentra tarefas, prazos, decisões, bloqueios e contexto.
2. **Entradas sem classificação**: demandas chegam sem projeto, tipo, prioridade ou prazo definidos.
3. **Dependência de contexto implícito**: muitas informações só fazem sentido com conhecimento anterior do projeto (aliases, módulos, vocabulário específico).
4. **Registro manual repetitivo**: a mesma informação precisa ser digitada/atualizada em mais de uma ferramenta.
5. **Estrutura da planilha inadequada**: campos que misturam conceitos diferentes (status com responsável, concluído com pendente, bloqueio com próxima ação).
6. **Áudios e reuniões fora do sistema**: não há caminho direto de uma fala ou decisão para uma tarefa rastreável.

## Consequências

- **Execução**: sem visão única do que é mais urgente, decidir o que fazer primeiro entre vários projetos fica difícil; bloqueios se misturam a observações e passam despercebidos.
- **Prazos**: ficam escondidos entre várias linhas da planilha; poucos registros têm prazo preenchido, e atrasos são descobertos tarde.
- **Decisões**: decisões tomadas em reuniões podem ser esquecidas, e decisões anteriores não são facilmente consultáveis quando uma demanda nova chega.
- **Duplicidades**: demandas semelhantes podem ser cadastradas mais de uma vez, sem que se perceba a relação com registros anteriores.
- **Contexto**: o conhecimento sobre cada projeto (nomes antigos, módulos, termos, histórico) vive na cabeça do usuário; qualquer classificação — humana ou por IA sem contexto — tende a errar o projeto ou o módulo.
- **Esforço contínuo**: manter planilha e Trello atualizados em paralelo consome tempo e gera divergência entre as fontes.

## Quem é afetado

O principal afetado é o próprio usuário do produto: pessoa que administra simultaneamente vários projetos de software, demandas institucionais, correções, funcionalidades, dependências externas e prazos (ver documento 04 — usuário-alvo). Indiretamente, também são afetados os interlocutores desses projetos — colegas e áreas que enviam demandas, aguardam retornos ou dependem de decisões registradas —, uma vez que prazos perdidos, retrabalho por duplicidade e decisões esquecidas recaem sobre o andamento do trabalho como um todo.

## Evidências versus hipóteses

É importante separar o que foi observado diretamente do que ainda precisa ser validado.

**Evidências (observadas na base real):**

- A planilha existe e apresenta as inconsistências estruturais listadas acima.
- Há projetos concretos cadastrados, com aliases, módulos e vocabulários específicos.
- Demandas chegam em formatos variados (texto, áudio, reuniões) e hoje são processadas manualmente.
- Prazos são pouco preenchidos; Trello e planilha coexistem e precisam de atualização dupla.

**Hipóteses (a validar com o uso do produto):**

- Um agente com contexto acumulado do projeto acertará a classificação de novas demandas com frequência suficiente para reduzir o trabalho manual.
- A confirmação com evidências será suficiente para o usuário confiar nas sugestões do agente.
- A caixa de entrada única reduzirá efetivamente a perda de ideias e decisões.
- A centralização diminuirá o retrabalho por demandas duplicadas.

## Oportunidade delimitada pelo MVP

O problema abre espaço para uma central pessoal que reúna, sobre os mesmos dados, as visualizações que hoje faltam juntas (tabular, Kanban, roadmap e prazos), importe a planilha atual, receba entradas desestruturadas (texto e áudio) e conte com um agente contextual que classifica demandas com evidências e só age após confirmação do usuário — com o backend como fonte de verdade e caminhos manuais sempre disponíveis caso a IA falhe.

Essa oportunidade é delimitada pelo escopo do MVP do PRD: resolver o problema para **um usuário, em seus próprios projetos**, substituindo a planilha como interface principal de acompanhamento e sincronizando com o Trello. O que está fora desse limite não faz parte do problema que o MVP se propõe a resolver (ver próxima seção).

O problema se conecta diretamente ao princípio central do PRD:

> O usuário informa o que aconteceu; o sistema entende onde aquilo pertence.

A fragmentação e a dependência de contexto descritas aqui são exatamente o que esse princípio pretende eliminar. A descrição detalhada da solução — telas, fluxos, agente e integrações — está nos documentos 05 e seguintes, não neste documento.

## Fora de escopo deste problema

Para evitar confundir este problema com capacidades futuras ou com outros produtos, ficam explicitamente fora:

- **Agente de código**: alteração automática de código, merges, deploys ou execução de comandos não fazem parte do problema tratado aqui; são tratados no PRD apenas como possibilidade futura, isolada e supervisionada.
- **Colaboração entre equipes**: o problema é individual; colaboração simultânea, chat entre usuários e gestão de capacidade de equipes estão fora do MVP.
- **Integrações futuras**: WhatsApp, e-mail e Google Calendar não fazem parte do problema delimitado; o MVP considera apenas planilha, Trello e entradas diretas (texto/áudio/MCP).
- **Substituição integral do Trello**: o Trello permanece como ferramenta sincronizada, não como sistema a ser aposentado.
- **Controle de ponto ou financeiro**: fora do problema e do produto.
