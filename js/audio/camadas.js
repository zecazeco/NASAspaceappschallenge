// As 4 camadas da trilha.
//
// Dois jeitos de tocar a base:
//   • 'niveis' (CO₂, chuva, vegetação): 4 loops de 1 compasso; o código só ajusta qual nível se ouve
//     (volume). Não mexe em filtro, afinação nem tempo.
//     Só toca o loop que pode ser ouvido. Quando ele entra, começa no ponto certo do relógio (como se
//     tivesse tocado desde o início), então as frases das vozes ficam sempre alinhadas entre si.
//   • 'compassos' (temperatura): 6 compassos diferentes, do mais frio ao mais
//     quente; a cada ano toca o compasso inteiro que o dado daquele ano escolheu, começando
//     exatamente no início do compasso. A melodia nasce da sequência dos anos.
//     EM TESTE: duas bases, trocadas pelo seletor no topo da página (na versão final fica só uma):
//       Base01 = 4 semínimas; cada compasso é um arquivo tocado do início (com cauda).
//       Base02 = 1 nota sustentada; os 6 arquivos são LOOPS; só o do ano toca (os outros ficam parados)
//                e a mesma nota repetida em anos seguidos continua sem novo ataque.
//       Base03 = 2 mínimas ligadas; como a Base01, cada compasso é um arquivo tocado do início.
//       Base04 = movimento: 7 figuras (parado, sobe/desce pequena/média/grande) que começam e voltam
//                para a mesma nota; escolhidas pela mudança até o ano seguinte (trilha.movimento).
//       Base05 = os mesmos 7 sons da Base04, escolhidos pela mudança desde o ano anterior.
//
// Sons pontuais: tirados, exceto o teste da
// temperatura (Pontual01: picos e vales da linha), ligado pelo seletor no topo da página.
//
// Arquivos: primeiro audio/<pasta>/<nome>.mp3 ou .wav (os do músico); se não existir,
// audio/provisorio/<nome>.wav (gerados por tools/gerar-sons-provisorios.mjs).

import { NIVEIS, COMPASSOS_TEMP, FIGURAS_MOVIMENTO, VOZES_CO2 } from '../trilha.js';

export const DEFINICAO = {
  // EM TESTE: Base01 = 4 níveis completos trocados por volume (como a chuva);
  // Base02 = 5 vozes que se acumulam (co2_voz_1..5): o nível do ano liga a voz 1 até a voz dele.
  co2: { pasta: 'co2', prefixo: 'co2', modo: 'niveis', bases: ['base01', 'base02'], vozes: { base02: VOZES_CO2 } },
  temperatura: { pasta: 'temperatura', prefixo: 'temp', modo: 'compassos', quantos: COMPASSOS_TEMP, bases: ['base01', 'base02', 'base03', 'base04', 'base05'], continuas: ['base02'],
    figuras: { base04: FIGURAS_MOVIMENTO, base05: FIGURAS_MOVIMENTO }, mesmosSons: { base05: 'base04' },
    semBaseNoNome: ['base04'],   // a base escolhida: arquivos do músico sem o nome da base (temp_sobe_pequena.wav)
    pontuais: { pontual01: ['pico', 'vale'] } },
  tendencia: { pasta: 'tendencia', prefixo: 'tend', modo: 'niveis' },   // EM TESTE: tendência da temperatura (toca junto com a Base04)
  chuva: { pasta: 'chuva', prefixo: 'chuva', modo: 'niveis' },
  vegetacao: { pasta: 'vegetacao', prefixo: 'veg', modo: 'niveis' },
};

/** Arquivos da camada, na ordem: { nome, base, k } (base só no modo 'compassos'). */
const nomesDaCamada = (d) => (d.modo === 'compassos'
  ? d.bases.filter((base) => !d.mesmosSons?.[base]).flatMap((base) => (d.figuras?.[base] ?? Array.from({ length: d.quantos }, (_, k) => `compasso_${k + 1}`))
    .map((fig, k) => ({ nome: d.semBaseNoNome?.includes(base) ? `${d.prefixo}_${fig}` : `${d.prefixo}_${base}_${fig}`, base, k })))
  : [...Array.from({ length: NIVEIS }, (_, k) => ({ nome: `${d.prefixo}_base_${k + 1}`, k })),
    ...Object.values(d.vozes ?? {}).flatMap((n) => Array.from({ length: n }, (_, k) => ({ nome: `${d.prefixo}_voz_${k + 1}`, k, voz: true })))]);

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

const RAMPA_NIVEL = 0.6;   // s: troca suave de volume entre níveis no início do compasso
const VOLUME_BASE = 0.5;   // −6 dB (mesmo equilíbrio entre camadas de antes)
const SOLTAR = 0.6;
const TROCA_CONTINUA = 0.03; // s (constante de tempo): troca de nota nas bases contínuas, ~0,1 s        // s: quando o compasso seguinte começa, a cauda do anterior some nesse tempo

export class Camada {
  constructor(id) {
    this.id = id;
    this.def = DEFINICAO[id];
    this.saida = new Tone.Gain(1);
    this.mix = new Tone.Gain(VOLUME_BASE).connect(this.saida);
    this.ligada = true;
    this.bases = [];       // modo 'niveis': { buf, ganho, fonte } (criarLoop)
    this.buffers = {};     // modo 'compassos': base → [um buffer por compasso]
    this.baseAtiva = this.def.bases?.[0] ?? null;
    this.soando = [];      // modo 'compassos': { fonte, ganho } ainda tocando
    this.continuas = {};   // modo 'compassos', bases contínuas: base → [loop]
    this.vozes = [];       // modo 'niveis' com vozes (CO₂ Base02): só tocam as vozes que entraram
    this.pontuais = {};    // conjunto → { pico: buffer, vale: buffer }
    this.pontualAtivo = null;   // ex.: 'pontual01'; null = sem pontual
  }

  /** Baixa os arquivos da camada; aoArquivo() é chamado a cada arquivo pronto (para o progresso). */
  async carregar(aoArquivo = () => {}) {
    const { pasta } = this.def;
    await Promise.all([...nomesDaCamada(this.def).map(({ nome, base, k, voz }) => carregarSom(pasta, nome).then((buf) => {
      if (voz) this.vozes[k] = this.criarLoop(buf);
      else if (this.def.continuas?.includes(base)) (this.continuas[base] ??= [])[k] = this.criarLoop(buf);
      else if (this.def.modo === 'compassos') (this.buffers[base] ??= [])[k] = buf;
      else this.bases[k] = this.criarLoop(buf);
      aoArquivo();
    })), ...pontuaisDaCamada(this.def).map(({ nome, conjunto, tipo }) => carregarSom(pasta, nome).then((buf) => {
      (this.pontuais[conjunto] ??= {})[tipo] = buf;
      aoArquivo();
    }))]);
  }

  /** Loop: { buf, ganho, fonte }. fonte só existe enquanto ele pode ser ouvido. */
  criarLoop(buf) { return { buf, ganho: new Tone.Gain(0).connect(this.mix), fonte: null }; }

  todosOsLoops() { return [...this.bases, ...this.vozes, ...Object.values(this.continuas).flat()]; }

  /**
   * Leva o loop ao volume g a partir de `tempo` (rampa em s). Volume 0 (ou camada desligada): o loop
   * some e PARA de tocar. Volume > 0 e parado: começa no ponto do relógio (segundos desde o início
   * da música, dando a volta no tamanho do arquivo), como se nunca tivesse parado.
   */
  ajustarLoop(l, g, tempo, rampa) {
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
      l.ganho.gain.setTargetAtTime(g, tempo, rampa / 3);
    } else if (l.fonte) {
      l.ganho.gain.setTargetAtTime(0, tempo, rampa / 3);
      const f = l.fonte;
      l.fonte = null;
      f.onended = () => f.dispose();
      f.stop(tempo + rampa * 2);
    }
  }

  /** Para todos os loops (pausa, fita, fim). */
  pararLoops(tempo, rampa = 0.1) { for (const l of this.todosOsLoops()) this.ajustarLoop(l, 0, tempo, rampa); }

  /**
   * Modo 'niveis': ajusta o volume dos níveis, posição 0..3 (ex.: 1,4 = 60% nível 2 + 40% nível 3).
   * Troca por potência constante, para o volume total não afundar no meio. null = silêncio.
   */
  definirPosicao(pos, tempo, rampa = RAMPA_NIVEL, voz = null) {
    this.ultimo = { pos, voz };
    const comVozes = !!this.def.vozes?.[this.baseAtiva];
    this.bases.forEach((b, i) => {
      const d = pos == null || comVozes ? 1 : Math.abs(pos - i);
      this.ajustarLoop(b, d >= 1 ? 0 : Math.cos((d * Math.PI) / 2), tempo, rampa);
    });
    // vozes que se acumulam: da voz 1 até a voz do ano, todas inteiras (o código só liga e desliga)
    this.vozes.forEach((b, i) => this.ajustarLoop(b, comVozes && voz != null && i <= voz ? 1 : 0, tempo, rampa));
  }

  /**
   * Modo 'compassos': toca o compasso k (0 = mais frio) a partir de `tempo` (início do compasso).
   * O arquivo pode ter cauda depois do compasso; ela some quando o próximo compasso começa.
   */
  tocarCompasso(k, tempo) {
    this.soltar(tempo);
    // bases contínuas: abre só o loop do compasso k da base ativa (troca rápida, sem novo ataque)
    for (const [base, lista] of Object.entries(this.continuas)) {
      lista.forEach((b, i) => this.ajustarLoop(b, base === this.baseAtiva && i === k ? 1 : 0, tempo, TROCA_CONTINUA * 3));
    }
    if (this.continuas[this.baseAtiva] || !this.ligada) return;
    const buf = k == null ? null : this.buffers[this.def.mesmosSons?.[this.baseAtiva] ?? this.baseAtiva]?.[k];
    if (!buf) return;
    const ganho = new Tone.Gain(1).connect(this.mix);
    const fonte = new Tone.ToneBufferSource(buf).connect(ganho);
    const voz = { fonte, ganho };
    fonte.onended = () => { ganho.dispose(); this.soando = this.soando.filter((v) => v !== voz); };
    fonte.start(tempo);
    this.soando.push(voz);
  }

  /** A base ativa escolhe pela mudança entre anos (Base04: até o seguinte; Base05: desde o anterior), e não pela altura do ano. */
  usaMovimento() { return !!this.def.figuras?.[this.baseAtiva]; }

  /** Teste: qual base toca a partir do próximo compasso (temperatura e CO₂). */
  definirBase(base) {
    if (this.def.bases?.includes(base)) this.baseAtiva = base;
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
    this.pararLoops(agora, 0.3);
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
      for (const l of this.todosOsLoops()) this.ajustarLoop(l, 0, agora + 0.4, 0.1);
    } else if (this.ultimo && Tone.getContext().transport.state === 'started') {
      this.definirPosicao(this.ultimo.pos, agora, RAMPA_NIVEL, this.ultimo.voz);
    }
  }
}
