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
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=pt`;
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
    ? { nome: `Perto de ${melhor.nome}`, detalhe: melhor.pais }
    : { nome: 'Sua localização', detalhe: `${la}, ${lo}` };
}

/** Busca por nome: primeiro a lista local (instantânea, offline), depois o Open-Meteo. */
export async function buscarCidades(texto) {
  const q = semAcento(texto);
  if (q.length < 2) return [];
  const locais = CIDADES_LOCAIS
    .filter((c) => semAcento(c.nome).startsWith(q))
    .map((c) => ({ nome: c.nome, detalhe: c.pais, lat: c.lat, lon: c.lon }));
  let remotas = [];
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(texto.trim())}&count=8&language=pt&format=json`;
    const d = await comTempo(fetch(url).then((r) => r.json()), 6000);
    remotas = (d.results || []).map((c) => ({
      nome: c.name,
      detalhe: [c.admin1, c.country].filter(Boolean).join(', '),
      lat: c.latitude, lon: c.longitude,
    }));
  } catch { /* sem internet: fica só com a lista local */ }
  const vistas = new Set();
  return [...locais, ...remotas].filter((c) => {
    const k = `${semAcento(c.nome)}|${c.lat.toFixed(1)}|${c.lon.toFixed(1)}`;
    if (vistas.has(k)) return false; vistas.add(k); return true;
  }).slice(0, 8);
}
