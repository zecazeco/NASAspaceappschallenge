// As camadas da trilha e como cada uma toca os arquivos do músico.
//
// O código nunca mexe no som (filtro, afinação, tempo): só escolhe qual arquivo toca e liga ou desliga.
//   • 'compassos' (temperatura): 7 figuras (parado, sobe/desce pequena/média/grande) que começam e voltam
//     para a mesma nota, escolhidas pela mudança até o ano seguinte (trilha.movimento). Cada ano toca o
//     arquivo inteiro do início do compasso; a cauda some quando o compasso seguinte começa.
//   • 'niveis' (tendência, vegetação): 4 loops de 1 compasso; o nível do ano decide qual se ouve
//     (com troca suave; posição quebrada, ex. 1,4, mistura dois níveis).
//   • 'vozes' (CO₂): 5 loops de 4 compassos que se acumulam; o ano liga da voz 1 até a voz dele.
//   • 'troca' (chuva): 4 loops de 1 compasso, um por tipo de mudança até o ano seguinte (trilha.sons).
//     O som novo entra rápido (a gota do começo fica inteira) e o anterior some devagar.
// Loops só tocam enquanto podem ser ouvidos. Quando um entra, começa no ponto certo do relógio (como se
// tivesse tocado desde o início), então as frases ficam sempre alinhadas.
//
// Som pontual (teste): picos e vales da temperatura, ligado pelo seletor no topo da página.
//
// Arquivos: primeiro audio/<pasta>/<nome>.mp3 ou .wav (os do músico); se não existir,
// audio/provisorio/<nome>.wav (gerados por tools/gerar-sons-provisorios.mjs).

import { NIVEIS, FIGURAS_MOVIMENTO, VOZES_CO2 } from '../trilha.js';

export const DEFINICAO = {
  co2: { pasta: 'co2', prefixo: 'co2', modo: 'vozes', quantas: VOZES_CO2 },
  temperatura: { pasta: 'temperatura', prefixo: 'temp', modo: 'compassos', figuras: FIGURAS_MOVIMENTO,
    pontuais: { pontual01: ['pico', 'vale'] } },
  tendencia: { pasta: 'tendencia', prefixo: 'tend', modo: 'niveis' },
  chuva: { pasta: 'chuva', prefixo: 'chuva', modo: 'troca', entra: 0.015, sai: 0.3 },   // s (constantes de tempo)
  vegetacao: { pasta: 'vegetacao', prefixo: 'veg', modo: 'niveis' },
};

/** Arquivos da camada, na ordem: { nome, k }. */
const nomesDaCamada = (d) => {
  if (d.modo === 'compassos') return d.figuras.map((fig, k) => ({ nome: `${d.prefixo}_${fig}`, k }));
  if (d.modo === 'vozes') return Array.from({ length: d.quantas }, (_, k) => ({ nome: `${d.prefixo}_voz_${k + 1}`, k }));
  return Array.from({ length: NIVEIS }, (_, k) => ({ nome: `${d.prefixo}_base_${k + 1}`, k }));
};

/** Sons pontuais da camada: { nome, conjunto, tipo } (ex.: temp_pontual01_pico). */
const pontuaisDaCamada = (d) => Object.entries(d.pontuais ?? {})
  .flatMap(([conjunto, tipos]) => tipos.map((tipo) => ({ nome: `${d.prefixo}_${conjunto}_${tipo}`, conjunto, tipo })));

/** Todos os nomes de arquivo esperados (sem extensão). */
export function nomesDosArquivos() {
  return Object.values(DEFINICAO).flatMap((d) => [...nomesDaCamada(d), ...pontuaisDaCamada(d)].map(({ nome }) => ({ pasta: d.pasta, nome })));
}

const origem = {};                  // nome → 'musico' | 'provisorio'
export const origemDosSons = () => ({ ...origem });

async function existe(url) {
  try { return (await fetch(url, { method: 'HEAD' })).ok; } catch { return false; }
}

async function carregarSom(pasta, nome) {
  for (const [url, tipo] of [[`audio/${pasta}/${nome}.mp3`, 'musico'], [`audio/${pasta}/${nome}.wav`, 'musico'], [`audio/provisorio/${nome}.wav`, 'provisorio']]) {
    if (!(await existe(url))) continue;
    try {
      const buf = await new Tone.ToneAudioBuffer().load(url);
      origem[nome] = tipo;
      return buf;
    } catch { /* tenta o próximo */ }
  }
  return null;
}

const RAMPA_NIVEL = 0.6;   // s: troca suave de volume entre níveis (e entrada das vozes) no início do compasso
const VOLUME_BASE = 0.5;   // −6 dB (mesmo equilíbrio entre camadas de antes)
const SOLTAR = 0.6;        // s: quando o compasso seguinte começa, a cauda do anterior some nesse tempo

export class Camada {
  constructor(id) {
    this.id = id;
    this.def = DEFINICAO[id];
    this.saida = new Tone.Gain(1);
    this.mix = new Tone.Gain(VOLUME_BASE).connect(this.saida);
    this.ligada = true;
    this.loops = [];       // modos 'niveis', 'vozes' e 'troca': { buf, ganho, fonte } (criarLoop)
    this.buffers = [];     // modo 'compassos': um buffer por figura
    this.soando = [];      // modo 'compassos': { fonte, ganho } ainda tocando
    this.pontuais = {};    // conjunto → { pico: buffer, vale: buffer }
    this.pontualAtivo = null;   // ex.: 'pontual01'; null = sem pontual
  }

  /** Baixa os arquivos da camada; aoArquivo() é chamado a cada arquivo pronto (para o progresso). */
  async carregar(aoArquivo = () => {}) {
    const { pasta } = this.def;
    await Promise.all([...nomesDaCamada(this.def).map(({ nome, k }) => carregarSom(pasta, nome).then((buf) => {
      if (this.def.modo === 'compassos') this.buffers[k] = buf;
      else this.loops[k] = this.criarLoop(buf);
      aoArquivo();
    })), ...pontuaisDaCamada(this.def).map(({ nome, conjunto, tipo }) => carregarSom(pasta, nome).then((buf) => {
      (this.pontuais[conjunto] ??= {})[tipo] = buf;
      aoArquivo();
    }))]);
  }

  /** Loop: { buf, ganho, fonte }. fonte só existe enquanto ele pode ser ouvido. */
  criarLoop(buf) { return { buf, ganho: new Tone.Gain(0).connect(this.mix), fonte: null }; }

  /**
   * Leva o loop ao volume g a partir de `tempo` (tau = constante de tempo em s). Volume 0 (ou camada
   * desligada): o loop some e PARA de tocar. Volume > 0 e parado: começa no ponto do relógio (segundos
   * desde o início da música, dando a volta no tamanho do arquivo), como se nunca tivesse parado.
   */
  ajustarLoop(l, g, tempo, tau) {
    if (!l?.buf) return;
    const ouvir = this.ligada && g > 0.001;
    l.ganho.gain.cancelScheduledValues(tempo);
    if (ouvir) {
      if (!l.fonte) {
        const dur = l.buf.duration;
        const seg = Tone.getContext().transport.getSecondsAtTime(tempo);
        let ponto = ((seg % dur) + dur) % dur;
        if (dur - ponto < 0.002) ponto = 0;   // arredondamento: "quase no fim" é o começo da próxima volta
        l.fonte = new Tone.ToneBufferSource({ url: l.buf, loop: true }).connect(l.ganho);
        l.fonte.start(tempo, ponto);
      }
      l.ganho.gain.setTargetAtTime(g, tempo, tau);
    } else if (l.fonte) {
      l.ganho.gain.setTargetAtTime(0, tempo, tau);
      const f = l.fonte;
      l.fonte = null;
      f.onended = () => f.dispose();
      f.stop(tempo + tau * 6);
    }
  }

  /** Para todos os loops (pausa, fita, fim). */
  pararLoops(tempo, tau = 0.03) { for (const l of this.loops) this.ajustarLoop(l, 0, tempo, tau); }

  /**
   * Modos com loops: aplica o ano. pos = nível (0..3, pode ser quebrado) no modo 'niveis', a voz mais
   * alta (0..4) no modo 'vozes' e o som (0..3) no modo 'troca'; null = silêncio.
   */
  definirPosicao(pos, tempo) {
    this.ultimo = pos;
    const { modo } = this.def, tau = RAMPA_NIVEL / 3;
    this.loops.forEach((l, i) => {
      if (modo === 'vozes') this.ajustarLoop(l, pos != null && i <= pos ? 1 : 0, tempo, tau);
      else if (modo === 'troca') { const g = pos === i ? 1 : 0; this.ajustarLoop(l, g, tempo, g ? this.def.entra : this.def.sai); }
      else {   // 'niveis': troca por potência constante, para o volume total não afundar no meio
        const d = pos == null ? 1 : Math.abs(pos - i);
        this.ajustarLoop(l, d >= 1 ? 0 : Math.cos((d * Math.PI) / 2), tempo, tau);
      }
    });
  }

  /**
   * Modo 'compassos': toca a figura k a partir de `tempo` (início do compasso).
   * O arquivo pode ter cauda depois do compasso; ela some quando o próximo compasso começa.
   */
  tocarCompasso(k, tempo) {
    this.soltar(tempo);
    const buf = k == null || !this.ligada ? null : this.buffers[k];
    if (!buf) return;
    const ganho = new Tone.Gain(1).connect(this.mix);
    const fonte = new Tone.ToneBufferSource(buf).connect(ganho);
    const voz = { fonte, ganho };
    fonte.onended = () => { ganho.dispose(); this.soando = this.soando.filter((v) => v !== voz); };
    fonte.start(tempo);
    this.soando.push(voz);
  }

  /** Teste: qual conjunto de sons pontuais toca (null = sem pontual). */
  definirPontual(conjunto) {
    this.pontualAtivo = conjunto && this.def.pontuais?.[conjunto] ? conjunto : null;
  }

  /** Som pontual no início do compasso ('pico' | 'vale' | null). Pode sobrepor a cauda do anterior. */
  dispararPontual(tipo, tempo) {
    const buf = tipo && this.pontualAtivo && this.ligada ? this.pontuais[this.pontualAtivo]?.[tipo] : null;
    if (!buf) return;
    const ganho = new Tone.Gain(1).connect(this.mix);
    const fonte = new Tone.ToneBufferSource(buf).connect(ganho);
    const voz = { fonte, ganho, pontual: true };
    fonte.onended = () => { ganho.dispose(); this.soandoPontuais = this.soandoPontuais.filter((v) => v !== voz); };
    fonte.start(tempo);
    (this.soandoPontuais ??= []).push(voz);
  }

  /** As caudas dos compassos que já estão soando somem em SOLTAR segundos. */
  soltar(tempo) {
    for (const { fonte, ganho } of this.soando) {
      ganho.gain.cancelScheduledValues(tempo);
      ganho.gain.setValueAtTime(ganho.gain.getValueAtTime(tempo), tempo);
      ganho.gain.linearRampToValueAtTime(0, tempo + SOLTAR);
      try { fonte.stop(tempo + SOLTAR + 0.02); } catch { /* já parou */ }
    }
  }

  /** Pausa, fita: corta o que estiver soando fora do relógio. */
  silenciar() {
    const agora = Tone.now();
    this.soltar(agora);
    this.pararLoops(agora, 0.1);
    for (const { fonte, ganho } of this.soandoPontuais ?? []) {
      ganho.gain.rampTo(0, 0.1, agora);
      try { fonte.stop(agora + 0.12); } catch { /* já parou */ }
    }
  }

  /** Desligada: some em 0,4 s e os loops param. Religada com a música andando: volta já no ponto certo. */
  definirLigada(ligada) {
    this.ligada = ligada;
    const agora = Tone.now();
    this.saida.gain.rampTo(ligada ? 1 : 0, 0.4);
    if (!ligada) {
      this.soltar(agora);
      this.pararLoops(agora + 0.4);
    } else if (this.ultimo !== undefined && Tone.getContext().transport.state === 'started') {
      this.definirPosicao(this.ultimo, agora);
    }
  }
}
