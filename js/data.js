import { state, $ } from "./app.js";
import { renderSidebar } from "./render.js";

// ── Data Loading ──
export async function tryLocalData() {
  try {
    const res = await fetch("data/YourLibrary.json");
    if (!res.ok) throw new Error("not found");
    const libData = await res.json();

    const playlistFiles = [];
    for (let i = 1; i <= 20; i++) {
      try {
        const pr = await fetch("data/Playlist" + i + ".json");
        if (!pr.ok) break;
        playlistFiles.push(await pr.json());
      } catch {
        break;
      }
    }

    processData(libData, playlistFiles);
  } catch {
    $.loading.classList.add("hidden");
    $.uploadScreen.style.display = "flex";
  }
}

function processData(libData, playlistFiles) {
  state.library = libData;

  const allPlaylists = [];
  for (const pf of playlistFiles) {
    if (pf.playlists) allPlaylists.push(...pf.playlists);
  }

  allPlaylists.sort((a, b) =>
    b.lastModifiedDate.localeCompare(a.lastModifiedDate),
  );

  state.playlists = allPlaylists.map((p, i) => ({
    id: "pl_" + i,
    name: p.name,
    date: p.lastModifiedDate,
    trackCount: p.items.length,
    tracks: normalizePlaylistTracks(p.items),
  }));

  // Build artist index
  const artistMap = new Map();
  for (const t of state.library.tracks) {
    const key = t.artist.toLowerCase();
    if (!artistMap.has(key))
      artistMap.set(key, { name: t.artist, count: 0 });
    artistMap.get(key).count++;
  }
  for (const pl of state.playlists) {
    for (const t of pl.tracks) {
      const key = t.artist.toLowerCase();
      if (!artistMap.has(key))
        artistMap.set(key, { name: t.artist, count: 0 });
      artistMap.get(key).count++;
    }
  }
  state.artistIndex = Array.from(artistMap.values()).sort(
    (a, b) => b.count - a.count,
  );

  // Build album index
  const albumMap = new Map();
  for (const t of state.library.tracks) {
    const key = (t.album + "|||" + t.artist).toLowerCase();
    if (!albumMap.has(key))
      albumMap.set(key, { name: t.album, artist: t.artist, count: 0 });
    albumMap.get(key).count++;
  }
  for (const pl of state.playlists) {
    for (const t of pl.tracks) {
      const key = (t.album + "|||" + t.artist).toLowerCase();
      if (!albumMap.has(key))
        albumMap.set(key, {
          name: t.album,
          artist: t.artist,
          count: 0,
        });
      albumMap.get(key).count++;
    }
  }
  state.albumIndex = Array.from(albumMap.values()).sort(
    (a, b) => b.count - a.count,
  );

  const totalTracks =
    state.library.tracks.length +
    state.playlists.reduce((s, p) => s + p.trackCount, 0);
  const $statsText = $.statsBar.querySelector(".stats-text");
  if ($statsText)
    $statsText.textContent = `${state.library.tracks.length} liked songs \u00b7 ${state.playlists.length} playlists \u00b7 ${totalTracks.toLocaleString()} total tracks`;

  $.loading.classList.add("hidden");
  $.uploadScreen.style.display = "none";
  $.sidebar.style.display = "";
  $.main.style.display = "";
  $.statsBar.style.display = "";

  renderSidebar("");
}

// ── File Upload ──
function showUploadError(msg) {
  $.uploadError.textContent = msg;
  $.uploadError.style.display = "";
}

function readFileAsJSON(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve({ name: file.name, data: JSON.parse(reader.result) });
      } catch {
        resolve({ name: file.name, data: null });
      }
    };
    reader.onerror = () => resolve({ name: file.name, data: null });
    reader.readAsText(file);
  });
}

function processUploadedFiles(results) {
  const libFile = results.find((r) => r.name === "YourLibrary.json");
  if (!libFile || !libFile.data) {
    showUploadError(
      "YourLibrary.json not found. Make sure to include it in your selection.",
    );
    return;
  }

  const playlistFiles = results
    .filter((r) => /^Playlist\d+\.json$/i.test(r.name) && r.data)
    .map((r) => r.data);

  processData(libFile.data, playlistFiles);
}

function handleFiles(files) {
  $.uploadError.style.display = "none";
  const jsonFiles = Array.from(files).filter((f) =>
    f.name.endsWith(".json"),
  );
  if (jsonFiles.length === 0) {
    showUploadError(
      "No JSON files found. Select the files from your Spotify data export.",
    );
    return;
  }
  Promise.all(jsonFiles.map(readFileAsJSON)).then(processUploadedFiles);
}

function readEntries(dirReader) {
  return new Promise((resolve) => {
    const all = [];
    (function read() {
      dirReader.readEntries((entries) => {
        if (entries.length === 0) return resolve(all);
        all.push(...entries);
        read();
      });
    })();
  });
}

function entryToFile(entry) {
  return new Promise((resolve) => entry.file(resolve));
}

async function collectJSONFiles(entries) {
  const files = [];
  for (const entry of entries) {
    if (entry.isFile && entry.name.endsWith(".json")) {
      files.push(await entryToFile(entry));
    } else if (entry.isDirectory) {
      const subEntries = await readEntries(entry.createReader());
      files.push(...(await collectJSONFiles(subEntries)));
    }
  }
  return files;
}

function normalizePlaylistTracks(items) {
  return items
    .map((item) => {
      if (item.track) {
        return {
          name: item.track.trackName,
          artist: item.track.artistName,
          album: item.track.albumName,
          uri: item.track.trackUri,
          date: item.addedDate || "",
          local: false,
        };
      }
      if (item.localTrack) {
        const parts = item.localTrack.uri
          .replace("spotify:local:", "")
          .split(":");
        return {
          name: decodeURIComponent(parts[2] || "Unknown"),
          artist: decodeURIComponent(parts[0] || "Unknown"),
          album: decodeURIComponent(parts[1] || ""),
          uri: null,
          date: item.addedDate || "",
          local: true,
        };
      }
      return null;
    })
    .filter(Boolean);
}

// ── Init (wires up upload event listeners) ──
export function initData() {
  $.dropZone.addEventListener("click", () => $.fileInput.click());
  $.fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  $.uploadScreen.addEventListener("dragover", (e) => {
    e.preventDefault();
    $.dropZone.classList.add("dragover");
  });
  $.uploadScreen.addEventListener("dragleave", (e) => {
    if (!$.uploadScreen.contains(e.relatedTarget))
      $.dropZone.classList.remove("dragover");
  });

  $.uploadScreen.addEventListener("drop", async (e) => {
    e.preventDefault();
    $.dropZone.classList.remove("dragover");
    $.uploadError.style.display = "none";

    const items = e.dataTransfer.items;
    if (items && items.length > 0 && items[0].webkitGetAsEntry) {
      const entries = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      const files = await collectJSONFiles(entries);
      if (files.length === 0) {
        showUploadError(
          "No JSON files found. Drop your Spotify data folder or select the JSON files inside it.",
        );
        return;
      }
      Promise.all(files.map(readFileAsJSON)).then(processUploadedFiles);
    } else {
      handleFiles(e.dataTransfer.files);
    }
  });
}
