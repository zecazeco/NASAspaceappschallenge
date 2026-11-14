# Jukebox da Terra

**NASA Space Apps Challenge 2026 · desafio "The Earth Information Jukebox"**

> **Ouça as mudanças climáticas na sua cidade.**
> O som que você ouve é a cor do mapa da NASA sobre a sua cidade.

Um site para celular que transforma as visualizações de clima do **NASA Earth Information Center (EIC)** em música. A pessoa escolhe a cidade dela (pelo GPS ou digitando o nome), e o site toca uma música de cerca de **2 min 40 s** que vai de **1950 a 2023**, um compasso por ano. Cada ano soa diferente porque cada ano tem uma cor diferente no mapa.

O projeto foi pensado desde o início para **pessoas cegas ou com baixa visão**: tudo o que o mapa e o gráfico mostram também pode ser ouvido.

---

## A ideia

Os mapas de clima da NASA são lindos, mas só funcionam para quem enxerga, e mesmo quem enxerga raramente sabe ler o que aconteceu **no lugar onde mora**. A Jukebox da Terra faz o caminho contrário de um gráfico: em vez de olhar para uma linha subindo, você **ouve** sua cidade esquentando, ano a ano.

1. **Você escolhe a cidade.**
2. **O site olha a cor do mapa da NASA sobre ela, em cada ano.** A cor vira um número (por exemplo, +1,6 °C acima da média de 1951–1980) usando a própria legenda impressa na imagem.
3. **O número escolhe o som daquele ano.** Ano frio, som grave e escuro; ano quente, som agudo, brilhante e tenso.
4. **A música avança sozinha de 1950 a 2023.** O mapa, a lente sobre a cidade, o valor e a seta na escala acompanham o que está tocando.

O som nasce da **imagem**, não de uma tabela: se a NASA trocar os mapas, a música muda junto. Isso liga diretamente a sonificação aos frames visuais do EIC, que é o que o desafio pede.

---

## Como a música é construída

| | |
|---|---|
| Período | 1950 a 2023 (74 anos) |
| Unidade | **1 compasso = 1 ano** |
| Andamento | **110 BPM**, 4 tempos por compasso, cerca de 2,18 s por ano |
| Duração | cerca de 2 min 41 s |
| Tom | Ré menor |

### Quatro camadas, quatro dados

Cada dado é uma camada da música com um timbre próprio, para que o ouvido consiga separá-las. Cada camada **entra no ano em que aquela medição começou**, então a música vai ficando mais cheia ao longo do tempo:

| Camada | Entra em | Papel na música |
|---|---|---|
| **Temperatura** (principal) | 1950 | melodia no registro médio |
| CO₂ | 1958 | drone grave contínuo |
| Chuva | 1979 | textura de "gotas" agudas |
| Vegetação | 1982 | arpejo dedilhado |

De 1950 a 1957 a temperatura toca **sozinha**. São os primeiros segundos, os que decidem se a pessoa continua ouvindo, por isso ela é a camada mais trabalhada.

### Temperatura: a melodia nasce dos dados

- Existem **6 compassos gravados**, do mais frio (1) ao mais quente (6).
- A escala é a **da própria cidade**: o ano mais frio medido ali toca o compasso 1 e o mais quente, o 6.
- A cada ano, o site toca o compasso que corresponde à temperatura daquele ano. Como a temperatura sobe e desce de um ano para o outro, a sequência dos 74 compassos forma uma melodia **diferente para cada cidade**.
- Todos os compassos estão no mesmo tom e começam e terminam em notas do acorde, para que qualquer um possa vir depois de qualquer outro.

### Picos e vales

Um som curto marca os **picos** e os **vales** da linha de temperatura: no pico (quando a linha vai começar a descer) toca um arpejo que desce; no vale, um que sobe. Oscilações pequenas são ignoradas: o pico só conta quando a linha volta mais de 10% da faixa da cidade.

### As outras camadas

CO₂, chuva e vegetação têm **4 níveis** cada, do menos denso ao mais denso. O valor do ano decide quanto se ouve de cada nível. Em teste, o CO₂ tem também a **Base02** (a pré-escolhida, com botão para trocar): 5 vozes que se acumulam, uma entrando a cada quinto da faixa medida.

---

## Acessibilidade

- Botões grandes, com rótulo em texto, e navegação completa por teclado (espaço toca ou pausa; setas movem o ano).
- Leitor de tela: a cidade escolhida e o ano são anunciados, e o mapa da temperatura tem descrição em texto com o valor do ano.
- A linha do tempo pode ser rebobinada e avançada como uma **fita**: a própria música toca de trás para a frente, com um "tic" a cada ano.
- Narração opcional do ano.
- Respeita "reduzir movimento" do sistema.

---

## Dados e fontes

| Camada | Situação | Fonte |
|---|---|---|
| Temperatura | **real** | NASA Scientific Visualization Studio, *Global Temperature Anomalies, 1880 to 2023* (SVS 5207), dados NASA GISS GISTEMP v4 · https://svs.gsfc.nasa.gov/5207/ |
| CO₂ | fictícia (protótipo) | a definir, fonte da NASA |
| Chuva | fictícia (protótipo) | a definir, fonte da NASA |
| Vegetação | fictícia (protótipo) | a definir, fonte da NASA |

Os mapas de CO₂, chuva e vegetação são **imagens fictícias** criadas só para testar o funcionamento, enquanto as fontes reais são escolhidas. A temperatura é a anomalia em relação à média de 1951–1980 **naquele lugar**, não a temperatura do termômetro.

Busca de cidades: lista local + Open-Meteo Geocoding e BigDataCloud (geocodificação reversa do GPS). Áudio: Tone.js. Gráficos e projeção do mapa: d3 e d3-geo-projection.

---

## Estado atual (versão de teste)

- Os **sons são provisórios**, gerados por código (`tools/gerar-sons-provisorios.mjs`). Os arquivos definitivos serão gravados por um músico e colocados em `audio/<camada>/` com o mesmo nome; eles têm prioridade sobre os provisórios.
- No topo da tela há dois **seletores só para teste**, que saem da versão final:
  - **Base01 a Base05:** cinco versões (a **Base04** é a escolhida por enquanto e já começa selecionada) dos compassos da temperatura. As três primeiras seguem a altura do ano (4 notas, 1 nota sustentada ou 2 notas por compasso); a Base04 segue a mudança até o ano seguinte: começa sempre na mesma nota, sobe ou desce (pequeno, médio ou grande, conforme a variação de 0,1 °C, 0,2 a 0,3 ou 0,4 ou mais) e volta; a Base05 usa os mesmos sons da Base04, mas segue a mudança desde o ano anterior;
  - **Sem pontual / Pontual01:** liga ou desliga o som de picos e vales.
- **Tendência da temperatura (em teste):** uma segunda base da temperatura, que toca junto com a Base04. Ela segue a média dos 11 anos em volta de cada ano, dividida em 4 níveis na escala da cidade, e por isso muda só poucas vezes na música (em São Paulo: 1973, 1987 e 1998). O som é um pulso de marimba com uma batida em cada tempo; a cada nível a nota sobe (Ré grave, Fá, Lá, Ré agudo) e fica um pouco mais forte e brilhante. Aparece como a linha amarela do gráfico e pode ser desligada nos Ajustes.

---

## Rodar no computador

```bash
python tools/servidor.py
```

Abra http://localhost:8080. É preciso um servidor: abrir o `index.html` direto não funciona.

No celular, o GPS e o áudio exigem **HTTPS** quando o endereço não é `localhost` (por exemplo, um túnel com `npx localtunnel --port 8080` ou o GitHub Pages). No iPhone, desligue a chave de silencioso.

### Pastas

| Pasta | O que tem |
|---|---|
| `index.html`, `css/`, `js/` | o site |
| `js/frames.js` | lê a cor do mapa sobre a cidade e transforma em número |
| `js/trilha.js` | regras da música: qual compasso, nível e som pontual em cada ano |
| `js/audio/` | motor de som (Tone.js), camadas e efeito de fita |
| `data/frames/` | os mapas de cada ano e o `manifesto.json`, que descreve projeção, recorte e legenda de cada mapa |
| `audio/` | sons (provisórios em `audio/provisorio/`; os do músico em `audio/<camada>/`) e narração |
| `tools/` | servidor local e scripts que geram os sons provisórios, os dados e os mapas |

### Publicação

Cada envio para a branch `main` publica o site no GitHub Pages sozinho (`.github/workflows/publicar.yml`). No rodapé aparece **Version N (código)**: N é o número de commits e o código é o do commit publicado. Se o número no celular for menor que o do GitHub, a página está vindo do cache: recarregue. No computador, com o servidor local, aparece "Version local".

Para baixar de novo os mapas da NASA: `python -I tools/preparar-frames-nasa.py`.

---

## Uso de inteligência artificial

O código deste protótipo, os sons provisórios e parte da documentação foram desenvolvidos com a ajuda de um assistente de IA (Claude, da Anthropic), sob direção da equipe, que definiu o conceito, o mapeamento musical e as decisões de design. A narração opcional dos anos pode ser gerada por voz sintética (`tools/gerar-narracao.py`).
