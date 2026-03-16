const DB_NAME = "spotify-library";
const STORE = "data";
const KEY = "export";
const YT_STORE = "yt-search";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(YT_STORE)) db.createObjectStore(YT_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheData(libData, playlistFiles, wrappedFiles = []) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ libData, playlistFiles, wrappedFiles }, KEY);
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
    db.close();
  } catch {
    // caching is best-effort
  }
}

export async function getCachedData() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    const result = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = rej;
    });
    db.close();
    return result || null;
  } catch {
    return null;
  }
}

export async function clearCachedData() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(KEY);
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
    db.close();
  } catch {
    // best-effort
  }
}

export async function getCachedYTSearch(key) {
  try {
    const db = await openDB();
    const tx = db.transaction(YT_STORE, "readonly");
    const req = tx.objectStore(YT_STORE).get(key);
    const result = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = rej;
    });
    db.close();
    return result || null;
  } catch {
    return null;
  }
}

export async function cacheYTSearch(key, results) {
  try {
    const db = await openDB();
    const tx = db.transaction(YT_STORE, "readwrite");
    tx.objectStore(YT_STORE).put(results, key);
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = rej;
    });
    db.close();
  } catch {
    // best-effort
  }
}
