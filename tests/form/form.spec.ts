import { test, expect, Page } from '@playwright/test';

async function prepare(page:Page, lookup:any = {ok:true,ticket:'signed-server-ticket'}, path = '/') {
  await page.route('**/*', async route => {
    const url=new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.abort();
    if (url.pathname === '/api/cnpj') return route.fulfill({json:lookup});
    if (url.pathname === '/api/meta/conversions') return route.fulfill({json:{success:true,dry_run:true,skipped_meta:true}});
    return route.continue();
  });
  await page.goto(path);
  await expect(page).toHaveTitle('Republic Paradise — B2B Moda Resort');
}
async function fillForm(page:Page) {
  await page.getByPlaceholder('Seu nome completo').fill('TESTE Republic');
  await page.getByPlaceholder('Ex: Boutique Paradise').fill('Teste Mais Lojistas - Republic');
  await page.getByPlaceholder('(00) 00000-0000').fill('(11) 90000-0000');
  await page.getByPlaceholder('contato@sualoja.com.br').fill('teste@example.invalid');
  await page.getByPlaceholder('00.000.000/0000-00').fill('60887522000189');
  await page.getByPlaceholder('@sualoja',{exact:true}).fill('@teste');
  await page.locator('select').nth(0).selectOption('Boutique');
  await page.locator('select').nth(1).selectOption('Sim');
  await page.getByPlaceholder('Ex: Farm, Animale, Osklen, marcas autorais locais...').fill('Marca fictícia');
}

test('máscara, checksum imediato, incompleto no blur e CNPJ válido silencioso',async({page})=>{
  let posts=0;
  await prepare(page);
  await page.route('**/api/leads',route=>{posts++;return route.fulfill({json:{ok:true}});});
  const input=page.getByPlaceholder('00.000.000/0000-00');
  await input.fill('60887522000188');await expect(page.getByText('CNPJ inválido. Confira os números informados.')).toBeVisible();
  await input.fill('00000000000000');await expect(input).toHaveAttribute('aria-invalid','true');
  await input.fill('6088');await input.blur();await expect(page.getByText('Informe os 14 números do CNPJ.')).toBeVisible();
  await input.fill('');await input.pressSequentially('60887522000189');await expect(input).toHaveValue('60.887.522/0001-89');
  await expect(page.locator('#cnpj-error')).toHaveCount(0);await expect(input).toBeFocused();
  await page.waitForTimeout(100);await expect(page.locator('#cnpj-error')).toHaveCount(0);
  expect(posts).toBe(0);
});

test('CTA, lookup e validação não tiram o foco do campo escolhido',async({page})=>{
  await prepare(page);
  await expect(page.locator('#tipoLoja option')).toHaveText(['Selecione o formato da sua loja','Boutique','Multimarcas','Loja de shopping','Loja online','Revendedor(a) autônomo(a)','Magazine']);
  await page.getByRole('button',{name:'Quero receber o catálogo',exact:true}).first().click({force:true});
  const name=page.getByPlaceholder('Seu nome completo');
  await name.click();await name.fill('Texto preservado');await page.waitForTimeout(1000);await expect(name).toBeFocused();
  await fillForm(page);
  await page.getByPlaceholder('00.000.000/0000-00').fill('60887522000188');
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.locator('#cnpj')).toBeFocused();
  await name.click();await name.fill('Outro texto');await page.waitForTimeout(1000);await expect(name).toBeFocused();await expect(name).toHaveValue('Outro texto');
  await page.locator('#cnpj').fill('60887522000189');await name.click();await name.fill('Depois da consulta');
  await page.waitForTimeout(200);await expect(name).toBeFocused();await expect(name).toHaveValue('Depois da consulta');
});

test('confirmação somente após aceite da API, com todos os campos e ticket',async({page})=>{
  await prepare(page);await fillForm(page);
  let release:any;let captured:any;
  const pending=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/leads',async route=>{captured=route.request().postDataJSON();await pending;await route.fulfill({json:{ok:true,accepted:true}});});
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.getByText('Enviando cadastro...')).toBeVisible();
  await expect(page.getByText('Nossa equipe comercial entrará em contato pelo WhatsApp.',{exact:true})).toHaveCount(0);
  await expect.poll(()=>captured?.cnpj_ticket).toBe('signed-server-ticket');
  expect(Object.keys(captured)).toEqual(expect.arrayContaining(['nomeProprietario','nomeLoja','whatsapp','email','cnpj','instagramLoja','tipoLoja','possuiLojaFisica','principaisMarcas']));
  release();await expect(page.getByText('Nossa equipe comercial entrará em contato pelo WhatsApp.',{exact:true})).toBeVisible();
});

test('falhas da consulta são silenciosas; falha de envio preserva respostas para retry',async({page})=>{
  await prepare(page,{ok:true,encontrado:false,ticket:'signed-unavailable-ticket'});await fillForm(page);
  let count=0;
  await page.route('**/api/leads',route=>route.fulfill({status:++count===1?503:200,json:{ok:count>1}}));
  await expect(page.locator('#cnpj-error')).toHaveCount(0);
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.getByText('Não foi possível enviar seu cadastro. Seus dados foram mantidos; tente novamente.')).toBeVisible();
  await expect(page.getByPlaceholder('Seu nome completo')).toHaveValue('TESTE Republic');
  await expect(page.locator('#cnpj-error')).toHaveCount(0);
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.getByText('Nossa equipe comercial entrará em contato pelo WhatsApp.',{exact:true})).toBeVisible();
});

test('CNPJ inválido e telefone curto não chegam à API',async({page})=>{
  await prepare(page);await fillForm(page);let posts=0;
  await page.route('**/api/leads',route=>{posts++;return route.fulfill({json:{ok:true}});});
  await page.locator('#cnpj').fill('60887522000188');
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();expect(posts).toBe(0);
  await page.locator('#cnpj').fill('60887522000189');await page.locator('#whatsapp').fill('123');
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.getByText('Informe um DDD válido e 8 números, ou 9 números começando por 9.').first()).toBeVisible();expect(posts).toBe(0);
});

test('todos os campos exigidos mostram o erro e levam ao campo',async({page})=>{
  await prepare(page);
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.locator('#nomeProprietario')).toBeFocused();
  await expect(page.getByText('Nome completo proprietário: preenchimento obrigatório.')).toBeVisible();
  await fillForm(page);
  await page.locator('#principaisMarcas').fill('');
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.locator('#principaisMarcas')).toBeFocused();
  await expect(page.getByText('Principais marcas vendidas na sua loja: preenchimento obrigatório.')).toBeVisible();
});

for (const profile of [
  {type:'Boutique', physical:'Sim', company:{data_abertura:'2000-01-01',endereco:{estado:'SP'}}, score:100, status:'qualificado', reasons:0},
  {type:'Loja online', physical:'Não', company:{data_abertura:'2000-01-01',endereco:{estado:'SP'}}, score:36, status:'desqualificado', reasons:2},
  {type:'Boutique', physical:'Sim', company:null, score:74, status:'pendente_dados_cnpj', reasons:0},
]) test(`console detalha score ${profile.status}`,async({page})=>{
  const logs:any[]=[];
  page.on('console',async message=>{
    if (message.text().startsWith('lead_score_calculated')) logs.push(await message.args()[1].jsonValue());
  });
  await prepare(page,{ok:true,ticket:'signed-server-ticket',encontrado:Boolean(profile.company),company:profile.company});
  await fillForm(page);
  await page.locator('#tipoLoja').selectOption(profile.type);
  await page.locator('#possuiLojaFisica').selectOption(profile.physical);
  await page.route('**/api/leads',route=>route.fulfill({json:{ok:true}}));
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect.poll(()=>logs.length).toBe(1);
  expect(logs[0].lead_score).toBe(profile.score);
  expect(logs[0].qualification_status).toBe(profile.status);
  expect(logs[0].disqualification_reasons).toHaveLength(profile.reasons);
  expect(logs[0].score_breakdown.reduce((sum:number,item:any)=>sum+item.points,0)).toBe(profile.score);
});

for(const profile of [
  {type:'Boutique',company:{data_abertura:'2000-01-01',endereco:{cidade:'Cidade',estado:'SP',cep:'01001000'}},qualified:true,score:100},
  {type:'Loja online',company:{data_abertura:'2000-01-01',endereco:{estado:'SP'}},qualified:false,score:65},
  {type:'Boutique',company:null,qualified:false,score:74},
]) test(`Meta envia os eventos corretos para ${profile.type} com score ${profile.score}`,async({page})=>{
  const events:any[]=[];const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await prepare(page,{ok:true,ticket:'signed-server-ticket',encontrado:Boolean(profile.company),company:profile.company});
  await page.route('**/api/meta/conversions',route=>{
    events.push(route.request().postDataJSON());return route.fulfill({json:{success:true}});
  });
  await expect.poll(()=>events.filter(event=>event.event_name==='PageView').length).toBe(1);
  await fillForm(page);await page.locator('#tipoLoja').selectOption(profile.type);
  let release:any;const pending=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/leads',async route=>{await pending;await route.fulfill({json:{ok:true}});});
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  expect(events.some(event=>event.event_name==='Lead')).toBe(false);
  release();
  await expect.poll(()=>events.filter(event=>event.event_name==='Lead').length).toBe(1);
  await page.waitForTimeout(200);
  expect(events.filter(event=>event.event_name==='LeadQualificado')).toHaveLength(profile.qualified?1:0);
  const lead=events.find(event=>event.event_name==='Lead');
  expect(lead.custom_data.value).toBe(profile.score);expect(lead.custom_data.lead_score).toBe(profile.score);
  expect(lead.user_data.em[0]).toMatch(/^[a-f\d]{64}$/);
  expect(lead.user_data.ph[0]).toMatch(/^[a-f\d]{64}$/);
  const pixelEvents=await page.evaluate(()=>((window as any).fbq.queue as any[]).filter(args=>args[0]==='track' && args[1]==='Lead'));
  expect(pixelEvents[0][3].eventID).toBe(lead.event_id);
  expect(errors).toEqual([]);
});

test('dry-run do navegador não inicializa Pixel nem envia eventos Meta',async({page})=>{
  let events=0;
  await prepare(page,{ok:true,dry_run:true},'/?dry_run=1');
  await page.route('**/api/meta/conversions',route=>{events++;return route.fulfill({json:{success:true}});});
  await fillForm(page);
  await page.route('**/api/leads',route=>route.fulfill({json:{ok:true,dry_run:true}}));
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.getByText('Nossa equipe comercial entrará em contato pelo WhatsApp.',{exact:true})).toBeVisible();
  await page.waitForTimeout(900);
  expect(events).toBe(0);expect(await page.evaluate(()=>Boolean((window as any).fbq))).toBe(false);
});

test('rota CAPI local responde dry-run sem envio externo',async({page,request})=>{
  const response=await request.post('/api/meta/conversions',{
    headers:{Origin:'http://127.0.0.1:43173','X-VFX-Dry-Run':'1'},
    data:{event_name:'Lead',event_id:'local-smoke',event_time:Math.floor(Date.now()/1000),
      event_source_url:'http://127.0.0.1:43173/',user_data:{em:['a'.repeat(64)]},custom_data:{lead_score:100,value:100}},
  });
  expect(response.status()).toBe(200);expect(await response.json()).toMatchObject({dry_run:true,skipped_meta:true});
});
