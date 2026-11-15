// Painel da temperatura: de onde vem o número.
//   • o mapa da NASA (GISTEMP) do ano que está tocando, com a cidade marcada;
//   • a lente: o pedaço do mapa em volta da cidade, ampliado;
//   • o valor lido da cor do mapa e a seta branca na escala (−2 a +2 °C), que anda com ele.
// O mapa acompanha a música: no fim de cada compasso ele se funde com o mapa do ano seguinte.
// Tudo é desenhado em coordenadas do FRAME (pixels da imagem da NASA), então o ponto
// da cidade fica no lugar certo em qualquer tamanho de tela.

import { visualizacao, frameDoPasso, imagemDoFrame, pontoNoFrame, corDoValor } from './frames.js';
import { t, localidade, unidade, unidadeSecundaria, valorNa, temp } from './i18n.js';

const $ = (s) => document.querySelector(s);
const LADO_LENTE = 90;   // pedaço do frame (px, frame de 1280) mostrado na lente
const INICIO_FUSAO = 0.7; // a partir de 70% do compasso o mapa começa a virar o do ano seguinte
const num = (v) => Math.abs(v).toLocaleString(localidade(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "+1,5 °C" com a vírgula apertada (a fonte é monoespaçada). */
// número grande na unidade escolhida; a outra unidade aparece pequena no canto superior direito
const textoTemp = (valor) => {
  const [, i, sep, d] = valorNa(valor).match(/^(.*?)([.,])(\d+)$/);
  return `<span class="num">${i}<span class="virg">${sep}</span>${d}<small>°${unidade().toUpperCase()}</small></span><span class="valor-sec">${temp(valor, unidadeSecundaria())}</span>`;
};

export class PainelTemperatura {
  constructor({ tempo, passos, valorEm = () => null }) {
    this.tempo = tempo;
    this.valorEm = valorEm;     // valor interpolado no tempo contínuo (ex.: 12,4 = 40% do caminho de 1962 a 1963)
    this.textoValor = '';
    this.passos = passos;
    this.v = visualizacao('temperatura');
    this.botao = $('#mapa-temp');
    this.mapa = this.botao.querySelector('canvas');
    this.lente = $('#lente-temp');
    this.painel = this.botao.closest('.painel-temp');
    this.imgs = new Map();          // arquivo → imagem já carregada
    this.cidade = null;
    this.ponto = null;
    this.corAnel = '#ff7a45';
    this.chave = '';
    const marcas = $('#marcas-dial');
    if (marcas && !marcas.childElementCount) {
      const ns = 'http://www.w3.org/2000/svg';
      for (let d = 0; d < 360; d += 10) {
        const forte = d % 30 === 0, r0 = 44, r1 = forte ? 50 : 47, a = (d * Math.PI) / 180;
        const l = document.createElementNS(ns, 'line');
        l.setAttribute('x1', (60 + r0 * Math.sin(a)).toFixed(2)); l.setAttribute('y1', (60 - r0 * Math.cos(a)).toFixed(2));
        l.setAttribute('x2', (60 + r1 * Math.sin(a)).toFixed(2)); l.setAttribute('y2', (60 - r1 * Math.cos(a)).toFixed(2));
        if (forte) l.setAttribute('class', 'forte');
        marcas.append(l);
      }
    }
    const ro = new ResizeObserver(() => this.dimensionar());
    ro.observe(this.mapa); ro.observe(this.lente);
    const quadro = () => { this.desenhar(); this.acompanharValor(); requestAnimationFrame(quadro); };
    requestAnimationFrame(quadro);
  }

  definirCidade(cidade) {
    this.cidade = cidade;
    this.ponto = this.v ? pontoNoFrame('temperatura', cidade.lat, cidade.lon) : null;
    const lat = Math.abs(cidade.lat).toLocaleString(localidade(), { maximumFractionDigits: 1 });
    $('#cidade-mapa').textContent = `${cidade.nome} · ${lat}° ${cidade.lat < 0 ? 'S' : 'N'}`;
    this.chave = '';
    this.ligarFio();
  }

  /**
   * A cada quadro: o número grande e a seta andam do valor deste ano até o do ano seguinte ao longo
   * do compasso (como a melodia, que mostra a mudança até o ano seguinte). O número muda de 0,1 em 0,1.
   */
  acompanharValor() {
    if (!this.cidade || this.painel.closest('[hidden]')) return;
    const valor = this.valorEm(this.tempo());
    if (valor == null) return;
    const texto = `${valorNa(valor)}${unidade()}`;
    if (texto !== this.textoValor) { this.textoValor = texto; $('#valor-temp').innerHTML = textoTemp(valor); this.arco(valor); }
    $('#seta-temp').style.top = `${((2 - Math.max(-2, Math.min(2, valor))) / 4) * 100}%`;
  }

  /** Ao trocar o idioma: refaz o rótulo da cidade (o resto vem com atualizar). */
  atualizarIdioma() { if (this.cidade) { this.definirCidade(this.cidade); this.textoValor = ''; } }

  /** Arco do dial: +2 °C = meia volta para a direita; frio vai para a esquerda. */
  arco(valor) {
    const el = $('#arco-valor');
    if (!el) return;
    const v = Math.max(-2, Math.min(2, valor));
    el.setAttribute('stroke-dasharray', `${(Math.abs(v) / 2) * 180} 360`);
    el.setAttribute('transform', v < 0 ? 'translate(120 0) scale(-1 1) rotate(-90 60 60)' : 'rotate(-90 60 60)');
  }

  /** Texto, cor e seta do ano (chamado a cada compasso e ao rebobinar). */
  atualizar(idx, valor) {
    const ano = this.passos[idx].inicio;
    const temValor = valor != null;
    this.textoValor = '';
    $('#valor-temp').innerHTML = temValor ? textoTemp(valor) : '—';
    $('#ano-mapa').textContent = ano;
    this.arco(temValor ? valor : 0);
    $('#legenda-temp').textContent = temValor
      ? t(Math.abs(valor) < 0.05 ? 'temp.igual' : valor > 0 ? 'temp.quente' : 'temp.frio', { ano })
      : t('temp.semDado', { ano });
    const seta = $('#seta-temp');
    seta.hidden = !temValor;
    if (temValor) seta.style.top = `${((2 - Math.max(-2, Math.min(2, valor))) / 4) * 100}%`;
    this.corAnel = (temValor && corDoValor(this.v, valor)) || '#ff7a45';
    this.botao.setAttribute('aria-label', t('mapa.ampliar', { ano, cidade: this.cidade?.nome ?? t('mapa.aCidade') }));
    this.chave = '';
  }

  dimensionar() {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    for (const c of [this.mapa, this.lente]) {
      const r = c.getBoundingClientRect();
      c.width = Math.max(1, Math.round(r.width * this.dpr));
      c.height = Math.max(1, Math.round(r.height * this.dpr));
    }
    this.chave = '';
    this.ligarFio();
  }

  /** Fio tracejado do ponto no mapa até a lente (só no celular; no monitor ficam lado a lado). */
  ligarFio() {
    const linha = $('#fio-temp');
    if (!linha) return;   // visual novo: sem fio (a lente fica logo abaixo do mapa)
    if (!this.ponto || !this.v) { linha.removeAttribute('x1'); return; }
    const rc = this.v.recorte, base = this.painel.getBoundingClientRect();
    const m = this.mapa.getBoundingClientRect(), l = this.lente.getBoundingClientRect();
    const x1 = m.left - base.left + ((this.ponto.x - rc.x) / rc.largura) * m.width;
    const y1 = m.top - base.top + ((this.ponto.y - rc.y) / rc.altura) * m.height + 9;
    const x2 = l.left - base.left + l.width / 2, y2 = l.top - base.top + 3;
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => linha.setAttribute(k, v.toFixed(1)));
  }

  /** Imagem do frame se já estiver carregada; se não, pede e devolve null. */
  img(f) {
    if (!f) return null;
    const i = this.imgs.get(f.arquivo);
    if (i) return i;
    if (!this.imgs.has(f.arquivo + '?')) {
      this.imgs.set(f.arquivo + '?', true);
      imagemDoFrame(f).then((im) => { this.imgs.set(f.arquivo, im); this.chave = ''; }).catch(() => {});
    }
    return null;
  }

  desenhar() {
    if (!this.cidade || !this.v || !this.ponto || this.painel.closest('[hidden]')) return;
    const N = this.passos.length;
    const t = Math.max(0, Math.min(N - 1, this.tempo()));
    const i = Math.floor(t), f = t - i;
    const fusao = i + 1 < N && f > INICIO_FUSAO ? (f - INICIO_FUSAO) / (1 - INICIO_FUSAO) : 0;
    const suave = fusao * fusao * (3 - 2 * fusao);
    const chave = `${i}|${Math.round(suave * 24)}|${this.mapa.width}|${this.corAnel}`;
    if (chave === this.chave) return;
    const a = this.img(frameDoPasso('temperatura', this.passos[i]));
    const b = suave > 0 ? this.img(frameDoPasso('temperatura', this.passos[i + 1])) : null;
    if (!a) return;                  // ainda baixando: tenta no próximo quadro
    this.chave = chave;
    const camadas = [[a, 1]];
    if (b && suave > 0) camadas.push([b, suave]);
    this.desenharMapa(camadas);
    this.desenharLente(camadas);
  }

  desenharMapa(camadas) {
    const g = this.mapa.getContext('2d'), W = this.mapa.width, H = this.mapa.height, rc = this.v.recorte;
    g.clearRect(0, 0, W, H);
    for (const [im, alfa] of camadas) { g.globalAlpha = alfa; g.drawImage(im, rc.x, rc.y, rc.largura, rc.altura, 0, 0, W, H); }
    g.globalAlpha = 1;
    const x = ((this.ponto.x - rc.x) / rc.largura) * W, y = ((this.ponto.y - rc.y) / rc.altura) * H, d = this.dpr;
    for (const [r, a] of [[16, 0.12], [10, 0.25]]) { g.beginPath(); g.arc(x, y, r * d, 0, 7); g.fillStyle = `rgba(255,255,255,${a})`; g.fill(); }
    g.beginPath(); g.arc(x, y, 10 * d, 0, 7); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1.2 * d; g.stroke();
    g.beginPath(); g.arc(x, y, 4 * d, 0, 7); g.fillStyle = this.corAnel; g.fill(); g.lineWidth = 2 * d; g.strokeStyle = '#fff'; g.stroke();
  }

  desenharLente(camadas) {
    // só o recorte ampliado; anel, marcas, retículo e arco do valor são o SVG do dial
    const g = this.lente.getContext('2d'), W = this.lente.width;
    const c = W / 2, r = c, L = LADO_LENTE;
    g.clearRect(0, 0, W, W);
    g.save(); g.beginPath(); g.arc(c, c, r, 0, 7); g.clip();
    for (const [im, alfa] of camadas) { g.globalAlpha = alfa; g.drawImage(im, this.ponto.x - L / 2, this.ponto.y - L / 2, L, L, 0, 0, W, W); }
    g.restore();
  }
}
