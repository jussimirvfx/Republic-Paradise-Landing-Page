import { createContext, useContext, type ReactNode } from 'react';
import { configureMetaPixel, MetaPixelProvider, useMetaPixel, useScrollTracking } from 'scoretrack';

export const metaPixelId = import.meta.env.VITE_META_PIXEL_ID || '29980293874892643';
export const isTrackingDryRun = () => new URLSearchParams(window.location.search).get('dry_run') === '1';

configureMetaPixel({
  PIXEL_ID:metaPixelId,
  // O pacote exige este campo. O token real pertence somente à rota de conversão.
  ACCESS_TOKEN:'server-side-only',
  VERBOSE:import.meta.env.DEV,
});

const TrackingContext = createContext<ReturnType<typeof useMetaPixel> | null>(null);
export const useLeadTracking = () => useContext(TrackingContext);

function TrackingEvents({children}:{children:ReactNode}) {
  const tracking = useMetaPixel();
  useScrollTracking();
  return <TrackingContext.Provider value={tracking}>{children}</TrackingContext.Provider>;
}

export function TrackingProvider({children}:{children:ReactNode}) {
  if (isTrackingDryRun()) return children;
  // O provider já envia PageView; MetaPixel também enviaria e duplicaria o evento.
  return <MetaPixelProvider><TrackingEvents>{children}</TrackingEvents></MetaPixelProvider>;
}

export function updateAdvancedMatching(data:{name:string; email:string; phone:string; city?:string; state?:string; zip?:string}) {
  const fbq = (window as Window & {fbq?:(...args:unknown[])=>void}).fbq;
  if (!fbq) return;
  const names = data.name.trim().split(/\s+/);
  const normalize = (value = '') => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f\s]/g,'');
  fbq('init', metaPixelId, {
    em:data.email.trim().toLowerCase(), ph:data.phone.replace(/\D/g,''),
    fn:normalize(names[0]), ln:normalize(names.length > 1 ? names.at(-1) : ''),
    ct:normalize(data.city), st:normalize(data.state), zp:data.zip?.replace(/\D/g,''), country:'br',
  });
}
