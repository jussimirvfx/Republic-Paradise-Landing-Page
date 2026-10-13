import { createHmac, timingSafeEqual } from 'node:crypto';
import { isValidCnpj, digits } from './validation.js';

const sign = (value, secret) => createHmac('sha256', secret).update(value).digest();
export function issueTicket(result, secret, now = Date.now()) {
  if (!secret || !isValidCnpj(result.cnpj)) return null;
  const data = Buffer.from(JSON.stringify({result, expires:now + 10 * 60000})).toString('base64url');
  return `${data}.${sign(data, secret).toString('base64url')}`;
}

export function readTicket(ticket, cnpj, secret, now = Date.now()) {
  if (!secret || typeof ticket !== 'string' || ticket.length > 12000) return null;
  try {
    const [data, signature, extra] = ticket.split('.');
    if (!data || !signature || extra) return null;
    const actual = Buffer.from(signature, 'base64url');
    const expected = sign(data, secret);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const value = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!Number.isFinite(value.expires) || value.expires < now || value.expires > now + 10 * 60000
      || value.result?.cnpj !== digits(cnpj) || !isValidCnpj(cnpj)) return null;
    return value.result;
  } catch { return null; }
}
