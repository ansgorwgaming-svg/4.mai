// 1. INITIALISIERUNG
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

// Sound für Alert
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// --- AUTH ---
async function login() {
    const userVal = document.getElementById('username').value.trim().toLowerCase();
    const passInput = document.getElementById('password').value;
    const email = `${userVal}@event.local`;
    try { await auth.signInWithEmailAndPassword(email, passInput); } 
    catch (e) { document.getElementById('login-error').innerText = "ACCESS DENIED"; }
}

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

// --- USER & ADMIN LOGIK ---
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
                startAdminNotifications(); // Startet Log & Sound
            }
        }
    });
}

// History & Alert für Admin
function startAdminNotifications() {
    const logDiv = document.getElementById('admin-purchase-log');
    db.collection('logs').orderBy('timestamp', 'desc').limit(15).onSnapshot(snap => {
        logDiv.innerHTML = '';
        snap.forEach((doc, index) => {
            const log = doc.data();
            const time = log.timestamp ? log.timestamp.toDate().toLocaleTimeString() : "...";
            logDiv.innerHTML += `<div style="padding:5px; border-bottom:1px solid #333; color:var(--imp-blue);">
                [${time}] ${log.userName}: -${log.price} 💎</div>`;
            
            // Neuer Kauf Sound & Alert
            if (index === 0 && snap.docChanges().some(c => c.type === "added")) {
                const change = snap.docChanges().find(c => c.type === "added");
                if (change && change.doc.data().timestamp) {
                    const diff = new Date().getTime() - change.doc.data().timestamp.toDate().getTime();
                    if (diff < 8000) {
                        alertSound.play().catch(() => {});
                        console.log("ALERT: Neuer Kauf!");
                    }
                }
            }
        });
    });
}

// --- SHOP KAUFEN ---
async function buyItem(itemId, price) {
    const userRef = db.collection('user').doc(auth.currentUser.uid);
    const snap = await userRef.get();
    const cur = snap.data().crystals || 0;
    
    if (cur >= price) {
        if(confirm(`Kaufen für ${price} 💎?`)) {
            await userRef.update({ crystals: cur - price });
            await db.collection('logs').add({
                userName: snap.data().username,
                price: price,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("Erfolgreich!");
        }
    } else { alert("Zu wenig Kristalle!"); }
}

// --- ADMIN LISTS ---
function loadAdminUserList() {
    db.collection('user').orderBy('username').onSnapshot(snap => {
        const list = document.getElementById('user-crystal-list');
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
    snap.forEach(async d => {
        const newC = (d.data().crystals || 0) + amount;
        const newP = amount > 0 ? (d.data().totalPoints || 0) + amount : (d.data().totalPoints || 0);
        await db.collection('user').doc(d.id).update({ crystals: newC, totalPoints: newP });
    });
}

// --- SHOP & MISC ---
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
            div.innerHTML += `<div class="card" style="margin:0; padding:10px; border-color:var(--imp-blue);">
                <h4 style="margin:0;">${item.name}</h4><p style="color:var(--imp-blue)">${item.price} 💎</p>
                <button class="imperial-btn" style="width:100%" onclick="buyItem('${doc.id}', ${item.price})">BUY</button>
            </div>`;
        });
    });
}

function loadLeaderboard() {
    db.collection('user').orderBy('totalPoints', 'desc').onSnapshot(snap => {
        const list = document.getElementById('leaderboard');
        list.innerHTML = '';
        snap.forEach(doc => {
            list.innerHTML += `<li style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #222;">
                <span>${doc.data().username}</span><span>${doc.data().totalPoints || 0} PX</span></li>`;
        });
    });
}

async function updateGameFromDropdown() {
    await db.collection('settings').doc('gameState').set({ name: document.getElementById('game-select').value });
}

async function addShopItem() {
    const n = document.getElementById('item-name').value;
    const p = Number(document.getElementById('item-price').value);
    const g = document.getElementById('game-select').value;
    if(n && p) await db.collection('shop').add({ name: n, price: p, game: g });
}

function logout() { auth.signOut(); }