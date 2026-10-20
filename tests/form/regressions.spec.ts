import {test,expect} from '@playwright/test';
import {prepare,fillForm,accepted,acceptRoute,dryReceipt} from './helpers';

const company={data_abertura:'2000-01-01',endereco:{estado:'SP'}};
const button=(page:any)=>page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true});

test('marcador normalizado bloqueia Pixel e CAPI de Lead e preserva uma submissão',async({page})=>{
  const events:any[]=[];await prepare(page,{ok:true,encontrado:true,company,ticket:'mock'},'/',events);
  await fillForm(page,'  TÉSTE  MAIS  LOJISTAS - auditoria  ');
  let calls=0;await page.route('**/api/leads',async route=>{calls++;await new Promise(r=>setTimeout(r,300));await acceptRoute(route);});
  await button(page).dblclick();await expect(page.getByText('Recebemos seu cadastro para processamento.')).toBeVisible();
  await page.waitForTimeout(150);expect(calls).toBe(1);expect(events.filter(e=>e.event_name.startsWith('Lead'))).toHaveLength(0);
  const pixels=await page.evaluate(()=>((window as any).fbq.queue as any[]).filter(a=>['Lead','LeadQualificado'].includes(a[1])));
  expect(pixels).toHaveLength(0);
});

test('recibos negativos/incompletos não mostram sucesso nem convertem; retry preserva ID',async({page})=>{
  const events:any[]=[];await prepare(page,{ok:true,encontrado:true,company,ticket:'mock'},'/',events);await fillForm(page,'Loja fictícia normal');
  const bodies:any[]=[];let step=0;
  await page.route('**/api/leads',route=>{
    const body=route.request().postDataJSON();bodies.push(body);step++;
    return route.fulfill({json:step===1?{ok:true,accepted:false}:step===2?{ok:true,accepted:true}:step===3?{...accepted(body),tracking_receipt:''}:accepted(body)});
  });
  for(let i=0;i<3;i++) {
    await button(page).click();await expect(page.getByText('Não foi possível enviar seu cadastro. Seus dados foram mantidos; tente novamente.')).toBeVisible();
    expect(events.some(e=>e.event_name==='Lead')).toBe(false);await expect(page.locator('#nomeLoja')).toHaveValue('Loja fictícia normal');
  }
  await button(page).click();await expect(page.getByText('Recebemos seu cadastro para processamento.')).toBeVisible();
  expect(new Set(bodies.map(b=>b.submission_id)).size).toBe(1);
  await expect.poll(()=>events.filter(e=>e.event_name==='Lead').length).toBe(1);
});

test('modo inválido ou status indisponível nunca cai no cadastro normal',async({page})=>{
  let calls=0;await prepare(page,{},'/?dry_run=invalid');
  await page.route('**/api/leads',route=>{calls++;return acceptRoute(route);});
  await expect(button(page)).toBeDisabled();await expect(page.getByText('Modo de teste inválido. Nenhum cadastro será enviado.')).toBeVisible();
  await page.route('**/api/dry-run-status',route=>route.fulfill({json:{ok:true,enabled:false}}));
  await page.goto('/?dry_run=1');await expect(page.getByText('Modo de teste indisponível. Nenhum cadastro será enviado.')).toBeVisible();
  await expect(button(page)).toBeDisabled();expect(calls).toBe(0);
});

test('dry-run só confirma após todos os bloqueios; não pontua ou converte',async({page})=>{
  const events:any[]=[];await prepare(page,{ok:true,dry_run:true},'/?dry_run=1',events);await fillForm(page,'Loja fictícia normal');
  let step=0;await page.route('**/api/leads',route=>route.fulfill({json:++step===1?{ok:true,dry_run:true}:dryReceipt}));
  await button(page).click();await expect(page.getByText('Não foi possível enviar seu cadastro. Seus dados foram mantidos; tente novamente.')).toBeVisible();
  await button(page).click();await expect(page.getByText('Teste concluído. Nenhum cadastro foi enviado.')).toBeVisible();
  expect(events).toHaveLength(0);
});

test('todos os campos mantêm foco e caracteres com teclas reais, edição e navegação',async({page})=>{
  await prepare(page);
  for(const [id,value] of Object.entries({nomeProprietario:'Pessoa fictícia',nomeLoja:'Loja fictícia',email:'audit@example.invalid',whatsapp:'66999990000',cnpj:'60887522000189',instagramLoja:'@teste',principaisMarcas:'Marca fictícia'})) {
    const field=page.locator('#'+id);await field.click();
    for(const char of value){await field.pressSequentially(char);await expect(field).toBeFocused();}
    const before=await field.inputValue();await field.press('Backspace');await field.pressSequentially(value.at(-1)!);await expect(field).toHaveValue(before);
    await field.press('Tab');await expect(field).not.toBeFocused();
  }
});
