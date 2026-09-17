# 03 — Desenvolvimento

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| App | React + TypeScript + Vite | Rápido, sem framework pesado para um app de três telas |
| Estilo | Tailwind | Paleta abaixo como variáveis CSS |
| Empacotamento | PWA (`vite-plugin-pwa`) | Instala na tela inicial sem loja de aplicativos |
| Banco e API | Supabase (Postgres, Auth, Edge Functions) | Postgres de verdade; as estatísticas são SQL |
| Leitura de súmula | Edge Function chamando a API da Anthropic | A chave nunca vai para o navegador |
| Hospedagem | Vercel ou Netlify | Deploy por push, domínio grátis |

### Por que PWA e não app nativo

Publicar em loja adiciona conta de desenvolvedor, revisão e ciclo de atualização, para um app que vinte pessoas vão usar. PWA se atualiza na hora e se distribui por link no grupo. Se em seis meses o uso justificar, empacotar com Capacitor e virar app nativo não exige reescrever nada.

### Custo

O nível gratuito do Supabase cobre um horário com folga. O único custo variável é a API da Anthropic na leitura de súmula, que roda uma vez por semana com um texto de vinte linhas — desprezível.

## Subir o ambiente

### 1. Projeto

```bash
npm create vite@latest domingo -- --template react-ts
cd domingo
npm install @supabase/supabase-js
npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa
```

### 2. Supabase

1. Criar projeto em [supabase.com](https://supabase.com), guardar a senha do banco.
2. Abrir **SQL Editor**, colar o conteúdo de [schema.sql](schema.sql) inteiro e executar. Cria tabelas, índices, gatilhos, views, políticas de acesso e uma semente de exemplo.
3. Em **Project Settings → API**, copiar a *Project URL* e a chave *anon public*.
4. Em **Authentication → Users**, criar o usuário do administrador com email e senha. Copiar o UUID dele.
5. Voltar ao SQL Editor e registrar esse usuário como dono:

```sql
insert into administrador (horario_id, user_id, papel)
select h.id, 'UUID-DO-USUARIO', 'dono' from horario h;
```

Sem esse passo o login funciona mas nada pode ser escrito, porque as políticas de acesso conferem a tabela `administrador`.

### 3. Variáveis de ambiente

`.env.local` na raiz:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

A chave *anon* é pública por natureza e pode ir para o navegador — quem protege a escrita é o Row Level Security, não o segredo da chave. A chave *service_role* nunca deve aparecer no front.

### 4. Edge Function da leitura de súmula

```bash
npx supabase login
npx supabase link --project-ref SEU-REF
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy ler-sumula
```

A função recebe `{ texto, jogadores, uniformes }`, monta o prompt, chama a API da Anthropic e devolve JSON estruturado. Ela existe por um motivo específico: a chave da Anthropic não pode ficar no código do navegador, onde qualquer um lê.

Identificador do modelo: usar o Sonnet atual (`claude-sonnet-5` no momento da escrita). Conferir em [docs.claude.com](https://docs.claude.com) antes de fixar.

## Estrutura

```
src/
  lib/
    supabase.ts        cliente configurado
    dados.ts           ÚNICA camada de acesso ao banco
    estatisticas.ts    agregações derivadas
    tipos.ts           tipos do domínio
  paginas/
    Lancar.tsx
    Estatisticas.tsx
    Partida.tsx
    Elenco.tsx
    Entrar.tsx
  componentes/
    PlacarLado.tsx     seletor de uniforme + placar + barra de validação
    ListaSumula.tsx    linhas de jogador com contadores de gol e assistência
    Ranking.tsx
supabase/
  migrations/0001_schema.sql
  functions/ler-sumula/index.ts
```

### A regra da camada única

Nenhuma chamada ao Supabase fora de `lib/dados.ts`. Nada de `supabase.from(...)` dentro de componente.

Funções exportadas: `listarJogadores`, `criarJogador`, `listarUniformes`, `criarUniforme`, `alternarUniforme`, `listarRodadas`, `lerRodada`, `salvarRodada`, `lerSumula`.

O motivo é concreto: modo offline, troca de backend ou cache passam a ser mudança em um arquivo em vez de quarenta. Num projeto pequeno essa disciplina parece exagero e é justamente onde ela é barata de manter.

## Regras de implementação

**Validação do placar.** O botão de salvar fica desabilitado enquanto a soma dos gols individuais não bate exatamente com o placar dos dois lados. É a única trava dura do app.

**Assistência nunca bloqueia.** Campo opcional, padrão zero, sem validação cruzada.

**A leitura de súmula nunca salva.** Sempre entrega na tela de conferência preenchida, com a validação ativa. Se o modelo errar, a barra não fecha e o botão não libera.

**Jogador desconhecido vira cadastro.** Nome não reconhecido na leitura é criado como suplente, marcado visualmente na linha e anunciado acima da tela. Sem isso a colagem quebra toda semana que entra um convidado.

**Uniforme aposentado não some.** Fora do seletor de lançamento, presente em partidas antigas. O seletor deve incluir o uniforme atualmente selecionado mesmo que inativo, para não quebrar a edição de rodada antiga.

**Goleiro fora dos rankings de linha.** Filtrar por `tipo = 'linha'` em artilharia, assistências e aproveitamento.

**Mínimo de amostra.** Aproveitamento exige um número mínimo de partidas e o ranking mostra o tamanho da amostra ao lado do valor.

**Gravar rodada é transacional.** `rodada`, `partida` e as linhas de `escalacao` entram juntas. Preferir uma função no Postgres (`salvar_rodada(jsonb)`) a três chamadas encadeadas do cliente, para não deixar rodada órfã se a rede cair no meio.

## Paleta e tipografia

Herdadas do protótipo. Campo à noite: base verde-escura, linhas de cal como divisores, dourado como único acento.

```css
--pitch:    #0D1A15;   /* fundo */
--surface:  #15251E;   /* cartões */
--surface2: #1D3229;   /* campos */
--chalk:    #EDEBE3;   /* texto */
--muted:    #7E9189;   /* texto secundário */
--line:     rgba(237,235,227,.13);
--gold:     #D9A441;   /* acento único: ação primária, destaque */
--alert:    #C9634B;   /* placar estourado */
```

Tipografia: Barlow para texto, Barlow Condensed para placares, números de ranking e títulos. Números sempre com `font-variant-numeric: tabular-nums`, senão os rankings dançam.

A cor primária de cada uniforme entra como faixa no topo do cartão do time e na barra de validação. É a única cor que o app não controla, e é ela que diz de qual lado você está digitando.

## Qualidade mínima

Responsivo até 360px de largura — o app é usado no celular, quase sempre. Foco de teclado visível. `prefers-reduced-motion` respeitado. Nada de `localStorage` para dado de domínio; o banco é a fonte da verdade.

## Ordem sugerida de construção

1. Esquema no Supabase e `lib/dados.ts` com leitura
2. Tela de Elenco (jogadores e uniformes) — é a mais simples e destrava o resto
3. Tela de Lançar em modo preencher, com a validação do placar
4. Tela de Estatísticas com os cinco rankings
5. Login do administrador e proteção das telas de escrita
6. Edge Function e modo colar
7. Ficha de partida e estatísticas de jogo
8. PWA e deploy

Cada passo deve ficar utilizável antes do seguinte. O passo 3 sozinho já substitui a planilha.
