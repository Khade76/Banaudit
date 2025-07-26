async function fetchUserName(userId) {
    try {
        const res = await fetch(`https://api.battlemetrics.com/users/${userId}`, {
            headers: { Authorization: `Bearer ${bmToken}` }
        });
        if (!res.ok) throw new Error(`User lookup ${res.status}`);
        const { data } = await res.json();
        return stripHtml(data.attributes.name || 'Unknown');
    } catch {
        return 'Unknown';
    }
}

//add all helper funtions here
module.exports = {
    fetchUserName
};