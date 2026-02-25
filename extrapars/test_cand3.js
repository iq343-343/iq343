async function loadMaxChartCandidates() {
    const candidates = [];
    for (let page = 0; page < 8; page += 1) {
        const offset = page * 20;
        const res = await fetch(`https://maxchart.ru/api/channels?offset=${offset}&limit=20`);
        const text = await res.text();
        const cardPattern = /<a class="card" href="\/channel\/([^"]+)">/g;
        let match;
        while ((match = cardPattern.exec(String(text || ""))) !== null) {
            candidates.push(match[1]);
        }
    }
    return candidates;
}

loadMaxChartCandidates().then(c => {
    console.log("Total:", c.length);
    console.log("Includes aquagizer:", c.includes("aquagizer"));
});
