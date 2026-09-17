# 01 — Produto

## O problema

Um horário de futebol society joga todo domingo de manhã. Dois times de seis jogadores de linha mais um goleiro cada, formação 2-3-1. Os goleiros são contratados de fora, fixos e recorrentes. O elenco tem mensalistas com vaga numerada e suplentes que entram quando alguém falta.

Hoje o organizador anota o resultado num papel ou no grupo, e depois joga tudo numa planilha à mão. A planilha vira estatística quando ele tem tempo — o que quase nunca acontece no meio do semestre. O trabalho é repetitivo, o dado se perde, e ninguém no grupo consegue consultar nada.

O app substitui a planilha.

## Quem usa

**O administrador** é o dono do horário. É a única pessoa que escreve. Ele nem sempre participa da montagem dos times ou da lista de presença no grupo — muitas vezes só recebe o resultado pronto. Lança na noite de domingo ou durante a semana, pelo celular.

**O grupo** são os jogadores. Só leem. Abrem o link mandado no WhatsApp para ver artilharia, aproveitamento e os jogos passados. Não têm conta, não têm senha, não preenchem nada.

Essa divisão é deliberada e está detalhada em [Decisões](#decisões-de-produto).

## Escopo da v1

1. Cadastro de jogadores (apelido, nome, tipo, vínculo, posição preferida)
2. Cadastro de uniformes com ciclo de vida (em uso / aposentado)
3. Lançamento do resultado por colagem de texto, com leitura assistida por IA
4. Lançamento do resultado campo a campo, como alternativa e como tela de conferência
5. Dashboard de estatísticas de jogadores e de partidas
6. Leitura pública por link

Fora da v1: montagem de times, confirmação de presença, controle financeiro, múltiplos administradores, múltiplos horários, contestação de resultado. Todos estão no [Roadmap](#roadmap) e o modelo de dados já os acomoda sem migração dolorosa.

## Telas

### Lançar

A tela central do app. Abre em modo **Colar texto**.

**Modo colar.** Uma área de texto onde o administrador cola a súmula exatamente como já escreve hoje. O botão "Ler texto" manda o conteúdo para uma função no servidor que usa a API da Anthropic para estruturar a súmula, e o resultado cai na tela de conferência já preenchido.

O texto real do usuário é bagunçado e isso é premissa, não exceção. Exemplos vindos dos dados reais: `Alan0-2` sem espaço, `Barba 1 - 2` com espaços, `Leo 6` sem traço nenhum, `oca 10 x 7 Racing` com letra faltando no nome do time, e `João 2 ?` com uma interrogação indicando que quem anotou ficou na dúvida sobre a assistência. Um parser de expressão regular quebra nesses casos toda semana; por isso a leitura é feita por modelo de linguagem, que também resolve apelido para jogador cadastrado ("JV" e "João Vitor" são a mesma pessoa).

Formato de referência que o grupo pode adotar para facilitar, sem ser obrigatório:

```
Time A 10 x 7 Time B
Começou 9h05

Time A
Goleiro: Nome
Jogador 6
Jogador 0-2
Jogador

Time B
Goleiro: Nome
Jogador 5
Jogador 1-2
```

Convenção de números: o primeiro é gols, o segundo é assistências, separados por traço. Nome sozinho é zero e zero. Interrogação significa dúvida e é lida como zero.

**Modo preencher.** Dois cartões de time lado a lado, cada um com seletor de uniforme e o placar em número grande. Abaixo, a lista de quem jogou de cada lado, com botões de mais e menos para gols e assistências. Seletor de goleiro por time. Campo de horário de início.

**A leitura nunca salva direto.** Ela sempre entrega na tela de conferência com a validação rodando. Se a IA errar, o administrador vê e corrige antes de salvar.

**Validação do placar.** Barra de progresso por time mostrando quantos gols individuais já foram lançados contra o placar declarado. O botão de salvar fica desabilitado enquanto a soma dos gols individuais não bate exatamente com o placar dos dois lados. Isso elimina erro de digitação e resolve a ambiguidade que hoje aparece como interrogação na súmula em papel.

**Jogador desconhecido.** Se a leitura encontrar um nome que não está no elenco, o app cria o cadastro na hora como suplente, marca a linha com "criado agora" e avisa acima da tela. Sem isso a colagem quebraria toda semana que entrasse um convidado, o que é comum pela rotação de suplentes.

### Estatísticas

Duas famílias de dado.

**Jogadores** — rankings em abas:

- Artilharia (gols, com número de jogos ao lado)
- Assistências
- Aproveitamento (pontos ganhos sobre pontos disputados, com V/E/D)
- Presença (jogos de N rodadas)
- Goleiros (gols sofridos por partida, ordem crescente)

Goleiros aparecem só na própria aba. Não entram em artilharia nem em aproveitamento, porque não pertencem a um time — são fixos no gol enquanto os times giram, e atribuir vitória a eles não significa nada. A estatística deles é gols sofridos por partida, e a comparação entre os dois é justa porque ambos enfrentam os dois times ao longo do dia.

**Partidas** — o grupo gosta de rever jogo antigo, então a partida é um objeto navegável:

- Lista cronológica das rodadas, clicável
- Ficha da partida: placar, uniformes, horário, escalação dos dois lados com gols e assistências de cada um
- Jogos com mais gols na temporada (total das duas equipes)
- Maiores goleadas (maior diferença)
- Jogos mais apertados
- Média de gols por partida ao longo do semestre

### Elenco

**Uniformes.** Lista com amostra das duas cores, nome e ano. Botão que alterna entre "em uso" e "aposentado". Formulário para criar um novo com nome e duas cores.

O horário mantém três uniformes em rotação e produz cerca de um por ano; conforme as pessoas saem, alguns ficam obsoletos. Aposentar tira o uniforme do seletor de lançamento mas **mantém o registro**, para que resultados antigos que o usavam continuem íntegros. Uniforme nunca é apagado.

**Jogadores.** Lista com apelido, nome completo, posição preferida e etiqueta de vínculo. O apelido é o identificador visível em todo o app e é o que a leitura de texto procura, então precisa ser único dentro do horário.

## Regras de negócio

1. A soma dos gols individuais de um time é igual ao placar daquele time. O sistema impede salvar fora disso.
2. Assistência é campo opcional e nunca bloqueia o salvamento. O dado de origem é reconhecidamente incerto; exigir preenchimento produziria número inventado.
3. Goleiro é `tipo = 'goleiro'`, fica fora do sorteio, da artilharia e do aproveitamento.
4. Um jogador aparece no máximo uma vez por partida.
5. Uniforme aposentado não aparece no seletor de lançamento, mas continua válido em partidas já registradas.
6. Ranking de aproveitamento exige um mínimo de partidas para entrar. Com poucas rodadas, o ruído domina: alguém que jogou duas e venceu as duas apareceria com 100%. Sugestão de corte: 2 partidas no começo do semestre, subindo para 5 ou 6 quando houver volume.
7. Rodadas e partidas usam exclusão lógica, nunca `DELETE`.

## Decisões de produto

### Um escreve, todos leem

Cada jogador lançar os próprios gols parece democrático e não funciona. Gol é autodeclarado e a memória é generosa: quem fez dois lança três, sem má fé, porque lembra da bola que bateu na trave e entrou. A validação do placar então trava — a soma dá doze num jogo que terminou dez — e quem lançou por último paga a conta de ter que cortar o próprio gol.

O custo de coordenação também é proibitivo: fechar uma partida exigiria que doze pessoas abrissem o app no domingo. Abririam cinco, e o administrador correria atrás das outras sete, que é exatamente o trabalho que o app deveria eliminar.

O valor do multiusuário está na leitura, não na escrita. As pessoas querem ver a artilharia, não digitá-la.

### Nuvem desde o início, sem contas de usuário

Guardar tudo localmente no celular parece mais simples, mas coloca um semestre inteiro de histórico num aparelho só. Celular quebra, é trocado, é formatado — e o app existe justamente para acumular histórico.

A solução é Postgres gerenciado com leitura pública e escrita protegida. O grupo acessa por link, sem cadastro. Só o administrador autentica. Ninguém precisa criar conta em nada, e não é preciso construir sistema de autenticação na v1.

### O fluxo rápido é o principal, não a alternativa

Registrar o resultado é suficiente para derivar quase toda a estatística: quem apareceu em qual lado do placar já entrega presença, gols, assistências, aproveitamento e duplas. O que se perde é a posição de cada um em campo e o rastreio de mensalista e substituição.

Por isso as etapas de pré-jogo — confirmação de presença, sorteio, escalação por posição — não são um caminho separado. São uma conveniência opcional que, quando usada, pré-preenche a tela de resultado. Quem participou da montagem chega no domingo com tudo pronto; quem não participou digita direto. **A tela de resultado é a fonte da verdade nos dois casos**, e os dois caminhos escrevem exatamente nas mesmas tabelas.

Os dois goleiros são mantidos no fluxo rápido mesmo custando dois toques, porque sem eles a estatística de goleiro deixa de existir. Como são fixos, o app pré-preenche com os da rodada anterior.

## Roadmap

**v1.1 — Dashboard navegável.** Filtro por período (mês, semestre, ano), recorte por uniforme, e ficha individual do jogador ao tocar no nome do ranking. A ficha individual é o que mais engaja, porque é onde cada um vê os próprios números.

**v1.2 — Pré-jogo.** Confirmação de presença com as vagas numeradas de mensalista e a fila ordenada de suplentes, substituição rastreada (`substitui_id`), montagem de times manual ou sorteada, escalação por posição com template de formação.

O sorteio balanceado usa o aproveitamento acumulado como nota, sem precisar de sistema de rating. Precisa de dois modos: aleatório puro, para as primeiras semanas quando ainda não há dado, e balanceado depois. Em qualquer caso, permitir arrastar jogador entre times após o sorteio — sempre há ajuste de última hora.

**v1.3 — Formações customizáveis.** O 2-3-1 é só um template. Como `posicao` é texto livre dentro da escalação, qualquer formação já funciona no banco; o que falta é tornar o template configurável na interface (nome da formação e lista de vagas), permitindo times de 5, 7 ou 8.

**v2 — Financeiro.** Mensalidade, diária de suplente, pagamento dos goleiros, caixa com saldo, pendências nominais por data, e quem pagou o quê. Depende de `presenca` existir para saber quem jogou e sob qual vínculo.

**v2 — Participação do grupo.** Contestação em vez de escrita distribuída: o administrador lança, o resultado aparece para todos, e quem discorda marca a divergência para o administrador revisar. Engaja sem quebrar a integridade do dado.

**v3 — Múltiplos horários e administradores.** Vários horários no mesmo app, papéis de dono e administrador, convite por link. O esquema já carrega `horario_id` em todas as tabelas justamente para que isso seja ligar as políticas de acesso, e não uma migração.

**v3 — Estatísticas avançadas.** Duplas e trios com química medida como diferença entre o aproveitamento juntos e o aproveitamento individual de cada um, não como taxa bruta. Exige mínimo de partidas juntos e exibição do tamanho da amostra ao lado do percentual. Rating por Elo, que é o mecanismo correto para "quem é melhor" porque premia vencer contra time forte e se autocorrige sem ninguém opinar. Notas por avaliação entre jogadores foram descartadas: geram política e ressentimento no grupo.

## Sobre transformar em produto

A categoria não está vazia no Brasil, e quase todo concorrente ataca estatística e sorteio de time — que é a parte fácil e onde todos se parecem.

O que os dados reais deste horário revelam, e que os apps genéricos não resolvem, é a **operação**: vaga numerada de mensalista, fila ordenada de suplente com e sem uniforme, substituição rastreada, lista de espera para virar mensalista, e caixa com pendência nominal por data. Isso é específico demais para app genérico e é a dor semanal de quem organiza. Se o projeto virar produto, a aposta é aí, não no dashboard.
