import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'./tests/form', workers:1, reporter:'list',
  use:{baseURL:'http://127.0.0.1:43173', viewport:{width:1280,height:900},serviceWorkers:'block',permissions:['clipboard-read','clipboard-write']},
  projects:[{name:'desktop',use:{viewport:{width:1280,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
  webServer:{command:'npx vite --host 127.0.0.1 --port 43173 --strictPort',url:'http://127.0.0.1:43173',reuseExistingServer:false,env:{LP_DRY_RUN_ENABLED:'1'}},
});
