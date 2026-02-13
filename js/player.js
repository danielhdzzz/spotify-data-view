const WORKER_URL = "https://youtube-search-proxy.danielhdzzz.workers.dev";

const $ = {
  overlay: document.getElementById("player-overlay"),
  title: document.getElementById("player-title"),
  embed: document.getElementById("player-embed"),
  loading: document.getElementById("player-loading"),
  error: document.getElementById("player-error"),
  results: document.getElementById("player-results"),
};

let activeVideoId = null;

function decodeHtml(html) {
  const el = document.createElement("textarea");
  el.innerHTML = html;
  return el.value;
}

export function openPlayer(track) {
  $.overlay.style.display = "";
  $.title.textContent = track.artist + " \u2014 " + track.name;
  $.embed.innerHTML = "";
  $.results.innerHTML = "";
  $.error.style.display = "none";
  $.loading.style.display = "";
  activeVideoId = null;

  const query = track.artist + " " + track.name;
  fetch(WORKER_URL + "/search?q=" + encodeURIComponent(query))
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => {
      $.loading.style.display = "none";
      if (data.error) {
        showError(data.error);
        return;
      }
      if (!data.results || data.results.length === 0) {
        showError("No YouTube results found for this track.");
        return;
      }
      playVideo(data.results[0].videoId);
      renderResults(data.results);
    })
    .catch(() => {
      $.loading.style.display = "none";
      showError("Could not search YouTube. Try again later.");
    });
}

export function closePlayer() {
  $.embed.innerHTML = "";
  $.results.innerHTML = "";
  $.loading.style.display = "none";
  $.error.style.display = "none";
  activeVideoId = null;
}

function showError(msg) {
  $.error.textContent = msg;
  $.error.style.display = "";
}

function playVideo(videoId) {
  activeVideoId = videoId;
  $.embed.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.src =
    "https://www.youtube.com/embed/" +
    videoId +
    "?autoplay=1&rel=0";
  iframe.allow = "autoplay; encrypted-media";
  iframe.allowFullscreen = true;
  $.embed.appendChild(iframe);
  highlightActive(videoId);
}

function renderResults(results) {
  $.results.innerHTML = "";
  for (const r of results) {
    const row = document.createElement("div");
    row.className = "player-result";
    row.dataset.id = r.videoId;

    const thumb = document.createElement("img");
    thumb.className = "player-result-thumb";
    thumb.src = r.thumbnail;
    thumb.alt = "";
    thumb.loading = "lazy";

    const info = document.createElement("div");
    info.className = "player-result-info";

    const title = document.createElement("div");
    title.className = "player-result-title";
    title.textContent = decodeHtml(r.title);

    const meta = document.createElement("div");
    meta.className = "player-result-meta";
    meta.textContent = r.channel + (r.duration ? " \u00b7 " + r.duration : "");

    info.appendChild(title);
    info.appendChild(meta);
    row.appendChild(thumb);
    row.appendChild(info);

    row.addEventListener("click", () => {
      playVideo(r.videoId);
    });

    $.results.appendChild(row);
  }
  highlightActive(activeVideoId);
}

function highlightActive(videoId) {
  for (const el of $.results.querySelectorAll(".player-result")) {
    el.classList.toggle("active", el.dataset.id === videoId);
  }
}
