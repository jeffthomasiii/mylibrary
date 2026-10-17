import { useEffect, useRef, useState } from 'react';

type DriveItem={id:string;name:string;mimeType:string;size?:string};
type TokenResponse={access_token?:string;error?:string;error_description?:string};
type TokenClient={requestAccessToken:(options?:{prompt?:string})=>void};
type GoogleWindow=Window & {google?:{accounts:{oauth2:{initTokenClient:(options:{client_id:string;scope:string;callback:(response:TokenResponse)=>void})=>TokenClient;revoke:(token:string,callback:()=>void)=>void}}}};
const scope='https://www.googleapis.com/auth/drive.readonly';
const supported=(name:string)=>/\.(pdf|epub)$/i.test(name);
const configuredId=import.meta.env.VITE_GOOGLE_CLIENT_ID as string|undefined;
export default function GoogleDriveImport({onFile}:{onFile:(file:File)=>Promise<void>}){
 const [clientId,setClientId]=useState(()=>configuredId||localStorage.getItem('mylibrary-google-client-id')||'');
 const [token,setToken]=useState('');
 const [items,setItems]=useState<DriveItem[]>([]);
 const [pageToken,setPageToken]=useState('');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const client=useRef<TokenClient|null>(null);
 const tokenRef=useRef('');
 useEffect(()=>{tokenRef.current=token},[token]);
 useEffect(()=>{if(document.querySelector('script[data-google-identity]'))return;const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.dataset.googleIdentity='true';document.head.appendChild(script)},[]);
 async function listFiles(accessToken:string,next=''){
  setLoading(true);setError('');
  try{
   const query=new URLSearchParams({q:"trashed = false and (name contains '.pdf' or name contains '.epub' or name contains '.PDF' or name contains '.EPUB')",fields:'nextPageToken,files(id,name,mimeType,size)',pageSize:'100'});
   if(next)query.set('pageToken',next);
   const response=await fetch('https://www.googleapis.com/drive/v3/files?'+query,{headers:{Authorization:'Bearer '+accessToken}});
   if(!response.ok)throw new Error('Google Drive returned '+response.status+'. Sign in again if your session expired.');
   const result=await response.json() as {files?:DriveItem[];nextPageToken?:string};
   setItems(old=>next?[...old,...(result.files||[]).filter(f=>supported(f.name))]:(result.files||[]).filter(f=>supported(f.name)));
   setPageToken(result.nextPageToken||'');
  }catch(e){setError(String(e))}finally{setLoading(false)}
 }
 function connect(){
  setError('');setMessage('');
  if(!clientId.trim()){setError('Enter a Google OAuth web client ID first.');return}
  const google=(window as GoogleWindow).google;
  if(!google){setError('Google sign-in has not loaded. Check your connection and try again.');return}
  localStorage.setItem('mylibrary-google-client-id',clientId.trim());
  client.current=google.accounts.oauth2.initTokenClient({client_id:clientId.trim(),scope,callback:response=>{
   if(!response.access_token){setError(response.error_description||response.error||'Google authorization was cancelled.');return}
   setToken(response.access_token);void listFiles(response.access_token);
  }});
  client.current.requestAccessToken({prompt:'consent'});
 }
 async function importItem(item:DriveItem){
  if(!token)return;
  setLoading(true);setError('');setMessage('');
  try{
   const response=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(item.id)+'?alt=media',{headers:{Authorization:'Bearer '+token}});
   if(!response.ok)throw new Error('Download failed: '+response.status);
   const blob=await response.blob();
   const file=new File([blob],item.name,{type:item.name.toLowerCase().endsWith('.pdf')?'application/pdf':'application/epub+zip'});
   await onFile(file);
   setMessage('Selected '+item.name+'. Review the book details and save it to your library.');
  }catch(e){setError(String(e))}finally{setLoading(false)}
 }
 function disconnect(){
  if(token)(window as GoogleWindow).google?.accounts.oauth2.revoke(token,()=>{});
  setToken('');setItems([]);setPageToken('');setMessage('Disconnected from Google Drive.');
 }
 return <section className="info-panel" aria-label="Google Drive import">
  <h2>Google Drive (beta)</h2>
  <p>Browse and import PDF/EPUB books directly from your Google Drive. Files are copied to this device when offline storage is enabled. No automatic synchronization.</p>
  {!configuredId&&<label className="drive-client-id">Google OAuth web client ID<input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="Your Google OAuth client ID" autoComplete="off"/><small>Set up a Google Cloud OAuth web client and authorize this app's origin. The client ID is public; never enter a client secret here.</small></label>}
  {!token?<button className="primary" disabled={loading} onClick={connect}>Connect Google Drive</button>:<><div className="drive-actions"><button onClick={()=>void listFiles(token)} disabled={loading}>Refresh books</button><button onClick={disconnect}>Disconnect</button></div><div className="drive-files">{items.map(item=><div className="drive-file" key={item.id}><span>{item.name}</span><button disabled={loading} onClick={()=>void importItem(item)}>Import</button></div>)}</div>{!loading&&!items.length&&<p className="muted">No matching EPUB or PDF files found in the available results.</p>}{pageToken&&<button disabled={loading} onClick={()=>void listFiles(token,pageToken)}>Load more</button>}</>}
  {loading&&<p role="status">Working with Google Drive…</p>}{error&&<p className="warning" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  <small>Google authorization is handled by Google. Access tokens are held in memory and are not stored in your library. Google Drive read-only permission may require verification before public release.</small>
 </section>;
}
