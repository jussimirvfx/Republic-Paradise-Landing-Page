import { dryRunEnabled } from '../lib/dry-run.js';
export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') {res.setHeader('Allow','GET');return res.status(405).json({ok:false});}
  return res.status(200).json({ok:true,enabled:dryRunEnabled(process.env),version:1,
    blocked:['webhook','lookup','persistence','meta_server'],browser_pixel:'normal'});
}
