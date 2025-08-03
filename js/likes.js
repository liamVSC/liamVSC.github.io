async function likeScript(scriptId) {
    const scriptRef = db.collection("scripts").doc(scriptId);
    await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(scriptRef);
        const newLikes = (doc.data().likes || 0) + 1;
        transaction.update(scriptRef, { likes: newLikes });
    });
}
