# MCP do Anota Aí

O servidor expõe projetos, cards, contexto de projeto e caixa de entrada. Notas privadas não são ferramentas MCP. HTTP remoto e `stdio` local usam as mesmas regras de negócio e a mesma base de dados.

## Preparação

1. Aplique a migration `20260923201500_mcp_tokens` no ambiente onde o Anota Aí roda.
2. Entre no app e abra **Integrações > MCP**.
3. Crie uma conexão com os escopos necessários. Copie o token: ele aparece só nessa resposta. Tokens expiram após 90 dias e podem ser revogados nessa tela.

## HTTP remoto

Configure no cliente MCP a URL `https://SEU-DOMINIO/api/mcp` e envie `Authorization: Bearer <token>`. O endpoint usa Streamable HTTP e responde a clientes MCP atuais e legados. Use sempre HTTPS fora do ambiente local.

### Instalação no Codex

Crie um token na conta do Anota Aí que será usada pelo agente. Defina `ANOTA_MCP_TOKEN` no ambiente que inicia o Codex, sem incluir o valor no comando, no repositório ou em `config.toml`. No Windows, reinicie o Codex depois de definir a variável de ambiente para que o processo receba o novo valor.

```powershell
codex mcp add anota-ai --url https://anota-ai-orcin.vercel.app/api/mcp --bearer-token-env-var ANOTA_MCP_TOKEN
codex mcp get anota-ai --json
```

A entrada é global no perfil do Codex e pode ser usada a partir de outros projetos. Em outra máquina ou conta, repita a instalação com um token próprio. Revogue o token anterior quando deixar de usá-lo.

## stdio local

No checkout do projeto, configure `.env.local` com a conexão de banco usada pelo app. Passe `ANOTA_MCP_TOKEN` ao processo do agente sem gravá-lo no repositório. Configure o cliente para iniciar `node --env-file=.env.local --import tsx src/server/mcp/stdio.ts` no diretório do projeto. O processo lê o mesmo banco do app e escreve mensagens do protocolo apenas em `stdout`. Não use `npm run` como comando do cliente: o banner do npm pode contaminar `stdout`.

Exemplo genérico de configuração de cliente:

```json
{
  "command": "node",
  "args": ["--env-file=.env.local", "--import", "tsx", "src/server/mcp/stdio.ts"],
  "cwd": "CAMINHO_ABSOLUTO_DO_PROJETO",
  "env": { "ANOTA_MCP_TOKEN": "TOKEN_GERADO_NO_APP" }
}
```

O formato de configuração varia conforme o cliente. Proteja o token como senha e revogue a conexão quando deixar de usá-la.

## Antes e depois de usar no Codex

Antes da primeira chamada, confirme que a conexão aparece em `codex mcp list` e que o token pertence à conta e aos escopos esperados. Reinicie o Codex após instalar ou alterar a conexão, para que ele carregue a configuração. Faça uma chamada somente de leitura a `projects.list` antes de pedir qualquer escrita. Confirme o projeto exato pelo ID; nomes parecidos não autorizam escolher um destino.

Depois da chamada, confira o resultado e, em caso de erro, anote o `requestId`, o nome da ferramenta e o horário. Não repita uma escrita sem verificar se ela já foi aplicada. O servidor registra falhas em `stderr` no transporte local e nos logs da aplicação no transporte HTTP; nunca copie token, senha ou URL de banco para esses registros.

Se o MCP não iniciar, siga esta ordem:

1. Verifique a entrada com `codex mcp list` e `codex mcp get anota-ai`. Se ela estiver ausente, instale a conexão novamente e reinicie o Codex.
2. No transporte local, confirme que o checkout, o Node.js, `node_modules` e `.env.local` existem, que `ANOTA_MCP_TOKEN` está disponível ao processo do Codex e que a migration `20260923201500_mcp_tokens` foi aplicada ao banco apontado por `.env.local`.
3. No transporte HTTP, confirme a URL exata com `/api/mcp`, HTTPS, disponibilidade do serviço e `ANOTA_MCP_TOKEN` no ambiente do processo do Codex. `401` indica token ausente, expirado ou revogado; `403` pode indicar origem inválida; `404` sem `x-request-id` indica que a rota MCP não está disponível nesse deploy.
4. Repita `projects.list`. Se persistir, use `requestId` e logs do servidor para localizar a etapa que falhou. Não registre o segredo no ticket ou na conversa.

## Ferramentas e confirmação

Escopos: `read`, `create`, `update` e `context`. Toda escrita exige `confirmed: true`. Mudanças de prazo, prioridade alta, arquivamento, descarte e edição de contexto também exigem `confirmedSensitive: true`. O agente deve mostrar a ação ao usuário e obter resposta afirmativa antes de preencher esses campos. O servidor registra a declaração de confirmação, o cliente, a ferramenta, os campos enviados, o resultado e um `requestId`.

A confirmação ocorre na conversa com o agente. O servidor não tem acesso a essa conversa e não consegue verificar de forma independente se a resposta veio do usuário. Conceda escopos de escrita somente a clientes MCP em que confia.

Operações de inbox seguem o classificador legado ao chamar `inbox.create`. `inbox.harness` permite ler o estado de uma revisão existente; sua aprovação e execução continuam disponíveis no app. Cards podem ser criados diretamente por `tasks.create`, sem passar pelo classificador.
