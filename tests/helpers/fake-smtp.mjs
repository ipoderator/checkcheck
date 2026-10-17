// Поддельный SMTP-сервер без TLS: проверяет диалог EHLO → AUTH LOGIN → MAIL/RCPT/DATA.
import { createServer } from 'node:net';

/**
 * @param {object} [opts]
 * @param {string} [opts.user]      ожидаемый логин (AUTH LOGIN)
 * @param {string} [opts.password]  ожидаемый пароль
 * @param {boolean} [opts.rejectData]  ответить 554 на конец DATA
 * @param {boolean} [opts.starttls]    объявить STARTTLS (на саму команду — 454, TLS у подделки нет)
 * @param {string} [opts.host]         адрес, на котором слушать (например, '::1')
 */
export async function startFakeSmtp({ user = '', password = '', rejectData = false, starttls = false, host = '127.0.0.1' } = {}) {
  const sessions = [];
  const server = createServer((socket) => {
    socket.setEncoding('utf8');
    const session = { commands: [], auth: null, from: null, rcpt: [], data: null };
    sessions.push(session);
    let buffer = '';
    let mode = 'cmd';
    let authStep = 0;
    let authUser = '';
    let dataLines = [];
    const send = (line) => socket.write(`${line}\r\n`);
    send('220 fake.smtp ESMTP ready');
    socket.on('data', (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (mode === 'data') {
          if (line === '.') {
            session.data = dataLines.join('\r\n');
            mode = 'cmd';
            send(rejectData ? '554 rejected' : '250 OK queued');
          } else {
            dataLines.push(line.startsWith('..') ? line.slice(1) : line);
          }
          continue;
        }
        if (mode === 'auth') {
          const value = Buffer.from(line, 'base64').toString('utf8');
          if (authStep === 1) {
            authUser = value;
            authStep = 2;
            send('334 UGFzc3dvcmQ6');
          } else {
            mode = 'cmd';
            const ok = authUser === user && value === password;
            session.auth = { user: authUser, ok };
            send(ok ? '235 Authentication successful' : '535 Authentication failed');
          }
          continue;
        }
        session.commands.push(line.replace(/^(\S+).*/, '$1').toUpperCase());
        const upper = line.toUpperCase();
        if (upper.startsWith('EHLO')) {
          send('250-fake.smtp');
          send('250-8BITMIME');
          if (starttls) send('250-STARTTLS');
          send('250 AUTH LOGIN PLAIN');
        } else if (upper === 'STARTTLS') {
          send(starttls ? '454 4.7.0 TLS not available in fake' : '502 Command not implemented');
        } else if (upper === 'AUTH LOGIN') {
          mode = 'auth';
          authStep = 1;
          send('334 VXNlcm5hbWU6');
        } else if (upper.startsWith('MAIL FROM:')) {
          session.from = line.slice(10).trim();
          send('250 OK');
        } else if (upper.startsWith('RCPT TO:')) {
          session.rcpt.push(line.slice(8).trim());
          send('250 OK');
        } else if (upper === 'DATA') {
          mode = 'data';
          dataLines = [];
          send('354 End data with <CR><LF>.<CR><LF>');
        } else if (upper === 'QUIT') {
          send('221 Bye');
          socket.end();
        } else {
          send('502 Command not implemented');
        }
      }
    });
    socket.on('error', () => {});
  });
  await new Promise((r) => server.listen(0, host, r));
  const { port } = server.address();
  return {
    port,
    sessions,
    close: () => new Promise((r) => server.close(r)),
  };
}
