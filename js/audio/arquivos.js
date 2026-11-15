// Efeitos de fita e reverb (opcionais: o que não existir é substituído por um sintetizador do Tone.js).

const A = 'audio/';

// Os sons das 4 camadas estão em camadas.js. Aqui ficam só os efeitos de fita e o reverb.
// Hoje nenhum desses arquivos existe: todos são null e o site usa os sintetizados (sem pedir nada ao
// servidor, para não aparecer erro 404 no console). Quando houver um arquivo, troque o null pelo caminho:
//   rebobinar: `${A}fita/rebobinar.wav` (LOOP) · tic: `${A}fita/tic.wav` · tapeStart: `${A}fita/tape_start.wav`
//   ir: `${A}ir/espaco.wav` (resposta impulsiva do reverb)
export const ARQUIVOS = {
  fita: {
    rebobinar: null,   // LOOP
    tic: null,         // one-shot
    tapeStart: null,   // one-shot
  },
  ir: null,            // resposta impulsiva (reverb)
};

const encontrados = [];
export const arquivosEncontrados = () => encontrados.slice();

/** Carrega um arquivo; devolve null se não existir ou se url for null (sem quebrar nada). */
export async function carregarBuffer(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    if (!resp.ok) return null;
    const buf = await new Tone.ToneAudioBuffer().load(url);
    encontrados.push(url);
    return buf;
  } catch {
    return null;
  }
}
