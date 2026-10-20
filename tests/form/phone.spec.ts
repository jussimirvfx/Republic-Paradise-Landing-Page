import {test,expect} from '@playwright/test';
import {prepare,fillForm,acceptRoute} from './helpers';

const ddds='11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' ');
const cases=[...ddds.map(ddd=>({id:`DDD ${ddd}`,ddd,mode:'fill',input:ddd+'999990000',valid:true})),
  ...['48','55','66','86'].map(ddd=>({id:`digitar ${ddd}`,ddd,mode:'type',input:ddd+'999990000',valid:true})),
  {id:'colar nacional',ddd:'11',mode:'paste',input:'(11) 99999-0000',valid:true},
  {id:'colar país com máscara',ddd:'48',mode:'paste',input:'+55 (48) 99999-0000',valid:true},
  {id:'colar país sem máscara',ddd:'11',mode:'paste',input:'5511999990000',valid:true},
  {id:'colar país e DDD 55',ddd:'55',mode:'paste',input:'+55 (55) 99999-0000',valid:true},
  ...['48','55'].map(ddd=>({id:`digitar internacional ${ddd}`,ddd,mode:'type',input:'+55'+ddd+'999990000',valid:true})),
  {id:'curto',ddd:'11',mode:'fill',input:'119999000',valid:false},
  {id:'DDD 20',ddd:'20',mode:'fill',input:'20999990000',valid:false},
  {id:'celular sem 9',ddd:'11',mode:'fill',input:'11899990000',valid:false}];

test('matriz de 80 telefones com todas as saídas interceptadas',async({context})=>{
  test.setTimeout(240000);
  expect(cases).toHaveLength(80);
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  for(const item of cases) await test.step(item.id,async()=>{
    const page=await context.newPage();
    await prepare(page,{ok:true,encontrado:false});await fillForm(page);
    await page.locator('#whatsapp').fill('');
    const phone=page.locator('#whatsapp');await phone.click();
    if(item.mode==='type')for(const key of item.input){await phone.pressSequentially(key);await expect(phone).toBeFocused();}
    else if(item.mode==='paste') {
      await page.evaluate(value=>navigator.clipboard.writeText(value),item.input);
      await page.keyboard.press(process.platform==='darwin'?'Meta+V':'Control+V');
    } else await phone.fill(item.input);
    const bodies:any[]=[];
    await page.route('**/api/leads',route=>{bodies.push(route.request().postDataJSON());return acceptRoute(route);});
    await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
    if(item.valid) {
      await expect(page.getByText('Recebemos seu cadastro para processamento.')).toBeVisible();
      expect(bodies).toHaveLength(1);expect(bodies[0].whatsapp.replace(/\D/g,'')).toBe(item.ddd+'999990000');
    } else {await expect(page.locator('#whatsapp-error')).toBeVisible();expect(bodies).toHaveLength(0);}
    await page.close();
  });
});

test('telefone preserva edição, rejeita colagem longa e confere autofill visível no submit',async({page})=>{
  await prepare(page);await fillForm(page);
  const phone=page.locator('#whatsapp');await phone.fill('48999990000');
  await phone.pressSequentially('1');await expect(phone).toHaveValue('(48) 99999-0000');
  await phone.fill('48999990000111');await expect(phone).toHaveValue('(48) 99999-0000');await expect(page.locator('#whatsapp-error')).toBeVisible();
  await phone.fill('4832345678');await phone.pressSequentially('9');await expect(phone).toHaveValue('(48) 32345-6789');
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();await expect(phone).toBeFocused();
  await phone.fill('55999990000');await phone.press('Home');await phone.press('ArrowRight');await phone.press('ArrowRight');
  await phone.press('Backspace');await phone.pressSequentially('5');await expect(phone).toBeFocused();
  await phone.evaluate((el:HTMLInputElement)=>{el.value='+55 (55) 99999-0000';});
  let body:any;await page.route('**/api/leads',route=>{body=route.request().postDataJSON();return acceptRoute(route);});
  await page.getByRole('button',{name:'Quero receber o catálogo de atacado',exact:true}).click();
  await expect(page.getByText('Recebemos seu cadastro para processamento.')).toBeVisible();expect(body.whatsapp).toBe('(55) 99999-0000');
});
