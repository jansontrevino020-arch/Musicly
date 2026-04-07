let albums = [];
let sliderDragging = false;
let player = null;
let db = null;

let currentAlbumIndex = null;
let currentTrackIndex = null;

const DB_NAME = "musicly-db";
const DB_VERSION = 1;
const TRACK_STORE = "tracks";
const META_STORE = "meta";

window.addEventListener("load", () => {
    player = document.getElementById("player");
    setupSliderEvents();
    setupPlayerEvents();
    document.getElementById("playButton").onclick = togglePlayPause;
    document.getElementById("backToAlbums").onclick = backToAlbums;
    setupDropzone();
    initDB().then(loadLibraryFromDB);
});

/* ---------- IndexedDB ---------- */

function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(TRACK_STORE)) {
                db.createObjectStore(TRACK_STORE, { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE, { keyPath: "key" });
            }
        };
        req.onsuccess = e => {
            db = e.target.result;
            resolve();
        };
        req.onerror = e => reject(e.target.error);
    });
}

function saveLibraryToDB(albums) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([TRACK_STORE, META_STORE], "readwrite");
        const trackStore = tx.objectStore(TRACK_STORE);
        const metaStore = tx.objectStore(META_STORE);

        trackStore.clear();
        metaStore.clear();

        metaStore.put({
            key: "albums",
            albums: albums.map(album => ({
                name: album.name,
                coverId: album.coverId || null,
                tracks: album.tracks.map(t => ({
                    id: t.id,
                    name: t.name
                }))
            }))
        });

        albums.forEach(album => {
            if (album.cover) {
                trackStore.put({
                    id: album.coverId,
                    name: album.name + " (cover)",
                    blob: album.cover
                });
            }

            album.tracks.forEach(track => {
                trackStore.put({
                    id: track.id,
                    name: track.name,
                    blob: track.blob
                });
            });
        });

        tx.oncomplete = resolve;
        tx.onerror = e => reject(e.target.error);
    });
}

function loadLibraryFromDB() {
    return new Promise((resolve, reject) => {
        const tx = db.transaction([TRACK_STORE, META_STORE], "readonly");
        const trackStore = tx.objectStore(TRACK_STORE);
        const metaStore = tx.objectStore(META_STORE);

        const metaReq = metaStore.get("albums");

        metaReq.onsuccess = () => {
            const meta = metaReq.result;

            if (!meta) {
                renderAlbumGrid();
                return resolve();
            }

            const tracksReq = trackStore.getAll();

            tracksReq.onsuccess = () => {
                const trackMap = {};
                tracksReq.result.forEach(t => trackMap[t.id] = t);

                albums = meta.albums.map(a => ({
                    name: a.name,
                    cover: a.coverId ? trackMap[a.coverId]?.blob : null,
                    coverId: a.coverId,
                    tracks: a.tracks.map(t => ({
                        id: t.id,
                        name: t.name,
                        blob: trackMap[t.id]?.blob
                    })).filter(t => t.blob)
                }));

                renderAlbumGrid();
                resolve();
            };
        };

        metaReq.onerror = e => reject(e.target.error);
    });
}

/* ---------- UI ---------- */

function renderAlbumGrid() {
    const grid = document.getElementById("albumGrid");
    grid.innerHTML = "";

    albums.forEach((album, i) => {
        const card = document.createElement("div");
        card.className = "albumCard";

        const img = document.createElement("img");
        img.src = album.cover ? URL.createObjectURL(album.cover) : "";

        const name = document.createElement("div");
        name.className = "albumName";
        name.textContent = album.name;

        card.appendChild(img);
        card.appendChild(name);
        card.onclick = () => openTrackList(i);

        grid.appendChild(card);
    });
}

function openTrackList(albumIndex) {
    const album = albums[albumIndex];
    const inner = document.getElementById("trackListInner");

    inner.innerHTML = "";

    document.getElementById("trackListAlbumArt").src =
        album.cover ? URL.createObjectURL(album.cover) : "";

    document.getElementById("trackListAlbumName").textContent = album.name;

    album.tracks.forEach((track, i) => {
        const item = document.createElement("div");
        item.className = "trackItem";
        item.textContent = track.name;

        item.onclick = () => {
            currentAlbumIndex = albumIndex;
            currentTrackIndex = i;
            playTrack(albumIndex, i);
        };

        inner.appendChild(item);
    });

    document.getElementById("albumGrid").classList.add("hidden");
    document.getElementById("trackList").classList.remove("hidden");
}

function backToAlbums() {
    document.getElementById("trackList").classList.add("hidden");
    document.getElementById("albumGrid").classList.remove("hidden");
}

/* ---------- Player ---------- */

function playTrack(albumIndex, trackIndex) {
    const album = albums[albumIndex];
    const track = album.tracks[trackIndex];

    if (player.src) {
        URL.revokeObjectURL(player.src);
    }

    const url = URL.createObjectURL(track.blob);
    player.src = url;
    player.play();

    document.getElementById("nowPlaying").innerText = "Now Playing: " + track.name;
}

function togglePlayPause() {
    if (!player.src) return;
    player.paused ? player.play() : player.pause();
}

function playNextTrack() {
    const album = albums[currentAlbumIndex];
    if (!album || currentTrackIndex >= album.tracks.length - 1) return false;

    currentTrackIndex++;
    playTrack(currentAlbumIndex, currentTrackIndex);
    return true;
}

/* ---------- Events ---------- */

function setupPlayerEvents() {
    player.addEventListener("ended", () => {
        if (!playNextTrack()) {
            player.src = "";
            document.getElementById("nowPlaying").innerText = "Now Playing: (none)";
        }
    });

    player.addEventListener("timeupdate", () => {
        if (sliderDragging || !player.duration) return;

        document.getElementById("progressSlider").value =
            (player.currentTime / player.duration) * 100;
    });
}

function setupSliderEvents() {
    const slider = document.getElementById("progressSlider");

    slider.addEventListener("input", () => {
        if (!player.duration) return;

        const newTime = (slider.value / 100) * player.duration;
        player.currentTime = newTime;
    });
}

/* ---------- Dropzone ---------- */

function setupDropzone() {
    const dropzone = document.getElementById("dropzone");

    dropzone.addEventListener("dragover", e => e.preventDefault());

    dropzone.addEventListener("drop", async e => {
        e.preventDefault();

        const file = e.dataTransfer.files[0];
        if (!file || !file.name.endsWith(".zip")) return;

        const zip = await JSZip.loadAsync(file);
        const albumMap = {};
        let id = 0;

        for (const path in zip.files) {
            const entry = zip.files[path];
            if (entry.dir) continue;

            if (path.endsWith(".mp3")) {
                const parts = path.split("/");
                const albumName = parts[parts.length - 2] || "Unknown";

                if (!albumMap[albumName]) {
                    albumMap[albumName] = { tracks: [] };
                }

                const blob = await entry.async("blob");

                albumMap[albumName].tracks.push({
                    id: "track-" + id++,
                    name: parts.pop(),
                    blob
                });
            }
        }

        albums = Object.keys(albumMap).map(name => ({
            name,
            tracks: albumMap[name].tracks
        }));

        await saveLibraryToDB(albums);
        renderAlbumGrid();
    });
}

/* ---------- PWA ---------- */

// Service Worker
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/Musicly/sw.js")
            .then(() => console.log("Service Worker Registered"))
            .catch(err => console.log("SW error:", err));
    });
}
