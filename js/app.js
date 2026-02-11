import { initData, tryLocalData } from "./data.js";
import { initRender, renderSidebar, renderTrackList, renderCatalogList, renderVisibleRows, renderVisibleCatalogRows, updateSortHeaders } from "./render.js";

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
};

// ── Navigation ──
export function selectPlaylist(id) {
  state.navHistory = [];
  showPlaylist(id);
}

export function showPlaylist(id) {
  state.activeId = id;
  state.isDetailView = false;
  state.catalogMode = null;
  $.backBtn.style.display = "none";

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
    state.currentTracks = normalizeLibraryTracks(state.library.tracks);
    $.mainMeta.textContent = state.currentTracks.length + " tracks";
  } else {
    const pl = state.playlists.find((p) => p.id === id);
    $.mainTitle.textContent = pl.name;
    state.currentTracks = pl.tracks;
    $.mainMeta.textContent =
      pl.trackCount + " tracks \u00b7 updated " + pl.date;
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

  showDetailView(
    artistName,
    tracks.length + " tracks across your library",
    tracks,
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

  showDetailView(
    albumName + " \u2014 " + artistName,
    tracks.length + " tracks across your library",
    tracks,
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
    if (document.activeElement === $.sidebarSearch) {
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

// ── Init ──
initRender();
initData();
tryLocalData();
