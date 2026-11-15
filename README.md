# Jukebox da Terra

**NASA Space Apps Challenge 2026 · desafio "The Earth Information Jukebox"**

> **Ouça as mudanças climáticas na sua cidade.**
> O som que você ouve é a cor do mapa da NASA sobre a sua cidade.

Um site para celular que transforma as visualizações de clima do **NASA Earth Information Center (EIC)** em música. A pessoa escolhe a cidade dela (pelo GPS ou digitando o nome), e o site toca uma música de cerca de **2 min 40 s** que vai de **1950 a 2023**, um compasso por ano. Cada ano soa diferente porque cada ano tem uma cor diferente no mapa.

O projeto foi pensado desde o início para **pessoas com algum tipo de deficiência visual**: tudo o que o mapa e o gráfico mostram também pode ser ouvido.

---

## A ideia

Os mapas de clima da NASA são lindos, mas só funcionam para quem enxerga, e mesmo quem enxerga raramente sabe ler o que aconteceu **no lugar onde mora**. A Jukebox da Terra junta a imagem e o som: além de ver a linha do gráfico subindo, você **ouve** sua cidade esquentando, ano a ano.

1. **Você escolhe a cidade.**
2. **O site olha a cor do mapa da NASA sobre ela, em cada ano.** A cor vira um número (por exemplo, +1,6 °C acima da média de 1951–1980) usando a própria legenda impressa na imagem.
3. **O número escolhe o som daquele ano.** Ano frio, som grave e escuro; ano quente, som agudo, brilhante e tenso.
4. **A música avança sozinha de 1950 a 2023.** O mapa, a lente sobre a cidade, o valor e a seta na escala acompanham o que está tocando.

O som nasce da **imagem**, não de uma tabela: se a NASA trocar os mapas, a música muda junto. Isso liga diretamente a sonificação aos frames visuais do EIC, que é o que o desafio pede.

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

Para baixar de novo os mapas da NASA: `python -I tools/preparar-frames-nasa.py`.

---

## Uso de inteligência artificial

O código deste protótipo, os sons provisórios e parte da documentação foram desenvolvidos com a ajuda de um assistente de IA (Claude, da Anthropic), sob direção da equipe, que definiu o conceito, o mapeamento musical e as decisões de design. A narração opcional dos anos pode ser gerada por voz sintética (`tools/gerar-narracao.py`).
