# Ideação: a solução proposta

Este documento transforma a ideia inicial em um conceito implementável, priorizado e delimitado, coerente com o PRD v2.0. Ele explica **o que** a solução faz e **por que** cada capacidade existe, sem substituir o documento de requisitos (`09-documento-de-requisitos.md`) nem o protótipo (`10-prototipo-alta-fidelidade.md`).

## 1. Princípio central

> O usuário informa o que aconteceu; o sistema entende onde aquilo pertence.

A ideia nasce de uma constatação simples: quem administra vários projetos não sofre por falta de ferramentas, mas por **fragmentação**. Demandas chegam por planilha, Trello, mensagens, reuniões, áudios e memória pessoal — e cada registro exige decidir manualmente onde guardar, como classificar e o que atualizar.

A solução inverte essa lógica: o usuário captura a informação do jeito que ela chega (texto, áudio, card do Trello), e um agente contextual — baseado em Hermes ou tecnologia equivalente — usa o contexto acumulado de cada projeto para descobrir a qual projeto, módulo e tipo de demanda aquela informação pertence.

Dois limites derivados desse princípio orientam toda a ideação:

- **Contexto antes da automação.** O agente consulta aliases, vocabulário, histórico e decisões antes de propor qualquer coisa. Autonomia sem contexto classifica errado.
- **O usuário decide.** O agente propõe; nada é criado, alterado ou sincronizado sem revisão humana proporcional ao risco da ação. Não existe automação autônoma de decisões críticas no produto.

## 2. Proposta de valor

O usuário não precisa lembrar onde registrar cada demanda. Ele simplesmente informa o que aconteceu, e o sistema:

1. Interpreta a informação (transcrevendo áudio quando necessário).
2. Encontra o projeto relacionado, reconhecendo nomes antigos e aliases (ex.: "PAX" → VistaFor).
3. Identifica o tipo da demanda: tarefa, bug, decisão, bloqueio, observação, reunião, entre outros.
4. Verifica demandas semelhantes e decisões anteriores, evitando duplicidade.
5. Propõe um card estruturado, com prioridade, prazo e relações.
6. Mostra a confiança e as evidências da classificação.
7. Registra a informação somente após aprovação — sempre passando pelo backend, nunca escrevendo direto no banco.

O resultado esperado é uma única central onde a mesma demanda aparece como linha de planilha, card no Kanban, item no roadmap e prazo na agenda — sem duplicar trabalho entre ferramentas.

## 3. Capacidades da solução

As capacidades estão agrupadas pelo papel que exercem no fluxo: dar estrutura ao contexto, capturar informação, transformá-la com IA, organizá-la em visões e conectá-la ao mundo externo.

### 3.1 Projetos e contexto

É a base que torna a classificação possível. Cada projeto possui:

- **Dados estruturais:** nome, status, prioridade, datas, responsável, objetivo e progresso calculado.
- **Aliases:** nomes antigos e alternativos cadastrados ou confirmados pelo usuário.
- **Módulos:** subdivisões do projeto com termos, responsáveis e repositórios próprios.
- **Memória contextual:** três camadas — contexto permanente (vocabulário, sistemas, tecnologias), contexto operacional (tarefas abertas, bloqueios, últimas decisões) e memória de conversa (correções temporárias que podem ser promovidas a permanentes com aprovação).

**Papel:** sem esse contexto, o agente seria uma IA genérica chutando projetos. Toda informação aprendida é visualizável, editável e removível pelo usuário na gestão de contexto — o sistema aprende, mas nunca às escondidas.

### 3.2 Entrada de informações

Qualquer informação entra pela **caixa de entrada**, independentemente da origem:

- Texto digitado ou colado.
- Áudio gravado ou arquivo enviado, transcrito por serviço de speech-to-text dedicado (português brasileiro, pontuação automática, trechos incertos destacados, transcrição editável).
- Cards criados diretamente no Trello.
- Importação da planilha atual, com tratamento de inconsistências e status "A revisar".
- Entradas criadas via MCP por clientes autorizados.

**Papel:** separar captura de organização. O usuário registra rápido, sem interromper o fluxo; a classificação acontece depois. A entrada conserva o conteúdo original, a origem e o estado de revisão em cada etapa.

### 3.3 Agente contextual e revisão

O núcleo inteligente do produto. Para cada entrada, o agente responde: a qual projeto pertence? Qual módulo? Que tipo de informação é? Já existe algo semelhante? Há decisão anterior relacionada? Qual prioridade e prazo? Qual ação executar?

A saída é uma **proposta única e estruturada** que pode conter várias ações relacionadas — criar tarefa, criar reunião, propor nota, sugerir marco, registrar contexto de apoio — com ordem de execução e dependências entre elas. Cards (principalmente tarefas) são a saída principal; reuniões, notas e marcos são saídas centrais quando a entrada os justifica. O agente pode propor qualquer entidade de negócio necessária, **exceto usuários ou entidades de pessoas**.

Toda proposta apresenta **confiança e evidências**: o projeto sugerido, o percentual de confiança e os elementos que sustentam a conclusão (termos mencionados, aliases reconhecidos, demandas anteriores semelhantes). Níveis de confiança definem o comportamento:

- **Alta (≥ 85%):** projeto pré-selecionado, mas a classificação continua visível antes da confirmação.
- **Média (60–84%):** projetos candidatos em destaque, confirmação simples.
- **Baixa (< 60%):** a entrada permanece na caixa de entrada e o sistema pergunta ao usuário.

A **Revisão IA** é a tela onde o plano completo é aprovado, editado ou rejeitado ação por ação. A confirmação é proporcional ao risco: classificar exige pouco; criar tarefa, confirmação normal; alterar prioridade ou prazo, confirmação explícita; atualizar várias tarefas, confirmação reforçada; operações sensíveis via MCP, aprovação obrigatória.

**Papel:** transformar ruído em estrutura sem transferir a decisão para a máquina. Correções do usuário alimentam contexto e vocabulário editável, melhorando classificações futuras.

### 3.4 Tarefas e visões

A tarefa (card) é a unidade de trabalho: título, projeto, módulo, tipo, status, prioridade (herdada do projeto ou própria), prazo, complexidade, dependências, origem e histórico. Cards nascem em `Backlog`, prioridade `P3`, tipo `Tarefa`, e podem ser criados a partir de qualquer tela — a criação manual nunca depende do agente.

Os mesmos registros são vistos de quatro formas:

- **Planilha:** visão tabular familiar, com filtros, edição direta, agrupamentos e exportação — a ponte para quem vem da planilha atual.
- **Kanban:** colunas por status, arrastar e soltar, filtros e badges de marcos.
- **Central de prazos:** atrasadas, vencendo hoje/3/7/30 dias, sem prazo e aguardando retorno externo; nenhum prazo é alterado automaticamente pelo agente.
- **Tela Hoje:** a resposta diária a "o que devo fazer agora" — um plano de ação gerado por regras determinísticas de score mais análise contextual do agente, onde cada recomendação traz motivo, próxima ação e alternativa em caso de bloqueio. O usuário pode reordenar o plano a qualquer momento.

Marcos (pontos-chave de resultado, com vínculo muitos-para-muitos a tarefas) e reuniões (lembretes simples, com visões global e por projeto) completam o modelo, junto de notas privadas e contextos vinculados a projeto.

**Papel:** garantir que organizar não signifique preencher formulário — e que nenhuma informação se perca entre visões desconectadas.

### 3.5 Prazos, roadmap e lembretes

O roadmap temporal (semana, mês, trimestre, ano) mostra faixas de projeto, marcos, tarefas e dependências, com progresso planejado versus realizado. Uma agenda/calendário derivada de cards, roadmap, previsões e reuniões concentra os compromissos; editar nela atualiza a origem.

Prazo confirmado e previsão de entrega são campos distintos, e lembretes automáticos disparam na metade do prazo e a 7, 3 e 1 dia do vencimento — previsão vencida gera alerta, não atraso.

**Papel:** tirar os prazos do meio das linhas da planilha e dar-lhes uma superfície própria, tornando visível o que está atrasado, o que vem a seguir e o que ainda não tem data.

### 3.6 Integração com Trello

O Trello permanece como ferramenta operacional **sincronizada**, não substituída: projeto ↔ quadro, status ↔ lista, tarefa ↔ card, subtarefa ↔ checklist, responsável ↔ membro, prazo ↔ due date.

A sincronização é bidirecional e determinística; cards novos no Trello podem passar pelo agente para identificar projeto, módulo e duplicidades. Conflitos nunca são resolvidos com perda silenciosa: o usuário escolhe manter o valor do aplicativo, manter o do Trello, mesclar ou adiar a decisão.

**Papel:** eliminar a atualização dupla. O banco do aplicativo é a fonte de verdade para contexto, decisões, histórico e classificações; o Trello espelha o fluxo de cards.

### 3.7 MCP

O MCP é a interface estruturada entre o agente, a aplicação e clientes externos autorizados: ferramentas de leitura e escrita para projetos, módulos, contexto, tarefas, decisões, prazos, caixa de entrada e sincronização.

Cada ferramenta respeita escopos de permissão (leitura, classificação, criação, atualização, sincronização, administração de contexto, operações sensíveis), e toda chamada é auditada — usuário, agente, ferramenta, parâmetros, resultado e confirmação. Operações sensíveis (alterar prazos, prioridades críticas, alterações em massa, arquivar, mudar memória permanente, enviar dados a serviços externos) exigem aprovação.

**Papel:** permitir que a organização seja operada programaticamente com o mesmo controle e trilha de auditoria da interface — inclusive a regra de privacidade das notas (ver seção 5).

### 3.8 PWA e preparação mobile

A primeira versão é uma aplicação web responsiva, instalável como PWA, com cache e funcionamento limitado em conectividade ruim. A arquitetura — API independente do frontend, contratos documentados, modelos de IA e provedores de transcrição substituíveis — nasce preparada para aplicativos nativos Android e iOS no futuro.

**Papel:** entregar valor imediatamente no computador e no navegador do celular, sem fechar a porta para o mobile.

## 4. Fluxo principal

O caminho de uma informação desde a captura até o registro:

```text
Captura (texto, áudio, Trello, planilha, MCP)
        ↓
Caixa de entrada                     [Recebida]
        ↓ Transcrição, quando áudio  [Transcrevendo]
        ↓
Agente contextual consulta projetos, [Analisando contexto]
aliases, módulos, histórico e tarefas
semelhantes
        ↓
Proposta estruturada: projeto, tipo, [Aguardando confirmação]
prioridade, prazo, evidências,
confiança e ações relacionadas
        ↓ Usuário revisa, corrige ou descarta
Execução via serviços do backend     [Processada]
        ↓
Tarefa criada / decisão registrada /
contexto atualizado → sincronização
com Trello e auditoria
```

Estados possíveis da entrada: recebida, transcrevendo, analisando contexto, aguardando confirmação, processada, descartada e com erro. Estados finais alternativos:

- **Descartada:** o usuário rejeita a proposta ou identifica duplicidade.
- **Com erro:** falha de transcrição, do agente ou de integração; a entrada permanece visível e pode ser reprocessada ou tratada manualmente.

O fluxo honra a confirmação em cada ponto de risco: confiança baixa devolve a pergunta ao usuário; ações sensíveis pedem aprovação explícita; e a execução respeita a ordem de dependência entre as ações aprovadas de uma mesma proposta.

## 5. Regras de fallback e privacidade

### Fallback: a IA falha, o produto não

- Falha do agente ou do modelo **não impede** a criação manual de projetos e tarefas — acessível de qualquer tela, não apenas da planilha.
- Falha do speech-to-text não impede a entrada de texto.
- Falha do Trello não impede o uso local; o estado de sincronização fica visível e operações pendentes são reenviadas.
- Operações de IA são processadas em fila com status visível; classificação pendente nunca trava o restante do produto.

### Privacidade

- **Notas são privadas:** por padrão ficam fora do alcance da IA e do MCP; notas manuais não alimentam o contexto do agente.
- Contextos exigem projeto, podem vincular cards e ficam disponíveis para IA e MCP — essa é a fronteira explícita entre o que é pessoal e o que é contexto de trabalho.
- Áudio de entrada é excluído após o processamento, com política de retenção configurável; transcrições podem ser reprocessadas com outro provedor.
- O agente não acessa o banco diretamente; toda escrita passa pelos serviços e regras de negócio, com auditoria completa.
- Documentos importados passam por filtros contra instruções maliciosas, e o usuário controla quais documentos podem compor o contexto.

## 6. MVP versus pós-MVP

### No MVP

| Grupo | Capacidades |
|---|---|
| Fundação | Autenticação, API, PWA responsivo, auditoria, filas de IA e lembretes |
| Dados | Projetos, aliases, módulos, tarefas, importação da planilha |
| Visões | Planilha, Kanban, roadmap, central de prazos, tela Hoje, marcos |
| IA | Caixa de entrada, agente contextual, confiança e evidências, transcrição de áudio, Revisão IA, busca de duplicidades, plano de ação |
| Integração | Trello bidirecional, MCP com escopos e auditoria |
| Registro | Notas privadas, contextos, decisões, reuniões, histórico |

### Fora do MVP (evolução futura)

- Aplicativo mobile nativo; colaboração simultânea; chat entre usuários.
- Agente desenvolvedor de código (ambiente isolado, branch própria, diff, testes e aprovação — sem merge ou deploy automáticos).
- Integrações com Google Calendar (última fase do plano), e-mail e WhatsApp.
- Automações avançadas e execução autônoma de decisões críticas — estas permanecem **fora do produto por princípio**, não apenas por prazo.
- Substituição integral do Trello; controle de ponto ou financeiro.

### Hipóteses embutidas

- O contexto acumulado é suficiente para classificar ≥ 85% das entradas no projeto correto.
- O usuário prefere revisar uma proposta completa a preencher campos manualmente.
- Manter o Trello sincronizado reduz resistência à adoção em vez de competir com ele.

## 7. Dependências

- **Backend como fonte de verdade:** todas as visões, o agente, o MCP e o Trello leem e escrevem através dos serviços da aplicação. É a dependência estrutural mais importante: nenhuma capacidade pode contorná-la.
- **Contexto antes do agente:** a qualidade da classificação depende do cadastro de projetos, aliases, módulos e vocabulário — a importação da planilha serve também para construir esse contexto inicial.
- **Speech-to-text como serviço separado:** desacoplado do agente, com provedor substituível.
- **Modelo de linguagem substituível:** DeepSeek, Gemini ou modelo local, atrás de camada de adaptação.
- **Fila de processamento:** transcrições, classificações e lembretes são assíncronos.
- **Auditoria transversal:** exigida por IA, MCP, Trello e operações sensíveis.

## 8. Perguntas abertas

1. Qual implementação do agente (Hermes ou equivalente) entrega melhor custo-benefício para classificação com contexto por projeto?
2. Qual provedor de speech-to-text equilibra acurácia em português brasileiro, custo e identificação de falantes?
3. Quais limiares de confiança minimizam a fadiga de confirmação sem aceitar classificações erradas?
4. Como apresentar propostas multi-ação (card + reunião + nota + marco) na Revisão IA sem sobrecarregar a revisão?
5. Qual a política de retenção de áudio padrão mais adequada à privacidade do usuário único?
6. Em que ponto a sincronização com o Trello deve migrar de eventos para polling, e vice-versa, para manter idempotência?
7. Quantos projetos e registros a base inicial impõe como requisito real de desempenho para as visões?
