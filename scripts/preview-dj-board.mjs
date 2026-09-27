import http from 'node:http';
import fs from 'node:fs';
import {resolveItem} from './item-catalog.mjs';
http.createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname;const item=resolveItem(path);if(!item){res.writeHead(404);res.end('Item not found');return}if(/^\/items\/[1-5]$/.test(path)){res.writeHead(308,{Location:path+'/'});res.end();return}res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(`static/items/${item.id}/index.html`));}).listen(3000,'127.0.0.1',()=>console.log('CryptoDoodz items: http://127.0.0.1:3000/items/3/'));
