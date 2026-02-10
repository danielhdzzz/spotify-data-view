# Spotify Library Browser

A simple browser for your exported Spotify data. All processing happens in your browser — your data never leaves your machine.

[Request your data](https://www.spotify.com/account/privacy/) from Spotify.

## Usage

There are two ways to use this:

### Online (upload)

Visit the hosted site and drop your Spotify export folder (or the JSON files inside it) onto the upload area. You can also click to select files manually. Your data is processed entirely in the browser and is never sent anywhere.

The trade-off: you'll need to re-upload each time you refresh the page.

### Local (persistent)

Clone the repo and place your exported JSON files into a `data/` folder next to `index.html`. The app detects the folder and loads your data automatically — no uploading, survives refreshes.

```
git clone <repo-url>
cd spotify-library-browser
# copy your Spotify export JSON files into data/
mkdir data
cp ~/Downloads/my_spotify_data/*.json data/
python3 -m http.server 8888
```

Then open http://localhost:8888.

> A local server is needed because browsers block file loading from `file://` URLs for security reasons.

## Keyboard Shortcuts

- `Cmd+K` — Focus playlist search
- `Cmd+F` — Focus track search
- `Esc` — Clear and unfocus active search
