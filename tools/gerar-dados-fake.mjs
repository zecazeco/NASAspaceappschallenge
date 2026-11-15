// Gera data/timeline.json com DADOS FICTÍCIOS (baseados um pouco na realidade).
// Uso: node tools/gerar-dados-fake.mjs
// Quando os dados reais da EIC chegarem, basta gerar o mesmo formato.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ANO_INICIO = 1950;
const ANO_FIM = 2023; // o mapa de temperatura da NASA (SVS 5207) vai até 2023
const INICIO_MEDICAO = { temperatura: 1950, co2: 1958, chuva: 1979, vegetacao: 1982 };

// ---------- aleatório com semente (reprodutível) ----------
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(2026);
const ruido = (amp) => (rnd() * 2 - 1) * amp;
const r = (v, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;

function interpolar(chaves, ano) {
  const anos = Object.keys(chaves).map(Number).sort((a, b) => a - b);
  if (ano <= anos[0]) return chaves[anos[0]];
  for (let i = 0; i < anos.length - 1; i++) {
    const a = anos[i], b = anos[i + 1];
    if (ano >= a && ano <= b) return chaves[a] + (chaves[b] - chaves[a]) * ((ano - a) / (b - a));
  }
  return chaves[anos[anos.length - 1]];
}

// ---------- séries globais ----------
// Anomalia de temperatura global (°C vs 1951-1980), aproximação da GISTEMP.
const TEMP_GLOBAL = {
  1950: -0.17, 1955: -0.14, 1960: -0.03, 1965: -0.10, 1970: 0.03, 1975: -0.01,
  1980: 0.26, 1985: 0.12, 1990: 0.45, 1995: 0.45, 1998: 0.61, 2000: 0.39,
  2005: 0.67, 2010: 0.72, 2012: 0.64, 2015: 0.90, 2016: 1.01, 2018: 0.85,
  2020: 1.01, 2022: 0.89, 2023: 1.17, 2024: 1.28, 2025: 1.19, 2026: 1.22,
};
const anos = [];
for (let a = ANO_INICIO; a <= ANO_FIM; a++) anos.push(a);

const tempGlobal = Object.fromEntries(anos.map((a) => [a, interpolar(TEMP_GLOBAL, a) + ruido(0.04)]));
// CO2 (ppm): 316 em 1958 + o aumento de cada ano, aproximando os aumentos anuais
// de Mauna Loa (NOAA). Os saltos de El Niño (1998, 2015-16, 2023-24) e o freio do
// Pinatubo (1992) aparecem, e com eles os "recordes de velocidade".
const AUMENTO_CO2 = {
  1959: 0.94, 1960: 0.54, 1961: 0.95, 1962: 0.64, 1963: 0.71, 1964: 0.29, 1965: 0.98, 1966: 1.23, 1967: 0.75, 1968: 1.02,
  1969: 1.34, 1970: 1.02, 1971: 0.82, 1972: 1.76, 1973: 1.18, 1974: 0.78, 1975: 1.10, 1976: 0.91, 1977: 2.15, 1978: 1.30,
  1979: 1.85, 1980: 1.70, 1981: 1.43, 1982: 0.88, 1983: 2.18, 1984: 1.39, 1985: 1.79, 1986: 1.25, 1987: 2.70, 1988: 2.16,
  1989: 1.37, 1990: 1.21, 1991: 1.01, 1992: 0.60, 1993: 1.33, 1994: 1.95, 1995: 1.98, 1996: 1.20, 1997: 1.94, 1998: 2.89,
  1999: 1.33, 2000: 1.60, 2001: 1.71, 2002: 2.40, 2003: 2.24, 2004: 1.62, 2005: 2.47, 2006: 1.73, 2007: 2.15, 2008: 1.60,
  2009: 1.89, 2010: 2.40, 2011: 1.72, 2012: 2.65, 2013: 2.06, 2014: 2.17, 2015: 3.02, 2016: 3.32, 2017: 1.89, 2018: 2.86,
  2019: 2.47, 2020: 2.32, 2021: 2.37, 2022: 2.17, 2023: 3.37, 2024: 3.75, 2025: 2.60, 2026: 2.50,
};
const co2 = {};
for (const a of anos) {
  if (a < INICIO_MEDICAO.co2) co2[a] = null;
  else co2[a] = a === INICIO_MEDICAO.co2 ? 315.98 : co2[a - 1] + AUMENTO_CO2[a];
}

// ---------- regiões ----------
// amp: amplificação regional do aquecimento
// chuvaTend: tendência de chuva (%/ano desde 1979); eventos: anomalias de chuva (%)
// ndvi: [valor em 1982, valor em 2025]; ndviChuva: sensibilidade do NDVI à chuva
const REGIOES = [
  { id: 'amazonia', nome: 'Amazônia', bioma: 'Floresta tropical', lat: -4, lon: -62, amp: 1.2, chuvaMm: 2300, chuvaTend: -0.25,
    eventos: { 2005: -25, 2009: 15, 2010: -30, 2012: 15, 2015: -25, 2016: -20, 2021: 18, 2023: -35, 2024: -40 }, ndvi: [0.86, 0.79], ndviChuva: 0.08 },
  { id: 'cerrado', nome: 'Cerrado (Brasil Central)', bioma: 'Savana tropical', lat: -15, lon: -48, amp: 1.3, chuvaMm: 1500, chuvaTend: -0.4,
    eventos: { 2007: -15, 2014: -20, 2017: -18, 2019: -15, 2024: -30 }, ndvi: [0.64, 0.52], ndviChuva: 0.12 },
  { id: 'sudeste-br', nome: 'Sudeste do Brasil e Mata Atlântica', bioma: 'Mata Atlântica', lat: -22, lon: -45, amp: 1.1, chuvaMm: 1400, chuvaTend: -0.15,
    eventos: { 1983: 20, 2000: 12, 2011: 18, 2014: -35, 2015: -20, 2021: -22, 2024: -15 }, ndvi: [0.66, 0.61], ndviChuva: 0.1 },
  { id: 'nordeste-br', nome: 'Nordeste do Brasil e Caatinga', bioma: 'Caatinga', lat: -8, lon: -39, amp: 1.2, chuvaMm: 700, chuvaTend: -0.3,
    eventos: { 1983: -35, 1985: 30, 1993: -30, 1998: -30, 2009: 20, 2012: -40, 2013: -35, 2014: -25, 2015: -30, 2016: -35 }, ndvi: [0.48, 0.44], ndviChuva: 0.2 },
  { id: 'sul-br', nome: 'Sul do Brasil e Pampa', bioma: 'Pampa', lat: -29, lon: -53, amp: 0.9, chuvaMm: 1600, chuvaTend: 0.2,
    eventos: { 1983: 35, 1998: 25, 2009: 15, 2015: 25, 2020: -20, 2021: -25, 2022: -20, 2023: 30, 2024: 45 }, ndvi: [0.66, 0.63], ndviChuva: 0.08 },
  { id: 'andes-sul', nome: 'Andes e Cone Sul', bioma: 'Andes e Pampa seco', lat: -35, lon: -68, amp: 0.8, chuvaMm: 600, chuvaTend: -0.35,
    eventos: { 1997: 25, 2010: -20, 2013: -25, 2019: -30, 2021: -28, 2022: -25 }, ndvi: [0.40, 0.37], ndviChuva: 0.15 },
  { id: 'america-central', nome: 'América Central e Caribe', bioma: 'Floresta tropical seca', lat: 15, lon: -88, amp: 1.0, chuvaMm: 1800, chuvaTend: -0.1,
    eventos: { 1998: 25, 2005: 20, 2015: -25, 2020: 30, 2023: -20 }, ndvi: [0.72, 0.68], ndviChuva: 0.08 },
  { id: 'america-norte-leste', nome: 'Leste da América do Norte', bioma: 'Floresta temperada', lat: 40, lon: -80, amp: 1.4, chuvaMm: 1100, chuvaTend: 0.15,
    eventos: { 1988: -20, 2011: 20, 2012: -18, 2018: 22 }, ndvi: [0.62, 0.64], ndviChuva: 0.05 },
  { id: 'america-norte-oeste', nome: 'Oeste da América do Norte', bioma: 'Semiárido e florestas de coníferas', lat: 40, lon: -115, amp: 1.5, chuvaMm: 450, chuvaTend: -0.2,
    eventos: { 1983: 30, 2002: -25, 2012: -22, 2013: -30, 2014: -28, 2015: -25, 2017: 25, 2021: -30, 2023: 30 }, ndvi: [0.38, 0.36], ndviChuva: 0.12 },
  { id: 'artico', nome: 'Ártico e Groenlândia', bioma: 'Tundra e gelo', lat: 75, lon: -40, amp: 3.0, chuvaMm: 300, chuvaTend: 0.4,
    eventos: { 2012: 20, 2019: 18 }, ndvi: [0.28, 0.36], ndviChuva: 0.02 },
  { id: 'europa', nome: 'Europa', bioma: 'Floresta temperada', lat: 50, lon: 10, amp: 1.8, chuvaMm: 800, chuvaTend: -0.05,
    eventos: { 2003: -20, 2018: -18, 2021: 20, 2022: -22 }, ndvi: [0.60, 0.64], ndviChuva: 0.05 },
  { id: 'mediterraneo', nome: 'Mediterrâneo', bioma: 'Mediterrâneo', lat: 38, lon: 15, amp: 1.6, chuvaMm: 600, chuvaTend: -0.45,
    eventos: { 1990: -20, 2005: -22, 2017: -25, 2022: -30, 2023: -20 }, ndvi: [0.44, 0.40], ndviChuva: 0.12 },
  { id: 'sahel', nome: 'Sahel e África Ocidental', bioma: 'Savana semiárida', lat: 14, lon: 0, amp: 1.3, chuvaMm: 450, chuvaTend: 0.6,
    eventos: { 1979: -20, 1980: -22, 1982: -28, 1983: -35, 1984: -38, 1987: -25, 1990: -22, 2012: 15, 2020: 20 }, ndvi: [0.24, 0.31], ndviChuva: 0.25 },
  { id: 'africa-central', nome: 'Bacia do Congo', bioma: 'Floresta tropical', lat: 0, lon: 20, amp: 1.0, chuvaMm: 1700, chuvaTend: -0.1,
    eventos: { 1983: -15, 2016: -15, 2019: 15 }, ndvi: [0.83, 0.80], ndviChuva: 0.05 },
  { id: 'africa-austral', nome: 'África Austral', bioma: 'Savana', lat: -22, lon: 25, amp: 1.2, chuvaMm: 550, chuvaTend: -0.2,
    eventos: { 1992: -35, 2000: 25, 2015: -25, 2016: -30, 2019: -20, 2024: -35 }, ndvi: [0.42, 0.41], ndviChuva: 0.2 },
  { id: 'oriente-medio', nome: 'Oriente Médio', bioma: 'Deserto', lat: 28, lon: 45, amp: 1.7, chuvaMm: 150, chuvaTend: -0.3,
    eventos: { 1999: -30, 2008: -35, 2021: -30 }, ndvi: [0.13, 0.12], ndviChuva: 0.05 },
  { id: 'siberia', nome: 'Rússia e Sibéria', bioma: 'Taiga', lat: 62, lon: 100, amp: 2.2, chuvaMm: 450, chuvaTend: 0.2,
    eventos: { 2010: -20, 2020: -15 }, ndvi: [0.54, 0.60], ndviChuva: 0.03 },
  { id: 'asia-sul', nome: 'Sul da Ásia', bioma: 'Monções', lat: 22, lon: 78, amp: 1.0, chuvaMm: 1100, chuvaTend: -0.05,
    eventos: { 1987: -18, 2002: -20, 2009: -22, 2019: 12, 2022: 15 }, ndvi: [0.44, 0.52], ndviChuva: 0.1 },
  { id: 'asia-leste', nome: 'Leste da Ásia', bioma: 'Floresta temperada e estepe', lat: 34, lon: 112, amp: 1.4, chuvaMm: 800, chuvaTend: 0.1,
    eventos: { 1998: 25, 2011: -15, 2020: 22, 2022: -20 }, ndvi: [0.45, 0.54], ndviChuva: 0.06 },
  { id: 'sudeste-asiatico', nome: 'Sudeste Asiático e Indonésia', bioma: 'Floresta tropical', lat: 2, lon: 110, amp: 0.9, chuvaMm: 2600, chuvaTend: -0.05,
    eventos: { 1982: -20, 1997: -30, 2015: -25, 2019: -15, 2021: 15 }, ndvi: [0.81, 0.72], ndviChuva: 0.05 },
  { id: 'australia', nome: 'Austrália e Oceania', bioma: 'Savana e deserto', lat: -25, lon: 134, amp: 1.3, chuvaMm: 450, chuvaTend: 0,
    eventos: { 1982: -25, 2002: -25, 2006: -22, 2010: 35, 2011: 38, 2019: -35, 2021: 20, 2022: 30 }, ndvi: [0.30, 0.31], ndviChuva: 0.3 },
];

function seriesRegiao(reg) {
  const temperatura = {}, chuva = {}, vegetacao = {};
  let tempLenta = 0;
  for (const a of anos) {
    tempLenta = tempLenta * 0.6 + ruido(0.12); // variação regional autocorrelacionada
    temperatura[a] = tempGlobal[a] * reg.amp + tempLenta;

    if (a < INICIO_MEDICAO.chuva) { chuva[a] = null; } else {
      const ev = reg.eventos[a] ?? 0;
      const oscil = Math.sin((a - 1979) * 0.9 + reg.lon) * 5; // "ENSO" fictício
      chuva[a] = reg.chuvaTend * (a - 1990) + ev + oscil + ruido(6);
    }

    if (a < INICIO_MEDICAO.vegetacao) { vegetacao[a] = null; } else {
      const t = (a - 1982) / (ANO_FIM - 1982);
      const tendencia = reg.ndvi[0] + (reg.ndvi[1] - reg.ndvi[0]) * t;
      vegetacao[a] = tendencia + (chuva[a] / 100) * reg.ndviChuva * reg.ndvi[0] + ruido(0.006);
    }
  }
  return { temperatura, chuva, vegetacao };
}

// ---------- agrupamento dos anos em passos ----------
// Decisão: NÃO agrupar anos. 1 passo = 1 ano = 1 compasso.
function tamanhoMaximo() { return 1; }
const FRONTEIRAS = new Set(Object.values(INICIO_MEDICAO));
const passos = [];
for (let i = 0; i < anos.length;) {
  const inicio = anos[i];
  let fim = inicio;
  while (i + 1 < anos.length) {
    const prox = anos[i + 1];
    const tamanho = prox - inicio + 1;
    if (tamanho > tamanhoMaximo(inicio)) break;
    if (prox >= 1990 && inicio < 1990) break;
    if (prox >= 2010 && inicio < 2010) break;
    if (FRONTEIRAS.has(prox)) break;
    if (Math.abs(tempGlobal[prox] - tempGlobal[inicio]) > 0.12) break;
    fim = prox; i++;
  }
  i++;
  passos.push({ inicio, fim });
}

const EVENTOS = {
  [INICIO_MEDICAO.co2]: { texto: 'Começa a medição do gás carbônico.', dimensao: 'co2' },
  [INICIO_MEDICAO.chuva]: { texto: 'Satélites começam a medir a chuva.', dimensao: 'chuva' },
  [INICIO_MEDICAO.vegetacao]: { texto: 'Satélites começam a medir a vegetação.', dimensao: 'vegetacao' },
};

const media = (serie, p) => {
  const vals = [];
  for (let a = p.inicio; a <= p.fim; a++) if (serie[a] != null) vals.push(serie[a]);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
};

const passosJson = passos.map((p, i) => {
  const rotulo = p.inicio === p.fim ? `${p.inicio}` : `${p.inicio}–${p.fim}`;
  const evento = EVENTOS[p.inicio];
  return {
    inicio: p.inicio,
    fim: p.fim,
    rotulo,
    falado: p.inicio === p.fim ? `${p.inicio}` : `${p.inicio} a ${p.fim}`,
    ...(evento ? { evento: evento.dimensao } : {}),
  };
});

const regioes = REGIOES.map((reg) => {
  const s = seriesRegiao(reg);
  const vegBase = (() => {
    const v = []; for (let a = 1982; a <= 1990; a++) v.push(s.vegetacao[a]);
    return v.reduce((x, y) => x + y, 0) / v.length;
  })();
  return {
    id: reg.id, nome: reg.nome, bioma: reg.bioma, lat: reg.lat, lon: reg.lon,
    chuvaMediaMmAno: reg.chuvaMm,
    vegetacaoBase: r(vegBase, 3),
    temperatura: passos.map((p) => r(media(s.temperatura, p))),
    chuva: passos.map((p) => { const v = media(s.chuva, p); return v == null ? null : r(v, 1); }),
    vegetacao: passos.map((p) => { const v = media(s.vegetacao, p); return v == null ? null : r(v, 3); }),
  };
});

const saida = {
  meta: {
    ficticio: true,
    aviso: 'DADOS FICTÍCIOS para protótipo, baseados aproximadamente em GISTEMP, Keeling, GPCP e NDVI. Não usar como informação real.',
    anoInicio: ANO_INICIO,
    anoFim: ANO_FIM,
    compassosPorPasso: 1,
    bpm: 110,
    duracaoAlvoMin: 3,
    inicioMedicao: INICIO_MEDICAO,
    unidades: {
      co2: 'ppm (global)',
      temperatura: '°C de anomalia vs 1951–1980',
      chuva: '% de anomalia vs média 1979–2000',
      vegetacao: 'NDVI (0 a 1)',
    },
  },
  passos: passosJson,
  global: { co2: passos.map((p) => { const v = media(co2, p); return v == null ? null : r(v, 2); }) },
  regioes,
};

const destino = join(RAIZ, 'data', 'timeline.json');
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, JSON.stringify(saida, null, 1));
console.log(`OK: ${passos.length} passos, ${regioes.length} regiões → ${destino}`);
console.log(passos.map((p) => (p.inicio === p.fim ? p.inicio : `${p.inicio}-${p.fim}`)).join(' | '));
