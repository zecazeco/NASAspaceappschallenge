// Trilha de uma cidade: transforma as séries anuais em
//   • posição de cada camada na faixa da cidade (0 … 3; null = sem dado): linhas do gráfico e níveis
//   • temperatura: qual figura de movimento toca em cada ano (FIGURAS_MOVIMENTO)
//   • sons pontuais de cada ano (virada): temperatura, CO₂ e chuva, ver o fim de calcularTrilha
//   • som dos loops quando não é a posição: CO₂ (quantas das 5 vozes) e chuva (tipo de mudança)
//   • tendência da temperatura: média de 11 anos em faixas fixas de °C, nível 1 a 4 (o segundo som da temperatura)
//   • eventos de cada ano ({ nome, intensidade }): viram cartões no gráfico (a tendência, na linha da temperatura).
// É calculada uma vez, ao escolher a cidade.

export const NIVEIS = 4;
export const VOZES_CO2 = 5;          // CO₂: 5 vozes que se acumulam
const INICIO_RECORDES = 1970;        // antes disso quase todo ano seria recorde

const valido = (v) => v != null && Number.isFinite(v);

/** Posição 0..NIVEIS-1 pela faixa medida (do menor ao maior valor da série). */
function posicoes(serie) {
  const vals = serie.filter(valido);
  if (!vals.length) return serie.map(() => null);
  const min = Math.min(...vals), max = Math.max(...vals);
  return serie.map((v) => (valido(v) ? (max > min ? (v - min) / (max - min) : 0.5) * (NIVEIS - 1) : null));
}


// Picos e vales (som pontual EM TESTE, sem card): toca no início do compasso do ano que é
// um PICO ou um VALE da linha do gráfico. Método ziguezague: a partir do ponto mais alto (ou mais
// baixo) até ali, um pico (vale) só conta quando a linha já voltou mais de LIMIAR_VIRADA da faixa
// da cidade (do ano mais frio ao mais quente), mesmo que leve vários anos para isso. Assim
// oscilações pequenas ("quase reta") são ignoradas, mas subidas feitas em passos curtos não.
// Picos e vales sempre se alternam. Como todos os anos são conhecidos de antemão, o som toca no
// próprio ano do pico/vale (quando o ponto do gráfico está no alto ou no fundo).
// 10%: acima do erro de leitura da cor (~0,1 °C ≈ 4% da faixa). São Paulo (frames do site): 23 picos e vales em 74 anos.
export const LIMIAR_VIRADA = 0.10;

function picosEVales(serie, limiar) {
  const saida = serie.map(() => null);
  const idx = serie.map((v, i) => (valido(v) ? i : null)).filter((i) => i != null);
  if (idx.length < 3) return saida;
  const vals = idx.map((i) => serie[i]);
  const faixa = Math.max(...vals) - Math.min(...vals);
  if (!faixa) return saida;
  const v = (i) => serie[i];
  let dir = 0, alto = idx[0], baixo = idx[0];
  for (const i of idx.slice(1)) {
    if (dir === 0) {            // ainda sem direção: espera a primeira volta maior que o limiar
      if (v(i) > v(alto)) alto = i;
      if (v(i) < v(baixo)) baixo = i;
      if ((v(alto) - v(i)) / faixa > limiar) { dir = -1; baixo = i; }
      else if ((v(i) - v(baixo)) / faixa > limiar) { dir = 1; alto = i; }
    } else if (dir === 1) {     // subindo: acompanha o ponto mais alto até a linha voltar
      if (v(i) >= v(alto)) alto = i;
      else if ((v(alto) - v(i)) / faixa > limiar) { saida[alto] = 'pico'; dir = -1; baixo = i; }
    } else {                    // descendo: acompanha o ponto mais baixo
      if (v(i) <= v(baixo)) baixo = i;
      else if ((v(i) - v(baixo)) / faixa > limiar) { saida[baixo] = 'vale'; dir = 1; alto = i; }
    }
  }
  return saida;
}

// Temperatura: o compasso de cada ano mostra a MUDANÇA até o ano seguinte (para onde a
// linha vai), e não a altura do ano. Todas as figuras começam na mesma nota e voltam para ela, então
// nada acumula. A variação é a do valor arredondado (1 casa decimal, o mesmo da tela e da linha):
//   0 = parado (Ré · Mi · Ré · Mi: ida e volta duas vezes, sem sair do lugar)   ±0,1 = pequena   ±0,2 a 0,3 = média   ±0,4 ou mais = grande.
// O último ano (sem ano seguinte) toca um parado.
export const FIGURAS_MOVIMENTO = ['parado', 'sobe_pequena', 'sobe_media', 'sobe_grande', 'desce_pequena', 'desce_media', 'desce_grande'];

function movimentos(serie) {
  return serie.map((v, i) => {
    if (!valido(v)) return null;
    const outro = serie[i + 1];
    const d = valido(outro) ? Math.round(outro * 10) - Math.round(v * 10) : 0;   // em décimos de grau
    if (d === 0) return FIGURAS_MOVIMENTO.indexOf('parado');
    const tamanho = Math.abs(d) === 1 ? 'pequena' : Math.abs(d) <= 3 ? 'media' : 'grande';
    return FIGURAS_MOVIMENTO.indexOf(`${d > 0 ? 'sobe' : 'desce'}_${tamanho}`);
  });
}

// Tendência da temperatura: o segundo som da temperatura, tocando junto com a melodia.
// Segue o valor do ANO, o mesmo do mostrador (a seta na escala de −2 a +2 °C, em relação a 1951–1980), em
// FAIXAS FIXAS de 1 °C, iguais em todas as cidades: o som muda quando a seta passa de −1, 0 ou +1 °C.
//   nível 1 = −2 a −1 °C (ou abaixo) · 2 = −1 a 0 · 3 = 0 a +1 · 4 = +1 a +2 (ou acima).
// O valor é arredondado a 1 casa, como o número do mostrador (0,96 aparece "+1,0" e já conta como +1).
// Pode ir e voltar de um ano para o outro (é o que o dado mostra). Poucas cidades chegam ao nível 1.
export const LIMITES_TENDENCIA = [-1, 0, 1];   // °C

function faixasTendencia(serie) {
  return serie.map((x) => {
    if (!valido(x)) return null;
    const v = Math.round(x * 10) / 10;
    return LIMITES_TENDENCIA.filter((l) => v >= l).length;
  });
}

function niveisFixos(serie, n) {
  const vals = serie.filter(valido);
  if (!vals.length) return serie.map(() => null);
  const min = Math.min(...vals), max = Math.max(...vals);
  return serie.map((v) => (valido(v) ? Math.min(n - 1, Math.floor((max > min ? (v - min) / (max - min) : 0.5) * n)) : null));
}

// Chuva: como a temperatura, o som de cada ano mostra a MUDANÇA até o ano seguinte (para onde a linha vai):
//   0 = sobe muito (chuva_base_1, o mais forte) · 1 = sobe um pouco · 2 = desce um pouco · 3 = desce muito (o mais fraco).
// "Muito" = o terço maior das mudanças da própria cidade. "Quase igual" (menos de QUASE_IGUAL_CHUVA da faixa
// normal da cidade, faixaChuva) mantém o som do ano anterior; o último ano (sem ano seguinte) também.
// Com dados reais (24 cidades), de 2 a 11 das 42 mudanças ficam "quase igual" (11 em Nova York).
export const QUASE_IGUAL_CHUVA = 0.05;

function mudancasChuva(serie) {
  const vals = serie.filter(valido);
  if (vals.length < 2) return serie.map(() => null);
  const { min, max } = faixaChuva(vals);
  const faixa = (max - min) || 1;
  const d = serie.map((v, i) => (valido(v) && valido(serie[i + 1]) ? (serie[i + 1] - v) / faixa : null));
  const grandes = d.filter((x) => x != null && Math.abs(x) >= QUASE_IGUAL_CHUVA).map(Math.abs).sort((a, b) => a - b);
  const muito = grandes.length ? grandes[Math.floor((grandes.length * 2) / 3)] : Infinity;
  const tipo = d.map((x) => (x == null || Math.abs(x) < QUASE_IGUAL_CHUVA ? null
    : x > 0 ? (x >= muito ? 0 : 1) : (-x >= muito ? 3 : 2)));
  const primeiro = tipo.find((t) => t != null) ?? 1;   // começo "quase igual": usa o primeiro som que vier
  let anterior = null;
  return serie.map((v, i) => {
    if (!valido(v)) return null;
    if (tipo[i] != null) anterior = tipo[i];
    return anterior ?? primeiro;
  });
}

/** Os k-ésimos valores extremos (k = 10% da série, pelo menos 1). */
function limites10(vals) {
  const s = [...vals].sort((a, b) => a - b);
  const k = Math.max(1, Math.round(s.length * 0.1));
  return { baixo: s[k - 1], alto: s[s.length - k] };
}

/** Seca / chuva extrema da cidade: os 10% de anos mais secos e mais chuvosos (null = sem dados). */
export function limitesChuva(serie) {
  const vals = serie.filter(valido);
  return vals.length ? limites10(vals) : null;
}

// Faixa "normal" da chuva da cidade, para o gráfico e para o som: dos 10% mais secos aos 10% mais
// chuvosos, com uma folga de 25% dessa largura para cada lado. Com dados reais, um ano muito fora
// (ex.: Cairo, deserto, +590% em 2016) não achata mais todos os outros: a linha sai da área do
// gráfico e volta depois. Nas cidades testadas, de 1 a 5 anos ficam fora.
const FOLGA_CHUVA = 0.25;
function quantil(ordenados, p) {
  const k = (ordenados.length - 1) * p, i = Math.floor(k);
  return ordenados[i] + ((ordenados[Math.min(i + 1, ordenados.length - 1)] - ordenados[i]) * (k - i));
}
function faixaChuva(vals) {
  const s = [...vals].sort((a, b) => a - b);
  const p10 = quantil(s, 0.1), p90 = quantil(s, 0.9), folga = (p90 - p10) * FOLGA_CHUVA;
  return { min: p10 - folga, max: p90 + folga };
}
/** Como posicoes(), mas na faixa normal da chuva: pode passar de 0 … NIVEIS-1 (o gráfico corta). */
function posicoesChuva(serie) {
  const vals = serie.filter(valido);
  if (!vals.length) return serie.map(() => null);
  const { min, max } = faixaChuva(vals);
  return serie.map((v) => (valido(v) ? (max > min ? (v - min) / (max - min) : 0.5) * (NIVEIS - 1) : null));
}

export function calcularTrilha(local, passos, co2Global) {
  const anos = passos.map((p) => p.inicio);
  const n = anos.length;
  const co2 = local.co2 ?? co2Global;
  const eventos = Array.from({ length: n }, () => ({}));

  // ---- CO₂: recorde de velocidade (aumento maior que o de todos os anos anteriores)
  let maiorAumento = -Infinity;
  for (let i = 1; i < n; i++) {
    if (!valido(co2[i]) || !valido(co2[i - 1])) continue;
    const aumento = co2[i] - co2[i - 1];
    if (aumento > maiorAumento) {
      if (anos[i] >= INICIO_RECORDES && maiorAumento > -Infinity) {
        eventos[i].co2 = { nome: 'recorde', intensidade: aumento < 2 ? 'p' : aumento < 3 ? 'm' : 'f', valor: aumento };
      }
      maiorAumento = aumento;
    }
  }

  // ---- Temperatura: recorde de calor do lugar
  const temp = local.temperatura;
  let maisQuente = -Infinity;
  for (let i = 0; i < n; i++) {
    if (!valido(temp[i])) continue;
    if (temp[i] > maisQuente) {
      if (anos[i] >= INICIO_RECORDES && maisQuente > -Infinity) {
        eventos[i].temperatura = { nome: 'recorde', intensidade: temp[i] < 1 ? 'p' : temp[i] < 1.5 ? 'm' : 'f', valor: temp[i] };
      }
      maisQuente = temp[i];
    }
  }

  // ---- Chuva: seca e chuva extrema (10% mais extremos do lugar)
  const chuva = local.chuva;
  const vc = chuva.filter(valido);
  if (vc.length) {
    // um evento só por ano, sem recorde (para não poluir): seca ou chuva extrema
    const lim = limites10(vc);
    for (let i = 0; i < n; i++) {
      const v = chuva[i];
      if (!valido(v)) continue;
      if (v <= lim.baixo) eventos[i].chuva = { nome: 'seca', intensidade: 'm', valor: v };
      else if (v >= lim.alto) eventos[i].chuva = { nome: 'extrema', intensidade: 'm', valor: v };
    }
  }

  const posicao = {
    co2: posicoes(co2),
    temperatura: posicoes(temp),
    tendencia: faixasTendencia(temp),
    chuva: posicoesChuva(chuva),
  };
  // som dos loops quando não é a posição: CO₂ = voz mais alta que toca (0 = só a voz 1 … 4 = as 5; a faixa
  // medida dividida em 5 partes iguais); chuva = tipo de mudança até o ano seguinte
  const som = { co2: niveisFixos(co2, VOZES_CO2), chuva: mudancasChuva(chuva) };
  // CO₂ (teste), sons pontuais junto com os cards:
  //   • recorde de velocidade (eventos acima) → "impacto". Com os dados da NOAA: 1973, 1988, 1998 e 2016.
  //   • ano em que a faixa das vozes muda (cruzou mais um quinto da subida medida) → "cresce". NOAA: 1980, 1994, 2005 e 2015.
  // Num ano que fosse as duas coisas (não acontece com os dados de hoje), a faixa vence: um som e um card só.
  const viradaCo2 = eventos.map((ev) => (ev.co2?.nome === 'recorde' ? 'impacto' : null));
  som.co2.forEach((nv, i) => {
    const antes = som.co2.slice(0, i).filter((x) => x != null).pop();
    if (nv == null || antes == null || nv === antes) return;
    viradaCo2[i] = 'cresce';
    eventos[i].co2 = { nome: 'faixa', intensidade: 'm', quintos: nv, valor: co2[i] };
  });
  // Temperatura (teste), sons pontuais (volumes em camadas.js); num mesmo ano podem tocar vários juntos:
  //   • pico ou vale da linha (picosEVales) → o som diz para onde a linha VAI: no pico ela começa a descer
  //     ("desce"), no vale começa a subir ("sobe"). Sem card nem ponto no gráfico.
  //   • recorde de calor (eventos acima) → "sino", com o card de sempre.
  //   A troca de faixa da tendência não tem som pontual nem card (a própria base da tendência muda).
  const picos = picosEVales(temp, LIMIAR_VIRADA);
  const viradaTemp = picos.map((pv, i) => {
    const sons = [];
    if (pv) sons.push(pv === 'pico' ? 'desce' : 'sobe');
    if (eventos[i].temperatura?.nome === 'recorde') sons.push('sino');
    return sons;
  });
  // Chuva (teste), junto com o card: "gota" na chuva extrema e "estalo" (a madeira oca) na seca
  const SOM_CHUVA = { extrema: 'gota', seca: 'estalo' };
  const viradaChuva = eventos.map((ev) => SOM_CHUVA[ev.chuva?.nome] ?? null);
  const virada = { temperatura: viradaTemp.map((s) => (s.length ? s : null)), co2: viradaCo2, chuva: viradaChuva };
  const movimento = { temperatura: movimentos(temp) };
  return { posicao, som, virada, movimento, eventos };
}

/** Resumo legível (para depurar no console ou mostrar à equipe). */
export function listarEventos(trilha, passos) {
  const linhas = [];
  trilha.eventos.forEach((ev, i) => {
    for (const [camada, e] of Object.entries(ev)) linhas.push(`${passos[i].inicio} ${camada} ${e.nome} ${e.intensidade}`);
  });
  return linhas;
}
