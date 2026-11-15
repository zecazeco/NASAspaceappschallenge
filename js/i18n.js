// Idiomas do site: português (pt) e inglês (en).
// • Textos fixos do HTML: atributo data-i18n="chave" (troca o conteúdo) e
//   data-i18n-attr="aria-label:chave; placeholder:chave" (troca atributos).
// • Textos montados no JavaScript: t('chave', { variáveis }).
// • A escolha fica salva neste navegador; na primeira visita, abre em inglês.

const TEXTOS = {
  pt: {
    'titulo.pagina': 'Jukebox da Terra',
    'idioma.grupo': 'Idioma',
    'inicio.titulo': 'Jukebox da Terra',
    'inicio.lead': 'Ouça o clima da sua cidade mudar de 1950 até hoje.',
    'inicio.dados': 'Cada som é um dado da NASA: <strong>gás carbônico</strong>, <strong>temperatura</strong> e <strong>chuva</strong>.',
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
    'prep.mapas': ({ p }) => `Lendo os mapas da NASA… ${p}%`,
    'prep.sons': ({ p }) => `Baixando os sons… ${p}%`,
    'prep.compondo': 'Compondo a trilha…',
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
    'temp.igual': ({ ano }) => `igual à média de 1951–1980, em ${ano}`,
    'temp.quente': ({ ano }) => `mais quente que a média de 1951–1980, em ${ano}`,
    'temp.frio': ({ ano }) => `mais frio que a média de 1951–1980, em ${ano}`,
    'temp.semDado': ({ ano }) => `sem dado do mapa em ${ano}`,
    'dims.titulo': 'O que você está ouvindo',
    'grafico.rotulo': 'Gráfico das quatro camadas ao longo dos anos. Arraste para os lados para ver o passado e o futuro.',
    'grafico.agora': 'Agora',
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
    'aj.tendencia': 'Tendência da temperatura: média de 11 anos',
    'aj.chuva': 'Chuva: gotas agudas',
    'aj.narracao': 'Narração dos anos',
    'aj.narr.off': 'Desligada',
    'aj.narr.voz': 'Voz do app',
    'aj.narr.leitor': 'Só pelo leitor de tela',
    'aj.tic': 'Tic a cada ano ao rebobinar',
    'aj.volume': 'Volume da música',
    'narr.gravada': ({ n }) => `voz gravada (${n} arquivos)`,
    'narr.navegador': ({ nome }) => `voz do navegador: ${nome}`,
    'narr.sem': 'sem voz disponível',
    'aj.info': ({ n, bpm, musico, prov, narr, frames }) => `${n} compassos (1 por ano), ${bpm} BPM. Sons: ${musico} do músico, ${prov} provisórios. Narração: ${narr}. ${frames ? 'Temperatura lida da cor do mapa da NASA (GISTEMP) sobre a cidade; chuva da NASA POWER; CO₂ da NOAA (Mauna Loa)' : 'Valores por região (dados fictícios)'}.`,
    // camadas
    'nome.co2': 'Gás carbônico', 'sigla.co2': 'CO₂', 'papel.co2': 'base grave',
    'nome.temperatura': 'Temperatura', 'sigla.temperatura': 'Temp', 'papel.temperatura': 'melodia',
    'nome.tendencia': 'Tendência da temperatura', 'sigla.tendencia': 'Tendência', 'papel.tendencia': 'média de 11 anos, pulso que sobe de nota',
    'nome.chuva': 'Chuva', 'sigla.chuva': 'Chuva', 'papel.chuva': 'gotas agudas',
    'desde': ({ ano }) => `desde ${ano}`,
    'media': ({ v }) => `média ${v}`,
    'tend.sem': 'Ainda sem média.',
    'tend.texto': ({ v, nivel }) => `Média dos 11 anos em volta: ${v} °C, nível ${nivel} de 4`,
    'dim.naoMedido': ({ ano }) => `Ainda não medido. Começa em ${ano}.`,
    'dim.naoMedida': ({ ano }) => `Ainda não medida. Começa em ${ano}.`,
    'dim.co2': ({ v }) => `${v} ppm no planeta`,
    'dim.temp': ({ v }) => `${v} °C em relação a 1951–1980`,
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
    'ev.temperatura.recorde': ({ v }) => `O ano mais quente já medido aqui (${v} °C)`,
    'ev.chuva.secaF': 'O ano mais seco já medido aqui',
    'ev.chuva.seca': ({ v }) => `Seca: ${v}% de chuva`,
    'ev.chuva.extremaF': 'O ano mais chuvoso já medido aqui',
    'ev.chuva.extrema': ({ v }) => `Chuva extrema: +${v}%`,
    'res.co2.recorde': 'Recorde CO₂',
    'res.temperatura.recorde': 'Recorde de calor',
    'res.chuva.secaF': 'Seca recorde', 'res.chuva.seca': 'Seca',
    'res.chuva.extremaF': 'Chuva recorde', 'res.chuva.extrema': 'Chuva extrema',
  },
  en: {
    'titulo.pagina': 'Earth Jukebox',
    'idioma.grupo': 'Language',
    'inicio.titulo': 'Earth Jukebox',
    'inicio.lead': 'Hear your city’s climate change from 1950 to today.',
    'inicio.dados': 'Every sound is NASA data: <strong>carbon dioxide</strong>, <strong>temperature</strong> and <strong>rainfall</strong>.',
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
    'prep.mapas': ({ p }) => `Reading NASA maps… ${p}%`,
    'prep.sons': ({ p }) => `Downloading sounds… ${p}%`,
    'prep.compondo': 'Composing the track…',
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
    'temp.igual': ({ ano }) => `same as the 1951–1980 average, in ${ano}`,
    'temp.quente': ({ ano }) => `warmer than the 1951–1980 average, in ${ano}`,
    'temp.frio': ({ ano }) => `colder than the 1951–1980 average, in ${ano}`,
    'temp.semDado': ({ ano }) => `no map data for ${ano}`,
    'dims.titulo': 'What you are hearing',
    'grafico.rotulo': 'Chart of the four layers over the years. Drag sideways to see the past and the future.',
    'grafico.agora': 'Now',
    'grafico.agoraRotulo': 'Bring the chart back to the year that is playing',
    'tempo.titulo': 'Timeline',
    'tempo.ano': 'Year',
    'ctrl.voltar': 'Rewind',
    'ctrl.tocar': 'Play',
    'ctrl.pausar': 'Pause',
    'ctrl.recomecar': 'Restart',
    'ctrl.avancar': 'Forward',
    'fim': ({ ano }) => `End of the music in ${ano}. Tap Restart to listen from 1950.`,
    'anuncio.cidade': ({ cidade, regiao }) => `${cidade}. Region: ${regiao}.`,
    'creditos': 'Temperature: <a href="https://svs.gsfc.nasa.gov/5207/" target="_blank" rel="noopener">NASA SVS 5207 (GISTEMP v4)</a> · Rainfall: <a href="https://power.larc.nasa.gov/" target="_blank" rel="noopener">NASA POWER (MERRA-2)</a> · CO₂: <a href="https://gml.noaa.gov/ccgg/trends/" target="_blank" rel="noopener">NOAA GML, Mauna Loa</a> (Lan, NOAA/GML, and Keeling, Scripps)',
    'fechar': 'Close',
    'aj.titulo': 'Settings',
    'aj.fechar': 'Close settings',
    'aj.camadas': 'Layers (instruments)',
    'aj.co2': 'Carbon dioxide: low drone',
    'aj.temperatura': 'Temperature: melody',
    'aj.tendencia': 'Temperature trend: 11-year average',
    'aj.chuva': 'Rainfall: high drops',
    'aj.narracao': 'Year narration',
    'aj.narr.off': 'Off',
    'aj.narr.voz': 'App voice',
    'aj.narr.leitor': 'Screen reader only',
    'aj.tic': 'Tick on each year while rewinding',
    'aj.volume': 'Music volume',
    'narr.gravada': ({ n }) => `recorded voice (${n} files, Portuguese)`,
    'narr.navegador': ({ nome }) => `browser voice: ${nome}`,
    'narr.sem': 'no voice available',
    'aj.info': ({ n, bpm, musico, prov, narr, frames }) => `${n} bars (1 per year), ${bpm} BPM. Sounds: ${musico} by the musician, ${prov} placeholders. Narration: ${narr}. ${frames ? 'Temperature read from the colour of the NASA map (GISTEMP) over the city; rainfall from NASA POWER; CO₂ from NOAA (Mauna Loa)' : 'Values by region (placeholder data)'}.`,
    'nome.co2': 'Carbon dioxide', 'sigla.co2': 'CO₂', 'papel.co2': 'low drone',
    'nome.temperatura': 'Temperature', 'sigla.temperatura': 'Temp', 'papel.temperatura': 'melody',
    'nome.tendencia': 'Temperature trend', 'sigla.tendencia': 'Trend', 'papel.tendencia': '11-year average, a pulse that rises in pitch',
    'nome.chuva': 'Rainfall', 'sigla.chuva': 'Rainfall', 'papel.chuva': 'high drops',
    'desde': ({ ano }) => `from ${ano}`,
    'media': ({ v }) => `avg ${v}`,
    'tend.sem': 'No average yet.',
    'tend.texto': ({ v, nivel }) => `Average of the 11 surrounding years: ${v} °C, level ${nivel} of 4`,
    'dim.naoMedido': ({ ano }) => `Not measured yet. Starts in ${ano}.`,
    'dim.naoMedida': ({ ano }) => `Not measured yet. Starts in ${ano}.`,
    'dim.co2': ({ v }) => `${v} ppm worldwide`,
    'dim.temp': ({ v }) => `${v} °C compared with 1951–1980`,
    'dim.chuva': ({ v, tipo }) => `${v}% ${tipo === 'seca' ? '(drought)' : tipo === 'extrema' ? '(extreme rain)' : 'compared with the average'}`,
    'dim.desligada': 'off',
    'dim.desligadaLonga': ({ texto }) => `Turned off in settings. ${texto}`,
    'dim.desligadaCurta': 'off',
    'dim.semDadosCurta': 'no data',
    'dim.semDadosLonga': 'The NASA data could not be loaded right now, so this layer was turned off.',
    'aj.semDados': '(no data right now)',
    'anuncio.semDados': ({ camadas }) => `No ${camadas} data right now; that layer was turned off.`,
    'ev.co2.recorde': ({ v }) => `CO₂ rose ${v} ppm: faster than in any previous year`,
    'ev.temperatura.recorde': ({ v }) => `The hottest year ever measured here (${v} °C)`,
    'ev.chuva.secaF': 'The driest year ever measured here',
    'ev.chuva.seca': ({ v }) => `Drought: ${v}% rainfall`,
    'ev.chuva.extremaF': 'The rainiest year ever measured here',
    'ev.chuva.extrema': ({ v }) => `Extreme rain: +${v}%`,
    'res.co2.recorde': 'CO₂ record',
    'res.temperatura.recorde': 'Heat record',
    'res.chuva.secaF': 'Record drought', 'res.chuva.seca': 'Drought',
    'res.chuva.extremaF': 'Rain record', 'res.chuva.extrema': 'Extreme rain',
  },
};

let idioma = (() => {
  try { const s = localStorage.getItem('jukebox-idioma'); if (s === 'pt' || s === 'en') return s; } catch { /* sem storage */ }
  return 'en';   // idioma principal do projeto: inglês (o português fica a um toque)
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
}

export function definirIdioma(novo) {
  if (novo !== 'pt' && novo !== 'en') return;
  idioma = novo;
  try { localStorage.setItem('jukebox-idioma', novo); } catch { /* ok */ }
  aplicarTextos();
  for (const f of ouvintes) f(novo);
}
export const aoMudarIdioma = (f) => ouvintes.push(f);

// botões PT / EN (no início e no rodapé da tela principal)
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-idioma]');
  if (b) definirIdioma(b.dataset.idioma);
});
