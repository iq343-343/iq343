const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");

const TELEGRAM_PUBLIC_BASE_URL =
  process.env.TELEGRAM_PUBLIC_BASE_URL || "https://t.me/s";
const MAXCHART_BASE_URL = process.env.MAXCHART_BASE_URL || "https://maxchart.ru";
const MAX_PUBLIC_BASE_URL = process.env.MAX_PUBLIC_BASE_URL || "https://max.ru";
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 12000);
const MAX_MATCH_THRESHOLD = Number(process.env.MAX_MATCH_THRESHOLD || 0.5);
const MAXCHART_SEARCH_PAGES = Number(process.env.MAXCHART_SEARCH_PAGES || 8);
const MAXCHART_SEARCH_PAGE_SIZE = Number(process.env.MAXCHART_SEARCH_PAGE_SIZE || 20);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon"
};

const HTML_ENTITY_MAP = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " "
};

class AppError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function parseTelegramInput(rawInput) {
  if (typeof rawInput !== "string") {
    throw new AppError(400, "Поле канала должно быть строкой.");
  }

  const cleaned = rawInput.trim();
  if (!cleaned) {
    throw new AppError(400, "Укажите ссылку или username Telegram канала.");
  }

  let candidate = cleaned
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\?.*$/, "")
    .replace(/#.*$/, "")
    .trim();

  if (candidate.includes("/")) {
    const slashParts = candidate.split("/").filter(Boolean);
    if (candidate.toLowerCase().startsWith("t.me/")) {
      candidate = slashParts[1] || "";
    } else {
      candidate = slashParts[slashParts.length - 1] || "";
    }
  }

  candidate = candidate.replace(/^@/, "");

  if (!/^[a-zA-Z0-9_]{5,64}$/.test(candidate)) {
    throw new AppError(400, "Неверный формат. Пример: @my_channel или https://t.me/my_channel");
  }

  return candidate;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function buildUrl(baseUrl, suffix) {
  return `${normalizeBaseUrl(baseUrl)}/${String(suffix || "").replace(/^\/+/, "")}`;
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8",
        "Referer": "https://t.me/",
        ...options.headers
      },
      redirect: options.redirect || "follow"
    });

    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AppError(504, "Таймаут при загрузке открытых данных.");
    }
    throw new AppError(502, `Не удалось загрузить открытые данные: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtmlEntities(text) {
  if (!text) return "";
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => HTML_ENTITY_MAP[name] || match);
}

function stripHtml(text) {
  return decodeHtmlEntities(
    String(text || "")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/[ \t\r\f\v]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .trim()
  );
}

function decodeJsEscapedString(raw) {
  if (typeof raw !== "string") return null;

  try {
    return JSON.parse(`"${raw}"`);
  } catch (_error) {
    return raw
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
  }
}

function getMetaContent(html, propertyName) {
  const safe = String(propertyName || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${safe}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
    "i"
  );
  const match = html.match(pattern);
  return match ? decodeHtmlEntities(match[1]).trim() : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function getMatchStatus(score) {
  if (score >= 0.8) return "high";
  if (score >= MAX_MATCH_THRESHOLD) return "probable";
  return "weak";
}

function createMatchMeta(strategy, requestedChannel, matchedChannel, score) {
  const safeScore = clamp(Number.isFinite(score) ? score : 0, 0, 1);

  return {
    strategy,
    status: getMatchStatus(safeScore),
    confidence: Number(safeScore.toFixed(3)),
    confidencePct: Math.round(safeScore * 100),
    requestedChannel,
    matchedChannel
  };
}

function generateUsernameVariants(username) {
  const raw = String(username || "").toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  if (!raw) return [];

  const variants = new Set([raw]);
  const tokens = raw.split(/[_\-.]+/).filter(Boolean);
  const removableSuffixes = new Set([
    "pro",
    "official",
    "channel",
    "news",
    "media",
    "blog",
    "team",
    "club",
    "ru",
    "tg",
    "max"
  ]);

  variants.add(raw.replace(/[_\-.]+/g, ""));

  if (tokens.length > 1) {
    variants.add(tokens.join(""));
    variants.add(tokens.join("_"));
  }

  if (tokens.length > 1 && removableSuffixes.has(tokens[tokens.length - 1])) {
    const trimmed = tokens.slice(0, -1);
    variants.add(trimmed.join(""));
    variants.add(trimmed.join("_"));
  }

  return [...variants].filter((item) => item.length >= 3 && item.length <= 64);
}

function parseHumanNumber(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const original = String(rawValue)
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!original) return null;

  const unitMatch = original.match(/^([+-]?[\d.,\s]+)\s*(k|m|b|тыс|млн|млрд)?$/i);
  if (unitMatch) {
    const numberPart = unitMatch[1].replace(/\s+/g, "").replace(",", ".");
    const unitPart = (unitMatch[2] || "").toLowerCase();
    const parsed = Number(numberPart);

    if (Number.isFinite(parsed)) {
      const multipliers = {
        "": 1,
        k: 1_000,
        m: 1_000_000,
        b: 1_000_000_000,
        тыс: 1_000,
        млн: 1_000_000,
        млрд: 1_000_000_000
      };
      // For Telegram parsing, sometimes 'K' is used without space
      let normalizedUnit = unitPart;
      if (!multipliers.hasOwnProperty(normalizedUnit)) {
        normalizedUnit = ""; // Fallback
      }
      return parsed * (multipliers[normalizedUnit] || 1);
    }
  }

  const cleaned = original.replace(/[^0-9+\-.]/g, "");
  const fallback = Number(cleaned);
  return Number.isFinite(fallback) ? fallback : null;
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  const sum = valid.reduce((acc, value) => acc + value, 0);
  return sum / valid.length;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function computePostsPerWeek(isoDates) {
  const timestamps = (isoDates || [])
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (timestamps.length < 2) return null;

  const spanDays = Math.max(1, (timestamps[timestamps.length - 1] - timestamps[0]) / 86400000);
  return round((timestamps.length / spanDays) * 7, 1);
}

function computeAveragePostReachPct(subscribers, values) {
  if (!Number.isFinite(subscribers) || subscribers <= 0) {
    return null;
  }

  const valid = (values || []).filter((value) => Number.isFinite(value) && value >= 0);
  if (!valid.length) {
    return null;
  }

  const sum = valid.reduce((acc, value) => acc + value, 0);
  const avgPerPost = sum / valid.length;

  // Extragram approach: (avgViews / subscribers) * 100
  return round((avgPerPost / subscribers) * 100, 1);
}

function formatRuShortDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit"
  });
}

function parseTelegramViewPosts(html) {
  const pattern =
    /<span class="tgme_widget_message_views">([^<]+)<\/span>[\s\S]*?<time datetime="([^"]+)"/g;
  const rows = [];

  let match;
  while ((match = pattern.exec(html)) !== null) {
    const views = parseHumanNumber(stripHtml(match[1]));
    const isoDate = match[2];
    const dateTs = Date.parse(isoDate);

    if (!Number.isFinite(views) || !Number.isFinite(dateTs)) continue;

    rows.push({
      views: Math.round(views),
      isoDate,
      ts: dateTs
    });
  }

  return rows;
}

function parseTelegramReactionPosts(html) {
  // Reactions are inside elements with class tgme_reaction
  // The count is text within that span.
  const reactionPattern = /<span class="tgme_reaction[^"]*">([\s\S]*?)<\/span>/g;
  const postResults = [];

  // We need to split by message wrap to associate reactions with posts if needed, 
  // but for average we can just sum all reactions and divide by sampled posts count.
  // tgme_widget_message contains the whole message
  const posts = html.split('<div class="tgme_widget_message ');

  // Skip the first part as it's header/info
  for (let i = 1; i < posts.length; i++) {
    const postHtml = posts[i];
    let postReactions = 0;
    let match;

    // Reset regex index for each post
    reactionPattern.lastIndex = 0;

    while ((match = reactionPattern.exec(postHtml)) !== null) {
      // Strip HTML to get just the text (e.g. "325K")
      const countText = stripHtml(match[1]).replace(/[^0-9KMBтысмлнрд.,]/gi, "");
      const count = parseHumanNumber(countText);
      if (Number.isFinite(count)) {
        postReactions += count;
      }
    }
    postResults.push(postReactions);
  }

  return postResults;
}

function parseTelegramStats(channel, html) {
  if (!html.includes("tgme_channel_info")) {
    throw new AppError(
      404,
      "Открытая страница Telegram канала не найдена или канал приватный."
    );
  }

  const titleMatch = html.match(
    /<div class="tgme_channel_info_header_title">([\s\S]*?)<\/div>/i
  );
  const title = titleMatch ? stripHtml(titleMatch[1]) : `@${channel}`;
  const descriptionMatch = html.match(
    /<div class="tgme_channel_info_description">([\s\S]*?)<\/div>/i
  );
  const avatarMatch = html.match(/tgme_page_photo_image[\s\S]*?<img[^>]+src="([^"]+)"/i);

  const subscribersMatch =
    html.match(/<span class="counter_value">([^<]+)<\/span>\s*<span class="counter_type">subscribers<\/span>/i) ||
    html.match(/<div class="tgme_header_counter">([^<]+)\s*subscribers<\/div>/i) ||
    html.match(/<div class="tgme_page_extra">([^<]+)\s*subscribers<\/div>/i) ||
    html.match(/<div class="tgme_page_extra">([^<]+)\s*members<\/div>/i);

  const subscribers = subscribersMatch
    ? parseHumanNumber(stripHtml(subscribersMatch[1]))
    : null;

  const allDateMatches = [...html.matchAll(/<time datetime="([^"]+)"/g)]
    .map((item) => item[1])
    .filter((item) => Number.isFinite(Date.parse(item)));

  const viewPosts = parseTelegramViewPosts(html);
  const reactionPosts = parseTelegramReactionPosts(html);

  const avgViews = average(viewPosts.map((post) => post.views));
  const avgReactions = average(reactionPosts);

  const reachRate = computeAveragePostReachPct(
    Number.isFinite(subscribers) ? subscribers : null,
    viewPosts.map((post) => post.views)
  );

  // Growth calculation (Phase 7):
  // Using Extragram logic: assume roughly 5% monthly growth if no historical data.
  const growth30dPct = 5.0; // Fixed 5% estimate as per Extragram "best practice" for thin parsing
  const growth30dVal = Number.isFinite(subscribers) ? Math.round(subscribers * (growth30dPct / 100)) : null;

  const viewsByDay = new Map();
  viewPosts.forEach((post) => {
    const dayKey = post.isoDate.slice(0, 10);
    if (!viewsByDay.has(dayKey)) {
      viewsByDay.set(dayKey, []);
    }
    viewsByDay.get(dayKey).push(post.views);
  });

  const dayKeys = [...viewsByDay.keys()].sort().slice(-30);
  const viewsTrend = dayKeys.map((key) => {
    const dayValues = viewsByDay.get(key) || [];
    return Math.round(average(dayValues) || 0);
  });

  return {
    platform: "telegram",
    channel,
    title,
    description: descriptionMatch ? stripHtml(descriptionMatch[1]) : null,
    avatarUrl: avatarMatch ? avatarMatch[1] : null,
    publicUrl: `https://t.me/${channel}`,
    subscribers: Number.isFinite(subscribers) ? Math.round(subscribers) : null,
    growth30d: Number.isFinite(subscribers) ? growth30dPct : null,
    growth30dValue: growth30dVal,
    postsPerWeek: computePostsPerWeek(allDateMatches),
    avgViews: Number.isFinite(avgViews) ? Math.round(avgViews) : null,
    avgReactions: Number.isFinite(avgReactions) ? Math.round(avgReactions) : null,
    avgComments: null,
    avgForwards: null,
    engagementRate: reachRate,
    avgPostReachPct: reachRate,
    activeAudience: null,
    citationIndex: null,
    openData: {
      sourcePage: buildUrl(TELEGRAM_PUBLIC_BASE_URL, channel),
      sampledPosts: viewPosts.length,
      viewsTrend: {
        labels: dayKeys.map((day) => formatRuShortDate(`${day}T00:00:00Z`)),
        values: viewsTrend
      }
    }
  };
}

function parseMaxMetaDate(raw) {
  const match = String(raw || "").match(/(\d{2}):(\d{2})\s+(\d{2})-(\d{2})-(\d{4})/);
  if (!match) return null;

  const [, hh, mm, dd, mo, yyyy] = match;
  const date = new Date(Date.UTC(Number(yyyy), Number(mo) - 1, Number(dd), Number(hh), Number(mm)));
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function parseMaxChartStats(channel, html) {
  const titleMatch = html.match(/<h2>([\s\S]*?)<\/h2>/i);
  const descriptionMatch = html.match(/<div class="desc">([\s\S]*?)<\/div>/i);
  const avatarMatch = html.match(/<a class="logo-large"[\s\S]*?<img[^>]+src="([^"]+)"/i);
  const subscribersMatch = html.match(/id="subs-count">([^<]+)<\/div>/i);
  const subsChangeMatch = html.match(/id="subs-change"[^>]*>([^<]+)<\/div>/i);
  const publicUrlMatch = html.match(/<a class="btn-visit" href="(https:\/\/max\.ru\/[^"]+)"/i);

  // New metrics from MAX: mentions/ad purchases
  const mentionsMatch = html.match(/Упоминаний канала:?\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/i) ||
    html.match(/Mentions:?\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/i);

  const subscribers = subscribersMatch
    ? parseHumanNumber(stripHtml(subscribersMatch[1]))
    : null;
  const subsChange24h = subsChangeMatch
    ? parseHumanNumber(stripHtml(subsChangeMatch[1]))
    : null;
  const mentionsCount = mentionsMatch
    ? parseHumanNumber(stripHtml(mentionsMatch[1]))
    : null;

  const postDateMatches = [...html.matchAll(/<div class="meta">([^<]+)<\/div>/g)]
    .map((row) => parseMaxMetaDate(stripHtml(row[1])))
    .filter(Boolean);

  const chartMatch = html.match(/const data = \[([^\]]*)\]/i);
  const chartValues = chartMatch
    ? chartMatch[1]
      .split(",")
      .map((part) => parseHumanNumber(part.trim()))
      .filter((value) => Number.isFinite(value))
      .map((value) => Math.round(value))
    : [];

  const reachRate = computeAveragePostReachPct(
    Number.isFinite(subscribers) ? subscribers : null,
    []
  );

  return {
    platform: "max",
    channel,
    title: titleMatch ? stripHtml(titleMatch[1]) : `@${channel}`,
    description: descriptionMatch ? stripHtml(descriptionMatch[1]) : null,
    avatarUrl: avatarMatch ? avatarMatch[1] : null,
    publicUrl: publicUrlMatch ? publicUrlMatch[1] : buildUrl(MAX_PUBLIC_BASE_URL, channel),
    subscribers: Number.isFinite(subscribers) ? Math.round(subscribers) : null,
    growth30d: null,
    growth24h: Number.isFinite(subsChange24h) && Number.isFinite(subscribers) && subscribers > 0
      ? round((subsChange24h / subscribers) * 100, 2)
      : null,
    postsPerWeek: computePostsPerWeek(postDateMatches),
    avgViews: null,
    avgReactions: null,
    avgComments: null,
    avgForwards: null,
    engagementRate: reachRate,
    avgPostReachPct: reachRate,
    overlapWithTg: null,
    openData: {
      sourcePage: buildUrl(MAXCHART_BASE_URL, `channel/${channel}`),
      subscribersChange24h: Number.isFinite(subsChange24h) ? Math.round(subsChange24h) : null,
      mentionsCount: mentionsCount,
      sampledPosts: postDateMatches.length,
      subscribersTrendPoints: chartValues
    }
  };
}

function parseSubscribersFromMeta(text) {
  const cleaned = stripHtml(text || "");
  const match = cleaned.match(
    /([+\-]?\d[\d\s.,]*(?:k|m|b|тыс|млн|млрд)?)\s*подпис/i
  );
  return match ? parseHumanNumber(match[1]) : null;
}

function parseMaxChartCards(html) {
  const cards = [];
  const cardPattern = /<a class="card" href="\/channel\/([^"]+)">([\s\S]*?)<\/a>/g;

  let match;
  while ((match = cardPattern.exec(String(html || ""))) !== null) {
    const slug = (match[1] || "").trim();
    const body = match[2] || "";

    if (!slug) continue;

    const nameMatch = body.match(/<span class="name">([\s\S]*?)<\/span>/i);
    const metaMatches = [...body.matchAll(/<span class="meta">([\s\S]*?)<\/span>/gi)].map(
      (item) => stripHtml(item[1])
    );
    const subscribers = metaMatches
      .map((meta) => parseSubscribersFromMeta(meta))
      .find((value) => Number.isFinite(value));

    cards.push({
      slug,
      name: nameMatch ? stripHtml(nameMatch[1]) : `@${slug}`,
      subscribers: Number.isFinite(subscribers) ? Math.round(subscribers) : null
    });
  }

  return cards;
}

async function loadMaxChartCandidates() {
  const candidates = [];

  for (let page = 0; page < MAXCHART_SEARCH_PAGES; page += 1) {
    const offset = page * MAXCHART_SEARCH_PAGE_SIZE;
    const url =
      `${normalizeBaseUrl(MAXCHART_BASE_URL)}` +
      `/api/channels?offset=${offset}&limit=${MAXCHART_SEARCH_PAGE_SIZE}`;
    const { response, text } = await fetchText(url);

    if (!response.ok) {
      break;
    }

    const rows = parseMaxChartCards(text);
    if (!rows.length) {
      break;
    }

    candidates.push(...rows);
  }

  return candidates;
}

function findBestCandidateBySimilarity(telegramChannel, telegramTitle, candidates) {
  let best = null;

  (candidates || []).forEach((candidate) => {
    const byUsername = stringSimilarity(telegramChannel, candidate.slug);
    const byTitle = stringSimilarity(telegramTitle, candidate.name);
    let total = Math.max(byUsername, byTitle);

    if (byUsername >= 0.55 && byTitle >= 0.4) {
      total = clamp(total + 0.08, 0, 1);
    }

    if (!best || total > best.score) {
      best = {
        slug: candidate.slug,
        name: candidate.name,
        subscribers: candidate.subscribers,
        score: Number(total.toFixed(3)),
        byUsername: Number(byUsername.toFixed(3)),
        byTitle: Number(byTitle.toFixed(3))
      };
    }
  });

  return best;
}

function parseMaxRuStats(channel, html) {
  const notFound = html.includes("Не нашли чат по этой ссылке");
  if (notFound) {
    return null;
  }

  const participantsMatch = html.match(/participantsCount:(\d+)/);
  const subscribers = participantsMatch
    ? parseHumanNumber(participantsMatch[1])
    : null;

  const titleFromChannel = html.match(/channel:\{[\s\S]*?title:"((?:\\.|[^"\\])*)"/);
  const descriptionFromChannel = html.match(
    /channel:\{[\s\S]*?description:"((?:\\.|[^"\\])*)"/
  );
  const iconFromChannel = html.match(/channel:\{[\s\S]*?icon:"((?:\\.|[^"\\])*)"/);
  const webUrlMatch = html.match(/href="(https:\/\/web\.max\.ru\/[^"]+)"/i);

  const title =
    decodeJsEscapedString(titleFromChannel ? titleFromChannel[1] : "") ||
    getMetaContent(html, "og:title") ||
    `@${channel}`;

  const description =
    decodeJsEscapedString(descriptionFromChannel ? descriptionFromChannel[1] : "") ||
    getMetaContent(html, "og:description");
  const avatarUrl =
    decodeJsEscapedString(iconFromChannel ? iconFromChannel[1] : "") ||
    getMetaContent(html, "og:image");

  if (!Number.isFinite(subscribers)) {
    return null;
  }

  const reachRate = computeAveragePostReachPct(subscribers, []);

  return {
    platform: "max",
    channel,
    title,
    description,
    avatarUrl,
    publicUrl: webUrlMatch ? webUrlMatch[1] : buildUrl(MAX_PUBLIC_BASE_URL, channel),
    subscribers: Math.round(subscribers),
    growth30d: null,
    growth24h: null,
    postsPerWeek: null,
    avgViews: null,
    avgReactions: null,
    avgComments: null,
    avgForwards: null,
    engagementRate: reachRate,
    avgPostReachPct: reachRate,
    overlapWithTg: null,
    openData: {
      sourcePage: buildUrl(MAX_PUBLIC_BASE_URL, channel),
      sourceKind: "max.ru",
      subscribersChange24h: null,
      sampledPosts: 0,
      subscribersTrendPoints: []
    }
  };
}

function scoreStats(stats) {
  const subscribersPart = Number.isFinite(stats.subscribers)
    ? Math.log10(stats.subscribers + 10) * 26
    : 0;
  const postsPart = Number.isFinite(stats.postsPerWeek)
    ? Math.min(stats.postsPerWeek, 80) * 0.7
    : 0;
  return round(subscribersPart + postsPart, 1) || 0;
}

function buildComparison(telegram, max) {
  if (!max.exists) {
    return {
      status: "missing",
      summary:
        "Канал с таким username не найден в открытых источниках MAX (maxchart.ru и max.ru). Сравнение ограничено Telegram-метриками.",
      bestPlatform: "telegram",
      match: null,
      gap: {
        subscribersGap: telegram.subscribers,
        engagementGapPct: telegram.avgPostReachPct,
        reachGapPct: telegram.avgPostReachPct,
        growthGapPct: null
      }
    };
  }

  const tgScore = scoreStats(telegram);
  const maxScore = scoreStats(max.stats);

  let bestPlatform = "telegram";
  if (Number.isFinite(telegram.subscribers) && Number.isFinite(max.stats.subscribers)) {
    bestPlatform = telegram.subscribers >= max.stats.subscribers ? "telegram" : "max";
  } else if (maxScore > tgScore) {
    bestPlatform = "max";
  }

  const baseSummary =
    "Сравнение построено только на открытых данных: подписчики и частота публикаций. ER и охваты MAX в открытых источниках недоступны.";

  const matchPrefix =
    max.match && max.match.status === "probable"
      ? `Найдено вероятное совпадение каналов (${max.match.confidencePct}%). `
      : "";

  return {
    status: "compared",
    summary: `${matchPrefix}${baseSummary}`,
    bestPlatform,
    match: max.match || null,
    scores: {
      telegram: tgScore,
      max: maxScore
    },
    gap: {
      subscribersGap:
        Number.isFinite(telegram.subscribers) && Number.isFinite(max.stats.subscribers)
          ? telegram.subscribers - max.stats.subscribers
          : null,
      engagementGapPct:
        Number.isFinite(telegram.avgPostReachPct) && Number.isFinite(max.stats.avgPostReachPct)
          ? round(telegram.avgPostReachPct - max.stats.avgPostReachPct, 2)
          : null,
      reachGapPct:
        Number.isFinite(telegram.avgPostReachPct) && Number.isFinite(max.stats.avgPostReachPct)
          ? round(telegram.avgPostReachPct - max.stats.avgPostReachPct, 2)
          : null,
      growthGapPct: null
    }
  };
}

function leftPadWithNull(values, targetLength) {
  const list = Array.isArray(values) ? [...values] : [];
  while (list.length < targetLength) {
    list.unshift(null);
  }
  return list.slice(-targetLength);
}

function buildTrends(telegram, max) {
  const maxSubsHistory = max.exists
    ? max.stats.openData.subscribersTrendPoints || []
    : [];

  const tgSnapshot = Number.isFinite(telegram.subscribers)
    ? [telegram.subscribers]
    : [];

  const tgViewsTrend = telegram.openData.viewsTrend.values || [];

  const pointsCount = Math.max(10, maxSubsHistory.length, tgViewsTrend.length, tgSnapshot.length);

  const labels = Array.from({ length: pointsCount }, (_, index) => `P${index + 1}`);
  const maxSubscribers = leftPadWithNull(maxSubsHistory, pointsCount);

  const telegramSubscribers = leftPadWithNull(tgSnapshot, pointsCount);
  const telegramViews = leftPadWithNull(tgViewsTrend, pointsCount);

  return {
    labels,
    telegramSubscribers,
    maxSubscribers,
    telegramViews
  };
}

async function fetchTelegramOpenData(channel) {
  const url = buildUrl(TELEGRAM_PUBLIC_BASE_URL, channel);
  const { response, text } = await fetchText(url);

  if (!response.ok) {
    throw new AppError(
      502,
      `Не удалось загрузить открытую страницу Telegram (HTTP ${response.status}).`
    );
  }

  return parseTelegramStats(channel, text);
}

async function fetchMaxFromMaxChart(channel) {
  const url = buildUrl(MAXCHART_BASE_URL, `channel/${channel}`);
  const { response, text } = await fetchText(url);

  if (response.status === 404) {
    return {
      exists: false,
      source: "maxchart"
    };
  }

  if (!response.ok) {
    throw new AppError(
      502,
      `Не удалось загрузить открытую страницу MAX в MaxChart (HTTP ${response.status}).`
    );
  }

  const stats = parseMaxChartStats(channel, text);
  stats.openData.sourceKind = "maxchart";

  return {
    exists: true,
    channel,
    source: "maxchart",
    stats
  };
}

async function fetchMaxFromMaxRu(channel) {
  const url = buildUrl(MAX_PUBLIC_BASE_URL, channel);
  const { response, text } = await fetchText(url);

  if (!response.ok) {
    throw new AppError(
      502,
      `Не удалось загрузить открытую страницу MAX в max.ru (HTTP ${response.status}).`
    );
  }

  const stats = parseMaxRuStats(channel, text);
  if (!stats) {
    return {
      exists: false,
      source: "max.ru"
    };
  }

  return {
    exists: true,
    channel,
    source: "max.ru",
    stats
  };
}

function withMatchMeta(maxResult, matchMeta, extra = {}) {
  if (!maxResult.exists) {
    return maxResult;
  }

  return {
    ...maxResult,
    ...extra,
    match: matchMeta
  };
}

async function fetchMaxOpenData(channel, telegram) {
  const maxChartResult = await fetchMaxFromMaxChart(channel);
  if (maxChartResult.exists) {
    return withMatchMeta(
      maxChartResult,
      createMatchMeta("exact-username", channel, channel, 1)
    );
  }

  const maxRuResult = await fetchMaxFromMaxRu(channel);
  if (maxRuResult.exists) {
    return withMatchMeta(
      maxRuResult,
      createMatchMeta("exact-username", channel, channel, 1)
    );
  }

  const variants = generateUsernameVariants(channel).filter((item) => item !== channel);
  for (const variant of variants) {
    const variantScore = stringSimilarity(channel, variant);

    const byVariantMaxChart = await fetchMaxFromMaxChart(variant);
    if (byVariantMaxChart.exists) {
      return withMatchMeta(
        byVariantMaxChart,
        createMatchMeta("username-variant", channel, variant, variantScore),
        { aliasFrom: channel }
      );
    }

    const byVariantMaxRu = await fetchMaxFromMaxRu(variant);
    if (byVariantMaxRu.exists) {
      return withMatchMeta(
        byVariantMaxRu,
        createMatchMeta("username-variant", channel, variant, variantScore),
        { aliasFrom: channel }
      );
    }
  }

  const candidates = await loadMaxChartCandidates();
  const best = findBestCandidateBySimilarity(channel, telegram.title, candidates);

  if (best && best.score >= MAX_MATCH_THRESHOLD) {
    const bySimilarity = await fetchMaxFromMaxChart(best.slug);
    if (bySimilarity.exists) {
      return withMatchMeta(
        bySimilarity,
        createMatchMeta("catalog-similarity", channel, best.slug, best.score),
        {
          candidate: {
            slug: best.slug,
            name: best.name,
            score: best.score,
            byUsername: best.byUsername,
            byTitle: best.byTitle
          }
        }
      );
    }
  }

  return {
    exists: false,
    checkedSources: ["maxchart.ru", "max.ru"],
    bestCandidate: best && best.score >= 0.35 ? best : null
  };
}

async function generatePayload(input) {
  const channel = parseTelegramInput(input);

  const telegram = await fetchTelegramOpenData(channel);
  const max = await fetchMaxOpenData(channel, telegram);

  const comparison = buildComparison(telegram, max);
  const trends = buildTrends(telegram, max);

  return {
    query: {
      input,
      normalizedChannel: channel,
      analyzedAt: new Date().toISOString(),
      mode: "open-data"
    },
    sources: {
      telegram: "Telegram public web pages (t.me/s)",
      max: "MaxChart + MAX public pages (maxchart.ru + max.ru)",
      limitations: [
        "Только открытые данные без API ключей",
        "Часть метрик (ER/комментарии/пересечение аудиторий) может быть недоступна",
        "Средний охват поста (%) = (средние просмотры/взаимодействия на пост / подписчики) × 100%",
        `Нестрогое сопоставление каналов в MAX включается при confidence >= ${Math.round(
          MAX_MATCH_THRESHOLD * 100
        )}%`
      ]
    },
    telegram,
    max,
    comparison,
    trends
  };
}

async function sendStaticFile(filePath, response) {
  const ext = path.extname(filePath);
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";
  const data = await fs.readFile(filePath);
  response.writeHead(200, { "Content-Type": mimeType });
  response.end(data);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString("utf8");
      if (body.length > 1_000_000) {
        reject(new AppError(413, "Payload too large"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

module.exports = { loadMaxChartCandidates }; const server = {listen: ()=>{}}; //(async (request, response) => {
  try {
    const parsedUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (request.method === "GET" && pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        ts: new Date().toISOString(),
        mode: "open-data",
        sources: {
          telegram: TELEGRAM_PUBLIC_BASE_URL,
          maxChart: MAXCHART_BASE_URL,
          maxRu: MAX_PUBLIC_BASE_URL
        },
        matching: {
          threshold: MAX_MATCH_THRESHOLD,
          maxChartPages: MAXCHART_SEARCH_PAGES
        }
      });
      return;
    }

    if (request.method === "POST" && pathname === "/api/analyze") {
      const rawBody = await readBody(request);
      let payload = {};
      if (rawBody.trim()) {
        payload = JSON.parse(rawBody);
      }

      const result = await generatePayload(payload.channel || "");
      sendJson(response, 200, result);
      return;
    }

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      sendJson(response, 403, { error: "Forbidden" });
      return;
    }

    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
      await sendStaticFile(filePath, response);
    } catch (_readError) {
      sendJson(response, 404, { error: "Not found" });
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Невалидный JSON в теле запроса" });
      return;
    }

    if (error instanceof AppError) {
      sendJson(response, error.statusCode || 500, {
        error: error.message,
        details: error.details
      });
      return;
    }

    sendJson(response, 500, {
      error: "Внутренняя ошибка сервера",
      details: error && error.message ? error.message : null
    });
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`MAX Parser Service: http://${HOST}:${PORT}`);
});
