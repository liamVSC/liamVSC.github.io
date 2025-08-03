// TODO: Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDikCMGWLIPytpP59lAxVeHOF2Z_0RmtLY",
  authDomain: "liamvsc.firebaseapp.com",
  projectId: "liamvsc",
  storageBucket: "liamvsc.firebasestorage.app",
  messagingSenderId: "748359707687",
  appId: "1:748359707687:web:306ec41c292319887fb202",
  measurementId: "G-VDHY5SG8PP"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Navigation elements
const toScriptsBtn = document.getElementById('toScriptsBtn');
const toHomeBtn = document.getElementById('toHomeBtn');
const navHome = document.getElementById('navHome');
const navScripts = document.getElementById('navScripts');
const homeSection = document.getElementById('homeSection');
const scriptsSection = document.getElementById('scriptsSection');

toScriptsBtn.onclick = () => {
  navHome.style.display = 'none';
  navScripts.style.display = 'block';
  homeSection.style.display = 'none';
  scriptsSection.style.display = 'block';
};

toHomeBtn.onclick = () => {
  navHome.style.display = 'block';
  navScripts.style.display = 'none';
  homeSection.style.display = 'block';
  scriptsSection.style.display = 'none';
};

// Auth UI elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const displayNameInput = document.getElementById('displayName');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authStatus = document.getElementById('authStatus');
const uploadSection = document.getElementById('uploadSection');
const uploadBtn = document.getElementById('uploadBtn');
const scriptTitleInput = document.getElementById('scriptTitle');
const scriptCodeInput = document.getElementById('scriptCode');
const scriptsList = document.getElementById('scriptsList');

// Listen for auth state changes
auth.onAuthStateChanged(user => {
  if (user) {
    authStatus.textContent = `Logged in as ${user.email}`;
    loginBtn.style.display = 'none';
    registerBtn.style.display = 'none';
    displayNameInput.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    uploadSection.style.display = 'block';
  } else {
    authStatus.textContent = 'Not logged in';
    loginBtn.style.display = 'inline-block';
    registerBtn.style.display = 'inline-block';
    displayNameInput.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    uploadSection.style.display = 'none';
  }
  loadScripts();
});

// Login
loginBtn.onclick = () => {
  const email = emailInput.value.trim();
  const pass = passwordInput.value.trim();
  auth.signInWithEmailAndPassword(email, pass)
    .catch(e => alert('Login error: ' + e.message));
};

// Register
registerBtn.onclick = () => {
  const email = emailInput.value.trim();
  const pass = passwordInput.value.trim();
  const displayName = displayNameInput.value.trim();
  if (!displayName) return alert('Please enter a display name.');

  auth.createUserWithEmailAndPassword(email, pass)
    .then(({ user }) => {
      return db.collection('users').doc(user.uid).set({
        displayName,
        email
      });
    })
    .catch(e => alert('Register error: ' + e.message));
};

// Logout
logoutBtn.onclick = () => auth.signOut();

// Upload a script
uploadBtn.onclick = async () => {
  const title = scriptTitleInput.value.trim();
  const code = scriptCodeInput.value.trim();
  const user = auth.currentUser;
  if (!title || !code) return alert('Please enter title and script code.');
  if (!user) return alert('You must be logged in.');

  // Get display name from users collection
  const userDoc = await db.collection('users').doc(user.uid).get();
  const displayName = userDoc.exists ? userDoc.data().displayName : user.email;

  try {
    await db.collection('scripts').add({
      title,
      code,
      authorId: user.uid,
      authorName: displayName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      likes: 0,
      likedBy: []
    });
    alert('Script uploaded!');
    scriptTitleInput.value = '';
    scriptCodeInput.value = '';
  } catch (e) {
    alert('Upload failed: ' + e.message);
  }
};

// Escape HTML to prevent injection
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Load and display scripts with likes & like button
function loadScripts() {
  db.collection('scripts')
    .orderBy('createdAt', 'desc')
    .get()
    .then(snapshot => {
      scriptsList.innerHTML = '';
      const userId = auth.currentUser ? auth.currentUser.uid : null;

      snapshot.forEach(doc => {
        const data = doc.data();
        const liked = userId && data.likedBy && data.likedBy.includes(userId);

        const li = document.createElement('li');
        li.innerHTML = `
          <h4>${escapeHtml(data.title)}</h4>
          <div class="author-info">by ${escapeHtml(data.authorName || 'unknown')} on ${data.createdAt?.toDate().toLocaleString() || '...'}</div>
          <pre>${escapeHtml(data.code)}</pre>
          <button class="likeBtn" data-id="${doc.id}" style="background-color: ${liked ? '#e74c3c' : '#4A90E2'}">
            ❤️ ${data.likes || 0}
          </button>
        `;
        scriptsList.appendChild(li);
      });

      // Like button handlers
      document.querySelectorAll('.likeBtn').forEach(btn => {
        btn.onclick = async () => {
          if (!userId) return alert('You must be logged in to like scripts.');
          const scriptId = btn.getAttribute('data-id');
          const scriptRef = db.collection('scripts').doc(scriptId);
          const doc = await scriptRef.get();
          if (!doc.exists) return alert('Script no longer exists.');

          const data = doc.data();
          let newLikes = data.likes || 0;
          let likedBy = data.likedBy || [];

          if (likedBy.includes(userId)) {
            // Unlike
            likedBy = likedBy.filter(id => id !== userId);
            newLikes--;
            btn.style.backgroundColor = '#4A90E2';
          } else {
            // Like
            likedBy.push(userId);
            newLikes++;
            btn.style.backgroundColor = '#e74c3c';
          }

          await scriptRef.update({ likes: newLikes, likedBy });
          btn.textContent = `❤️ ${newLikes}`;
        };
      });
    });
}
