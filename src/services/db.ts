import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface POSDB extends DBSchema {
  products: {
    key: string;
    value: any;
    indexes: { 'by-barcode': string };
  };
  inventory: {
    key: string;
    value: any;
  };
  settings: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<POSDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<POSDB>('pos-system-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' });
          productStore.createIndex('by-barcode', 'barcode', { unique: false });
        }
        if (!db.objectStoreNames.contains('inventory')) {
          db.createObjectStore('inventory', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export const cacheProducts = async (products: any[]) => {
  const db = await initDB();
  const tx = db.transaction('products', 'readwrite');
  await tx.objectStore('products').clear();
  for (const product of products) {
    await tx.objectStore('products').put(product);
  }
  await tx.done;
};

export const getCachedProducts = async () => {
  const db = await initDB();
  return db.getAll('products');
};

export const getCachedProductByBarcode = async (barcode: string) => {
  const db = await initDB();
  return db.getFromIndex('products', 'by-barcode', barcode);
};

export const cacheInventory = async (inventory: any[]) => {
  const db = await initDB();
  const tx = db.transaction('inventory', 'readwrite');
  await tx.objectStore('inventory').clear();
  for (const item of inventory) {
    await tx.objectStore('inventory').put(item);
  }
  await tx.done;
};

export const getCachedInventory = async () => {
  const db = await initDB();
  return db.getAll('inventory');
};
