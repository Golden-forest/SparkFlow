import nodemailer from 'nodemailer';
import type { ServerConfig } from './config.js';

export interface AccountMail { to: string; subject: string; text: string }
export interface Mailer {
  verify(): Promise<void>;
  enqueue(message: AccountMail): void;
  drain(): Promise<void>;
  close(): void;
}

export function createMailer(config: ServerConfig, testSink?: (message: AccountMail) => Promise<void>): Mailer {
  if (testSink && config.mode !== 'test') throw new Error('Mail collectors are only allowed in test mode.');
  const transport = testSink ? null : nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure,
    requireTLS: config.mode === 'production' && !config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password! } : undefined,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    tls: { rejectUnauthorized: true },
    disableFileAccess: true, disableUrlAccess: true,
  });
  const pending = new Set<Promise<unknown>>();
  return {
    async verify() { if (transport) await transport.verify(); },
    enqueue(message) {
      // Do not await SMTP in account endpoints: response timing must not reveal existing emails.
      const delivery = Promise.resolve().then(async () => {
        if (testSink) await testSink(message);
        else await transport!.sendMail({ ...message, from: config.smtp.from });
      })
        .catch(() => { console.error('Account email delivery failed. Check the mail service.'); })
        .finally(() => pending.delete(delivery));
      pending.add(delivery);
    },
    async drain() { await Promise.all(pending); },
    close() { transport?.close(); },
  };
}
