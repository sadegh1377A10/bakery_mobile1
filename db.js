/* لایه‌ی ذخیره‌سازی محلی روی خود گوشی (IndexedDB) — بدون نیاز به سرور */

const DB_NAME = 'sunlight_sweets_db';
const DB_VERSION = 1;
const STORES = ['materials', 'products', 'product_ingredients', 'customers', 'orders', 'order_items'];

let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('materials')) {
        db.createObjectStore('materials', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('product_ingredients')) {
        const s = db.createObjectStore('product_ingredients', { keyPath: 'id', autoIncrement: true });
        s.createIndex('product_id', 'product_id');
      }
      if (!db.objectStoreNames.contains('customers')) {
        db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('orders')) {
        db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('order_items')) {
        const s = db.createObjectStore('order_items', { keyPath: 'id', autoIncrement: true });
        s.createIndex('order_id', 'order_id');
      }
    };
    req.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  async getAll(storeName) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async get(storeName, id) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(Number(id));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async add(storeName, obj) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async put(storeName, obj) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, id) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(Number(id));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async getByIndex(storeName, indexName, value) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.index(indexName).getAll(Number(value));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async exportAll() {
    const data = {};
    for (const s of STORES) {
      data[s] = await DB.getAll(s);
    }
    data._exported_at = new Date().toISOString();
    data._version = DB_VERSION;
    return data;
  },

  async importAll(data) {
    for (const s of STORES) {
      await DB.clear(s);
      if (Array.isArray(data[s])) {
        const store = await tx(s, 'readwrite');
        for (const item of data[s]) {
          await new Promise((resolve, reject) => {
            const req = store.put(item);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        }
      }
    }
  },
};
