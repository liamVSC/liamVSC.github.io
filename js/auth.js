// Handles authentication (login, register) and general auth state behavior

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const authMessage = document.getElementById("auth-message");

// Login functionality
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            window.location.href = "index.html";
        } catch (err) {
            authMessage.innerText = err.message;
        }
    });
}

// Register functionality
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("register-email").value;
        const password = document.getElementById("register-password").value;
        const displayName = document.getElementById("register-displayname").value;

        try {
            const userCred = await auth.createUserWithEmailAndPassword(email, password);
            await db.collection("users").doc(userCred.user.uid).set({ displayName });
            window.location.href = "index.html";
        } catch (err) {
            authMessage.innerText = err.message;
        }
    });
}

// Auth state listener (used for gating pages or updating UI)
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("Logged in:", user.email);
    } else {
        console.log("Not logged in");
    }
});
