// Разбор письма из outbox / sendmail / SMTP DATA для проверок в тестах.

/** Декодирует заголовок с encoded-words =?UTF-8?B?…?=. */
export function decodeHeader(value) {
  return value
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?UTF-8\?B\?([^?]*)\?=/gi, (_, b64) => Buffer.from(b64, 'base64').toString('utf8'));
}

/** @returns {{ headers: Record<string,string>, rawHeaders: string, body: string }} */
export function parseMail(raw) {
  const normalized = raw.replace(/\r\n/g, '\n');
  const split = normalized.indexOf('\n\n');
  const rawHeaders = split === -1 ? normalized : normalized.slice(0, split);
  const rawBody = split === -1 ? '' : normalized.slice(split + 2);
  const headers = {};
  let last = null;
  for (const line of rawHeaders.split('\n')) {
    if (/^\s/.test(line) && last) {
      headers[last] += ` ${line.trim()}`;
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    last = line.slice(0, idx).trim().toLowerCase();
    headers[last] = line.slice(idx + 1).trim();
  }
  let body = rawBody;
  if ((headers['content-transfer-encoding'] || '').toLowerCase() === 'base64') {
    body = Buffer.from(rawBody.replace(/\s+/g, ''), 'base64').toString('utf8');
  }
  return { headers, rawHeaders, body };
}
