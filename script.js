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
    trendingList.innerHTML = '';
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    snapshot.forEach(docSnap => {
        const band = docSnap.data();
        if (band.lastVotedAt > dayAgo) {
            const li = document.createElement('li');
            li.innerHTML = `🔥 ${band.name} <small style="color:gray; margin-left:10px;">just voted</small>`;
            trendingList.appendChild(li);
        }
    });
});

// 3. SEARCH & RENDER LOGIC
window.filterBands = () => {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const list = document.getElementById('bandList');
    list.innerHTML = '';

    const filtered = allBands.filter(b => b.name.toLowerCase().includes(searchTerm));

    filtered.forEach((band, index) => {
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
};

// --- UPDATED VOTING LIMIT LOGIC ---
// New policy: allow only 1 positive vote per band per day, and up to 10 positive votes per day total.
// NOTE: Only positive votes (delta === 1) count toward these limits. Negative votes are allowed but not tracked here.

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

    await addDoc(bandsCol, {
        name: input.value,
        score: 0,
        lastVotedAt: Date.now(),
        createdAt: Date.now()
    });
    input.value = "";
};
