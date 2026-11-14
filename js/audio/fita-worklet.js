// AudioWorklet "fita": grava continuamente os últimos 12 s da música.
// Ao rebobinar, toca esse trecho DE TRÁS PARA FRENTE: a velocidade sai de +1x,
// passa por 0 (tape stop) e acelera até -3x, como uma fita cassete voltando.

class Fita extends AudioWorkletProcessor {
  constructor() {
    super();
    this.tam = Math.floor(sampleRate * 12);
    this.buf = [new Float32Array(this.tam), new Float32Array(this.tam)];
    this.w = 0;              // cabeça de gravação
    this.r = 0;              // cabeça de leitura (fracionária)
    this.vel = 0;
    this.alvo = 0;
    this.ganho = 0;
    this.modo = 'gravar';
    this.kVel = 1 - Math.exp(-1 / (0.22 * sampleRate));   // inércia da fita
    this.kGanho = 1 - Math.exp(-1 / (0.012 * sampleRate)); // fade anti-clique
    this.port.onmessage = (e) => {
      const { modo, velocidade = 3 } = e.data;
      if (modo === 'rebobinar' || modo === 'avancar') {
        if (this.modo === 'gravar') {
          this.r = this.w - Math.floor(0.3 * sampleRate);
          if (this.r < 0) this.r += this.tam;
          this.vel = 1;
        }
        this.alvo = modo === 'rebobinar' ? -velocidade : velocidade;
        this.modo = modo;
      } else {
        this.modo = 'gravar';
      }
    };
  }

  process(inputs, outputs) {
    const ent = inputs[0] || [];
    const eL = ent[0], eR = ent[1] || ent[0];
    const sai = outputs[0];
    const sL = sai[0], sR = sai[1] || sai[0];
    const { buf, tam } = this;

    for (let i = 0; i < sL.length; i++) {
      const gravando = this.modo === 'gravar';
      if (gravando) {
        buf[0][this.w] = eL ? eL[i] : 0;
        buf[1][this.w] = eR ? eR[i] : 0;
        this.w = (this.w + 1) % tam;
        this.ganho += (0 - this.ganho) * this.kGanho;
      } else {
        this.ganho += (1 - this.ganho) * this.kGanho;
        this.vel += (this.alvo - this.vel) * this.kVel;
      }

      if (this.ganho > 1e-4) {
        const i0 = Math.floor(this.r), f = this.r - i0, i1 = (i0 + 1) % tam;
        // leve "abafado" quando rápido, como a cabeça da fita perdendo contato
        const g = this.ganho * (0.9 - Math.min(0.35, Math.abs(this.vel) * 0.08));
        sL[i] = (buf[0][i0] * (1 - f) + buf[0][i1] * f) * g;
        if (sR !== sL) sR[i] = (buf[1][i0] * (1 - f) + buf[1][i1] * f) * g;
        if (!gravando) {
          this.r += this.vel;
          if (this.r < 0) this.r += tam; else if (this.r >= tam) this.r -= tam;
        }
      } else {
        sL[i] = 0; if (sR !== sL) sR[i] = 0;
      }
    }
    return true;
  }
}

registerProcessor('fita', Fita);
