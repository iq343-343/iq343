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

const server = http.createServer(async (request, response) => {
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

loadMaxChartCandidates().then(cands => {
    console.log('Total candidates:', cands.length);
    console.log('Has aquagizer:', cands.find(c => c.slug.includes('aquagizer')));
});
