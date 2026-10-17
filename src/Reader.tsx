import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import ePub from 'epubjs';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { db } from './db';

pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
type Props={bookId:string;title:string;file:Blob;format:string;onClose:()=>void};
export default function Reader({bookId,title,file,format,onClose}:Props){
 const isPdf=format.toUpperCase()==='PDF';
 const canvas=useRef<HTMLCanvasElement>(null);
 const epubHost=useRef<HTMLDivElement>(null);
 const rendition=useRef<ReturnType<ReturnType<typeof ePub>['renderTo']>|null>(null);
 const [page,setPage]=useState(1),[total,setTotal]=useState(0),[scale,setScale]=useState(1);
 const [percent,setPercent]=useState(0),[error,setError]=useState(''),[ready,setReady]=useState(false);
 const pdfDoc=useRef<pdfjs.PDFDocumentProxy|null>(null);
 const pageRef=useRef(1),scaleRef=useRef(1);
 useEffect(()=>{pageRef.current=page},[page]);
 useEffect(()=>{scaleRef.current=scale},[scale]);
 useEffect(()=>{
  let active=true;let book:ReturnType<typeof ePub>|undefined;
  async function load(){
   try{
    const saved=await db.readingProgress.get(bookId);
    if(!active)return;
    if(isPdf){
     const doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
     if(!active){await doc.destroy();return}
     pdfDoc.current=doc;setTotal(doc.numPages);setPage(Math.min(doc.numPages,Math.max(1,Number(saved?.location)||1)));setReady(true);
    }else{
     book=ePub(await file.arrayBuffer());
     await book.ready;
     if(!active||!epubHost.current)return;
     const r=book.renderTo(epubHost.current,{width:'100%',height:'100%',flow:'paginated'});
     rendition.current=r;
     r.themes.default({body:{'font-family':'Georgia, serif','line-height':'1.6'}});
     r.on('relocated',(location:{start:{cfi:string;percentage?:number}})=>{
      if(!active)return;
      const progress=Math.max(0,Math.min(100,Math.round((location.start.percentage||0)*100)));
      setPercent(progress);
      void db.readingProgress.put({id:bookId,location:location.start.cfi,percent:progress,updatedAt:Date.now()});
     });
     await r.display(saved?.location||undefined);
     if(active)setReady(true);
    }
   }catch(e){if(active)setError('Unable to open this book: '+String(e))}
  }
  void load();
  return()=>{active=false;rendition.current=null;void pdfDoc.current?.destroy();pdfDoc.current=null;void book?.destroy()};
 },[bookId,file,isPdf]);
 useEffect(()=>{
  if(!isPdf||!ready||!pdfDoc.current||!canvas.current)return;
  let cancelled=false;let task:ReturnType<pdfjs.PDFPageProxy['render']>|undefined;
  async function draw(){
   try{
    const doc=pdfDoc.current;if(!doc)return;
    const pdfPage=await doc.getPage(page);if(cancelled)return;
    const viewport=pdfPage.getViewport({scale:scale*1.25});
    const element=canvas.current;if(!element)return;
    element.width=Math.ceil(viewport.width);element.height=Math.ceil(viewport.height);
    const ctx=element.getContext('2d');if(!ctx)return;
    task=pdfPage.render({canvas:element,canvasContext:ctx,viewport});
    await task.promise;
    if(!cancelled){const progress=Math.round(page/doc.numPages*100);setPercent(progress);await db.readingProgress.put({id:bookId,location:String(page),percent:progress,updatedAt:Date.now()})}
   }catch(e){if(!cancelled&&!(e instanceof Error&&e.name==='RenderingCancelledException'))setError('Page rendering failed: '+String(e))}
  }
  void draw();
  return()=>{cancelled=true;task?.cancel()};
 },[bookId,isPdf,page,scale,ready]);
 const previous=()=>{if(isPdf)setPage(p=>Math.max(1,p-1));else void rendition.current?.prev()};
 const next=()=>{if(isPdf)setPage(p=>Math.min(total,p+1));else void rendition.current?.next()};
 return <div className="reader-screen">
  <header className="reader-header"><button onClick={onClose} aria-label="Close reader"><ArrowLeft size={20}/></button><strong title={title}>{title}</strong><span>{percent}%</span></header>
  {error&&<p role="alert" className="reader-error">{error}</p>}
  {!ready&&!error&&<p className="reader-loading">Opening book…</p>}
  <div className={'reader-content '+(isPdf?'reader-pdf':'reader-epub')} style={{visibility:ready?'visible':'hidden'}}>
   {isPdf?<canvas ref={canvas} aria-label={'Page '+page+' of '+total}/>:<div ref={epubHost} className="reader-epub-host"/>}
  </div>
  <footer className="reader-toolbar"><button onClick={previous} disabled={!ready||(isPdf&&page<=1)} aria-label="Previous page"><ChevronLeft/></button><span>{isPdf?'Page '+page+' / '+total:percent+'% complete'}</span><button onClick={next} disabled={!ready||(isPdf&&page>=total)} aria-label="Next page"><ChevronRight/></button>{isPdf&&<><button aria-label="Zoom out" onClick={()=>setScale(v=>Math.max(.5,v-.25))}><Minus size={17}/></button><button aria-label="Zoom in" onClick={()=>setScale(v=>Math.min(3,v+.25))}><Plus size={17}/></button></>}</footer>
 </div>;
}
