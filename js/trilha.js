// Trilha de uma cidade: transforma as séries anuais em
//   • posição na base de cada camada (0 = nível 1 … 3 = nível 4; null = silêncio)
//   • temperatura: qual dos COMPASSOS_TEMP compassos toca em cada ano (0 = mais frio … 5 = mais quente)
//   • temperatura: anos que são pico ou vale da linha (som pontual em teste)
//   • temperatura, Base04 e Base05: qual figura de movimento toca em cada ano (FIGURAS_MOVIMENTO)
//   • eventos de cada ano ({ nome, intensidade }): hoje só viram cartões no gráfico.
// É calculada uma vez, ao escolher a cidade.

export const NIVEIS = 4;
const INICIO_RECORDES = 1970;        // antes disso quase todo ano seria recorde
const ANOS_MINIMOS_PARA_RECORDE = 10; // chuva e vegetação: "o mais extremo até então" só depois de 10 anos medidos
const QUEDA_MINIMA_VEG = 0.03;        // queda de pelo menos 3% do verde dos anos 1980

const valido = (v) => v != null && Number.isFinite(v);

/** Posição 0..NIVEIS-1 pela faixa medida (do menor ao maior valor da série). */
function posicoes(serie) {
  const vals = serie.filter(valido);
  if (!vals.length) return serie.map(() => null);
  const min = Math.min(...vals), max = Math.max(...vals);
  return serie.map((v) => (valido(v) ? (max > min ? (v - min) / (max - min) : 0.5) * (NIVEIS - 1) : null));
}

// Temperatura: cada ano toca UM compasso inteiro, escolhido entre 6,
// do mais frio ao mais quente. A escala é a da própria cidade: o ano mais frio medido ali
// toca o compasso 1 e o mais quente, o 6 (a faixa entre eles é dividida em 6 partes iguais).
export const COMPASSOS_TEMP = 6;

// Som pontual de picos e vales (EM TESTE): toca no início do compasso do ano que é
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

// Base04 (EM TESTE): o compasso de cada ano mostra a MUDANÇA até o ano seguinte (para onde a
// linha vai), e não a altura do ano. Todas as figuras começam na mesma nota e voltam para ela, então
// nada acumula. A variação é a do valor arredondado (1 casa decimal, o mesmo da tela e da linha):
//   0 = parado (uma nota e silêncio)   ±0,1 = pequena   ±0,2 a 0,3 = média   ±0,4 ou mais = grande.
// O último ano (sem ano seguinte) toca um parado.
// Base05 (EM TESTE): igual, mas compara com o ANO ANTERIOR (de onde a linha veio); o 1º ano toca um parado.
export const FIGURAS_MOVIMENTO = ['parado', 'sobe_pequena', 'sobe_media', 'sobe_grande', 'desce_pequena', 'desce_media', 'desce_grande'];

function movimentos(serie, sentido) {   // sentido: +1 = até o ano seguinte, −1 = desde o ano anterior
  return serie.map((v, i) => {
    if (!valido(v)) return null;
    const outro = serie[i + sentido];
    const d = valido(outro) ? (Math.round(outro * 10) - Math.round(v * 10)) * sentido : 0;   // em décimos de grau
    if (d === 0) return FIGURAS_MOVIMENTO.indexOf('parado');
    const tamanho = Math.abs(d) === 1 ? 'pequena' : Math.abs(d) <= 3 ? 'media' : 'grande';
    return FIGURAS_MOVIMENTO.indexOf(`${d > 0 ? 'sobe' : 'desce'}_${tamanho}`);
  });
}

function compassos(serie, n) {
  const vals = serie.filter(valido);
  if (!vals.length) return serie.map(() => null);
  const min = Math.min(...vals), max = Math.max(...vals);
  return serie.map((v) => (valido(v) ? Math.min(n - 1, Math.floor((max > min ? (v - min) / (max - min) : 0.5) * n)) : null));
}

/** Os k-ésimos valores extremos (k = 10% da série, pelo menos 1). */
function limites10(vals) {
  const s = [...vals].sort((a, b) => a - b);
  const k = Math.max(1, Math.round(s.length * 0.1));
  return { baixo: s[k - 1], alto: s[s.length - k] };
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
    const lim = limites10(vc);
    let min = Infinity, max = -Infinity, medidos = 0;
    for (let i = 0; i < n; i++) {
      const v = chuva[i];
      if (!valido(v)) continue;
      const recordeSeco = v < min && medidos >= ANOS_MINIMOS_PARA_RECORDE;
      const recordeChuva = v > max && medidos >= ANOS_MINIMOS_PARA_RECORDE;
      if (v <= lim.baixo) eventos[i].chuva = { nome: 'seca', intensidade: recordeSeco ? 'f' : 'm', valor: v };
      else if (v >= lim.alto) eventos[i].chuva = { nome: 'extrema', intensidade: recordeChuva ? 'f' : 'm', valor: v };
      min = Math.min(min, v); max = Math.max(max, v); medidos++;
    }
  }

  // ---- Vegetação: queda brusca (10% maiores quedas do lugar e pelo menos 3% do verde de referência)
  const veg = local.vegetacao;
  const base = local.vegetacaoBase;
  const quedas = [];
  for (let i = 1; i < n; i++) if (valido(veg[i]) && valido(veg[i - 1])) quedas.push(veg[i - 1] - veg[i]);
  if (quedas.length && base) {
    const s = [...quedas].sort((a, b) => b - a);
    const limite = s[Math.max(1, Math.round(s.length * 0.1)) - 1];
    let min = Infinity, medidos = 0;
    for (let i = 0; i < n; i++) {
      if (!valido(veg[i])) continue;
      if (i > 0 && valido(veg[i - 1])) {
        const queda = veg[i - 1] - veg[i];
        if (queda > 0 && queda >= limite && queda >= QUEDA_MINIMA_VEG * base) {
          const menosVerde = veg[i] < min && medidos >= ANOS_MINIMOS_PARA_RECORDE;
          eventos[i].vegetacao = { nome: 'queda', intensidade: menosVerde ? 'f' : 'm', valor: queda / base };
        }
      }
      min = Math.min(min, veg[i]); medidos++;
    }
  }

  const posicao = {
    co2: posicoes(co2),
    temperatura: posicoes(temp),
    chuva: posicoes(chuva),
    vegetacao: posicoes(veg),
  };
  const compasso = { temperatura: compassos(temp, COMPASSOS_TEMP) };
  const virada = { temperatura: picosEVales(temp, LIMIAR_VIRADA) };
  const movimento = { temperatura: { base04: movimentos(temp, 1), base05: movimentos(temp, -1) } };
  return { posicao, compasso, virada, movimento, eventos };
}

/** Resumo legível (para depurar no console ou mostrar à equipe). */
export function listarEventos(trilha, passos) {
  const linhas = [];
  trilha.eventos.forEach((ev, i) => {
    for (const [camada, e] of Object.entries(ev)) linhas.push(`${passos[i].inicio} ${camada} ${e.nome} ${e.intensidade}`);
  });
  return linhas;
}
