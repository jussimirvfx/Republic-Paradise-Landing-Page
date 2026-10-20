import { protectRequest } from '../lib/api-boundary.js';
import { isValidCnpj } from '../lib/validation.js';
import { lookupCnpj } from '../lib/cnpj-central.js';
import { issueTicket } from '../lib/cnpj-ticket.js';
import { checkDryRun, dryRunReceipt } from '../lib/dry-run.js';

export default async function handler(req, res) {
  if (!protectRequest(req, res)) return;
  const mode = checkDryRun(req,res,process.env);
  if (mode === 'rejected') return;
  if (!isValidCnpj(req.body.cnpj)) return res.status(400).json({ok:false, cnpj_valido:false});
  if (mode === 'dry') return res.status(200).json(dryRunReceipt);
  const result = await lookupCnpj(req, req.body.cnpj);
  return res.status(200).json({ok:true, ...result, ticket:issueTicket(result, process.env.CNPJ_PREFETCH_SIGNING_SECRET)});
}
