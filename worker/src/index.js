const ALLOWED_ORIGINS = [
  "https://danielhdzzz.github.io",
  "http://localhost:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8080",
];

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.find((o) => origin.startsWith(o));
  return {
    "Access-Control-Allow-Origin": allowed || ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}

function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "0:00";
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const sec = parseInt(m[3] || "0", 10);
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(min)}:${pad(sec)}` : `${min}:${pad(sec)}`;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/search") {
      return jsonResponse({ error: "Not found" }, 404, request);
    }

    const query = url.searchParams.get("q");
    if (!query) {
      return jsonResponse({ error: "Missing q parameter" }, 400, request);
    }

    const apiKey = env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: "API key not configured" }, 500, request);
    }

    try {
      // Search for videos
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("maxResults", "5");
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("key", apiKey);

      const searchRes = await fetch(searchUrl.toString());
      if (!searchRes.ok) {
        const err = await searchRes.text();
        return jsonResponse({ error: "YouTube search failed" }, searchRes.status, request);
      }

      const searchData = await searchRes.json();
      const items = searchData.items || [];
      if (items.length === 0) {
        return jsonResponse({ results: [] }, 200, request);
      }

      // Get video durations
      const videoIds = items.map((item) => item.id.videoId).join(",");
      const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      videosUrl.searchParams.set("part", "contentDetails");
      videosUrl.searchParams.set("id", videoIds);
      videosUrl.searchParams.set("key", apiKey);

      const videosRes = await fetch(videosUrl.toString());
      const videosData = videosRes.ok ? await videosRes.json() : { items: [] };
      const durationMap = {};
      for (const v of videosData.items || []) {
        durationMap[v.id] = parseDuration(v.contentDetails.duration);
      }

      const results = items.map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        duration: durationMap[item.id.videoId] || "",
      }));

      return jsonResponse({ results }, 200, request);
    } catch (e) {
      return jsonResponse({ error: "Internal error" }, 500, request);
    }
  },
};
