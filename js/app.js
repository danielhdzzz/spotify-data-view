import { initData, tryLocalData, buildIndexes } from "./data.js";
import { initRender, renderSidebar, renderTrackList, renderCatalogList, renderVisibleRows, renderVisibleCatalogRows, updateSortHeaders } from "./render.js";
import { computeStats, renderStatsPage } from "./stats.js";
import { loadSettings, saveSettings, getSettings } from "./settings.js";

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
  settingsClose: document.getElementById("settings-close"),
  hideLocalToggle: document.getElementById("hide-local-toggle"),
};

// ── Navigation ──
export function selectPlaylist(id) {
  state.navHistory = [];
  if (id.startsWith("stats-")) {
    showStatsPage(id);
    return;
  }
  showPlaylist(id);
}

export function toggleStatsMenu() {
  state.statsOpen = !state.statsOpen;
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

export function showPlaylist(id) {
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

  $.colHeader.style.display = "";
  $.trackFilter.placeholder = "filter tracks...";
  $.dedupLabel.style.display = "none";
  $.dedupToggle.checked = false;

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
    if ($.settingsOverlay.style.display !== "none") {
      $.settingsOverlay.style.display = "none";
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

// ── Settings ──
loadSettings();
$.hideLocalToggle.checked = getSettings().hideLocalTracks;

$.settingsBtn.addEventListener("click", () => {
  $.settingsOverlay.style.display = "";
});

$.settingsClose.addEventListener("click", () => {
  $.settingsOverlay.style.display = "none";
});

$.settingsOverlay.addEventListener("click", (e) => {
  if (e.target === $.settingsOverlay) $.settingsOverlay.style.display = "none";
});

$.hideLocalToggle.addEventListener("change", () => {
  const s = getSettings();
  s.hideLocalTracks = $.hideLocalToggle.checked;
  saveSettings(s);
  invalidateCachedStats();
  if (state.library) buildIndexes();
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

// ── Init ──
initRender();
initData();
tryLocalData();
