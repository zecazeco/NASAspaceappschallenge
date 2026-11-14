"""Gera a narração dos anos com voz neural natural (Microsoft Edge TTS, gratuito).

Uso:
    pip install edge-tts
    python tools/gerar-narracao.py                 # voz feminina (Francisca)
    python tools/gerar-narracao.py --voz pt-BR-AntonioNeural

Cria audio/narracao/<ano>.mp3 (um por ano) a partir de data/timeline.json.
Observação: o texto (só anos e frases fixas) é enviado ao serviço da Microsoft para gerar o áudio.
Para o produto final, considere gravar com uma pessoa ou usar uma API com licença comercial.
"""
import argparse
import asyncio
import json
from pathlib import Path

import edge_tts

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "audio" / "narracao"


async def main(voz: str, velocidade: str) -> None:
    passos = json.loads((RAIZ / "data" / "timeline.json").read_text(encoding="utf-8"))["passos"]
    SAIDA.mkdir(parents=True, exist_ok=True)
    itens = [(str(p["inicio"]), p["narracao"]) for p in passos]
    for nome, texto in itens:
        destino = SAIDA / f"{nome}.mp3"
        await edge_tts.Communicate(texto, voz, rate=velocidade).save(str(destino))
        print(f"{destino.name}: {texto}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--voz", default="pt-BR-FranciscaNeural", help="ex.: pt-BR-FranciscaNeural, pt-BR-AntonioNeural, pt-BR-ThalitaMultilingualNeural")
    ap.add_argument("--velocidade", default="+0%", help="ex.: -10%% (mais calma) ou +10%%")
    a = ap.parse_args()
    asyncio.run(main(a.voz, a.velocidade))
