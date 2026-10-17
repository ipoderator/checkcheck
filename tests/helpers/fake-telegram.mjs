// Поддельный Bot API: принимает запросы вместо api.telegram.org (через TELEGRAM_API_BASE).
import { createServer } from 'node:http';

/**
 * @param {object} [opts]
 * @param {number} [opts.status=200]  HTTP-код ответа; не 200 — канал считается упавшим
 */
export async function startFakeTelegram({ status = 200 } = {}) {
  const requests = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      let body = {};
      const type = req.headers['content-type'] || '';
      if (type.includes('application/json')) {
        try { body = JSON.parse(raw); } catch { body = { __invalid: raw }; }
      } else {
        body = Object.fromEntries(new URLSearchParams(raw));
      }
      requests.push({ method: req.method, url: req.url, headers: req.headers, body });
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status === 200
        ? { ok: true, result: { message_id: requests.length } }
        : { ok: false, error_code: status, description: 'fake failure' }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((r) => server.close(r)),
  };
}
