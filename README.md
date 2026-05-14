# Fluxo

Finance OS em React + Vite com autenticação, fallback local, sincronização Supabase e PWA.

Guia final de publicação: [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md).

## Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e execute `supabase/fluxo_schema.sql`.
3. Execute também `supabase/billing_schema.sql` para criar `profiles` e `subscriptions`.
4. Copie `.env.example` para `.env`.
5. Preencha:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Use a chave `anon` pública do projeto. A segurança dos dados fica nas políticas de Row Level Security do SQL.
A `SUPABASE_SERVICE_ROLE_KEY` deve ficar apenas em funções serverless/Vercel, nunca no frontend.

### Segurança Supabase

- `incomes`, `expenses`, `cards` e `transactions` usam RLS por `auth.uid() = user_id`.
- `profiles` e `subscriptions` liberam apenas `select` para o próprio usuário.
- Status de assinatura é escrito somente pelas Vercel Functions usando `SUPABASE_SERVICE_ROLE_KEY`.

## Stripe

1. No Stripe Dashboard em modo test, crie um produto chamado `Fluxo Premium`.
2. Crie dois Prices recorrentes em BRL:
   - Mensal: `R$ 7,90`, cobrança mensal.
   - Anual: `R$ 59,90`, cobrança anual.
3. Copie os IDs dos prices (`price_...`) para:

```bash
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
```

4. Copie sua secret key de teste para:

```bash
STRIPE_SECRET_KEY=sk_test_...
```

5. Configure o Customer Portal em https://dashboard.stripe.com/test/settings/billing/portal para permitir troca de plano, atualização de pagamento e cancelamento. Se o usuário já tiver uma assinatura Stripe, os botões de assinatura abrem o portal para evitar cobranças duplicadas.

### Webhook Stripe

Endpoint em produção:

```bash
https://seu-dominio.vercel.app/api/stripe-webhook
```

Eventos mínimos:

```bash
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_succeeded
invoice.payment_failed
```

Copie o signing secret para:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

Para testar localmente com Stripe CLI:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe-webhook
stripe trigger checkout.session.completed
```

Use `vercel dev` para testar as funções `/api` localmente, porque o Vite puro não executa Vercel Functions.

## Rodar localmente

```bash
npm install
npm run dev
```

Depois acesse a URL exibida pelo Vite, crie uma conta ou faça login e finalize o onboarding. Se a conexão cair, o Fluxo mantém fallback em `localStorage`. Durante o teste grátis/Premium, a sincronização com Supabase fica ativa; no modo básico, o app permanece local.

## Lançamento beta

- Onboarding inicial salvo no usuário.
- Teste grátis de 30 dias calculado pela data de criação da conta.
- Modo básico após o teste: receitas, despesas, transações e um cartão continuam disponíveis.
- Recursos Premium: múltiplos cartões, relatórios avançados e sincronização ilimitada.
- PWA instalável com manifest, service worker, splash/theme color e offline básico.

## Deploy na Vercel

1. Suba o projeto para GitHub, GitLab ou Bitbucket.
2. Na Vercel, importe o repositório como projeto Vite.
3. Configure as Environment Variables em Production e Preview:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_MONTHLY
STRIPE_PRICE_YEARLY
APP_URL
```

Em desenvolvimento com `vercel dev`, use `APP_URL=http://localhost:3000`. Em produção, use o domínio final publicado.

4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Deploy.

Também é possível publicar pela CLI:

```bash
npm install -g vercel
vercel
vercel --prod
```

Referência oficial: https://vercel.com/docs/deployments e https://vercel.com/docs/cli.

## PWA no celular

Android/Chrome: abra a URL publicada, toque no menu do navegador e escolha "Adicionar à tela inicial" ou "Instalar app".

iPhone/Safari: abra a URL, toque em Compartilhar e escolha "Adicionar à Tela de Início".

## Verificações

```bash
npm run lint
npm run build
```
