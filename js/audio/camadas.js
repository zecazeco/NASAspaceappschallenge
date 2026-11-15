// As camadas da trilha e como cada uma toca os arquivos do músico.
//
// O código nunca mexe no som (filtro, afinação, tempo): só escolhe qual arquivo toca e liga ou desliga.
//   • 'compassos' (temperatura): 7 figuras (parado, sobe/desce pequena/média/grande) que começam e voltam
//     para a mesma nota, escolhidas pela mudança até o ano seguinte (trilha.movimento). Cada ano toca o
//     arquivo inteiro do início do compasso; a cauda some quando o compasso seguinte começa.
//   • 'niveis' (tendência): 4 loops de 1 compasso; o nível do ano decide qual se ouve
//     (com troca suave; posição quebrada, ex. 1,4, mistura dois níveis). A tendência é o segundo som da
//     temperatura (média de 11 anos em 4 níveis): não tem seletor nem linha própria, liga junto com ela.
//   • 'vozes' (CO₂): 5 loops de 4 compassos que se acumulam; o ano liga da 1ª até a voz dele, na ordem de
//     def.ordem (os números dos arquivos): 1, 2, 4, 5, 3. A voz 3 (o Ré bem grave) entra por último, quando o
//     CO₂ já passou de 400 ppm, e a 4 e a 5 (a tensão) entram antes.
//   • 'troca' (chuva): 4 loops de 1 compasso, um por tipo de mudança até o ano seguinte (trilha.sons).
//     O som novo entra rápido (a gota do começo fica inteira) e o anterior some devagar.
// Loops só tocam enquanto podem ser ouvidos. Quando um entra, começa no ponto certo do relógio (como se
// tivesse tocado desde o início), então as frases ficam sempre alinhadas.
//
// Fim da música (o compasso de 2023): a tendência (fim: 'sustenta') some devagar ao longo do compasso
// inteiro; o CO₂ toca só a voz 3 do começo (a nota grave do 1º tempo), igual em toda cidade, e some com uma
// curva suave antes da nota seguinte dela (passa do compasso de 2023: a música espera ele terminar); os outros (melodia, chuva) tocam só o 1º tempo e
// somem antes do 2º. Quando 2024 chegaria, a música para.
//
// Sons pontuais da temperatura (teste; volumes em volumePontualDb): picos e vales (sobe/desce), recorde de calor (alerta) e troca de faixa
// da tendência (sino). Ligados de saída; o seletor de teste no topo da página pode desligá-los.
// CO₂ (teste), os dois a −14 dB (trilha.virada.co2): co2_pontual_cresce em cada ano em que a faixa das vozes muda;
// co2_pontual_impacto em cada recorde de velocidade (o CO₂ subiu mais que em qualquer ano anterior).
//
// Arquivos: primeiro audio/<pasta>/<nome>.mp3 ou .wav (os do músico); se não existir,
// audio/provisorio/<nome>.wav (gerados por tools/gerar-sons-provisorios.mjs).

import { NIVEIS, FIGURAS_MOVIMENTO, VOZES_CO2 } from '../trilha.js';

export const DEFINICAO = {
  co2: { pasta: 'co2', prefixo: 'co2', modo: 'vozes', quantas: VOZES_CO2,
    volumeDb: -2,   // a camada toda (vozes e final), somado aos ajustes abaixo (voz 5); os pontuais não mudam
    ordem: [1, 2, 4, 5, 3],   // co2_voz_N na ordem em que entram (com os dados da NOAA: 1959, 1980, 1994, 2005 e 2015)
    volumeVozDb: { 5: -1.5 },   // ajuste de volume por arquivo (co2_voz_N → dB); as outras vozes no volume do arquivo
    fim: { voz: 4, ate: 4.2 },   // no fim: só a última a entrar (co2_voz_3), do começo do arquivo; some até 4,2 s (a nota seguinte dela entra em 4,36 s)
    pontuais: { pontual: ['cresce', 'impacto'] }, pontualPadrao: 'pontual', volumePontualDb: -14 },
  temperatura: { pasta: 'temperatura', prefixo: 'temp', modo: 'compassos', figuras: FIGURAS_MOVIMENTO,
    volumeDb: 1,    // a melodia toda, somado ao reforço por nível; os pontuais não mudam
    pontuais: { pontual: ['alerta', 'sino', 'sobe', 'desce'] }, pontualPadrao: 'pontual',   // ver trilha.virada
    volumePontualDb: { sobe: 0, desce: 0, sino: -16, alerta: -20 },   // sobe e desce a 0 dB: TESTE, para ouvir bem
    // a melodia fica mais forte a cada nível da tendência (1 a 4), para não sumir debaixo da tendência e do
    // CO₂, que ficam mais tensos no fim; a troca é sempre com fade (REFORCO_FADE), no início do ano em que o nível muda
    reforcoPorNivelDb: [0, 1.5, 3, 6] },
  tendencia: { pasta: 'tendencia', prefixo: 'tend', modo: 'niveis', volume: 0.4, volumeDb: -2, fim: 'sustenta' },   // 60% mais baixa que as outras, e mais 2 dB
  chuva: { pasta: 'chuva', prefixo: 'chuva', modo: 'troca', entra: 0.015, sai: 0.3 },   // s (constantes de tempo)
};

/** Arquivos da camada, na ordem: { nome, k }. */
const nomesDaCamada = (d) => {
  if (d.modo === 'compassos') return d.figuras.map((fig, k) => ({ nome: `${d.prefixo}_${fig}`, k }));
  if (d.modo === 'vozes') return Array.from({ length: d.quantas }, (_, k) => ({ nome: `${d.prefixo}_voz_${d.ordem?.[k] ?? k + 1}`, k }));
  return Array.from({ length: NIVEIS }, (_, k) => ({ nome: `${d.prefixo}_base_${k + 1}`, k }));
};

/** Sons pontuais da camada: { nome, conjunto, tipo } (ex.: temp_pontual_sino). */
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
/** Volume da camada: VOLUME_BASE × def.volume × def.volumeDb (em dB). */
const volumeDaCamada = (def) => VOLUME_BASE * (def.volume ?? 1) * Tone.dbToGain(def.volumeDb ?? 0);
const SOLTAR = 0.6;        // s: quando o compasso seguinte começa, a cauda do anterior some nesse tempo
const REFORCO_FADE = 2;    // s: fade da troca de volume da melodia (reforcoPorNivelDb), quase 1 compasso

export class Camada {
  constructor(id) {
    this.id = id;
    this.def = DEFINICAO[id];
    this.saida = new Tone.Gain(1);
    this.mix = new Tone.Gain(volumeDaCamada(this.def)).connect(this.saida);   // def.volume / def.volumeDb: ajuste da camada
    this.ligada = true;
    this.loops = [];       // modos 'niveis', 'vozes' e 'troca': { buf, ganho, fonte } (criarLoop)
    this.buffers = [];     // modo 'compassos': um buffer por figura
    this.soando = [];      // modo 'compassos': { fonte, ganho } ainda tocando
    this.pontuais = {};    // conjunto → { pico: buffer, vale: buffer }
    this.pontualAtivo = this.def.pontualPadrao ?? null;   // ex.: 'pontual'; null = sem pontual
  }

  /** Baixa os arquivos da camada; aoArquivo() é chamado a cada arquivo pronto (para o progresso). */
  async carregar(aoArquivo = () => {}) {
    const { pasta } = this.def;
    await Promise.all([...nomesDaCamada(this.def).map(({ nome, k }) => carregarSom(pasta, nome).then((buf) => {
      this.guardar(k, buf);
      aoArquivo();
    })), ...pontuaisDaCamada(this.def).map(({ nome, conjunto, tipo }) => carregarSom(pasta, nome).then((buf) => {
      (this.pontuais[conjunto] ??= {})[tipo] = buf;
      aoArquivo();
    }))]);
  }

  guardar(k, buf) {
    if (this.def.modo === 'compassos') this.buffers[k] = buf;
    else if (this.loops[k]) this.loops[k].buf = buf;
    else this.loops[k] = this.criarLoop(buf);
  }

  /** Sons obrigatórios (não os pontuais, que são opcionais) que não baixaram. */
  faltando() {
    return nomesDaCamada(this.def)
      .filter(({ k }) => !(this.def.modo === 'compassos' ? this.buffers[k] : this.loops[k]?.buf))
      .map(({ nome }) => nome);
  }

  /** Tenta de novo os sons obrigatórios que não baixaram. */
  async recarregarFaltando() {
    const falta = new Set(this.faltando());
    await Promise.all(nomesDaCamada(this.def).filter(({ nome }) => falta.has(nome))
      .map(({ nome, k }) => carregarSom(this.def.pasta, nome).then((buf) => this.guardar(k, buf))));
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
      if (modo === 'vozes') {
        const n = this.def.ordem?.[i] ?? i + 1;   // número do arquivo co2_voz_N
        this.ajustarLoop(l, pos != null && i <= pos ? Tone.dbToGain(this.def.volumeVozDb?.[n] ?? 0) : 0, tempo, tau);
      }
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

  /**
   * Fim da música, no início do último compasso (`tempo`, já com o som do ano disparado). dur = 1 compasso,
   * umTempo = 1 tempo. Sustentados: somem ao longo do compasso. Os outros: só o 1º tempo, sumindo até o 2º.
   * Devolve até quando esta camada ainda soa (s, tempo do áudio).
   */
  encerrar(tempo, dur, umTempo) {
    const g = this.saida.gain, v = g.getValueAtTime(tempo), fim = this.def.fim;
    g.cancelScheduledValues(tempo);
    g.setValueAtTime(v, tempo);
    if (fim?.voz != null) {
      // só a voz escolhida, tocada do começo do arquivo (não do ponto do loop), com as outras cortadas
      for (const l of this.loops) this.ajustarLoop(l, 0, tempo, 0.01);
      const buf = this.loops[fim.voz]?.buf;
      if (!buf || !this.ligada) return tempo;
      const d = fim.ate;
      const fonte = new Tone.ToneBufferSource(buf).connect(this.mix);
      fonte.onended = () => fonte.dispose();
      fonte.start(tempo);
      fonte.stop(tempo + d + 0.02);
      this.fonteFinal = fonte;
      // curva suave (cosseno): segura a nota no começo, cai no meio e pousa em zero sem degrau
      g.setValueCurveAtTime(Array.from({ length: 64 }, (_, i) => v * (0.5 + 0.5 * Math.cos((Math.PI * i) / 63))), tempo, d);
      return tempo + d;
    }
    if (fim === 'sustenta') { g.setTargetAtTime(0, tempo, dur / 5); return tempo + dur; }   // ~1% no fim do compasso
    g.setTargetAtTime(0, tempo, umTempo / 5);                                             // ~1% quando chega o 2º tempo
    return tempo + umTempo;
  }

  /** Quando 2024 chegaria: corta o que restou (já está quase em silêncio). */
  parar(tempo) {
    this.soltar(tempo);
    this.pararLoops(tempo, 0.01);
  }

  /** Depois do fim (tocar de novo): a camada volta ao volume dela. */
  restaurar() {
    const g = this.saida.gain, agora = Tone.now();
    g.cancelScheduledValues(agora);
    g.setValueAtTime(this.ligada ? 1 : 0, agora);
  }

  /** Teste: qual conjunto de sons pontuais toca (null = sem pontual). */
  definirPontual(conjunto) {
    this.pontualAtivo = conjunto && this.def.pontuais?.[conjunto] ? conjunto : null;
  }

  /** Som(ns) pontual(is) no início do compasso (ex.: 'sino', ['desce', 'alerta'], 'impacto'; null = nada). Pode sobrepor a cauda do anterior. */
  dispararPontual(tipo, tempo) {
    if (Array.isArray(tipo)) { for (const t of tipo) this.dispararPontual(t, tempo); return; }
    const buf = tipo && this.pontualAtivo && this.ligada ? this.pontuais[this.pontualAtivo]?.[tipo] : null;
    if (!buf) return;
    // volumePontualDb: um número (todos os pontuais da camada) ou { tipo: dB }
    const vol = this.def.volumePontualDb, db = typeof vol === 'object' ? vol[tipo] : vol;
    // direto na saída da camada (não pelo mix): o volumeDb da camada e o reforço da melodia não mudam os pontuais
    const ganho = new Tone.Gain(VOLUME_BASE * (this.def.volume ?? 1) * Tone.dbToGain(db ?? 0)).connect(this.saida);
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
    try { this.fonteFinal?.stop(agora + 0.1); } catch { /* já parou */ }
    for (const { fonte, ganho } of this.soandoPontuais ?? []) {
      ganho.gain.rampTo(0, 0.1, agora);
      try { fonte.stop(agora + 0.12); } catch { /* já parou */ }
    }
  }

  /** Reforço de volume da camada (def.reforcoPorNivelDb[nivel]); muda com fade a partir de `tempo`. */
  definirReforco(nivel, tempo) {
    const db = this.def.reforcoPorNivelDb?.[nivel] ?? 0;
    if (db === this.reforcoDb) return;
    this.reforcoDb = db;
    const g = this.mix.gain, alvo = volumeDaCamada(this.def) * Tone.dbToGain(db);
    g.cancelScheduledValues(tempo);
    g.setValueAtTime(g.getValueAtTime(tempo), tempo);
    g.linearRampToValueAtTime(alvo, tempo + REFORCO_FADE);
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
