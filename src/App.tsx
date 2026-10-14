import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cnpjMessage, digits, isValidCnpj, maskCnpj, maskPhone, storeTypes, validPhone } from '../lib/validation.js';
import { calculateLeadScore } from '../lib/lead-score.js';

type CnpjLookup = {
  cnpj:string;
  ticket?:string;
  failed?:boolean;
  company?:{data_abertura?:string; endereco?:{estado?:string}} | null;
  promise?:Promise<void>;
};

export default function App() {
  const [cnpjError, setCnpjError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sending = useRef(false);
  const lookupCache = useRef<CnpjLookup | null>(null);
  const [formData, setFormData] = useState({
    nomeProprietario: '',
    nomeLoja: '',
    whatsapp: '',
    email: '',
    cnpj: '',
    instagramLoja: '',
    tipoLoja: '',
    possuiLojaFisica: '',
    principaisMarcas: '',
  });

  const galleryImages = [
    {
      src: 'https://frwfcibbvbj5zog7.public.blob.vercel-storage.com/geral/1-1791204087875.webp',
      alt: 'Republic Paradise Coleção 1',
    },
    {
      src: 'https://frwfcibbvbj5zog7.public.blob.vercel-storage.com/geral/2-1791204087952.webp',
      alt: 'Republic Paradise Coleção 2',
    },
    {
      src: 'https://frwfcibbvbj5zog7.public.blob.vercel-storage.com/geral/3-1791204087980.webp',
      alt: 'Republic Paradise Coleção 3',
    },
    {
      src: 'https://frwfcibbvbj5zog7.public.blob.vercel-storage.com/geral/4-1791204088101.webp',
      alt: 'Republic Paradise Coleção 4',
    },
    {
      src: 'https://frwfcibbvbj5zog7.public.blob.vercel-storage.com/geral/5-1791204088052.webp',
      alt: 'Republic Paradise Coleção 5',
    },
    {
      src: 'https://frwfcibbvbj5zog7.public.blob.vercel-storage.com/geral/6-1791204087914.webp',
      alt: 'Republic Paradise Coleção 6',
    },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  // Troca automática de fotos a cada 2 segundos no mobile
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % galleryImages.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [galleryImages.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % galleryImages.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (diff > 40) {
      nextSlide();
    } else if (diff < -40) {
      prevSlide();
    }
    setTouchStart(null);
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = maskCnpj(e.target.value);
    if (lookupCache.current?.cnpj !== digits(value)) lookupCache.current = null;
    setCnpjError(digits(value).length === 14 ? cnpjMessage(value) : '');
    setFormData((prev) => ({ ...prev, cnpj: value }));
    if (isValidCnpj(value)) void prefetchCnpj(value);
  };

  const prefetchCnpj = (value:string) => {
    const cnpj = digits(value);
    if (!isValidCnpj(cnpj) || lookupCache.current?.cnpj === cnpj) return;
    const entry:CnpjLookup = {cnpj, failed:false, company:null};
    lookupCache.current = entry;
    entry.promise = (async () => { try {
      const dryRun = new URLSearchParams(window.location.search).get('dry_run') === '1';
      const response = await fetch('/api/cnpj', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({cnpj, dry_run:dryRun})});
      const result = await response.json();
      if (lookupCache.current !== entry) return;
      entry.ticket = response.ok && typeof result.ticket === 'string' ? result.ticket : undefined;
      entry.company = response.ok && result.encontrado === true ? result.company || null : null;
      entry.failed = !response.ok || (!result.ticket && !dryRun);
    } catch { if (lookupCache.current === entry) entry.failed = true; }
    })();
  };

  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqItems = [
    {
      pergunta: 'Qual é o pedido mínimo?',
      resposta: 'O pedido mínimo aceito é a partir de 30 peças ou R$ 3.000,00.',
    },
    {
      pergunta: 'Quais são as formas de pagamento?',
      resposta: 'Aceitamos Pix, Cartão de crédito (em até 4x) e Boleto bancário (mediante análise prévia de crédito pelo setor financeiro).',
    },
    {
      pergunta: 'Como funciona a política de trocas?',
      resposta: 'A política de troca é restrita exclusivamente a defeitos de fabricação; não são aceitas devoluções ou trocas por encalhe de estoque.',
    },
  ];

  const scrollToForm = () => {
    const el = document.getElementById('cta-form');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending.current) return;
    const form = e.currentTarget;
    setSubmitError('');
    setFieldError('');
    setCnpjError(cnpjMessage(formData.cnpj));
    setPhoneError(validPhone(formData.whatsapp) ? '' : 'Informe um DDD válido e 8 números, ou 9 números começando por 9.');
    const fields = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select'));
    const invalid = fields.find(field => !field.value.trim() || !field.checkValidity()
      || (field.id === 'cnpj' && !isValidCnpj(field.value))
      || (field.id === 'whatsapp' && !validPhone(field.value)));
    if (invalid) {
      const label = form.querySelector<HTMLLabelElement>(`label[for="${invalid.id}"]`)?.textContent?.replace('*','').trim() || 'Campo';
      const message = !invalid.value.trim() ? `${label}: preenchimento obrigatório.`
        : invalid.id === 'cnpj' ? cnpjMessage(invalid.value)
        : invalid.id === 'whatsapp' ? 'Informe um DDD válido e 8 números, ou 9 números começando por 9.'
        : `${label}: confira o valor informado.`;
      setFieldError(message);
      invalid.scrollIntoView({behavior:'smooth', block:'center'});
      invalid.focus({preventScroll:true});
      return;
    }
    sending.current = true;
    setIsSubmitting(true);
    try {
      const cache = lookupCache.current?.cnpj === digits(formData.cnpj) ? lookupCache.current : null;
      const dryRun = new URLSearchParams(window.location.search).get('dry_run') === '1';
      const response = await fetch('/api/leads', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...formData, url:window.location.href, dry_run:dryRun, cnpj_ticket:cache?.ticket, cnpj_lookup_failed:cache?.failed === true}),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error('API rejected lead');
      setSubmitted(true);
      // Reutiliza a consulta em andamento sem atrasar a confirmação do cadastro.
      void (async () => {
        await cache?.promise;
        const scoring = calculateLeadScore(formData, cache?.company);
        console.group('Lead scoring — Republic Paradise');
        console.log('Nota final:', scoring.lead_score, '/ 100');
        console.table(scoring.score_breakdown);
        console.log('Somatório:', scoring.score_breakdown.map(item => item.points).join(' + '), '=', scoring.lead_score);
        console.log('Status:', scoring.qualification_status);
        console.log('Motivos de desqualificação:', scoring.disqualification_reasons);
        if (scoring.qualification_status === 'pendente_dados_cnpj') console.warn('Pontuação parcial: dados cadastrais do CNPJ indisponíveis.');
        console.log('lead_score_calculated', scoring);
        console.groupEnd();
      })();
    } catch {
      setSubmitError('Não foi possível enviar seu cadastro. Seus dados foram mantidos; tente novamente.');
    } finally { sending.current = false; setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#242220] flex flex-col font-sans selection:bg-[#E7DCCE]">
      <main className="flex-1">
        {/* 1. Hero */}
        <section className="relative min-h-[100dvh] sm:min-h-[640px] md:min-h-[700px] lg:min-h-[92vh] flex flex-col justify-between sm:justify-center items-center overflow-hidden pt-4 pb-8 sm:py-20 md:py-24 lg:py-48 px-6">
          {/* Background image & gradient overlay */}
          <div className="absolute inset-0 z-0">
            <img
              src="https://frwfcibbvbj5zog7.public.blob.vercel-storage.com/geral/hero-2-1791200599492.webp"
              alt="Moda resort Republic Paradise"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-[30%_center] sm:object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/30 to-black/50"></div>
          </div>

          <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col justify-between sm:justify-center items-center text-center flex-1 sm:flex-initial sm:space-y-8 md:space-y-10 lg:space-y-14 pt-0 pb-2 sm:py-0">
            {/* Logo in white color - positioned right at the top on mobile */}
            <div className="flex justify-center pt-1 sm:pt-0">
              <img
                src="https://frwfcibbvbj5zog7.public.blob.vercel-storage.com/geral/logo-png-1791200707475.webp"
                alt="Republic Paradise"
                referrerPolicy="no-referrer"
                className="w-[190px] sm:w-[260px] md:w-[290px] lg:w-[353px] h-auto max-w-[70vw] sm:max-w-full object-contain brightness-0 invert drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]"
              />
            </div>

            {/* Headline e CTA centralizados no espaço abaixo do logo no mobile. */}
            <div className="flex flex-col flex-1 justify-center sm:flex-initial sm:justify-start items-center space-y-6 sm:space-y-8 md:space-y-10 lg:space-y-14 py-8 sm:py-0 w-full">
              {/* Headline */}
              <h1
                className="text-[35px] leading-[41px] sm:text-3xl md:text-4xl lg:text-[54px] lg:leading-[66.4px] text-white font-normal tracking-tight max-w-4xl text-balance"
                style={{
                  textShadow: '0 3px 12px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.5)',
                }}
              >
                <span className="font-black">Lojista</span>, tenha uma moda resort autoral na sua loja.
              </h1>

              {/* Jumping Prominent Button */}
              <div className="pt-2 sm:pt-4 lg:pt-6">
                <button
                  onClick={scrollToForm}
                  className="animate-bounce-gentle inline-flex items-center justify-center gap-2 sm:gap-3.5 px-4 sm:px-8 md:px-10 lg:px-12 py-3.5 sm:py-4 lg:py-5 bg-linear-to-b from-[#ffe1a6] to-[#d9a354] text-[#181C2E] border border-[#ffe1a6] text-[11px] sm:text-xs lg:text-sm uppercase tracking-[0.11em] sm:tracking-[0.16em] lg:tracking-[0.2em] font-bold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffe1a6] active:scale-[0.98] transition-all cursor-pointer rounded-none whitespace-nowrap max-w-full"
                >
                  <span className="whitespace-nowrap">Quero receber o catálogo</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 stroke-[2.2] shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Formulário para receber o catálogo */}
        <section id="cta-form" className="py-20 md:py-28 bg-[#cb9f69] border-b border-[#b88c57]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
              {/* Lado Esquerdo */}
              <div className="lg:col-span-5 flex flex-col justify-start text-left lg:sticky lg:top-28 space-y-6 text-white">
                <span className="text-xs uppercase tracking-[0.25em] text-white/90 font-bold block">
                  Cadastro de Lojista
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-[45px] text-white font-bold leading-[1.18] tracking-tight drop-shadow-sm">
                  Seja um parceiro Republic Paradise
                </h2>
                <p className="text-base sm:text-lg text-white/90 leading-relaxed font-medium">
                  Preencha seus dados para receber o catálogo de atacado da Republic Paradise e conhecer as peças disponíveis para a sua loja.
                </p>
              </div>

              {/* Lado Direito: Formulário */}
              <div className="lg:col-span-7">
                <div className="bg-white p-6 sm:p-10 shadow-2xl rounded-none text-[#181C2E]">
                  {submitted ? (
                    <div className="text-center py-8 space-y-4">
                      <CheckCircle2 className="w-12 h-12 text-[#181C2E] mx-auto stroke-[1.5]" />
                      <p className="text-lg text-[#181C2E] font-semibold">
                        Nossa equipe comercial entrará em contato pelo WhatsApp.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} noValidate className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* 1. Nome completo proprietário */}
                        <div>
                          <label htmlFor="nomeProprietario" className="block text-xs uppercase tracking-wider text-[#181C2E] font-semibold mb-2">
                            Nome completo proprietário <span className="text-[#8C3A32]">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            id="nomeProprietario"
                            value={formData.nomeProprietario}
                            onChange={(e) => setFormData({ ...formData, nomeProprietario: e.target.value })}
                            placeholder="Seu nome completo"
                            className="w-full px-4 py-3.5 bg-white border border-[#cb9f69] text-[#181C2E] text-sm placeholder:text-[#181C2E]/40 focus:outline-none focus:border-[#181C2E] focus:ring-1 focus:ring-[#181C2E] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                          />
                        </div>

                        {/* 2. Nome da loja */}
                        <div>
                          <label htmlFor="nomeLoja" className="block text-xs uppercase tracking-wider text-[#181C2E] font-semibold mb-2">
                            Nome da loja <span className="text-[#8C3A32]">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            id="nomeLoja"
                            value={formData.nomeLoja}
                            onChange={(e) => setFormData({ ...formData, nomeLoja: e.target.value })}
                            placeholder="Ex: Boutique Paradise"
                            className="w-full px-4 py-3.5 bg-white border border-[#cb9f69] text-[#181C2E] text-sm placeholder:text-[#181C2E]/40 focus:outline-none focus:border-[#181C2E] focus:ring-1 focus:ring-[#181C2E] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                          />
                        </div>

                        {/* 3. WhatsApp */}
                        <div>
                          <label htmlFor="whatsapp" className="block text-xs uppercase tracking-wider text-[#181C2E] font-semibold mb-2">
                            WhatsApp <span className="text-[#8C3A32]">*</span>
                          </label>
                          <input
                            type="tel"
                            id="whatsapp"
                            required
                            inputMode="tel"
                            maxLength={15}
                            aria-invalid={Boolean(phoneError)}
                            aria-describedby={phoneError ? 'whatsapp-error' : undefined}
                            value={formData.whatsapp}
                            onChange={(e) => { setPhoneError(''); setFormData({ ...formData, whatsapp: maskPhone(e.target.value) }); }}
                            placeholder="(00) 00000-0000"
                            className="w-full px-4 py-3.5 bg-white border border-[#cb9f69] text-[#181C2E] text-sm placeholder:text-[#181C2E]/40 focus:outline-none focus:border-[#181C2E] focus:ring-1 focus:ring-[#181C2E] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                          />
                          {phoneError && <p id="whatsapp-error" role="alert" className="mt-2 text-xs text-[#8C3A32]">{phoneError}</p>}
                        </div>

                        {/* 4. E-mail */}
                        <div>
                          <label htmlFor="email" className="block text-xs uppercase tracking-wider text-[#181C2E] font-semibold mb-2">
                            E-mail <span className="text-[#8C3A32]">*</span>
                          </label>
                          <input
                            type="email"
                            required
                            id="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="contato@sualoja.com.br"
                            className="w-full px-4 py-3.5 bg-white border border-[#cb9f69] text-[#181C2E] text-sm placeholder:text-[#181C2E]/40 focus:outline-none focus:border-[#181C2E] focus:ring-1 focus:ring-[#181C2E] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                          />
                        </div>

                        {/* 5. CNPJ */}
                        <div>
                          <label htmlFor="cnpj" className="block text-xs uppercase tracking-wider text-[#181C2E] font-semibold mb-2">
                            CNPJ <span className="text-[#8C3A32]">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.cnpj}
                            id="cnpj"
                            inputMode="numeric"
                            maxLength={18}
                            aria-invalid={Boolean(cnpjError)}
                            aria-describedby={cnpjError ? 'cnpj-error' : undefined}
                            onBlur={() => { setCnpjError(cnpjMessage(formData.cnpj)); void prefetchCnpj(formData.cnpj); }}
                            onChange={handleCnpjChange}
                            placeholder="00.000.000/0000-00"
                            className="w-full px-4 py-3.5 bg-white border border-[#cb9f69] text-[#181C2E] text-sm placeholder:text-[#181C2E]/40 focus:outline-none focus:border-[#181C2E] focus:ring-1 focus:ring-[#181C2E] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                          />
                          {cnpjError && <p id="cnpj-error" role="alert" className="mt-2 text-xs text-[#8C3A32]">{cnpjError}</p>}
                        </div>

                        {/* 6. Instagram da loja */}
                        <div>
                          <label htmlFor="instagramLoja" className="block text-xs uppercase tracking-wider text-[#181C2E] font-semibold mb-2">
                            Instagram da loja <span className="text-[#8C3A32]">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            id="instagramLoja"
                            value={formData.instagramLoja}
                            onChange={(e) => setFormData({ ...formData, instagramLoja: e.target.value })}
                            placeholder="@sualoja"
                            className="w-full px-4 py-3.5 bg-white border border-[#cb9f69] text-[#181C2E] text-sm placeholder:text-[#181C2E]/40 focus:outline-none focus:border-[#181C2E] focus:ring-1 focus:ring-[#181C2E] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                          />
                        </div>

                        {/* 7. Tipo de loja */}
                        <div>
                          <label htmlFor="tipoLoja" className="block text-xs uppercase tracking-wider text-[#181C2E] font-semibold mb-2">
                            Tipo de loja <span className="text-[#8C3A32]">*</span>
                          </label>
                          <select
                            required
                            id="tipoLoja"
                            value={formData.tipoLoja}
                            onChange={(e) => setFormData({ ...formData, tipoLoja: e.target.value })}
                            className="w-full px-4 py-3.5 bg-white border border-[#cb9f69] text-[#181C2E] text-sm focus:outline-none focus:border-[#181C2E] focus:ring-1 focus:ring-[#181C2E] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                          >
                            <option value="">Selecione o formato da sua loja</option>
                            {storeTypes.map(type => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </div>

                        {/* 8. Possui loja física? */}
                        <div>
                          <label htmlFor="possuiLojaFisica" className="block text-xs uppercase tracking-wider text-[#181C2E] font-semibold mb-2">
                            Possui loja física? <span className="text-[#8C3A32]">*</span>
                          </label>
                          <select
                            required
                            id="possuiLojaFisica"
                            value={formData.possuiLojaFisica}
                            onChange={(e) => setFormData({ ...formData, possuiLojaFisica: e.target.value })}
                            className="w-full px-4 py-3.5 bg-white border border-[#cb9f69] text-[#181C2E] text-sm focus:outline-none focus:border-[#181C2E] focus:ring-1 focus:ring-[#181C2E] transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                          >
                            <option value="">Selecione uma opção</option>
                            <option value="Sim">Sim</option>
                            <option value="Não">Não</option>
                          </select>
                        </div>

                        {/* 9. Principais marcas vendidas na sua loja */}
                        <div className="sm:col-span-2">
                          <label htmlFor="principaisMarcas" className="block text-xs uppercase tracking-wider text-[#181C2E] font-semibold mb-2">
                            Principais marcas vendidas na sua loja
                          </label>
                          <input
                            type="text"
                            id="principaisMarcas"
                            required
                            value={formData.principaisMarcas}
                            onChange={(e) => setFormData({ ...formData, principaisMarcas: e.target.value })}
                            placeholder="Ex: Farm, Animale, Osklen, marcas autorais locais..."
                            className="w-full px-4 py-3.5 bg-white border border-[#cb9f69] text-[#181C2E] text-sm placeholder:text-[#181C2E]/40 focus:outline-none focus:border-[#181C2E] focus:ring-1 focus:ring-[#181C2E] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                          />
                        </div>
                      </div>

                      {/* Ação de envio */}
                      <div className="pt-4 space-y-3">
                        {fieldError && <p role="alert" className="text-sm text-[#8C3A32]">{fieldError}</p>}
                        {submitError && <p role="alert" className="text-sm text-[#8C3A32]">{submitError}</p>}
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full py-3.5 sm:py-4 px-4 sm:px-6 bg-[#181C2E] text-white text-[11px] sm:text-xs leading-snug sm:leading-normal uppercase tracking-[0.09em] sm:tracking-[0.2em] font-semibold hover:bg-[#252b45] active:scale-[0.99] transition-all flex items-center justify-center gap-2 sm:gap-3 cursor-pointer shadow-lg text-center"
                        >
                          <span>{isSubmitting ? 'Enviando cadastro...' : 'Quero receber o catálogo de atacado'}</span>
                          <ArrowRight className="w-4 h-4 shrink-0" />
                        </button>
                        <p className="text-xs text-[#181C2E]/80 text-center leading-relaxed">
                          Nossa equipe comercial entrará em contato diretamente pelo WhatsApp para apresentar o catálogo e condições de atacado.
                        </p>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Fotos e Lifestyle */}
        <section className="py-20 md:py-28 border-b border-[#EAE3D9] bg-[#FAF8F5]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-3xl mb-14">
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#181c2e] leading-tight font-normal mb-6">
                Peças que carregam a essência da <span className="font-extrabold">Republic Paradise</span>
              </h2>
              <div className="space-y-4 text-base sm:text-lg text-[#181c2e] leading-relaxed">
                <p>
                  A marca traduz seu lifestyle em uma moda autoral, com estampas exclusivas, detalhes artesanais e uma identidade visual própria. Suas peças expressam criatividade e personalidade, trazendo essa essência para o dia a dia.
                </p>
                <p>
                  Para as lojas multimarcas, representa uma oportunidade de oferecer produtos com identidade e diferenciais que valorizam a seleção da loja e enriquecem o atendimento ao cliente.
                </p>
              </div>
              <div className="pt-6">
                <button
                  onClick={scrollToForm}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-[#181c2e] text-white text-xs uppercase tracking-widest font-semibold hover:bg-[#252b45] active:scale-[0.99] transition-all cursor-pointer shadow-md"
                >
                  <span>Quero receber o catálogo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile Carousel (apenas no modo mobile: passa automaticamente a cada 2s e com botões manuais) */}
            <div className="block sm:hidden">
              <div
                className="relative aspect-[3/4] w-full bg-[#EAE3D9] overflow-hidden shadow-md select-none touch-pan-y"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {/* Slides track */}
                <div
                  className="flex h-full w-full transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {galleryImages.map((img, idx) => (
                    <div key={idx} className="w-full h-full flex-shrink-0 relative">
                      <img
                        src={img.src}
                        alt={img.alt}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>

                {/* Botão Anterior */}
                <button
                  type="button"
                  onClick={prevSlide}
                  aria-label="Foto anterior"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm active:scale-95 transition-all shadow-lg z-10 cursor-pointer"
                >
                  <ChevronLeft className="w-6 h-6 stroke-[2.2]" />
                </button>

                {/* Botão Próximo */}
                <button
                  type="button"
                  onClick={nextSlide}
                  aria-label="Próxima foto"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white flex items-center justify-center backdrop-blur-sm active:scale-95 transition-all shadow-lg z-10 cursor-pointer"
                >
                  <ChevronRight className="w-6 h-6 stroke-[2.2]" />
                </button>
              </div>
            </div>

            {/* Desktop & Tablet Gallery: Grid tradicional preservada */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {galleryImages.map((img, idx) => (
                <div key={idx} className="group relative aspect-[3/4] bg-[#EAE3D9] overflow-hidden shadow-sm">
                  <img
                    src={img.src}
                    alt={img.alt}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Números de autoridade (3 cards) */}
        <section className="relative py-20 md:py-28 overflow-hidden border-b border-[#EAE3D9]">
          {/* Background Image & Softer Overlay */}
          <div className="absolute inset-0 z-0">
            <img
              src="https://frwfcibbvbj5zog7.public.blob.vercel-storage.com/geral/top-1791203213495.webp"
              alt="Republic Paradise"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/30"></div>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-8 text-center">
              <div className="py-8 sm:py-10 px-4 sm:px-6 lg:px-8 bg-black/40 backdrop-blur-md shadow-2xl flex flex-col justify-center items-center rounded-none">
                <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-none block whitespace-nowrap drop-shadow-sm">
                  +80mil
                </span>
                <span className="text-xs sm:text-[13px] lg:text-sm uppercase tracking-[0.12em] text-white/90 font-semibold mt-3 block whitespace-nowrap drop-shadow-sm">
                  peças produzidas por ano
                </span>
              </div>

              <div className="py-8 sm:py-10 px-4 sm:px-6 lg:px-8 bg-black/40 backdrop-blur-md shadow-2xl flex flex-col justify-center items-center rounded-none">
                <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-none block whitespace-nowrap drop-shadow-sm">
                  +10 anos
                </span>
                <span className="text-xs sm:text-[13px] lg:text-sm uppercase tracking-[0.12em] text-white/90 font-semibold mt-3 block whitespace-nowrap drop-shadow-sm">
                  de mercado
                </span>
              </div>

              <div className="py-8 sm:py-10 px-4 sm:px-6 lg:px-8 bg-black/40 backdrop-blur-md shadow-2xl flex flex-col justify-center items-center rounded-none">
                <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-none block whitespace-nowrap drop-shadow-sm">
                  +200
                </span>
                <span className="text-xs sm:text-[13px] lg:text-sm uppercase tracking-[0.12em] text-white/90 font-semibold mt-3 block whitespace-nowrap drop-shadow-sm">
                  estampas exclusivas já produzidas
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Por que escolher a Republic Paradise? */}
        <section className="py-14 sm:py-20 md:py-28 bg-white border-b border-[#EAE3D9]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl mb-8 sm:mb-14">
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.16em] sm:tracking-[0.25em] text-[#181c2e] font-semibold block mb-2 sm:mb-3">
                Por que escolher a Republic Paradise?
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl lg:text-[45px] text-[#181c2e] leading-tight font-normal">
                Identidade em cada detalhe
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
              <div className="p-5 sm:p-8 md:p-10 bg-[#181c2e] shadow-lg sm:shadow-xl hover:shadow-2xl transition-all duration-300 rounded-none">
                <h3 className="font-serif text-lg sm:text-2xl text-white mb-1.5 sm:mb-3 font-medium">
                  Estampas exclusivas
                </h3>
                <p className="text-sm sm:text-base text-white/85 leading-relaxed">
                  Criações autorais que destacam as peças na vitrine e durante o atendimento.
                </p>
              </div>

              <div className="p-5 sm:p-8 md:p-10 bg-[#181c2e] shadow-lg sm:shadow-xl hover:shadow-2xl transition-all duration-300 rounded-none">
                <h3 className="font-serif text-lg sm:text-2xl text-white mb-1.5 sm:mb-3 font-medium">
                  Produção autoral
                </h3>
                <p className="text-sm sm:text-base text-white/85 leading-relaxed">
                  Uma marca brasileira com forte ligação com a produção local e o trabalho artístico.
                </p>
              </div>

              <div className="p-5 sm:p-8 md:p-10 bg-[#181c2e] shadow-lg sm:shadow-xl hover:shadow-2xl transition-all duration-300 rounded-none">
                <h3 className="font-serif text-lg sm:text-2xl text-white mb-1.5 sm:mb-3 font-medium">
                  Design e acabamento
                </h3>
                <p className="text-sm sm:text-base text-white/85 leading-relaxed">
                  Peças desenvolvidas com atenção aos detalhes, aos aviamentos e à qualidade percebida.
                </p>
              </div>

              <div className="p-5 sm:p-8 md:p-10 bg-[#181c2e] shadow-lg sm:shadow-xl hover:shadow-2xl transition-all duration-300 rounded-none">
                <h3 className="font-serif text-lg sm:text-2xl text-white mb-1.5 sm:mb-3 font-medium">
                  Marca reconhecida
                </h3>
                <p className="text-sm sm:text-base text-white/85 leading-relaxed">
                  Uma década de história e uma comunidade de mais de 69 mil seguidores.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Sobre a Republic Paradise */}
        <section className="relative py-20 sm:py-24 md:py-32 overflow-hidden border-b border-[#EAE3D9]">
          {/* Background Image & Overlay */}
          <div className="absolute inset-0 z-0">
            <img
              src="https://frwfcibbvbj5zog7.public.blob.vercel-storage.com/geral/hero-3-1791205767076.webp"
              alt="Sobre a Republic Paradise"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-[28%_center] sm:object-center"
            />
            {/* Overlay escuro ativo apenas no mobile; removido completamente no desktop */}
            <div className="absolute inset-0 bg-black/65 md:hidden pointer-events-none"></div>
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
              <div className="hidden lg:block lg:col-span-6"></div>

              <div className="lg:col-span-6 space-y-6">
                <span className="text-xs uppercase tracking-[0.25em] text-white/80 font-medium block">
                  Sobre a Republic Paradise
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl lg:text-[47px] leading-tight lg:leading-[52px] text-white font-medium text-balance w-full max-w-[510px] mb-[17px] -ml-[2px] pl-0">
                  Uma marca autoral criada para quem escolhe viver com personalidade
                </h2>
                <div className="space-y-4 text-base sm:text-lg text-white/90 leading-relaxed drop-shadow-sm">
                  <p>
                    Nascida em Fortaleza, a Republic Paradise construiu sua trajetória com uma moda resort marcada por estampas exclusivas, trabalho manual e atenção aos detalhes.
                  </p>
                  <p>
                    Há mais de 10 anos, a marca transforma referências, histórias e inspirações em peças com identidade própria.
                  </p>
                  <p>
                    Hoje, a Republic Paradise busca construir novas parcerias com lojistas que valorizam produtos diferenciados e uma marca com história para contar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Perguntas Frequentes */}
        <section className="py-14 sm:py-20 md:py-28 border-b border-[#EAE3D9] bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-8 sm:mb-12">
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.16em] sm:tracking-[0.25em] text-[#181c2e] font-semibold block mb-2 sm:mb-3">
                Dúvidas do Lojista
              </span>
              <h2 className="font-serif text-2xl sm:text-4xl text-[#181c2e] font-normal">
                Perguntas Frequentes
              </h2>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {faqItems.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className="border border-[#cb9f69] bg-white transition-all shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full py-3.5 sm:py-5 px-4 sm:px-8 flex items-center justify-between text-left gap-3 sm:gap-4 cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span className="font-serif text-[15px] sm:text-xl leading-snug sm:leading-normal text-[#181c2e] font-medium">
                        {item.pergunta}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 sm:w-5 sm:h-5 text-[#cb9f69] shrink-0 transition-transform duration-300 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 sm:px-8 pb-4 sm:pb-6 pt-1 text-[#181c2e] text-xs sm:text-base leading-relaxed border-t border-[#cb9f69]/30">
                        <p>{item.resposta}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-14 border-t border-[#252b45] bg-[#181c2e]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col items-center justify-center gap-5 text-center">
          <div
            className="w-[220px] sm:w-[260px] h-[54px] sm:h-[64px] bg-[#cb9f69] transition-transform duration-300 hover:scale-105"
            style={{
              maskImage: 'url("https://frwfcibbvbj5zog7.public.blob.vercel-storage.com/geral/logo-png-1791200707475.webp")',
              WebkitMaskImage: 'url("https://frwfcibbvbj5zog7.public.blob.vercel-storage.com/geral/logo-png-1791200707475.webp")',
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
            }}
            role="img"
            aria-label="Republic Paradise"
          />
          <p className="text-xs sm:text-sm text-white tracking-wide">
            © 2026 Mais Lojistas. Todos os direitos reservados.
          </p>
        </div>
      </footer>
      <button
        type="button"
        onClick={scrollToForm}
        aria-label="WhatsApp: ir para o formulário"
        className="motion-safe:animate-[float-gentle_2.2s_ease-in-out_infinite] fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] sm:right-6 z-50 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[#00c853] text-white shadow-lg hover:bg-[#00b848] hover:scale-105 active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00c853] cursor-pointer"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-8 w-8">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.448-8.413" />
        </svg>
      </button>
    </div>
  );
}
