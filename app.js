let albums = [];
let sliderDragging = false;
let player = null;
let db = null;

const DB_NAME = "musicly-db";
const DB_VERSION = 1;
const TRACK_STORE = "tracks";
const META_STORE = "meta";

window.addEventListener("load", () => {
    player = document.getElementById("player");
    setupSliderEvents();
    setupPlayerEvents();
    document.getElementById("playButton").onclick = playSelected;
    document.getElementById("backToAlbums").onclick = backToAlbums;
    setupDropzone();
    initDB().then(loadLibraryFromDB);
});

/* ---------- IndexedDB setup ---------- */

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

        const meta = {
            key: "albums",
            albums: albums.map(album => ({
                name: album.name,
                coverId: album.coverId || null,
                tracks: album.tracks.map(t => ({
                    id: t.id,
                    name: t.name
                }))
            }))
        };

        metaStore.put(meta);

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

        tx.oncomplete = () => resolve();
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
                updateAlbumDropdown();
                resolve();
                return;
            }

            const albumsMeta = meta.albums;
            const tracksReq = trackStore.getAll();
            tracksReq.onsuccess = () => {
                const allTracks = tracksReq.result;
                const trackMap = {};
                allTracks.forEach(t => trackMap[t.id] = t);

                albums = albumsMeta.map(a => {
                    const coverBlob = a.coverId ? trackMap[a.coverId]?.blob || null : null;
                    return {
                        name: a.name,
                        cover: coverBlob,
                        coverId: a.coverId || null,
                        tracks: a.tracks.map(t => ({
                            id: t.id,
                            name: t.name,
                            blob: trackMap[t.id]?.blob || null
                        })).filter(t => t.blob)
                    };
                }).filter(a => a.tracks.length > 0);

                renderAlbumGrid();
                updateAlbumDropdown();
                resolve();
            };
            tracksReq.onerror = e => reject(e.target.error);
        };
        metaReq.onerror = e => reject(e.target.error);
    });
}

/* ---------- Album Grid UI ---------- */

function renderAlbumGrid() {
    const grid = document.getElementById("albumGrid");
    grid.innerHTML = "";

    albums.forEach((album, index) => {
        const card = document.createElement("div");
        card.className = "albumCard";

        const img = document.createElement("img");
        img.src = album.cover ? URL.createObjectURL(album.cover) : "";

        const name = document.createElement("div");
        name.className = "albumName";
        name.textContent = album.name;

        card.appendChild(img);
        card.appendChild(name);

        card.onclick = () => openTrackList(index);

        grid.appendChild(card);
    });
}

function openTrackList(albumIndex) {
    const grid = document.getElementById("albumGrid");
    const list = document.getElementById("trackList");
    const inner = document.getElementById("trackListInner");

    inner.innerHTML = "";
    const album = albums[albumIndex];

    album.tracks.forEach((track, i) => {
        const item = document.createElement("div");
        item.className = "trackItem";
        item.textContent = track.name;

        item.onclick = () => {
            document.getElementById("albumDropdown").value = albumIndex;
            document.getElementById("trackDropdown").value = i;
            playSelected();
        };

        inner.appendChild(item);
    });

    // Fade transition
    grid.classList.add("fade-out");
    setTimeout(() => {
        grid.classList.add("hidden");
        grid.classList.remove("fade-out");

        list.classList.remove("hidden");
        list.classList.add("fade-in");

        setTimeout(() => list.classList.remove("fade-in"), 250);
    }, 250);
}

function backToAlbums() {
    const grid = document.getElementById("albumGrid");
    const list = document.getElementById("trackList");

    list.classList.add("fade-out");
    setTimeout(() => {
        list.classList.add("hidden");
        list.classList.remove("fade-out");

        grid.classList.remove("hidden");
        grid.classList.add("fade-in");

        setTimeout(() => grid.classList.remove("fade-in"), 250);
    }, 250);
}

/* ---------- Hidden dropdown logic ---------- */

function updateAlbumDropdown() {
    const dropdown = document.getElementById("albumDropdown");
    dropdown.innerHTML = "";

    if (albums.length === 0) {
        addOption(dropdown, "", "(no albums found)");
        updateTrackDropdown();
        updateAlbumArt(null);
        return;
    }

    albums.forEach((album, i) => {
        addOption(dropdown, i, album.name);
    });

    dropdown.onchange = updateTrackDropdown;
    updateTrackDropdown();
}

function updateTrackDropdown() {
    const albumIndex = document.getElementById("albumDropdown").value;
    const trackDropdown = document.getElementById("trackDropdown");
    trackDropdown.innerHTML = "";

    const album = albums[albumIndex];

    updateAlbumArt(album || null);

    if (albumIndex === "" || !album) {
        addOption(trackDropdown, "", "(no tracks)");
        return;
    }

    album.tracks.forEach((track, i) => {
        addOption(trackDropdown, i, track.name);
    });
}

function updateAlbumArt(album) {
    const albumArt = document.getElementById("albumArt");
    if (album && album.cover) {
        albumArt.src = URL.createObjectURL(album.cover);
    } else {
        albumArt.src = "";
    }
}

function addOption(select, value, text) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.text = text;
    select.appendChild(opt);
}

/* ---------- Playback ---------- */

function playSelected() {
    const btn = document.getElementById("playButton");

    if (player.src) {
        if (player.paused) {
            player.play();
            btn.textContent = "Pause";
        } else {
            player.pause();
            btn.textContent = "Play";
        }
        return;
    }

    const albumIndex = document.getElementById("albumDropdown").value;
    const trackIndex = document.getElementById("trackDropdown").value;

    if (albumIndex === "" || trackIndex === "") {
        alert("Select an album and a track.");
        return;
    }

    const album = albums[albumIndex];
    const track = album.tracks[trackIndex];

    const url = URL.createObjectURL(track.blob);
    player.src = url;
    player.play();

    btn.textContent = "Pause";
    document.getElementById("nowPlaying").innerText = "Now Playing: " + track.name;

    updateAlbumArt(album);
}

function playNextTrack() {
    const albumIndex = parseInt(document.getElementById("albumDropdown").value);
    const trackIndex = parseInt(document.getElementById("trackDropdown").value);

    const album = albums[albumIndex];
    if (!album) return false;

    if (trackIndex >= album.tracks.length - 1) {
        return false;
    }

    const nextIndex = trackIndex + 1;
    document.getElementById("trackDropdown").value = nextIndex;

    const nextTrack = album.tracks[nextIndex];
    const url = URL.createObjectURL(nextTrack.blob);

    player.src = url;
    player.play();

    document.getElementById("playButton").textContent = "Pause";
    document.getElementById("nowPlaying").innerText = "Now Playing: " + nextTrack.name;

    updateAlbumArt(album);

    return true;
}

/* ---------- Audio + slider ---------- */

function setupPlayerEvents() {
    player.addEventListener("ended", () => {
        const btn = document.getElementById("playButton");

        const didAdvance = playNextTrack();

        if (!didAdvance) {
            player.pause();
            player.removeAttribute("src");
            player.load();

            btn.textContent = "Play";
            document.getElementById("nowPlaying").innerText = "Now Playing: (none)";
        }
    });

    player.addEventListener("timeupdate", () => {
        if (sliderDragging) return;
        if (!player.duration) return;

        const slider = document.getElementById("progressSlider");
        slider.value = (player.currentTime / player.duration) * 100;
    });
}

function setupSliderEvents() {
    const slider = document.getElementById("progressSlider");

    slider.addEventListener("mousedown", () => sliderDragging = true);
    slider.addEventListener("touchstart", () => sliderDragging = true);

    function finishDrag() {
        if (!player.duration) return;
        const newPos = (slider.value / 100) * player.duration;
        player.currentTime = newPos;
        sliderDragging = false;
    }

    slider.addEventListener("mouseup", finishDrag);
    slider.addEventListener("touchend", finishDrag);
}

/* ---------- ZIP import + album covers ---------- */

function setupDropzone() {
    const dropzone = document.getElementById("dropzone");
    const status = document.getElementById("status");

    dropzone.addEventListener("dragover", e => {
        e.preventDefault();
        dropzone.style.background = "rgba(178, 123, 255, 0.12)";
    });

    dropzone.addEventListener("dragleave", () => {
        dropzone.style.background = "rgba(178, 123, 255, 0.05)";
    });

    dropzone.addEventListener("drop", async e => {
        e.preventDefault();
        dropzone.style.background = "rgba(178, 123, 255, 0.05)";
        status.textContent = "";

        if (!navigator.onLine) {
            alert("Import must be done while online.");
            return;
        }

        const file = e.dataTransfer.files[0];
        if (!file || !file.name.toLowerCase().endsWith(".zip")) {
            alert("Please drop a .zip file containing your MusicVault.");
            return;
        }

        try {
            status.textContent = "Loading ZIP...";
            const zip = await JSZip.loadAsync(file);

            const albumMap = {};
            let trackIdCounter = 0;
            let coverIdCounter = 0;

            const entries = Object.keys(zip.files);
            for (const path of entries) {
                const entry = zip.files[path];
                if (entry.dir) continue;

                const lower = entry.name.toLowerCase();

                // Detect album cover
                if (
                    lower.endsWith("cover.jpg") ||
                    lower.endsWith("cover.png") ||
                    lower.endsWith("cover.jpeg") ||
                    lower.endsWith("cover.webp")
                ) {
                    const parts = entry.name.split("/");
                    const albumName = parts.length > 1 ? parts[parts.length - 2] : "Unknown Album";

                    const fileData = await entry.async("blob");

                    if (!albumMap[albumName]) albumMap[albumName] = { tracks: [] };
                    const coverId = "cover-" + (coverIdCounter++);

                    albumMap[albumName].cover = fileData;
                    albumMap[albumName].coverId = coverId;

                    continue;
                }

                // Audio files
                if (
                    lower.endsWith(".mp3") ||
                    lower.endsWith(".wav") ||
                    lower.endsWith(".ogg") ||
                    lower.endsWith(".flac") ||
                    lower.endsWith(".m4a")
                ) {
                    const parts = entry.name.split("/");
                    const albumName = parts.length > 1 ? parts[parts.length - 2] : "Unknown Album";
                    const trackName = parts[parts.length - 1];

                    if (!albumMap[albumName]) albumMap[albumName] = { tracks: [] };

                    const fileData = await entry.async("blob");

                    albumMap[albumName].tracks.push({
                        id: "track-" + (trackIdCounter++),
                        name: trackName,
                        blob: fileData
                    });
                }
            }

            albums = Object.keys(albumMap).map(name => ({
                name: name,
                cover: albumMap[name].cover || null,
                coverId: albumMap[name].coverId || null,
                tracks: albumMap[name].tracks
            }));

            await saveLibraryToDB(albums);

            status.textContent = "Vault saved for offline use.";
            renderAlbumGrid();
            updateAlbumDropdown();
        } catch (err) {
            console.error(err);
            alert("Failed to import ZIP.");
            status.textContent = "Import failed.";
        }
    });
}
