-- =============================================================
-- 050_quotes_max_peters.sql
-- Adds Max Peters + 25 founder-fundamentals quotes (PT-BR).
-- Each quote is the original numbered headline + body paragraph,
-- joined with \n\n so the QuoteOfDay card's whitespace-pre-line
-- preserves the break. Idempotent — author keyed by name, quotes
-- keyed by distinctive headline prefix.
-- =============================================================

insert into authors (name, photo_url)
select 'Max Peters', '/authors/max-peters.png'
where not exists (select 1 from authors where name = 'Max Peters');

-- Backfill photo if an earlier row was created without one.
update authors set photo_url = '/authors/max-peters.png'
  where name = 'Max Peters' and photo_url is null;

-- Quote 1.
insert into quotes (author_id, text)
select a.id,
       E'Não sofra da "síndrome do vira-lata".\n\nA ideia é nunca superestimar os outros e subestimar você mesmo. Como o investidor bilionário Ray Dalio gosta de falar, "você pode alcançar qualquer coisa que quiser, mas não tudo que quiser". Entenda a diferença e priorize suas metas de acordo. É mais fácil se tornar um milionário artista, do que um artista milionário.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Não sofra da "síndrome do vira-lata".%'
  );

-- Quote 2.
insert into quotes (author_id, text)
select a.id,
       E'Seja confiante o suficiente para achar que consegue fazer qualquer coisa, mas humilde o suficiente para ter sempre uma cabeça aberta.\n\nVocê precisa viver com esse paradoxo mental. Por um lado, sua confiança deve ser alta suficiente para não ter medo de alcançar qualquer objetivo. Pelo outro, você precisa sempre manter sua mente aberta e afiar o machado. Eu me reafirmo quase todo dia que sou um "gênio da copy". Ao mesmo tempo, eu continuo estudando copy e marketing da mesma maneira que Michael Jordan treinava basquete.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Seja confiante o suficiente para achar%'
  );

-- Quote 3.
insert into quotes (author_id, text)
select a.id,
       E'Melhore todos os dias.\n\nNão é porque você é bom em algo que você não pode ficar melhor. Em 2018 muitas pessoas já falavam que eu era um dos melhores copywriters do Brasil. Mas eu fiquei muito melhor em 2019. E ainda muito melhor em 2020. Em 2021 quero ficar ainda melhor. Em 2022 também. Deu pra entender o ponto…'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Melhore todos os dias.%'
  );

-- Quote 4.
insert into quotes (author_id, text)
select a.id,
       E'Não seja medíocre.\n\nO mundo já está repleto de pessoas medíocres, com hábitos medíocres, com crenças medíocres e com resultados medíocres. É muito fácil ser melhor do que a média. Quando falo isso penso nas contratações que fizemos. Todas elas vieram de pessoas que fugiram da mediocridade. Que fizeram algo a mais para se entrarem no time. Como o Juan, por exemplo, que criou uma página de vendas "se vendendo" para nós.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Não seja medíocre.%'
  );

-- Quote 5.
insert into quotes (author_id, text)
select a.id,
       E'Não seja preguiçoso.\n\nUma maneira fácil de não ser medíocre, é não sendo preguiçoso. Seu corpo e mente tentam te sabotar toda hora para minimizar esforços e economizar calorias. Esse era um bom mecanismo de defesa 50 mil anos atrás, quando você não sabia de onde viria sua próxima fonte de comida. Hoje é simplesmente estupidez. Sempre que se sentir preguiçoso, se pergunte: "não é mais fácil sentir um pouquinho de dor da disciplina, do que a grande dor do arrependimento?".'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Não seja preguiçoso.%'
  );

-- Quote 6.
insert into quotes (author_id, text)
select a.id,
       E'Não seja um peixe dourado.\n\nNosso maior ativo não é o dinheiro e nem o tempo, mas sim a nossa atenção. Nada é mais importante no mundo do que no que você presta atenção. Por isso, cultive sua habilidade de prestar atenção e não vire um peixe dourado (que só consegue prestar atenção por até 5 segundos). Desligue notificações do celular e trabalhe com poucas abas abertas. USE a tecnologia, mas não seja usado por ela.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Não seja um peixe dourado.%'
  );

-- Quote 7.
insert into quotes (author_id, text)
select a.id,
       E'Seja um egoísta produtivo.\n\nComo você vai ajudar pessoas se você não consegue ajudar você mesmo? Que influência você vai ter no mundo, se você tem R$20 na sua conta bancária? Se sua rede de contatos está limitada aos seus amigos de infância e da faculdade? Se você não tem nenhuma habilidade útil que possa ajudar pessoas? Se ajude primeiro antes de tentar ajudar os outros. Você ainda vai descobrir no meio do caminho que essa é, na verdade, a maneira mais pragmática de ajudar outras pessoas.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Seja um egoísta produtivo.%'
  );

-- Quote 8.
insert into quotes (author_id, text)
select a.id,
       E'Crie.\n\nComo você vira um "egoísta produtivo"? Criando. Pode ser um produto, um serviço, uma música, um desenho, um processo, um artigo, uma dança. Não importa. Crie. Não seja apenas um consumidor de produtos e recursos, faça sua parte no mundo e seja um criador também.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like E'Crie.\n\nComo você vira um "egoísta produtivo"?%'
  );

-- Quote 9.
insert into quotes (author_id, text)
select a.id,
       E'Tenha prazos.\n\nEm 1960 John F. Kennedy disse que colocaria o homem na lua antes do fim da década. Em 1969 Neil Armstrong se tornou o primeiro homem a pisar na lua. Nada acontece sem um prazo e tudo que merece ser feito, precisa ter um prazo.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Tenha prazos.%'
  );

-- Quote 10.
insert into quotes (author_id, text)
select a.id,
       E'O que você faz é ainda mais importante do que como você faz.\n\nEm 2016 e 2017 eu e meu irmão trabalhamos muito bem na nossa primeira startup, um fantasy game de futebol. Tínhamos mais jogadores ativos em nosso game do que qualquer outro concorrente da américa latina. Mas isso não nos salvou, porque o modelo de negócios era ruim. Tanto para nossos concorrentes, quanto para nós. No fim, todos desse mercado faliram. Hoje nós somos mais experientes, é claro, mas estamos dentro de um modelo de negócios muito melhor. Eu não trabalho 10 vezes mais do que trabalhava antes e nem estou 10 vezes mais inteligente, mas eu ganho muito mais de 10 vezes mais, porque eu estou com um modelo de negócios melhor.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'O que você faz é ainda mais importante do que como você faz.%'
  );

-- Quote 11.
insert into quotes (author_id, text)
select a.id,
       E'Existe mais de um jeito de se fazer algo.\n\nDe vender um produto, de ser produtivo, de fazer dinheiro. Aprendi isso ao estudar o marketing e copy de diferentes empresas. Às vezes uma empresa consegue vender de maneira totalmente diferente da outra e ter resultados parecidos. Você não precisa seguir a mesma maneira que todo mundo faz algo. Do mesmo jeito, existem literalmente milhares de maneiras diferentes de fazer muito dinheiro. Hoje em dia meu maior problema é não poder me clonar para perseguir mais dessas oportunidades. Mas você só vai saber identificá-las se souber o que você está procurando. Você não consegue ver o que você não conhece.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Existe mais de um jeito de se fazer algo.%'
  );

-- Quote 12.
insert into quotes (author_id, text)
select a.id,
       E'O melhor jeito de alcançar um objetivo é fazendo a engenharia reversa de quem já o alcançou.\n\nNenhum problema ou objetivo que você tem na vida é 100% novo. Ele já existiu de outra maneira parecida e já foi resolvido anteriormente. Por isso, não faz mais sentido encontrar quem já alcançou esse objetivo e resolveu esse problema e tentar entender como ele fez isso… Do que começar do zero sempre?'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'O melhor jeito de alcançar um objetivo é fazendo a engenharia reversa%'
  );

-- Quote 13.
insert into quotes (author_id, text)
select a.id,
       E'Seja grato.\n\nVivemos nos tempos mais pacíficos da história da humanidade. Temos acesso ao conhecimento do mundo inteiro na palma das nossas mãos. Conseguimos ir para o outro lado do mundo em um único dia, sentados em poltronas mágicas que voam. Cultive o sentimento de ser grato por tudo que você tem na sua vida. Das coisas pequenas, como um teto para morar, as grandes, como a companhia da sua família.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Seja grato.%'
  );

-- Quote 14.
insert into quotes (author_id, text)
select a.id,
       E'Você não sabe o que não sabe.\n\nExistem 4 tipos de conhecimento. Aquele que você sabe que sabe, aquele que você não sabe que sabe, aquele que você sabe que não sabe e o maior de todos eles: aquele que você não sabe que não sabe. Ou seja, aquele que você não conhece mesmo. A maioria do conhecimento do mundo está nessa terceira categoria. Por isso você precisa ficar exposto a um fluxo constante de novas ideias. Leia, converse, viaje, explore. Fique aberto a novas ideias.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Você não sabe o que não sabe.%'
  );

-- Quote 15.
insert into quotes (author_id, text)
select a.id,
       E'Replique o que deu certo.\n\nO Mc Donalds virou o Mc Donalds porque replicou o que deu certo no primeiro lugar. Eles não tentaram reinventar a roda com cada novo restaurante que abriam. Eles apenas replicaram o que deu certo. Do mesmo jeito, quando você acerta alguma coisa na vida, em vez de ir para a próxima coisa, se pergunte: como posso fazer isso de novo? As vezes é um bom tipo de cliente que você fechou, um produto que deu certo, ou até algo simples como um novo comportamento dentro da sua rotina. O importante é ficar consciente sobre coisas que deram certo, e replicar isso ao máximo.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Replique o que deu certo.%'
  );

-- Quote 16.
insert into quotes (author_id, text)
select a.id,
       E'Conheça heurísticas e vieses mentais.\n\nNosso cérebro tem milhares de anos de programação nele. Nós espelhamos o comportamento dos outros (viés de prova social). Procuramos apenas informações que confirmem nossas crenças (viés de confirmação). Damos mais importância a aquilo que está disponível na nossa frente (viés de disponibilidade). Temos mais medo de perder algo do que vontade de ganhar (viés de perda). E temos outras dezenas de mini programas que definem nosso comportamento padrão a uma grande variedade de situações. Por isso, se você quer agir da maneira mais racional e pragmática possível, você precisa conhecer esses programas para identificá-los e substituí-los por atitudes mais coerentes com seus objetivos'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Conheça heurísticas e vieses mentais.%'
  );

-- Quote 17.
insert into quotes (author_id, text)
select a.id,
       E'Se preocupe apenas com seu círculo de influência.\n\nEu não escuto notícias. Nao vejo TV (apenas séries no Netflix), não me preocupo com política. Por que nada disso está no meu círculo de influência. O que é importante vai acabar chegando nos meus ouvidos, e nem isso eu realmente preciso me importar. Eu coloco meu tempo e minha atenção onde realmente importa: em coisas que eu posso controlar.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Se preocupe apenas com seu círculo de influência.%'
  );

-- Quote 18.
insert into quotes (author_id, text)
select a.id,
       E'Vendas é a habilidade mãe de todas as outras.\n\nNo mesmo ano que me formei na mais conceituada faculdade de Marketing e Publicidade do Brasil eu percebi que não sabia nada sobre marketing. E eu era um bom aluno. Felizmente, tive a humildade para reconhecer isso e comecei a estudar quem realmente sabia do que estava falando: empreendedores que levantaram suas empresas do zero sem investimentos. Se você consegue vender, você nunca mais vai passar fome na sua vida.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Vendas é a habilidade mãe de todas as outras.%'
  );

-- Quote 19.
insert into quotes (author_id, text)
select a.id,
       E'Não tenha medo de queimar os barcos (mesmo que você tenha passado um bom tempo os construindo)\n\nA pior coisa que você pode fazer com algo que nitidamente não está funcionando…é continuar fazendo. Mate-a antes de que ela mate você. Pode ser um produto que não deu certo, uma página de vendas, não importa. Eu já abandonei vários projetos em que tinha investido bastante tempo e esforço quando percebi que eles não valeriam a pena. Faça o mesmo.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Não tenha medo de queimar os barcos%'
  );

-- Quote 20.
insert into quotes (author_id, text)
select a.id,
       E'Ser alegre, feliz, e empolgado também deve ser um dos seus objetivos.\n\nEsse é especialmente para meus amigos empreendedores. Por vezes esquecemos que nosso negócio não precisa ser nossa vida. O sucesso do nosso negócio deve ser um objetivo, claro. Mas nossa felicidade também. Coloque o mesmo empenho, ou pelo menos um pouco de empenho, para fortalecer sua vida pessoalmente também. Observe o que te faz bem, o que te faz mal, e modele e planeje seus objetivos pessoais com o mesmo afinco que os profissionais. Ou até mais.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Ser alegre, feliz, e empolgado também deve ser um dos seus objetivos.%'
  );

-- Quote 21.
insert into quotes (author_id, text)
select a.id,
       E'Tenha um segundo cérebro.\n\nDesde que eu tenho um segundo cérebro eu não consigo imaginar como outras pessoas conseguem viver sem um. Esse conceito criado pelo Tiago Forte articula que cada pessoa deveria ter um local onde armazena notas de tudo que lê, estuda, pensa, etc… Para quem em vez de tentar guardar tudo na sua cabeça, você guarde de maneira segura num aplicativo como o Evernote, por exemplo.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Tenha um segundo cérebro.%'
  );

-- Quote 22.
insert into quotes (author_id, text)
select a.id,
       E'Procure o incentivo.\n\nO comportamento de um cachorro é movido por incentivos. Associe o ato de sentar com um biscoito que ele rapidamente vai aprender a sentar. Nós fazemos a mesma coisa. Isso vale desde avós que são chatos no telefone e que depois não entendem porque seu netos não ligam mais pra ele (incentivo negativo), até preguiçosos que deixam de trabalhar porque recebem ajuda do governo. Onde há um incentivo, há um comportamento.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Procure o incentivo.%'
  );

-- Quote 23.
insert into quotes (author_id, text)
select a.id,
       E'Questione tudo e a todos. Inclusive você mesmo.\n\nPor que a Globo quer mostrar matérias disso e não disso? Por que o governador da minha cidade aprovou essa lei e não essa outra? Por que eu quero isso e não aquilo? Por que eu me senti assim? Questione tudo para encontrar a verdade. Não se torne uma ovelha obediente. O universo te deu a capacidade de raciocinar e questionar, então use isso ao seu favor.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Questione tudo e a todos.%'
  );

-- Quote 24.
insert into quotes (author_id, text)
select a.id,
       E'Guarde a culpa para si mesmo, mas compartilhe o mérito.\n\n"Mas a pessoa X não fez o que era para ser feito". Sua culpa. Arranje uma pessoa melhor, explique melhor a tarefa, não importa. A culpa é sua e a responsabilidade por uma solução também. Quando tudo é sua culpa, tudo pode ser influenciado por você.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Guarde a culpa para si mesmo, mas compartilhe o mérito.%'
  );

-- Quote 25.
insert into quotes (author_id, text)
select a.id,
       E'Seja um otimista realista.\n\nO pessimista acha que tudo vai dar errado. O otimista acha que tudo vai dar certo. O otimista realista faz tudo ao seu alcance para que dê certo, e mantém sua mente aberta para qualquer desfecho. Ele antecipa determinado resultado, ao invés de esperar por ele. Ele vê o mundo como ele realmente é, e não como ele gostaria que fosse.'
from authors a
where a.name = 'Max Peters'
  and not exists (
    select 1 from quotes q
    where q.text like 'Seja um otimista realista.%'
  );
