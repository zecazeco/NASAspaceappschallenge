"""Servidor local sem cache (para ver as mudanças na hora). Uso: python tools/servidor.py [porta]"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class SemCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):  # esconde os 404 esperados dos áudios que ainda não existem
        if "404" not in (fmt % args):
            super().log_message(fmt, *args)


porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
raiz = Path(__file__).resolve().parent.parent
print(f"Jukebox em http://localhost:{porta}")
ThreadingHTTPServer(("", porta), partial(SemCache, directory=str(raiz))).serve_forever()
