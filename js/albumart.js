// ── Album Art (Spotify oEmbed + caching) ──

const DB_NAME = "spotify-albumart";
const STORE = "art";

const memCache = new Map(); // albumKey -> url
const pending = new Map();  // albumKey -> Promise<url|null>
let dbReady = null;

function openDB() {
  if (dbReady) return dbReady;
  dbReady = new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbReady;
}

function albumKey(track) {
  return (track.album + "|||" + track.artist).toLowerCase();
}

async function dbGet(key) {
  try {
    const db = await openDB();
    if (!db) return null;
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    return await new Promise((res) => {
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  } catch { return null; }
}

async function dbPut(key, url) {
  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(url, key);
  } catch { /* best-effort */ }
}

async function fetchFromOembed(track) {
  if (!track.uri || track.local) return null;
  const trackId = track.uri.split(":").pop();
  try {
    const res = await fetch(
      "https://open.spotify.com/oembed?url=https://open.spotify.com/track/" + trackId
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.thumbnail_url || null;
  } catch { return null; }
}

// Returns cached URL synchronously, or null.
// If not cached, kicks off async fetch and calls onLoad(url) when done.
export function getAlbumArt(track, onLoad) {
  const key = albumKey(track);

  // Memory cache hit
  if (memCache.has(key)) return memCache.get(key);

  // Already fetching
  if (pending.has(key)) {
    if (onLoad) pending.get(key).then((url) => { if (url) onLoad(url); });
    return null;
  }

  // Start async pipeline: check IndexedDB, then oEmbed
  const promise = (async () => {
    let url = await dbGet(key);
    if (url) {
      memCache.set(key, url);
      if (onLoad) onLoad(url);
      return url;
    }
    url = await fetchFromOembed(track);
    if (url) {
      memCache.set(key, url);
      dbPut(key, url);
      if (onLoad) onLoad(url);
    }
    return url;
  })();

  pending.set(key, promise);
  return null;
}
