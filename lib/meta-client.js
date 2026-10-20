import { isTestLead } from './validation.js';

export function createMetaTracking({window:win,pixelId,fetchImpl=(...args)=>win.fetch(...args)}) {
  let started = false;
  const sent = new Set(), advanced = new Set();
  const dryRun = () => new URLSearchParams(win.location.search).has('dry_run');
  const cookie = name => win.document.cookie.split('; ').find(v=>v.startsWith(`${name}=`))?.slice(name.length+1);
  const hash = async value => [...new Uint8Array(await win.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const normalize = (value='') => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f\s]/g,'');
  const matchData = data => {
    const names = (data.name || '').trim().split(/\s+/);
    return {em:(data.email || '').trim().toLowerCase(),ph:(data.phone || '').replace(/\D/g,''),
      fn:normalize(names[0]),ln:normalize(names.length>1?names.at(-1):''),ct:normalize(data.city),
      st:normalize(data.state),zp:(data.zip || '').replace(/\D/g,''),country:'br'};
  };
  function installPixel() {
    if (!win.fbq) {
      const fbq = function(...args) {fbq.callMethod ? fbq.callMethod.apply(fbq,args) : fbq.queue.push(args);};
      fbq.queue=[];fbq.push=fbq;fbq.loaded=true;fbq.version='2.0';
      win.fbq=fbq;win._fbq ||= fbq;
      const script=win.document.createElement('script');script.async=true;
      script.src='https://connect.facebook.net/en_US/fbevents.js';win.document.head.appendChild(script);
    }
    win.fbq('init',pixelId);
  }
  async function emit(eventName,data={},context={}) {
    const lead = ['Lead','LeadQualificado'].includes(eventName);
    if (lead && (dryRun() || context.dry_run || isTestLead(context.nome_loja) || !context.submission_id || !context.tracking_receipt)) return {skipped:true};
    start();
    const eventId = lead ? `${context.submission_id}:${eventName}` : win.crypto.randomUUID();
    if (sent.has(eventId)) return {skipped:true};
    sent.add(eventId);
    const customData = lead ? {value:data.lead_score,lead_score:data.lead_score,currency:'BRL',
      content_name:'Cadastro de Lojista Republic Paradise',content_category:'Lead Generation'} : data;
    if (lead && !advanced.has(context.submission_id)) {advanced.add(context.submission_id);win.fbq('init',pixelId,matchData(data));}
    win.fbq(eventName==='LeadQualificado'||eventName==='Scroll'?'trackCustom':'track',eventName,customData,{eventID:eventId});
    if (dryRun() || context.dry_run) return {pixel_only:true};
    try {
      const userData={};
      if (lead) for(const [key,value] of Object.entries(matchData(data))) if(value) userData[key]=[await hash(value)];
      for(const key of ['fbp','fbc']) if(cookie('_'+key)) userData[key]=cookie('_'+key);
      const fbclid=new URLSearchParams(win.location.search).get('fbclid');
      if(!userData.fbc && fbclid) userData.fbc=`fb.1.${Date.now()}.${fbclid}`;
      const response=await fetchImpl('/api/meta/conversions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        event_name:eventName,event_id:eventId,event_time:Math.floor(Date.now()/1000),event_source_url:win.location.href,
        user_data:userData,custom_data:customData,...(lead?{nome_loja:context.nome_loja,submission_id:context.submission_id,tracking_receipt:context.tracking_receipt}:{}),
      })});
      return {success:response.ok};
    } catch {return {success:false};}
  }
  function start() {
    if(started)return;
    started=true;installPixel();void emit('PageView');
    const reached=new Set();let scheduled=false;
    win.addEventListener('scroll',()=>{
      if(scheduled)return;scheduled=true;
      win.requestAnimationFrame(()=>{
        scheduled=false;
        const height=win.document.documentElement.scrollHeight-win.innerHeight;
        const percent=height>0?Math.round(win.scrollY/height*100):0;
        for(const value of [25,50,75,100]) if(percent>=value&&!reached.has(value)) {reached.add(value);void emit('Scroll',{scroll_percentage:value});}
      });
    },{passive:true});
  }
  return {start,trackLead:(data,context)=>emit('Lead',data,context),trackLeadQualificado:(data,context)=>emit('LeadQualificado',data,context)};
}
