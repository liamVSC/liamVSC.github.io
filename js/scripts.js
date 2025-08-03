auth.onAuthStateChanged(async (user) => {
    if (!user) return;

    const userId = user.uid;
    const userDisplayName = (await db.collection("users").doc(userId).get()).data().displayName;

    const displayNameEl = document.getElementById("displayName");
    if (displayNameEl) displayNameEl.innerText = userDisplayName || "User";

    const userScriptsList = document.getElementById("user-scripts-list");
    const recentScriptsList = document.getElementById("recent-scripts-list");
    const scriptsList = document.getElementById("scripts-list");

    if (userScriptsList || recentScriptsList || scriptsList) {
        db.collection("scripts").orderBy("timestamp", "desc").onSnapshot(snapshot => {
            if (userScriptsList) userScriptsList.innerHTML = '';
            if (recentScriptsList) recentScriptsList.innerHTML = '';
            if (scriptsList) scriptsList.innerHTML = '';

            snapshot.forEach(doc => {
                const data = doc.data();
                const scriptItem = document.createElement("li");
                scriptItem.innerHTML = `
                    <h3>${data.title}</h3>
                    <pre>${data.content}</pre>
                    <p>By: ${data.authorName}</p>
                    <button onclick="likeScript('${doc.id}')">Like</button>
                    <span id="like-count-${doc.id}">${data.likes || 0}</span> Likes
                    <div class="comment-section" id="comments-${doc.id}"></div>
                `;
                if (userScriptsList && data.authorId === userId) userScriptsList.appendChild(scriptItem);
                if (recentScriptsList) recentScriptsList.appendChild(scriptItem.cloneNode(true));
                if (scriptsList) scriptsList.appendChild(scriptItem);
                loadComments(doc.id);
            });
        });
    }

    const uploadForm = document.getElementById("upload-script-form");
    if (uploadForm) {
        uploadForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const title = document.getElementById("script-title").value;
            const content = document.getElementById("script-content").value;
            await db.collection("scripts").add({
                title,
                content,
                authorId: user.uid,
                authorName: userDisplayName,
                likes: 0,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            uploadForm.reset();
        });
    }
});
