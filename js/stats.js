// ── Stats computation & rendering ──

export function computeStats(state) {
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
      addTrack(t.name, t.artist, t.album, t.uri, t.local);
    }
  }

  const artists = Array.from(artistMap.values())
    .sort((a, b) => b.count - a.count);
  const albums = Array.from(albumMap.values())
    .sort((a, b) => b.count - a.count);

  return {
    uniqueTracks: uniqueCount,
    uniqueArtists: artists.length,
    uniqueAlbums: albums.length,
    localTracks: localCount,
    localPct: uniqueCount ? ((localCount / uniqueCount) * 100).toFixed(1) : "0",
    allArtists: artists,
    allAlbums: albums,
  };
}

export function renderStatsPage(container, stats, page, callbacks) {
  container.innerHTML = "";

  // Summary cards
  const cards = document.createElement("div");
  cards.className = "stats-cards";

  cards.appendChild(makeCard("Unique Tracks", stats.uniqueTracks.toLocaleString()));
  cards.appendChild(makeCard("Artists", stats.uniqueArtists.toLocaleString()));
  cards.appendChild(makeCard("Albums", stats.uniqueAlbums.toLocaleString()));
  cards.appendChild(
    makeCard("Local Tracks", stats.localTracks.toLocaleString() + " (" + stats.localPct + "%)")
  );

  container.appendChild(cards);

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
