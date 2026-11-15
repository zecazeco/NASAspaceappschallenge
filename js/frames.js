// Camada adaptadora: lê os FRAMES visuais (imagens das visualizações do EIC) e
// transforma cor em número. "O som que você ouve é a cor deste mapa sobre a sua cidade."
//
// Tudo é descrito em data/frames/manifesto.json, para trocar os frames fictícios pelos
// reais sem mexer no código:
//   projecao  → que parte do mundo o mapa cobre (equirretangular: lon/lat lineares)
//   recorte   → onde o mapa está dentro da imagem (frames reais têm título e legenda)
//   escala    → como cor vira valor: a barra de cores do próprio frame (barra + min/max)
//               ou uma lista de paradas [[valor, '#cor'], ...]
//   leitura   → 'local' (pixel da cidade) ou 'media' (média do frame inteiro, ex.: CO₂)
//   frames    → [{ data: 'AAAA' ou 'AAAA-MM', arquivo }]
// Sem manifesto, o site continua usando data/timeline.json.

const PASTA = 'data/frames/';
const RAD = Math.PI / 180;
let MANIFESTO = null;

// d3 (projeção Robinson do mapa da NASA): só é preciso para ler o mapa da cidade, então não fica no
// <head> segurando a página. Baixa em segundo plano ao abrir o site; quem lê o mapa espera por ele.
const BIBLIOTECAS_D3 = [
  { src: 'https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js', pronta: () => !!window.d3 },
  { src: 'https://cdn.jsdelivr.net/npm/d3-geo-projection@4.0.0/dist/d3-geo-projection.min.js', pronta: () => !!window.d3?.geoRobinson },   // depende do d3
];
let d3Pronto = null;
/** Se falhar, a próxima chamada tenta de novo (só o que ainda não carregou). */
export function carregarD3() {
  d3Pronto ??= BIBLIOTECAS_D3.reduce((antes, { src, pronta }) => antes.then(() => (pronta() ? null : new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok;
    s.onerror = () => { s.remove(); erro(new Error(`não carregou ${src}`)); };
    document.head.append(s);
  }))), Promise.resolve()).catch((e) => { d3Pronto = null; throw e; });
  return d3Pronto;
}

export async function carregarFrames() {
  try {
    const r = await fetch(`${PASTA}manifesto.json`);
    if (!r.ok) return null;
    MANIFESTO = await r.json();
    for (const v of MANIFESTO.visualizacoes) {
      v.recorte ??= null;
      v.tolerancia = v.escala.tolerancia ?? 45;   // distância máxima de cor (RGB) para aceitar o pixel
      v._cache = new Map();                       // cor → valor
      v._medias = new Map();                      // arquivo → média do frame
    }
    return MANIFESTO;
  } catch { return null; }
}

export const manifesto = () => MANIFESTO;
export const visualizacao = (id) => MANIFESTO?.visualizacoes.find((v) => v.id === id || v.dimensao === id) || null;

// ---------------------------------------------------------------- imagens
const imagens = new Map();
function imagem(arquivo) {
  if (!imagens.has(arquivo)) {
    imagens.set(arquivo, new Promise((ok, erro) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => ok(img);
      img.onerror = () => { imagens.delete(arquivo); erro(new Error(`frame não carregou: ${arquivo}`)); };
      img.src = PASTA + arquivo;
    }));
  }
  return imagens.get(arquivo);
}

const tela = document.createElement('canvas');
const ctx = tela.getContext('2d', { willReadFrequently: true });
/** Pixels RGBA de um retângulo do frame. */
function pixels(img, x, y, w, h) {
  if (tela.width < w) tela.width = w;
  if (tela.height < h) tela.height = h;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

const recorteDe = (v, img) => v.recorte ?? { x: 0, y: 0, largura: img.naturalWidth, altura: img.naturalHeight };

// ---------------------------------------------------------------- cor → valor
const hexRGB = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));

/** Monta a tabela de cores da escala (uma vez por visualização). */
async function prepararEscala(v) {
  if (v._tabela) return v._tabela;
  const e = v.escala;
  let tabela = [];
  if (e.paradas) {
    const p = e.paradas.map(([valor, cor]) => [valor, hexRGB(cor)]);
    for (let i = 0; i < p.length - 1; i++) {
      for (let k = 0; k < 32; k++) {
        const f = k / 32;
        tabela.push([p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1].map((c, j) => c + (p[i + 1][1][j] - c) * f)]);
      }
    }
    tabela.push(p.at(-1));
  } else if (e.barra) {
    // lê a legenda do primeiro frame: cada pixel da barra é uma cor com um valor
    const b = e.barra, img = await imagem(v.frames[0].arquivo);
    const vertical = b.vertical === true;
    const n = vertical ? b.altura : b.largura;
    const d = vertical ? pixels(img, b.x, b.y, 1, n) : pixels(img, b.x, Math.round(b.y), n, 1);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const valor = vertical ? e.max - (e.max - e.min) * f : e.min + (e.max - e.min) * f;
      tabela.push([valor, [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]]);
    }
  }
  v._tabela = tabela;
  return tabela;
}

/** Valor da cor mais parecida na escala; null = não é dado (oceano, texto, fronteira…). */
function valorDaCor(v, r, g, b, a) {
  if (a < 128) return null;
  const chave = (r << 16) | (g << 8) | b;
  if (v._cache.has(chave)) return v._cache.get(chave);
  let melhor = null, menor = Infinity;
  for (const [valor, c] of v._tabela) {
    const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
    if (d < menor) { menor = d; melhor = valor; }
  }
  const res = menor <= v.tolerancia ** 2 ? melhor : null;
  v._cache.set(chave, res);
  return res;
}

// ---------------------------------------------------------------- leituras
/** Projeção Robinson (mapas GISTEMP da NASA): 'area' = caixa do mapa-múndi dentro do frame, em pixels. */
function robinson(p) {
  const [x0, y0, x1, y1] = p.area;
  p._proj ??= d3.geoRobinson().fitExtent([[x0, y0], [x1, y1]], { type: 'Sphere' });
  return p._proj;
}

/** Posição (em pixels do frame) de uma latitude/longitude. */
function pixelDe(v, img, lat, lon) {
  const p = v.projecao, rc = recorteDe(v, img);
  if (p.tipo === 'robinson') {
    const [x, y] = robinson(p)([lon, lat]);
    return { x: Math.floor(x), y: Math.floor(y), rc };
  }
  let l = lon;
  while (l < p.oeste) l += 360;
  while (l > p.leste) l -= 360;
  return {
    x: Math.floor(rc.x + (l - p.oeste) / (p.leste - p.oeste) * rc.largura),
    y: Math.floor(rc.y + (p.norte - lat) / (p.norte - p.sul) * rc.altura),
    rc,
  };
}

const mediana = (a) => { const s = a.sort((x, y) => x - y); return s[s.length >> 1]; };

/** Valor no ponto da cidade: mediana de uma janelinha; se não houver dado (ex.: cidade no litoral
 *  e o pixel é oceano), procura o pixel válido mais próximo em volta. */
function lerLocal(v, img, lat, lon) {
  const { x, y, rc } = pixelDe(v, img, lat, lon);
  for (const raio of [v.raio ?? 1, 3, 6, 12]) {
    const x0 = Math.max(rc.x, x - raio), y0 = Math.max(rc.y, y - raio);
    const x1 = Math.min(rc.x + rc.largura - 1, x + raio), y1 = Math.min(rc.y + rc.altura - 1, y + raio);
    const d = pixels(img, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    const vals = [];
    for (let i = 0; i < d.length; i += 4) {
      const val = valorDaCor(v, d[i], d[i + 1], d[i + 2], d[i + 3]);
      if (val != null) vals.push(val);
    }
    if (vals.length) return mediana(vals);
  }
  return null;
}

/** Média do frame inteiro, ponderada pela área (linhas perto dos polos valem menos). */
function lerMedia(v, img, arquivo) {
  if (v._medias.has(arquivo)) return v._medias.get(arquivo);
  const p = v.projecao, rc = recorteDe(v, img);
  const d = pixels(img, rc.x, rc.y, rc.largura, rc.altura);
  let soma = 0, peso = 0;
  for (let y = 0; y < rc.altura; y += 2) {
    const w = Math.cos((p.norte - (y + 0.5) / rc.altura * (p.norte - p.sul)) * RAD);
    for (let x = 0; x < rc.largura; x += 2) {
      const i = (y * rc.largura + x) * 4;
      const val = valorDaCor(v, d[i], d[i + 1], d[i + 2], d[i + 3]);
      if (val != null) { soma += val * w; peso += w; }
    }
  }
  const res = peso ? soma / peso : null;
  v._medias.set(arquivo, res);
  return res;
}

const anoDe = (f) => parseInt(f.data, 10);
/** Frames que caem dentro de um passo da linha do tempo (passos agrupados juntam vários anos). */
const framesDoPasso = (v, passo) => v.frames.filter((f) => { const a = anoDe(f); return a >= passo.inicio && a <= passo.fim; });

/**
 * Série de valores de cada dimensão para uma cidade, um número por passo
 * (média dos frames do passo; null = sem frame naquele período → instrumento em silêncio).
 */
export async function lerSerieLocal(lat, lon, passos, aoProgresso = () => {}) {
  await carregarD3();   // a projeção do mapa (depois disto, pontoNoFrame e cia. podem usar o d3 direto)
  const serie = {};
  const total = MANIFESTO.visualizacoes.reduce((s, v) => s + v.frames.length, 0) || 1;
  let lidos = 0;
  const avancar = () => { lidos++; if (lidos % 8 === 0 || lidos === total) aoProgresso(lidos / total); };
  await Promise.all(MANIFESTO.visualizacoes.map(async (v) => {
    await prepararEscala(v);
    const valores = await Promise.all(passos.map(async (passo) => {
      const fs = framesDoPasso(v, passo);
      if (!fs.length) return null;
      const valores = [];
      for (const f of fs) {
        // frame que não baixa: tenta mais uma vez; se ainda falhar, a música não começa incompleta
        // (o erro sobe até a tela "Preparando", que oferece tentar de novo)
        const img = await imagem(f.arquivo).catch(() => imagem(f.arquivo));
        const val = v.leitura === 'media' ? lerMedia(v, img, f.arquivo) : lerLocal(v, img, lat, lon);
        if (val != null) valores.push(val);
        avancar();
      }
      return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;
    }));
    serie[v.dimensao] = valores;
  }));
  return serie;
}

/**
 * Baixa todos os frames em segundo plano (de poucos em poucos), enquanto a pessoa
 * ainda está na tela inicial. Assim, ao escolher a cidade, falta só ler os pixels.
 */
export async function preCarregarFrames() {
  if (!MANIFESTO) return;
  const todos = MANIFESTO.visualizacoes.flatMap((v) => v.frames.map((f) => f.arquivo));
  for (let i = 0; i < todos.length; i += 6) {
    await Promise.all(todos.slice(i, i + 6).map((a) => imagem(a).catch(() => null)));
  }
}

// ---------------------------------------------------------------- miniaturas e frame ampliado
/** Frame (o último) que cai dentro de um passo, ou null. */
export function frameDoPasso(id, passo) {
  const v = visualizacao(id);
  return v ? framesDoPasso(v, passo).at(-1) || null : null;
}

/** Imagem (já carregada ou a caminho) de um frame do manifesto. */
export const imagemDoFrame = (f) => imagem(f.arquivo);

/**
 * Onde a cidade cai no frame: { x, y } em pixels do frame e { rc } = área do mapa.
 * Quem desenha usa estas coordenadas do FRAME (não da tela), então o ponto fica certo
 * em qualquer tamanho de tela.
 */
export function pontoNoFrame(id, lat, lon) {
  const v = visualizacao(id);
  if (!v) return null;
  const img = { naturalWidth: v.recorte?.largura ?? 0, naturalHeight: v.recorte?.altura ?? 0 };
  return pixelDe(v, img, lat, lon);
}

/** Valor e cor lidos no ponto da cidade num frame (para mostrar junto do mapa). */
export async function lerPonto(id, arquivo, lat, lon) {
  const v = visualizacao(id);
  if (!v) return null;
  await prepararEscala(v);
  const img = await imagem(arquivo);
  const valor = lerLocal(v, img, lat, lon);
  return { valor, cor: valor == null ? null : corDoValor(v, valor) };
}

/** Cor da escala para um valor (a mesma do mapa). */
export function corDoValor(v, valor) {
  if (typeof v === 'string') v = visualizacao(v);
  const t = v?._tabela;
  if (!t?.length || valor == null) return null;
  let melhor = t[0];
  for (const e of t) if (Math.abs(e[0] - valor) < Math.abs(melhor[0] - valor)) melhor = e;
  return `rgb(${melhor[1].map(Math.round).join(',')})`;
}

/**
 * Desenha o mapa do frame (só a área do mapa, sem título nem legenda) num canvas,
 * com um ponto na cidade. Devolve o frame usado ou null (sem dado naquele ano).
 */
export async function desenharFrame(canvas, id, passo, lat, lon) {
  await carregarD3();
  const v = visualizacao(id);
  const f = v && framesDoPasso(v, passo).at(-1);
  const ctx = canvas.getContext('2d');
  if (!f) { ctx.clearRect(0, 0, canvas.width, canvas.height); return null; }
  const img = await imagem(f.arquivo);
  const rc = recorteDe(v, img), p = v.projecao;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, rc.x, rc.y, rc.largura, rc.altura, 0, 0, canvas.width, canvas.height);
  if (lat != null) {
    const pt = pixelDe(v, img, lat, lon);
    const x = ((pt.x - rc.x) / rc.largura) * canvas.width;
    const y = ((pt.y - rc.y) / rc.altura) * canvas.height;
    const r = Math.max(2.5, canvas.width / 70);
    ctx.lineWidth = Math.max(1.5, r * 0.6); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#05070d';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  return { ...f, titulo: v.titulo, fonte: v.fonte };
}
