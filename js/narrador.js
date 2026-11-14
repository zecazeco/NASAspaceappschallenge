// Narração dos anos.
// 1º: arquivos gravados em audio/narracao/ (voz natural: gravada por alguém ou gerada por IA).
// 2º: se não existirem, a voz do próprio navegador (Web Speech API), escolhendo a mais natural.

const PASTA = 'audio/narracao/';

// Vozes "naturais" conhecidas em pt-BR (Edge, Chrome, iOS, Android, Windows)
const PREFERIDAS = /natural|neural|online|enhanced|premium|aprimorad|google|francisca|antonio|thalita|luciana|felipe/i;

export class Narrador {
  constructor() {
    this.suportado = 'speechSynthesis' in window;
    this.voz = null;
    this.buffers = {};
    this.player = null;
    this.aoFalar = () => {};   // (falando: boolean) → usado para abaixar a música
    if (!this.suportado) return;
    const escolher = () => {
      const pt = speechSynthesis.getVoices().filter((v) => v.lang?.replace('_', '-').startsWith('pt'));
      const nota = (v) => (v.lang.replace('_', '-') === 'pt-BR' ? 2 : 0) + (PREFERIDAS.test(v.name) ? 3 : 0) + (v.localService ? 0 : 1);
      this.voz = pt.sort((a, b) => nota(b) - nota(a))[0] || null;
    };
    escolher();
    speechSynthesis.addEventListener?.('voiceschanged', escolher);
  }

  /** Tenta carregar audio/narracao/<ano>.mp3. Se o do primeiro ano não existir, nem tenta o resto. */
  async carregar(passos) {
    if (this._carregando) return this._carregando;
    this._carregando = this._carregar(passos);
    return this._carregando;
  }

  async _carregar(passos) {
    try {
      const teste = await fetch(`${PASTA}${passos[0].inicio}.mp3`, { method: 'HEAD' });
      if (!teste.ok) return 0;
    } catch { return 0; }
    // um arquivo por ano (a música termina em 2023, último ano do mapa da NASA: não é mais "hoje")
    const chaves = passos.map((p) => String(p.inicio));
    const carregarUm = async (k, tentativas = 2) => {
      for (let i = 0; i < tentativas; i++) {
        try { this.buffers[k] = await new Tone.ToneAudioBuffer().load(`${PASTA}${k}.mp3`); return; } catch { /* tenta de novo */ }
      }
    };
    // em lotes pequenos: muitos downloads ao mesmo tempo falhavam
    for (let i = 0; i < chaves.length; i += 6) await Promise.all(chaves.slice(i, i + 6).map((k) => carregarUm(k)));
    this.player = new Tone.Player().toDestination();
    this.player.onstop = () => this.aoFalar(false);
    return Object.keys(this.buffers).length;
  }

  get descricao() {
    const n = Object.keys(this.buffers).length;
    if (n) return `voz gravada (${n} arquivos)`;
    return this.voz ? `voz do navegador: ${this.voz.name}` : 'sem voz disponível';
  }

  /** No iOS a primeira fala precisa acontecer dentro de um toque do usuário. */
  destravar() {
    if (!this.suportado) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
  }

  /** chave = 'hoje' ou o ano inicial do passo; texto = fallback para a voz do navegador. */
  falar(texto, chave, importante = false) {
    // uma frase importante (início de medição) não é cortada pelo ano seguinte
    if (this.importante && !importante && performance.now() < this.importanteAte) return;
    this.importante = importante;
    this.cancelar(false);
    const buf = chave != null && this.buffers[chave];
    if (buf) {
      this.player.buffer = buf;
      this.importanteAte = performance.now() + buf.duration * 1000;
      this.aoFalar(true);
      this.player.start();
      return;
    }
    if (!this.suportado) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR';
    if (this.voz) u.voice = this.voz;
    u.rate = 1;
    u.onstart = () => this.aoFalar(true);
    this.importanteAte = performance.now() + 6000;
    u.onend = u.onerror = () => { this.importanteAte = 0; this.aoFalar(false); };
    speechSynthesis.speak(u);
  }

  cancelar(avisar = true) {
    if (this.player?.state === 'started') this.player.stop();
    if (this.suportado) speechSynthesis.cancel();
    if (avisar) this.aoFalar(false);
  }
}
