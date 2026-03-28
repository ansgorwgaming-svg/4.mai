// 1. Initialisierung
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

// 2. Login
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

// 3. Auth Status
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
    }
});

// 4. Shop Management
async function addShopItem() {
    const n = document.getElementById('item-name').value;
    const p = Number(document.getElementById('item-price').value);
    const g = document.getElementById('game-select').value;
    if(!n || !p) return alert("Fehlende Daten!");
    try {
        await db.collection('shop').add({ name: n, price: p, game: g });
        alert("Item hinzugefügt!");
        document.getElementById('item-name').value = "";
        document.getElementById('item-price').value = "";
    } catch (e) { alert("Fehler: " + e.message); }
}

// --- Logik Funktionen ---

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

function loadAdminUserList() {
    db.collection('user').orderBy('username').onSnapshot(snap => {
        const list = document.getElementById('user-crystal-list');
        if(!list) return;
        list.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            if(u.role !== 'admin') {
                list.innerHTML += `<div class="user-monitor-row"><span>${u.username}</span><span class="u-cry">${u.crystals || 0} 💎</span></div>`;
            }
        });
    });
}

async function addCrystalCustom() {
    const name = document.getElementById('target-user').value.trim();
    const amount = Number(document.getElementById('crystal-amount').value);
    const snap = await db.collection('user').where('username', '==', name).get();
    if(snap.empty) return alert("User nicht gefunden!");
    snap.forEach(async d => {
        const data = d.data();
        const newC = (data.crystals || 0) + amount;
        const newP = amount > 0 ? (data.totalPoints || 0) + amount : (data.totalPoints || 0);
        await db.collection('user').doc(d.id).update({ crystals: newC, totalPoints: newP });
    });
    document.getElementById('crystal-amount').value = "";
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
            div.innerHTML += `<div class="card" style="margin:0; padding:15px; border-color:var(--imp-blue);">
                <h4 style="margin:0 0 10px 0;">${item.name}</h4>
                <p style="color:var(--imp-blue); margin:0 0 10px 0;">${item.price} 💎</p>
                <button class="imperial-btn" style="padding:5px;" onclick="buyItem('${doc.id}', ${item.price})">BUY</button>
            </div>`;
        });
    });
}

async function buyItem(id, price) {
    const userRef = db.collection('user').doc(auth.currentUser.uid);
    const snap = await userRef.get();
    if (snap.data().crystals >= price) {
        if(confirm("Bestätigen?")) {
            await userRef.update({ crystals: snap.data().crystals - price });
            alert("Erfolg!");
        }
    } else { alert("Nicht genug Kristalle!"); }
}

function loadLeaderboard() {
    db.collection('user').orderBy('totalPoints', 'desc').onSnapshot(snap => {
        const list = document.getElementById('leaderboard');
        list.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            list.innerHTML += `<li style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #222;">
                <span>${u.username}</span><span>${u.totalPoints || 0} PX</span></li>`;
        });
    });
}

async function updateGameFromDropdown() {
    const val = document.getElementById('game-select').value;
    await db.collection('settings').doc('gameState').set({ name: val });
}

function logout() { auth.signOut(); }