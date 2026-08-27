from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os

os.chdir(Path(__file__).parent / 'public')
ThreadingHTTPServer(('0.0.0.0', 8080), SimpleHTTPRequestHandler).serve_forever()
