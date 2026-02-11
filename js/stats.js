// ── Stats computation & rendering ──

import { getSettings } from "./settings.js";

export function computeStats(state) {
  const hideLocal = getSettings().hideLocalTracks;
  const seen = new Set();
  const artistMap = new Map();
  const albumMap = new Map();
  let uniqueCount = 0;
  let localCount = 0;

  function addTrack(name, artist, album, uri, isLocal) {
    const key = uri || (name + "|||" + artist).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    uniqueCount++;
    if (isLocal) localCount++;

    const aKey = artist.toLowerCase();
    if (!artistMap.has(aKey)) artistMap.set(aKey, { name: artist, count: 0 });
    artistMap.get(aKey).count++;

    const abKey = (album + "|||" + artist).toLowerCase();
    if (!albumMap.has(abKey))
      albumMap.set(abKey, { name: album, artist: artist, count: 0 });
    albumMap.get(abKey).count++;
  }

  for (const t of state.library.tracks) {
    addTrack(t.track, t.artist, t.album, t.uri, false);
  }
  for (const pl of state.playlists) {
    for (const t of pl.tracks) {
      if (hideLocal && t.local) continue;
      addTrack(t.name, t.artist, t.album, t.uri, t.local);
    }
  }

  const artists = Array.from(artistMap.values())
    .sort((a, b) => b.count - a.count);
  const albums = Array.from(albumMap.values())
    .sort((a, b) => b.count - a.count);

  const totalTracks = state.library.tracks.length +
    state.playlists.reduce((s, p) => s + (hideLocal ? p.tracks.filter((t) => !t.local).length : p.trackCount), 0);

  // Build timeline (tracks added per month) & artist first-seen dates
  const monthMap = new Map();
  const artistFirstSeen = new Map(); // artist key -> { name, month, totalTracks }
  for (const pl of state.playlists) {
    for (const t of pl.tracks) {
      if (hideLocal && t.local) continue;
      if (!t.date) continue;
      const month = t.date.slice(0, 7); // "YYYY-MM"
      monthMap.set(month, (monthMap.get(month) || 0) + 1);

      const aKey = t.artist.toLowerCase();
      if (!artistFirstSeen.has(aKey) || month < artistFirstSeen.get(aKey).month) {
        artistFirstSeen.set(aKey, { name: t.artist, month });
      }
    }
  }
  // Attach total track counts from the deduplicated artist map
  for (const [aKey, entry] of artistFirstSeen) {
    const a = artistMap.get(aKey);
    entry.totalTracks = a ? a.count : 1;
  }
  // Group discoveries by month
  const discoveryMap = new Map();
  for (const entry of artistFirstSeen.values()) {
    if (!discoveryMap.has(entry.month)) discoveryMap.set(entry.month, []);
    discoveryMap.get(entry.month).push(entry);
  }
  // Sort artists within each month by total tracks (most significant first)
  for (const arr of discoveryMap.values()) {
    arr.sort((a, b) => b.totalTracks - a.totalTracks);
  }
  const discoveries = Array.from(discoveryMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));

  const timeline = Array.from(monthMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    uniqueTracks: uniqueCount,
    uniqueArtists: artists.length,
    uniqueAlbums: albums.length,
    localTracks: localCount,
    localPct: uniqueCount ? ((localCount / uniqueCount) * 100).toFixed(1) : "0",
    totalTracks: totalTracks,
    likedSongs: state.library.tracks.length,
    playlistCount: state.playlists.length,
    duplicates: totalTracks - uniqueCount,
    allArtists: artists,
    allAlbums: albums,
    timeline: timeline,
    discoveries: discoveries,
  };
}

export function renderStatsPage(container, stats, page, callbacks) {
  container.innerHTML = "";

  if (page === "overview") {
    renderOverview(container, stats);
    return;
  }

  if (page === "timeline") {
    renderTimeline(container, stats, callbacks);
    return;
  }

  if (page === "artists") {
    container.appendChild(makeSection("Top Artists"));
    const items = stats.allArtists;
    const max = items.length ? items[0].count : 1;
    const list = document.createElement("div");
    list.className = "stats-list";
    items.forEach((a, i) => {
      const row = makeRow(i + 1, a.name, a.count + " tracks", a.count / max, () => {
        callbacks.onArtist(a.name);
      });
      list.appendChild(row);
    });
    container.appendChild(list);
  } else {
    container.appendChild(makeSection("Top Albums"));
    const items = stats.allAlbums;
    const max = items.length ? items[0].count : 1;
    const list = document.createElement("div");
    list.className = "stats-list";
    items.forEach((a, i) => {
      const row = makeRow(
        i + 1,
        a.artist + " \u2014 " + a.name,
        a.count + " tracks",
        a.count / max,
        () => {
          callbacks.onAlbum(a.name, a.artist);
        }
      );
      list.appendChild(row);
    });
    container.appendChild(list);
  }
}

function renderOverview(container, stats) {
  // Primary counts
  const primary = document.createElement("div");
  primary.className = "stats-cards";
  primary.appendChild(makeCard("Unique Tracks", stats.uniqueTracks.toLocaleString()));
  primary.appendChild(makeCard("Unique Artists", stats.uniqueArtists.toLocaleString()));
  primary.appendChild(makeCard("Unique Albums", stats.uniqueAlbums.toLocaleString()));
  container.appendChild(primary);

  // Library breakdown
  container.appendChild(makeSection("Library"));
  const breakdown = document.createElement("div");
  breakdown.className = "stats-cards";
  breakdown.appendChild(makeCard("Liked Songs", stats.likedSongs.toLocaleString()));
  breakdown.appendChild(makeCard("Playlists", stats.playlistCount.toLocaleString()));
  breakdown.appendChild(makeCard("Total Tracks", stats.totalTracks.toLocaleString()));
  breakdown.appendChild(makeCard("Cross-Playlist Duplicates", stats.duplicates.toLocaleString()));
  container.appendChild(breakdown);

  // Extra detail
  container.appendChild(makeSection("Averages"));
  const avgs = document.createElement("div");
  avgs.className = "stats-cards";
  const avgPerArtist = stats.uniqueArtists ? (stats.uniqueTracks / stats.uniqueArtists).toFixed(1) : "0";
  const avgPerAlbum = stats.uniqueAlbums ? (stats.uniqueTracks / stats.uniqueAlbums).toFixed(1) : "0";
  const avgPerPlaylist = stats.playlistCount ? (stats.totalTracks / stats.playlistCount).toFixed(0) : "0";
  avgs.appendChild(makeCard("Tracks / Artist", avgPerArtist));
  avgs.appendChild(makeCard("Tracks / Album", avgPerAlbum));
  avgs.appendChild(makeCard("Tracks / Playlist", avgPerPlaylist));
  avgs.appendChild(makeCard("Local Tracks", stats.localTracks.toLocaleString() + " (" + stats.localPct + "%)"));
  container.appendChild(avgs);
}

function renderTimeline(container, stats, callbacks) {
  const data = stats.timeline;
  if (!data.length) {
    const empty = document.createElement("div");
    empty.className = "stats-section";
    empty.textContent = "No date information available";
    container.appendChild(empty);
    return;
  }

  const max = Math.max(...data.map((d) => d.count));
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function formatMonth(key) {
    const [y, m] = key.split("-");
    return monthNames[parseInt(m, 10) - 1] + " " + y;
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const cards = document.createElement("div");
  cards.className = "stats-cards";
  cards.appendChild(makeCard("Total Added", total.toLocaleString()));
  cards.appendChild(makeCard("Time Span", formatMonth(data[0].month) + " \u2013 " + formatMonth(data[data.length - 1].month)));
  cards.appendChild(makeCard("Peak Month", formatMonth(data.reduce((a, b) => b.count > a.count ? b : a).month) + " (" + max.toLocaleString() + ")"));
  cards.appendChild(makeCard("Avg / Month", Math.round(total / data.length).toLocaleString()));
  container.appendChild(cards);

  container.appendChild(makeSection("Tracks Added Per Month"));

  const chart = document.createElement("div");
  chart.className = "histogram";

  const tooltip = document.createElement("div");
  tooltip.className = "histogram-tooltip";
  document.body.appendChild(tooltip);

  // Clean up tooltip when container is cleared
  const observer = new MutationObserver(() => {
    if (!container.contains(chart)) {
      tooltip.remove();
      observer.disconnect();
    }
  });
  observer.observe(container, { childList: true });

  for (const d of data) {
    const col = document.createElement("div");
    col.className = "histogram-col";

    const bar = document.createElement("div");
    bar.className = "histogram-bar";
    bar.style.height = ((d.count / max) * 100).toFixed(1) + "%";

    const text = formatMonth(d.month) + ": " + d.count.toLocaleString() + " tracks";
    bar.addEventListener("mouseenter", () => {
      tooltip.textContent = text;
      tooltip.style.display = "block";
    });
    bar.addEventListener("mousemove", (e) => {
      const tw = tooltip.offsetWidth;
      const fits = e.clientX + 10 + tw < window.innerWidth;
      tooltip.style.left = (fits ? e.clientX + 10 : e.clientX - tw - 10) + "px";
      tooltip.style.top = e.clientY - 28 + "px";
    });
    bar.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });

    const label = document.createElement("div");
    label.className = "histogram-label";
    // Show label for Jan or if few data points
    const monthNum = parseInt(d.month.split("-")[1], 10);
    if (monthNum === 1 || data.length <= 24) {
      label.textContent = data.length <= 24 ? formatMonth(d.month) : d.month.split("-")[0];
    }

    col.appendChild(bar);
    col.appendChild(label);
    chart.appendChild(col);
  }

  container.appendChild(chart);

  // New Discoveries
  if (stats.discoveries.length) {
    container.appendChild(makeSection("New Discoveries"));
    const disc = document.createElement("div");
    disc.className = "discoveries";

    for (const [month, artists] of stats.discoveries) {
      const row = document.createElement("div");
      row.className = "discovery-month";

      const label = document.createElement("div");
      label.className = "discovery-month-label";
      label.textContent = formatMonth(month);
      row.appendChild(label);

      const chips = document.createElement("div");
      chips.className = "discovery-chips";

      for (const a of artists) {
        const chip = document.createElement("span");
        chip.className = "discovery-chip";
        chip.textContent = a.name;
        chip.title = a.totalTracks + " tracks in library";
        chip.addEventListener("click", () => callbacks.onArtist(a.name));
        chips.appendChild(chip);
      }

      row.appendChild(chips);
      disc.appendChild(row);
    }

    container.appendChild(disc);
  }
}

function makeCard(label, value) {
  const el = document.createElement("div");
  el.className = "stats-card";
  const valEl = document.createElement("div");
  valEl.className = "stats-card-value";
  valEl.textContent = value;
  const labEl = document.createElement("div");
  labEl.className = "stats-card-label";
  labEl.textContent = label;
  el.appendChild(valEl);
  el.appendChild(labEl);
  return el;
}

function makeSection(title) {
  const el = document.createElement("div");
  el.className = "stats-section";
  el.textContent = title;
  return el;
}

function makeRow(rank, name, detail, pct, onClick) {
  const row = document.createElement("div");
  row.className = "stats-row";
  row.addEventListener("click", onClick);

  const bar = document.createElement("div");
  bar.className = "stats-row-bar";
  bar.style.width = (pct * 100).toFixed(1) + "%";

  const rankEl = document.createElement("span");
  rankEl.className = "stats-row-rank";
  rankEl.textContent = rank;

  const nameEl = document.createElement("span");
  nameEl.className = "stats-row-name";
  nameEl.textContent = name;

  const detailEl = document.createElement("span");
  detailEl.className = "stats-row-detail";
  detailEl.textContent = detail;

  row.appendChild(bar);
  row.appendChild(rankEl);
  row.appendChild(nameEl);
  row.appendChild(detailEl);
  return row;
}
