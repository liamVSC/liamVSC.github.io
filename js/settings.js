document.getElementById("change-displayname-btn").addEventListener("click", async () => {
    const user = auth.currentUser;
    const newName = document.getElementById("displayname-input").value;
    if (user && newName.trim()) {
        await db.collection("users").doc(user.uid).update({ displayName: newName.trim() });
        alert("Display name updated!");
    }
});

document.getElementById("change-password-btn").addEventListener("click", async () => {
    const user = auth.currentUser;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    if (user && newPassword === confirmPassword) {
        await user.updatePassword(newPassword);
        alert("Password changed!");
    } else {
        alert("Passwords do not match.");
    }
});
