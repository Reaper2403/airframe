import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createReportHandler,ReportError} from './incident-report.mjs';
const root=resolve('dist');
const report=createReportHandler(resolve('.'));
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
http.createServer(async(req,res)=>{
  try {
    const allowedHosts=[`127.0.0.1:${port}`,`localhost:${port}`];
    if(!allowedHosts.includes(req.headers.host)){res.writeHead(403);return res.end('Forbidden host');}
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path.startsWith('/api/')){
      if(req.headers.origin&&!allowedHosts.some(host=>req.headers.origin===`http://${host}`))return json(res,403,{error:{code:'origin_denied',message:'Reports must be requested from the local Airframe app.'}});
      if(path==='/api/incident-report'&&req.method==='POST'){
        if(!req.headers['content-type']?.startsWith('application/json'))throw new ReportError('invalid_request','Expected a JSON report request.',415);
        let size=0;const chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>4_000_000)throw new ReportError('request_too_large','The report request is too large.',413);chunks.push(chunk);}
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ReportError('invalid_request','The report request is not valid JSON.');}
        return json(res,200,await report(body));
      }
      const match=path.match(/^\/api\/reports\/([a-f0-9-]{36})\.(pdf|json)$/);
      if(match&&req.method==='GET'){
        const file=resolve('output/pdf',`${match[1]}.${match[2]}`),data=await readFile(file);
        res.writeHead(200,{'Content-Type':match[2]==='pdf'?'application/pdf':'application/json','Content-Disposition':`attachment; filename="Airframe-incident-${match[1].slice(0,8)}.${match[2]}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(data);
      }
      return json(res,404,{error:{code:'not_found',message:'Report route not found.'}});
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end('Method not allowed');}
    const file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(root+sep)){res.writeHead(403);return res.end('Forbidden');}
    const info=await stat(file);if(!info.isFile())throw new Error('Not found');
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(await readFile(file));
  }catch(error){
    if(error instanceof ReportError&&error.diagnostics)console.error('AIRFRAME report connection failure:',JSON.stringify(error.diagnostics));
    if(req.url?.startsWith('/api/'))return json(res,error instanceof ReportError?error.status:500,{error:{code:error instanceof ReportError?error.code:'report_failed',message:error instanceof ReportError?error.message:'The report could not be completed. Refresh the evidence and try again.'}});res.writeHead(404);res.end('Not found');
  }
}).listen(port,'127.0.0.1',()=>console.log(`AIRFRAME preview: http://127.0.0.1:${port}`));
