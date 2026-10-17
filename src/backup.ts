import { db, type Book, type Wish } from './db';
const blobToDataUrl=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
const dataUrlToBlob=async(data:string)=>{const response=await fetch(data);return response.blob()};
export async function exportLibrary(){
 const books=await db.books.toArray();
 const records=await Promise.all(books.map(async(book)=>({...book,cover:book.cover?await blobToDataUrl(book.cover):null})));
 const wishes=await db.wishes.toArray();
 const payload={app:'MyLibrary',version:2,exportedAt:new Date().toISOString(),books:records,wishes};
 const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mylibrary-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 return books.length;
}
export async function importLibrary(file:File){
 if(file.size>100*1024*1024)throw new Error('Backup exceeds 100 MB.');
 const parsed:unknown=JSON.parse(await file.text());
 if(!parsed||typeof parsed!=='object'||!('app' in parsed)||parsed.app!=='MyLibrary'||!('version' in parsed)||(parsed.version!==1&&parsed.version!==2)||!('books' in parsed)||!Array.isArray(parsed.books))throw new Error('Not a supported MyLibrary backup.');
 const records:unknown[]=parsed.books;
 const wishRecords:unknown[]='wishes' in parsed&&Array.isArray(parsed.wishes)?parsed.wishes:[];
 let added=0,skipped=0;
 await db.transaction('rw',db.books,db.wishes,async()=>{
  for(const item of records){
   if(!item||typeof item!=='object'){skipped++;continue}
   const raw=item as Record<string,unknown>;
   if(!raw||typeof raw.id!=='string'||typeof raw.title!=='string'||typeof raw.author!=='string'||typeof raw.format!=='string'||typeof raw.createdAt!=='number'){skipped++;continue}
   if(await db.books.get(raw.id)){skipped++;continue}
   const status:Book['status']=raw.status==='reading'||raw.status==='completed'?raw.status:'unread';
   const coverData=typeof raw.cover==='string'&&raw.cover.startsWith('data:image/')?raw.cover:undefined;
   const book:Book={id:raw.id,title:raw.title,author:raw.author,format:raw.format,source:typeof raw.source==='string'?raw.source:'Restored backup',fileName:typeof raw.fileName==='string'?raw.fileName:undefined,status,createdAt:raw.createdAt,cover:coverData?await dataUrlToBlob(coverData):undefined};
   await db.books.add(book);added++;
  }
  for(const item of wishRecords){
   if(!item||typeof item!=='object'){skipped++;continue}
   const raw=item as Record<string,unknown>;
   if(typeof raw.id!=='string'||typeof raw.title!=='string'||typeof raw.author!=='string'||typeof raw.createdAt!=='number'){skipped++;continue}
   if(await db.wishes.get(raw.id)){skipped++;continue}
   const wish:Wish={id:raw.id,title:raw.title,author:raw.author,notes:typeof raw.notes==='string'?raw.notes:undefined,createdAt:raw.createdAt};
   await db.wishes.add(wish);added++;
  }
 });
 return {added,skipped};
}
