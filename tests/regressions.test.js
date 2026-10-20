import test from 'node:test';
import assert from 'node:assert/strict';
import {brazilianDdds,validPhone,maskPhone,editPhone,formatPhone,phoneE164,isTestLead} from '../lib/validation.js';
import {normalizeCompany} from '../lib/cnpj-central.js';
import {companyAge} from '../lib/company-date.js';
import {createLeadHandler} from '../api/leads.js';
import {createConversionHandler} from '../api/meta/conversions.js';
import {issueLeadReceipt,readLeadReceipt} from '../lib/lead-receipt.js';
import {createMetaTracking} from '../lib/meta-client.js';
import cnpjHandler from '../api/cnpj.js';

const secret='test-signing-key-not-a-production-credential';
const submission='00000000-0000-4000-8000-000000000002';
const environment={LP_DRY_RUN_ENABLED:'1',CNPJ_PREFETCH_SIGNING_SECRET:secret,
  N8N_REPUBLIC_PARADISE_WEBHOOK_URL:'https://n8n.agenciavfx.com.br/webhook/mock',META_PIXEL_ID:'29980293874892643',META_API_ACCESS_TOKEN:'mock'};
let ip=3000;
const request=body=>({method:'POST',headers:{host:'audit.invalid',origin:'https://audit.invalid','content-type':'application/json','x-forwarded-for':String(++ip)},body});
const response=()=>({statusCode:0,setHeader(){},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}});
const recorder=()=>{const rows=[];return{rows,info:s=>rows.push(JSON.parse(s)),warn:s=>rows.push(JSON.parse(s)),error:s=>rows.push(JSON.parse(s))}};
const form={nomeProprietario:'Pessoa fictícia',nomeLoja:'Loja fictícia',whatsapp:'(48) 99999-0000',email:'audit@example.invalid',cnpj:'60887522000189',instagramLoja:'@teste',tipoLoja:'Boutique',possuiLojaFisica:'Sim',principaisMarcas:'Marca fictícia',submission_id:submission};
const receipt=(marked=false)=>issueLeadReceipt({submission_id:submission,is_test:marked},secret);
const event=(extra={})=>({event_name:'Lead',event_id:`${submission}:Lead`,event_time:Math.floor(Date.now()/1000),submission_id:submission,tracking_receipt:receipt(),custom_data:{lead_score:100},...extra});

test('telefone: 67 DDDs, nacional/internacional e E.164 sem duplicar DDD 55',()=>{
  assert.equal(brazilianDdds.size,67);
  for(const ddd of brazilianDdds) for(const input of [`${ddd}999990000`,`+55 (${ddd}) 99999-0000`,`55${ddd}999990000`]) {
    assert.equal(validPhone(input),true);assert.equal(formatPhone(input),`(${ddd}) 99999-0000`);assert.equal(phoneE164(input),`+55${ddd}999990000`);
  }
  assert.equal(phoneE164('(55) 99999-0000'),'+5555999990000');
  for(const input of ['(20) 99999-0000','(11) 89999-0000','(11) 9999-0000','+1 11999990000','11111111111',123,null,{}])assert.equal(validPhone(input),false);
  assert.equal(validPhone('(48) 3234-5678'),true);
});

test('telefone: digitação internacional parcial, excedente, colagem e fixo com 11 dígitos',()=>{
  for(const ddd of ['48','55']) {
    let value='';for(const key of `+55${ddd}999990000`)value=editPhone(value+key,value,'insertText').value;
    assert.equal(value,`+55 (${ddd}) 99999-0000`);assert.equal(validPhone(value),true);
  }
  const previous='(48) 99999-0000';
  assert.deepEqual(editPhone(previous+'1',previous,'insertText'),{value:previous,error:''});
  assert.equal(editPhone('489999900001111',previous,'insertFromPaste').value,previous);
  assert.ok(editPhone('489999900001111',previous,'insertFromPaste').error);
  const fixed=editPhone('(48) 3234-56789','(48) 3234-5678','insertText').value;
  assert.equal(fixed.replace(/\D/g,''),'48323456789');assert.equal(validPhone(fixed),false);
  assert.equal(maskPhone('5511999990000'),'(11) 99999-0000');
});

test('datas: idade real, aniversário, DD/MM/ISO, calendário inválido e ausência',()=>{
  const now=new Date('2026-10-20T12:00:00Z');
  assert.equal(companyAge('20/10/2020',now),6);assert.equal(companyAge('2020-10-21',now),5);
  assert.equal(normalizeCompany({data_abertura:'20/10/2020'},now).tempo_cnpj,'6 anos');
  for(const date of ['2025-02-31','31/02/2025','2099-01-01','',null]) {
    assert.equal(companyAge(date,now),null);assert.equal(normalizeCompany({data_abertura:date,tempo_cnpj:'idade não confiável'},now).tempo_cnpj,'');
  }
});

test('tentativa completa precede recusa de CNPJ, sem consulta/agendamento nem campos secretos',()=>{
  const logger=recorder(),res=response();let calls=0;
  createLeadHandler({environment,logger,schedule:()=>calls++,lookup:async()=>{calls++},fetchImpl:async()=>{calls++}})(request({...form,cnpj:'00000000000000',password:'must-not-be-logged'}),res);
  assert.equal(res.statusCode,400);assert.equal(calls,0);assert.equal(logger.rows.length,1);
  assert.equal(logger.rows[0].event,'landing_form_attempt_backup');assert.equal(logger.rows[0].submission_id,submission);
  assert.equal(logger.rows[0].payload.nomeLoja,form.nomeLoja);assert.equal(JSON.stringify(logger.rows).includes('must-not-be-logged'),false);
});

test('dry-run: zero logging de payload, lookup, agendamento, Meta e entrega; flags inválidas/disabled falham fechadas',async()=>{
  for(const env of [environment,{...environment,LP_DRY_RUN_ENABLED:'0'}])for(const flag of [true,'invalid']) {
    const logger=recorder(),res=response();let calls=0;
    createLeadHandler({environment:env,logger,schedule:()=>calls++,lookup:async()=>{calls++},fetchImpl:async()=>{calls++}})(request({...form,dry_run:flag}),res);
    assert.equal(calls,0);assert.equal(logger.rows.length,0);
    assert.equal(res.statusCode,flag==='invalid'?400:env.LP_DRY_RUN_ENABLED==='1'?200:503);
    if(res.statusCode===200) for(const key of ['skipped_webhook','skipped_persistence','skipped_meta','skipped_lookup'])assert.equal(res.body[key],true);
  }
  const logger=recorder(),res=response();let calls=0;
  await createConversionHandler({environment,logger,fetchImpl:async()=>{calls++}})(request(event({dry_run:true})),res);
  assert.equal(calls,0);assert.equal(res.statusCode,200);assert.equal(logger.rows[0].event,'conversion_api_dry_run');
  assert.equal(JSON.stringify(logger.rows).includes('custom_data'),false);
  const oldFlag=process.env.LP_DRY_RUN_ENABLED,oldFetch=globalThis.fetch;
  try {
    process.env.LP_DRY_RUN_ENABLED='1';globalThis.fetch=async()=>{throw new Error('Unexpected external request')};
    const r=response();await cnpjHandler(request({cnpj:form.cnpj,dry_run:true}),r);assert.equal(r.body.skipped_lookup,true);
  } finally {globalThis.fetch=oldFetch;if(oldFlag===undefined)delete process.env.LP_DRY_RUN_ENABLED;else process.env.LP_DRY_RUN_ENABLED=oldFlag;}
});

test('CAPI: marcador em rota direta, recibo assinado e flag pública falsa não geram conversão nem log normal',async()=>{
  for(const body of [event({nome_loja:' TÉSTE  MAIS  LOJISTAS - teste ',is_test:false}),event({tracking_receipt:receipt(true),is_test:false})]) {
    const logger=recorder(),res=response();let calls=0;
    await createConversionHandler({environment,logger,fetchImpl:async()=>{calls++}})(request(body),res);
    assert.equal(res.body.skipped_test,true);assert.equal(calls,0);assert.equal(logger.rows.some(r=>r.event==='conversion_api_event_backup'),false);
  }
  assert.equal(isTestLead('Outra loja teste'),false);
});

test('CAPI: exige aceite assinado, correlação e recibo não adulterado/expirado; preserva Value zero',async()=>{
  for(const body of [event({tracking_receipt:undefined}),event({tracking_receipt:receipt()+'x'}),event({event_id:'wrong-id'})]) {
    const logger=recorder(),res=response();let calls=0;
    await createConversionHandler({environment,logger,fetchImpl:async()=>{calls++}})(request(body),res);
    assert.equal(res.statusCode,403);assert.equal(calls,0);assert.equal(logger.rows.length,0);
  }
  assert.equal(readLeadReceipt(issueLeadReceipt({submission_id:submission,is_test:false},secret,1000),secret,2000000),null);
  for(const score of [0,36,100]) {
    const res=response();let captured;
    await createConversionHandler({environment,logger:recorder(),fetchImpl:async(_,o)=>{captured=JSON.parse(o.body);return{ok:true,json:async()=>({events_received:1})}}})(request(event({custom_data:{lead_score:score,value:999},is_test:true})),res);
    assert.equal(res.statusCode,200);assert.equal(captured.data[0].custom_data.value,score);
  }
});

test('cliente Meta real: PageView único, teste bloqueado em helper direto, Lead somente com aceite e IDs deduplicados',async()=>{
  const payloads=[],scripts=[];
  const win={location:{search:'',href:'https://audit.invalid/?utm_source=test'},crypto:globalThis.crypto,
    document:{cookie:'',head:{appendChild:s=>scripts.push(s)},createElement:()=>({}),documentElement:{scrollHeight:2000}},
    innerHeight:800,scrollY:0,requestAnimationFrame:cb=>cb(),addEventListener(){}};
  const client=createMetaTracking({window:win,pixelId:'29980293874892643',fetchImpl:async(_,o)=>{payloads.push(JSON.parse(o.body));return{ok:true}}});
  client.start();client.start();assert.equal(scripts.length,1);assert.equal(payloads.filter(x=>x.event_name==='PageView').length,1);
  const data={name:'Pessoa fictícia',email:'audit@example.invalid',phone:'+5548999990000',lead_score:100};
  const context={nome_loja:'TÉSTE MAIS LOJISTAS',submission_id:submission,tracking_receipt:'mock'};
  await client.trackLead(data,context);await client.trackLeadQualificado(data,context);
  assert.equal(payloads.some(x=>x.event_name==='Lead'),false);
  await client.trackLead(data,{nome_loja:'Loja normal'});assert.equal(payloads.some(x=>x.event_name==='Lead'),false);
  context.nome_loja='Loja normal';await client.trackLead(data,context);await client.trackLead(data,context);
  assert.equal(payloads.filter(x=>x.event_name==='Lead').length,1);
  const pixel=win.fbq.queue.find(args=>args[1]==='Lead');assert.equal(pixel[3].eventID,payloads.find(x=>x.event_name==='Lead').event_id);
  win.location.search='?dry_run=1';await client.trackLead(data,{...context,submission_id:'another'});
  assert.equal(payloads.filter(x=>x.event_name==='Lead').length,1);
});
