import { db, type Book, type Wish, type Collection } from './db';
const blobToDataUrl=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
const dataUrlToBlob=(data:string)=>{const parts=data.split(',');if(parts.length!==2)throw new Error('Invalid cover image data');const mime=parts[0].match(/^data:(image\/(?:jpeg|png|webp|gif));base64$/i)?.[1];if(!mime)throw new Error('Unsupported cover image');const bytes=atob(parts[1]);const array=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)array[i]=bytes.charCodeAt(i);return new Blob([array],{type:mime})};
export async function exportLibrary(){
 const books=await db.books.toArray();
 const records=await Promise.all(books.map(async(book)=>({...book,cover:book.cover?await blobToDataUrl(book.cover):null})));
 const wishes=await Promise.all((await db.wishes.toArray()).map(async wish=>({...wish,cover:wish.cover?await blobToDataUrl(wish.cover):null})));
 const collections=await db.collections.toArray();
 const payload={app:'MyLibrary',version:3,exportedAt:new Date().toISOString(),books:records,wishes,collections};
 const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mylibrary-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 return books.length;
}
export async function importLibrary(file:File){
 if(file.size>100*1024*1024)throw new Error('Backup exceeds 100 MB.');
 const parsed:unknown=JSON.parse(await file.text());
 if(!parsed||typeof parsed!=='object'||!('app' in parsed)||parsed.app!=='MyLibrary'||!('version' in parsed)||(parsed.version!==1&&parsed.version!==2&&parsed.version!==3)||!('books' in parsed)||!Array.isArray(parsed.books))throw new Error('Not a supported MyLibrary backup.');
 const records:unknown[]=parsed.books;
 const collectionRecords:unknown[]='collections' in parsed&&Array.isArray(parsed.collections)?parsed.collections:[];
 const wishRecords:unknown[]='wishes' in parsed&&Array.isArray(parsed.wishes)?parsed.wishes:[];
 let added=0,skipped=0;
 await db.transaction('rw',db.books,db.wishes,db.collections,async()=>{
  for(const item of records){
   if(!item||typeof item!=='object'){skipped++;continue}
   const raw=item as Record<string,unknown>;
   if(!raw||typeof raw.id!=='string'||typeof raw.title!=='string'||typeof raw.author!=='string'||typeof raw.format!=='string'||typeof raw.createdAt!=='number'){skipped++;continue}
   if(await db.books.get(raw.id)){skipped++;continue}
   const status:Book['status']=raw.status==='reading'||raw.status==='completed'?raw.status:'unread';
   const coverData=typeof raw.cover==='string'&&raw.cover.startsWith('data:image/')?raw.cover:undefined;
   const book:Book={id:raw.id,title:raw.title,author:raw.author,format:raw.format,source:typeof raw.source==='string'?raw.source:'Restored backup',fileName:typeof raw.fileName==='string'?raw.fileName:undefined,isbn:typeof raw.isbn==='string'?raw.isbn:undefined,status,createdAt:raw.createdAt,description:typeof raw.description==='string'?raw.description:undefined,notes:typeof raw.notes==='string'?raw.notes:undefined,collectionIds:Array.isArray(raw.collectionIds)?raw.collectionIds.filter((id):id is string=>typeof id==='string'):[],rating:typeof raw.rating==='number'&&Number.isInteger(raw.rating)&&raw.rating>=1&&raw.rating<=5?raw.rating:undefined,cover:coverData?dataUrlToBlob(coverData):undefined};
   await db.books.add(book);added++;
  }
  for(const item of collectionRecords){
   if(!item||typeof item!=='object'){skipped++;continue}
   const raw=item as Record<string,unknown>;
   if(typeof raw.id!=='string'||typeof raw.name!=='string'||typeof raw.createdAt!=='number'){skipped++;continue}
   if(await db.collections.get(raw.id)){skipped++;continue}
   const collection:Collection={id:raw.id,name:raw.name,createdAt:raw.createdAt};
   await db.collections.add(collection);added++;
  }
  for(const item of wishRecords){
   if(!item||typeof item!=='object'){skipped++;continue}
   const raw=item as Record<string,unknown>;
   if(typeof raw.id!=='string'||typeof raw.title!=='string'||typeof raw.author!=='string'||typeof raw.createdAt!=='number'){skipped++;continue}
   if(await db.wishes.get(raw.id)){skipped++;continue}
   const wish:Wish={id:raw.id,title:raw.title,author:raw.author,notes:typeof raw.notes==='string'?raw.notes:undefined,isbn:typeof raw.isbn==='string'?raw.isbn:undefined,cover:typeof raw.cover==='string'&&raw.cover.startsWith('data:image/')?dataUrlToBlob(raw.cover):undefined,createdAt:raw.createdAt};
   await db.wishes.add(wish);added++;
  }
 });
 return {added,skipped};
}
