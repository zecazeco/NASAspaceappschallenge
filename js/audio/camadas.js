// As 4 camadas da trilha.
//
// Dois jeitos de tocar a base:
//   • 'niveis' (CO₂, chuva, vegetação): 4 loops de 1 compasso tocando juntos, sincronizados;
//     o código só ajusta qual nível se ouve (volume). Não mexe em filtro, afinação nem tempo.
//   • 'compassos' (temperatura): 6 compassos diferentes, do mais frio ao mais
//     quente; a cada ano toca o compasso inteiro que o dado daquele ano escolheu, começando
//     exatamente no início do compasso. A melodia nasce da sequência dos anos.
//     EM TESTE: duas bases, trocadas pelo seletor no topo da página (na versão final fica só uma):
//       Base01 = 4 semínimas; cada compasso é um arquivo tocado do início (com cauda).
//       Base02 = 1 nota sustentada; os 6 arquivos são LOOPS que tocam juntos e o código só abre o
//                do ano, então a mesma nota repetida em anos seguidos continua sem novo ataque.
//       Base03 = 2 mínimas ligadas; como a Base01, cada compasso é um arquivo tocado do início.
//
// Sons pontuais: tirados, exceto o teste da
// temperatura (Pontual01: picos e vales da linha), ligado pelo seletor no topo da página.
//
// Arquivos: primeiro audio/<pasta>/<nome>.wav (os do músico); se não existir,
// audio/provisorio/<nome>.wav (gerados por tools/gerar-sons-provisorios.mjs).

import { NIVEIS, COMPASSOS_TEMP } from '../trilha.js';

export const DEFINICAO = {
  co2: { pasta: 'co2', prefixo: 'co2', modo: 'niveis' },
  temperatura: { pasta: 'temperatura', prefixo: 'temp', modo: 'compassos', quantos: COMPASSOS_TEMP, bases: ['base01', 'base02', 'base03'], continuas: ['base02'],
    pontuais: { pontual01: ['pico', 'vale'] } },
  chuva: { pasta: 'chuva', prefixo: 'chuva', modo: 'niveis' },
  vegetacao: { pasta: 'vegetacao', prefixo: 'veg', modo: 'niveis' },
};

/** Arquivos da camada, na ordem: { nome, base, k } (base só no modo 'compassos'). */
const nomesDaCamada = (d) => (d.modo === 'compassos'
  ? d.bases.flatMap((base) => Array.from({ length: d.quantos }, (_, k) => ({ nome: `${d.prefixo}_${base}_compasso_${k + 1}`, base, k })))
  : Array.from({ length: NIVEIS }, (_, k) => ({ nome: `${d.prefixo}_base_${k + 1}`, k })));

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
  for (const [url, tipo] of [[`audio/${pasta}/${nome}.wav`, 'musico'], [`audio/provisorio/${nome}.wav`, 'provisorio']]) {
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
    this.bases = [];       // modo 'niveis': { player, ganho }
    this.buffers = {};     // modo 'compassos': base → [um buffer por compasso]
    this.baseAtiva = this.def.bases?.[0] ?? null;
    this.soando = [];      // modo 'compassos': { fonte, ganho } ainda tocando
    this.continuas = {};   // modo 'compassos', bases contínuas: base → [{ player, ganho }]
    this.pontuais = {};    // conjunto → { pico: buffer, vale: buffer }
    this.pontualAtivo = null;   // ex.: 'pontual01'; null = sem pontual
  }

  /** Baixa os arquivos da camada; aoArquivo() é chamado a cada arquivo pronto (para o progresso). */
  async carregar(aoArquivo = () => {}) {
    const { pasta } = this.def;
    await Promise.all([...nomesDaCamada(this.def).map(({ nome, base, k }) => carregarSom(pasta, nome).then((buf) => {
      if (this.def.continuas?.includes(base)) {
        const ganho = new Tone.Gain(0).connect(this.mix);
        const player = buf ? new Tone.Player({ url: buf, loop: true }).connect(ganho) : null;
        (this.continuas[base] ??= [])[k] = { player, ganho };
      } else if (this.def.modo === 'compassos') (this.buffers[base] ??= [])[k] = buf;
      else {
        const ganho = new Tone.Gain(0).connect(this.mix);
        const player = buf ? new Tone.Player({ url: buf, loop: true }).connect(ganho) : null;
        this.bases[k] = { player, ganho };
      }
      aoArquivo();
    })), ...pontuaisDaCamada(this.def).map(({ nome, conjunto, tipo }) => carregarSom(pasta, nome).then((buf) => {
      (this.pontuais[conjunto] ??= {})[tipo] = buf;
      aoArquivo();
    }))]);
  }

  /** Os loops andam presos ao relógio: começam no compasso 0 e pausam junto com ele. */
  iniciar() {
    for (const b of this.bases) b.player?.sync().start(0);
    for (const lista of Object.values(this.continuas)) for (const b of lista) b.player?.sync().start(0);
  }

  /**
   * Modo 'niveis': ajusta o volume dos níveis, posição 0..3 (ex.: 1,4 = 60% nível 2 + 40% nível 3).
   * Troca por potência constante, para o volume total não afundar no meio. null = silêncio.
   */
  definirPosicao(pos, tempo, rampa = RAMPA_NIVEL) {
    this.bases.forEach((b, i) => {
      const d = pos == null ? 1 : Math.abs(pos - i);
      const g = d >= 1 ? 0 : Math.cos((d * Math.PI) / 2);
      b.ganho.gain.cancelScheduledValues(tempo);
      b.ganho.gain.setTargetAtTime(g, tempo, rampa / 3);
    });
  }

  /**
   * Modo 'compassos': toca o compasso k (0 = mais frio) a partir de `tempo` (início do compasso).
   * O arquivo pode ter cauda depois do compasso; ela some quando o próximo compasso começa.
   */
  tocarCompasso(k, tempo) {
    this.soltar(tempo);
    // bases contínuas: abre só o loop do compasso k da base ativa (troca rápida, sem novo ataque)
    for (const [base, lista] of Object.entries(this.continuas)) {
      lista.forEach((b, i) => {
        const g = base === this.baseAtiva && i === k ? 1 : 0;
        b.ganho.gain.cancelScheduledValues(tempo);
        b.ganho.gain.setTargetAtTime(g, tempo, TROCA_CONTINUA);
      });
    }
    if (this.continuas[this.baseAtiva]) return;
    const buf = k == null ? null : this.buffers[this.baseAtiva]?.[k];
    if (!buf) return;
    const ganho = new Tone.Gain(1).connect(this.mix);
    const fonte = new Tone.ToneBufferSource(buf).connect(ganho);
    const voz = { fonte, ganho };
    fonte.onended = () => { ganho.dispose(); this.soando = this.soando.filter((v) => v !== voz); };
    fonte.start(tempo);
    this.soando.push(voz);
  }

  /** Modo 'compassos' (teste): qual base toca a partir do próximo compasso. */
  definirBase(base) {
    if (this.def.bases?.includes(base)) this.baseAtiva = base;
  }

  /** Teste: qual conjunto de sons pontuais toca (null = sem pontual). */
  definirPontual(conjunto) {
    this.pontualAtivo = conjunto && this.def.pontuais?.[conjunto] ? conjunto : null;
  }

  /** Som pontual no início do compasso ('pico' | 'vale' | null). Pode sobrepor a cauda do anterior. */
  dispararPontual(tipo, tempo) {
    const buf = tipo && this.pontualAtivo ? this.pontuais[this.pontualAtivo]?.[tipo] : null;
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
    for (const { fonte, ganho } of this.soandoPontuais ?? []) {
      ganho.gain.rampTo(0, 0.1, agora);
      try { fonte.stop(agora + 0.12); } catch { /* já parou */ }
    }
  }

  definirLigada(ligada) {
    this.ligada = ligada;
    this.saida.gain.rampTo(ligada ? 1 : 0, 0.4);
  }
}
