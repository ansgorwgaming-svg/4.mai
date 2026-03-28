// 1. Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDgHmywbvd_65tHQGdcoYIQFqoDue35mjw",
  authDomain: "may-the-4th-75cdd.firebaseapp.com",
  databaseURL: "https://may-the-4th-75cdd-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "may-the-4th-75cdd",
  storageBucket: "may-the-4th-75cdd.firebasestorage.app",
  messagingSenderId: "1060090227380",
  appId: "1:1060090227380:web:0b863e96fcf44c725245e1"
};

// 2. Initialisierung
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- LOGIN FUNKTION ---
async function login() {
    const userVal = document.getElementById('username').value.trim().toLowerCase();
    const passInput = document.getElementById('password').value;
    const email = `${userVal}@event.local`;

    try {
        await auth.signInWithEmailAndPassword(email, passInput);
    } catch (error) {
        console.error("Login Fehler:", error.code);
        document.getElementById('login-error').innerText = "Fehler: " + error.code;
    }
}

// --- AUTH STATUS ÜBERWACHUNG ---
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        loadUserData(user.uid);
        listenToGameAndShop();
        loadLeaderboard();
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('admin-panel').classList.add('hidden');
    }
});

// --- DATEN LADEN ---
function loadUserData(uid) {
    db.collection('user').doc(uid).onSnapshot(doc => {
        if (doc.exists) {
            const d = doc.data();
            document.getElementById('user-display').innerText = `Hallo, ${d.username}`;
            document.getElementById('crystal-count').innerText = d.crystals || 0;
            document.getElementById('total-points').innerText = d.totalPoints || 0;
            
            if (d.role === 'admin') {
                document.getElementById('admin-panel').classList.remove('hidden');
            }
        }
    });
}

function listenToGameAndShop() {
    db.collection('settings').doc('gameState').onSnapshot(doc => {
        if(doc.exists) {
            const game = doc.data().name;
            document.getElementById('current-game-name').innerText = game;
            loadShop(game);
        }
    });
}

function loadShop(gameName) {
    db.collection('shop').where('game', '==', gameName).onSnapshot(snap => {
        const div = document.getElementById('shop-items');
        div.innerHTML = '';
        snap.forEach(doc => {
            const item = doc.data();
            div.innerHTML += `
                <div class="stat-card">
                    <h4>${item.name}</h4>
                    <p>${item.price} 💎</p>
                    <button onclick="buyItem('${doc.id}', ${item.price})">Kaufen</button>
                </div>`;
        });
    });
}

async function buyItem(id, price) {
    const userRef = db.collection('user').doc(auth.currentUser.uid);
    const snap = await userRef.get();
    const currentCrystals = snap.data().crystals || 0;

    if (currentCrystals >= price) {
        if(confirm("Möchtest du dieses Item kaufen?")) {
            await userRef.update({ crystals: currentCrystals - price });
            alert("Kauf erfolgreich!");
        }
    } else {
        alert("Du hast nicht genug Kristalle!");
    }
}

function loadLeaderboard() {
    db.collection('user').orderBy('totalPoints', 'desc').limit(10).onSnapshot(snap => {
        const list = document.getElementById('leaderboard');
        list.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            list.innerHTML += `<li><strong>${u.username}</strong>: ${u.totalPoints || 0} Pkt</li>`;
        });
    });
}

// --- ADMIN FUNKTIONEN ---
async function updateGameFromDropdown() {
    const val = document.getElementById('game-select').value;
    await db.collection('settings').doc('gameState').set({ name: val });
    alert("Spiel auf " + val + " geändert!");
}

async function addShopItem() {
    const n = document.getElementById('item-name').value;
    const p = Number(document.getElementById('item-price').value);
    const g = document.getElementById('game-select').value;

    if(!n || !p) return alert("Name und Preis fehlen!");

    await db.collection('shop').add({ name: n, price: p, game: g });
    alert("Item hinzugefügt!");
    document.getElementById('item-name').value = "";
    document.getElementById('item-price').value = "";
}

async function addCrystal(amt) {
    const name = document.getElementById('target-user').value.trim();
    if(!name) return alert("Spielername fehlt!");

    const snap = await db.collection('user').where('username', '==', name).get();
    
    if(snap.empty) return alert("Spieler nicht gefunden!");

    snap.forEach(async d => {
        const newC = (d.data().crystals || 0) + amt;
        const newP = amt > 0 ? (d.data().totalPoints || 0) + amt : (d.data().totalPoints || 0);
        await db.collection('user').doc(d.id).update({ crystals: newC, totalPoints: newP });
    });
}

function logout() { auth.signOut(); }