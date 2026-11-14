import { carregarTimeline, timeline, prepararLocal, valoresDoPasso, textosDimensoes, inicioMedicao, fonteDosDados } from './dados.js';
import { preCarregarFrames, desenharFrame } from './frames.js';
import { PainelTemperatura } from './painel-temperatura.js';
import { Grafico } from './grafico.js';
import { calcularTrilha, listarEventos } from './trilha.js';
import { carregarCidadesLocais, pedirLocalizacao, nomeDaCidade, buscarCidades } from './cidade.js';
import { Narrador } from './narrador.js';
import { Motor, BPM } from './audio/motor.js';
import { origemDosSons } from './audio/camadas.js';

const $ = (s) => document.querySelector(s);
const DIMS = [
  { id: 'co2', nome: 'Gás carbônico', sigla: 'CO₂', papel: 'base grave', cor: '#b98cff' },
  { id: 'temperatura', nome: 'Temperatura', sigla: 'Temperatura', papel: 'harmonia', cor: '#ff7a45' },
  { id: 'chuva', nome: 'Chuva', sigla: 'Chuva', papel: 'gotas agudas', cor: '#4fc3ff' },
  { id: 'vegetacao', nome: 'Vegetação', sigla: 'Vegetação', papel: 'cordas dedilhadas', cor: '#55e08a' },
];

// narração dos anos: desligada por padrão (pode ser ligada nos Ajustes)
const AJUSTES_PADRAO = { versao: 2, co2: true, temperatura: true, chuva: true, vegetacao: true, narracao: 'off', tic: true, volume: 80 };
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

// SÓ PARA TESTE: seletor Base01/02/03 da temperatura (sai na versão final, com o HTML e o CSS dele).
// A troca vale a partir do próximo compasso; a escolha fica lembrada neste navegador.
{
  const seletor = document.getElementById('seletor-base');
  const escolher = (base) => {
    motor.dims.temperatura.definirBase(base);
    for (const b of seletor.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.base === base));
    try { localStorage.setItem('jukebox-base-temp', base); } catch { /* ok */ }
  };
  seletor.addEventListener('click', (e) => { const b = e.target.closest('button[data-base]'); if (b) escolher(b.dataset.base); });
  let salva = null;
  try { salva = localStorage.getItem('jukebox-base-temp'); } catch { /* ok */ }
  escolher(motor.dims.temperatura.def.bases.includes(salva) ? salva : 'base01');
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
let regiao = null, cidade = null, primeiraCidade = true, trilha = null;
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
    status.textContent = 'Carregando dados…';
    await Promise.all([carregarTimeline(), carregarCidadesLocais()]);
    const n = timeline().passos.length;
    $('#slider-tempo').max = n - 1;
    montarDimensoes();
    painel = new PainelTemperatura({ tempo: () => motor.tempoContinuo(), passos: timeline().passos });
    $('#mapa-temp').addEventListener('click', () => abrirFrame(DIMS.find((d) => d.id === 'temperatura')));
    grafico = new Grafico($('#grafico'), {
      anos: timeline().passos.map((p) => p.inicio),
      aoAnunciar: anunciar,
      rotuloPonta: (id, idx) => `${DIMS.find((d) => d.id === id).sigla} ${curtos(idx)[id]}`,
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
    $('#btn-comecar').textContent = 'Começar';
  } catch (e) {
    console.error(e);
    status.textContent = 'Erro ao carregar. Verifique a internet e recarregue a página.';
    $('#alerta').textContent = status.textContent;
  }
}

$('#btn-comecar').addEventListener('click', async () => {
  const btn = $('#btn-comecar');
  btn.disabled = true;
  btn.textContent = 'Procurando sua localização…';
  // o áudio precisa ser destravado DENTRO do toque (iOS); ligar o motor fica para depois
  Tone.start();
  narrador.destravar();
  try {
    const pos = await pedirLocalizacao();
    const nome = await nomeDaCidade(pos.lat, pos.lon);
    await escolherCidade({ ...pos, ...nome });
  } catch (e) {
    const motivo = e.message === 'negado'
      ? 'Você não autorizou a localização. Sem problema: digite sua cidade.'
      : 'Não conseguimos encontrar sua localização. Digite sua cidade.';
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
  $('#status-busca').textContent = 'Buscando…';
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
    ? `${resultados.length} ${resultados.length === 1 ? 'cidade encontrada' : 'cidades encontradas'}. Escolha na lista abaixo.`
    : 'Nenhuma cidade encontrada. Tente outro nome.';
  if (imediato && resultados.length) lista.querySelector('button').focus();
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
    if (pMapas < 1) partes.push(`Lendo os mapas da NASA… ${Math.round(pMapas * 100)}%`);
    if (progressoSom < 1) partes.push(`Baixando os sons… ${Math.round(progressoSom * 100)}%`);
    // leitor de tela: avisa de 25 em 25%
    if (total - ultimoAviso >= 0.25 || total === 1) { ultimoAviso = total; st.textContent = partes.join(' · ') || 'Compondo a trilha…'; }
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
      anunciar(`Fim da música em ${passo(ultimo()).inicio}. Toque em Recomeçar para ouvir desde 1950.`);
    };
    aplicarAjustes();
    somLigado = true;
  }
  st.textContent = 'Compondo a trilha…';
  trilha = calcularTrilha(regiao, timeline().passos, timeline().global.co2);
  window.jukebox.trilha = trilha;
  window.jukebox.eventos = () => listarEventos(trilha, timeline().passos);
  motor.definirTrilha(trilha);
  grafico.definirTrilha(trilha);
  anunciar(`${c.nome}. Região: ${regiao.nome}.`);
  $('#nome-cidade').textContent = c.nome;
  $('#nome-regiao').textContent = `${c.detalhe ? c.detalhe + ' · ' : ''}Região: ${regiao.nome}`;
  mostrar('#tela-principal');
  $('#nome-cidade').focus();
  if (primeiraCidade) {
    primeiraCidade = false;
    motor.irPara(0);          // começa em 1950 e para no último ano do mapa da NASA (2023)
    motor.tocar();
    atualizarBotaoTocar();
  }
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
    li.innerHTML = `<h3><span aria-hidden="true">${d.sigla}</span><span class="sr-only">${d.nome} (${d.papel})</span></h3><p class="curto" aria-hidden="true"></p><p class="sr-only longo"></p><div class="barra" aria-hidden="true"><i></i></div>`;
    ul.append(li);
  }
}

/** Valores curtos do ano (ex.: "389 ppm", "+0,8 °C"), usados no gráfico. */
function curtos(idx) {
  if (!regiao) return {};
  const v = valoresDoPasso(regiao, idx);
  const b = v.bruto, ini = inicioMedicao(regiao);
  const sinal = (x, casas = 0) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas })}`;
  return {
    co2: b.co2 == null ? `desde ${ini.co2}` : `${Math.round(b.co2)} ppm`,
    temperatura: b.temperatura == null ? `desde ${ini.temperatura}` : `${sinal(b.temperatura, 1)} °C`,
    chuva: b.chuva == null ? `desde ${ini.chuva}` : `${sinal(b.chuva)}%`,
    vegetacao: v.vegetacao == null ? `desde ${ini.vegetacao}` : `${sinal((v.vegetacao.saude - 1) * 100)}%`,
  };
}

function atualizarUI(idx) {
  if (!regiao) return;
  const p = passo(idx);
  $('#ano-grande').textContent = p.rotulo;
  const slider = $('#slider-tempo');
  slider.value = idx;
  slider.setAttribute('aria-valuetext', p.falado);

  const v = valoresDoPasso(regiao, idx);
  const textos = textosDimensoes(regiao, idx);
  const curto = curtos(idx);
  const nivel = {
    co2: v.co2, temperatura: v.temperatura,
    chuva: v.chuva == null ? null : Math.max(0, Math.min(1, (v.chuva + 50) / 100)),
    vegetacao: v.vegetacao == null ? null : 1 - v.vegetacao.perda,
  };
  for (const d of DIMS) {
    const li = $(`#dim-${d.id}`);
    const desligada = !ajustes[d.id];
    li.classList.toggle('inativa', nivel[d.id] == null);
    li.classList.toggle('desligada', desligada);
    li.querySelector('.longo').textContent = desligada ? `Desligada nos ajustes. ${textos[d.id]}` : textos[d.id];
    li.querySelector('.curto').textContent = desligada ? 'desligada' : curto[d.id];
    li.querySelector('i').style.width = `${Math.round((nivel[d.id] ?? 0) * 100)}%`;
  }
  painel?.atualizar(idx, b0(idx));
}

/** Temperatura do ano (°C, lida do mapa da NASA), ou null. */
const b0 = (idx) => valoresDoPasso(regiao, idx).bruto.temperatura ?? null;

// ---------------------------------------------------------------- mapa ampliado
async function abrirFrame(d) {
  const dlgF = $('#frame-grande');
  const f = await desenharFrame($('#canvas-frame'), d.id, passo(motor.idx), cidade.lat, cidade.lon).catch(() => null);
  if (!f) return;
  $('#titulo-frame').textContent = `${d.nome} · ${f.data}`;
  const texto = `${f.titulo}. O ponto marca ${cidade.nome}. Fonte: ${f.fonte}.`;
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
  $('#rotulo-tocar').textContent = motor.tocando ? 'Pausar' : motor.terminou ? 'Recomeçar' : 'Tocar';
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

function aplicarAjustes() {
  for (const d of DIMS) { motor.definirDimensao(d.id, ajustes[d.id]); grafico?.definirLigada(d.id, ajustes[d.id]); }
  motor.definirVolume(ajustes.volume / 100);
  if (ajustes.narracao !== 'voz') narrador.cancelar();
  else narrador.carregar(timeline().passos);   // baixa as vozes só quando a pessoa liga a narração
  if (regiao) atualizarUI(motor.idx);
}

$('#btn-ajustes').addEventListener('click', () => {
  for (const d of DIMS) form.elements[`dim-${d.id}`].checked = ajustes[d.id];
  form.elements.narracao.value = ajustes.narracao;
  form.elements.tic.checked = ajustes.tic;
  form.elements.volume.value = ajustes.volume;
  const n = timeline().passos.length;
  const origem = Object.values(origemDosSons());
  const doMusico = origem.filter((o) => o === 'musico').length, prov = origem.filter((o) => o === 'provisorio').length;
  $('#aj-info').textContent = `${n} compassos (1 por ano), ${BPM} BPM. Sons: ${doMusico} do músico, ${prov} provisórios. Narração: ${narrador.descricao}. ${fonteDosDados() === 'frames' ? 'Temperatura lida da cor do mapa da NASA (GISTEMP) sobre a cidade; CO₂, chuva e vegetação ainda fictícios' : 'Valores por região (dados fictícios)'}.`;
  dlg.showModal();
});

form.addEventListener('change', () => {
  for (const d of DIMS) ajustes[d.id] = form.elements[`dim-${d.id}`].checked;
  ajustes.narracao = form.elements.narracao.value;
  ajustes.tic = form.elements.tic.checked;
  ajustes.volume = Number(form.elements.volume.value);
  salvarAjustes();
  aplicarAjustes();
});
form.elements.volume.addEventListener('input', () => motor.definirVolume(form.elements.volume.value / 100));

window.jukebox = { motor, narrador }; // para depurar no console
iniciar();
