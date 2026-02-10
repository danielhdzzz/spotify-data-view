# Spotify Library Browser

A simple browser for your exported Spotify data.

## Setup

1. [Request your Spotify data](https://www.spotify.com/account/privacy/) and place the exported files into a `data/` folder next to `index.html`.

2. Start a local server:

```
cd ~/Desktop/Spotify_frontend
python3 -m http.server 8888
```

3. Open http://localhost:8888 in your browser.

> **Note:** You can't open `index.html` directly as a file — browsers block JSON loading from `file://` URLs for security reasons. The local server is needed to work around this.

## Keyboard Shortcuts

- `Cmd+K` — Focus playlist search
- `Cmd+F` — Focus track search
- `Esc` — Clear and unfocus active search
