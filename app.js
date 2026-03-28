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

// Sound (帝国 - Imperial Alert)
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
alertSound.load();

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

// --- ADMIN NOTIFICATIONS & HISTORY ---
function startAdminNotifications() {
    const logDiv = document.getElementById('admin-purchase-log');
    
    db.collection('logs').orderBy('timestamp', 'desc').limit(20).onSnapshot(snap => {
        logDiv.innerHTML = '';
        
        snap.forEach((doc, index) => {
            const data = doc.data();
            const time = data.timestamp ? data.timestamp.toDate().toLocaleTimeString() : "...";
            const name = data.userName || "Pilot";
            const item = data.itemName || "Item"; // <--- ANZEIGE DES ITEMS
            const price = data.price || 0;

            logDiv.innerHTML += `
                <div style="padding: 8px; border-bottom: 1px solid #333; color: #00d2ff; background: rgba(0,210,255,0.05); margin-bottom: 5px; border-left: 2px solid var(--imp-blue);">
                    <span style="color: #666; font-size: 0.7em;">[${time}]</span><br>
                    <strong>${name}</strong> kaufte:<br>
                    <span style="color: #fff;">${item}</span> (${price} 💎)
                </div>`;
            
            // Sound-Logik bei neuem Eintrag
            if (index === 0 && snap.docChanges().some(c => c.type === "added")) {
                const change = snap.docChanges().find(c => c.type === "added");
                if (change && change.doc.data().timestamp) {
                    const diff = new Date().getTime() - change.doc.data().timestamp.toDate().getTime();
                    if (diff < 5000) {
                        alertSound.play().catch(() => {});
                    }
                }
            }
        });
    });
}

// --- KAUF FUNKTION ---
async function buyItem(itemId, price) {
    const userRef = db.collection('user').doc(auth.currentUser.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();
    
    // NEU: Hol dir den Namen des Items aus der Shop-Sammlung
    let itemName = "Unbekanntes Item";
    try {
        const itemSnap = await db.collection('shop').doc(itemId).get();
        if (itemSnap.exists) {
            itemName = itemSnap.data().name;
        }
    } catch (e) {
        console.log("Item-Name konnte nicht geladen werden");
    }

    if (userData.crystals >= price) {
        if(confirm(`Möchtest du "${itemName}" für ${price} 💎 kaufen?`)) {
            try {
                // 1. Kristalle beim User abziehen
                await userRef.update({ 
                    crystals: userData.crystals - price 
                });

                // 2. Log für den Admin schreiben (jetzt mit itemName!)
                await db.collection('logs').add({
                    userName: userData.username,
                    itemName: itemName, // <--- DAS HAT GEFEHLT
                    price: price,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                alert("Kauf erfolgreich bestätigt!");
            } catch (e) {
                alert("Fehler bei der Transaktion: " + e.message);
            }
        }
    } else {
        alert("Zugriff verweigert: Zu wenig Kristalle!");
    }
}

// --- ADMIN TOOLS ---
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
                startAdminNotifications();
            }
        }
    });
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