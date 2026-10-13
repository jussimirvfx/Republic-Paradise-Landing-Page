import { protectRequest } from '../lib/api-boundary.js';
import { isValidCnpj } from '../lib/validation.js';
import { lookupCnpj } from '../lib/cnpj-central.js';
import { issueTicket } from '../lib/cnpj-ticket.js';

export default async function handler(req, res) {
  if (!protectRequest(req, res)) return;
  if (!isValidCnpj(req.body.cnpj)) return res.status(400).json({ok:false, cnpj_valido:false});
  if (req.body.dry_run === true) return res.status(200).json({ok:true, dry_run:true, skipped_lookup:true});
  const result = await lookupCnpj(req, req.body.cnpj);
  return res.status(200).json({ok:true, ...result, ticket:issueTicket(result, process.env.CNPJ_PREFETCH_SIGNING_SECRET)});
}
