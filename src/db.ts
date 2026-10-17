import Dexie, { type EntityTable } from 'dexie';
export interface Book { id: string; title: string; author: string; description?: string; format: string; source: string; fileName?: string; cover?: Blob; rating?: number; status: 'unread'|'reading'|'completed'; createdAt: number }
export const db = new Dexie('mylibrary') as Dexie & { books: EntityTable<Book,'id'> };
db.version(1).stores({books:'id,title,author,format,source,status,createdAt'});
