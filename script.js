import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, query, orderBy, limit, increment } 
       from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyCoJPLDAluXlo85CkAkzuXxpmI2_jHeKAM",
  authDomain: "bandname-12d05.firebaseapp.com",
  projectId: "bandname-12d05",
  storageBucket: "bandname-12d05.firebasestorage.app",
  messagingSenderId: "858428387490",
  appId: "1:858428387490:web:7beaf712b4f84b51b2a7fb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const bandsCol = collection(db, 'bands');

let allBands = [];

// -- Configuration: inactive threshold (days)
const INACTIVE_DAYS = 30;
const INACTIVE_MS = INACTIVE_DAYS * 24 * 60 * 60 * 1000;

// Utility: normalize various timestamp shapes to a number (ms since epoch)
function getLatestTimestamp(band) {
    // Prefer lastVotedAt, fall back to createdAt, otherwise 0
    const candidate = band?.lastVotedAt ?? band?.createdAt ?? 0;
    if (!candidate) return 0;

    // If it's a Firestore Timestamp object (has toMillis), use that
    if (candidate?.toMillis && typeof candidate.toMillis === 'function') {
        return candidate.toMillis();
    }
    // If it's already a number (ms)
    if (typeof candidate === 'number') return candidate;
    // If stored as string, try to parse
    const n = Number(candidate);
    return isNaN(n) ? 0 : n;
}

function isBandActive(band) {
    const ts = getLatestTimestamp(band);
    return ts >= (Date.now() - INACTIVE_MS);
}

// Ensure the dumpster container exists in the DOM (create it if missing)
function ensureDumpsterBox() {
    let dumpster = document.getElementById('dumpsterBox');
    if (dumpster) return dumpster;

    dumpster = document.createElement('div');
    dumpster.id = 'dumpsterBox';
    dumpster.style.marginTop = '20px';
    dumpster.style.padding = '12px';
    dumpster.style.borderRadius = '8px';
    dumpster.style.background = 'linear-gradient(90deg, #2b2b2b, #1b1b1b)';
    dumpster.style.color = '#fff';
    dumpster.style.border = '2px solid #ff6b00';
    dumpster.style.boxShadow = '0 6px 18px rgba(255,107,0,0.15)';
    dumpster.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
            <div style="font-size:22px;">🔥🗑️ Burning Dumpster</div>
            <small style="color:#ffbf80;">(Bands not voted on in the last ${INACTIVE_DAYS} days)</small>
        </div>
        <ul id="dumpsterList" style="list-style:none; padding:0; margin:0; max-height:220px; overflow:auto;"></ul>
    `;

    // Append after the main bandList if present, otherwise append to body
    const bandList = document.getElementById('bandList');
    if (bandList && bandList.parentNode) {
        bandList.parentNode.appendChild(dumpster);
    } else {
        document.body.appendChild(dumpster);
    }

    return dumpster;
}

// Render the dumpster list (inactive bands)
function renderDumpster(bands) {
    const dumpster = ensureDumpsterBox();
    const dumpsterList = document.getElementById('dumpsterList');
    dumpsterList.innerHTML = '';

    if (!bands.length) {
        const li = document.createElement('li');
        li.style.opacity = '0.7';
        li.textContent = 'No neglected bands — the dumpster is empty.';
        dumpsterList.appendChild(li);
        return;
    }

    bands.forEach(band => {
        const lastTs = getLatestTimestamp(band);
        const daysAgo = lastTs ? Math.floor((Date.now() - lastTs) / (24 * 60 * 60 * 1000)) : 'unknown';
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.padding = '6px 8px';
        li.style.borderBottom = '1px solid rgba(255,255,255,0.04)';
        li.innerHTML = `
            <span style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:16px;">🗑️</span>
                <strong style="color:#ffb86b;">${band.name}</strong>
            </span>
            <small style="color:#ccc;">last voted: ${lastTs ? daysAgo + ' day(s) ago' : 'never'}</small>
        `;
        dumpsterList.appendChild(li);
    });
}

// 1. LISTEN FOR ALL BANDS (Ranked by Score)
const q = query(bandsCol, orderBy("score", "desc"));
onSnapshot(q, (snapshot) => {
    allBands = [];
    snapshot.forEach((docSnap) => {
        allBands.push({ id: docSnap.id, ...docSnap.data() });
    });
    filterBands(); // Initial render
});

// 2. LISTEN FOR TRENDING (Last 3 voted on in 24 hours)
const trendingQuery = query(bandsCol, orderBy("lastVotedAt", "desc"), limit(3));
onSnapshot(trendingQuery, (snapshot) => {
    const trendingList = document.getElementById('trendingList');
    if (!trendingList) return;
    trendingList.innerHTML = '';
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
snapshot.forEach(docSnap => {
        const band = docSnap.data();
        const last = getLatestTimestamp(band);
        if (last > dayAgo) {
            const li = document.createElement('li');
            li.innerHTML = `🔥 ${band.name} <small style="color:gray; margin-left:10px;">just voted</small>`;
            trendingList.appendChild(li);
        }
    });
});

// 3. SEARCH & RENDER LOGIC
window.filterBands = () => {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const list = document.getElementById('bandList');
    if (!list) return;
    list.innerHTML = '';

    // Bands matching the search (active candidates)
    const filtered = allBands.filter(b => b.name.toLowerCase().includes(searchTerm));

    // Determine active vs inactive using lastVotedAt/createdAt; inactive => goes to dumpster
    const activeFiltered = filtered.filter(isBandActive);

    // For the dumpster, show all inactive bands regardless of search term so they always "drop off"
    const dumpsterBands = allBands.filter(b => !isBandActive(b));

    // Render active list (ranked, with badges)
    activeFiltered.forEach((band, index) => {
        let badge = "";
        let topClass = "";
        if (index === 0 && searchTerm === "") { badge = "🥇"; topClass = "first-place"; }
        else if (index === 1 && searchTerm === "") { badge = "🥈"; }
        else if (index === 2 && searchTerm === "") { badge = "🥉"; }

        const li = document.createElement('li');
        if (topClass) li.classList.add(topClass);
        li.innerHTML = `
            <span>${badge} ${band.name}</span>
            <div class="vote-btns">
                <button onclick="changeVote('${band.id}', 1)">▲</button>
                <span class="score">${band.score}</span>
                <button onclick="changeVote('${band.id}', -1)">▼</button>
            </div>
        `;
        list.appendChild(li);
    });

    // Render dumpster (inactive bands)
    renderDumpster(dumpsterBands);
};

// --- UPDATED VOTING LIMIT LOGIC ---
// New policy: allow only 1 positive vote per band per day, and up to 10 positive votes per day total.
// NOTE: Only positive votes (delta === 1) count toward these limits.

// Returns true if the user can perform the vote (doesn't change storage)
function canUserVote(bandId, delta) {
    const today = new Date().toISOString().slice(0,10); // YYYY-MM-DD
    const voteData = JSON.parse(localStorage.getItem('user_votes')) || { date: today, bands: {}, total: 0 };

    // If it's a new day, allow voting (client-side data will be reset by recordUserVote when needed)
    if (voteData.date !== today) {
        return true; // no votes yet today
    }

    // Only enforce limits for positive votes
    if (delta > 0) {
        const bandCount = voteData.bands[bandId] || 0;
        if (bandCount >= 1) {
            alert("You've already voted for this band today. You can only vote once per band per day.");
            return false;
        }
        const total = voteData.total || 0;
        if (total >= 10) {
            alert("You've reached your daily limit of 10 votes. Come back tomorrow!");
            return false;
        }
    }
    return true;
}

// Record a successful vote locally (called AFTER DB update succeeds)
function recordUserVote(bandId, delta) {
    // Only record positive votes
    if (delta <= 0) return;

    const today = new Date().toISOString().slice(0,10);
    let voteData = JSON.parse(localStorage.getItem('user_votes')) || { date: today, bands: {}, total: 0 };

    // Reset if it's a new day
    if (voteData.date !== today) {
        voteData = { date: today, bands: {}, total: 0 };
    }

    voteData.bands[bandId] = (voteData.bands[bandId] || 0) + 1;
    voteData.total = (voteData.total || 0) + 1;
    localStorage.setItem('user_votes', JSON.stringify(voteData));
}

// --- UPDATED DATABASE ACTIONS ---
// now takes (id, delta) where delta is 1 or -1
window.changeVote = async (id, delta) => {
    // Only enforce the vote limits for positive votes
    if (!canUserVote(id, delta)) return;

    const bandRef = doc(db, 'bands', id);
    try {
        // Use atomic increment to avoid race conditions
        await updateDoc(bandRef, { 
            score: increment(delta),
            lastVotedAt: Date.now() 
        });
        // Only record the positive vote locally AFTER successful DB update
        recordUserVote(id, delta);
    } catch (error) {
        console.error("Error updating vote: ", error);
        alert("There was a problem submitting your vote. Please try again.");
    }
};

window.addBand = async () => {
    const input = document.getElementById('bandInput');
    if (!input.value.trim()) return;

    const rawName = input.value.trim();
    // Normalize: trim, collapse internal whitespace, lowercase for comparison
    const normalized = rawName.replace(/\s+/g, ' ').toLowerCase();

    // Check existing bands for duplicates using normalizedName if available,
    // otherwise compare normalized forms of stored name.
    const isDuplicate = allBands.some(b => {
        if (b.normalizedName) return b.normalizedName === normalized;
        if (typeof b.name === 'string') return b.name.replace(/\s+/g, ' ').trim().toLowerCase() === normalized;
        return false;
    });

    if (isDuplicate) {
        alert("That band already exists. Please add a different name.");
        return;
    }

    try {
        await addDoc(bandsCol, {
            name: rawName,
            normalizedName: normalized, // store to help future duplicate checks / server-side rules
            score: 0,
            lastVotedAt: Date.now(),
            createdAt: Date.now()
        });
        input.value = "";
    } catch (error) {
        console.error("Error adding band: ", error);
        alert("There was a problem adding the band. Please try again.");
    }
};
