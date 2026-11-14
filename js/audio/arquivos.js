// Efeitos de fita e reverb (opcionais: o que não existir é substituído por um sintetizador do Tone.js).

const A = 'audio/';

// Os sons das 4 camadas estão em camadas.js. Aqui ficam só os efeitos de fita e o reverb.
export const ARQUIVOS = {
  fita: {
    rebobinar: `${A}fita/rebobinar.wav`,       // LOOP
    tic: `${A}fita/tic.wav`,                   // one-shot
    tapeStart: `${A}fita/tape_start.wav`,      // one-shot
  },
  ir: `${A}ir/espaco.wav`,                     // resposta impulsiva (reverb)
};

const encontrados = [];
export const arquivosEncontrados = () => encontrados.slice();

/** Carrega um arquivo; devolve null se não existir (sem quebrar nada). */
export async function carregarBuffer(url) {
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
