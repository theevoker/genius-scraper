import json
import re
import time
import difflib
import requests

from bs4 import BeautifulSoup


# ============================================================
# CONFIGURATION
# ============================================================

INPUT_FILE = "names.txt"
OUTPUT_FILE = "genius_songs.json"

ACCESS_TOKEN = "tnBhXPdnXnD8Qk4kkgZrR46WnusWq3OVXQfMkK17eU5rdK0oPp4WiGDpSgY0SMo5"

SEARCH_URL = "https://genius.com/api/search/multi"
BASE_URL = "https://api.genius.com"

REQUEST_DELAY = 0.5


# ============================================================
# HEADERS
# ============================================================

GENIUS_API_HEADERS = {
    "Authorization": f"Bearer {ACCESS_TOKEN}"
}

WEB_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/153.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,"
        "application/xml;q=0.9,*/*;q=0.8"
    ),
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://genius.com/"
}


session = requests.Session()


# ============================================================
# HEBREW NORMALIZATION
# ============================================================

def hebrew_only(text):
    """
    Keep only Hebrew letters.
    """

    return re.sub(
        r"[^א-ת]",
        "",
        text
    )


# ============================================================
# ARTIST SIMILARITY
# ============================================================

def artist_similarity(requested_name, artist_name):
    """
    Compare names after removing everything except
    Hebrew letters.

    Example:

        מאיר אריאל
        Meir Ariel / מאיר אריאל

    becomes:

        מאיראריאל
        מאיראריאל
    """

    requested = hebrew_only(
        requested_name
    )

    candidate = hebrew_only(
        artist_name
    )

    if not requested or not candidate:
        return 0.0

    # Exact match
    if requested == candidate:
        return 1.0

    # Sequence similarity
    return difflib.SequenceMatcher(
        None,
        requested,
        candidate
    ).ratio()


# ============================================================
# SEARCH GENIUS WEBSITE
# ============================================================

def search_artists(query):

    print("    Searching Genius website...")

    params = {
        "q": query
    }

    response = session.get(
        SEARCH_URL,
        params=params,
        headers=WEB_HEADERS,
        timeout=20
    )

    print(
        f"    Search HTTP status: "
        f"{response.status_code}"
    )

    response.raise_for_status()

    data = response.json()

    sections = (
        data
        .get("response", {})
        .get("sections", [])
    )

    artists = []

    # ========================================================
    # Find Artists section
    # ========================================================

    for section in sections:

        if section.get("type") != "artist":
            continue

        for hit in section.get("hits", []):

            artist = hit.get(
                "result",
                {}
            )

            if not artist:
                continue

            artist_id = artist.get("id")
            name = artist.get("name")
            url = artist.get("url")

            if not artist_id or not name:
                continue

            artists.append({
                "id": artist_id,
                "name": name,
                "url": url,
                "alternate_names": artist.get(
                    "alternate_names",
                    []
                )
            })

        break

    return artists


# ============================================================
# CHOOSE BEST ARTIST
# ============================================================

def choose_artist(
    requested_name,
    artists
):

    if not artists:
        return None

    print("\n    Artist candidates:")

    scored = []

    for artist in artists:

        # Check main name
        score = artist_similarity(
            requested_name,
            artist["name"]
        )

        # Also check alternate names
        for alternate in artist.get(
            "alternate_names",
            []
        ):

            alternate_score = artist_similarity(
                requested_name,
                alternate
            )

            if alternate_score > score:
                score = alternate_score

        scored.append(
            (score, artist)
        )

        print(
            f"      {artist['name']}"
            f" -> similarity: {score:.3f}"
        )

    # Highest similarity first
    scored.sort(
        key=lambda x: x[0],
        reverse=True
    )

    best_score, best_artist = scored[0]

    print(
        f"\n    Selected: "
        f"{best_artist['name']}"
    )

    print(
        f"    Similarity: "
        f"{best_score:.3f}"
    )

    return best_artist


# ============================================================
# GET ARTIST ID FROM URL
# ============================================================

def get_artist_from_url(url):

    print(
        f"    Scraping artist URL:\n"
        f"    {url}"
    )

    response = session.get(
        url,
        headers=WEB_HEADERS,
        timeout=20
    )

    print(
        f"    Artist page HTTP status: "
        f"{response.status_code}"
    )

    response.raise_for_status()

    soup = BeautifulSoup(
        response.text,
        "html.parser"
    )

    # --------------------------------------------------------
    # Look for canonical URL
    # --------------------------------------------------------

    canonical = soup.find(
        "link",
        rel="canonical"
    )

    if canonical:

        canonical_url = canonical.get(
            "href",
            ""
        )

        if "/artists/" in canonical_url:

            return canonical_url

    return url


# ============================================================
# GET ALL SONGS FOR ARTIST
# ============================================================

def get_all_songs(artist_id):

    songs = []
    seen = set()

    page = 1

    while True:

        url = (
            f"{BASE_URL}/artists/"
            f"{artist_id}/songs"
        )

        params = {
            "page": page,
            "per_page": 50,
            "sort": "title"
        }

        response = requests.get(
            url,
            headers=GENIUS_API_HEADERS,
            params=params,
            timeout=15
        )

        response.raise_for_status()

        data = response.json()["response"]

        for song in data["songs"]:

            title = song["title"]

            if title in seen:
                continue

            seen.add(title)

            songs.append({
                "id": song["id"],
                "title": title,
                "url": song["url"]
            })

        next_page = data.get(
            "next_page"
        )

        if next_page is None:
            break

        page = next_page

        time.sleep(0.2)

    return songs


# ============================================================
# MAIN
# ============================================================

def main():

    # --------------------------------------------------------
    # Read names.txt
    # --------------------------------------------------------

    with open(
        INPUT_FILE,
        "r",
        encoding="utf-8"
    ) as f:

        names = [
            line.strip()
            for line in f
            if line.strip()
        ]

    print(
        f"Found {len(names)} artists.\n"
    )

    results = {}

    # --------------------------------------------------------
    # Process artists
    # --------------------------------------------------------

    for number, requested_name in enumerate(
        names,
        start=1
    ):

        print("\n" + "=" * 70)

        print(
            f"[{number}/{len(names)}] "
            f"{requested_name}"
        )

        print("=" * 70)

        try:

            # =================================================
            # Search website
            # =================================================

            artists = search_artists(
                requested_name
            )

            if not artists:

                print(
                    "    No artist results found."
                )

                results[requested_name] = []

                continue

            # =================================================
            # Select best artist
            # =================================================

            artist = choose_artist(
                requested_name,
                artists
            )

            if artist is None:

                results[requested_name] = []

                continue

            # =================================================
            # Scrape selected artist URL
            # =================================================

            artist_url = artist["url"]

            get_artist_from_url(
                artist_url
            )

            # The website result already gives us
            # the Genius artist ID.
            artist_id = artist["id"]

            print(
                f"    Genius artist ID: "
                f"{artist_id}"
            )

            # =================================================
            # Get all songs using Genius API
            # =================================================

            print(
                "    Getting artist songs..."
            )

            songs = get_all_songs(
                artist_id
            )

            results[requested_name] = songs

            print(
                f"    Found {len(songs)} songs."
            )

        except requests.RequestException as e:

            print(
                f"    Request error: {e}"
            )

            results[requested_name] = []

        except Exception as e:

            print(
                f"    Error: {e}"
            )

            results[requested_name] = []

        time.sleep(
            REQUEST_DELAY
        )

    # --------------------------------------------------------
    # Save everything
    # --------------------------------------------------------

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            results,
            f,
            ensure_ascii=False,
            indent=2
        )

    print("\n" + "=" * 70)
    print("DONE")
    print("=" * 70)

    print(
        f"Saved to: {OUTPUT_FILE}"
    )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    main()