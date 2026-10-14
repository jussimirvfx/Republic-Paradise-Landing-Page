import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { protectRequest } from '../../lib/api-boundary.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const enabled = value => value === true || value === 1 || value === '1' || value === 'true';
const hashFields = ['em','ph','fn','ln','ct','st','zp','country','external_id'];

export function createConversionHandler({fetchImpl = fetch, environment = process.env, logger = console} = {}) {
  // Redige também valores que eventualmente apareçam em mensagens retornadas pela Meta.
  const redact = value => {
    if (typeof value === 'string') return environment.META_API_ACCESS_TOKEN
      ? value.replaceAll(environment.META_API_ACCESS_TOKEN, '[redacted]') : value;
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !/access.?token|authorization/i.test(key)).map(([key,item]) => [key,redact(item)]));
    return value;
  };
  return async function handler(req, res) {
    if (!protectRequest(req, res)) return;
    const body = req.body;
    const eventName = body.event_name;
    const eventId = body.event_id;
    if (!['PageView','Scroll','Lead','LeadQualificado'].includes(eventName)
      || typeof eventId !== 'string' || !eventId || eventId.length > 200
      || !Number.isInteger(body.event_time) || body.event_time <= 0) {
      return res.status(400).json({success:false, error:'Evento inválido.'});
    }

    let prepared = null;
    const logError = (msg, details = {}) => logger.error(JSON.stringify(redact({
      level:'error', msg, event:'conversion_api_event_error',
      project:environment.VERCEL_PROJECT_NAME || 'republic-paradise-landing-page', route:'/api/meta/conversions',
      received_at:new Date().toISOString(), request_id:req.headers['x-vercel-id'] || req.headers['x-request-id'] || null,
      event_name:eventName, event_id:eventId, request_payload:body, prepared_meta_payload:prepared, ...details,
    })));
    try {
      const userData = {};
      for (const key of hashFields) {
        const values = [body.user_data?.[key]].flat(2).filter(value => typeof value === 'string' && value.trim());
        if (values.length) userData[key] = values.map(value => /^[a-f\d]{64}$/i.test(value)
          ? value.toLowerCase() : hash(value.trim().toLowerCase()));
      }
      for (const key of ['fbp','fbc']) {
        const value = body.user_data?.[key];
        if (typeof value === 'string' && value.length < 500) userData[key] = value;
      }
      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
      if (isIP(ip)) userData.client_ip_address = ip;
      userData.client_user_agent = String(req.headers['user-agent'] || body.user_data?.client_user_agent || 'unknown');
      const customData = redact(body.custom_data && typeof body.custom_data === 'object' ? body.custom_data : {});
      if (['Lead','LeadQualificado'].includes(eventName) && Number.isFinite(customData.lead_score)) customData.value = customData.lead_score;
      prepared = {data:[{
        event_name:eventName, event_id:eventId, event_time:body.event_time,
        event_source_url:body.event_source_url, action_source:'website', user_data:userData, custom_data:customData,
      }]};
      const production = environment.VERCEL_ENV ? environment.VERCEL_ENV === 'production' : environment.NODE_ENV === 'production';
      if (!production && environment.META_TEST_EVENT_CODE) prepared.test_event_code = environment.META_TEST_EVENT_CODE;
      const dryRun = enabled(req.headers['x-vfx-dry-run'])
        || ['dry_run','dryRun','vfx_dry_run','skip_webhook'].some(key => enabled(body[key]));
      logger.info(JSON.stringify({
        level:'info', msg:'conversion_api_event_backup', event:'conversion_api_event_backup',
        project:environment.VERCEL_PROJECT_NAME || 'republic-paradise-landing-page', route:'/api/meta/conversions',
        event_name:eventName, event_id:eventId, custom_data:customData, dry_run:dryRun,
        user_data_presence:Object.fromEntries(Object.entries(userData).map(([key,value]) => [key,Boolean(value)])),
        received_at:new Date().toISOString(), prepared_meta_payload:prepared,
      }));
      if (dryRun) return res.status(200).json({success:true, dry_run:true, skipped_meta:true});
      const pixelId = environment.META_PIXEL_ID || environment.VITE_META_PIXEL_ID;
      if (!/^\d+$/.test(pixelId || '') || !environment.META_API_ACCESS_TOKEN) {
        logError('meta_configuration_missing');
        return res.status(202).json({success:false, accepted:true, skipped_meta:true});
      }
      const response = await fetchImpl(`https://graph.facebook.com/v23.0/${pixelId}/events`, {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${environment.META_API_ACCESS_TOKEN}`},
        body:JSON.stringify(prepared), signal:AbortSignal.timeout(10000),
      });
      const result = await response.json();
      if (!response.ok) {
        logError('meta_request_failed', {meta_status:response.status, meta_error:result});
        return res.status(202).json({success:false, accepted:true, meta_status:response.status});
      }
      logger.info(JSON.stringify({event:'conversion_api_event_delivered', event_name:eventName, event_id:eventId, events_received:result.events_received}));
      return res.status(200).json({success:true, events_received:result.events_received});
    } catch (error) {
      logError('meta_internal_error', {error_message:error.message});
      return res.status(202).json({success:false, accepted:true});
    }
  };
}

export default createConversionHandler();
