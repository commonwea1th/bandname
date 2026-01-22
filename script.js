import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, query, orderBy, limit } 
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
                <button onclick="changeVote('${band.id}', ${band.score + 1})">▲</button>
                <span class="score">${band.score}</span>
                <button onclick="changeVote('${band.id}', ${band.score - 1})">▼</button>
            </div>
        `;
        list.appendChild(li);
    });
};

// 4. DATABASE ACTIONS
window.addBand = async () => {
    const input = document.getElementById('bandInput');
    if (!input.value.trim()) return;
    await addDoc(bandsCol, {
        name: input.value,
        score: 0,
        lastVotedAt: Date.now()
    });
    input.value = "";
};

window.changeVote = async (id, newScore) => {
    const bandRef = doc(db, 'bands', id);
    await updateDoc(bandRef, { 
        score: newScore,
        lastVotedAt: Date.now() 
    });
};
