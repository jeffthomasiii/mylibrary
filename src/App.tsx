import { useEffect, useState } from 'react';
import { BookOpen, Search, Plus, Library, Heart, FolderOpen } from 'lucide-react';
import { db, type Book } from './db';
const makeId = () => crypto.randomUUID();
export default function App(){
 const [books,setBooks]=useState<Book[]>([]); const [query,setQuery]=useState(''); const [tab,setTab]=useState<'library'|'wishlist'>('library');
 const refresh=async()=>setBooks(await db.books.orderBy('createdAt').reverse().toArray());
 useEffect(()=>{void refresh()},[]);
 async function addFiles(files:FileList|null){if(!files)return;for(const file of Array.from(files)){
  if(!/\.(pdf|epub)$/i.test(file.name))continue;
  const title=file.name.replace(/\.(pdf|epub)$/i,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
  await db.books.add({id:makeId(),title,author:'Unknown author',format:file.name.split('.').pop()?.toUpperCase()||'FILE',source:'Local import',fileName:file.name,status:'unread',createdAt:Date.now()});
 }await refresh()}
 const visible=books.filter(b=>b.title.toLowerCase().includes(query.toLowerCase())&&tab==='library');
 return <div className="shell"><aside><h1><BookOpen/> MyLibrary</h1><p>Your books. One place.</p><nav><button className={tab==='library'?'active':''} onClick={()=>setTab('library')}><Library/> Library</button><button className={tab==='wishlist'?'active':''} onClick={()=>setTab('wishlist')}><Heart/> Wishlist</button></nav><small>Local-first • Foundation build</small></aside><main><header><div><h2>{tab==='library'?'My Library':'Wishlist'}</h2><p>{tab==='library'?books.length+' documents in your collection':'Wishlist support is planned for the next milestone'}</p></div><label className="add"><Plus size={18}/> Import PDF / EPUB<input type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" multiple onChange={e=>{void addFiles(e.target.files);e.target.value=''}}/></label></header><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your library..." aria-label="Search your library"/></div>{visible.length?<section className="grid">{visible.map(b=><article key={b.id}><div className="cover"><BookOpen size={48}/><span>{b.format}</span></div><h3>{b.title}</h3><p>{b.author}</p><div className="meta">{b.source} · {b.status}</div></article>)}</section>:<div className="empty"><FolderOpen size={48}/><h3>{tab==='wishlist'?'Your wishlist is coming soon':'Start building your library'}</h3><p>{tab==='library'?'Import PDFs or EPUBs to create local catalog entries. Metadata extraction and automatic covers are next.':'This screen is reserved for books you want to acquire.'}</p></div>}</main></div>
}
