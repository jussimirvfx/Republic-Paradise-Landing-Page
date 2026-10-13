const requests = new Map();

export function protectRequest(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ok:false, error:'Método não permitido.'});
    return false;
  }
  try {
    const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
    if (!host || new URL(req.headers?.origin).host !== host || req.headers?.['sec-fetch-site'] === 'cross-site') throw new Error();
  } catch {
    res.status(403).json({ok:false, error:'Origem não permitida.'});
    return false;
  }
  if (!String(req.headers?.['content-type'] || '').startsWith('application/json')) {
    res.status(415).json({ok:false, error:'Formato inválido.'});
    return false;
  }
  const key = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0];
  const now = Date.now();
  for (const [ip, entry] of requests) if (now - entry.start > 60000) requests.delete(ip);
  const entry = requests.get(key) || {start:now, count:0};
  if (++entry.count > 20 || requests.size > 10000) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ok:false, error:'Aguarde um momento e tente novamente.'});
    return false;
  }
  requests.set(key, entry);
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || JSON.stringify(req.body).length > 16000) {
    res.status(400).json({ok:false, error:'Cadastro inválido.'});
    return false;
  }
  return true;
}
