import { t, lingua } from './i18n.js';
// Descobrir a cidade: GPS → geocodificação reversa, ou busca digitada.

let CIDADES_LOCAIS = [];
export async function carregarCidadesLocais() {
  try { CIDADES_LOCAIS = await (await fetch('data/cidades.json')).json(); } catch { CIDADES_LOCAIS = []; }
}

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function comTempo(promessa, ms) {
  return Promise.race([promessa, new Promise((_, rej) => setTimeout(() => rej(new Error('tempo esgotado')), ms))]);
}

/** Pede o GPS. Resolve {lat, lon} ou rejeita com o motivo (negado, indisponível, tempo). */
export function pedirLocalizacao() {
  return new Promise((ok, erro) => {
    if (!('geolocation' in navigator)) return erro(new Error('indisponivel'));
    navigator.geolocation.getCurrentPosition(
      (pos) => ok({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (e) => erro(new Error(e.code === 1 ? 'negado' : e.code === 3 ? 'tempo' : 'indisponivel')),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/** Nome da cidade a partir das coordenadas. Arredonda (≈1 km) antes de enviar, por privacidade. */
export async function nomeDaCidade(lat, lon) {
  const la = lat.toFixed(2), lo = lon.toFixed(2);
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=${lingua()}`;
    const d = await comTempo(fetch(url).then((r) => r.json()), 6000);
    const nome = d.city || d.locality || d.principalSubdivision;
    if (nome) return { nome, detalhe: [d.principalSubdivision, d.countryName].filter(Boolean).join(', ') };
  } catch { /* offline ou bloqueado: cai na cidade local mais próxima */ }
  let melhor = null, menor = Infinity;
  for (const c of CIDADES_LOCAIS) {
    const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2;
    if (d < menor) { menor = d; melhor = c; }
  }
  return melhor && menor < 4
    ? { nome: t('local.perto', { nome: melhor.nome }), detalhe: melhor.pais }
    : { nome: t('local.sua'), detalhe: `${la}, ${lo}` };
}

/**
 * Busca por nome no Open-Meteo (ordenado por população, no idioma da tela). Se ele falhar (sem
 * internet, fora do ar, erro), usa a lista local de data/cidades.json.
 */
export async function buscarCidades(texto) {
  const q = semAcento(texto);
  if (q.length < 2) return [];
  try {
    // pede 20 porque parte é filtrada: só lugares habitados (código GeoNames PPL…: cidade, capital,
    // vila), sem aeroporto, morro, parque, bairro (PPLX) nem lugares abandonados/destruídos/históricos
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(texto.trim())}&count=20&language=${lingua()}&format=json`;
    const d = await comTempo(fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }), 6000);
    if (d.error) throw new Error(d.reason);
    const lista = [];
    for (const c of (d.results || []).filter((c) => /^PPL/.test(c.feature_code || '') && !/^PPL(X|H|Q|W|CH)$/.test(c.feature_code))) {
      const cidade = { nome: c.name, detalhe: [c.admin1, c.country].filter(Boolean).join(', '), lat: c.latitude, lon: c.longitude };
      // vilarejos homônimos no mesmo estado teriam o mesmo texto na lista: fica o primeiro (o mais populoso)
      if (!lista.some((x) => x.nome === cidade.nome && x.detalhe === cidade.detalhe)) lista.push(cidade);
    }
    return lista.slice(0, 8);
  } catch {
    return CIDADES_LOCAIS
      .filter((c) => semAcento(c.nome).startsWith(q))
      .map((c) => ({ nome: c.nome, detalhe: c.pais, lat: c.lat, lon: c.lon }))
      .slice(0, 8);
  }
}
