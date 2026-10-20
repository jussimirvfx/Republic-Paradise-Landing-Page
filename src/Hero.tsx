import { ArrowRight } from 'lucide-react';

export default function Hero() {
  return (
<section className="relative min-h-[100dvh] sm:min-h-[640px] md:min-h-[700px] lg:min-h-[92vh] flex flex-col justify-between sm:justify-center items-center overflow-hidden pt-4 pb-8 sm:py-20 md:py-24 lg:py-48 px-6">
          {/* Background image & gradient overlay */}
          <div className="absolute inset-0 z-0">
            <picture>
              <source media="(max-width: 639px) and (orientation: portrait)" srcSet="/hero-mobile.webp" />
              <img
              id="hero-image"
              src="/hero-desktop.webp"
              width={1920}
              height={1000}
              fetchPriority="high"
              alt="Moda resort Republic Paradise"
              className="w-full h-full object-cover object-[30%_center] sm:object-center"
            />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/30 to-black/50"></div>
          </div>

          <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col justify-between sm:justify-center items-center text-center flex-1 sm:flex-initial sm:space-y-8 md:space-y-10 lg:space-y-14 pt-0 pb-2 sm:py-0">
            {/* Logo in white color - positioned right at the top on mobile */}
            <div className="flex justify-center pt-1 sm:pt-0">
              <img
                src="/republic-logo.webp"
                width={8071}
                height={1487}
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
                  id="hero-cta"
                  onClick={() => document.getElementById('cta-form')?.scrollIntoView({behavior:'smooth'})}
                  className="animate-bounce-gentle inline-flex items-center justify-center gap-2 sm:gap-3.5 px-4 sm:px-8 md:px-10 lg:px-12 py-3.5 sm:py-4 lg:py-5 bg-linear-to-b from-[#ffe1a6] to-[#d9a354] text-[#181C2E] border border-[#ffe1a6] text-[11px] sm:text-xs lg:text-sm uppercase tracking-[0.11em] sm:tracking-[0.16em] lg:tracking-[0.2em] font-bold hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffe1a6] active:scale-[0.98] transition-all cursor-pointer rounded-none whitespace-nowrap max-w-full"
                >
                  <span className="whitespace-nowrap">Quero receber o catálogo</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 stroke-[2.2] shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </section>
  );
}
