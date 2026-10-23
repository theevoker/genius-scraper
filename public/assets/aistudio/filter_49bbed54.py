
import json
import os
import re
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse


HOST = "0.0.0.0"
PORT = 8000

SOURCE_FILE = "genius_songs.json"
SERVER_FILTER_FILE = "server_filter.json"

FILE_LOCK = threading.Lock()


def load_json(filename):
    with open(filename, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(filename, data):
    temp_file = filename + ".tmp"

    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())

    os.replace(temp_file, filename)


def clean_hebrew(text):
    if not isinstance(text, str):
        return ""

    return re.sub(r"[^ א-ת]", "", text).strip()


def clean_source_data(data):
    """
    Cleans genius_songs.json without modifying the original file.

    - Removes non-Hebrew characters and spaces from artist/song names.
    - Merges artists whose cleaned names become identical.
    - Removes duplicate songs.
    - Preserves song metadata such as id and url.
    """

    result = {}

    if not isinstance(data, dict):
        return result

    for artist, songs in data.items():
        clean_artist = clean_hebrew(artist)

        if not clean_artist:
            continue

        if not isinstance(songs, list):
            continue

        if clean_artist not in result:
            result[clean_artist] = []

        existing_ids = set()
        existing_titles = set()

        for existing_song in result[clean_artist]:
            if not isinstance(existing_song, dict):
                continue

            if existing_song.get("id") is not None:
                existing_ids.add(str(existing_song["id"]))

            title = clean_hebrew(existing_song.get("title", ""))
            if title:
                existing_titles.add(title)

        for song in songs:
            if not isinstance(song, dict):
                continue

            title = clean_hebrew(song.get("title", ""))

            if not title:
                continue

            song_id = song.get("id")

            if song_id is not None:
                song_id = str(song_id)

                if song_id in existing_ids:
                    continue

            if title in existing_titles:
                continue

            new_song = dict(song)
            new_song["title"] = title

            result[clean_artist].append(new_song)

            if song_id is not None:
                existing_ids.add(song_id)

            existing_titles.add(title)

    return result


def song_key(artist, song):
    """
    Creates a stable key for matching songs between
    genius_songs.json and server_filter.json.
    """

    artist_key = clean_hebrew(artist)

    song_id = song.get("id")

    if song_id is not None:
        return (
            artist_key,
            "id",
            str(song_id)
        )

    title = clean_hebrew(song.get("title", ""))

    return (
        artist_key,
        "title",
        title
    )


def create_initial_server_filter(original_data):
    """
    Creates a completely new server_filter.json.

    Every song starts disabled.
    """

    result = {}

    for artist, songs in original_data.items():
        result[artist] = []

        for song in songs:
            new_song = dict(song)
            new_song["enabled"] = False
            result[artist].append(new_song)

    return result


def normalize_server_filter(original_data, existing_filter):
    """
    Updates an existing server_filter.json without resetting
    existing enabled/disabled states.

    Existing songs keep their current state.

    New songs are added with enabled=False.

    New artists are added with all songs disabled.
    """

    result = {}

    # Build lookup of existing songs.
    existing_lookup = {}

    if isinstance(existing_filter, dict):
        for artist, songs in existing_filter.items():
            if not isinstance(songs, list):
                continue

            for song in songs:
                if not isinstance(song, dict):
                    continue

                key = song_key(artist, song)
                existing_lookup[key] = song

    # Rebuild the structure according to genius_songs.json.
    for artist, songs in original_data.items():
        result[artist] = []

        for source_song in songs:
            key = song_key(artist, source_song)

            if key in existing_lookup:
                # Preserve the existing song and its enabled state.
                existing_song = dict(existing_lookup[key])

                existing_song["title"] = source_song.get(
                    "title",
                    existing_song.get("title", "")
                )

                # Keep the current state exactly as it is.
                if "enabled" not in existing_song:
                    existing_song["enabled"] = False

                result[artist].append(existing_song)

            else:
                # New song: disabled by default.
                new_song = dict(source_song)
                new_song["enabled"] = False

                result[artist].append(new_song)

    return result


class ServerState:
    def __init__(self):
        self.server_filter = {}

    def load(self):
        if not os.path.exists(SOURCE_FILE):
            raise FileNotFoundError(
                f"Could not find {SOURCE_FILE}"
            )

        source_data = load_json(SOURCE_FILE)
        source_data = clean_source_data(source_data)

        if os.path.exists(SERVER_FILTER_FILE):
            print(f"Loading existing {SERVER_FILTER_FILE}...")

            existing_filter = load_json(SERVER_FILTER_FILE)

            self.server_filter = normalize_server_filter(
                source_data,
                existing_filter
            )

            print(
                f"Loaded existing states from {SERVER_FILTER_FILE}"
            )

        else:
            print(
                f"{SERVER_FILTER_FILE} does not exist."
            )

            print(
                "Creating a new filter with everything OFF..."
            )

            self.server_filter = create_initial_server_filter(
                source_data
            )

        # Save the normalized structure.
        # This does NOT reset existing enabled states.
        save_json(
            SERVER_FILTER_FILE,
            self.server_filter
        )

    def get_data(self):
        with FILE_LOCK:
            return self.server_filter

    def set_song(self, artist, index, enabled):
        with FILE_LOCK:
            if artist not in self.server_filter:
                raise ValueError("Artist not found")

            songs = self.server_filter[artist]

            if index < 0 or index >= len(songs):
                raise ValueError("Song index out of range")

            # Explicitly set the requested state.
            # This is NOT a toggle.
            songs[index]["enabled"] = enabled

            save_json(
                SERVER_FILTER_FILE,
                self.server_filter
            )

            return dict(songs[index])


STATE = ServerState()


HTML = r"""
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>מסנן שירים</title>

<style>

* {
    box-sizing: border-box;
}

html,
body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

body {
    font-family: Arial, sans-serif;
    background: #f1f3f6;
    color: #222;
}

header {
    height: 60px;
    background: #20242a;
    color: white;

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: 0 18px;

    font-size: 20px;
    font-weight: bold;
}

.status {
    font-size: 13px;
    font-weight: normal;
    color: #9be59b;
}

.app {
    display: flex;
    height: calc(100vh - 60px);
    width: 100%;
}

/* =========================
   ARTISTS
   ========================= */

.artists-panel {
    width: 290px;
    min-width: 290px;

    background: white;
    border-left: 1px solid #ddd;

    display: flex;
    flex-direction: column;

    padding: 12px;
}

.search {
    width: 100%;
    height: 42px;

    border: 1px solid #ccc;
    border-radius: 8px;

    padding: 0 12px;

    font-size: 16px;
    outline: none;

    margin-bottom: 10px;
}

.search:focus {
    border-color: #777;
}

.artists-list {
    flex: 1;
    overflow-y: auto;
}

.artist {
    width: 100%;

    padding: 11px 10px;
    margin-bottom: 5px;

    border-radius: 8px;

    cursor: pointer;

    background: #f4f5f7;

    transition: background 0.1s;
}

.artist:hover {
    background: #e7e9ed;
}

.artist.selected {
    background: #d9dde3;
    font-weight: bold;
}

.artist-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.artist-count {
    font-size: 12px;
    color: #777;
    margin-top: 3px;
}

/* =========================
   SONGS
   ========================= */

.songs-panel {
    flex: 1;

    min-width: 0;

    display: flex;
    flex-direction: column;

    padding: 14px;
}

.song-header {
    display: flex;
    align-items: center;
    gap: 10px;

    margin-bottom: 12px;
}

.song-header h2 {
    margin: 0;

    font-size: 21px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.song-search {
    margin-bottom: 12px;
}

.songs-list {
    flex: 1;

    overflow-y: auto;

    display: flex;
    flex-direction: column;

    gap: 7px;
}

.song {
    width: 100%;

    min-height: 48px;

    padding: 10px 12px;

    border-radius: 8px;

    display: flex;
    align-items: center;
    justify-content: space-between;

    gap: 10px;

    cursor: pointer;

    background: white;

    border: 1px solid #ddd;

    transition:
        background 0.1s,
        opacity 0.1s;
}

.song:hover {
    background: #f7f7f7;
}

.song.off {
    background: #d1d1d1;
    color: #777;
}

.song-title {
    min-width: 0;

    overflow-wrap: anywhere;
}

.badge {
    flex-shrink: 0;

    font-size: 11px;
    font-weight: bold;

    padding: 4px 7px;

    border-radius: 5px;

    background: #222;
    color: white;
}

.song.off .badge {
    background: #888;
}

/* =========================
   EMPTY
   ========================= */

.empty {
    text-align: center;
    color: #777;
    padding: 30px 10px;
}

/* =========================
   PORTRAIT
   ========================= */

@media (max-width: 650px) {

    html,
    body {
        overflow: hidden;
    }

    header {
        height: 52px;
        padding: 0 12px;
        font-size: 18px;
    }

    .app {
        height: calc(100vh - 52px);

        display: flex;
        flex-direction: column;
    }

    .artists-panel {
        width: 100%;
        min-width: 0;
        height: auto;

        padding: 8px;

        border-left: none;
        border-bottom: 1px solid #ddd;
    }

    .artists-panel .search {
        margin-bottom: 7px;
    }

    .artists-list {
        display: flex;

        flex-direction: row;

        gap: 6px;

        overflow-x: auto;
        overflow-y: hidden;

        flex: none;

        padding-bottom: 3px;
    }

    .artist {
        width: auto;
        min-width: 125px;

        flex-shrink: 0;

        margin: 0;

        padding: 9px 10px;
    }

    .artist-name {
        max-width: 125px;
    }

    .songs-panel {
        width: 100%;
        min-height: 0;

        padding: 9px;
    }

    .song-header {
        margin-bottom: 8px;
    }

    .song-header h2 {
        font-size: 19px;
    }

    .song-search {
        margin-bottom: 8px;
    }

    .song {
        min-height: 50px;
        padding: 10px;
    }
}

@media (max-width: 380px) {

    header {
        font-size: 16px;
    }

    .artist {
        min-width: 110px;
    }

    .artist-name {
        max-width: 110px;
    }

    .song {
        font-size: 15px;
    }
}

@media (max-width: 330px) {

    .artist {
        min-width: 100px;
    }

    .artist-name {
        max-width: 100px;
    }
}

</style>
</head>

<body>

<header>
    <div>מסנן שירים</div>
    <div class="status" id="status">מתחבר...</div>
</header>

<div class="app">

    <div class="artists-panel">

        <input
            id="artistSearch"
            class="search"
            type="text"
            placeholder="חיפוש אמן..."
            autocomplete="off"
        >

        <div
            id="artistsList"
            class="artists-list"
        ></div>

    </div>

    <div class="songs-panel">

        <div class="song-header">
            <h2 id="selectedArtist">בחר אמן</h2>
        </div>

        <input
            id="songSearch"
            class="search song-search"
            type="text"
            placeholder="חיפוש שיר..."
            autocomplete="off"
        >

        <div
            id="songsList"
            class="songs-list"
        ></div>

    </div>

</div>

<script>

let data = {};
let selectedArtist = null;

const artistSearch =
    document.getElementById("artistSearch");

const songSearch =
    document.getElementById("songSearch");

const artistsList =
    document.getElementById("artistsList");

const songsList =
    document.getElementById("songsList");

const selectedArtistElement =
    document.getElementById("selectedArtist");

const statusElement =
    document.getElementById("status");


async function loadData() {

    try {

        const response =
            await fetch(
                "/api/data?" + Date.now()
            );

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        data = await response.json();

        statusElement.textContent = "מחובר";

        renderArtists();

        if (selectedArtist !== null) {

            if (data[selectedArtist]) {
                renderSongs();
            } else {
                selectedArtist = null;
                renderSongs();
            }
        }

    } catch (error) {

        console.error(error);

        statusElement.textContent =
            "שגיאת חיבור";

    }
}


function renderArtists() {

    const query =
        artistSearch.value
            .trim()
            .toLowerCase();

    artistsList.innerHTML = "";

    const artists =
        Object.keys(data)
            .filter(
                artist =>
                    artist
                        .toLowerCase()
                        .includes(query)
            );

    for (const artist of artists) {

        const songs = data[artist] || [];

        const enabledCount =
            songs.filter(
                song => song.enabled
            ).length;

        const element =
            document.createElement("div");

        element.className = "artist";

        if (artist === selectedArtist) {
            element.classList.add("selected");
        }

        element.innerHTML = `
            <div class="artist-name">
                ${escapeHtml(artist)}
            </div>

            <div class="artist-count">
                ${enabledCount} / ${songs.length}
            </div>
        `;

        element.onclick = () => {

            selectedArtist = artist;

            songSearch.value = "";

            renderArtists();
            renderSongs();

            element.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center"
            });
        };

        artistsList.appendChild(element);
    }
}


function renderSongs() {

    songsList.innerHTML = "";

    if (!selectedArtist) {

        selectedArtistElement.textContent =
            "בחר אמן";

        songsList.innerHTML =
            '<div class="empty">בחר אמן</div>';

        return;
    }

    selectedArtistElement.textContent =
        selectedArtist;

    const songs =
        data[selectedArtist] || [];

    const query =
        songSearch.value
            .trim()
            .toLowerCase();

    const filteredSongs =
        songs
            .map(
                (song, index) => ({
                    song,
                    index
                })
            )
            .filter(
                item =>
                    item.song.title
                        .toLowerCase()
                        .includes(query)
            );

    if (filteredSongs.length === 0) {

        songsList.innerHTML =
            '<div class="empty">לא נמצאו שירים</div>';

        return;
    }

    for (const item of filteredSongs) {

        const song = item.song;
        const index = item.index;

        const element =
            document.createElement("div");

        element.className = "song";

        if (!song.enabled) {
            element.classList.add("off");
        }

        element.innerHTML = `
            <div class="song-title">
                ${escapeHtml(song.title)}
            </div>

            <div class="badge">
                ${song.enabled ? "ON" : "OFF"}
            </div>
        `;

        element.onclick = () => {

            setSongState(
                selectedArtist,
                index,
                !song.enabled
            );

        };

        songsList.appendChild(element);
    }
}


async function setSongState(
    artist,
    index,
    enabled
) {

    const value =
        enabled ? "true" : "false";

    try {

        const url =
            "/api/song"
            + "?artist="
            + encodeURIComponent(artist)
            + "&index="
            + encodeURIComponent(index)
            + "&enabled="
            + value;

        const response =
            await fetch(url);

        const result =
            await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Request failed"
            );
        }

        // Server is authoritative.
        data[artist][index] = result;

        renderArtists();
        renderSongs();

    } catch (error) {

        console.error(error);

        alert(
            "שגיאה בשמירת השינוי"
        );

        // Reload the server state.
        await loadData();
    }
}


function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent =
        String(value);

    return div.innerHTML;
}


artistSearch.addEventListener(
    "input",
    renderArtists
);

songSearch.addEventListener(
    "input",
    renderSongs
);


// Initial load.
loadData();


// Keep multiple devices synchronized.
setInterval(
    loadData,
    2000
);

</script>

</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):

    def send_json(self, data, status=200):

        body = json.dumps(
            data,
            ensure_ascii=False
        ).encode("utf-8")

        self.send_response(status)

        self.send_header(
            "Content-Type",
            "application/json; charset=utf-8"
        )

        self.send_header(
            "Content-Length",
            str(len(body))
        )

        self.send_header(
            "Cache-Control",
            "no-store"
        )

        self.end_headers()

        self.wfile.write(body)

    def do_GET(self):

        parsed = urlparse(self.path)

        if parsed.path == "/":

            body = HTML.encode("utf-8")

            self.send_response(200)

            self.send_header(
                "Content-Type",
                "text/html; charset=utf-8"
            )

            self.send_header(
                "Content-Length",
                str(len(body))
            )

            self.end_headers()

            self.wfile.write(body)

            return

        if parsed.path == "/api/data":

            self.send_json(
                STATE.get_data()
            )

            return

        if parsed.path == "/api/song":

            params = parse_qs(
                parsed.query
            )

            artist_values = params.get(
                "artist"
            )

            index_values = params.get(
                "index"
            )

            enabled_values = params.get(
                "enabled"
            )

            if not artist_values:
                self.send_json(
                    {"error": "Missing artist"},
                    400
                )
                return

            if not index_values:
                self.send_json(
                    {"error": "Missing index"},
                    400
                )
                return

            if not enabled_values:
                self.send_json(
                    {"error": "Missing enabled"},
                    400
                )
                return

            artist = artist_values[0]
            index_text = index_values[0]
            enabled_text = enabled_values[0].lower()

            if enabled_text not in (
                "true",
                "false"
            ):
                self.send_json(
                    {
                        "error":
                            "enabled must be true or false"
                    },
                    400
                )
                return

            try:
                index = int(index_text)
            except ValueError:
                self.send_json(
                    {"error": "Invalid index"},
                    400
                )
                return

            enabled = (
                enabled_text == "true"
            )

            try:

                song = STATE.set_song(
                    artist,
                    index,
                    enabled
                )

                self.send_json(song)

            except ValueError as error:

                self.send_json(
                    {"error": str(error)},
                    400
                )

            except Exception as error:

                self.send_json(
                    {
                        "error":
                            f"Server error: {error}"
                    },
                    500
                )

            return

        self.send_json(
            {"error": "Not found"},
            404
        )

    def log_message(self, format, *args):
        # Keep the console clean.
        pass


def main():

    print("=" * 60)
    print("Song Filter Server")
    print("=" * 60)

    STATE.load()

    server = ThreadingHTTPServer(
        (HOST, PORT),
        Handler
    )

    print()
    print(f"Server running on port {PORT}")
    print()
    print(
        f"Local:   http://127.0.0.1:{PORT}"
    )
    print(
        f"Network: http://<YOUR-PC-IP>:{PORT}"
    )
    print()
    print(
        f"Filter file: {SERVER_FILTER_FILE}"
    )
    print("=" * 60)

    webbrowser.open(
        f"http://127.0.0.1:{PORT}"
    )

    try:
        server.serve_forever()

    except KeyboardInterrupt:

        print("\nStopping server...")

    finally:

        server.server_close()


if __name__ == "__main__":
    main()
