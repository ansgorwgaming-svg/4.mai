// ==========================================
// 1. INITIALISIERUNG & KONFIGURATION
// ==========================================
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

// Sound Setup (Imperial Alert)
const alertSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
alertSound.load();

/**
 * Aktiviert die Audio-Wiedergabe. 
 * Muss vom Admin über den Button in der HTML aufgerufen werden!
 */
function activateSystemSounds() {
    const btn = document.getElementById('enable-audio');
    alertSound.play().then(() => {
        // Kurz anspielen und stoppen, um den Kanal für den Browser zu öffnen
        alertSound.pause();
        alertSound.currentTime = 0;
        if(btn) {
            btn.innerText = "🔊 SOUNDS BEREIT";
            btn.style.borderColor = "lime";
            btn.style.color = "lime";
        }
        console.log("Audio-System vom Admin autorisiert.");
    }).catch(e => {
        console.error("Audio-Fehler:", e);
        alert("Klick bitte nochmal auf den Button!");
    });
}

// ==========================================
// 2. AUTHENTIFIZIERUNG & SESSION
// ==========================================
async function login() {
    const userVal = document.getElementById('username').value.trim().toLowerCase();
    const passInput = document.getElementById('password').value;
    const email = `${userVal}@event.local`;
    try { 
        await auth.signInWithEmailAndPassword(email, passInput); 
    } catch (e) { 
        document.getElementById('login-error').innerText = "ZUGRIFF VERWEIGERT: DATEN UNGÜLTIG"; 
    }
}

function logout() { 
    auth.signOut(); 
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

// ==========================================
// 3. ADMIN: MONITORING & NOTIFICATIONS
// ==========================================
function startAdminNotifications() {
    const logDiv = document.getElementById('admin-purchase-log');
    if (!logDiv) return;

    console.log("Admin-Monitor aktiv...");

    // Echtzeit-Listener für POPUPS und SOUND (Nur neue Dokumente)
    db.collection('logs').orderBy('timestamp', 'desc').limit(1).onSnapshot(snap => {
        snap.docChanges().forEach(change => {
            if (change.type === "added") {
                const newLog = change.doc.data();
                
                // Prüfen, ob der Log-Eintrag frisch ist (innerhalb der letzten 10 Sek)
                if (newLog.timestamp) {
                    const now = Date.now();
                    const logTime = newLog.timestamp.toDate().getTime();
                    
                    if (now - logTime < 10000) {
                        // Sound abspielen
                        alertSound.play().catch(() => console.log("Sound blockiert. Bitte Button klicken!"));
                        
                        // Browser Popup
                        window.alert(`🚨 KAUF-ALARM!\nUser: ${newLog.userName}\nItem: ${newLog.itemName}\nPreis: ${newLog.price} 💎`);
                    }
                }
            }
        });
    });

    // Echtzeit-Listener für die HISTORY LISTE in der Sidebar
    db.collection('logs').orderBy('timestamp', 'desc').limit(15).onSnapshot(snap => {
        logDiv.innerHTML = '';
        snap.forEach(doc => {
            const data = doc.data();
            const time = data.timestamp ? data.timestamp.toDate().toLocaleTimeString() : "...";
            logDiv.innerHTML += `
                <div style="padding: 8px; border-bottom: 1px solid #333; color: #00d2ff; background: rgba(0,210,255,0.05); margin-bottom: 5px; border-left: 2px solid #cc0000;">
                    <span style="color: #666; font-size: 0.7em;">[${time}]</span><br>
                    <strong>${data.userName || "Pilot"}</strong>: ${data.itemName || "Item"}<br>
                    <span style="color: gold;">-${data.price || 0} 💎</span>
                </div>`;
        });
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
                list.innerHTML += `
                <div class="user-monitor-row">
                    <span>${u.username}</span>
                    <span class="u-cry">${u.crystals || 0} 💎</span>
                </div>`;
            }
        });
    });
}

// ==========================================
// 4. USER: SHOP & KAUF-LOGIK
// ==========================================
async function buyItem(itemId, price) {
    const userRef = db.collection('user').doc(auth.currentUser.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if ((userData.crystals || 0) < price) {
        alert("Nicht genügend Kristalle für diese Ausrüstung!");
        return;
    }

    // Name des Items aus dem Shop laden für das Log
    let itemName = "Unbekanntes Item";
    try {
        const itemSnap = await db.collection('shop').doc(itemId).get();
        if (itemSnap.exists) itemName = itemSnap.data().name;
    } catch (e) { console.error(e); }

    if(confirm(`"${itemName}" für ${price} 💎 anfordern?`)) {
        try {
            // 1. Kristalle abziehen
            await userRef.update({ crystals: userData.crystals - price });

            // 2. Kauf-Log für Admin schreiben
            await db.collection('logs').add({
                userName: userData.username,
                itemName: itemName,
                price: price,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("Transaktion erfolgreich. Der Admin wurde benachrichtigt.");
        } catch (e) {
            alert("Fehler bei der Übertragung: " + e.message);
        }
    }
}

// ==========================================
// 5. DATEN-SYNCHRONISATION (CORE)
// ==========================================
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
                <div class="card" style="margin:0; padding:10px; border-color:var(--imp-blue);">
                    <h4 style="margin:0 0 5px 0;">${item.name}</h4>
                    <p style="color:var(--imp-blue); margin:0 0 10px 0;">${item.price} 💎</p>
                    <button class="imperial-btn" style="width:100%; padding:5px;" onclick="buyItem('${doc.id}', ${item.price})">KAUFEN</button>
                </div>`;
        });
    });
}

function loadLeaderboard() {
    db.collection('user').orderBy('totalPoints', 'desc').limit(10).onSnapshot(snap => {
        const list = document.getElementById('leaderboard');
        list.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            list.innerHTML += `
                <li style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #222;">
                    <span>${u.username}</span>
                    <span style="color:var(--imp-blue)">${u.totalPoints || 0} PX</span>
                </li>`;
        });
    });
}

// ==========================================
// 6. ADMIN AKTIONEN (STEUERUNG)
// ==========================================
async function addCrystalCustom() {
    const name = document.getElementById('target-user').value.trim();
    const amount = Number(document.getElementById('crystal-amount').value);
    
    if(!name || isNaN(amount)) return;

    const snap = await db.collection('user').where('username', '==', name).get();
    snap.forEach(async d => {
        const data = d.data();
        const newC = (data.crystals || 0) + amount;
        const newP = amount > 0 ? (data.totalPoints || 0) + amount : (data.totalPoints || 0);
        await db.collection('user').doc(d.id).update({ crystals: newC, totalPoints: newP });
    });
    document.getElementById('crystal-amount').value = "";
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
        document.getElementById('item-name').value = "";
        document.getElementById('item-price').value = "";
    }
}