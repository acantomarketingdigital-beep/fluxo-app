# Deploy Checklist do Fluxo

Guia final para publicar o Fluxo em beta com Supabase, Stripe e Vercel.

Antes de começar, confirme que estes arquivos existem no projeto:

- `supabase/fluxo_schema.sql`
- `supabase/billing_schema.sql`
- `.env.example`
- `api/create-checkout-session.js`
- `api/create-portal-session.js`
- `api/stripe-webhook.js`

## 1. Supabase

### Criar o projeto

1. Acesse https://supabase.com/dashboard.
2. Crie uma nova organização ou use uma organização existente.
3. Clique em `New project`.
4. Escolha nome, senha do banco, região e plano.
5. Aguarde o provisionamento finalizar.

### Pegar URL e anon key

1. Entre no projeto Supabase.
2. Vá em `Project Settings` > `API Keys` ou `Connect`.
3. Copie a URL do projeto.
4. Copie a chave pública `anon` ou `publishable`.
5. Use no Vercel como:

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_OU_PUBLISHABLE
```

### Pegar service role key

1. Vá em `Project Settings` > `API Keys`.
2. Abra a área de chaves secretas/legacy.
3. Copie a `service_role` key ou uma secret key equivalente para backend.
4. Use apenas em ambiente serverless/Vercel:

```bash
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
```

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` em código frontend, `src`, `public` ou variáveis com prefixo `VITE_`.

### Rodar `fluxo_schema.sql`

1. No Supabase, abra `SQL Editor`.
2. Crie uma nova query.
3. Copie todo o conteúdo de `supabase/fluxo_schema.sql`.
4. Execute.
5. Confirme que as tabelas foram criadas:

- `incomes`
- `expenses`
- `cards`
- `transactions`

### Rodar `billing_schema.sql`

1. Ainda no `SQL Editor`, crie outra query.
2. Copie todo o conteúdo de `supabase/billing_schema.sql`.
3. Execute.
4. Confirme que foram criados:

- tipo `subscription_status`
- tabela `profiles`
- tabela `subscriptions`
- políticas de RLS para leitura do próprio usuário

### Configurar Auth URL

1. Vá em `Authentication` > `URL Configuration`.
2. Em `Site URL`, coloque a URL final do app:

```bash
https://seudominio.com
```

Se ainda estiver testando sem domínio, use a URL de produção da Vercel:

```bash
https://seu-projeto.vercel.app
```

### Configurar redirect URLs

Adicione as URLs permitidas para login, cadastro e recuperação de senha:

```bash
https://seudominio.com
https://seudominio.com/**
https://seu-projeto.vercel.app
https://seu-projeto.vercel.app/**
http://localhost:5173
http://localhost:5173/**
http://localhost:3000
http://localhost:3000/**
```

Use `localhost:5173` para o Vite puro e `localhost:3000` para `vercel dev`.

## 2. Stripe

### Criar produto Fluxo Premium

1. Acesse https://dashboard.stripe.com.
2. Ative o modo `Test mode` para configurar e testar.
3. Vá em `Product catalog`.
4. Crie um produto chamado:

```bash
Fluxo Premium
```

### Criar plano mensal

1. Dentro do produto `Fluxo Premium`, crie um Price recorrente.
2. Moeda: `BRL`.
3. Valor: `R$ 7,90`.
4. Recorrência: mensal.
5. Salve e copie o ID do Price:

```bash
STRIPE_PRICE_MONTHLY=price_...
```

### Criar plano anual

1. No mesmo produto, crie outro Price recorrente.
2. Moeda: `BRL`.
3. Valor: `R$ 59,90`.
4. Recorrência: anual.
5. Salve e copie o ID do Price:

```bash
STRIPE_PRICE_YEARLY=price_...
```

### Pegar secret key

1. Vá em `Developers` > `API keys`.
2. Copie a secret key de teste para Preview/Development.
3. Depois, antes do lançamento real, copie a secret key live para Production.

```bash
STRIPE_SECRET_KEY=sk_test_...
```

Em produção real, use `sk_live_...`.

### Ativar Customer Portal

1. Vá em `Settings` > `Billing` > `Customer portal`.
2. Ative o portal.
3. Permita que o cliente:
   - atualize método de pagamento
   - troque plano, se desejar liberar mensal/anual
   - cancele assinatura
   - veja histórico de faturas
4. Salve a configuração.

### Configurar webhook

1. Vá em `Developers` > `Webhooks`.
2. Clique em `Add endpoint` ou `Create event destination`.
3. Use a URL:

```bash
https://seudominio.com/api/stripe-webhook
```

Se estiver usando a URL da Vercel:

```bash
https://seu-projeto.vercel.app/api/stripe-webhook
```

### Eventos necessários

Selecione estes eventos:

```bash
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_succeeded
invoice.payment_failed
```

### Pegar webhook secret

1. Abra o endpoint criado.
2. Clique para revelar o signing secret.
3. Copie para:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

Para teste local com Stripe CLI:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

Use o `whsec_...` retornado pelo `stripe listen` no ambiente local.

## 3. Vercel

### Importar projeto

1. Suba o repositório para GitHub, GitLab ou Bitbucket.
2. Acesse https://vercel.com/new.
3. Importe o repositório do Fluxo.
4. Framework Preset: `Vite`.

### Configurar variáveis de ambiente

Em `Project Settings` > `Environment Variables`, configure:

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_OU_PUBLISHABLE
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY=sk_live_ou_sk_test
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
APP_URL=https://seudominio.com
```

Configure pelo menos em:

- `Production`
- `Preview`

Para desenvolvimento local com `vercel dev`, use:

```bash
APP_URL=http://localhost:3000
```

### Build command

Use:

```bash
npm run build
```

### Output directory

Use:

```bash
dist
```

### Deploy production

1. Faça o primeiro deploy pela interface da Vercel.
2. Abra a URL gerada.
3. Rode os testes obrigatórios deste checklist.
4. Quando estiver tudo aprovado, conecte o domínio final.

Deploy pela CLI, se preferir:

```bash
npm install -g vercel
vercel
vercel --prod
```

## 4. Testes obrigatórios antes de divulgar

Execute estes testes em `Production` ou em um Preview conectado ao Stripe test mode.

### Autenticação

- [ ] Criar uma conta nova.
- [ ] Confirmar e-mail, se a confirmação estiver ativada no Supabase.
- [ ] Fazer login.
- [ ] Sair da conta.
- [ ] Fazer login novamente.
- [ ] Testar recuperação de senha.

### Receita

- [ ] Criar uma receita recebida.
- [ ] Verificar se ela aparece em Receitas.
- [ ] Verificar se ela entra em Transações como entrada.
- [ ] Verificar se o dashboard atualiza o saldo em mãos.

### Despesa

- [ ] Criar uma despesa em aberto.
- [ ] Marcar como paga.
- [ ] Verificar se aparece uma única saída em Transações.
- [ ] Criar uma despesa já com status `Pago`.
- [ ] Verificar se ela também gera uma única saída.

### Cartão

- [ ] Criar compra à vista.
- [ ] Conferir se o limite disponível diminui.
- [ ] Conferir se a fatura aumenta.
- [ ] Criar compra parcelada.
- [ ] Conferir se o limite usa o total e a fatura usa só a parcela.

### Fatura

- [ ] Pagar fatura de um cartão.
- [ ] Conferir se a saída aparece uma única vez em Transações.
- [ ] Conferir se compras parceladas liberam a próxima parcela na fatura.
- [ ] Conferir se clicar novamente não duplica a transação da fatura.

### Transações e dashboard

- [ ] Abrir Transações e conferir entradas/saídas.
- [ ] Conferir se o saldo pode ficar negativo.
- [ ] Conferir se o dashboard bate com receitas recebidas menos saídas pagas.
- [ ] Atualizar a visão geral e confirmar que os dados persistem.

### Trial e Premium

- [ ] Criar uma conta nova e confirmar o badge `Teste grátis - X dias restantes`.
- [ ] Abrir Relatórios durante o trial.
- [ ] Usar múltiplos cartões durante o trial.
- [ ] Simular usuário básico sem premium e confirmar bloqueios.
- [ ] Confirmar que usuário `active` não vê bloqueio premium.

### Checkout teste

- [ ] Abrir tela Premium.
- [ ] Clicar em `Assinar mensal`.
- [ ] Confirmar redirecionamento para Stripe Checkout.
- [ ] Voltar e testar `Assinar anual`.
- [ ] Usar cartão de teste da Stripe.
- [ ] Confirmar retorno para o app após pagamento.

### Webhook

- [ ] Ver no Stripe se o webhook recebeu evento `checkout.session.completed`.
- [ ] Confirmar evento `customer.subscription.created` ou `customer.subscription.updated`.
- [ ] Confirmar `invoice.paid` ou `invoice.payment_succeeded`.
- [ ] Confirmar no Supabase se `profiles.subscription_status` virou `active` ou `trialing`.
- [ ] Simular falha de pagamento e confirmar status `past_due`.
- [ ] Cancelar assinatura e confirmar status `canceled`.

### Portal cliente

- [ ] Abrir `Configurações`.
- [ ] Clicar em `Gerenciar assinatura`.
- [ ] Confirmar redirecionamento para Customer Portal.
- [ ] Testar troca de cartão.
- [ ] Testar cancelamento em modo teste.

### PWA no celular

- [ ] Abrir a URL em Android/Chrome e instalar o app.
- [ ] Abrir a URL em iPhone/Safari e usar `Adicionar à Tela de Início`.
- [ ] Abrir o app instalado.
- [ ] Fazer login no app instalado.
- [ ] Desligar internet e confirmar que o app ainda abre com fallback básico.
- [ ] Ligar internet e confirmar sincronização.

## 5. Checklist final de lançamento beta

### Produto

- [ ] Domínio final conectado na Vercel.
- [ ] `APP_URL` atualizado para o domínio final.
- [ ] Supabase `Site URL` atualizado para o domínio final.
- [ ] Redirect URLs do Supabase incluem domínio final e Vercel.
- [ ] Webhook Stripe aponta para o domínio final.
- [ ] Logo oficial aparece no app.
- [ ] Favicon aparece no navegador.
- [ ] PWA instala com nome `Fluxo`.

### Legal e confiança

- [ ] Criar página ou documento placeholder de Política de Privacidade.
- [ ] Criar página ou documento placeholder de Termos de Uso.
- [ ] Adicionar e-mail de suporte ou WhatsApp de suporte.
- [ ] Validar textos de cobrança: 30 dias grátis, depois R$ 7,90/mês ou R$ 59,90/ano.

### Operação

- [ ] Fazer backup do projeto Supabase antes de divulgar.
- [ ] Exportar um backup JSON pelo app.
- [ ] Testar restore manual a partir do backup JSON, se necessário.
- [ ] Testar com 3 usuários reais antes de abrir para mais pessoas.
- [ ] Pedir feedback sobre cadastro, dashboard, cartões, Premium e PWA.
- [ ] Monitorar Stripe Webhooks nas primeiras assinaturas.
- [ ] Monitorar logs da Vercel após o lançamento.

## Comandos finais antes de publicar

Rode no projeto:

```bash
npm install
npm run lint
npm run build
```

Se ambos passarem, faça deploy:

```bash
vercel --prod
```

## Referências oficiais

- Supabase API Keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Stripe Products and Prices: https://docs.stripe.com/products-prices/manage-prices
- Stripe Customer Portal: https://docs.stripe.com/customer-management
- Stripe Webhooks: https://docs.stripe.com/webhooks
- Vercel Vite: https://vercel.com/docs/frameworks/frontend/vite
- Vercel Environment Variables: https://vercel.com/docs/environment-variables
