// 1. INITIALISIERUNG (Bleibt gleich)
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

// Sound-Objekt erstellen (Imperial Alert Sound)
const alertSound = new Audio('https://search-production.s3.amazonaws.com/uploads/original/8f8b8e0b968a3f8c8d8b8e0b968a3f8c/notification.mp3');

// --- AUTH STATUS ---
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

// --- USER DATEN & ADMIN CHECK ---
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
                startAdminNotifications(); // <--- STARTET DEN KAUF-MONITOR
            }
        }
    });
}

// --- KAUF-FUNKTION (FÜR USER) ---
async function buyItem(itemId, price) {
    const userRef = db.collection('user').doc(auth.currentUser.uid);
    const snap = await userRef.get();
    const userData = snap.data();
    
    if (userData.crystals >= price) {
        if(confirm(`Bestätige Kauf für ${price} 💎?`)) {
            // 1. Kristalle abziehen
            await userRef.update({ crystals: userData.crystals - price });

            // 2. Kauf in Firebase 'logs' speichern (Damit der Admin es sieht)
            await db.collection('logs').add({
                msg: `${userData.username} hat ein Item gekauft!`,
                price: price,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("Kauf abgeschlossen.");
        }
    } else {
        alert("Nicht genug Kristalle!");
    }
}

// --- ADMIN NOTIFICATIONS (FÜR ADMIN) ---
function startAdminNotifications() {
    // Der Admin hört auf neue Einträge in der 'logs' Collection
    db.collection('logs').orderBy('timestamp', 'desc').limit(1).onSnapshot(snap => {
        snap.docChanges().forEach(change => {
            if (change.type === "added") {
                const log = change.doc.data();
                
                // Prüfen, ob der Log-Eintrag ganz neu ist (nicht von gestern)
                if (log.timestamp) {
                    const logTime = log.timestamp.toDate().getTime();
                    const now = new Date().getTime();
                    
                    if (now - logTime < 5000) { // Nur wenn jünger als 5 Sekunden
                        // SOUND ABSPIELEN
                        alertSound.play().catch(e => console.log("Sound geblockt, klicke einmal auf die Seite."));
                        
                        // POPUP ANZEIGEN
                        alert(`🚨 KAUF-ALARM: ${log.msg} (${log.price} Kristalle)`);
                    }
                }
            }
        });
    });
}

// --- DER REST DER FUNKTIONEN (login, loadAdminUserList, etc.) ---
async function login() {
    const userVal = document.getElementById('username').value.trim().toLowerCase();
    const passInput = document.getElementById('password').value;
    const email = `${userVal}@event.local`;
    try { await auth.signInWithEmailAndPassword(email, passInput); } 
    catch (e) { document.getElementById('login-error').innerText = "ACCESS DENIED"; }
}

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
                <h4>${item.name}</h4><p>${item.price} 💎</p>
                <button class="imperial-btn" onclick="buyItem('${doc.id}', ${item.price})">BUY</button>
            </div>`;
        });
    });
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
    if(n && p) await db.collection('shop').add({ name: n, price: p, game: g });
}

function logout() { auth.signOut(); }