async function loadComments(scriptId) {
    const commentsRef = db.collection("scripts").doc(scriptId).collection("comments").orderBy("timestamp", "desc");
    const commentsSection = document.getElementById(`comments-${scriptId}`);
    if (!commentsSection) return;

    commentsSection.innerHTML = `
        <form onsubmit="postComment('${scriptId}', event)">
            <input type="text" id="comment-input-${scriptId}" placeholder="Add a comment..." />
            <button type="submit">Post</button>
        </form>
        <div id="comment-list-${scriptId}"></div>
    `;

    commentsRef.onSnapshot(snapshot => {
        const commentList = document.getElementById(`comment-list-${scriptId}`);
        commentList.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const comment = document.createElement("div");
            comment.classList.add("comment");
            comment.innerText = `${data.authorName}: ${data.text}`;
            commentList.appendChild(comment);
        });
    });
}

async function postComment(scriptId, e) {
    e.preventDefault();
    const user = auth.currentUser;
    const input = document.getElementById(`comment-input-${scriptId}`);
    if (!user || !input.value.trim()) return;

    const userDoc = await db.collection("users").doc(user.uid).get();
    const displayName = userDoc.data().displayName;

    await db.collection("scripts").doc(scriptId).collection("comments").add({
        text: input.value.trim(),
        authorId: user.uid,
        authorName: displayName,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = '';
}
