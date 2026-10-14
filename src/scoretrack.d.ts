declare module 'scoretrack' {
  import type { ReactNode } from 'react';
  export type LeadData = {
    name:string; email:string; phone:string; city?:string; state?:string; zip?:string; country?:string;
    value:number; currency:string; content_name:string; content_category:string; lead_score:number;
  };
  export function configureMetaPixel(config:{PIXEL_ID:string; ACCESS_TOKEN:string; TEST_EVENT_CODE?:string; VERBOSE?:boolean}):void;
  export function MetaPixelProvider(props:{children:ReactNode}):ReactNode;
  export function useScrollTracking():void;
  export function useMetaPixel():{
    trackLead:(data:LeadData)=>Promise<void>;
    trackLeadQualificado:(data:LeadData)=>Promise<void>;
  };
}
