import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export interface Candidate { fileName:string; title:string; author:string; format:string; cover?:Blob; warning?:string }
export async function inspect(file:File):Promise<Candidate>{
 const fallback=file.name.replace(/\.(pdf|epub)$/i,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
 const candidate:Candidate={fileName:file.name,title:fallback,author:'Unknown author',format:file.name.split('.').pop()?.toUpperCase()||'FILE'};
 if(!/\.pdf$/i.test(file.name)){candidate.warning='EPUB content analysis is not yet available; filename used.';return candidate}
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
  if(ctx){await page.render({canvas,canvasContext:ctx,viewport:view}).promise;candidate.cover=await new Promise<Blob|undefined>(resolve=>canvas.toBlob(b=>resolve(b||undefined),'image/jpeg',0.8))}
  if(candidate.title===fallback){const content=await page.getTextContent();const lines=content.items.filter((x):x is typeof x & {str:string}=>'str' in x).map(x=>x.str.trim()).filter(Boolean);const possible=lines.find(x=>x.length>8&&x.length<110&&!/^https?:|copyright|all rights reserved/i.test(x));if(possible)candidate.warning='Title suggested from filename; review document first page before saving.'}
 }catch(e){candidate.warning='PDF analysis failed; filename used. '+(e instanceof Error?e.message:'')}
 finally{await doc?.destroy()}
 return candidate;
}
