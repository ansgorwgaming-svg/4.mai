// 1. Firebase Config (Bleibt gleich)
const firebaseConfig = {
    apiKey: "AIzaSyDgHmywbvd_65tHQGdcoYIQFqoDue35mjw",
    authDomain: "may-the-4th-75cdd.firebaseapp.com",
    databaseURL: "https://may-the-4th-75cdd-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "may-the-4th-75cdd",
    storageBucket: "may-the-4th-75cdd.firebasestorage.app",
    messagingSenderId: "1060090227380",
    appId: "1:1060090227380:web:0b863e96fcf44c725245e1"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- LOGIN ---
async function login() {
    const userVal = document.getElementById('username').value.trim().toLowerCase();
    const passInput = document.getElementById('password').value;
    const email = `${userVal}@event.local`;
    try { 
        await auth.signInWithEmailAndPassword(email, passInput); 
    } catch (e) { 
        document.getElementById('login-error').innerText = "ACCESS DENIED"; 
    }
}

// --- AUTH STATUS (FIXED) ---
auth.onAuthStateChanged(user => {
    if (user) {
        // User ist eingeloggt
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        loadUserData(user.uid);
        listenToGameAndShop();
        loadLeaderboard();
    } else {
        // User ist NICHT eingeloggt -> Zeige Login, statt Seite neu zu laden!
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('admin-panel').classList.add('hidden');
        document.getElementById('admin-sidebar').classList.add('hidden');
    }
});

// --- USER DATEN ---
function loadUserData(uid) {
    db.collection('user').doc(uid).onSnapshot(doc => {
        if (doc.exists) {
            const d = doc.data();
            document.getElementById('user-display').innerText = d.username.toUpperCase();
            document.getElementById('crystal-count').innerText = d.crystals || 0;
            document.getElementById('total-points').innerText = d.totalPoints || 0;
            
            if (d.role === 'admin') {
                document.getElementById('admin-panel').classList.remove('hidden');
                document.getElementById('admin-sidebar').classList.remove('hidden');
                loadAdminUserList(); 
            }
        }
    });
}

// --- ADMIN USER LISTE ---
function loadAdminUserList() {
    db.collection('user').orderBy('username').onSnapshot(snap => {
        const list = document.getElementById('user-crystal-list');
        if(!list) return; // Sicherheitscheck
        list.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            if(u.role !== 'admin') {
                list.innerHTML += `
                <div class="user-monitor-row">
                    <span class="u-name">${u.username}</span>
                    <span class="u-cry">${u.crystals || 0} 💎</span>
                </div>`;
            }
        });
    });
}

// --- KRISTALLE ÜBERWEISEN ---
async function addCrystalCustom() {
    const name = document.getElementById('target-user').value.trim();
    const amount = Number(document.getElementById('crystal-amount').value);
    
    if(!name || isNaN(amount)) return alert("Bitte Name und Zahl eingeben!");

    const snap = await db.collection('user').where('username', '==', name).get();
    if(snap.empty) return alert("User nicht gefunden!");

    snap.forEach(async d => {
        const data = d.data();
        const newC = (data.crystals || 0) + amount;
        // Punkte nur erhöhen, wenn Kristalle positiv sind
        const newP = amount > 0 ? (data.totalPoints || 0) + amount : (data.totalPoints || 0);
        
        await db.collection('user').doc(d.id).update({ 
            crystals: newC, 
            totalPoints: newP 
        });
    });
    document.getElementById('crystal-amount').value = "";
    document.getElementById('target-user').value = "";
}

// --- SHOP & GAME LOGIK ---
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
                <div class="stat-card shop-card">
                    <h4>${item.name}</h4>
                    <p>${item.price} 💎</p>
                    <button class="imperial-btn" onclick="buyItem('${doc.id}', ${item.price})">PURCHASE</button>
                </div>`;
        });
    });
}

async function buyItem(id, price) {
    const userRef = db.collection('user').doc(auth.currentUser.uid);
    const snap = await userRef.get();
    const cur = snap.data().crystals || 0;
    if (cur >= price) {
        if(confirm("Item kaufen?")) {
            await userRef.update({ crystals: cur - price });
            alert("Transaction complete.");
        }
    } else {
        alert("Not enough crystals!");
    }
}

function loadLeaderboard() {
    db.collection('user').orderBy('totalPoints', 'desc').onSnapshot(snap => {
        const list = document.getElementById('leaderboard');
        list.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            list.innerHTML += `<li><span>${u.username}</span> <span>${u.totalPoints || 0} PX</span></li>`;
        });
    });
}

async function updateGameFromDropdown() {
    const val = document.getElementById('game-select').value;
    await db.collection('settings').doc('gameState').set({ name: val });
}

async function addShopItem() {
    const n = document.getElementById('item-name').value;
    const p = Number(document.getElementById('item-price').value);
    const g = document.getElementById('game-select').value;
    if(n && p) {
        await db.collection('shop').add({ name: n, price: p, game: g });
        alert("Item added to armory!");
    }
}

function logout() { auth.signOut(); }