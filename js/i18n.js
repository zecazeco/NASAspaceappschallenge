// Idiomas do site: português (pt) e inglês (en).
// • Textos fixos do HTML: atributo data-i18n="chave" (troca o conteúdo) e
//   data-i18n-attr="aria-label:chave; placeholder:chave" (troca atributos).
// • Textos montados no JavaScript: t('chave', { variáveis }).
// • Na primeira visita, abre sempre em inglês (e °F), seja qual for o idioma do navegador; a escolha
//   nos botões PT / EN fica salva neste navegador e passa a valer nas próximas visitas.

const TEXTOS = {
  pt: {
    'titulo.pagina': 'Jukebox da Terra',
    'idioma.grupo': 'Idioma',
    'unidade.grupo': 'Unidade de temperatura',
    'inicio.titulo': 'Jukebox da Terra',
    'inicio.lead': 'Ouça o clima da sua cidade mudar de 1950 até hoje.',
    'inicio.dados': 'Cada som é um dado real: <strong>temperatura</strong> e <strong>chuva</strong> da NASA, <strong>gás carbônico</strong> da NOAA.',
    'inicio.fones': 'Use fones de ouvido.',
    'inicio.local': 'Vamos pedir sua localização. Se preferir não compartilhar, você pode digitar a cidade.',
    'inicio.carregando': 'Carregando…',
    'inicio.comecar': 'Começar',
    'inicio.carregandoDados': 'Carregando dados…',
    'inicio.erro': 'Erro ao carregar. Verifique a internet e recarregue a página.',
    'inicio.procurando': 'Procurando sua localização…',
    'local.negado': 'Você não autorizou a localização. Sem problema: digite sua cidade.',
    'local.falhou': 'Não conseguimos encontrar sua localização. Digite sua cidade.',
    'local.negado2': 'A localização não foi autorizada. Digite sua cidade.',
    'local.perto': ({ nome }) => `Perto de ${nome}`,
    'local.sua': 'Sua localização',
    'busca.titulo': 'Qual é a sua cidade?',
    'busca.rotulo': 'Digite o nome de qualquer cidade do mundo',
    'busca.placeholder': 'sua cidade',
    'busca.buscar': 'Buscar',
    'busca.lista': 'Cidades encontradas',
    'busca.buscando': 'Buscando…',
    'busca.achadas': ({ n }) => `${n} ${n === 1 ? 'cidade encontrada' : 'cidades encontradas'}. Escolha na lista abaixo.`,
    'busca.nenhuma': 'Nenhuma cidade encontrada. Tente outro nome.',
    'busca.usarLocal': 'Usar minha localização',
    'busca.cancelar': 'Cancelar',
    'prep.titulo': 'Preparando a música',
    'prep.porcentagem': ({ p }) => `${p}%`,
    'prep.erro': 'Não foi possível baixar tudo o que a música precisa. Verifique a internet e tente de novo.',
    'prep.tentar': 'Tentar de novo',
    'topo.trocar': 'Cidade',
    'topo.trocarCidade': 'Trocar cidade',
    'topo.ajustes': 'Ajustes',
    'teste.botao': 'Teste',
    'teste.rotulo': 'Modo de teste: mostrar seletores de som e efeito',
    'mapa.titulo': 'Mapa de temperatura da NASA',
    'mapa.rotulo': 'NASA · anomalia de temperatura',
    'mapa.ampliar': ({ ano, cidade }) => `Ampliar o mapa de temperatura da NASA de ${ano}. O ponto marca ${cidade}.`,
    'mapa.ampliarSimples': 'Ampliar o mapa de temperatura da NASA',
    'mapa.aCidade': 'a cidade',
    'mapa.legendaFrame': ({ titulo, cidade, fonte }) => `${titulo}. O ponto marca ${cidade}. Fonte: ${fonte}.`,
    // legenda curta do dial; o ano e o período vão só para o leitor de tela; ¹ = nota "O que é anomalia?" no rodapé
    'temp.igual': ({ ano }) => `igual à média<a class="nota-ref" href="#nota-1" aria-label="nota 1">¹</a><span class="sr-only"> de 1951–1980, em ${ano}</span>`,
    'temp.quente': ({ ano }) => `mais quente que a média<a class="nota-ref" href="#nota-1" aria-label="nota 1">¹</a><span class="sr-only"> de 1951–1980, em ${ano}</span>`,
    'temp.frio': ({ ano }) => `mais frio que a média<a class="nota-ref" href="#nota-1" aria-label="nota 1">¹</a><span class="sr-only"> de 1951–1980, em ${ano}</span>`,
    'temp.semDado': ({ ano }) => `sem dado do mapa em ${ano}`,
    'dims.titulo': 'O que você está ouvindo',
    'ouvindo.titulo': 'O que você está ouvindo',
    'ouvindo.texto': ({ cidade }) => `Você está ouvindo quanto ${cidade} ficou mais quente ou mais fria a cada ano.`,
    'notas.titulo': 'Sobre os dados',
    'nota.1': 'Comparado à própria média da cidade entre 1951 e 1980.',
    'nota.2': '<strong>O que você está ouvindo:</strong> quanto a cidade esteve mais quente ou mais fria a cada ano, comparado à própria média de 1951–1980. O piano mostra se a temperatura está subindo ou descendo; o som de fundo fica mais agudo conforme a cidade esquenta.',
    'nota.3': '<strong>O que é “anomalia”?</strong> Em ciência do clima, é só a diferença para uma referência, e não algo estranho. A anomalia de temperatura é quanto um ano ficou mais quente ou mais frio que a média do mesmo lugar entre 1951 e 1980. Assim dá para comparar lugares muito diferentes: Manaus e Oslo podem ter esquentado +1 °C em relação ao normal de cada uma.',
    'grafico.rotulo': 'Gráfico das três camadas ao longo dos anos. Os valores do ano estão na lista O que você está ouvindo, e os eventos são anunciados enquanto a música toca.',
    'grafico.agora': 'Agora',
    'grafico.dica': 'Arraste o gráfico para os lados para ver os eventos passados. Toque num ponto para ler o evento.',
    'grafico.agoraRotulo': 'Voltar o gráfico para o ano que está tocando',
    'tempo.titulo': 'Linha do tempo',
    'tempo.ano': 'Ano',
    'ctrl.voltar': 'Voltar',
    'ctrl.tocar': 'Tocar',
    'ctrl.pausar': 'Pausar',
    'ctrl.recomecar': 'Recomeçar',
    'ctrl.avancar': 'Avançar',
    'fim': ({ ano }) => `Fim da música em ${ano}. Toque em Recomeçar para ouvir desde 1950.`,
    'anuncio.cidade': ({ cidade, regiao }) => `${cidade}. Região: ${regiao}.`,
    'creditos': 'Temperatura: <a href="https://svs.gsfc.nasa.gov/5207/" target="_blank" rel="noopener">NASA SVS 5207 (GISTEMP v4)</a> · Chuva: <a href="https://power.larc.nasa.gov/" target="_blank" rel="noopener">NASA POWER (MERRA-2)</a> · CO₂: <a href="https://gml.noaa.gov/ccgg/trends/" target="_blank" rel="noopener">NOAA GML, Mauna Loa</a> (Lan, NOAA/GML, e Keeling, Scripps)',
    'fechar': 'Fechar',
    'aj.titulo': 'Ajustes',
    'aj.fechar': 'Fechar ajustes',
    'aj.camadas': 'Camadas (instrumentos)',
    'aj.co2': 'Gás carbônico: drone grave',
    'aj.temperatura': 'Temperatura: melodia',
    'aj.tendencia': 'Tendência da temperatura: faixas de 1 °C',
    'aj.chuva': 'Chuva: gotas agudas',
    'aj.unidade': 'Unidade de temperatura',
    'aj.tic': 'Tic a cada ano ao rebobinar',
    'aj.volume': 'Volume da música',
    'aj.info': ({ n, bpm, musico, prov, frames }) => `${n} compassos (1 por ano), ${bpm} BPM. Sons: ${musico} do músico, ${prov} provisórios. ${frames ? 'Temperatura lida da cor do mapa da NASA (GISTEMP) sobre a cidade; chuva da NASA POWER; CO₂ da NOAA (Mauna Loa)' : 'Valores por região (dados fictícios)'}.`,
    // camadas
    'nome.co2': 'Gás carbônico', 'sigla.co2': 'CO₂', 'papel.co2': 'base grave',
    'nome.temperatura': 'Temperatura', 'sigla.temperatura': 'Temp', 'papel.temperatura': 'melodia',
    'nome.tendencia': 'Tendência da temperatura', 'sigla.tendencia': 'Tendência', 'papel.tendencia': 'faixas de 1 °C, pulso que sobe de nota',
    'nome.chuva': 'Chuva', 'sigla.chuva': 'Chuva', 'papel.chuva': 'gotas agudas',
    'desde': ({ ano }) => `desde ${ano}`,
    'media': ({ v }) => `${v}`,
    'tend.sem': 'Ainda sem média.',
    'tend.texto': ({ v, nivel }) => `Média dos 11 anos em volta: ${v}, nível ${nivel} de 4`,
    'dim.naoMedido': ({ ano }) => `Ainda não medido. Começa em ${ano}.`,
    'dim.naoMedida': ({ ano }) => `Ainda não medida. Começa em ${ano}.`,
    'dim.co2': ({ v }) => `${v} ppm no planeta`,
    'dim.temp': ({ v }) => `${v} em relação a 1951–1980`,
    'dim.chuva': ({ v, tipo }) => `${v}% ${tipo === 'seca' ? '(seca)' : tipo === 'extrema' ? '(chuva extrema)' : 'em relação à média'}`,
    'dim.desligada': 'desligada',
    'dim.desligadaLonga': ({ texto }) => `Desligada nos ajustes. ${texto}`,
    'dim.desligadaCurta': 'desligada',
    'dim.semDadosCurta': 'sem dados',
    'dim.semDadosLonga': 'Os dados da NASA não puderam ser carregados agora, então esta camada foi desligada.',
    'aj.semDados': '(sem dados agora)',
    'anuncio.semDados': ({ camadas }) => `Sem dados de ${camadas} agora; essa camada foi desligada.`,
    // eventos do gráfico
    'ev.co2.recorde': ({ v }) => `O CO₂ subiu ${v} ppm: mais rápido que em qualquer ano anterior`,
    'ev.co2.faixa': ({ n, v }) => `O CO₂ já percorreu ${['', 'um quinto', 'dois quintos', 'três quintos', 'quatro quintos'][n]} de toda a subida até 2023 (${v} ppm)`,
    'ev.temperatura.recorde': ({ v }) => `O ano mais quente já medido aqui (${v})`,
    'ev.chuva.seca': ({ v }) => `Seca: ${v}% de chuva`,
    'ev.chuva.extrema': ({ v }) => `Chuva extrema: +${v}%`,
    'res.co2.recorde': 'Recorde CO₂',
    'res.co2.faixa': ({ n }) => `CO₂ ${n}/5`,
    'res.temperatura.recorde': 'Recorde de calor',
    'res.chuva.seca': 'Seca',
    'res.chuva.extrema': 'Chuva extrema',
  },
  en: {
    'titulo.pagina': 'Earth Jukebox',
    'idioma.grupo': 'Language',
    'unidade.grupo': 'Temperature unit',
    'inicio.titulo': 'Earth Jukebox',
    'inicio.lead': 'Hear your city’s climate change from 1950 to today.',
    'inicio.dados': 'Every sound is real data: <strong>temperature</strong> and <strong>rainfall</strong> from NASA, <strong>carbon dioxide</strong> from NOAA.',
    'inicio.fones': 'Use headphones.',
    'inicio.local': 'We’ll ask for your location. If you’d rather not share it, you can type your city.',
    'inicio.carregando': 'Loading…',
    'inicio.comecar': 'Start',
    'inicio.carregandoDados': 'Loading data…',
    'inicio.erro': 'Loading failed. Check your connection and reload the page.',
    'inicio.procurando': 'Finding your location…',
    'local.negado': 'You didn’t allow location access. No problem: type your city.',
    'local.falhou': 'We couldn’t find your location. Type your city.',
    'local.negado2': 'Location access wasn’t allowed. Type your city.',
    'local.perto': ({ nome }) => `Near ${nome}`,
    'local.sua': 'Your location',
    'busca.titulo': 'What’s your city?',
    'busca.rotulo': 'Type the name of any city in the world',
    'busca.placeholder': 'your city',
    'busca.buscar': 'Search',
    'busca.lista': 'Cities found',
    'busca.buscando': 'Searching…',
    'busca.achadas': ({ n }) => `${n} ${n === 1 ? 'city found' : 'cities found'}. Pick one from the list below.`,
    'busca.nenhuma': 'No city found. Try another name.',
    'busca.usarLocal': 'Use my location',
    'busca.cancelar': 'Cancel',
    'prep.titulo': 'Preparing the music',
    'prep.porcentagem': ({ p }) => `${p}%`,
    'prep.erro': 'Could not download everything the music needs. Check your connection and try again.',
    'prep.tentar': 'Try again',
    'topo.trocar': 'City',
    'topo.trocarCidade': 'Change city',
    'topo.ajustes': 'Settings',
    'teste.botao': 'Test',
    'teste.rotulo': 'Test mode: show sound and effect selectors',
    'mapa.titulo': 'NASA temperature map',
    'mapa.rotulo': 'NASA · temperature anomaly',
    'mapa.ampliar': ({ ano, cidade }) => `Enlarge the NASA temperature map for ${ano}. The dot marks ${cidade}.`,
    'mapa.ampliarSimples': 'Enlarge the NASA temperature map',
    'mapa.aCidade': 'the city',
    'mapa.legendaFrame': ({ titulo, cidade, fonte }) => `${titulo}. The dot marks ${cidade}. Source: ${fonte}.`,
    'temp.igual': ({ ano }) => `same as average<a class="nota-ref" href="#nota-1" aria-label="note 1">¹</a><span class="sr-only"> for 1951–1980, in ${ano}</span>`,
    'temp.quente': ({ ano }) => `warmer than average<a class="nota-ref" href="#nota-1" aria-label="note 1">¹</a><span class="sr-only"> for 1951–1980, in ${ano}</span>`,
    'temp.frio': ({ ano }) => `colder than average<a class="nota-ref" href="#nota-1" aria-label="note 1">¹</a><span class="sr-only"> for 1951–1980, in ${ano}</span>`,
    'temp.semDado': ({ ano }) => `no map data for ${ano}`,
    'dims.titulo': 'What you are hearing',
    'ouvindo.titulo': 'What you’re hearing',
    'ouvindo.texto': ({ cidade }) => `You’re hearing how much warmer or cooler ${cidade} got each year.`,
    'notas.titulo': 'About the data',
    'nota.1': 'Compared with the city’s own 1951–1980 average.',
    'nota.2': '<strong>What you’re hearing:</strong> how much warmer or cooler the city was each year, compared with its own 1951–1980 average. The piano shows whether it’s heading up or down; the deeper background tone gets higher as the city gets warmer.',
    'nota.3': '<strong>What is an “anomaly”?</strong> In climate science, it just means a difference from a reference, not something strange. A temperature anomaly is how much warmer or cooler a year was than the average for the same place in 1951–1980. This lets us compare very different places: Manaus and Oslo can both be +1 °C warmer than their own normal.',
    'grafico.rotulo': 'Chart of the three layers over the years. The values of the year are in the list What you are hearing, and the events are announced as the music plays.',
    'grafico.agora': 'Now',
    'grafico.dica': 'Drag the chart sideways to see past events. Tap a point to read the event.',
    'grafico.agoraRotulo': 'Bring the chart back to the year that is playing',
    'tempo.titulo': 'Timeline',
    'tempo.ano': 'Year',
    'ctrl.voltar': 'Rewind',
    'ctrl.tocar': 'Play',
    'ctrl.pausar': 'Pause',
    'ctrl.recomecar': 'Restart',
    'ctrl.avancar': 'Forward',
    'fim': ({ ano }) => `The track ends in ${ano}. Tap Restart to listen again from 1950.`,
    'anuncio.cidade': ({ cidade, regiao }) => `${cidade}. Region: ${regiao}.`,
    'creditos': 'Temperature: <a href="https://svs.gsfc.nasa.gov/5207/" target="_blank" rel="noopener">NASA SVS 5207 (GISTEMP v4)</a> · Rainfall: <a href="https://power.larc.nasa.gov/" target="_blank" rel="noopener">NASA POWER (MERRA-2)</a> · CO₂: <a href="https://gml.noaa.gov/ccgg/trends/" target="_blank" rel="noopener">NOAA GML, Mauna Loa</a> (Lan, NOAA/GML, and Keeling, Scripps)',
    'fechar': 'Close',
    'aj.titulo': 'Settings',
    'aj.fechar': 'Close settings',
    'aj.camadas': 'Layers (instruments)',
    'aj.co2': 'Carbon dioxide: low drone',
    'aj.temperatura': 'Temperature: melody',
    'aj.tendencia': 'Temperature trend: 1 °C bands',
    'aj.chuva': 'Rainfall: high-pitched drops',
    'aj.unidade': 'Temperature unit',
    'aj.tic': 'Tick on each year while rewinding',
    'aj.volume': 'Music volume',
    'aj.info': ({ n, bpm, musico, prov, frames }) => `${n} bars (1 per year), ${bpm} BPM. Sounds: ${musico} by the musician, ${prov} placeholders. ${frames ? 'Temperature read from the color of the NASA map (GISTEMP) over the city; rainfall from NASA POWER; CO₂ from NOAA (Mauna Loa)' : 'Values by region (placeholder data)'}.`,
    'nome.co2': 'Carbon dioxide', 'sigla.co2': 'CO₂', 'papel.co2': 'low drone',
    'nome.temperatura': 'Temperature', 'sigla.temperatura': 'Temp', 'papel.temperatura': 'melody',
    'nome.tendencia': 'Temperature trend', 'sigla.tendencia': 'Trend', 'papel.tendencia': '1 °C bands, a pulse that rises in pitch',
    'nome.chuva': 'Rainfall', 'sigla.chuva': 'Rainfall', 'papel.chuva': 'high-pitched drops',
    'desde': ({ ano }) => `from ${ano}`,
    'media': ({ v }) => `${v}`,
    'tend.sem': 'No average yet.',
    'tend.texto': ({ v, nivel }) => `Average of the 11 surrounding years: ${v}, level ${nivel} of 4`,
    'dim.naoMedido': ({ ano }) => `Not measured yet. Starts in ${ano}.`,
    'dim.naoMedida': ({ ano }) => `Not measured yet. Starts in ${ano}.`,
    'dim.co2': ({ v }) => `${v} ppm worldwide`,
    'dim.temp': ({ v }) => `${v} vs. the 1951–1980 average`,
    'dim.chuva': ({ v, tipo }) => `${v}% ${tipo === 'seca' ? '(drought)' : tipo === 'extrema' ? '(extreme rain)' : 'compared with the average'}`,
    'dim.desligada': 'off',
    'dim.desligadaLonga': ({ texto }) => `Turned off in settings. ${texto}`,
    'dim.desligadaCurta': 'off',
    'dim.semDadosCurta': 'no data',
    'dim.semDadosLonga': 'The NASA data could not be loaded right now, so this layer was turned off.',
    'aj.semDados': '(no data right now)',
    'anuncio.semDados': ({ camadas }) => `No ${camadas} data right now; that layer was turned off.`,
    'ev.co2.recorde': ({ v }) => `CO₂ rose ${v} ppm: faster than in any previous year`,
    'ev.co2.faixa': ({ n, v }) => `CO₂ has now covered ${['', 'one fifth', 'two fifths', 'three fifths', 'four fifths'][n]} of its whole rise up to 2023 (${v} ppm)`,
    'ev.temperatura.recorde': ({ v }) => `The hottest year on record here (${v})`,
    'ev.chuva.seca': ({ v }) => `Drought: ${v}% rainfall`,
    'ev.chuva.extrema': ({ v }) => `Extreme rain: +${v}%`,
    'res.co2.recorde': 'Record CO₂ rise',
    'res.co2.faixa': ({ n }) => `CO₂ ${n}/5`,
    'res.temperatura.recorde': 'Record heat',
    'res.chuva.seca': 'Drought',
    'res.chuva.extrema': 'Extreme rain',
  },
};

// Idioma: a escolha salva da pessoa (botões PT / EN); se não houver, sempre en (o do navegador é ignorado).
// A mesma regra está no script do <head> do index.html, que roda antes de tudo e, só para quem salvou pt,
// esconde a página até ela estar traduzida — mantenha as duas iguais.
let idioma = (() => {
  try { const s = localStorage.getItem('jukebox-idioma'); if (s === 'pt' || s === 'en') return s; } catch { /* sem storage */ }
  return 'en';
})();
const ouvintes = [];

export const lingua = () => idioma;
export const localidade = () => (idioma === 'pt' ? 'pt-BR' : 'en-US');

/** Texto da chave no idioma atual (cai no português se faltar). */
export function t(chave, v = {}) {
  const s = TEXTOS[idioma][chave] ?? TEXTOS.pt[chave] ?? chave;
  return typeof s === 'function' ? s(v) : s;
}

/** Número no formato do idioma (vírgula ou ponto decimal). */
export const numero = (v, casas = 1) => v.toLocaleString(localidade(), { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Aplica os textos fixos do HTML. */
export function aplicarTextos(raiz = document) {
  document.documentElement.lang = idioma === 'pt' ? 'pt-BR' : 'en';
  document.title = t('titulo.pagina');
  for (const el of raiz.querySelectorAll('[data-i18n]')) el.innerHTML = t(el.dataset.i18n);
  for (const el of raiz.querySelectorAll('[data-i18n-attr]')) {
    for (const par of el.dataset.i18nAttr.split(';')) {
      const [attr, chave] = par.split(':').map((x) => x.trim());
      if (attr && chave) el.setAttribute(attr, t(chave));
    }
  }
  for (const b of raiz.querySelectorAll('[data-idioma]')) b.setAttribute('aria-pressed', String(b.dataset.idioma === idioma));
  marcarUnidade();
}

export function definirIdioma(novo) {
  if (novo !== 'pt' && novo !== 'en') return;
  idioma = novo;
  try { localStorage.setItem('jukebox-idioma', novo); } catch { /* ok */ }
  aplicarTextos();
  for (const f of ouvintes) f(novo);
}
export const aoMudarIdioma = (f) => ouvintes.push(f);

// ---------------------------------------------------------------- unidade de temperatura
// Toda a lógica é em °C (os mapas da NASA que lemos são em °C); °F é só na hora de mostrar.
// Os valores são ANOMALIAS (diferença em relação à média de 1951–1980): a conversão é só × 1,8, sem o +32.
// Padrão: sempre °F (em qualquer idioma) até a pessoa escolher nos botões °C / °F;
// a escolha fica salva e passa a valer em qualquer idioma. O par aparece sempre: "+2,9 °F (+1,6 °C)".
let unidadeEscolhida = (() => {
  try { const s = localStorage.getItem('jukebox-unidade'); if (s === 'c' || s === 'f') return s; } catch { /* sem storage */ }
  return null;
})();
export const unidade = () => unidadeEscolhida ?? 'f';
const outra = (u) => (u === 'c' ? 'f' : 'c');
const sinal = (v) => (v >= 0 ? '+' : '−');
/** Anomalia em °C convertida para a unidade pedida, com sinal e uma casa: "+1,6". */
export const valorNa = (vC, u = unidade()) => { const v = u === 'f' ? vC * 1.8 : vC; return `${sinal(v)}${numero(Math.abs(v), 1)}`; };
/** "+1,6 °C" (ou "+2,9 °F"). */
export const temp = (vC, u = unidade()) => `${valorNa(vC, u)} °${u.toUpperCase()}`;
/** "+1,6 °C (+2,9 °F)": a unidade escolhida e a outra entre parênteses. */
export const tempPar = (vC) => `${temp(vC)} (${temp(vC, outra(unidade()))})`;
export const unidadeSecundaria = () => outra(unidade());

function marcarUnidade() {
  document.body.dataset.unidadeAtiva = unidade();   // (não usar data-unidade no body: os botões são achados por [data-unidade])
  for (const b of document.querySelectorAll('[data-unidade]')) b.setAttribute('aria-pressed', String(b.dataset.unidade === unidade()));
}
export function definirUnidade(u) {
  if (u !== 'c' && u !== 'f') return;
  unidadeEscolhida = u;
  try { localStorage.setItem('jukebox-unidade', u); } catch { /* ok */ }
  marcarUnidade();
  for (const f of ouvintes) f(idioma);
}

// Este módulo é o primeiro script da página (index.html): traduz assim que o HTML termina de ser lido,
// sem esperar Tone.js, d3 e o resto do site, e mostra a página (o <head> a escondeu, se precisava traduzir).
aplicarTextos();
document.documentElement.classList.remove('traduzindo');

// botões PT / EN (no início e no rodapé) e °C / °F (no rodapé)
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-idioma]');
  if (b) definirIdioma(b.dataset.idioma);
  const u = e.target.closest('button[data-unidade]');
  if (u) definirUnidade(u.dataset.unidade);
});
