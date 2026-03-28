// Deine Firebase-Daten
const firebaseConfig = {
  apiKey: "AIzaSyDgHmywbvd_65tHQGdcoYIQFqoDue35mjw",
  authDomain: "may-the-4th-75cdd.firebaseapp.com",
  databaseURL: "https://may-the-4th-75cdd-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "may-the-4th-75cdd",
  storageBucket: "may-the-4th-75cdd.firebasestorage.app",
  messagingSenderId: "1060090227380",
  appId: "1:1060090227380:web:0b863e96fcf44c725245e1"
};

// Initialisierung
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- LOGIN FUNKTION ---
async function login() {
    const userInput = document.getElementById('username').value.trim();
    const passInput = document.getElementById('password').value;
    
    // Wir machen alles klein für die E-Mail
    const email = `${userInput.toLowerCase()}@event.local`;

    console.log("Versuche Login mit E-Mail:", email);

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, passInput);
        console.log("Erfolg! UID:", userCredential.user.uid);
    } catch (error) {
        console.error("Firebase Fehler:", error.code);
        
        // Den Fehler zeigen wir jetzt direkt im roten Textfeld an:
        let errorMsg = "Fehler: ";
        if (error.code === 'auth/user-not-found') errorMsg += "User nicht gefunden (E-Mail falsch?)";
        else if (error.code === 'auth/wrong-password') errorMsg += "Passwort ist falsch.";
        else if (error.code === 'auth/invalid-email') errorMsg += "E-Mail Format ungültig.";
        else if (error.code === 'auth/operation-not-allowed') errorMsg += "Login-Methode in Firebase deaktiviert.";
        else errorMsg += error.code; // Zeigt den technischen Code (z.B. network-request-failed)

        document.getElementById('login-error').innerText = errorMsg;
    }
}

// --- UI MANAGEMENT ---
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
            const data = doc.data();
            document.getElementById('user-display').innerText = `Hallo, ${data.username}`;
            document.getElementById('crystal-count').innerText = data.crystals;
            document.getElementById('total-points').innerText = data.totalPoints;
            
            if (data.role === 'admin') {
                document.getElementById('admin-panel').classList.remove('hidden');
            }
        }
    });
}

function loadLeaderboard() {
    db.collection('user').orderBy('totalPoints', 'desc').onSnapshot(snap => {
        const list = document.getElementById('leaderboard');
        list.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            list.innerHTML += `<li><span>${u.username}</span> <strong>${u.totalPoints} Pkt</strong></li>`;
        });
    });
}

// --- GAME & SHOP LOGIK ---
function listenToGameAndShop() {
    // Überwacht das aktuelle Spiel
    db.collection('settings').doc('gameState').onSnapshot(doc => {
        if(doc.exists) {
            const currentGame = doc.data().name;
            document.getElementById('current-game-name').innerText = currentGame;
            
            // Lade nur Shop-Items für dieses Spiel
            loadShop(currentGame);
        }
    });
}

function loadShop(gameName) {
    db.collection('shop').where('game', '==', gameName).onSnapshot(snap => {
        const shopDiv = document.getElementById('shop-items');
        shopDiv.innerHTML = '';
        snap.forEach(doc => {
            const item = doc.data();
            shopDiv.innerHTML += `
                <div class="stat-card shop-item">
                    <h4>${item.name}</h4>
                    <p>${item.price} 💎</p>
                    <button onclick="buyItem('${doc.id}', ${item.price}, '${item.name}')">Kaufen</button>
                </div>`;
        });
    });
}

async function buyItem(itemId, price, itemName) {
    const userRef = db.collection('user').doc(auth.currentUser.uid);
    const userDoc = await userRef.get();
    const currentCrystals = userDoc.data().crystals;

    if (currentCrystals >= price) {
        if(confirm(`Möchtest du "${itemName}" für ${price} Kristalle kaufen?`)) {
            await userRef.update({ crystals: currentCrystals - price });
            alert("Kauf erfolgreich! Melde dich beim Admin.");
        }
    } else {
        alert("Du hast nicht genug Kristalle!");
    }
}

// --- ADMIN FUNKTIONEN ---

// Spiel über Dropdown ändern
async function updateGameFromDropdown() {
    const selectedGame = document.getElementById('game-select').value;
    await db.collection('settings').doc('gameState').set({ name: selectedGame });
    alert("Spiel gewechselt zu: " + selectedGame);
}

// Shop-Item hinzufügen
async function addShopItem() {
    const name = document.getElementById('item-name').value;
    const price = Number(document.getElementById('item-price').value);
    const game = document.getElementById('game-select').value; // Nutzt das gewählte Spiel aus dem Dropdown

    if(!name || !price) return alert("Bitte Name und Preis eingeben!");

    await db.collection('shop').add({
        name: name,
        price: price,
        game: game
    });
    
    alert(`Item "${name}" für ${game} hinzugefügt!`);
    document.getElementById('item-name').value = "";
    document.getElementById('item-price').value = "";
}

// Kristalle vergeben
async function addCrystal(amount) {
    const targetName = document.getElementById('target-user').value.trim();
    if (!targetName) return alert("Bitte Username eingeben!");

    const snap = await db.collection('user').where('username', '==', targetName).get();
    
    if (snap.empty) return alert("Spieler nicht gefunden!");

    snap.forEach(async (userDoc) => {
        const d = userDoc.data();
        const newCrystals = Number(d.crystals || 0) + amount;
        const newPoints = amount > 0 ? Number(d.totalPoints || 0) + amount : Number(d.totalPoints || 0);

        await db.collection('user').doc(userDoc.id).update({
            crystals: newCrystals,
            totalPoints: newPoints
        });
    });
}

function logout() { auth.signOut(); }