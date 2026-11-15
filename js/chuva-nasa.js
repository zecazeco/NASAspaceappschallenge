// Chuva real da cidade, buscada na hora na NASA POWER (https://power.larc.nasa.gov).
// Parâmetro PRECTOTCORR: precipitação corrigida do MERRA-2, em mm/dia; a resposta mensal já traz
// a média de cada ano (mês "13"). Os dados começam em 1981.
// Cada ano vira % de diferença em relação à média de 1981–2010 da própria cidade.
// Se a API falhar, quem chama recebe um erro e desliga a camada de chuva.

const API = 'https://power.larc.nasa.gov/api/temporal/monthly/point';
export const CHUVA_INICIO = 1981;
const REFERENCIA = [1981, 2010];
const ESPERA_MS = 20000;

/** Um valor por passo (% em relação à média da cidade) ou null antes de 1981 / sem dado. */
export async function buscarChuva(lat, lon, passos) {
  const fim = passos[passos.length - 1].fim ?? passos[passos.length - 1].inicio;
  const url = `${API}?parameters=PRECTOTCORR&community=AG&format=JSON` +
    `&latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start=${CHUVA_INICIO}&end=${fim}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ESPERA_MS);
  let dados;
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`NASA POWER respondeu ${r.status}`);
    dados = await r.json();
  } finally { clearTimeout(timer); }

  const mensal = dados?.properties?.parameter?.PRECTOTCORR;
  if (!mensal) throw new Error('NASA POWER: resposta sem PRECTOTCORR');
  const faltando = dados?.header?.fill_value ?? -999;
  const doAno = (ano) => {
    const v = mensal[`${ano}13`];
    return typeof v === 'number' && v !== faltando && v >= 0 ? v : null;
  };

  const ref = [];
  for (let a = REFERENCIA[0]; a <= REFERENCIA[1]; a++) if (doAno(a) != null) ref.push(doAno(a));
  const media = ref.length ? ref.reduce((s, v) => s + v, 0) / ref.length : 0;
  if (!(media > 0)) throw new Error('NASA POWER: sem média de referência');

  const valores = passos.map((p) => {
    const anos = [];
    for (let a = p.inicio; a <= (p.fim ?? p.inicio); a++) if (doAno(a) != null) anos.push(doAno(a));
    if (!anos.length) return null;
    const v = anos.reduce((s, x) => s + x, 0) / anos.length;
    return Math.round((v / media - 1) * 1000) / 10;   // %, 1 casa
  });
  if (!valores.some((v) => v != null)) throw new Error('NASA POWER: nenhum ano com dado');
  return valores;
}
