// Motor de som: liga as 4 camadas, o relógio musical (transport) e o efeito de fita.
// Andamento FIXO: 110 BPM, 4 tempos por compasso, 1 compasso = 1 ano.

import { ARQUIVOS, carregarBuffer } from './arquivos.js';
import { Camada, nomesDosArquivos } from './camadas.js';

export const BPM = 110;

// IMPORTANTE: Tone.Transport e Tone.Draw apontam para o contexto PADRÃO do Tone, criado antes
// do setContext abaixo. O relógio certo é o do contexto em uso (o mesmo que posiciona os loops das camadas).
const transporte = () => Tone.getContext().transport;

// Usa um AudioContext NATIVO: o wrapper padrão do Tone (standardized-audio-context)
// recusa AudioWorkletNodes customizados, e a fita precisa de um.
try {
  const Nativo = window.AudioContext || window.webkitAudioContext;
  Tone.setContext(new Tone.Context(new Nativo({ latencyHint: 'playback' })));
} catch (e) { console.warn('Usando o contexto padrão do Tone.', e); }

export class Motor {
  constructor() {
    this.dims = { co2: new Camada('co2'), temperatura: new Camada('temperatura'), tendencia: new Camada('tendencia'), chuva: new Camada('chuva') };
    this.idx = 0;
    this.nPassos = 1;
    this.trilha = null;         // níveis e compassos da cidade (trilha.js)
    this.tocando = false;
    this.emFita = false;
    this.pularAvanco = true;
    this.aoMudarPasso = () => {}; // (idx, {narrar}) → interface
    this.aoTerminar = () => {};   // a música chegou ao fim (hoje) → interface
    this.terminou = false;
  }

  /**
   * Cria a cadeia e baixa os sons. Roda em SEGUNDO PLANO, antes do toque do usuário:
   * a pessoa segue autorizando o GPS ou escolhendo a cidade enquanto os sons chegam.
   * aoProgresso(0..1) conta arquivo por arquivo.
   */
  async preparar(nPassos, aoProgresso = () => {}) {
    this.nPassos = nPassos;
    const total = nomesDosArquivos().length + 4;   // + reverb e 3 efeitos de fita
    let feitos = 0;
    const umArquivo = () => aoProgresso(Math.min(1, ++feitos / total));
    // cadeia: dimensões → música → (reverb) → volume → duck → pausa → filtroFita → audível → limitador
    this.limitador = new Tone.Limiter(-1).toDestination();
    this.audivel = new Tone.Gain(1).connect(this.limitador);
    this.filtroFita = new Tone.Filter(20000, 'lowpass').connect(this.audivel);
    this.pausa = new Tone.Gain(0).connect(this.filtroFita);
    this.duck = new Tone.Gain(1).connect(this.pausa);
    this.volume = new Tone.Gain(0.8).connect(this.duck);
    this.musica = new Tone.Gain(1).connect(this.volume);
    this.efeitos = new Tone.Gain(0.9).connect(this.limitador);

    const ir = await carregarBuffer(ARQUIVOS.ir);
    umArquivo();
    this.reverb = ir ? new Tone.Convolver(ir) : new Tone.Reverb({ decay: 6, preDelay: 0.03 });
    this.reverb.connect(this.volume);
    this.envioReverb = new Tone.Gain(0.35).connect(this.reverb);
    this.musica.connect(this.envioReverb);

    await Promise.all(Object.values(this.dims).map(async (d) => {
      await d.carregar(umArquivo);
      d.saida.connect(this.musica);
    }));
    await this.prepararFita();
    feitos = total - 1;
    aoProgresso(1);
    if (this.reverb.ready) await this.reverb.ready;
  }

  /** Sons obrigatórios das camadas que não baixaram (fita, reverb e pontuais são opcionais: têm substituto). */
  sonsFaltando() { return Object.values(this.dims).flatMap((d) => d.faltando()); }
  /** Tenta baixar de novo os sons obrigatórios que faltaram. */
  async recarregarFaltando() { await Promise.all(Object.values(this.dims).map((d) => d.recarregarFaltando())); }

  async prepararFita() {
    const F = ARQUIVOS.fita;
    const [rebobinar, tic, tapeStart] = await Promise.all([carregarBuffer(F.rebobinar), carregarBuffer(F.tic), carregarBuffer(F.tapeStart)]);
    this.gChiado = new Tone.Gain(0).connect(this.efeitos);
    if (rebobinar) this.chiado = new Tone.Player({ url: rebobinar, loop: true }).connect(this.gChiado);
    else {
      const af = new Tone.AutoFilter({ frequency: 7, baseFrequency: 900, octaves: 2.5, depth: 0.7 }).connect(this.gChiado).start();
      this.chiado = new Tone.Noise({ type: 'pink', volume: -30 }).connect(af);
    }
    // tic discreto: −12 dB (¼ do volume original) e meia oitava mais grave (playbackRate 0,7)
    if (tic) this.tic = new Tone.Player({ url: tic, volume: -12, playbackRate: 0.7 }).connect(this.efeitos);
    else this.tic = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 }, volume: -22 }).connect(this.efeitos);
    this.tapeStart = tapeStart ? new Tone.Player(tapeStart).connect(this.efeitos) : null;
  }

  /** Precisa ser chamado dentro de um toque do usuário. */
  async ligar() {
    await Tone.start();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* iOS: ignora a chave de silencioso */ }
    try {
      const ctx = Tone.getContext().rawContext;
      await ctx.audioWorklet.addModule('js/audio/fita-worklet.js');
      this.fita = new AudioWorkletNode(ctx, 'fita', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
      Tone.connect(this.pausa, this.fita);
      Tone.connect(this.fita, this.limitador);
    } catch (e) {
      console.warn('AudioWorklet indisponível: o rebobinar terá só o chiado.', e);
      this.fita = null;
    }
    this.chiado.start();
    transporte().bpm.value = BPM;
    transporte().timeSignature = 4;
    transporte().scheduleRepeat((t) => this.aoPasso(t), '1m', 0);
  }

  // ------------------------------------------------------------------ dados
  definirTrilha(trilha) {
    this.trilha = trilha;
    if (this.tocando && !this.emFita) this.aplicarPasso(Tone.now(), false);
  }

  duracaoPasso() { return Tone.Time('1m').toSeconds(); }

  aoPasso(tempo) {
    if (this.terminou) return;   // o relógio ainda anda enquanto o fim do CO₂ soa
    let mudou = false;
    if (this.pularAvanco) { this.pularAvanco = false; mudou = true; }
    else if (this.idx < this.nPassos - 1) { this.idx++; mudou = true; }
    else { this.terminar(tempo); return; }   // o último passo (hoje) já tocou inteiro: fim
    this.inicioCompasso = tempo;          // para o gráfico saber quanto do ano já passou
    // voltou para trás no meio do fim: as camadas voltam ao volume delas
    if (this.encerrando && this.idx !== this.nPassos - 1) { Object.values(this.dims).forEach((d) => d.restaurar()); this.encerrando = false; }
    this.aplicarPasso(tempo, true);
    // último ano: a música termina dentro deste compasso (ver Camada.encerrar)
    if (this.idx === this.nPassos - 1) {
      const dur = this.duracaoPasso();
      this.fimDoSom = Math.max(...Object.values(this.dims).map((d) => d.encerrar(tempo, dur, dur / 4)));
      this.encerrando = true;
    }
    const idx = this.idx;
    // timer comum (não Draw/requestAnimationFrame): a tela e o leitor de tela acompanham
    // mesmo com a aba em segundo plano ou a tela do celular apagada
    setTimeout(() => this.aoMudarPasso(idx, { narrar: mudou }), Math.max(0, (tempo - Tone.now()) * 1000));
  }

  /**
   * Aplica o ano atual. noCompasso = true quando chamado no início exato de um compasso:
   * só aí a temperatura dispara o compasso escolhido (fora disso ele sairia fora do tempo).
   */
  aplicarPasso(tempo, noCompasso) {
    if (!this.trilha) return;
    const i = this.idx;
    for (const [id, camada] of Object.entries(this.dims)) {
      if (camada.def.modo === 'compassos') {
        if (noCompasso) {
          camada.tocarCompasso(this.trilha.movimento?.[id]?.[i], tempo);
          camada.dispararPontual(this.trilha.virada?.[id]?.[i], tempo);
        }
      }
      else camada.definirPosicao((this.trilha.som?.[id] ?? this.trilha.posicao[id])[i], tempo);
    }
  }

  // ------------------------------------------------------------------ controle
  /** Fim da viagem: a música some devagar e o relógio para. */
  terminar(tempo) {
    this.tocando = false;
    this.terminou = true;
    // o último compasso já fez o fade de cada camada: aqui corta o resto dos loops; o relógio para quando
    // o último som (a voz final do CO₂) termina
    Object.values(this.dims).forEach((d) => d.parar(tempo));
    const ate = Math.max(tempo, this.fimDoSom ?? tempo);
    this.pausa.gain.cancelScheduledValues(tempo);
    this.pausa.gain.setValueAtTime(this.pausa.gain.getValueAtTime(tempo), ate);
    this.pausa.gain.linearRampToValueAtTime(0, ate + 0.1);
    // (por timer, e só se ainda estiver no fim: se a pessoa já apertou tocar de novo, não para a música nova)
    setTimeout(() => { if (this.terminou) transporte().pause(); }, Math.max(0, (ate + 0.2 - Tone.now()) * 1000));
    // timer comum (não Tone.Draw): avisa a interface mesmo com a tela em segundo plano
    setTimeout(() => this.aoTerminar(), Math.max(0, (tempo - Tone.now()) * 1000));
  }

  tocar() {
    // depois do fim, tocar de novo recomeça em 1950
    if (this.terminou) { this.terminou = false; this.idx = 0; }
    this.tCongelado = null; this.inicioCompasso = null;   // o compasso recomeça do início
    this.tocando = true;
    Object.values(this.dims).forEach((d) => d.restaurar());   // depois do fim, as camadas voltam ao volume delas
    this.encerrando = false;
    this.pausa.gain.rampTo(1, 0.4);
    this.reiniciarRelogio();
  }

  /** Tempo contínuo em anos (ex.: 12,4 = 40% do compasso de 1962). Usado pelo gráfico. */
  tempoContinuo() {
    if (!this.tocando || this.emFita || this.inicioCompasso == null) return this.tCongelado ?? this.idx;
    const f = (Tone.now() - this.inicioCompasso) / this.duracaoPasso();
    return this.idx + Math.max(-1, Math.min(1, f));
  }

  pausar() {
    this.tCongelado = this.tempoContinuo();
    this.tocando = false;
    this.pausa.gain.rampTo(0, 0.3);
    transporte().pause('+0.3');
    Object.values(this.dims).forEach((d) => d.silenciar());
  }

  reiniciarRelogio() {
    transporte().stop();
    this.pularAvanco = true;
    transporte().start('+0.05');
  }


  definirVolume(v) { this.volume.gain.rampTo(v, 0.1); }
  /** Liga ou desliga uma camada. A tendência é o segundo som da temperatura: segue o mesmo seletor. */
  definirDimensao(id, ligada) {
    this.dims[id].definirLigada(ligada);
    if (id === 'temperatura') this.dims.tendencia.definirLigada(ligada);
  }
  abaixarParaVoz(falando) { this.duck.gain.rampTo(falando ? 0.5 : 1, 0.25); }

  // ------------------------------------------------------------------ fita
  iniciarFita(direcao) {
    if (!this.emFita) {
      this.emFita = true;
      Object.values(this.dims).forEach((d) => d.silenciar());
      transporte().pause();
      this.audivel.gain.rampTo(0, 0.03);
      this.gChiado.gain.rampTo(0.8, 0.5, Tone.now() + 0.15);
    }
    this.fita?.port.postMessage({ modo: direcao < 0 ? 'rebobinar' : 'avancar', velocidade: 3 });
  }

  irPara(idx) { this.terminou = false; this.tCongelado = null; this.inicioCompasso = null; this.idx = Math.max(0, Math.min(this.nPassos - 1, idx)); }

  /** Tic a cada passo: sempre o mesmo som, não depende dos dados. */
  tique() {
    const agora = Tone.now();
    if (this.tic instanceof Tone.Player) this.tic.start(agora);
    else this.tic.triggerAttackRelease(Tone.Frequency(78, 'midi'), 0.03, agora);
  }

  terminarFita(continuarTocando = true) {
    if (!this.emFita) return;
    this.emFita = false;
    const agora = Tone.now();
    this.fita?.port.postMessage({ modo: 'gravar' });
    this.gChiado.gain.cancelScheduledValues(agora);
    this.gChiado.gain.rampTo(0, 0.15);
    // "tape start": a música volta com o filtro abrindo
    this.filtroFita.frequency.cancelScheduledValues(agora);
    this.filtroFita.frequency.setValueAtTime(350, agora);
    this.filtroFita.frequency.exponentialRampToValueAtTime(20000, agora + 0.7);
    this.audivel.gain.rampTo(1, 0.25);
    this.tapeStart?.start(agora);
    if (continuarTocando) this.tocar();
  }
}
