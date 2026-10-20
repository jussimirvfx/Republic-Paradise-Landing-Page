const on = value => value === true || value === 1 || value === '1' || value === 'true';
const off = value => value === false || value === 0 || value === '0' || value === 'false';
export const dryRunEnabled = environment => on(environment.LP_DRY_RUN_ENABLED);
export function dryRunIntent(req) {
  const values = ['dry_run','dryRun','vfx_dry_run','skip_webhook']
    .filter(key => Object.hasOwn(req.body || {},key)).map(key => req.body[key]);
  if (req.headers?.['x-vfx-dry-run'] !== undefined) values.push(req.headers['x-vfx-dry-run']);
  return {requested:values.some(on), invalid:values.some(v => !on(v) && !off(v))};
}
export const dryRunReceipt = {ok:true, dry_run:true, status:'not_evaluated', accepted:false,
  skipped_delivery:true, skipped_webhook:true, skipped_lookup:true, skipped_persistence:true, skipped_meta:true};
export function checkDryRun(req, res, environment) {
  const intent = dryRunIntent(req);
  if (intent.invalid) {res.status(400).json({ok:false,error:'Modo de teste inválido.'});return 'rejected';}
  if (!intent.requested) return 'normal';
  if (!dryRunEnabled(environment)) {res.status(503).json({ok:false,error:'Modo de teste indisponível. Nenhum cadastro foi enviado.'});return 'rejected';}
  return 'dry';
}
