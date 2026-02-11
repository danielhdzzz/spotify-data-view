import { initData, tryLocalData, buildIndexes } from "./data.js";
import { initRender, renderSidebar, renderTrackList, renderCatalogList, renderVisibleRows, renderVisibleCatalogRows, updateSortHeaders } from "./render.js";
import { computeStats, renderStatsPage } from "./stats.js";
import { renderWrappedPage } from "./wrapped.js";
import { loadSettings, saveSettings, getSettings } from "./settings.js";
import { clearCachedData } from "./cache.js";

// ── Constants ──
export const ROW_H = 34;
export const RENDER_BUFFER = 10;

// ── Shared state ──
export const state = {
  library: null,
  playlists: [],
  activeId: null,
  currentTracks: [],
  filteredTracks: [],
  filterTimer: null,
  sortCol: null,
  sortAsc: true,
  isDetailView: false,
  catalogMode: null,
  artistIndex: [],
  albumIndex: [],
  catalogItems: [],
  filteredCatalog: [],
  navHistory: [],
  lastScrollTop: -1,
  visibleRows: [],
  statsOpen: false,
  wrappedYears: [],
  wrappedOpen: false,
  trackUriIndex: null,
};

// ── DOM refs ──
export const $ = {
  loading: document.getElementById("loading"),
  sidebar: document.getElementById("sidebar"),
  main: document.getElementById("main"),
  playlistList: document.getElementById("playlist-list"),
  sidebarSearch: document.getElementById("sidebar-search"),
  mainTitle: document.getElementById("main-title"),
  mainMeta: document.getElementById("main-meta"),
  trackFilter: document.getElementById("track-filter"),
  viewport: document.getElementById("track-viewport"),
  runway: document.getElementById("track-runway"),
  emptyState: document.getElementById("empty-state"),
  colHeader: document.getElementById("col-header"),
  trackFilterWrap: document.getElementById("track-filter-wrap"),
  statsBar: document.getElementById("stats-bar"),
  backBtn: document.getElementById("back-btn"),
  dedupToggle: document.getElementById("dedup-toggle"),
  dedupLabel: document.getElementById("dedup-label"),
  uploadScreen: document.getElementById("upload-screen"),
  dropZone: document.getElementById("drop-zone"),
  fileInput: document.getElementById("file-input"),
  uploadError: document.getElementById("upload-error"),
  statsView: document.getElementById("stats-view"),
  statsContent: document.getElementById("stats-content"),
  statsTitle: document.getElementById("stats-title"),
  statsMeta: document.getElementById("stats-meta"),
  settingsBtn: document.getElementById("settings-btn"),
  settingsOverlay: document.getElementById("settings-overlay"),
  hideLocalToggle: document.getElementById("hide-local-toggle"),
  clearCacheBtn: document.getElementById("clear-cache-btn"),
  privacyOverlay: document.getElementById("privacy-overlay"),
  exportCsvBtn: document.getElementById("export-csv-btn"),
  exportTxtBtn: document.getElementById("export-txt-btn"),
};

// ── Theme ──
const themeMQ = window.matchMedia("(prefers-color-scheme: light)");

function applyTheme() {
  const theme = getSettings().theme;
  if (theme === "light" || (theme === "system" && themeMQ.matches)) {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

themeMQ.addEventListener("change", () => applyTheme());
applyTheme();

// ── Navigation ──
export function selectPlaylist(id) {
  state.navHistory = [];
  if (id.startsWith("stats-")) {
    showStatsPage(id);
    return;
  }
  if (id.startsWith("wrapped-")) {
    showWrappedPage(id);
    return;
  }
  showPlaylist(id);
}

export function toggleStatsMenu() {
  state.statsOpen = !state.statsOpen;
}

export function toggleWrappedMenu() {
  state.wrappedOpen = !state.wrappedOpen;
}

export let cachedStats = null;

export function invalidateCachedStats() {
  cachedStats = null;
}

export function filterLocalTracks(tracks) {
  if (!getSettings().hideLocalTracks) return tracks;
  return tracks.filter((t) => !t.local);
}

function showStatsPage(id) {
  state.activeId = id;
  state.isDetailView = false;
  state.catalogMode = null;
  $.main.style.display = "none";
  $.statsView.style.display = "flex";

  // ensure menu is open when navigating to a sub-page
  state.statsOpen = true;

  document.querySelectorAll(".sidebar-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  if (!cachedStats) cachedStats = computeStats(state);

  const pageMap = { "stats-albums": "albums", "stats-artists": "artists", "stats-overview": "overview", "stats-timeline": "timeline" };
  const page = pageMap[id] || "overview";
  const titles = { overview: "Overview", artists: "Top Artists", albums: "Top Albums", timeline: "Timeline" };
  const metas = {
    overview: cachedStats.uniqueTracks.toLocaleString() + " unique tracks (deduplicated)",
    artists: cachedStats.uniqueArtists.toLocaleString() + " unique artists (deduplicated)",
    albums: cachedStats.uniqueAlbums.toLocaleString() + " unique albums (deduplicated)",
    timeline: "Tracks added over time",
  };
  $.statsTitle.textContent = titles[page];
  $.statsMeta.textContent = metas[page];
  renderStatsPage($.statsContent, cachedStats, page, {
    onArtist(name) {
      state.navHistory.push({ type: "stats", page: id });
      showArtist(name);
    },
    onAlbum(name, artist) {
      state.navHistory.push({ type: "stats", page: id });
      showAlbum(name, artist);
    },
  });
}

function showWrappedPage(id) {
  const year = parseInt(id.replace("wrapped-", ""), 10);
  const wrappedYear = state.wrappedYears.find((w) => w.year === year);
  if (!wrappedYear) return;

  state.activeId = id;
  state.isDetailView = false;
  state.catalogMode = null;
  $.main.style.display = "none";
  $.statsView.style.display = "flex";

  state.wrappedOpen = true;

  document.querySelectorAll(".sidebar-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  $.statsTitle.textContent = "Wrapped " + year;
  $.statsMeta.textContent = "Your year in music";
  renderWrappedPage($.statsContent, wrappedYear, state.trackUriIndex);
}

export function showAllPlaylistTracks() {
  state.activeId = "all-playlists";
  state.isDetailView = false;
  state.catalogMode = null;
  state.navHistory = [];
  $.backBtn.style.display = "none";
  $.statsView.style.display = "none";
  $.main.style.display = "";

  document.querySelectorAll(".sidebar-item").forEach((el) => el.classList.remove("active"));

  $.trackFilterWrap.style.display = "";
  $.colHeader.style.display = "";
  $.trackFilter.placeholder = "search all playlists...";
  $.trackFilter.value = "";
  $.dedupLabel.style.display = "flex";
  $.dedupToggle.checked = true;
  $.exportCsvBtn.classList.add("visible");
  $.exportTxtBtn.classList.add("visible");

  const allTracks = [];
  for (const pl of state.playlists) {
    for (const t of filterLocalTracks(pl.tracks)) {
      allTracks.push(t);
    }
  }

  state.currentTracks = allTracks;
  $.mainTitle.textContent = "All Tracks";
  state.sortCol = null;
  state.sortAsc = true;
  updateSortHeaders();

  // Trigger filter pipeline (applies dedup since toggle is checked)
  $.dedupToggle.dispatchEvent(new Event("change"));
}

export function updateMainMeta() {
  if (state.activeId !== "all-playlists") return;
  const n = state.playlists.length;
  if ($.dedupToggle.checked) {
    const seen = new Set();
    for (const t of state.currentTracks) {
      seen.add(t.uri || (t.name + "|||" + t.artist).toLowerCase());
    }
    $.mainMeta.textContent = seen.size.toLocaleString() + " unique tracks across " + n + " playlists";
  } else {
    $.mainMeta.textContent = state.currentTracks.length.toLocaleString() + " tracks across " + n + " playlists";
  }
}

export function showPlaylist(id) {
  if (id === "all-playlists") {
    showAllPlaylistTracks();
    return;
  }
  state.activeId = id;
  state.isDetailView = false;
  state.catalogMode = null;
  $.backBtn.style.display = "none";
  $.statsView.style.display = "none";
  $.main.style.display = "";

  document.querySelectorAll(".sidebar-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  if (id === "artists") {
    showCatalogList("artists");
    return;
  }
  if (id === "albums") {
    showCatalogList("albums");
    return;
  }

  $.trackFilterWrap.style.display = "";
  $.colHeader.style.display = "";
  $.trackFilter.placeholder = "filter tracks...";
  $.dedupLabel.style.display = "none";
  $.dedupToggle.checked = false;
  $.exportCsvBtn.classList.add("visible");
  $.exportTxtBtn.classList.add("visible");


  if (id === "liked") {
    $.mainTitle.textContent = "Liked Songs";
    state.currentTracks = filterLocalTracks(normalizeLibraryTracks(state.library.tracks));
    $.mainMeta.textContent = state.currentTracks.length + " tracks";
  } else {
    const pl = state.playlists.find((p) => p.id === id);
    $.mainTitle.textContent = pl.name;
    state.currentTracks = filterLocalTracks(pl.tracks);
    $.mainMeta.textContent =
      state.currentTracks.length + " tracks \u00b7 updated " + pl.date;
  }

  $.trackFilter.value = "";
  state.sortCol = null;
  state.sortAsc = true;
  updateSortHeaders();
  state.filteredTracks = state.currentTracks.slice();
  renderTrackList();
}

export function showCatalogList(mode) {
  state.catalogMode = mode;
  state.isDetailView = false;
  $.statsView.style.display = "none";
  $.main.style.display = "";
  $.exportCsvBtn.classList.remove("visible");
  $.exportTxtBtn.classList.remove("visible");

  $.trackFilterWrap.style.display = "";
  const index = mode === "artists" ? state.artistIndex : state.albumIndex;
  const label = mode === "artists" ? "Artists" : "Albums";

  $.mainTitle.textContent = label;
  $.mainMeta.textContent = index.length + " " + label.toLowerCase();
  $.colHeader.style.display = "none";
  $.trackFilter.value = "";
  $.trackFilter.placeholder = "filter " + label.toLowerCase() + "...";
  $.dedupLabel.style.display = "none";
  $.dedupToggle.checked = false;

  state.catalogItems = index;
  state.filteredCatalog = index.slice();
  state.currentTracks = [];
  state.filteredTracks = [];
  renderCatalogList();
}

export function showDetailView(title, meta, tracks) {
  document
    .querySelectorAll(".sidebar-item")
    .forEach((el) => el.classList.remove("active"));
  state.isDetailView = true;
  state.catalogMode = null;
  $.statsView.style.display = "none";
  $.main.style.display = "";
  $.backBtn.style.display = "block";
  $.exportCsvBtn.classList.remove("visible");
  $.exportTxtBtn.classList.remove("visible");

  $.trackFilterWrap.style.display = "";
  $.colHeader.style.display = "";
  $.trackFilter.placeholder = "filter tracks...";
  $.dedupLabel.style.display = "flex";
  $.dedupToggle.checked = false;
  $.mainTitle.textContent = title;
  $.mainMeta.textContent = meta;

  $.trackFilter.value = "";
  state.sortCol = null;
  state.sortAsc = true;
  updateSortHeaders();
  state.currentTracks = tracks;
  state.filteredTracks = tracks.slice();
  renderTrackList();
}

export function showArtist(artistName) {
  const key = artistName.toLowerCase();
  const tracks = [];

  for (const t of state.library.tracks) {
    if (t.artist.toLowerCase() === key) {
      tracks.push({
        name: t.track,
        artist: t.artist,
        album: t.album,
        uri: t.uri,
        date: "",
        local: false,
        source: "Liked Songs",
      });
    }
  }
  for (const pl of state.playlists) {
    for (const t of pl.tracks) {
      if (t.artist.toLowerCase() === key) {
        tracks.push({ ...t, source: pl.name });
      }
    }
  }

  const filtered = filterLocalTracks(tracks);
  showDetailView(
    artistName,
    filtered.length + " tracks across your library",
    filtered,
  );
}

export function showAlbum(albumName, artistName) {
  const keyAlbum = albumName.toLowerCase();
  const keyArtist = artistName.toLowerCase();
  const tracks = [];

  for (const t of state.library.tracks) {
    if (
      t.album.toLowerCase() === keyAlbum &&
      t.artist.toLowerCase() === keyArtist
    ) {
      tracks.push({
        name: t.track,
        artist: t.artist,
        album: t.album,
        uri: t.uri,
        date: "",
        local: false,
        source: "Liked Songs",
      });
    }
  }
  for (const pl of state.playlists) {
    for (const t of pl.tracks) {
      if (
        t.album.toLowerCase() === keyAlbum &&
        t.artist.toLowerCase() === keyArtist
      ) {
        tracks.push({ ...t, source: pl.name });
      }
    }
  }

  const filtered = filterLocalTracks(tracks);
  showDetailView(
    albumName + " \u2014 " + artistName,
    filtered.length + " tracks across your library",
    filtered,
  );
}

function normalizeLibraryTracks(tracks) {
  return tracks.map((t) => ({
    name: t.track,
    artist: t.artist,
    album: t.album,
    uri: t.uri,
    date: "",
    local: false,
  }));
}

// ── Back Navigation ──
$.backBtn.addEventListener("click", () => {
  const prev = state.navHistory.pop();
  if (!prev) return;
  if (prev.type === "stats") {
    showStatsPage(prev.page);
    return;
  }
  if (prev.type === "wrapped") {
    showWrappedPage(prev.page);
    return;
  }
  if (prev.type === "catalog") {
    state.activeId = prev.mode;
    document.querySelectorAll(".sidebar-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.id === prev.mode);
    });
    $.backBtn.style.display = "none";
    showCatalogList(prev.mode);
  } else if (prev.type === "playlist") {
    showPlaylist(prev.id);
  }
});

// ── Keyboard shortcuts ──
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    $.sidebarSearch.focus();
    $.sidebarSearch.select();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "f") {
    e.preventDefault();
    $.trackFilter.focus();
    $.trackFilter.select();
  }
  if (e.key === "Escape") {
    const open = [$.settingsOverlay, $.privacyOverlay].find((o) => o.style.display !== "none");
    if (open) {
      open.style.display = "none";
    } else if (document.activeElement === $.sidebarSearch) {
      $.sidebarSearch.value = "";
      $.sidebarSearch.blur();
      renderSidebar("");
    } else if (document.activeElement === $.trackFilter) {
      $.trackFilter.value = "";
      $.trackFilter.blur();
      state.filteredTracks = state.currentTracks;
      renderTrackList();
    }
  }
});

// ── Scroll ──
$.viewport.addEventListener("scroll", () => {
  requestAnimationFrame(() => {
    if (state.catalogMode) renderVisibleCatalogRows();
    else renderVisibleRows();
  });
});

// ── Sidebar Search ──
$.sidebarSearch.addEventListener("input", () => {
  renderSidebar($.sidebarSearch.value);
});

// ── Overlays ──
function wireOverlay(overlay) {
  overlay.querySelector(".overlay-close").addEventListener("click", () => {
    overlay.style.display = "none";
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.style.display = "none";
  });
}

wireOverlay($.settingsOverlay);
wireOverlay($.privacyOverlay);

// ── Settings ──
loadSettings();
$.hideLocalToggle.checked = getSettings().hideLocalTracks;

// Theme radios
const themeRadios = document.querySelectorAll('input[name="theme"]');
const currentTheme = getSettings().theme;
themeRadios.forEach((r) => {
  if (r.value === currentTheme) r.checked = true;
  r.addEventListener("change", () => {
    const s = getSettings();
    s.theme = r.value;
    saveSettings(s);
    applyTheme();
  });
});

$.settingsBtn.addEventListener("click", () => {
  $.settingsOverlay.style.display = "";
});

document.querySelectorAll(".privacy-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $.privacyOverlay.style.display = "";
  });
});

$.clearCacheBtn.addEventListener("click", async () => {
  await clearCachedData();
  location.reload();
});

$.hideLocalToggle.addEventListener("change", () => {
  const s = getSettings();
  s.hideLocalTracks = $.hideLocalToggle.checked;
  saveSettings(s);
  invalidateCachedStats();
  if (state.library) buildIndexes();
  renderSidebar($.sidebarSearch.value);
  // Reapply current view
  if (state.activeId) {
    if (state.isDetailView) {
      const prev = state.navHistory[state.navHistory.length - 1];
      if (prev) {
        $.backBtn.click();
      }
    } else {
      selectPlaylist(state.activeId);
    }
  }
});

// ── Library title (reset to home) ──
document.getElementById("library-title").addEventListener("click", () => {
  showAllPlaylistTracks();
});

// ── CSV Export ──
function csvEscape(val) {
  if (!val) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

$.exportCsvBtn.addEventListener("click", () => {
  const tracks = state.currentTracks;
  if (!tracks || tracks.length === 0) return;

  const rows = [["Track Name", "Artist", "Album", "Spotify URI"].join(",")];
  for (const t of tracks) {
    rows.push(
      [csvEscape(t.name), csvEscape(t.artist), csvEscape(t.album), csvEscape(t.uri || "")].join(","),
    );
  }
  downloadFile(rows.join("\n"), ($.mainTitle.textContent || "export") + ".csv", "text/csv;charset=utf-8");
});

$.exportTxtBtn.addEventListener("click", () => {
  const tracks = state.currentTracks;
  if (!tracks || tracks.length === 0) return;

  const lines = tracks.map((t) => t.artist + " - " + t.name);
  downloadFile(lines.join("\n"), ($.mainTitle.textContent || "export") + ".txt", "text/plain;charset=utf-8");
});

function getAllTracks() {
  const tracks = [];
  const likedTracks = filterLocalTracks(normalizeLibraryTracks(state.library.tracks));
  for (const t of likedTracks) {
    tracks.push({ playlist: "Liked Songs", ...t });
  }
  for (const pl of state.playlists) {
    for (const t of filterLocalTracks(pl.tracks)) {
      tracks.push({ playlist: pl.name, ...t });
    }
  }
  return tracks;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAllCsv() {
  if (!state.library) return;
  const tracks = getAllTracks();
  const rows = [["Playlist Name", "Track Name", "Artist", "Album", "Spotify URI"].join(",")];
  for (const t of tracks) {
    rows.push(
      [csvEscape(t.playlist), csvEscape(t.name), csvEscape(t.artist), csvEscape(t.album), csvEscape(t.uri || "")].join(","),
    );
  }
  downloadFile(rows.join("\n"), "spotify-library.csv", "text/csv;charset=utf-8");
}

function exportAllTxt() {
  if (!state.library) return;
  const tracks = getAllTracks();
  let currentPlaylist = null;
  const lines = [];
  for (const t of tracks) {
    if (t.playlist !== currentPlaylist) {
      if (currentPlaylist !== null) lines.push("");
      lines.push("## " + t.playlist);
      lines.push("");
      currentPlaylist = t.playlist;
    }
    lines.push(t.artist + " - " + t.name);
  }
  downloadFile(lines.join("\n"), "spotify-library.txt", "text/plain;charset=utf-8");
}

document.querySelectorAll(".export-all-csv-btn").forEach((btn) => btn.addEventListener("click", exportAllCsv));
document.querySelectorAll(".export-all-txt-btn").forEach((btn) => btn.addEventListener("click", exportAllTxt));

// ── Init ──
initRender();
initData();
tryLocalData();
