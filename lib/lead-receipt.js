import { createHmac, timingSafeEqual } from 'node:crypto';
const sign = (data, secret) => createHmac('sha256',secret).update(`republic-lead-v1:${data}`).digest();
export function issueLeadReceipt(claims, secret, now = Date.now()) {
  if (!secret) throw new Error('Receipt configuration missing');
  const data = Buffer.from(JSON.stringify({...claims,expires:now + 30 * 60000})).toString('base64url');
  return `${data}.${sign(data,secret).toString('base64url')}`;
}
export function readLeadReceipt(receipt, secret, now = Date.now()) {
  if (!secret || typeof receipt !== 'string' || receipt.length > 5000) return null;
  try {
    const [data,signature,extra] = receipt.split('.');
    if (!data || !signature || extra) return null;
    const expected = sign(data,secret), actual = Buffer.from(signature,'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual,expected)) return null;
    const claims = JSON.parse(Buffer.from(data,'base64url').toString());
    if (!Number.isFinite(claims.expires) || claims.expires < now || claims.expires > now + 30 * 60000
      || typeof claims.submission_id !== 'string' || typeof claims.is_test !== 'boolean') return null;
    return claims;
  } catch {return null;}
}
