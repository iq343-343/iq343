const fs = require('fs');

function levenshteinDistance(a, b) {
    const left = String(a || "");
    const right = String(b || "");

    if (!left.length) return right.length;
    if (!right.length) return left.length;

    const prev = new Array(right.length + 1);
    const cur = new Array(right.length + 1);

    for (let j = 0; j <= right.length; j += 1) {
        prev[j] = j;
    }

    for (let i = 1; i <= left.length; i += 1) {
        cur[0] = i;
        for (let j = 1; j <= right.length; j += 1) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            cur[j] = Math.min(
                prev[j] + 1,
                cur[j - 1] + 1,
                prev[j - 1] + cost
            );
        }
        for (let j = 0; j <= right.length; j += 1) {
            prev[j] = cur[j];
        }
    }

    return prev[right.length];
}

function normalizeForSimilarity(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[ё]/g, "е")
        .replace(/[^a-zа-я0-9]+/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeCompact(text) {
    return normalizeForSimilarity(text).replace(/\s+/g, "");
}

function splitTokens(text) {
    return normalizeForSimilarity(text)
        .split(" ")
        .map((token) => token.trim())
        .filter(Boolean);
}

function jaccardSimilarity(aTokens, bTokens) {
    const left = new Set(aTokens || []);
    const right = new Set(bTokens || []);
    if (!left.size || !right.size) return 0;

    let intersection = 0;
    left.forEach((token) => {
        if (right.has(token)) intersection += 1;
    });

    const union = left.size + right.size - intersection;
    return union > 0 ? intersection / union : 0;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function stringSimilarity(left, right) {
    const a = normalizeCompact(left);
    const b = normalizeCompact(right);

    if (!a || !b) return 0;
    if (a === b) return 1;

    const maxLen = Math.max(a.length, b.length);
    const lev = 1 - levenshteinDistance(a, b) / maxLen;
    const includes = a.includes(b) || b.includes(a)
        ? Math.min(a.length, b.length) / maxLen
        : 0;
    const tokenScore = jaccardSimilarity(splitTokens(left), splitTokens(right));

    return clamp(Math.max(lev, includes, tokenScore), 0, 1);
}

console.log("Similarity:", stringSimilarity("aquagizer_pro", "aquagizer"));

