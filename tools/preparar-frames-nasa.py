"""
Prepara os frames REAIS de temperatura da NASA para o site.

Fonte: NASA SVS 5207 "Global Temperature Anomalies, 1880 to 2023" (GISTEMP v4)
  https://svs.gsfc.nasa.gov/5207/  —  frames 3840x2160 + time.txt (ano de cada frame)

O que faz:
  1. lê o time.txt e escolhe, para cada ano de 1950 a 2023, o frame do MEIO daquele ano
     (cada ano tem ~6 frames quase iguais: o mapa é uma média móvel de 24 meses;
      2023 tem mais frames porque o vídeo segura o último ano no fim);
  2. baixa esses PNGs para cache-nasa/5207/ (fora do git; ~4,6 MB cada), só dos anos
     que ainda não têm WebP (para refazer um ano, apague o WebP dele);
  3. gera data/frames/temperatura-nasa/<ano>.webp (1280x720, qualidade 80, ~70 KB);
  4. atualiza a camada "temperatura" do data/frames/manifesto.json.

A leitura do valor continua sendo feita NO SITE, pela cor do frame (js/frames.js):
se a NASA trocar as imagens, basta rodar este script de novo.

uso:  python -I tools/preparar-frames-nasa.py
"""
import json
import pathlib
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

RAIZ = pathlib.Path(__file__).resolve().parent.parent
BASE = 'https://svs.gsfc.nasa.gov/vis/a000000/a005200/a005207/'
FRAMES = BASE + 'frames/3840x2160_16x9_30p/GISTEMP_Map_4K{:03d}.png'
CACHE = RAIZ / 'cache-nasa' / '5207'
SAIDA = RAIZ / 'data' / 'frames' / 'temperatura-nasa'
MANIFESTO = RAIZ / 'data' / 'frames' / 'manifesto.json'
ANOS = range(1950, 2024)
LARGURA, ALTURA, ESCALA = 1280, 720, 3  # 3840x2160 / 3

# Medidas no frame 4K, divididas por 3:
AREA_MAPA = [52 / ESCALA, 24 / ESCALA, 3794 / ESCALA, 1923 / ESCALA]  # caixa da projeção Robinson
ALTURA_MAPA = round(1900 / ESCALA)                                        # abaixo disso: ano e régua
BARRA = {'x': 52, 'y': 527, 'largura': 1, 'altura': 173, 'vertical': True}  # legenda +2 (topo) a −2 °C


def baixar(url, destino):
    req = urllib.request.Request(url, headers={'User-Agent': 'jukebox-da-terra/0.1'})
    with urllib.request.urlopen(req, timeout=120) as r:
        dados = r.read()
    destino.write_bytes(dados)
    return len(dados)


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    SAIDA.mkdir(parents=True, exist_ok=True)
    tempo = CACHE / 'time.txt'
    if not tempo.exists():
        baixar(BASE + 'time.txt', tempo)
    linhas = [l.strip() for l in tempo.read_text().splitlines()]

    escolhidos = []
    for ano in ANOS:
        idx = [i for i, l in enumerate(linhas) if l == str(ano)]
        if not idx:
            sys.exit(f'ano {ano} não está no time.txt')
        # 2023: o vídeo "segura" o último ano; pega um dos primeiros frames dele
        escolhidos.append((ano, idx[min(3, len(idx) - 1)] if ano == 2023 else idx[len(idx) // 2]))

    def garantir(item):
        ano, quadro = item
        png = CACHE / f'GISTEMP_Map_4K{quadro:03d}.png'
        if (SAIDA / f'{ano}.webp').exists():   # já convertido: não precisa do PNG em 4K
            return
        if not png.exists():
            n = baixar(FRAMES.format(quadro), png)
            print(f'{ano}: frame {quadro} baixado ({n / 1e6:.1f} MB)', flush=True)

    # o servidor da NASA é lento por conexão: baixa 8 de cada vez
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(garantir, escolhidos))

    frames = []
    for ano, quadro in escolhidos:
        webp = SAIDA / f'{ano}.webp'
        png = CACHE / f'GISTEMP_Map_4K{quadro:03d}.png'
        if not webp.exists():
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(png),
                            '-vf', f'scale={LARGURA}:{ALTURA}', '-c:v', 'libwebp', '-quality', '80', str(webp)], check=True)
        frames.append({'data': str(ano), 'arquivo': f'temperatura-nasa/{ano}.webp', 'quadro': quadro})

    m = json.loads(MANIFESTO.read_text(encoding='utf-8')) if MANIFESTO.exists() else {'visualizacoes': []}
    camada = {
        'id': 'temperatura',
        'dimensao': 'temperatura',
        'titulo': 'Anomalia de temperatura da superfície (NASA GISTEMP)',
        'fonte': 'NASA SVS 5207 · GISTEMP v4',
        'link': 'https://svs.gsfc.nasa.gov/5207/',
        'real': True,
        'unidade': '°C',
        'referencia': 'média de 1951–1980',
        'leitura': 'local',
        'raio': 2,
        'projecao': {'tipo': 'robinson', 'area': AREA_MAPA},
        'recorte': {'x': 0, 'y': 0, 'largura': LARGURA, 'altura': ALTURA_MAPA},
        'escala': {'barra': BARRA, 'min': -2, 'max': 2, 'tolerancia': 45},
        'frames': frames,
    }
    outras = [v for v in m['visualizacoes'] if v['id'] != 'temperatura']
    m['visualizacoes'] = [camada] + outras
    m['aviso'] = 'Temperatura: frames REAIS da NASA (SVS 5207). CO₂, chuva e vegetação: frames fictícios.'
    MANIFESTO.write_text(json.dumps(m, ensure_ascii=False, indent=2), encoding='utf-8')
    total = sum(f.stat().st_size for f in SAIDA.glob('*.webp'))
    print(f'pronto: {len(frames)} frames, {total / 1e6:.1f} MB em {SAIDA.relative_to(RAIZ)}')


if __name__ == '__main__':
    main()
