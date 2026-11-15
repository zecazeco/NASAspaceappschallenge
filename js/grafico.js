// Gráfico das 3 camadas: linhas sobrepostas em perspectiva (sensação 3D), com brilho,
// esferas na ponta, cursor do ano atual e cards dos sons pontuais.
// • A escala vertical de cada linha é fixa para a cidade (não dá zoom nem acompanha a linha).
//   A chuva usa uma faixa "normal" (trilha.js, faixaChuva): um ano muito fora some acima do
//   teto da área (ou abaixo do chão) e a linha reaparece quando volta para a faixa.
//
// • O gráfico segue a música (tempo contínuo vindo do motor), mas pode ser ARRASTADO
//   (swipe no celular, clicar e arrastar no PC) para ver o passado e o futuro. Arrastar
//   não mexe na música; o botão "Agora" (ou 8 s sem mexer) traz a visão de volta.
// • Cada card fica preso ao seu ponto: anda junto com o gráfico. Ao fechar, encolhe até
//   o ponto e vira uma etiqueta curta. Tocar no ponto ou na etiqueta reabre o card.
// • Tudo que é dito pelos cards também vai para o leitor de tela (callback aoAnunciar).

// Ordem de desenho = do fundo para a frente. A temperatura é o eixo do projeto e fica na frente
// (mais perto, linha mais grossa); CO₂ e chuva são contexto e ficam atrás.
export const CAMADAS_GRAFICO = [
// CO₂ e chuva também ficam mais transparentes (alfa < 1).
  { id: 'co2', nome: 'CO₂', cor: '#C6F06B', z: 0.9, espessura: 1.0, alfa: 0.6 },
  { id: 'chuva', nome: 'Chuva', cor: '#53E2FF', z: 0.6, espessura: 0.8, alfa: 0.6 },
  { id: 'temperatura', nome: 'Temperatura', cor: '#FF5C9E', z: 0.0, espessura: 1.5, alfa: 1 },
];
import { t as tr, localidade, tempPar } from './i18n.js';

const TITULOS = new Proxy({}, { get: (_, id) => tr(`sigla.${String(id)}`) });
const num = (v, casas = 1) => v.toLocaleString(localidade(), { minimumFractionDigits: casas, maximumFractionDigits: casas });
const sinal = (v) => `${v >= 0 ? '+' : '−'}${num(Math.abs(v))}`;
// Textos dos eventos (no idioma escolhido, ver js/i18n.js)
const FRASES = {
  co2: { recorde: (e) => tr('ev.co2.recorde', { v: num(e.valor) }), faixa: (e) => tr('ev.co2.faixa', { n: e.quintos, v: Math.round(e.valor) }) },
  temperatura: { recorde: (e) => tr('ev.temperatura.recorde', { v: tempPar(e.valor) }) },
  chuva: {
    seca: (e) => tr('ev.chuva.seca', { v: Math.round(e.valor) }),
    extrema: (e) => tr('ev.chuva.extrema', { v: Math.round(e.valor) }),
  },
};
/** Resumo de 2 ou 3 palavras: a etiqueta que fica presa ao ponto depois que o card fecha. */
const RESUMOS = {
  co2: { recorde: () => tr('res.co2.recorde'), faixa: (e) => tr('res.co2.faixa', { n: e.quintos }) },
  temperatura: { recorde: () => tr('res.temperatura.recorde') },
  chuva: { seca: () => tr('res.chuva.seca'), extrema: () => tr('res.chuva.extrema') },
};
export const fraseDoEvento = (id, ev) => FRASES[id][ev.nome](ev);

// Eventos que não têm linha própria: aparecem (ponto, card e etiqueta) na linha de outra camada (camada → linha).
// Hoje nenhum: a tendência não tem mais card.
const LINHA_DO_EVENTO = {};
const linhaDe = (id) => LINHA_DO_EVENTO[id] ?? id;
const eventosDaLinha = (id) => [id, ...Object.keys(LINHA_DO_EVENTO).filter((k) => LINHA_DO_EVENTO[k] === id)];

const TETO = 1.15;   // altura máxima visível de uma linha (1 = o valor máximo normal)
// Compressão suave fora da faixa normal (hoje só a chuva passa dela): dentro de 0…1 nada muda;
// acima, a linha continua subindo cada vez mais devagar até perto do TETO, sem nunca cortar
// (a ordem entre os anos fica). Abaixo de 0, o mesmo até um pouco abaixo do chão.
// Um ▲ / ▼ com o valor real avisa que ali a escala está comprimida.
const ZONA_CIMA = TETO - 1 - 0.03, ZONA_BAIXO = 0.07;
const comprimir = (v) => (v > 1 ? 1 + ZONA_CIMA * Math.tanh((v - 1) / ZONA_CIMA)
  : v < 0 ? -ZONA_BAIXO * Math.tanh(-v / ZONA_BAIXO) : v);
/** Evento num ano fora da área: o marcador e o card ficam na borda por onde a linha saiu. */
const naBorda = (v) => Math.max(0.02, Math.min(TETO - 0.03, v));
const DURACAO_CARD = 3200, DURACAO_REABERTO = 4500, VOLTA_SOZINHO = 8000;
const sobrepoe = (a, b, folga = 8) => !(a.x + a.w + folga < b.x || b.x + b.w + folga < a.x || a.y + a.h + folga < b.y || b.y + b.h + folga < a.y);
const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Forma de cada camada (a cor nunca vem sozinha): losango, círculo, triângulo. */
function glifo(ctx, id, x, y, r) {
  ctx.beginPath();
  if (id === 'co2') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
  else if (id === 'temperatura') ctx.arc(x, y, r * 0.85, 0, 7);
  else if (id === 'chuva') { ctx.moveTo(x - r, y - r * 0.7); ctx.lineTo(x + r, y - r * 0.7); ctx.lineTo(x, y + r); ctx.closePath(); }
  ctx.fill();
}

export class Grafico {
  /** Textos do botão Agora no idioma escolhido. */
  atualizarIdioma() {
    this.btnAgora.textContent = tr('grafico.agora');
    this.btnAgora.setAttribute('aria-label', tr('grafico.agoraRotulo'));
    for (const c of (this.cards ?? []).slice()) this.fecharCard(c, true);   // cards abertos estavam no idioma anterior
  }

  constructor(el, { anos, aoAnunciar = () => {}, rotuloPonta = (id) => TITULOS[id] }) {
    this.el = el;
    this.anos = anos;
    this.N = anos.length;
    this.aoAnunciar = aoAnunciar;
    this.rotuloPonta = rotuloPonta;
    this.trilha = null;
    this.ligadas = Object.fromEntries(CAMADAS_GRAFICO.map((c) => [c.id, true]));
    this.tempoAlvo = () => 0;          // definido por quem usa (motor)
    this.t = 0;                        // tempo mostrado (suavizado)
    this.deslocamento = 0;             // anos de arrasto em relação ao "agora"
    this.ultimoToque = 0;
    this.alvos = [];
    this.vistos = new Map();
    this.cards = [];                   // { chave, el, fio, dx, dy, w, h, lado }

    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
    this.camadaCards = document.createElement('div');
    this.camadaCards.className = 'grafico-cards';
    this.camadaCards.setAttribute('aria-hidden', 'true');
    this.btnAgora = document.createElement('button');
    this.btnAgora.type = 'button';
    this.btnAgora.className = 'btn grafico-agora';
    this.atualizarIdioma();
    this.btnAgora.hidden = true;
    this.btnAgora.addEventListener('click', () => { this.voltandoAgora = true; });
    el.append(this.canvas, this.camadaCards, this.btnAgora);

    new ResizeObserver(() => this.redimensionar()).observe(el);
    this.redimensionar();
    this.ligarArrasto();
    let antes = performance.now();
    const quadro = (agora) => { const dt = Math.min(0.1, (agora - antes) / 1000); antes = agora; this.desenhar(agora, dt); requestAnimationFrame(quadro); };
    requestAnimationFrame(quadro);
  }

  definirTrilha(trilha) {
    this.trilha = trilha;
    this.vistos.clear();
    for (const c of this.cards.slice()) this.fecharCard(c, true);
    this.deslocamento = 0;
  }

  definirLigada(id, ligada) { this.ligadas[id] = ligada; }

  redimensionar() {
    const r = this.el.getBoundingClientRect();
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.canvas.width = this.W * this.dpr; this.canvas.height = this.H * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  // ------------------------------------------------------------ projeção
  anosVisiveis() { return this.W < 600 ? 15 : 24; }
  pxAno() { return (this.W * 0.92) / this.anosVisiveis(); }
  /** x = anos em relação ao centro da tela; z = profundidade (0 = frente); v = altura 0..1 */
  proj(x, z, v) {
    const { W, H } = this;
    const horizonte = H * 0.08, chao = H * 0.86;
    const s = 1 / (1 + z * 0.55);
    const base = horizonte + (chao - horizonte) * s;
    const altura = (chao - horizonte) * 0.78 * s;
    return { x: W / 2 + x * this.pxAno() * s, y: base - v * altura, base, s };
  }

  /** Posição real (0…1 na faixa normal; a chuva pode passar). */
  valorBruto(id, i) {
    const p = this.trilha?.posicao[id][i]; return p == null ? null : p / 3;
  }
  /** Posição desenhada: a real, comprimida fora da faixa normal. */
  valor(id, i) {
    const v = this.valorBruto(id, i); return v == null ? null : comprimir(v);
  }
  valorEm(id, t) {
    const i = Math.floor(t), f = t - i;
    const a = this.valor(id, i), b = this.valor(id, Math.min(this.N - 1, i + 1));
    if (a == null) return null;
    return b == null ? a : a + (b - a) * f;
  }

  // ------------------------------------------------------------ desenho
  desenhar(agora, dt) {
    const { ctx, W, H } = this;
    // tempo: segue a música com suavização (saltos do rebobinar viram um deslizar)
    const alvo = Math.max(0, Math.min(this.N - 1, this.tempoAlvo()));
    const dif = alvo - this.t;
    this.t = Math.abs(dif) < 0.002 || reduzMovimento ? alvo : this.t + dif * Math.min(1, dt * 9);
    // volta da visão arrastada
    if (!this.arrastando && this.deslocamento !== 0 && (this.voltandoAgora || agora - this.ultimoToque > VOLTA_SOZINHO)) {
      this.deslocamento *= Math.max(0, 1 - dt * 6);
      if (Math.abs(this.deslocamento) < 0.02) { this.deslocamento = 0; this.voltandoAgora = false; }
    }
    this.btnAgora.hidden = Math.abs(this.deslocamento) < 0.6;
    this.centro = this.t + this.deslocamento;

    ctx.clearRect(0, 0, W, H);
    this.alvos = [];
    this.obstaculos = [];   // textos já desenhados que as etiquetas não podem cobrir (ex.: ▲ +595%)
    if (!this.trilha) return;
    this.chao();
    const pontas = {};
    for (const c of CAMADAS_GRAFICO) if (this.ligadas[c.id]) pontas[c.id] = this.camada(c);
    this.cursor();
    this.etiquetas(agora);
    this.bordasEsfumadas();
    const comRotulo = [];
    for (const c of CAMADAS_GRAFICO) {
      const p = pontas[c.id];
      if (!p) continue;
      const pulso = this.pulsos?.[c.id] ? Math.max(0, 1 - (agora - this.pulsos[c.id]) / 900) : 0;
      comRotulo.push({ c, p, r: this.esfera(c, p, pulso) });
    }
    this.rotulos(comRotulo);
    this.moverCards();
  }

  chao() {
    const { ctx } = this;
    ctx.save(); ctx.lineWidth = 1;
    const base = Math.floor(this.centro);
    for (let k = -40; k <= 40; k++) {
      const ano = this.anos[0] + base + k;
      const x = base + k - this.centro;
      const a = this.proj(x, 0, 0), b = this.proj(x, 1.4, 0);
      const forte = ano % 10 === 0;
      ctx.strokeStyle = forte ? 'rgba(79,198,245,0.28)' : 'rgba(79,198,245,0.1)';
      ctx.beginPath(); ctx.moveTo(a.x, a.base); ctx.lineTo(b.x, b.base); ctx.stroke();
      if (forte && Math.abs(x) < this.anosVisiveis() / 2 + 1) {
        ctx.fillStyle = '#B9B3A6'; ctx.font = "500 11px 'IBM Plex Mono', monospace"; ctx.textAlign = 'center';
        ctx.fillText(String(ano), a.x, a.base + 15);
      }
    }
    for (let z = 0; z <= 1.4; z += 0.2) {
      const a = this.proj(-60, z, 0), b = this.proj(60, z, 0);
      ctx.strokeStyle = `rgba(79,198,245,${0.16 - z * 0.08})`;
      ctx.beginPath(); ctx.moveTo(a.x, a.base); ctx.lineTo(b.x, b.base); ctx.stroke();
    }
    ctx.restore();
  }

  camada(c) {
    const { ctx } = this;
    const t = this.t, centro = this.centro;
    const meia = this.anosVisiveis() + 4;
    const i0 = Math.max(0, Math.floor(centro - meia)), i1 = Math.min(this.N - 1, Math.ceil(centro + meia));
    const pts = [];
    for (let i = i0; i <= i1; i++) {
      const v = this.valor(c.id, i);
      if (v == null) continue;
      pts.push({ i, ...this.proj(i - centro, c.z, v) });
    }
    if (!pts.length) return null;
    const passado = pts.filter((p) => p.i <= t);
    const vAgora = this.valorEm(c.id, t);
    const ponta = vAgora == null ? null : this.proj(t - centro, c.z, vAgora);
    if (ponta) passado.push(ponta);
    const futuro = pts.filter((p) => p.i > t);
    if (ponta && futuro.length) futuro.unshift(ponta);

    // área da linha: do chão desta camada (um pouco abaixo, pela compressão) até o TETO
    const dentro = (v) => v >= -ZONA_BAIXO - 0.01 && v <= TETO;
    const teto = this.proj(0, c.z, TETO).y, chao = this.proj(0, c.z, -ZONA_BAIXO - 0.01).y;
    ctx.save();
    ctx.beginPath(); ctx.rect(-50, teto, this.W + 100, chao - teto + 2); ctx.clip();

    ctx.globalAlpha = c.alfa ?? 1;   // camadas de contexto mais fracas
    if (passado.length > 1) {   // cortina translúcida até o chão: dá o volume
      const g = ctx.createLinearGradient(0, Math.min(...passado.map((p) => p.y)), 0, passado[0].base);
      g.addColorStop(0, c.cor + '50'); g.addColorStop(1, c.cor + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(passado[0].x, passado[0].base);
      for (const p of passado) ctx.lineTo(p.x, p.y);
      ctx.lineTo(passado.at(-1).x, passado.at(-1).base); ctx.closePath(); ctx.fill();
    }
    const traco = (lista, alpha, brilho, largura, tracejado = []) => {
      if (lista.length < 2) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * (c.alfa ?? 1); ctx.strokeStyle = c.cor; ctx.lineWidth = largura;
      ctx.shadowColor = c.cor; ctx.shadowBlur = brilho; ctx.setLineDash(tracejado);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); lista.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      ctx.restore();
    };
    traco(passado, 0.28, 14, c.espessura * 2.6);
    traco(passado, 1, 6, c.espessura);
    traco(passado, 0.9, 0, Math.max(0.5, c.espessura * 0.3));
    traco(futuro, 0.22, 0, 1, [3, 6]);
    ctx.restore();   // fim do recorte: os pontos e anéis dos eventos podem passar da borda da área

    for (const ponto of pts) for (const eid of eventosDaLinha(c.id)) {   // pontos dos eventos (marcados desde já, acendem ao passar)
      const ev = this.trilha.eventos[ponto.i][eid];
      if (!ev) continue;
      const p = { i: ponto.i, ...this.pontoDe(eid, ponto.i) };   // fora da área: preso na borda
      const ja = p.i <= t;
      const r = (ev.intensidade === 'f' ? 6 : ev.intensidade === 'm' ? 5 : 4) * p.s;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = c.cor; ctx.shadowColor = c.cor; ctx.shadowBlur = ja ? 12 : 0; ctx.globalAlpha = ja ? 1 : 0.4;
      glifo(ctx, c.id, p.x, p.y, r);
      // anel: o evento acabou de acontecer (até ~1,5 ano depois)
      const recente = ja && t - p.i < 1.5;
      if (recente) { ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.3, 0, 7); ctx.strokeStyle = c.cor; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.restore();
      if (ja) this.alvos.push({ x: p.x, y: p.y, i: p.i, id: eid, ev, cor: c.cor, chave: `${p.i}:${eid}` });
    }
    this.foraDaEscala(c, pts, t);
    // ponta fora da área: sem esfera nem rótulo até a linha voltar
    return ponta && dentro(vAgora) ? ponta : null;
  }

  /**
   * Trechos fora da faixa normal (escala comprimida): uma linha tracejada fina no limite da faixa e,
   * no ano mais extremo de cada trecho, um ▲ (ou ▼) com o valor real, para ninguém ler a altura
   * como proporcional.
   */
  foraDaEscala(c, pts, t) {
    const { ctx } = this;
    const trechos = [];
    let atual = null;
    for (const p of pts) {
      const v = this.valorBruto(c.id, p.i);
      const lado = v > 1 ? 1 : v < 0 ? -1 : 0;
      if (lado && atual && atual.lado === lado && p.i === atual.fim + 1) { atual.fim = p.i; if (lado * v > lado * atual.v) { atual.v = v; atual.i = p.i; atual.p = p; } }
      else if (lado) { atual = { lado, ini: p.i, fim: p.i, v, i: p.i, p }; trechos.push(atual); }
      else atual = null;
    }
    for (const tr of trechos) {
      const ja = tr.i <= t;
      const centro = this.centro;
      const limite = tr.lado > 0 ? 1 : 0;
      const a = this.proj(tr.ini - centro - 0.5, c.z, limite), b = this.proj(tr.fim - centro + 0.5, c.z, limite);
      ctx.save();
      ctx.strokeStyle = c.cor; ctx.globalAlpha = ja ? 0.45 : 0.2; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // ▲ / ▼ no ponto mais extremo, com o valor real ao lado
      // os dois ficam ACIMA do ponto (embaixo dele estão o chão e os anos do eixo):
      // ▲ apontando para cima no pico; ▼ apontando para o ponto no vale
      const p = tr.p, tam = 5 * p.s;
      const ponta = tr.lado > 0 ? p.y - 10 * p.s - tam : p.y - 10 * p.s;
      const base = tr.lado > 0 ? ponta + tam : ponta - tam;
      const y0 = (ponta + base) / 2, dir = 0;
      ctx.setLineDash([]); ctx.globalAlpha = ja ? 1 : 0.4; ctx.fillStyle = c.cor;
      ctx.shadowColor = c.cor; ctx.shadowBlur = ja ? 8 : 0;
      ctx.beginPath(); ctx.moveTo(p.x, ponta); ctx.lineTo(p.x - tam, base); ctx.lineTo(p.x + tam, base); ctx.closePath(); ctx.fill();
      const ev = this.trilha.eventos[tr.i]?.[c.id];
      if (ev && ev.valor != null) {
        ctx.shadowBlur = 0;
        ctx.font = `500 ${Math.round(11 * p.s)}px 'IBM Plex Mono', monospace`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const txt = `${ev.valor >= 0 ? '+' : '−'}${Math.round(Math.abs(ev.valor))}%`;
        ctx.fillText(txt, p.x + tam + 4, y0 + dir * tam * 0.5);
        const w = ctx.measureText(txt).width;
        this.obstaculos.push({ x: p.x - tam - 2, y: y0 + dir * tam * 0.5 - 9, w: w + tam * 2 + 8, h: 18 });
      }
      ctx.restore();
    }
  }

  esfera(c, p, pulso) {
    const { ctx } = this;
    const r = (6 + pulso * 6) * p.s;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
    halo.addColorStop(0, c.cor + 'aa'); halo.addColorStop(1, c.cor + '00');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2); ctx.fill();
    const corpo = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    corpo.addColorStop(0, '#ffffff'); corpo.addColorStop(0.35, c.cor); corpo.addColorStop(1, c.cor + '33');
    ctx.fillStyle = corpo; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return r;
  }

  /** Nome e valor presos à ponta; afastam-se na vertical quando ficam perto demais. */
  rotulos(lista) {
    const { ctx } = this;
    const ord = lista.slice().sort((a, b) => a.p.y - b.p.y);
    ord.forEach((o, k) => { o.y = o.p.y + 4; if (k && o.y - ord[k - 1].y < 16) o.y = ord[k - 1].y + 16; });
    // o ano que está tocando (o mesmo do painel e do número grande), não o mais próximo da ponta
    const idx = Math.max(0, Math.min(this.N - 1, Math.floor(this.t + 0.001)));
    for (const o of ord) {
      if (o.p.x < -20 || o.p.x > this.W + 20) continue;
      ctx.save(); ctx.font = "500 12px 'IBM Plex Mono', monospace"; ctx.fillStyle = o.c.cor; ctx.globalAlpha = 0.95; ctx.textAlign = 'left';
      const x = o.p.x + o.r + 10;
      if (Math.abs(o.y - (o.p.y + 4)) > 2) {
        ctx.strokeStyle = o.c.cor; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(o.p.x + o.r + 2, o.p.y); ctx.lineTo(x - 3, o.y - 4); ctx.stroke(); ctx.globalAlpha = 0.95;
      }
      // a parte entre parênteses (a outra unidade de temperatura) vai menor e mais apagada;
      // se o rótulo não couber até a borda, as duas partes encolhem juntas (até 9 px)
      const txt = this.rotuloPonta(o.c.id, idx, this.t);
      const corte = txt.indexOf(' (');
      const [a1, a2] = corte < 0 ? [txt, ''] : [txt.slice(0, corte), txt.slice(corte)];
      const medir = (f1) => { ctx.font = `500 ${f1}px 'IBM Plex Mono', monospace`; const w1 = ctx.measureText(a1).width; ctx.font = `500 ${f1 - 2}px 'IBM Plex Mono', monospace`; return w1 + ctx.measureText(a2).width; };
      let f1 = 12;
      while (f1 > 9 && x + medir(f1) > this.W - 4) f1 -= 0.5;
      ctx.font = `500 ${f1}px 'IBM Plex Mono', monospace`;
      ctx.fillText(a1, x, o.y);
      if (a2) {
        const w1 = ctx.measureText(a1).width;
        ctx.font = `500 ${f1 - 2}px 'IBM Plex Mono', monospace`; ctx.globalAlpha = 0.6;
        ctx.fillText(a2, x + w1, o.y);
      }
      ctx.restore();
    }
  }

  cursor() {
    const { ctx } = this;
    const x = this.t - this.centro;
    const a = this.proj(x, 0, 0), b = this.proj(x, 1.4, 1.05);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, b.y, 0, a.base);
    g.addColorStop(0, 'rgba(255,138,76,0)'); g.addColorStop(0.25, 'rgba(255,138,76,0.6)'); g.addColorStop(1, 'rgba(255,138,76,1)');
    ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.shadowColor = '#FF8A4C'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(a.x, a.base); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  }

  bordasEsfumadas() {
    const { ctx, W, H } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const esq = ctx.createLinearGradient(0, 0, W * 0.3, 0);
    esq.addColorStop(0, 'rgba(0,0,0,1)'); esq.addColorStop(0.15, 'rgba(0,0,0,0.85)'); esq.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = esq; ctx.fillRect(0, 0, W * 0.3, H);
    const dir = ctx.createLinearGradient(W, 0, W * 0.8, 0);
    dir.addColorStop(0, 'rgba(0,0,0,1)'); dir.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = dir; ctx.fillRect(W * 0.8, 0, W * 0.2, H);
    ctx.restore();
  }

  /**
   * Etiquetas dos eventos já vistos (o card fechado vira etiqueta). Ficam afastadas do ponto, de
   * preferência acima e à esquerda, sempre antes do cursor (o caminho do gráfico), ligadas ao ponto
   * por um fio fino. Não cobrem outras etiquetas, outros pontos de evento nem os valores ▲/▼.
   */
  etiquetas(agora) {
    const { ctx, W, H } = this;
    const abertas = new Set(this.cards.map((c) => c.chave));
    const xCursor = this.proj(this.t - this.centro, 0, 0).x;
    const pontos = this.alvos.map((a) => ({ x: a.x - 9, y: a.y - 9, w: 18, h: 18 }));
    const ocupados = [...(this.obstaculos ?? [])];
    ctx.save(); ctx.font = "600 10.5px 'Chakra Petch', sans-serif";
    for (const a of this.alvos.slice().sort((x, y) => y.i - x.i)) {
      a.etiqueta = null;
      const t0 = this.vistos.get(a.chave);
      if (t0 == null || agora < t0 || abertas.has(a.chave)) continue;
      const alpha = Math.min(1, (agora - t0) / 400);
      const txt = RESUMOS[a.id][a.ev.nome](a.ev);
      const w = ctx.measureText(txt).width + 12, h = 17;
      const livre = (c, antesDoCursor) => c.x >= 4 && c.x + w <= W - 4 && c.y >= 2 && c.y + h <= H - 22
        && (!antesDoCursor || c.x + w <= xCursor - 8)
        && !ocupados.some((o) => sobrepoe(c, o, 3)) && !pontos.some((o) => sobrepoe(c, o, 1));
      let r = null;
      // 1º: à esquerda (acima, depois abaixo) e antes do cursor; 2º: qualquer lado
      busca: for (const [lados, antes] of [[[-1], true], [[-1, 1], false]]) {
        for (const lado of lados) for (const dy of [-30, -52, 14, 36, -74, 58]) for (const dx of [6, 26, 48]) {
          const c = { x: lado < 0 ? a.x - dx - w : a.x + dx, y: a.y + dy, w, h };
          if (livre(c, antes)) { r = c; break busca; }
        }
      }
      if (!r) continue;
      ocupados.push(r);
      a.etiqueta = r;
      // fio do ponto até a borda mais próxima da etiqueta
      const fx = Math.max(r.x, Math.min(r.x + w, a.x)), fy = Math.max(r.y, Math.min(r.y + h, a.y));
      ctx.globalAlpha = alpha * 0.55; ctx.strokeStyle = a.cor; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = 'rgba(7,7,12,0.88)';
      ctx.beginPath(); ctx.rect(r.x, r.y, w, h); ctx.fill(); ctx.globalAlpha = alpha * 0.7; ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = alpha; ctx.fillStyle = a.cor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, r.x + w / 2, r.y + h / 2 + 0.5);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ cards
  /** Chamado pelo site quando a música chega num ano (só em reprodução normal). */
  mostrarEventos(idx) {
    if (!this.trilha) return;
    const ev = this.trilha.eventos[idx];
    this.pulsos ??= {};
    for (const id of Object.keys(ev)) {
      if (!this.ligadas[linhaDe(id)]) continue;
      this.pulsos[linhaDe(id)] = performance.now();
      this.abrirCard(id, ev[id], idx, DURACAO_CARD);
    }
  }

  /** Posição atual do ponto de um evento (ou null se fora da tela/sem valor). */
  pontoDe(id, i) {
    const c = CAMADAS_GRAFICO.find((k) => k.id === linhaDe(id));
    const v = this.valor(c.id, i);
    return v == null ? null : this.proj(i - this.centro, c.z, naBorda(v));
  }

  /**
   * Escolhe onde o card aparece em volta do ponto, dentro da área do gráfico, sem encostar em cards
   * abertos nem cobrir o ponto. Sempre que possível o card fica INTEIRO à esquerda do centro (o ano
   * que está tocando), para não tapar o caminho por onde o gráfico anda; se não couber, usa os dois lados.
   */
  posicionar(w, h, p) {
    const m = 8, topo = 6, baixo = this.H - 6, centro = this.W / 2 - 10;
    const prende = (v, a, b) => Math.max(a, Math.min(b, v));
    const ocupados = this.cards.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h }));
    const ponto = { x: p.x - 14, y: p.y - 14, w: 28, h: 28 };
    const tentativas = [
      { lados: [-1], soEsquerda: true },
      { lados: [-1, 1], soEsquerda: false },
    ];
    for (const { lados, soEsquerda } of tentativas) {
      for (const lado of lados) {
        for (const dy of [-h - 30, -h / 2, 30, -h - 100, 100]) {
          for (const dist of [22, 60]) {
            const r = { x: prende(lado > 0 ? p.x + dist : p.x - dist - w, m, this.W - m - w), y: prende(p.y + dy, topo, baixo - h), w, h };
            if (soEsquerda && r.x + w > centro) continue;
            if (sobrepoe(r, ponto, 2) || ocupados.some((o) => sobrepoe(r, o))) continue;
            return { ...r, lado };
          }
        }
      }
    }
    const yMin = Math.min(...ocupados.map((o) => o.y), baixo);
    return { x: prende(Math.min(p.x, centro) - w, m, this.W - m - w), y: Math.max(topo, yMin - h - 10), w, h, lado: -1 };
  }

  abrirCard(id, ev, i, duracao) {
    const chave = `${i}:${id}`;
    if (this.cards.some((c) => c.chave === chave)) return;
    const p = this.pontoDe(id, i);
    if (!p) return;
    const camada = CAMADAS_GRAFICO.find((k) => k.id === linhaDe(id));
    const el = document.createElement('div');
    el.className = 'card-evento'; el.style.setProperty('--cor', camada.cor);
    const frase = fraseDoEvento(id, ev);
    el.innerHTML = '<b></b><span></span>';
    el.children[0].textContent = `${this.anos[i]} · ${TITULOS[id]}`;
    el.children[1].textContent = frase;
    const fio = document.createElement('div');
    fio.className = 'card-fio'; fio.style.setProperty('--cor', camada.cor);
    // cabe na metade esquerda do gráfico (ver posicionar)
    el.style.maxWidth = `${Math.min(240, Math.max(150, this.W / 2 - 26))}px`;   // estreito: card mais perto de um quadrado
    this.camadaCards.append(fio, el);
    const w = el.offsetWidth, h = el.offsetHeight;
    const r = this.posicionar(w, h, p);
    // o card guarda a distância até o ponto e anda junto com ele
    const card = { chave, id, i, el, fio, w, h, lado: r.lado, dx: r.x - p.x, dy: r.y - p.y, x: r.x, y: r.y };
    this.cards.push(card);
    this.posicionarCard(card, p);
    setTimeout(() => { el.classList.add('visivel'); fio.classList.add('visivel'); }, 20);
    this.aoAnunciar(`${this.anos[i]}. ${TITULOS[id]}. ${frase}`);
    card.timer = setTimeout(() => this.fecharCard(card), duracao);
  }

  posicionarCard(card, p) {
    // o card anda junto com o ponto; ao chegar na margem esquerda ele para ali e só o fio segue o ponto
    card.x = Math.max(8, p.x + card.dx); card.y = p.y + card.dy;
    card.el.style.transform = `translate(${card.x}px, ${card.y}px)`;
    // o fio sai da borda do card mais próxima do ponto
    const ax = Math.abs(p.x - card.x) < Math.abs(p.x - (card.x + card.w)) ? card.x : card.x + card.w;
    const ay = Math.max(card.y, Math.min(card.y + card.h, p.y));
    const dx = p.x - ax, dy = p.y - ay;
    card.fio.style.width = `${Math.hypot(dx, dy)}px`;
    card.fio.style.transform = `translate(${ax}px, ${ay}px) rotate(${Math.atan2(dy, dx)}rad)`;
  }

  moverCards() {
    for (const card of this.cards) {
      if (card.fechando) continue;
      const p = this.pontoDe(card.id, card.i);
      if (p) this.posicionarCard(card, p);
    }
  }

  fecharCard(card, imediato = false) {
    clearTimeout(card.timer);
    this.cards.splice(this.cards.indexOf(card), 1);
    if (imediato) { card.el.remove(); card.fio.remove(); return; }
    card.fechando = true;
    // encolhe até o ponto e vira etiqueta
    const p = this.pontoDe(card.id, card.i) || { x: card.x, y: card.y };
    const cx = p.x - card.w / 2, cy = p.y - card.h / 2;
    card.el.style.transition = 'opacity 0.5s, transform 0.5s cubic-bezier(.5,0,.8,.4)';
    card.el.style.transform = `translate(${cx}px, ${cy}px) scale(0.15)`;
    card.el.classList.remove('visivel'); card.fio.classList.remove('visivel');
    this.vistos.set(card.chave, performance.now() + 380);
    setTimeout(() => { card.el.remove(); card.fio.remove(); }, 550);
  }

  // ------------------------------------------------------------ arrastar e tocar
  alvoEm(x, y) {
    let melhor = null, menor = 22;
    for (const a of this.alvos) {
      const e = a.etiqueta;
      if (e && x >= e.x - 4 && x <= e.x + e.w + 4 && y >= e.y - 4 && y <= e.y + e.h + 4) return a;
      const d = Math.hypot(a.x - x, a.y - y);
      if (d < menor) { menor = d; melhor = a; }
    }
    return melhor;
  }

  ligarArrasto() {
    const cv = this.canvas;
    let inicio = null;
    const local = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      inicio = { ...local(e), desloc: this.deslocamento, moveu: false, id: e.pointerId };
      this.ultimoToque = performance.now();
    });
    cv.addEventListener('pointermove', (e) => {
      const p = local(e);
      if (!inicio) { cv.style.cursor = this.alvoEm(p.x, p.y) ? 'pointer' : 'grab'; return; }
      const dx = p.x - inicio.x;
      if (!inicio.moveu && Math.abs(dx) > 6) {
        inicio.moveu = true; this.arrastando = true; this.voltandoAgora = false;
        try { cv.setPointerCapture(inicio.id); } catch { /* ok */ }
        cv.style.cursor = 'grabbing';
      }
      if (inicio.moveu) {
        const centroDesejado = this.t + inicio.desloc - dx / this.pxAno();
        this.deslocamento = Math.max(0, Math.min(this.N - 1, centroDesejado)) - this.t;
        this.ultimoToque = performance.now();
      }
    });
    const soltar = (e) => {
      if (!inicio) return;
      if (!inicio.moveu && e.type === 'pointerup') {
        const p = local(e);
        const a = this.alvoEm(p.x, p.y);
        if (a) this.abrirCard(a.id, a.ev, a.i, DURACAO_REABERTO);
      }
      inicio = null; this.arrastando = false; this.ultimoToque = performance.now();
      cv.style.cursor = 'grab';
    };
    cv.addEventListener('pointerup', soltar);
    cv.addEventListener('pointercancel', soltar);
  }
}
