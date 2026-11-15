import { carregarTimeline, timeline, prepararLocal, valoresDoPasso, textosDimensoes, inicioMedicao, fonteDosDados } from './dados.js';
import { preCarregarFrames, desenharFrame } from './frames.js';
import { PainelTemperatura } from './painel-temperatura.js';
import { Grafico } from './grafico.js';
import { calcularTrilha, listarEventos } from './trilha.js';
import { carregarCidadesLocais, pedirLocalizacao, nomeDaCidade, buscarCidades } from './cidade.js';
import { Narrador } from './narrador.js';
import { Motor, BPM } from './audio/motor.js';
import { origemDosSons } from './audio/camadas.js';
import { t, aplicarTextos, aoMudarIdioma, localidade, tempPar } from './i18n.js';

const $ = (s) => document.querySelector(s);
// nome, sigla e papel vêm do idioma escolhido (js/i18n.js)
const DIMS = [
  { id: 'temperatura', cor: '#FF5C9E' },
  { id: 'co2', cor: '#C77DFF' },
  { id: 'chuva', cor: '#53E2FF' },
].map((d) => Object.defineProperties(d, {
  nome: { get: () => t(`nome.${d.id}`) },
  sigla: { get: () => t(`sigla.${d.id}`) },
  papel: { get: () => t(`papel.${d.id}`) },
}));

// Quem abre a página pela primeira vez: temperatura e CO₂ ligados e sem narração (dá para mudar nos ajustes).
const AJUSTES_PADRAO = { versao: 2, co2: true, temperatura: true, chuva: false, narracao: 'off', tic: true, volume: 80 };
let ajustes = { ...AJUSTES_PADRAO };
try {
  const salvos = JSON.parse(localStorage.getItem('jukebox-ajustes') || '{}');
  if (salvos.versao !== 2) delete salvos.narracao;   // ajustes antigos: a narração vinha ligada sem a pessoa escolher
  ajustes = { ...AJUSTES_PADRAO, ...salvos, versao: 2 };
} catch { /* sem storage */ }
const salvarAjustes = () => { try { localStorage.setItem('jukebox-ajustes', JSON.stringify(ajustes)); } catch { /* ok */ } };

let grafico = null, painel = null;
const narrador = new Narrador();
const motor = new Motor();

// SÓ PARA TESTE: o botão vermelho "Teste" abre e fecha os seletores (já abertos com ?teste no endereço).
{
  const btn = $('#btn-teste'), barra = $('#barra-teste');
  const abrir = (sim) => { barra.hidden = !sim; btn.setAttribute('aria-expanded', String(sim)); };
  btn.addEventListener('click', () => abrir(barra.hidden));
  if (new URLSearchParams(location.search).has('teste')) abrir(true);
  // efeito CRT do mapa e da lente
  const seletor = $('#seletor-crt');
  const escolher = (crt) => {
    document.body.dataset.crt = crt;
    for (const b of seletor.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.crt === crt));
    try { localStorage.setItem('jukebox-crt', crt); } catch { /* ok */ }
  };
  seletor.addEventListener('click', (e) => { const b = e.target.closest('button[data-crt]'); if (b) escolher(b.dataset.crt); });
  let salvo = null; try { salvo = localStorage.getItem('jukebox-crt'); } catch { /* ok */ }
  escolher(salvo === 'linha' ? 'linha' : 'fosforo');
}
// SÓ PARA TESTE: seletor de som pontual da temperatura (Sem pontual / Pontual01). Começa sem pontual.
{
  const seletor = document.getElementById('seletor-pontual');
  seletor.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-pontual]');
    if (!b) return;
    motor.dims.temperatura.definirPontual(b.dataset.pontual || null);
    for (const x of seletor.querySelectorAll('button')) x.setAttribute('aria-checked', String(x === b));
  });
}
let regiao = null, cidade = null, trilha = null;
// sons: baixados em segundo plano desde a abertura; a tela "Preparando" espera por eles
let somPronto = null, progressoSom = 0, somLigado = false, aoProgressoSom = () => {};

// ---------------------------------------------------------------- utilidades
function anunciar(texto) {
  const el = $('#anuncio');
  el.textContent = '';
  setTimeout(() => { el.textContent = texto; }, 60);
}
function mostrar(id) {
  for (const t of ['#tela-inicio', '#tela-cidade', '#tela-carregando', '#tela-principal']) $(t).hidden = t !== id;
}
const passo = (i) => timeline().passos[i];
const ultimo = () => timeline().passos.length - 1;

// ---------------------------------------------------------------- início
async function iniciar() {
  const status = $('#status-carregamento');
  try {
    status.textContent = t('inicio.carregandoDados');
    await Promise.all([carregarTimeline(), carregarCidadesLocais()]);
    const n = timeline().passos.length;
    $('#slider-tempo').max = n - 1;
    montarDimensoes();
    painel = new PainelTemperatura({ tempo: () => motor.tempoContinuo(), passos: timeline().passos, valorEm: tempEm });
    $('#mapa-temp').addEventListener('click', () => abrirFrame(DIMS.find((d) => d.id === 'temperatura')));
    grafico = new Grafico($('#grafico'), {
      anos: timeline().passos.map((p) => p.inicio),
      aoAnunciar: anunciar,
      rotuloPonta: (id, idx, t) => `${DIMS.find((d) => d.id === id).sigla} ${id === 'temperatura' && tempEm(t) != null ? tempPar(tempEm(t)) : curtos(idx)[id]}`,
    });
    grafico.tempoAlvo = () => motor.tempoContinuo();
    window.jukebox.grafico = grafico;
    status.textContent = '';
    // tudo o que é pesado baixa em SEGUNDO PLANO, enquanto a pessoa autoriza o GPS ou escolhe a cidade
    somPronto = motor.preparar(n, (p) => { progressoSom = p; aoProgressoSom(p); });
    somPronto.catch((e) => console.error('Sons não carregaram', e));
    preCarregarFrames();
    if (ajustes.narracao === 'voz') narrador.carregar(timeline().passos); // só se a voz estiver ligada
    $('#btn-comecar').disabled = false;
    $('#btn-comecar').dataset.chave = 'inicio.comecar';
    $('#btn-comecar').textContent = t('inicio.comecar');
  } catch (e) {
    console.error(e);
    status.textContent = t('inicio.erro');
    $('#alerta').textContent = status.textContent;
  }
}

$('#btn-comecar').addEventListener('click', async () => {
  const btn = $('#btn-comecar');
  btn.disabled = true;
  btn.dataset.chave = 'inicio.procurando';
  btn.textContent = t('inicio.procurando');
  // o áudio precisa ser destravado DENTRO do toque (iOS); ligar o motor fica para depois
  Tone.start();
  narrador.destravar();
  try {
    const pos = await pedirLocalizacao();
    const nome = await nomeDaCidade(pos.lat, pos.lon);
    await escolherCidade({ ...pos, ...nome });
  } catch (e) {
    const motivo = e.message === 'negado'
      ? t('local.negado')
      : t('local.falhou');
    mostrarBusca(motivo, false);
  }
});

// ---------------------------------------------------------------- cidade
function mostrarBusca(motivo, podeCancelar) {
  mostrar('#tela-cidade');
  $('#motivo-busca').textContent = motivo;
  $('#btn-cancelar-busca').hidden = !podeCancelar;
  $('#resultados-cidade').innerHTML = '';
  $('#status-busca').textContent = '';
  $('#campo-cidade').value = '';
  $('#campo-cidade').focus();
}

let buscaAtual = 0, esperaBusca = null;
async function buscar(texto, imediato = false) {
  const id = ++buscaAtual;
  const lista = $('#resultados-cidade');
  if (texto.trim().length < 2) { lista.innerHTML = ''; return; }
  $('#status-busca').textContent = t('busca.buscando');
  const resultados = await buscarCidades(texto);
  if (id !== buscaAtual) return; // chegou uma busca mais nova
  lista.innerHTML = '';
  for (const c of resultados) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-secundario';
    b.innerHTML = `<span></span><span class="sub"></span>`;
    b.children[0].textContent = c.nome; b.children[1].textContent = c.detalhe;
    b.addEventListener('click', () => escolherCidade(c));
    li.append(b); lista.append(li);
  }
  $('#status-busca').textContent = resultados.length
    ? t('busca.achadas', { n: resultados.length })
    : t('busca.nenhuma');
  if (imediato && resultados.length) lista.querySelector('button').focus();
}

// cursor em bloco: acompanha a posição do cursor de texto
{
  const campo = $('#campo-cidade'), bloco = campo.parentElement.querySelector('.cursor-bloco'), espelho = bloco.querySelector('.espelho');
  const mover = () => {
    const i = campo.selectionStart ?? campo.value.length;
    espelho.textContent = campo.value.slice(0, i);
    // a letra sob o bloco aparece invertida (escura sobre o ciano), como nos terminais
    bloco.querySelector('i').textContent = campo.value[i] ?? (campo.value ? '' : campo.placeholder[0] ?? '');
    bloco.style.left = `${-campo.scrollLeft}px`;
  };
  for (const ev of ['input', 'keyup', 'click', 'focus', 'select', 'scroll']) campo.addEventListener(ev, () => requestAnimationFrame(mover));
  document.addEventListener('selectionchange', () => { if (document.activeElement === campo) mover(); });
}
$('#campo-cidade').addEventListener('input', (e) => {
  clearTimeout(esperaBusca);
  esperaBusca = setTimeout(() => buscar(e.target.value), 450);
});
$('#form-cidade').addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(esperaBusca);
  buscar($('#campo-cidade').value, true);
});
$('#btn-cancelar-busca').addEventListener('click', () => voltarParaPrincipal());
$('#btn-usar-local').addEventListener('click', async () => {
  const btn = $('#btn-usar-local'), st = $('#status-busca');
  btn.disabled = true;
  st.textContent = t('inicio.procurando');
  try {
    const pos = await pedirLocalizacao();
    const nome = await nomeDaCidade(pos.lat, pos.lon);
    await escolherCidade({ ...pos, ...nome });
  } catch (e) {
    st.textContent = e.message === 'negado'
      ? t('local.negado2')
      : t('local.falhou');
  } finally { btn.disabled = false; }
});
$('#btn-trocar-cidade').addEventListener('click', () => mostrarBusca('', true));

async function escolherCidade(c) {
  cidade = c;
  // tela "Preparando": lê os mapas da cidade e calcula a trilha antes de tocar
  mostrar('#tela-carregando');
  $('#carregando-cidade').textContent = c.nome;
  const barra = $('#progresso-cidade'), st = $('#status-cidade');
  $('#titulo-carregando').focus?.();
  // duas coisas em paralelo: ler os mapas da cidade e terminar de baixar os sons
  let pMapas = 0, ultimoAviso = -1;
  const mostrarProgresso = () => {
    const total = (pMapas + progressoSom) / 2;
    barra.value = Math.round(total * 100);
    const partes = [];
    if (pMapas < 1) partes.push(t('prep.mapas', { p: Math.round(pMapas * 100) }));
    if (progressoSom < 1) partes.push(t('prep.sons', { p: Math.round(progressoSom * 100) }));
    // leitor de tela: avisa de 25 em 25%
    if (total - ultimoAviso >= 0.25 || total === 1) { ultimoAviso = total; st.textContent = partes.join(' · ') || t('prep.compondo'); }
  };
  aoProgressoSom = mostrarProgresso;
  mostrarProgresso();
  [regiao] = await Promise.all([
    prepararLocal(c.lat, c.lon, (p) => { pMapas = p; mostrarProgresso(); }),
    somPronto,
  ]);
  aoProgressoSom = () => {};
  if (!somLigado) {
    await motor.ligar();
    narrador.aoFalar = (f) => motor.abaixarParaVoz(f);
    motor.aoMudarPasso = aoMudarPasso;
    motor.aoTerminar = () => {
      atualizarBotaoTocar();
      anunciar(t('fim', { ano: passo(ultimo()).inicio }));
    };
    aplicarAjustes();
    somLigado = true;
  }
  st.textContent = t('prep.compondo');
  trilha = calcularTrilha(regiao, timeline().passos, timeline().global.co2);
  window.jukebox.trilha = trilha;
  window.jukebox.eventos = () => listarEventos(trilha, timeline().passos);
  motor.definirTrilha(trilha);
  grafico.definirTrilha(trilha);
  aplicarAjustes();   // camadas sem dados (API fora do ar) ficam desligadas para esta cidade
  const semDados = DIMS.filter((d) => semDadosAgora(d.id)).map((d) => t(`nome.${d.id}`).toLowerCase());
  anunciar(t('anuncio.cidade', { cidade: c.nome, regiao: regiao.nome }) +
    (semDados.length ? ` ${t('anuncio.semDados', { camadas: semDados.join(', ') })}` : ''));
  $('#nome-cidade').textContent = c.nome;
  // só o país (o resto cortava no celular); a região climática vai para o leitor de tela no anúncio acima
  const pais = (c.detalhe || '').split(',').map((x) => x.trim()).filter(Boolean).pop() || '';
  $('#nome-regiao').textContent = pais;
  mostrar('#tela-principal');
  $('#nome-cidade').focus();
  // toda cidade (a primeira e as trocas) começa a música em 1950 e para no último ano do mapa da NASA (2023)
  motor.irPara(0);
  motor.tocar();
  atualizarBotaoTocar();
  painel.definirCidade(c, regiao);
  atualizarUI(motor.idx);
}

function voltarParaPrincipal() {
  if (!cidade) return;
  mostrar('#tela-principal');
  $('#nome-cidade').focus();
}

// ---------------------------------------------------------------- dimensões e UI
function montarDimensoes() {
  const ul = $('#lista-dimensoes');
  for (const d of DIMS) {
    const li = document.createElement('li');
    li.className = 'dim'; li.id = `dim-${d.id}`; li.style.setProperty('--cor', d.cor);
    li.innerHTML = `<h3><span aria-hidden="true" class="sigla"></span><span class="sr-only nome"></span></h3><p class="curto" aria-hidden="true"></p><p class="sr-only longo"></p><div class="barra" aria-hidden="true"><i></i></div>`;
    ul.append(li);
  }
  nomearDimensoes();
}
function nomearDimensoes() {
  for (const d of DIMS) {
    const li = $(`#dim-${d.id}`);
    li.querySelector('.sigla').textContent = d.sigla;
    li.querySelector('.nome').textContent = `${d.nome} (${d.papel})`;
  }
}

/** Valores curtos do ano (ex.: "389 ppm", "+0,8 °C"), usados no gráfico. */
function curtos(idx) {
  if (!regiao) return {};
  const v = valoresDoPasso(regiao, idx);
  const b = v.bruto, ini = inicioMedicao(regiao);
  const sinal = (x, casas = 0) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toLocaleString(localidade(), { maximumFractionDigits: casas, minimumFractionDigits: casas })}`;
  const desde = (ano) => t('desde', { ano });
  return {
    co2: b.co2 == null ? desde(ini.co2) : `${Math.round(b.co2)} ppm`,
    temperatura: b.temperatura == null ? desde(ini.temperatura) : tempPar(b.temperatura),
    chuva: b.chuva == null ? desde(ini.chuva) : `${sinal(b.chuva)}%`,
  };
}

function atualizarUI(idx) {
  if (!regiao) return;
  const p = passo(idx);
  $('#ano-grande').textContent = p.rotulo;
  const slider = $('#slider-tempo');
  slider.value = idx;
  slider.style.setProperty('--p', `${(idx / Math.max(1, ultimo())) * 100}%`);
  slider.setAttribute('aria-valuetext', p.falado);

  const v = valoresDoPasso(regiao, idx);
  const textos = textosDimensoes(regiao, idx);
  const curto = curtos(idx);
  const nivel = {
    co2: v.co2, temperatura: v.temperatura,
    chuva: v.chuva == null ? null : Math.max(0, Math.min(1, (v.chuva + 50) / 100)),
  };
  for (const d of DIMS) {
    const li = $(`#dim-${d.id}`);
    const semDados = semDadosAgora(d.id);
    const desligada = semDados || !ajustes[d.id];
    li.classList.toggle('inativa', nivel[d.id] == null);
    li.classList.toggle('desligada', desligada);
    li.querySelector('.longo').textContent = semDados ? t('dim.semDadosLonga')
      : desligada ? t('dim.desligadaLonga', { texto: textos[d.id] }) : textos[d.id];
    li.querySelector('.curto').textContent = semDados ? t('dim.semDadosCurta') : desligada ? t('dim.desligadaCurta') : curto[d.id];
    li.querySelector('i').style.width = `${Math.round((nivel[d.id] ?? 0) * 100)}%`;
  }
  painel?.atualizar(idx, b0(idx));
}

/** Temperatura do ano (°C, lida do mapa da NASA), ou null. */
const b0 = (idx) => valoresDoPasso(regiao, idx).bruto.temperatura ?? null;

/**
 * Temperatura no tempo contínuo t (em anos desde o início): anda do valor do ano até o do ano
 * seguinte ao longo do compasso, de 0,1 em 0,1, e só chega ao valor seguinte quando o ano seguinte
 * começa. Ex.: 0,0 e depois +0,5 → 0,0 · 0,1 · 0,2 · 0,3 · 0,4 (cada um 1/5 do compasso) → +0,5.
 */
function tempEm(t) {
  if (!regiao || t == null) return null;
  const n = timeline().passos.length;
  const tt = Math.max(0, Math.min(n - 1, t));
  const i = Math.floor(tt), f = tt - i;
  const a = b0(i);
  if (a == null) return null;
  const b = i + 1 < n ? b0(i + 1) : null;
  if (b == null) return a;
  const passos = Math.round(Math.abs(b - a) * 10);           // quantos 0,1 até o ano seguinte
  return Math.round(a * 10 + Math.sign(b - a) * Math.floor(passos * f + 1e-9)) / 10;
}
const sinalTemp = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toLocaleString(localidade(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

// ---------------------------------------------------------------- mapa ampliado
async function abrirFrame(d) {
  const dlgF = $('#frame-grande');
  const f = await desenharFrame($('#canvas-frame'), d.id, passo(motor.idx), cidade.lat, cidade.lon).catch(() => null);
  if (!f) return;
  $('#titulo-frame').textContent = `${d.nome} · ${f.data}`;
  const texto = t('mapa.legendaFrame', { titulo: f.titulo, cidade: cidade.nome, fonte: f.fonte });
  $('#legenda-frame').textContent = texto;
  $('#canvas-frame').setAttribute('aria-label', texto);
  dlgF.showModal();
}

function aoMudarPasso(idx, { narrar }) {
  if (scrub.ativo) return;
  atualizarUI(idx);
  if (!narrar || !motor.tocando) return;
  grafico.mostrarEventos(idx);
  const p = passo(idx);
  if (ajustes.narracao === 'voz') narrador.falar(p.narracao, String(p.inicio));
  else if (ajustes.narracao === 'leitor') anunciar(p.narracao);
}

// ---------------------------------------------------------------- tocar / pausar
function atualizarBotaoTocar() {
  const b = $('#btn-tocar');
  b.setAttribute('aria-pressed', String(motor.tocando));
  $('#rotulo-tocar').textContent = t(motor.tocando ? 'ctrl.pausar' : motor.terminou ? 'ctrl.recomecar' : 'ctrl.tocar');
}
function alternarTocar() {
  if (motor.tocando) { motor.pausar(); narrador.cancelar(); }
  else motor.tocar();
  atualizarBotaoTocar();
}
$('#btn-tocar').addEventListener('click', alternarTocar);

// ---------------------------------------------------------------- rebobinar (fita)
const scrub = { ativo: false, dir: 0, timer: null, intervalo: 420 };

function iniciarScrub(dir) {
  if (scrub.ativo) { scrub.dir = dir; motor.iniciarFita(dir); return; }
  narrador.cancelar();
  scrub.ativo = true; scrub.dir = dir; scrub.intervalo = 420;
  motor.iniciarFita(dir);
  $(dir < 0 ? '#btn-voltar' : '#btn-avancar').classList.add('ativo');
}

function passoScrub() {
  const novo = motor.idx + scrub.dir;
  if (novo < 0 || novo > ultimo()) return false;
  motor.irPara(novo);
  if (ajustes.tic) motor.tique(valoresDoPasso(regiao, novo).temperatura ?? 0.2);
  atualizarUI(novo);
  return true;
}

function repetirScrub() {
  scrub.timer = setTimeout(() => {
    if (!scrub.ativo) return;
    if (!passoScrub()) return;
    scrub.intervalo = Math.max(110, scrub.intervalo * 0.82);
    repetirScrub();
  }, scrub.intervalo);
}

function terminarScrub() {
  if (!scrub.ativo) return;
  clearTimeout(scrub.timer);
  scrub.ativo = false;
  document.querySelectorAll('.btn-controle.ativo').forEach((b) => b.classList.remove('ativo'));
  motor.terminarFita(true);
  atualizarBotaoTocar();
  atualizarUI(motor.idx);
  if (ajustes.narracao !== 'voz') anunciar(passo(motor.idx).falado);
}

function ligarBotaoFita(btn, dir) {
  let ultimoToque = 0;
  btn.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !regiao) return;
    btn.setPointerCapture?.(e.pointerId);
    iniciarScrub(dir);
    passoScrub();
    repetirScrub();
  });
  const soltar = () => { if (scrub.ativo) { terminarScrub(); ultimoToque = performance.now(); } };
  btn.addEventListener('pointerup', soltar);
  btn.addEventListener('pointercancel', soltar);
  btn.addEventListener('lostpointercapture', soltar);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  // teclado e leitores de tela: um clique = um passo
  btn.addEventListener('click', () => {
    if (performance.now() - ultimoToque < 700 || !regiao) return;
    iniciarScrub(dir);
    passoScrub();
    setTimeout(terminarScrub, 450);
  });
}
ligarBotaoFita($('#btn-voltar'), -1);
ligarBotaoFita($('#btn-avancar'), 1);

// slider: arrastar também rebobina
const slider = $('#slider-tempo');
let fimSlider = null;
slider.addEventListener('input', () => {
  if (!regiao) return;
  const alvo = Number(slider.value);
  if (alvo === motor.idx) return;
  iniciarScrub(alvo < motor.idx ? -1 : 1);
  motor.irPara(alvo);
  if (ajustes.tic) motor.tique(valoresDoPasso(regiao, alvo).temperatura ?? 0.2);
  atualizarUI(alvo);
  clearTimeout(fimSlider);
  fimSlider = setTimeout(terminarScrub, 1500);
});
slider.addEventListener('change', () => { clearTimeout(fimSlider); setTimeout(terminarScrub, 250); });

// atalhos de teclado
document.addEventListener('keydown', (e) => {
  if ($('#tela-principal').hidden || $('#ajustes').open) return;
  if (e.target.closest('input, select, textarea, button')) return;
  if (e.code === 'Space') { e.preventDefault(); alternarTocar(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    iniciarScrub(e.key === 'ArrowLeft' ? -1 : 1);
    passoScrub();
    clearTimeout(scrub.timer);
    scrub.timer = setTimeout(terminarScrub, 450);
  }
});

// ---------------------------------------------------------------- ajustes
const dlg = $('#ajustes');
const form = dlg.querySelector('form');

/** A camada não tem dados para esta cidade (a API da NASA falhou): fica desligada, sem mudar o ajuste salvo. */
const semDadosAgora = (id) => !!regiao?.indisponivel?.includes(id);

function aplicarAjustes() {
  for (const d of DIMS) {
    const ligada = ajustes[d.id] && !semDadosAgora(d.id);
    motor.definirDimensao(d.id, ligada); grafico?.definirLigada(d.id, ligada);
  }
  motor.definirVolume(ajustes.volume / 100);
  if (ajustes.narracao !== 'voz') narrador.cancelar();
  else narrador.carregar(timeline().passos);   // baixa as vozes só quando a pessoa liga a narração
  if (regiao) atualizarUI(motor.idx);
}

$('#btn-ajustes').addEventListener('click', () => {
  for (const d of DIMS) {
    const caixa = form.elements[`dim-${d.id}`], semDados = semDadosAgora(d.id);
    caixa.checked = ajustes[d.id] && !semDados;
    caixa.disabled = semDados;
    let aviso = caixa.parentElement.querySelector('.sem-dados');
    if (semDados && !aviso) { aviso = document.createElement('small'); aviso.className = 'sem-dados'; caixa.parentElement.append(' ', aviso); }
    if (aviso) aviso.textContent = semDados ? t('aj.semDados') : '';
  }
  form.elements.narracao.value = ajustes.narracao;
  form.elements.tic.checked = ajustes.tic;
  form.elements.volume.value = ajustes.volume;
  const n = timeline().passos.length;
  const origem = Object.values(origemDosSons());
  const doMusico = origem.filter((o) => o === 'musico').length, prov = origem.filter((o) => o === 'provisorio').length;
  $('#aj-info').textContent = t('aj.info', { n, bpm: BPM, musico: doMusico, prov, narr: narrador.descricao, frames: fonteDosDados() === 'frames' });
  dlg.showModal();
});

form.addEventListener('change', () => {
  for (const d of DIMS) if (!form.elements[`dim-${d.id}`].disabled) ajustes[d.id] = form.elements[`dim-${d.id}`].checked;
  ajustes.narracao = form.elements.narracao.value;
  ajustes.tic = form.elements.tic.checked;
  ajustes.volume = Number(form.elements.volume.value);
  salvarAjustes();
  aplicarAjustes();
});
form.elements.volume.addEventListener('input', () => motor.definirVolume(form.elements.volume.value / 100));

// ---------------------------------------------------------------- idioma
aplicarTextos();
aoMudarIdioma(() => {
  const btn = $('#btn-comecar');
  btn.textContent = t(btn.dataset.chave || 'inicio.carregando');
  if ($('#lista-dimensoes').children.length) nomearDimensoes();
  atualizarBotaoTocar();
  if (regiao) atualizarUI(motor.idx);
  painel?.atualizarIdioma?.();
  grafico?.atualizarIdioma?.();
});

window.jukebox = { motor, narrador }; // para depurar no console
iniciar();
