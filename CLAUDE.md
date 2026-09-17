# Domingo

App para registrar os jogos semanais de um horário de futebol society e acompanhar as estatísticas da temporada. Um administrador lança o resultado; o grupo lê por link, sem login.

Interface e comentários em **português do Brasil**.

## Onde está o quê

| Arquivo | Conteúdo |
|---|---|
| `docs/01-PRODUTO.md` | Telas, regras de negócio, decisões e o porquê de cada uma, roadmap |
| `docs/02-MODELO-DADOS.md` | Modelo de dados e as queries de estatística |
| `docs/03-DESENVOLVIMENTO.md` | Stack, estrutura de pastas, paleta, ordem de construção |
| `docs/04-MANUAL.md` | Manual do usuário final |
| `docs/schema.sql` | Migração já aplicada no Supabase |
| `docs/rpc-salvar-rodada.sql` | Função transacional, já aplicada |
| `src/lib/tipos.ts` | Tipos espelhando o schema |
| `src/lib/dados.ts` | Camada única de acesso ao banco |

Ao encontrar um caso que a especificação não previu, leia a seção de Decisões do `01-PRODUTO.md` antes de escolher. O raciocínio está lá justamente para que as decisões novas apontem na mesma direção das antigas.

## Estado

Banco criado e populado no Supabase, com uma rodada real dentro (Boca 10 x 7 Racing, 07/09). `src/lib/` pronto. Nenhuma tela construída ainda.

Próximo passo: tela de Elenco. Depois Lançar em modo preencher, depois Estatísticas. A ordem está no fim do `03-DESENVOLVIMENTO.md` e não é arbitrária — Elenco é o loop completo mais simples de ler e escrever, e serve para descobrir problemas de configuração numa tela onde erro é barato.

## Regras não negociáveis

**Nenhum componente chama `supabase.from()` direto.** Todo acesso passa por `src/lib/dados.ts`. Precisa de uma consulta nova? Adicione uma função lá.

**A soma dos gols individuais tem que bater com o placar.** O botão de salvar fica desabilitado enquanto não fechar dos dois lados. O banco também rejeita, mas a tela precisa avisar antes.

**Assistência nunca bloqueia salvamento.** Campo opcional, padrão zero. O dado de origem é reconhecidamente incerto.

**Goleiro (`tipo = 'goleiro'`) fica fora de artilharia, assistências e aproveitamento.** Só aparece no ranking próprio, medido por gols sofridos por partida.

**Uniforme aposentado (`ativo = false`) some do seletor de lançamento mas continua em partidas antigas.** Nunca apagar uniforme. O seletor deve incluir o uniforme já selecionado mesmo se inativo, para não quebrar edição de rodada antiga.

**Rodada usa exclusão lógica (`ativo = false`), nunca `DELETE`.**

**Ranking de aproveitamento exige mínimo de partidas e mostra o tamanho da amostra.** Sem isso, quem jogou uma vez e ganhou lidera com 100%.

**Nada de `localStorage` para dado de domínio.** O banco é a fonte da verdade.

## Convenções

Português nos nomes de domínio (`jogador`, `rodada`, `escalacao`, `salvarRodada`) para bater com o schema. Inglês só no que é da linguagem ou biblioteca.

Mobile primeiro, responsivo até 360px. O app é usado no celular, quase sempre no domingo à noite.

Números em rankings e placares com `font-variant-numeric: tabular-nums`, senão as colunas dançam.

Paleta e tipografia estão no `03-DESENVOLVIMENTO.md`. Base verde-escura de campo à noite, dourado como acento único, Barlow e Barlow Condensed.

## Contexto que não está no código

O usuário é o administrador do horário e não é desenvolvedor experiente. Ao sugerir comandos de terminal, diga onde rodar e o que esperar de saída.

O texto real das súmulas é bagunçado — `Alan0-2`, `Barba 1 - 2`, `Leo 6`, `oca 10 x 7`. Isso é premissa, não exceção. Por isso a leitura de súmula (v1.2) usa modelo de linguagem e não expressão regular.

O marco que importa não é o app pronto: é a tela de Lançar funcionando, porque é quando a planilha pode ser aposentada. Tudo depois disso é melhoria em algo que já está em uso.
