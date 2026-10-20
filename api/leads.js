import { waitUntil } from '@vercel/functions';
import { protectRequest } from '../lib/api-boundary.js';
import { digits, formatPhone, isValidCnpj, maskCnpj, storeTypes, validPhone, isTestLead } from '../lib/validation.js';
import { lookupCnpj } from '../lib/cnpj-central.js';
import { readTicket } from '../lib/cnpj-ticket.js';
import { calculateLeadScore } from '../lib/lead-score.js';
import { checkDryRun, dryRunReceipt } from '../lib/dry-run.js';
import { issueLeadReceipt } from '../lib/lead-receipt.js';

export function createLeadHandler({schedule = waitUntil, fetchImpl = fetch, lookup = lookupCnpj, environment = process.env, logger = console} = {}) {
  return function handler(req, res) {
    if (!protectRequest(req, res)) return;
    const form = req.body;
    const fields = ['nomeProprietario','nomeLoja','whatsapp','email','cnpj','instagramLoja','tipoLoja','possuiLojaFisica','principaisMarcas'];
    const mode = checkDryRun(req,res,environment);
    if (mode === 'rejected') return;
    const submissionId = typeof form.submission_id === 'string' && /^[a-f\d-]{36}$/i.test(form.submission_id)
      ? form.submission_id : crypto.randomUUID();
    if (mode === 'normal') {
      try {
        const attempt = Object.fromEntries([...fields,'url'].filter(key=>Object.hasOwn(form,key)).map(key=>[key,form[key]]));
        logger.info(JSON.stringify({event:'landing_form_attempt_backup',submission_id:submissionId,
          received_at:new Date().toISOString(),source:'republic-paradise-landing-page',
          is_test:isTestLead(form.nomeLoja),payload:attempt}));
      } catch {return res.status(503).json({ok:false,error:'Não foi possível receber seu cadastro. Tente novamente.',submission_id:submissionId});}
    }
    if (fields.some(key => typeof form[key] !== 'string' || !form[key].trim() || form[key].length > 300)
      || !validPhone(form.whatsapp) || !isValidCnpj(form.cnpj) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
      || !storeTypes.includes(form.tipoLoja) || !['Sim','Não'].includes(form.possuiLojaFisica)) {
      return res.status(400).json({ok:false, error:'Confira os campos obrigatórios, o WhatsApp e o CNPJ.'});
    }
    if (mode === 'dry') return res.status(200).json({...dryRunReceipt,submission_id:submissionId});
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    let pageUrl = `https://${host}/`;
    try {
      const submittedUrl = new URL(form.url);
      if (submittedUrl.protocol === 'https:' && submittedUrl.host === host) pageUrl = submittedUrl.href;
    } catch { /* The server-derived URL remains the fallback. */ }
    const payload = {
      submission_id: submissionId, submittedAt:new Date().toISOString(), source:'republic-paradise-landing-page',
      url:pageUrl,
      name:form.nomeProprietario.trim(), nome_loja:form.nomeLoja.trim(), whatsapp:formatPhone(form.whatsapp),
      email:form.email.trim(), cnpj:maskCnpj(form.cnpj), cnpj_digits:digits(form.cnpj),
      instagram_loja:form.instagramLoja.trim(), tipo_loja:form.tipoLoja, possui_loja_fisica:form.possuiLojaFisica,
      principais_marcas:(form.principaisMarcas || '').trim(), is_test:isTestLead(form.nomeLoja), cnpj_validation_status:'checksum_valid',
    };
    try {
      const destination = new URL(environment.N8N_REPUBLIC_PARADISE_WEBHOOK_URL);
      if (destination.protocol !== 'https:' || destination.hostname !== 'n8n.agenciavfx.com.br' || !destination.pathname.startsWith('/webhook/')) throw new Error('Invalid destination');
      const trackingReceipt = issueLeadReceipt({submission_id:submissionId,is_test:payload.is_test},environment.CNPJ_PREFETCH_SIGNING_SECRET);
      logger.info(JSON.stringify({event:'lead_delivery_backup', submission_id:submissionId, payload}));
      let scheduled = false;
      const delivery = Promise.resolve().then(async () => {
        if (!scheduled) return;
        try {
          let result = readTicket(form.cnpj_ticket, payload.cnpj_digits, environment.CNPJ_PREFETCH_SIGNING_SECRET);
          // A failed automatic lookup stays optional and does not trigger a second request on this click.
          if (!result && form.cnpj_lookup_failed === true) result = {cnpj_validation_status:'checksum_valid', encontrado:false, company:null};
          try { result ||= await lookup(req, payload.cnpj_digits, {fetchImpl, environment, logger}); }
          catch { result = {cnpj_validation_status:'checksum_valid', encontrado:false, company:null}; }
          const scoring = calculateLeadScore(form, result.company);
          const enriched = {...payload, cnpj_validation_status:result.cnpj_validation_status || 'checksum_valid',
            encontrado:result.encontrado === true, fonte:result.fonte || '', company:result.company || null,
            cidade:result.company?.endereco?.cidade || '', estado:result.company?.endereco?.estado || '',
            tempo_cnpj:result.company?.tempo_cnpj || '', ...scoring};
          logger.info(JSON.stringify({event:'lead_score_calculated', submission_id:submissionId, ...scoring}));
          logger.info(JSON.stringify({event:'lead_enriched_payload', submission_id:submissionId, payload:enriched}));
          const response = await fetchImpl(destination.href, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(enriched), signal:AbortSignal.timeout(25000)});
          logger[response.ok ? 'info' : 'error'](JSON.stringify({event:response.ok ? 'lead_delivery_completed' : 'lead_delivery_failed', submission_id:submissionId, status:response.status}));
        } catch (error) {
          logger.error(JSON.stringify({event:'lead_delivery_failed', submission_id:submissionId, error_name:error.name}));
        }
      });
      schedule(delivery);
      scheduled = true;
      return res.status(200).json({ok:true, submission_id:submissionId, accepted:true, delivery_scheduled:true, tracking_receipt:trackingReceipt});
    } catch {
      return res.status(503).json({ok:false, error:'Não foi possível receber seu cadastro. Tente novamente.',submission_id:submissionId});
    }
  };
}

export default createLeadHandler();
