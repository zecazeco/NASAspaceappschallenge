// Carrega a linha do tempo e normaliza os valores para o motor de som (0..1).
// Fonte dos números: os FRAMES visuais (data/frames/, lidos por frames.js) quando existirem;
// senão, os valores por região de data/timeline.json.

import { carregarFrames, lerSerieLocal } from './frames.js';

let TIMELINE = null;

export async function carregarTimeline() {
  const resp = await fetch('data/timeline.json');
  if (!resp.ok) throw new Error('Não foi possível carregar data/timeline.json');
  TIMELINE = await resp.json();
  TIMELINE.frames = await carregarFrames();
  return TIMELINE;
}

/** 'frames' ou 'json': de onde vêm os números da cidade. */
export const fonteDosDados = () => (TIMELINE?.frames ? 'frames' : 'json');

export const timeline = () => TIMELINE;

function distanciaKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Região climática de centro mais próximo da cidade. */
export function regiaoMaisProxima(lat, lon) {
  let melhor = null, menor = Infinity;
  for (const reg of TIMELINE.regioes) {
    const d = distanciaKm(lat, lon, reg.lat, reg.lon);
    if (d < menor) { menor = d; melhor = reg; }
  }
  return melhor;
}

/**
 * Dados da cidade escolhida. Com frames: cada dimensão vem da cor do mapa sobre a cidade
 * (ou da média do frame, no caso do CO₂). Dimensões sem frames continuam vindo da região.
 */
export async function prepararLocal(lat, lon, aoProgresso = () => {}) {
  const base = regiaoMaisProxima(lat, lon);
  if (!TIMELINE.frames) { aoProgresso(1); return base; }
  const serie = await lerSerieLocal(lat, lon, TIMELINE.passos, aoProgresso);
  const local = { ...base, fonte: 'frames', inicioMedicao: {} };
  for (const [dim, valores] of Object.entries(serie)) {
    local[dim] = valores;
    const i = valores.findIndex((v) => v != null);
    local.inicioMedicao[dim] = i < 0 ? null : TIMELINE.passos[i].inicio;
  }
  // referência da vegetação: média 1982–1990 lida dos próprios frames
  if (serie.vegetacao) {
    const ref = serie.vegetacao.filter((v, i) => v != null && TIMELINE.passos[i].inicio <= 1990);
    const todos = serie.vegetacao.filter((v) => v != null);
    const amostra = ref.length ? ref : todos.slice(0, 5);
    if (amostra.length) local.vegetacaoBase = amostra.reduce((a, b) => a + b, 0) / amostra.length;
  }
  return local;
}

/** Ano em que cada dimensão começa a ter dados para esta cidade. */
export const inicioMedicao = (regiao) => ({ ...TIMELINE.meta.inicioMedicao, ...regiao?.inicioMedicao });

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Valores brutos + normalizados de um passo para uma região.
 * null = ainda não medido naquele ano (o instrumento fica em silêncio).
 */
export function valoresDoPasso(regiao, idx) {
  const co2 = (regiao.co2 ?? TIMELINE.global.co2)[idx];
  const temperatura = regiao.temperatura[idx];
  const chuva = regiao.chuva[idx];
  const vegetacao = regiao.vegetacao[idx];

  return {
    bruto: { co2, temperatura, chuva, vegetacao },
    // CO2: 315 ppm (1958) → 425 ppm (hoje)
    co2: co2 == null ? null : clamp01((co2 - 315) / (425 - 315)),
    // Temperatura: anomalia -0,5 °C → +2,5 °C = tensão harmônica 0 → 1
    temperatura: temperatura == null ? null : clamp01((temperatura + 0.5) / 3),
    // Chuva: anomalia em %; o mapeamento para densidade fica no instrumento
    chuva: chuva == null ? null : Math.max(-60, Math.min(60, chuva)),
    // Vegetação: saúde = NDVI / média 1982-1990; perda 0 → 1 quando cai 20%
    vegetacao: vegetacao == null || !regiao.vegetacaoBase ? null : {
      saude: vegetacao / regiao.vegetacaoBase,
      perda: clamp01((1 - vegetacao / regiao.vegetacaoBase) / 0.2),
    },
  };
}

// ---------- textos (tela e leitor de tela) ----------
const fmt = (v, casas = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function textosDimensoes(regiao, idx) {
  const { bruto: b, vegetacao } = valoresDoPasso(regiao, idx);
  const ini = inicioMedicao(regiao);
  return {
    co2: b.co2 == null ? `Ainda não medido. Começa em ${ini.co2}.` : `${fmt(b.co2, 0)} ppm no planeta`,
    temperatura: b.temperatura == null ? `Ainda não medida. Começa em ${ini.temperatura}.` : `${b.temperatura >= 0 ? '+' : '−'}${fmt(Math.abs(b.temperatura))} °C em relação a 1951–1980`,
    chuva: b.chuva == null ? `Ainda não medida. Começa em ${ini.chuva}.` :
      `${b.chuva >= 0 ? '+' : '−'}${fmt(Math.abs(b.chuva), 0)}% ${b.chuva <= -25 ? '(seca)' : b.chuva >= 25 ? '(chuva extrema)' : 'em relação à média'}`,
    vegetacao: vegetacao == null ? `Ainda não medida. Começa em ${ini.vegetacao}.` :
      vegetacao.saude >= 1 ? `Saudável: ${fmt((vegetacao.saude - 1) * 100, 0)}% mais verde que nos anos 1980` :
        `${fmt((1 - vegetacao.saude) * 100, 0)}% menos verde que nos anos 1980`,
  };
}
