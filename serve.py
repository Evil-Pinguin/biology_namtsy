#!/usr/bin/env python3
"""Статический сервер без кэширования: изменения видны сразу после перезагрузки.

Обычный `python3 -m http.server` не отдаёт заголовки Cache-Control,
поэтому браузер хранит data.js/app.js в кэше и не замечает обновлений.
"""
import http.server
import socketserver
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('0.0.0.0', port), NoCacheHandler) as httpd:
        print(f'Энсиэли: http://0.0.0.0:{port} (кэш отключён)')
        httpd.serve_forever()
