import test from 'node:test';
import assert from 'node:assert/strict';
import { cnpjMessage, isValidCnpj, maskCnpj } from '../lib/validation.js';
import { lookupCnpj, normalizeCompany } from '../lib/cnpj-central.js';
import { issueTicket, readTicket } from '../lib/cnpj-ticket.js';
import { createLeadHandler } from '../api/leads.js';
import { calculateLeadScore } from '../lib/lead-score.js';

const form = {nomeProprietario:'TESTE Republic',nomeLoja:'Teste Mais Lojistas - Republic',whatsapp:'(11) 99999-0000',email:'teste@example.invalid',cnpj:'60.887.522/0001-89',instagramLoja:'@teste',tipoLoja:'Boutique',possuiLojaFisica:'Sim',principaisMarcas:'Marca fictícia'};
let ip = 0;
const request = body => ({method:'POST',headers:{host:'lp.test',origin:'https://lp.test','content-type':'application/json','x-forwarded-for':String(++ip),'x-vercel-oidc-token':'runtime-token'},body});
const response = () => ({statusCode:0,body:null,setHeader(){},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}});
const secret = 'a'.repeat(64);
const environment = {N8N_REPUBLIC_PARADISE_WEBHOOK_URL:'https://n8n.agenciavfx.com.br/webhook/mock',CNPJ_PREFETCH_SIGNING_SECRET:secret};
const company = {razao_social:'Empresa fictícia',situacao_cadastral:'Ativo',data_abertura:'2000-01-01',tempo_cnpj:'26 anos',porte:'Pequeno',cnae_principal:'1234567',descricao_cnae_principal:'Atividade fictícia',endereco:{rua:'Rua fictícia',numero:'10',bairro:'Teste',cidade:'Cidade',estado:'SP',completo:'Endereço fictício'}};
const result = {cnpj:'60887522000189',cnpj_valido:true,encontrado:true,fonte:'mock',company,cnpj_validation_status:'cadastral_valid'};
const recorder = () => {const logs=[];return {logs,info:v=>logs.push(JSON.parse(v)),warn:v=>logs.push(JSON.parse(v)),error:v=>logs.push(JSON.parse(v))};};

test('score usa somente qualificação e cadastro consultado, com razões explícitas', () => {
  const qualified=calculateLeadScore({...form,tipoLoja:'Boutique'},company,new Date('2026-10-14'));
  assert.equal(qualified.lead_score,100);
  assert.equal(qualified.value,100);
  assert.equal(qualified.qualification_status,'qualificado');
  assert.deepEqual(qualified.score_breakdown.map(item=>item.points),[40,34,1,25]);
  const disqualified=calculateLeadScore({...form,tipoLoja:'Loja online',possuiLojaFisica:'Não'},
    {...company,data_abertura:'14/11/2025'},new Date('2026-10-14'));
  assert.equal(disqualified.lead_score,21);
  assert.equal(disqualified.qualification_status,'desqualificado');
  assert.equal(disqualified.disqualification_reasons.length,3);
  const magazine=calculateLeadScore({...form,tipoLoja:'Magazine'},company);
  assert.equal(magazine.score_breakdown[0].points,5);
  assert.equal(magazine.qualification_status,'desqualificado');
  const pending=calculateLeadScore(form,null);
  assert.equal(pending.qualification_status,'pendente_dados_cnpj');
});

test('checksum, máscara e mensagens silenciosas para CNPJ válido', () => {
  assert.equal(maskCnpj('60887522000189'), '60.887.522/0001-89');
  assert.equal(isValidCnpj('60887522000189'), true);
  for (const value of ['60887522000188','00000000000000','6088']) assert.equal(isValidCnpj(value),false);
  assert.equal(cnpjMessage('60887522000189'),'');
  assert.match(cnpjMessage('6088'),/14 números/);
  assert.match(cnpjMessage('00000000000000'),/inválido/);
});

test('OIDC runtime, sem repassar Authorization do navegador; inválido faz zero consultas', async () => {
  let calls=0;
  const fetchImpl=async (_,options) => {
    calls++;
    assert.equal(options.headers.Authorization,'Bearer runtime-token');
    assert.equal(options.headers['X-VFX-Landing-ID'],'republic-paradise-landing-page');
    return {ok:true,json:async()=>({...result,company:{razaoSocial:'Empresa fictícia',situacaoCadastral:'2',dataInicioAtividade:'2000-01-01',porte:'Pequeno',cnaePrincipal:'1234567',cnaePrincipalDescricao:'Atividade fictícia',endereco:{logradouro:'Rua fictícia',numero:'10',bairro:'Teste',municipio:'Cidade',uf:'SC'}}})};
  };
  const req=request({});req.headers.authorization='Bearer untrusted';
  assert.equal((await lookupCnpj(req,'00000000000000',{fetchImpl})).cnpj_valido,false);
  assert.equal(calls,0);
  const data=await lookupCnpj(req,form.cnpj,{fetchImpl});
  assert.equal(data.encontrado,true);
  assert.equal(data.company.situacao_cadastral,'Ativo');
  assert.equal(data.company.descricao_cnae_principal,'Atividade fictícia');
  assert.ok(data.company.endereco.completo);
});

test('aliases e registro esparso sem identidade não viram empresa encontrada', async () => {
  const normalized=normalizeCompany({razao_social:'A',cnae_fiscal:123,cnae_fiscal_descricao:'Descrição',data_abertura:'2000-01-01',logradouro:'Rua',numero:1,bairro:'B'});
  assert.equal(normalized.cnae_principal,'123');
  assert.equal(normalized.descricao_cnae_principal,'Descrição');
  const data=await lookupCnpj(request({}),form.cnpj,{fetchImpl:async()=>({ok:true,json:async()=>({...result,company:{porte:'ME',endereco:{bairro:'B'}}})})});
  assert.equal(data.encontrado,false);
  assert.equal(data.company,null);
});

test('ticket vinculado, expiração e adulteração', () => {
  const ticket=issueTicket(result,secret,1000);
  assert.deepEqual(readTicket(ticket,result.cnpj,secret,2000),result);
  assert.equal(readTicket(ticket,'11222333000181',secret,2000),null);
  assert.equal(readTicket(ticket,result.cnpj,secret,700000),null);
  assert.equal(readTicket(ticket+'forged',result.cnpj,secret,2000),null);
});

test('handler aceita antes de consulta e webhook pendentes, reutiliza ticket e conserva campos', async () => {
  let resolveWebhook, lookupCalls=0, captured;
  const webhook=new Promise(resolve=>{resolveWebhook=resolve;});
  const scheduled=[];const logger=recorder();const res=response();
  const handler=createLeadHandler({environment,logger,schedule:p=>scheduled.push(p),lookup:async()=>{lookupCalls++;return result;},fetchImpl:async(_,opts)=>{captured=JSON.parse(opts.body);return webhook;}});
  handler(request({...form,cnpj_ticket:issueTicket(result,secret),company:{razao_social:'forged'}}),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.accepted,true);
  await Promise.resolve();await Promise.resolve();
  assert.equal(lookupCalls,0);
  assert.equal(captured.company.razao_social,'Empresa fictícia');
  for(const key of ['name','nome_loja','whatsapp','email','cnpj','instagram_loja','tipo_loja','possui_loja_fisica','principais_marcas']) assert.ok(captured[key]);
  assert.equal(captured.whatsapp,'(11) 99999-0000');
  assert.equal(captured.lead_score,100);
  assert.equal(captured.value,captured.lead_score);
  assert.equal(captured.qualification_status,'qualificado');
  assert.ok(logger.logs.some(item=>item.event==='lead_score_calculated' && item.lead_score===100));
  resolveWebhook({ok:true,status:200});await Promise.all(scheduled);
  assert.equal(logger.logs.at(-1).event,'lead_delivery_completed');
});

test('sem cache, consulta pendente não bloqueia aceite; falha permite entrega checksum-only', async () => {
  let resolveLookup;const lookup=new Promise(resolve=>{resolveLookup=resolve;});
  let captured;const tasks=[];const res=response();
  createLeadHandler({environment,logger:recorder(),schedule:p=>tasks.push(p),lookup:()=>lookup,fetchImpl:async(_,opts)=>{captured=JSON.parse(opts.body);return {ok:true,status:200};}})(request(form),res);
  assert.equal(res.statusCode,200);
  assert.equal(captured,undefined);
  resolveLookup({cnpj_validation_status:'checksum_valid',encontrado:false,company:null});await Promise.all(tasks);
  assert.equal(captured.cnpj_validation_status,'checksum_valid');
});

test('lookup automático falho não repete consulta no envio', async () => {
  const tasks=[];let calls=0;const res=response();
  createLeadHandler({environment,logger:recorder(),schedule:p=>tasks.push(p),lookup:async()=>{calls++;return result;},fetchImpl:async()=>({ok:true,status:200})})(request({...form,cnpj_lookup_failed:true}),res);
  await Promise.all(tasks);
  assert.equal(res.statusCode,200);assert.equal(calls,0);
});

for(const kind of ['http','network']) test(`falha posterior ${kind} não muda confirmação e deixa evidência`,async()=>{
  const tasks=[];const logger=recorder();const res=response();
  createLeadHandler({environment,logger,schedule:p=>tasks.push(p),lookup:async()=>result,fetchImpl:async()=>{if(kind==='network') throw new TypeError('offline');return {ok:false,status:500};}})(request(form),res);
  assert.equal(res.statusCode,200);await Promise.all(tasks);
  assert.equal(logger.logs.at(-1).event,'lead_delivery_failed');assert.equal(res.statusCode,200);
});

test('configuração, backup ou agendamento falhos bloqueiam aceite e não chamam rede',async()=>{
  for(const kind of ['env','backup','schedule']) {
    let calls=0;const res=response();const logger=recorder();
    if(kind==='backup') logger.info=()=>{throw new Error('logging failed');};
    createLeadHandler({environment:kind==='env'?{}:environment,logger,schedule:()=>{if(kind==='schedule') throw new Error('schedule failed');},fetchImpl:async()=>{calls++;return {ok:true,status:200};}})(request(form),res);
    await Promise.resolve();assert.equal(res.statusCode,503);assert.equal(calls,0);
  }
});

test('dry-run, método, origem e entradas inválidas nunca entregam nem consultam',()=>{
  let calls=0;const handler=createLeadHandler({environment,logger:recorder(),schedule:()=>calls++,lookup:async()=>{calls++;return result;},fetchImpl:async()=>{calls++;return {ok:true,status:200};}});
  for(const body of [{...form,dry_run:true},{...form,cnpj:'60887522000188'},{...form,whatsapp:'123'}]) {
    const res=response();handler(request(body),res);assert.equal(res.statusCode,body.dry_run?200:400);
  }
  const res=response();handler({...request(form),method:'GET'},res);assert.equal(res.statusCode,405);
  const foreign=request(form);foreign.headers.origin='https://evil.test';const denied=response();handler(foreign,denied);assert.equal(denied.statusCode,403);
  assert.equal(calls,0);
});
