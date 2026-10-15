import { createServer as createSMTPServer } from 'node:net';
import { createServer as createMailboxServer } from 'node:http';
import type { AccountMail } from '../../src/mail.js';

/** Real loopback SMTP sink for tests only. Never included in production builds. */
export async function startTestSMTP(smtpPort = 1025, mailboxPort = 3101) {
  if (process.env.NODE_ENV === 'production') throw new Error('Test SMTP cannot run in production.');
  const messages: AccountMail[] = [];
  const smtp = createSMTPServer(socket => {
    let buffer = '', data = '', recipient = '', collecting = false;
    socket.setEncoding('utf8');
    socket.write('220 test-smtp ESMTP\r\n');
    socket.on('data', chunk => {
      buffer += chunk;
      let newline: number;
      while ((newline = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        if (collecting) {
          if (line === '.') {
            const separator = data.indexOf('\r\n\r\n');
            const headers = data.slice(0, separator);
            let text = data.slice(separator + 4);
            if (/Content-Transfer-Encoding: quoted-printable/i.test(headers)) {
              text = text.replace(/=\r\n/g, '').replace(/=([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
            } else if (/Content-Transfer-Encoding: base64/i.test(headers)) text = Buffer.from(text.replace(/\s/g, ''), 'base64').toString('utf8');
            messages.push({ to: recipient, subject: /^Subject: (.*)$/mi.exec(headers)?.[1] ?? '', text });
            collecting = false; data = ''; socket.write('250 Accepted\r\n');
          } else data += `${line.replace(/^\.\./, '.')}\r\n`;
          continue;
        }
        const command = line.split(' ')[0].toUpperCase();
        if (command === 'EHLO' || command === 'HELO') socket.write('250-test-smtp\r\n250 SIZE 100000\r\n');
        else if (command === 'MAIL' || command === 'RSET' || command === 'NOOP') socket.write('250 OK\r\n');
        else if (command === 'RCPT') { recipient = /<([^>]+)>/.exec(line)?.[1] ?? ''; socket.write('250 OK\r\n'); }
        else if (command === 'DATA') { collecting = true; data = ''; socket.write('354 Send message\r\n'); }
        else if (command === 'QUIT') { socket.end('221 Bye\r\n'); }
        else socket.write('502 Unsupported command\r\n');
      }
    });
    socket.on('error', () => undefined);
  });
  const mailbox = createMailboxServer((incoming, outgoing) => {
    const url = new URL(incoming.url ?? '/', 'http://127.0.0.1');
    outgoing.setHeader('Content-Type', 'application/json');
    outgoing.setHeader('Cache-Control', 'no-store');
    if (incoming.method !== 'GET') { outgoing.writeHead(405); outgoing.end('{}'); return; }
    if (url.pathname === '/health') { outgoing.end('{"status":"ok"}'); return; }
    if (url.pathname === '/messages') {
      const to = url.searchParams.get('recipient');
      outgoing.end(JSON.stringify({ messages: messages.filter(message => !to || message.to === to) }));
      return;
    }
    outgoing.writeHead(404); outgoing.end('{}');
  });
  const listen = (server: typeof smtp | typeof mailbox, port: number) => new Promise<void>((resolve, reject) => {
    server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  try {
    await listen(smtp, smtpPort);
    await listen(mailbox, mailboxPort);
  } catch (error) { smtp.close(); mailbox.close(); throw error; }
  return { messages, close: async () => {
    await Promise.all([new Promise<void>(resolve => smtp.close(() => resolve())), new Promise<void>(resolve => mailbox.close(() => resolve()))]);
  } };
}
