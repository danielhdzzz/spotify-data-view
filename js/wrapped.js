// ── Wrapped data parsing & rendering ──

// Module-level cache for resolved artist names (survives re-renders)
const artistNameCache = new Map();

export function parseWrappedFile(filename, data) {
  const match = filename.match(/Wrapped(\d{4})\.json$/i);
  if (!match || !data || typeof data !== "object") return null;
  return { year: parseInt(match[1], 10), raw: data };
}

export function renderWrappedPage(container, wrappedYear, trackUriIndex) {
  container.innerHTML = "";
  const d = wrappedYear.raw;

  renderHighlights(container, d);
  renderTopTracks(container, d, trackUriIndex);
  renderArchiveReports(container, d);
  renderListeningAge(container, d);
  renderClub(container, d);
  renderArtistRace(container, d);

  // Async: resolve artist URIs to real names
  resolveArtistNamesInContainer(container);
}

// ── Helpers ──

function formatMs(ms) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return totalMin + " min";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return h + "h " + m + "m";
  const days = Math.floor(h / 24);
  const rh = h % 24;
  return days + "d " + rh + "h";
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

function spotifyLink(uri) {
  if (!uri) return null;
  const parts = uri.split(":");
  if (parts.length < 3) return null;
  return "https://open.spotify.com/" + parts[1] + "/" + parts[2];
}

async function resolveArtistNamesInContainer(container) {
  const els = container.querySelectorAll("[data-artist-uri]");
  if (els.length === 0) return;

  const uris = new Set();
  els.forEach((el) => uris.add(el.dataset.artistUri));

  // Fetch uncached names
  const toFetch = [...uris].filter((u) => !artistNameCache.has(u));
  if (toFetch.length > 0) {
    await Promise.all(toFetch.map(async (uri) => {
      try {
        const id = uri.split(":").pop();
        const res = await fetch("https://open.spotify.com/oembed?url=https://open.spotify.com/artist/" + id);
        if (!res.ok) return;
        const data = await res.json();
        if (data.title) artistNameCache.set(uri, data.title);
      } catch {
        // best effort
      }
    }));
  }

  // Update DOM elements
  els.forEach((el) => {
    const name = artistNameCache.get(el.dataset.artistUri);
    if (name) el.textContent = name;
  });
}

// ── Section Renderers ──

function renderHighlights(container, d) {
  const ym = d.yearlyMetrics;
  const party = d.party;
  const ta = d.topArtists;
  const tt = d.topTracks;
  const tg = d.topGenres;
  const tab = d.topAlbums;

  const hasAnything = ym || party || ta || tt || tg || tab;
  if (!hasAnything) return;

  container.appendChild(makeSection("Highlights"));
  const cards = document.createElement("div");
  cards.className = "stats-cards";
  cards.style.flexWrap = "wrap";

  if (ym && ym.totalMsListened) cards.appendChild(makeCard("Total Listening Time", formatMs(ym.totalMsListened)));
  if (party) {
    if (party.totalNumListeningMinutes) cards.appendChild(makeCard("Minutes Listened", party.totalNumListeningMinutes.toLocaleString()));
    if (party.totalNumListeningDays) cards.appendChild(makeCard("Days Listened", party.totalNumListeningDays.toLocaleString()));
    if (party.streakNumListeningDays) cards.appendChild(makeCard("Longest Streak", party.streakNumListeningDays + " days"));
    if (party.numArtistsDiscovered) cards.appendChild(makeCard("Artists Discovered", party.numArtistsDiscovered.toLocaleString()));
    if (party.percentListenedNight != null) cards.appendChild(makeCard("Night Listening", party.percentListenedNight.toFixed(1) + "%"));
    if (party.avgTrackPopularityScore != null) cards.appendChild(makeCard("Avg Popularity", Math.round(party.avgTrackPopularityScore * 100) + "%"));
  }
  if (tt && tt.numUniqueTracks) cards.appendChild(makeCard("Unique Tracks", tt.numUniqueTracks.toLocaleString()));
  if (ta && ta.numUniqueArtists) cards.appendChild(makeCard("Unique Artists", ta.numUniqueArtists.toLocaleString()));
  if (tab && tab.numCompletedAlbums) cards.appendChild(makeCard("Albums Completed", tab.numCompletedAlbums.toLocaleString()));
  if (tg && tg.totalNumGenres) cards.appendChild(makeCard("Genres Explored", tg.totalNumGenres.toLocaleString()));

  if (cards.children.length > 0) container.appendChild(cards);
}

function renderTopTracks(container, d, trackUriIndex) {
  if (!d.topTracks || !d.topTracks.topTracks || !d.topTracks.topTracks.length) return;

  container.appendChild(makeSection("Top Tracks"));
  const list = document.createElement("div");
  list.className = "stats-list";
  const tracks = d.topTracks.topTracks;
  const maxCount = tracks[0].count || 1;

  tracks.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "stats-row";
    row.style.cursor = "default";

    const bar = document.createElement("div");
    bar.className = "stats-row-bar";
    bar.style.width = ((t.count / maxCount) * 100).toFixed(1) + "%";

    const rankEl = document.createElement("span");
    rankEl.className = "stats-row-rank";
    rankEl.textContent = i + 1;

    const nameEl = document.createElement("span");
    nameEl.className = "stats-row-name";

    const resolved = trackUriIndex && trackUriIndex.get(t.trackUri);
    if (resolved) {
      const a = document.createElement("a");
      const trackId = t.trackUri.split(":").pop();
      a.href = "https://open.spotify.com/track/" + trackId;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = resolved.name + " \u2014 " + resolved.artist;
      a.style.color = "inherit";
      a.style.textDecoration = "none";
      a.addEventListener("mouseenter", () => { a.style.color = "var(--accent)"; });
      a.addEventListener("mouseleave", () => { a.style.color = "inherit"; });
      nameEl.appendChild(a);
    } else {
      const link = spotifyLink(t.trackUri);
      if (link) {
        const a = document.createElement("a");
        a.href = link;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Track #" + (i + 1);
        a.style.color = "inherit";
        a.style.textDecoration = "none";
        a.addEventListener("mouseenter", () => { a.style.color = "var(--accent)"; });
        a.addEventListener("mouseleave", () => { a.style.color = "inherit"; });
        nameEl.appendChild(a);
      } else {
        nameEl.textContent = "Track #" + (i + 1);
      }
    }

    const detailEl = document.createElement("span");
    detailEl.className = "stats-row-detail";
    const parts = [];
    if (t.count) parts.push(t.count + " plays");
    if (t.msPlayed) parts.push(formatMs(t.msPlayed));
    detailEl.textContent = parts.join(" \u00b7 ");

    row.appendChild(bar);
    row.appendChild(rankEl);
    row.appendChild(nameEl);
    row.appendChild(detailEl);
    list.appendChild(row);
  });

  container.appendChild(list);
}

function renderArchiveReports(container, d) {
  if (!d.archiveReports || !d.archiveReports.archiveReports || !d.archiveReports.archiveReports.length) return;

  container.appendChild(makeSection("Notable Days"));

  for (const report of d.archiveReports.archiveReports) {
    const card = document.createElement("div");
    card.className = "wrapped-report";

    if (report.columnQualifier) {
      const dateStr = report.columnQualifier;
      const formatted = dateStr.slice(0, 4) + "-" + dateStr.slice(4, 6) + "-" + dateStr.slice(6, 8);
      const dateEl = document.createElement("div");
      dateEl.className = "wrapped-report-date";
      dateEl.textContent = formatted;
      card.appendChild(dateEl);
    }

    if (report.title) {
      const titleEl = document.createElement("div");
      titleEl.className = "wrapped-report-title";
      titleEl.textContent = report.title;
      card.appendChild(titleEl);
    }

    if (report.description) {
      const descEl = document.createElement("div");
      descEl.className = "wrapped-report-desc";
      descEl.textContent = report.description;
      card.appendChild(descEl);
    }

    if (report.filedUnderTags) {
      const tagsEl = document.createElement("div");
      tagsEl.className = "wrapped-report-tags";
      const raw = report.filedUnderTags.replace(/^\[|\]$/g, "");
      const tags = raw.split(",").map((s) => s.trim()).filter(Boolean);
      for (const tag of tags) {
        const chip = document.createElement("span");
        chip.className = "discovery-chip";
        chip.textContent = tag;
        tagsEl.appendChild(chip);
      }
      card.appendChild(tagsEl);
    }

    container.appendChild(card);
  }
}

function renderListeningAge(container, d) {
  if (!d.listeningAge) return;

  container.appendChild(makeSection("Listening Age"));
  const cards = document.createElement("div");
  cards.className = "stats-cards";

  const la = d.listeningAge;
  if (la.listeningAge != null) cards.appendChild(makeCard("Listening Age", la.listeningAge.toString()));
  if (la.windowStartYear) cards.appendChild(makeCard("Era Start", la.windowStartYear.toString()));
  if (la.decadePhase) cards.appendChild(makeCard("Decade Phase", la.decadePhase.charAt(0).toUpperCase() + la.decadePhase.slice(1)));

  if (cards.children.length > 0) container.appendChild(cards);
}

function renderClub(container, d) {
  if (!d.clubs) return;

  container.appendChild(makeSection("Listener Club"));
  const cards = document.createElement("div");
  cards.className = "stats-cards";

  const c = d.clubs;
  if (c.userClub) {
    const name = c.userClub
      .split("_")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ");
    cards.appendChild(makeCard("Club", name));
  }
  if (c.role) {
    cards.appendChild(makeCard("Role", c.role.charAt(0) + c.role.slice(1).toLowerCase()));
  }
  if (c.percentInClub != null) {
    cards.appendChild(makeCard("Listeners in Club", (c.percentInClub * 100).toFixed(1) + "%"));
  }

  if (cards.children.length > 0) container.appendChild(cards);
}

function renderArtistRace(container, d) {
  if (!d.topArtistRace || !d.topArtistRace.topArtists || !d.topArtistRace.topArtists.length) return;

  container.appendChild(makeSection("Artist Race"));

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthOrder = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

  // Collect all months that appear in data
  const presentMonths = new Set();
  for (const artist of d.topArtistRace.topArtists) {
    if (!artist.monthsStats) continue;
    for (const ms of artist.monthsStats) {
      presentMonths.add(ms.month);
    }
  }
  const orderedMonths = monthOrder.filter((m) => presentMonths.has(m));

  const table = document.createElement("div");
  table.className = "wrapped-race-table";

  // Header row
  const header = document.createElement("div");
  header.className = "wrapped-race-row wrapped-race-header";
  const labelHead = document.createElement("div");
  labelHead.className = "wrapped-race-label";
  labelHead.textContent = "";
  header.appendChild(labelHead);
  for (const m of orderedMonths) {
    const cell = document.createElement("div");
    cell.className = "wrapped-race-cell";
    cell.textContent = months[monthOrder.indexOf(m)];
    header.appendChild(cell);
  }
  table.appendChild(header);

  // Artist rows
  d.topArtistRace.topArtists.forEach((artist, i) => {
    const row = document.createElement("div");
    row.className = "wrapped-race-row";

    const label = document.createElement("div");
    label.className = "wrapped-race-label";
    const link = spotifyLink(artist.artistUri);
    const cachedName = artist.artistUri && artistNameCache.get(artist.artistUri);
    const displayName = cachedName || "Artist #" + (i + 1);
    if (link) {
      const a = document.createElement("a");
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = displayName;
      if (artist.artistUri) a.dataset.artistUri = artist.artistUri;
      a.style.color = "inherit";
      a.style.textDecoration = "none";
      a.addEventListener("mouseenter", () => { a.style.color = "var(--accent)"; });
      a.addEventListener("mouseleave", () => { a.style.color = "inherit"; });
      label.appendChild(a);
    } else {
      label.textContent = displayName;
    }
    row.appendChild(label);

    const rankByMonth = new Map();
    if (artist.monthsStats) {
      for (const ms of artist.monthsStats) {
        rankByMonth.set(ms.month, ms.rank);
      }
    }

    for (const m of orderedMonths) {
      const cell = document.createElement("div");
      cell.className = "wrapped-race-cell";
      const rank = rankByMonth.get(m);
      if (rank != null) {
        cell.textContent = "#" + rank;
        if (rank === 1) cell.classList.add("wrapped-race-first");
      } else {
        cell.textContent = "\u2014";
      }
      row.appendChild(cell);
    }

    table.appendChild(row);
  });

  container.appendChild(table);
}
