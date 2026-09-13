# Pedro OS — crie seu próprio Personal OS

App pessoal para hábitos, tarefas, treinos, diário, planejamento semanal, livros e notas/Second Brain. É uma **PWA**: abre por um link HTTPS e fica na tela inicial do celular, sem publicação nas lojas.

Este guia é para o João Victor criar uma cópia independente e personalizar. Stack: Next.js 16.2, React 19, TypeScript, Tailwind 4 e Supabase. A instalação do Pedro está em <https://os.pedroperes.org>; você terá seu próprio link, login e banco.

## 1. Serviços e custo

| Serviço | Função | Opção gratuita |
| --- | --- | --- |
| [GitHub](https://github.com) | Código e histórico | Conta e repositório pessoal |
| [Supabase](https://supabase.com) | Postgres, login e arquivos | Projeto no plano Free |
| [Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) | Hospedagem atual do Pedro, usando OpenNext | Workers Free com link `seu-app.seu-subdominio.workers.dev` |
| [Vercel Hobby](https://vercel.com/docs/plans/hobby) | Alternativa para hospedar o mesmo app | Uso pessoal, não comercial, com link `seu-app.vercel.app` |

**Limitação real da hospedagem atual:** Workers Free oferece 100 mil requisições/dia e 10 ms de CPU por requisição. Este app já apresentou erro 1102 nesse plano; não dá para prometer funcionamento estável gratuito no Cloudflare. Veja o [registro técnico](docs/worker-performance.md) e os [limites oficiais](https://developers.cloudflare.com/workers/platform/limits/). Para priorizar custo zero, use Vercel Hobby se atingir esse limite. A alternativa Vercel não exige contratar Workers Paid.

O Supabase Free inclui banco de 500 MB e pode pausar projetos após uma semana de inatividade; veja as [cotas atuais](https://supabase.com/pricing). Planos gratuitos têm limites. Não é necessário comprar domínio, contratar Railway/VPS ou ter conta Apple Developer/Google Play. Domínio próprio é opcional e normalmente custa dinheiro.

## 2. Copiar o código

Faça um **Fork** de [pedro-os-starter](https://github.com/pedroncperes1/pedro-os-starter) para sua conta, ou baixe o ZIP e crie seu próprio repositório. Esta distribuição pública tem histórico Git novo: não inclui o Brain privado, foto pessoal, dados pessoais das sementes SQL, credenciais, caches nem binários locais. A estrutura do banco e as funcionalidades do app foram preservadas.

Instale Git, Node.js 22 LTS e pnpm 10. Na sua cópia:

```bash
npm install -g pnpm@10
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
cd SEU_REPOSITORIO
pnpm install --frozen-lockfile
cp .env.local.example .env.local
```

Use a branch `main`, que reúne a versão compartilhada. Se baixou o ZIP, abra a pasta extraída e rode os dois últimos comandos. Credenciais reais, `.env.local`, dependências e builds não fazem parte do GitHub.

## 3. Criar seu Supabase e aplicar todas as migrações

1. Crie uma organização Free e um projeto no [painel Supabase](https://supabase.com/dashboard), na região mais próxima de você. Guarde a senha do banco.
2. Nas configurações de API, copie **Project URL** e a chave **anon pública**. A chave publishable também pode ser usada pelo cliente; a variável do projeto continua se chamando `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. **Aplique todas as migrações antes de criar seu usuário ou entrar no app.** Estão em `supabase/migrations/`, de `000_schema.sql` até `086_pedro_book_finish_dates_2026.sql`. Só as três primeiras não bastam.

Na raiz da sua cópia:

```bash
pnpm exec supabase login
pnpm exec supabase init
pnpm exec supabase link --project-ref SEU_PROJECT_REF
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
```

O project ref é o identificador do **seu** projeto no painel. Confira o destino antes de confirmar. Se `supabase/config.toml` já existir, pule `supabase init`. O CLI pedirá autenticação/senha quando necessário. Não use o banco ou project ref do Pedro.

Alternativa: execute cada SQL no SQL Editor do projeto novo, em ordem numérica, aguardando sucesso antes do próximo. Escolha um método; não reaplique tudo sobre um banco já inicializado. O CLI registra o histórico de migrações e facilita futuras atualizações.

As sementes de dados pessoais foram removidas desta cópia pública. Arquivos exclusivamente pessoais permanecem como operações vazias para preservar a numeração; as alterações de estrutura foram mantidas. A biblioteca compartilhada de frases continua sendo criada. Personalize seus dados pelo assistente e pelas telas do app.

### Criar login sem depender de e-mail

**Depois das migrações**, abra **Authentication → Users → Add user → Create new user** no Supabase. Cadastre seu e-mail e senha forte; marque a confirmação automática do e-mail, se oferecida. O trigger cria seu perfil em `public.users`.

O app já tem login por **senha**. Após criar sua conta, desabilite novos cadastros em Authentication para manter a instalação pessoal. Preserve Auth e as políticas RLS que protegem os dados por usuário.

Magic link é opcional. O [SMTP padrão do Supabase](https://supabase.com/docs/guides/auth/auth-smtp) só envia para e-mails autorizados da equipe do projeto e tem limites; outros destinatários exigem SMTP próprio. Login por senha evita essa dependência.

## 4. Rodar localmente

Preencha `.env.local` com valores do seu projeto:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
BLOG_GITHUB_TOKEN=
```

A chave anon/publishable é pública por definição; a proteção depende de Auth + RLS. Nunca coloque chave `service_role`, senha do banco, token GitHub ou VAPID privado em variáveis `NEXT_PUBLIC_*` nem no Git.

```bash
pnpm dev
```

Abra <http://localhost:3000>, entre com sua senha e complete o assistente de conta, hábitos e treino. Ajuste nome, fuso e rotina. Para São Paulo, use `America/Sao_Paulo`. Os padrões vêm de `lib/seed.ts`: vale personalizá-los antes do primeiro acesso.

## 5. Personalizar

| O que mudar | Onde |
| --- | --- |
| Nome da PWA e ícone instalado | `app/manifest.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png` |
| Título principal e fontes | `app/layout.tsx` |
| Nome/foto da barra lateral | `components/sidebar.tsx` (avatar genérico), `public/icons/` |
| Login e nome inicial | `app/login/`, `app/setup/account/page.tsx`, `app/setup/welcome/page.tsx` |
| Hábitos, exercícios e treino iniciais | `lib/seed.ts`; após o setup, altere os dados nas telas do app |
| Cores e estilos | `app/globals.css`, `DESIGN.md` |
| Identidade e materiais pessoais | Telas de identidade/Second Brain; crie seus próprios textos |
| Nome do Worker e domínio | `wrangler.jsonc` |
| E-mail que recebe lembretes | Valor de `PEDRO_USER_EMAIL` em `cron-worker/wrangler.jsonc` |

Procure também por `Pedro OS`, `example.com` e `you@example.com` em `app/`, `components/`, `lib/` e `cron-worker/`: alguns títulos e textos são fixos. O `brain/` privado do Pedro não faz parte desta cópia; os módulos do app usam seu banco Supabase. A aplicação ainda traz exemplos da rotina do Pedro.

## 6. Cloudflare — mesma hospedagem atual

1. Crie sua conta Free no [Cloudflare](https://dash.cloudflare.com) e configure seu subdomínio `workers.dev` em Workers & Pages.
2. Na sua cópia de `wrangler.jsonc`, mude `name` para `joao-os`, mantenha `"workers_dev": true` (o domínio pessoal já foi removido desta cópia). Preserve `main`, `assets`, flags de compatibilidade e observabilidade. Não adicione `limits.cpu_ms` no Free.
3. Rode os comandos abaixo. As variáveis Supabase devem estar em `.env.local`, lido durante o build.

```bash
pnpm exec wrangler login
pnpm exec opennextjs-cloudflare build
pnpm exec opennextjs-cloudflare deploy
```

4. Copie o link retornado, por exemplo `https://joao-os.seu-subdominio.workers.dev`.
5. Troque `NEXT_PUBLIC_SITE_URL` em `.env.local` pelo link real, **sem barra no final**, e repita build + deploy. As variáveis `NEXT_PUBLIC_*` ficam incorporadas no build; mudar só o painel não atualiza o JavaScript gerado.
6. No Supabase → **Authentication → URL Configuration**, configure **Site URL** com o link real e adicione aos Redirect URLs esse mesmo link seguido de `/auth/callback`, além de `http://localhost:3000/auth/callback`.
7. Abra o link, entre, complete o setup se necessário e teste salvar um hábito/nota e recarregar.

Este é um deploy de **Workers com OpenNext**, não um site estático no Cloudflare Pages. Referência: [OpenNext — configuração](https://opennext.js.org/cloudflare/get-started).

Se ocorrer **1102**, veja os logs e o [registro de CPU](docs/worker-performance.md). Reduzir tráfego não aumenta o limite por requisição. Para continuar sem pagar, siga a alternativa abaixo. O build também precisa caber no limite de tamanho do Worker Free.

## 7. Alternativa gratuita: Vercel Hobby

1. Entre no [Vercel](https://vercel.com) e escolha **Hobby**, para uso pessoal.
2. **Add New → Project → Import** seu repositório GitHub. Use a raiz do projeto, preset **Next.js**, Node.js **22.x**, instalação `pnpm install --frozen-lockfile`, build `pnpm build` e output padrão do Next.js.
3. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_SITE_URL` nas variáveis de Production. Se ainda não souber o endereço final, atualize o site URL após o primeiro deploy e faça **Redeploy**.
4. Clique **Deploy**, copie `https://SEU_APP.vercel.app` e configure Site URL e Redirect URL `https://SEU_APP.vercel.app/auth/callback` no Supabase.
5. Teste login, setup e persistência dos dados. A integração GitHub gera novos deploys quando você envia alterações para `main`.

Aqui use `pnpm build`, sem OpenNext para hospedar o app. O Supabase continua sendo seu banco. O Worker de lembretes pode continuar no Cloudflare, se desejado. Hobby tem cotas e é restrito a [uso pessoal e não comercial](https://vercel.com/docs/plans/hobby).

## 8. Colocar no celular gratuitamente

**iPhone/iPad:** abra **seu link HTTPS no Safari** → Compartilhar → **Adicionar à Tela de Início** → Adicionar. Se aparecer, mantenha “Abrir como App da Web” ativado.

**Android:** abra **seu link HTTPS no Chrome** → menu ⋮ → **Instalar app** ou **Adicionar à tela inicial** → confirme.

Abra pelo ícone e faça login. Computador e celular usam a mesma conta e banco. Não precisa de App Store/Play Store. A PWA atual **precisa de internet**: o service worker não implementa cache offline.

## 9. Opcionais

### Notificações por push

Instalar no celular não ativa lembretes automaticamente:

1. Gere seu par de chaves: `pnpm dlx web-push generate-vapid-keys`.
2. Coloque a pública em `NEXT_PUBLIC_VAPID_PUBLIC_KEY` no app e refaça build/deploy.
3. Em `cron-worker/wrangler.jsonc`, mude o nome para `joao-os-cron` e o **valor** de `PEDRO_USER_EMAIL` para seu e-mail de login. Preserve o nome da variável, o cron e `workers_dev: false`.
4. Configure os secrets na pasta do Worker, com seu Supabase e seu par VAPID:

```bash
cd cron-worker
pnpm install --frozen-lockfile
pnpm exec wrangler secret put SUPABASE_URL
pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
pnpm exec wrangler secret put VAPID_PUBLIC_KEY
pnpm exec wrangler secret put VAPID_PRIVATE_KEY
pnpm exec wrangler secret put VAPID_CONTACT
pnpm deploy
```

Se o CLI perguntar, permita criar o novo Worker com o nome configurado. `VAPID_CONTACT` é `mailto:seu-email@exemplo.com`. A service-role fica somente nesse Worker, pois tem acesso privilegiado. Ative notificações nas configurações do app instalado. No iPhone, push requer iOS 16.4+ e instalação na tela inicial ([WebKit](https://webkit.org/blog/13966/web-push-for-web-apps-on-ios-and-ipados/)). O cron verifica a cada cinco minutos; não espere precisão de segundos.

### Blog

O blog público é **outro repositório**, não incluído aqui. Deixe `BLOG_GITHUB_TOKEN` vazio até criar sua integração. Para publicar, configure no servidor:

- `BLOG_GITHUB_TOKEN`: token fine-grained com Contents Read/Write apenas no seu repositório de blog.
- `BLOG_REPO=SEU_USUARIO/SEU_BLOG`, `BLOG_CONTENT_PATH` e `BLOG_DEFAULT_BRANCH`.

No Cloudflare, use `wrangler secret put BLOG_GITHUB_TOKEN` e variáveis do Worker para as demais configurações. No Vercel, use variáveis de ambiente e redeploy. Os defaults de `lib/blog-publish.ts` são placeholders: configure seu repositório antes de publicar. Troque também `https://example.com` em `lib/blog-publish.ts` e nas telas de `app/(app)/blog/` pelo endereço do seu blog. Você precisa criar separadamente a hospedagem e o pipeline do seu blog.

## 10. Validar e atualizar

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm exec eslint app components lib
pnpm build
```

Para Cloudflare, acrescente o build OpenNext e `pnpm exec wrangler deploy --dry-run`. Sucesso local não comprova que o Worker cabe nos limites de CPU em produção. Teste no celular: login, hábito marcado após recarregar, nova nota, treino, livro e navegação entre datas.

Para atualizações do banco via CLI, revise os SQLs novos e rode `pnpm exec supabase db push --dry-run` antes de `db push`. Não use `db reset` contra seu projeto remoto. Faça backup antes de mudanças de estrutura.

Problemas frequentes:

- **Variáveis ausentes:** preencha `.env.local` e reinicie `pnpm dev`; em produção, refaça build/deploy.
- **Login redireciona para outro site:** alinhe `NEXT_PUBLIC_SITE_URL`, Site URL e Redirect URLs.
- **Tabela/função ausente:** confirme todas as migrações no projeto correto.
- **Perfil ausente:** o trigger de `001_handle_new_user.sql` deve existir antes da criação da conta.
- **Magic link não chega:** use senha ou configure SMTP próprio.
- **Cloudflare 1102:** consulte o registro técnico e a alternativa Vercel.
- **Supabase pausado:** reative no painel e confira as cotas.

Para agentes de código: leia `AGENTS.md` e a documentação em `node_modules/next/dist/docs/` antes de alterar APIs do Next.js 16.
