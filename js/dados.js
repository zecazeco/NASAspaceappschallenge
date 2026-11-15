import { t, localidade } from './i18n.js';
// Carrega a linha do tempo e normaliza os valores para o motor de som (0..1).
// Fonte dos números: os FRAMES visuais (data/frames/, lidos por frames.js) quando existirem;
// senão, os valores por região de data/timeline.json. A chuva vem da NASA POWER (chuva-nasa.js);
// o CO₂, da NOAA (data/co2-noaa.json).

import { carregarFrames, lerSerieLocal } from './frames.js';
import { buscarChuva, CHUVA_INICIO } from './chuva-nasa.js';
import { limitesChuva } from './trilha.js';

let TIMELINE = null;

export async function carregarTimeline() {
  const resp = await fetch('data/timeline.json');
  if (!resp.ok) throw new Error('Não foi possível carregar data/timeline.json');
  TIMELINE = await resp.json();
  // CO₂: média anual de Mauna Loa (NOAA), guardada no próprio site (data/co2-noaa.json); começa em 1959
  const co2 = await fetch('data/co2-noaa.json');
  if (!co2.ok) throw new Error('Não foi possível carregar data/co2-noaa.json');
  const { anual } = await co2.json();
  TIMELINE.global.co2 = TIMELINE.passos.map((p) => anual[p.inicio] ?? null);
  TIMELINE.meta.inicioMedicao.co2 = TIMELINE.passos.find((p) => anual[p.inicio] != null)?.inicio ?? null;
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
 * Dados da cidade escolhida. Com frames: a temperatura vem da cor do mapa sobre a cidade.
 * A chuva vem da NASA POWER; se ela falhar, entra em local.indisponivel e a camada é desligada.
 */
export async function prepararLocal(lat, lon, aoProgresso = () => {}) {
  const base = regiaoMaisProxima(lat, lon);
  // chuva: NASA POWER, buscada em paralelo com a leitura dos mapas
  const chuva = buscarChuva(lat, lon, TIMELINE.passos).catch((e) => { console.warn('Chuva indisponível:', e.message); return null; });
  let local;
  if (!TIMELINE.frames) { local = { ...base, inicioMedicao: {} }; aoProgresso(1); }
  else {
    const serie = await lerSerieLocal(lat, lon, TIMELINE.passos, aoProgresso);
    local = { ...base, fonte: 'frames', inicioMedicao: {} };
    for (const [dim, lidos] of Object.entries(serie)) {
      // temperatura com 1 casa decimal: a linha, o número na tela e o som usam o mesmo valor
      const valores = dim === 'temperatura' ? lidos.map((v) => (v == null ? null : Math.round(v * 10) / 10)) : lidos;
      local[dim] = valores;
      const i = valores.findIndex((v) => v != null);
      local.inicioMedicao[dim] = i < 0 ? null : TIMELINE.passos[i].inicio;
    }
  }
  delete local.co2;   // o CO₂ é global (TIMELINE.global.co2), não o da região fictícia
  // dimensões que não carregaram ficam sem valores e a camada é desligada (local.indisponivel)
  local.indisponivel = [];
  const valoresChuva = await chuva;
  if (valoresChuva) { local.chuva = valoresChuva; local.inicioMedicao.chuva = CHUVA_INICIO; }
  else { local.chuva = TIMELINE.passos.map(() => null); local.inicioMedicao.chuva = null; local.indisponivel.push('chuva'); }
  local.limitesChuva = limitesChuva(local.chuva);   // seca / chuva extrema: os 10% mais extremos da cidade
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

  return {
    bruto: { co2, temperatura, chuva },
    // CO2: 315 ppm (1959) → 425 ppm (hoje)
    co2: co2 == null ? null : clamp01((co2 - 315) / (425 - 315)),
    // Temperatura: anomalia -0,5 °C → +2,5 °C = tensão harmônica 0 → 1
    temperatura: temperatura == null ? null : clamp01((temperatura + 0.5) / 3),
    // Chuva: anomalia em %; o mapeamento para densidade fica no instrumento
    chuva: chuva == null ? null : Math.max(-60, Math.min(60, chuva)),
  };
}

// ---------- textos (tela e leitor de tela) ----------
const fmt = (v, casas = 1) => v.toLocaleString(localidade(), { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function textosDimensoes(regiao, idx) {
  const { bruto: b } = valoresDoPasso(regiao, idx);
  const ini = inicioMedicao(regiao), lim = regiao.limitesChuva;
  const tipoChuva = (v) => (!lim ? '' : v <= lim.baixo ? 'seca' : v >= lim.alto ? 'extrema' : '');
  return {
    co2: b.co2 == null ? t('dim.naoMedido', { ano: ini.co2 }) : t('dim.co2', { v: fmt(b.co2, 0) }),
    temperatura: b.temperatura == null ? t('dim.naoMedida', { ano: ini.temperatura }) : t('dim.temp', { v: `${b.temperatura >= 0 ? '+' : '−'}${fmt(Math.abs(b.temperatura))}` }),
    chuva: b.chuva == null ? t('dim.naoMedida', { ano: ini.chuva }) :
      t('dim.chuva', { v: `${b.chuva >= 0 ? '+' : '−'}${fmt(Math.abs(b.chuva), 0)}`, tipo: tipoChuva(b.chuva) }),
  };
}
