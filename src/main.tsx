import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import Hero from './Hero.tsx';
import { TrackingProvider } from './metaTracking.tsx';
import './index.css';

const heroRoot = document.getElementById('hero-root')!;
if (heroRoot.firstElementChild) {
  // The production hero is static HTML; attach its only interaction directly.
  document.getElementById('hero-cta')!.addEventListener('click', () => {
    document.getElementById('cta-form')?.scrollIntoView({behavior:'smooth'});
  });
} else createRoot(heroRoot).render(<StrictMode><Hero /></StrictMode>);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TrackingProvider><App /></TrackingProvider>
  </StrictMode>,
);
