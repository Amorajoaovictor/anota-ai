# Testes unitários do harness de IA — fases 5 a 8

Este registro antecede os testes e a implementação. O escopo usa contratos e repositórios fake; não depende de banco, rede, browser ou provedor real.

## H01 — duas aprovações antes da escrita

1. Protege: executor só cria entidades quando Markdown e proposta exatos foram aprovados.
2. Detecta: rota ou job que aceite somente uma aprovação, hash antigo ou estado prematuro.
3. Impacto: conteúdo ainda não revisado seria gravado sem controle do usuário.

## H04 — várias entidades por tópico

1. Protege: um tópico de reunião pode produzir `Meeting` e múltiplas `Task` relacionadas na mesma proposta.
2. Detecta: schema ou materializador impondo relação um-para-um entre tópico e entidade.
3. Impacto: decisões e tarefas da reunião seriam perdidas.

## H06 — idempotência concorrente

1. Protege: mesma revisão aprovada possui uma única execução e devolve os mesmos IDs.
2. Detecta: dois cliques ou workers vencendo uma corrida e criando duas execuções.
3. Impacto: projetos, tarefas e relações duplicados.

## H07 — rollback integral

1. Protege: entidade, origem, auditoria, execução e estado confirmam juntos.
2. Detecta: falha intermediária que deixa escrita parcial fora da transação.
3. Impacto: base inconsistente e preview diferente do estado criado.

## H08 — isolamento por proprietário

1. Protege: recuperação exata/full-text e revalidação consultam somente dados do proprietário.
2. Detecta: consulta sem `ownerId` em uma fonte ou referência fornecida pelo modelo aceita sem revalidação.
3. Impacto: vazamento ou vínculo cruzado de dados entre contas.

## H09 — referência não é instrução

1. Protege: referências sanitizadas entram somente em JSON `REFERENCE_ONLY`, sem ferramentas.
2. Detecta: texto recuperado concatenado ao prompt de sistema ou capaz de ampliar operações.
3. Impacto: prompt injection poderia gerar ação indevida.

## H10 — nota privada fora da IA

1. Protege: notas privadas não aparecem em candidatos, snapshot ou prompt.
2. Detecta: fonte nova ou filtro removido incluindo `NOTE` na recuperação.
3. Impacto: exposição de conteúdo pessoal e risco LGPD.

## H17 — referência removida bloqueia execução

1. Protege: toda referência existente é revalidada dentro da transação.
2. Detecta: executor confiando no snapshot antigo após projeto, tarefa ou milestone ser removido.
3. Impacto: relação inválida ou criação no escopo errado.

## H18 — ambiguidade permanece `UNRESOLVED`

1. Protege: tópico pode ficar sem entidade, desde que explicado e sustentado pelo Markdown aprovado.
2. Detecta: schema exigindo item para todo tópico ou aceitando tópico sem cobertura.
3. Impacto: modelo inventaria projeto, prazo ou intenção.

## H19 — grafo executável

1. Protege: IDs locais, tipos, dependências, seleção e ordem topológica permanecem coerentes.
2. Detecta: ciclo, referência ausente/tipo errado ou item removido ainda exigido por outro.
3. Impacto: aprovação impossível de executar ou criação parcial.

## H20 — origem e auditoria transacionais

1. Protege: cada item criado ganha `EntityOrigin` e `AuditLog` sanitizado na mesma transação.
2. Detecta: auditoria posterior, com conteúdo sensível ou ausente após falha.
3. Impacto: perda de rastreabilidade e impossibilidade de provar origem da alteração.

## Rollout unitário

1. Protege: feature flag por usuário, concorrência por proprietário/provedor e métricas sem conteúdo bruto.
2. Detecta: habilitação global acidental, excesso de chamadas ou labels contendo texto sensível.
3. Impacto: rollout sem contenção, custo imprevisível e vazamento operacional.

## Integração Prisma e aprovação 2

### Aprovação exata e atômica

1. Protege: `ENTITIES` aprova hash/revisão exatos dentro da mesma transação que cria entidades.
2. Detecta: aprovação persistida antes de uma falha, hash antigo aceito ou proposta ativa trocada.
3. Impacto: UI indicaria conteúdo aprovado sem criação correspondente ou executaria preview obsoleto.

### Adapter Prisma de todos os tipos

1. Protege: cada tipo permitido pelo schema vira modelo/relação correta, em ordem topológica, com propriedade revalidada.
2. Detecta: entidade sem adapter, relação entre projetos diferentes ou `EntityOrigin` apontando para chave local em vez de `ProposalItem.id`.
3. Impacto: proposta aprovada falharia no meio, criaria ligação inválida ou perderia rastreabilidade.

### Idempotência concorrente no Prisma

1. Protege: transação serializável e constraints devolvem a execução vencedora.
2. Detecta: `P2002`/`P2034` tratado como falha final ou duas transações criando entidades.
3. Impacto: duplo clique/worker repetido causaria duplicidade ou erro falso ao usuário.

### Rota `POST execution`

1. Protege: owner vem da sessão; corpo aceita somente revisão, hash e versão esperada.
2. Detecta: `ownerId` do cliente, payload oculto, conflito sem status correto ou executor fora do adapter transacional.
3. Impacto: acesso cruzado, execução de proposta diferente do preview ou resposta que induz retry indevido.
