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

// Sound Setup
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
alertSound.load();

// Audio-Aktivierung durch User-Klick (Browser Pflicht!)
document.addEventListener('click', function initAudio() {
    const btn = document.getElementById('enable-audio');
    if (btn) {
        btn.onclick = () => {
            alertSound.play().then(() => {
                alertSound.pause();
                alertSound.currentTime = 0;
                btn.innerText = "🔊 SOUNDS AKTIVIERT";
                btn.style.borderColor = "lime";
            });
        };
    }
}, { once: false });

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
    
    db.collection('logs').orderBy('timestamp', 'desc').limit(15).onSnapshot(snap => {
        logDiv.innerHTML = '';
        
        snap.docChanges().forEach(change => {
            if (change.type === "added") {
                const newLog = change.doc.data();
                
                // Prüfen, ob der Log-Eintrag wirklich NEU ist (nicht beim ersten Laden der Liste)
                if (newLog.timestamp) {
                    const diff = new Date().getTime() - newLog.timestamp.toDate().getTime();
                    if (diff < 8000) { // Eintrag jünger als 8 Sek
                        
                        // 1. SOUND ABSPIELEN
                        alertSound.play().catch(e => console.log("Audio noch blockiert"));
                        
                        // 2. POPUP ANZEIGEN
                        alert(`🚨 KAUF-ALARM!\nUser: ${newLog.userName}\nItem: ${newLog.itemName}\nPreis: ${newLog.price} 💎`);
                    }
                }
            }
        });

        // Liste rendern
        snap.forEach(doc => {
            const data = doc.data();
            const time = data.timestamp ? data.timestamp.toDate().toLocaleTimeString() : "...";
            logDiv.innerHTML += `
                <div style="padding: 8px; border-bottom: 1px solid #333; color: #00d2ff; background: rgba(0,210,255,0.1); margin-bottom: 5px;">
                    <span style="color: #888; font-size: 0.7em;">[${time}]</span><br>
                    <strong>${data.userName}</strong>: ${data.itemName}<br>
                    <span style="color: gold;">-${data.price} 💎</span>
                </div>`;
        });
    });
}

// --- KAUF FUNKTION (FÜR USER) ---
async function buyItem(itemId, price) {
    const userRef = db.collection('user').doc(auth.currentUser.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if (userData.crystals < price) {
        alert("Zu wenig Kristalle!");
        return;
    }

    let itemName = "Unbekanntes Item";
    const itemSnap = await db.collection('shop').doc(itemId).get();
    if (itemSnap.exists) itemName = itemSnap.data().name;

    if(confirm(`"${itemName}" für ${price} 💎 kaufen?`)) {
        try {
            await userRef.update({ crystals: userData.crystals - price });
            
            await db.collection('logs').add({
                userName: userData.username,
                itemName: itemName,
                price: price,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert("Kauf abgeschlossen!");
        } catch (e) { alert("Fehler: " + e.message); }
    }
}

// --- ADMIN LISTS ---
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