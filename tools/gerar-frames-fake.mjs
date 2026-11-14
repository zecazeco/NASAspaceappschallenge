// Gera FRAMES FICTÍCIOS no formato típico das visualizações globais da NASA:
// um mapa-múndi equirretangular (lon -180..180, lat 90..-90) com uma barra de cores embaixo.
// Os valores vêm de data/timeline.json (dados fictícios por região), espalhados pelo
// mapa por interpolação, com um pouco de "textura" para não ficar em blocos.
//
// Uso:  node tools/gerar-frames-fake.mjs
// Saída: data/frames/<dimensao>/<ano>.png (CO₂, chuva e vegetação) + data/frames/manifesto.json
//
// A temperatura NÃO é gerada aqui: ela usa os mapas reais da NASA (tools/preparar-frames-nasa.py).
// Este script só apaga e recria as pastas das camadas fictícias, e mantém no manifesto as camadas
// reais que já estiverem lá (as marcadas com "real": true).
//
// Quando chegarem os frames reais, eles substituem estas imagens: basta ajustar
// o manifesto (recorte do mapa, posição da barra de cores, mín/máx, lista de frames).

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(RAIZ, 'data', 'frames');
const T = JSON.parse(readFileSync(join(RAIZ, 'data', 'timeline.json'), 'utf8'));

// Layout do frame (como um frame exportado de um vídeo da NASA: mapa + legenda)
// 360×180 (1 pixel = 1 grau): leve para o celular baixar todos os anos
const L = 360, A_MAPA = 180, A = 216;
const BARRA = { x: 30, y: 196, largura: 300, altura: 10 };

const VIS = [
  {
    id: 'chuva', dimensao: 'chuva', semente: 10, leitura: 'local', min: -60, max: 60, unidade: '%',
    titulo: 'Anomalia de precipitação (fictício, no estilo GPCP)',
    cores: ['#8c510a', '#d8b365', '#f6e8c3', '#f5f5f5', '#c7eae5', '#5ab4ac', '#01665e'],
    textura: 5, valor: (r, i) => r.chuva[i],
  },
  {
    id: 'vegetacao', dimensao: 'vegetacao', semente: 20, leitura: 'local', min: 0, max: 0.9, unidade: 'NDVI',
    titulo: 'Índice de vegetação NDVI (fictício, no estilo MODIS/AVHRR)',
    cores: ['#f2ecd8', '#ddce8f', '#b5c46a', '#78ab3f', '#3d8a2a', '#0f5e1f'],
    textura: 0.02, valor: (r, i) => r.vegetacao[i],
  },
  {
    // CO₂ é global: o site lê a MÉDIA do frame inteiro, não o pixel da cidade
    id: 'co2', dimensao: 'co2', leitura: 'media', min: 300, max: 440, unidade: 'ppm',
    titulo: 'Dióxido de carbono na atmosfera (fictício, no estilo OCO-2/GEOS)',
    cores: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'],
    textura: 0, valor: null,
  },
];

// ---------- cores
const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
function corDe(vis, v) {
  const t = Math.max(0, Math.min(1, (v - vis.min) / (vis.max - vis.min))) * (vis.cores.length - 1);
  const i = Math.min(vis.cores.length - 2, Math.floor(t)), f = t - i;
  const a = hex(vis.cores[i]), b = hex(vis.cores[i + 1]);
  return a.map((c, k) => Math.round(c + (b[k] - c) * f));
}

// ---------- PNG mínimo (RGB 8 bits)
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function bloco(tipo, dados) {
  const t = Buffer.from(tipo, 'ascii');
  const out = Buffer.alloc(12 + dados.length);
  out.writeUInt32BE(dados.length, 0); t.copy(out, 4); dados.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([t, dados])), 8 + dados.length);
  return out;
}
function png(rgb, w, h) {
  const cru = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { cru[y * (w * 3 + 1)] = 0; rgb.copy(cru, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ihdr), bloco('IDAT', deflateSync(cru, { level: 9 })), bloco('IEND', Buffer.alloc(0))]);
}

// ---------- pesos de interpolação (calculados uma vez)
const R = Math.PI / 180;
const vet = (lat, lon) => [Math.cos(lat * R) * Math.cos(lon * R), Math.cos(lat * R) * Math.sin(lon * R), Math.sin(lat * R)];
const vReg = T.regioes.map((r) => vet(r.lat, r.lon));
const N = T.regioes.length;
const pesos = new Float32Array(L * A_MAPA * N);
for (let y = 0; y < A_MAPA; y++) {
  const lat = 90 - (y + 0.5) * (180 / A_MAPA);
  for (let x = 0; x < L; x++) {
    const p = vet(lat, -180 + (x + 0.5) * (360 / L));
    let soma = 0;
    const base = (y * L + x) * N;
    for (let k = 0; k < N; k++) {
      const d = Math.acos(Math.min(1, p[0] * vReg[k][0] + p[1] * vReg[k][1] + p[2] * vReg[k][2]));
      const w = 1 / (d + 0.04) ** 4;
      pesos[base + k] = w; soma += w;
    }
    for (let k = 0; k < N; k++) pesos[base + k] /= soma;
  }
}

/** Textura suave que muda devagar de um ano para outro (para o mapa não ficar em blocos). */
const textura = (x, y, ano, semente) => {
  const lon = x / L * 2 * Math.PI, lat = y / A_MAPA * Math.PI, t = (ano - 1950) * 0.13 + semente;
  return (Math.sin(3 * lon + t) * Math.cos(2 * lat - t * 0.7) + 0.6 * Math.sin(5 * lon - 1.3 * t + 2 * lat) + 0.4 * Math.cos(7 * lat + lon + t * 1.7)) / 2;
};

// ---------- gerar
// camadas reais já presentes no manifesto (ex.: temperatura da NASA) são mantidas como estão
let reais = [];
try {
  const atual = JSON.parse(readFileSync(join(SAIDA, 'manifesto.json'), 'utf8'));
  reais = (atual.visualizacoes ?? []).filter((v) => v.real);
} catch { /* ainda não há manifesto */ }
const manifesto = {
  aviso: 'CO₂, chuva e vegetação: frames FICTÍCIOS gerados a partir de data/timeline.json.'
    + (reais.length ? ` Reais: ${reais.map((v) => v.id).join(', ')}.` : ''),
  visualizacoes: [...reais],
};
mkdirSync(SAIDA, { recursive: true });

let total = 0;
VIS.forEach((vis) => {
  if (reais.some((r) => r.id === vis.id)) return;            // já existe a versão real
  rmSync(join(SAIDA, vis.id), { recursive: true, force: true });  // só a pasta desta camada fictícia
  mkdirSync(join(SAIDA, vis.id), { recursive: true });
  const frames = [];
  T.passos.forEach((p, i) => {
    let valores;
    if (vis.valor) {
      if (vis.valor(T.regioes[0], i) == null) return;     // ainda não medido: não há frame
      valores = T.regioes.map((r) => vis.valor(r, i));
    } else {
      const co2 = T.global.co2[i];
      if (co2 == null) return;
      valores = null;
      vis._co2 = co2;
    }
    const rgb = Buffer.alloc(L * A * 3, 255);
    for (let y = 0; y < A_MAPA; y++) {
      const lat = 90 - (y + 0.5) * (180 / A_MAPA);
      for (let x = 0; x < L; x++) {
        let v;
        if (valores) {
          v = 0;
          const base = (y * L + x) * N;
          for (let k = 0; k < N; k++) v += pesos[base + k] * valores[k];
          v += vis.textura * textura(x, y, p.inicio, vis.semente ?? 0);  // semente fixa por camada: mesma textura sempre
        } else {
          // CO₂: mais alto no hemisfério norte (onde estão as emissões), média = valor global
          v = vis._co2 + 3 * Math.sin(lat * R) + 0.8 * textura(x, y, p.inicio, 7);
        }
        corDe(vis, v).forEach((c, k) => { rgb[(y * L + x) * 3 + k] = c; });
      }
    }
    // legenda: barra de cores
    for (let y = BARRA.y; y < BARRA.y + BARRA.altura; y++) {
      for (let x = 0; x < BARRA.largura; x++) {
        const v = vis.min + (vis.max - vis.min) * (x + 0.5) / BARRA.largura;
        corDe(vis, v).forEach((c, k) => { rgb[(y * L + BARRA.x + x) * 3 + k] = c; });
      }
    }
    const arquivo = `${vis.id}/${p.inicio}.png`;
    writeFileSync(join(SAIDA, arquivo), png(rgb, L, A));
    frames.push({ data: String(p.inicio), arquivo });
    total++;
  });

  manifesto.visualizacoes.push({
    id: vis.id,
    dimensao: vis.dimensao,
    titulo: vis.titulo,
    fonte: 'Fictício (protótipo)',
    unidade: vis.unidade,
    leitura: vis.leitura,                       // 'local' = pixel da cidade; 'media' = frame inteiro
    projecao: { tipo: 'equirretangular', oeste: -180, leste: 180, norte: 90, sul: -90 },
    recorte: { x: 0, y: 0, largura: L, altura: A_MAPA },   // onde está o mapa dentro do frame
    escala: { barra: { ...BARRA, y: BARRA.y + BARRA.altura / 2 }, min: vis.min, max: vis.max },
    frames,
  });
});

writeFileSync(join(SAIDA, 'manifesto.json'), JSON.stringify(manifesto, null, 2));
console.log(`OK: ${total} frames em ${manifesto.visualizacoes.length} visualizações → ${SAIDA}`);
