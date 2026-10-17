import { db, type Book } from './db';
const blobToDataUrl=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
const dataUrlToBlob=async(data:string)=>{const response=await fetch(data);return response.blob()};
export async function exportLibrary(){
 const books=await db.books.toArray();
 const records=await Promise.all(books.map(async(book)=>({...book,cover:book.cover?await blobToDataUrl(book.cover):null})));
 const payload={app:'MyLibrary',version:1,exportedAt:new Date().toISOString(),books:records};
 const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mylibrary-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 return books.length;
}
export async function importLibrary(file:File){
 if(file.size>100*1024*1024)throw new Error('Backup exceeds 100 MB.');
 const parsed:unknown=JSON.parse(await file.text());
 if(!parsed||typeof parsed!=='object'||!('app' in parsed)||parsed.app!=='MyLibrary'||!('version' in parsed)||parsed.version!==1||!('books' in parsed)||!Array.isArray(parsed.books))throw new Error('Not a supported MyLibrary backup.');
 const records:unknown[]=parsed.books;
 let added=0,skipped=0;
 await db.transaction('rw',db.books,async()=>{
  for(const item of records){
   if(!item||typeof item!=='object'){skipped++;continue}
   const raw=item as Record<string,unknown>;
   if(!raw||typeof raw.id!=='string'||typeof raw.title!=='string'||typeof raw.author!=='string'||typeof raw.format!=='string'||typeof raw.createdAt!=='number'){skipped++;continue}
   if(await db.books.get(raw.id)){skipped++;continue}
   const book:Book={id:raw.id,title:raw.title,author:raw.author,format:raw.format,source:typeof raw.source==='string'?raw.source:'Restored backup',fileName:typeof raw.fileName==='string'?raw.fileName:undefined,status:['unread','reading','completed'].includes(raw.status)?raw.status:'unread',createdAt:raw.createdAt,cover:typeof raw.cover==='string'&&raw.cover.startsWith('data:image/')?await dataUrlToBlob(raw.cover):undefined};
   await db.books.add(book);added++;
  }
 });
 return {added,skipped};
}
