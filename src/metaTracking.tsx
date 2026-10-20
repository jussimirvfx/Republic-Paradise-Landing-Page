import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { createMetaTracking } from '../lib/meta-client.js';

export const metaPixelId = import.meta.env.VITE_META_PIXEL_ID || '29980293874892643';
export const isTrackingDryRun = () => new URLSearchParams(window.location.search).has('dry_run');
let client:ReturnType<typeof createMetaTracking> | undefined;
const getClient = () => client ||= createMetaTracking({window,pixelId:metaPixelId});
const TrackingContext = createContext<ReturnType<typeof createMetaTracking> | null>(null);
export const useLeadTracking = () => useContext(TrackingContext);

export function TrackingProvider({children}:{children:ReactNode}) {
  const tracking = getClient();
  useEffect(()=>{
    let cancelled=false;
    const paint=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!cancelled)tracking.start();}));
    const hero=document.getElementById('hero-image') as HTMLImageElement | null;
    if(hero?.complete) void hero.decode().catch(()=>{}).then(paint);
    else if(hero) {hero.addEventListener('load',paint,{once:true});hero.addEventListener('error',paint,{once:true});}
    else paint();
    return ()=>{cancelled=true;hero?.removeEventListener('load',paint);hero?.removeEventListener('error',paint);};
  },[tracking]);
  return <TrackingContext.Provider value={tracking}>{children}</TrackingContext.Provider>;
}
