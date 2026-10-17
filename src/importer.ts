import JSZip from 'jszip';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export interface Candidate { fileName:string; title:string; author:string; format:string; cover?:Blob; warning?:string }
export async function inspect(file:File):Promise<Candidate>{
 const fallback=file.name.replace(/\.(pdf|epub)$/i,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
 const candidate:Candidate={fileName:file.name,title:fallback,author:'Unknown author',format:file.name.split('.').pop()?.toUpperCase()||'FILE'};
 if(/\.epub$/i.test(file.name))return inspectEpub(file,candidate);
 if(!/\.pdf$/i.test(file.name))return candidate;
 let doc:pdfjs.PDFDocumentProxy|undefined;
 try{
  const data=new Uint8Array(await file.arrayBuffer());
  doc=await pdfjs.getDocument({data}).promise;
  const meta=await doc.getMetadata();
  const info=meta.info as {Title?:string;Author?:string};
  if(info.Title?.trim()&&!/^(untitled|microsoft word)$/i.test(info.Title.trim()))candidate.title=info.Title.trim();
  if(info.Author?.trim())candidate.author=info.Author.trim();
  const page=await doc.getPage(1);
  const viewport=page.getViewport({scale:1});
  const scale=Math.min(1.5,360/viewport.width);
  const canvas=document.createElement('canvas');
  const view=page.getViewport({scale});
  canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
  const ctx=canvas.getContext('2d');
  if(ctx){await page.render({canvasContext:ctx,viewport:view}).promise;candidate.cover=await new Promise<Blob|undefined>(resolve=>canvas.toBlob(b=>resolve(b||undefined),'image/jpeg',0.8))}
  if(candidate.title===fallback){const content=await page.getTextContent();const lines=content.items.filter((x):x is typeof x & {str:string}=>'str' in x).map(x=>x.str.trim()).filter(Boolean);const possible=lines.find(x=>x.length>8&&x.length<110&&!/^https?:|copyright|all rights reserved/i.test(x));if(possible)candidate.warning='Title suggested from filename; review document first page before saving.'}
 }catch(e){candidate.warning='PDF analysis failed; filename used. '+(e instanceof Error?e.message:'')}
 finally{await doc?.destroy()}
 return candidate;
}

async function inspectEpub(file:File,candidate:Candidate):Promise<Candidate>{
 try{
  const zip=await JSZip.loadAsync(file);
  const containerFile=zip.file('META-INF/container.xml');
  if(!containerFile)throw new Error('EPUB container.xml is missing');
  const parser=new DOMParser();
  const container=parser.parseFromString(await containerFile.async('text'),'application/xml');
  const root=container.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
  if(!root)throw new Error('EPUB package path not found');
  const packageFile=zip.file(root);
  if(!packageFile)throw new Error('EPUB package is missing');
  const opf=parser.parseFromString(await packageFile.async('text'),'application/xml');
  const elements=(name:string)=>Array.from(opf.getElementsByTagName('*')).filter(x=>x.localName===name);
  const first=(name:string)=>elements(name)[0]?.textContent?.trim()||'';
  candidate.title=first('title')||candidate.title;
  candidate.author=first('creator')||candidate.author;
  const metadata=elements('metadata')[0];
  const coverMeta=metadata?Array.from(metadata.getElementsByTagName('*')).find(x=>x.localName==='meta'&&x.getAttribute('name')==='cover'):undefined;
  const coverId=coverMeta?.getAttribute('content');
  const items=elements('item');
  const image=items.find(x=>x.getAttribute('id')===coverId)
    ||items.find(x=>x.getAttribute('properties')?.split(/\s+/).includes('cover-image'))
    ||items.find(x=>/cover/i.test(x.getAttribute('href')||'')&&/^image\//.test(x.getAttribute('media-type')||''));
  if(image){
   const href=image.getAttribute('href');
   const media=image.getAttribute('media-type')||'image/jpeg';
   if(href&&/^image\/(jpeg|png|webp|gif)$/.test(media)){
    const base=root.includes('/')?root.slice(0,root.lastIndexOf('/')+1):'';
    const parts=(base+decodeURIComponent(href.split('#')[0])).split('/');
    const normalized:string[]=[];
    for(const part of parts){if(part==='..')normalized.pop();else if(part&&part!=='.')normalized.push(part)}
    const entry=zip.file(normalized.join('/'));
    if(entry){const bytes=await entry.async('uint8array');const buffer=new ArrayBuffer(bytes.byteLength);new Uint8Array(buffer).set(bytes);candidate.cover=new Blob([buffer],{type:media});}
   }
  }
  if(!candidate.cover)candidate.warning='No embedded EPUB cover found. You can add a custom cover later.';
 }catch(e){candidate.warning='EPUB analysis failed; filename used. '+(e instanceof Error?e.message:'')}
 return candidate;
}
