const form = document.getElementById("analyzeForm");
const channelInput = document.getElementById("channelInput");
const analyzeButton = document.getElementById("analyzeButton");
const statusPanel = document.getElementById("statusPanel");
const sharePanel = document.getElementById("sharePanel");
const shareLinkInput = document.getElementById("shareLinkInput");
const shareButton = document.getElementById("shareButton");
const copyLinkButton = document.getElementById("copyLinkButton");
const results = document.getElementById("results");

const telegramCards = document.getElementById("telegramCards");
const maxCards = document.getElementById("maxCards");
const maxMissing = document.getElementById("maxMissing");
const channelOverview = document.getElementById("channelOverview");
const winnerTag = document.getElementById("winnerTag");
const comparisonSummary = document.getElementById("comparisonSummary");
const comparisonGrid = document.getElementById("comparisonGrid");

const barsCanvas = document.getElementById("barsCanvas");
const chartTooltip = document.createElement("div");
chartTooltip.className = "chart-tooltip hidden";
document.body.appendChild(chartTooltip);

let barsHoverRects = [];

const numberFmt = new Intl.NumberFormat("ru-RU");
const compactFmt = new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1
});

function hasNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function setStatus(message, isError = false) {
    statusPanel.textContent = message;
    statusPanel.classList.remove("hidden");
    statusPanel.classList.toggle("error", isError);
}

function hideStatus() {
    statusPanel.classList.add("hidden");
}

function normalizeChannelForUrl(channel) {
    return String(channel || "").trim().replace(/^@/, "");
}

function buildShareUrl(channel) {
    const url = new URL(window.location.href);
    const normalized = normalizeChannelForUrl(channel);
    if (normalized) {
        url.searchParams.set("channel", normalized);
    } else {
        url.searchParams.delete("channel");
    }
    return url.toString();
}

function updateShareLink(channel) {
    const link = buildShareUrl(channel);
    shareLinkInput.value = link;
    sharePanel.classList.remove("hidden");
}

async function copyShareLink() {
    const text = shareLinkInput.value.trim();
    if (!text) return false;

    try {
        await navigator.clipboard.writeText(text);
        setStatus("Ссылка скопирована в буфер обмена.");
        return true;
    } catch (_err) {
        shareLinkInput.focus();
        shareLinkInput.select();
        const copied = document.execCommand("copy");
        if (copied) {
            setStatus("Ссылка скопирована в буфер обмена.");
            return true;
        }
        setStatus("Не удалось скопировать ссылку. Скопируйте вручную.", true);
        return false;
    }
}

function formatMetric(value, type = "number") {
    if (!hasNumber(value)) return "н/д";
    if (type === "percent") return `${value}%`;
    if (type === "compact") return compactFmt.format(value);
    if (type === "integer") return numberFmt.format(Math.round(value));
    return numberFmt.format(value);
}

function formatSignedPercent(value) {
    if (!hasNumber(value)) return "н/д";
    return `${value > 0 ? "+" : ""}${value}%`;
}

function buildKpiCard(title, value, note = "") {
    const card = document.createElement("div");
    card.className = "kpi-card";
    card.innerHTML = `
    <span class="kpi-title">${title}</span>
    <span class="kpi-value">${value}</span>
    ${note ? `<div class="kpi-note">${note}</div>` : ""}
  `;
    return card;
}

function truncateText(text, maxLen = 220) {
    const normalized = String(text || "").trim();
    if (!normalized) return "Описание не найдено в открытых источниках.";
    if (normalized.length <= maxLen) return normalized;
    return `${normalized.slice(0, maxLen - 1)}…`;
}

function renderChannelOverview(payload) {
    const tg = payload.telegram;
    const mx = payload.max.exists ? payload.max.stats : null;

    const tgCard = `
    <article class="overview-card tg-overview">
      <div class="overview-head">
        <img class="overview-avatar" src="${tg.avatarUrl || ""}" alt="Telegram avatar" onerror="this.style.display='none'"/>
        <div>
          <div class="overview-platform">Telegram</div>
          <h3>${tg.title || `@${tg.channel}`}</h3>
          <a class="overview-link" href="${tg.publicUrl || "#"}" target="_blank" rel="noopener">Открыть канал</a>
        </div>
      </div>
      <p class="overview-desc">${truncateText(tg.description)}</p>
      <div class="overview-metrics">
        <span>Подписчики: <b>${formatMetric(tg.subscribers, "integer")}</b></span>
        <span>ER (Reach): <b>${formatMetric(tg.avgPostReachPct, "percent")}</b></span>
      </div>
    </article>
  `;

    const mxCard = mx
        ? `
    <article class="overview-card max-overview">
      <div class="overview-head">
        <img class="overview-avatar" src="${mx.avatarUrl || ""}" alt="MAX avatar" onerror="this.style.display='none'"/>
        <div>
          <div class="overview-platform">MAX</div>
          <h3>${mx.title || `@${mx.channel}`}</h3>
          <a class="overview-link" href="${mx.publicUrl || "#"}" target="_blank" rel="noopener">Открыть канал</a>
        </div>
      </div>
      <p class="overview-desc">${truncateText(mx.description)}</p>
      <div class="overview-metrics">
        <span>Подписчики: <b>${formatMetric(mx.subscribers, "integer")}</b></span>
        <span>ER (Reach): <b>${formatMetric(mx.avgPostReachPct, "percent")}</b></span>
      </div>
    </article>
  `
        : `
    <article class="overview-card max-overview">
      <div class="overview-head">
        <div>
          <div class="overview-platform">MAX</div>
          <h3>Канал не найден</h3>
        </div>
      </div>
      <p class="overview-desc">Сервис не нашёл канал в открытых источниках MAX (maxchart.ru и max.ru).</p>
      <div class="overview-metrics">
        <span>Проверьте username или используйте похожий вариант имени канала.</span>
      </div>
    </article>
  `;

    channelOverview.innerHTML = `${tgCard}${mxCard}`;
}

function fillTelegramCards(data) {
    telegramCards.innerHTML = "";
    const cards = [
        buildKpiCard("Канал", data.title || `@${data.channel}`),
        buildKpiCard("Подписчики", formatMetric(data.subscribers, "integer")),
        buildKpiCard("Средние просмотры", formatMetric(data.avgViews, "integer")),
        buildKpiCard("Средние реакции", formatMetric(data.avgReactions, "integer")),
        buildKpiCard("ER (Engagement Rate)", formatMetric(data.avgPostReachPct, "percent")),
        buildKpiCard("Рост за 30 дней", `${formatMetric(data.growth30d, "percent")} (+${formatMetric(data.growth30dValue, "integer")} чел.)`),
        buildKpiCard(
            "Постов в неделю",
            formatMetric(data.postsPerWeek, "number"),
            `В открытой выборке: ${formatMetric(data.openData?.sampledPosts, "integer")}`
        )
    ];
    cards.forEach((card) => telegramCards.appendChild(card));
}

function fillMaxCards(maxData) {
    maxCards.innerHTML = "";
    maxMissing.classList.add("hidden");

    if (!maxData.exists) {
        const suggestion = maxData.bestCandidate
            ? `Возможный кандидат: @${maxData.bestCandidate.slug} (${Math.round(
                (maxData.bestCandidate.score || 0) * 100
            )}%)`
            : "Совпадения по имени в каталоге не обнаружены";

        const placeholderCards = [
            buildKpiCard("Канал в MAX", "Не найден", "Проверено в maxchart.ru и max.ru"),
            buildKpiCard("Статус сравнения", "Только Telegram", "Сопоставление невозможно без канала в MAX"),
            buildKpiCard("Похожий канал", suggestion)
        ];
        placeholderCards.forEach((card) => maxCards.appendChild(card));
        maxMissing.innerHTML =
            "Канал с этим username не найден в открытых источниках MAX (maxchart.ru и max.ru).";
        maxMissing.classList.remove("hidden");
        return;
    }

    const stats = maxData.stats;
    const sourceKind = stats.openData?.sourceKind === "max.ru" ? "Источник: max.ru" : "Источник: maxchart.ru";
    const match = maxData.match;
    const matchNote = match
        ? `Матч: ${match.confidencePct}% (${match.strategy})`
        : sourceKind;
    const cards = [
        buildKpiCard("Канал MAX", `@${stats.channel || maxData.channel}`, `${sourceKind}; ${matchNote}`),
        buildKpiCard("Подписчики", formatMetric(stats.subscribers, "integer")),
        buildKpiCard("Средние просмотры", formatMetric(stats.avgViews, "integer")),
        buildKpiCard("Средние реакции", formatMetric(stats.avgReactions, "integer")),
        buildKpiCard("ER (Engagement Rate)", formatMetric(stats.avgPostReachPct, "percent")),
        buildKpiCard("Рост за 24 часа", formatMetric(stats.growth24h, "percent")),
        buildKpiCard("Упоминаний", formatMetric(maxData.openData?.mentionsCount, "integer")),
        buildKpiCard(
            "Постов в неделю",
            formatMetric(stats.postsPerWeek, "number"),
            `В открытой выборке: ${formatMetric(stats.openData?.sampledPosts, "integer")}`
        )
    ];
    cards.forEach((card) => maxCards.appendChild(card));
}

function fillComparison(data) {
    comparisonGrid.innerHTML = "";
    comparisonSummary.textContent = data.summary;
    winnerTag.className = "tag";

    const winnerMap = {
        telegram: "Лидер: Telegram",
        max: "Лидер: MAX"
    };

    if (data.bestPlatform === "telegram") {
        winnerTag.textContent = winnerMap.telegram;
        winnerTag.classList.add("winner-tg");
    } else if (data.bestPlatform === "max") {
        winnerTag.textContent = winnerMap.max;
        winnerTag.classList.add("winner-max");
    } else {
        winnerTag.textContent = "Сравнение";
        winnerTag.classList.add("neutral-tag");
    }

    const cards = [
        {
            title: "Разница по подписчикам",
            value: hasNumber(data.gap.subscribersGap)
                ? formatMetric(Math.abs(data.gap.subscribersGap), "compact")
                : "н/д"
        },
        {
            title: "Разница по охвату",
            value: formatSignedPercent(data.gap.reachGapPct)
        },
        {
            title: "Разница по росту",
            value: formatSignedPercent(data.gap.growthGapPct)
        }
    ];

    if (data.match) {
        cards.push({
            title: "Уверенность матчинга",
            value: `${data.match.confidencePct}% (${data.match.status})`
        });
    }

    if (data.scores) {
        cards.push(
            {
                title: "Скоринг Telegram",
                value: hasNumber(data.scores.telegram) ? data.scores.telegram.toFixed(1) : "н/д"
            },
            {
                title: "Скоринг MAX",
                value: hasNumber(data.scores.max) ? data.scores.max.toFixed(1) : "н/д"
            }
        );
    }

    cards.forEach((item) => {
        const card = document.createElement("div");
        card.className = "comparison-card";
        card.innerHTML = `
      <div class="title">${item.title}</div>
      <div class="value">${item.value}</div>
    `;
        comparisonGrid.appendChild(card);
    });
}

function drawAxes(ctx, width, height, padding) {
    ctx.strokeStyle = "rgba(160, 212, 230, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
}

function drawNoData(ctx, width, height, text) {
    ctx.fillStyle = "rgba(210, 238, 247, 0.78)";
    ctx.font = "18px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, width / 2, height / 2);
    ctx.textAlign = "left";
}

function hideChartTooltip() {
    chartTooltip.classList.add("hidden");
}

function showChartTooltip(x, y, title, value) {
    chartTooltip.innerHTML = `<div class="tt-title">${title}</div><div class="tt-value">${value}</div>`;
    chartTooltip.style.left = `${x + 14}px`;
    chartTooltip.style.top = `${y + 14}px`;
    chartTooltip.classList.remove("hidden");
}

function renderBarValueLabel(ctx, xCenter, yTop, value) {
    ctx.fillStyle = "rgba(225, 246, 255, 0.95)";
    ctx.font = "13px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(value, xCenter, Math.max(34, yTop - 8));
}

function drawBarsChart(payload) {
    const ctx = barsCanvas.getContext("2d");
    const { width, height } = barsCanvas;
    const padding = 52;
    barsHoverRects = [];
    ctx.clearRect(0, 0, width, height);
    drawAxes(ctx, width, height, padding);

    const maxStats = payload.max.exists ? payload.max.stats : {};

    const metrics = [
        {
            label: "Подписчики",
            tg: payload.telegram.subscribers,
            mx: maxStats.subscribers,
            format: "integer"
        },
        {
            label: "Сред. охват",
            tg: payload.telegram.avgViews,
            mx: maxStats.avgViews,
            format: "integer"
        },
        {
            label: "Охват (%)",
            tg: payload.telegram.avgPostReachPct,
            mx: maxStats.avgPostReachPct,
            format: "percent"
        }
    ];

    const allValues = metrics.flatMap((m) => [m.tg, m.mx]).filter((value) => hasNumber(value));
    if (!allValues.length) {
        drawNoData(ctx, width, height, "Недостаточно открытых данных для сравнения KPI");
        hideChartTooltip();
        return;
    }

    const maxValue = Math.max(...allValues) * 1.15;
    const barGroupWidth = (width - padding * 2) / metrics.length;
    const barWidth = 62;

    metrics.forEach((metric, i) => {
        const center = padding + barGroupWidth * i + barGroupWidth / 2;
        const tgValue = hasNumber(metric.tg) ? metric.tg : 0;
        const mxValue = hasNumber(metric.mx) ? metric.mx : 0;
        const tgH = (tgValue / maxValue) * (height - padding * 2);
        const mxH = (mxValue / maxValue) * (height - padding * 2);
        const tgX = center - barWidth - 10;
        const mxX = center + 10;
        const tgY = height - padding - tgH;
        const mxY = height - padding - mxH;

        ctx.fillStyle = "#66c9ff";
        ctx.fillRect(tgX, tgY, barWidth, tgH);

        ctx.fillStyle = "#b1ff82";
        ctx.fillRect(mxX, mxY, barWidth, mxH);

        if (hasNumber(metric.tg)) {
            renderBarValueLabel(ctx, tgX + barWidth / 2, tgY, formatMetric(metric.tg, metric.format));
        }
        if (hasNumber(metric.mx)) {
            renderBarValueLabel(ctx, mxX + barWidth / 2, mxY, formatMetric(metric.mx, metric.format));
        }

        barsHoverRects.push({
            x: tgX,
            y: tgY,
            w: barWidth,
            h: tgH,
            title: `Telegram • ${metric.label}`,
            value: formatMetric(metric.tg, metric.format)
        });
        barsHoverRects.push({
            x: mxX,
            y: mxY,
            w: barWidth,
            h: mxH,
            title: `MAX • ${metric.label}`,
            value: formatMetric(metric.mx, metric.format)
        });

        ctx.fillStyle = "rgba(225, 246, 255, 0.92)";
        ctx.font = "16px Manrope, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(metric.label, center, height - padding + 24);
    });

    ctx.textAlign = "left";
    ctx.fillStyle = "#66c9ff";
    ctx.fillRect(padding, 18, 14, 4);
    ctx.fillStyle = "rgba(215, 245, 255, 0.9)";
    ctx.fillText("Telegram", padding + 22, 24);
    ctx.fillStyle = "#b1ff82";
    ctx.fillRect(padding + 125, 18, 14, 4);
    ctx.fillStyle = "rgba(215, 245, 255, 0.9)";
    ctx.fillText("MAX", padding + 148, 24);
}

barsCanvas.addEventListener("mousemove", (event) => {
    const rect = barsCanvas.getBoundingClientRect();
    const scaleX = barsCanvas.width / rect.width;
    const scaleY = barsCanvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const hovered = barsHoverRects.find((item) => (
        x >= item.x &&
        x <= item.x + item.w &&
        y >= item.y &&
        y <= item.y + item.h
    ));

    if (!hovered) {
        hideChartTooltip();
        return;
    }

    showChartTooltip(event.clientX, event.clientY, hovered.title, hovered.value);
});

barsCanvas.addEventListener("mouseleave", () => {
    hideChartTooltip();
});

function render(payload) {
    results.classList.remove("revealed");
    // force reflow to replay stagger animation on fresh results
    void results.offsetWidth;
    renderChannelOverview(payload);
    fillTelegramCards(payload.telegram);
    fillMaxCards(payload.max);
    fillComparison(payload.comparison);
    drawBarsChart(payload);
    results.classList.remove("hidden");
    results.classList.add("revealed");

    const date = new Date(payload.query.analyzedAt).toLocaleString("ru-RU");
    updateShareLink(payload.query.normalizedChannel);
    setStatus(
        `Анализ открытых данных по @${payload.query.normalizedChannel} завершен (${date}). Источники: ${payload.sources.telegram} и ${payload.sources.max}.`
    );
}

async function analyze(channel) {
    const response = await fetch("/extrapars/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "Не удалось получить данные.");
    }
    return data;
}

async function runAnalyze(channel, pushState = true) {
    hideStatus();
    results.classList.remove("revealed");
    analyzeButton.disabled = true;
    analyzeButton.textContent = "Сравниваю...";

    try {
        const payload = await analyze(channel);
        render(payload);
        const normalized = payload.query?.normalizedChannel || normalizeChannelForUrl(channel);
        if (pushState && normalized) {
            const newUrl = buildShareUrl(normalized);
            window.history.replaceState({}, "", newUrl);
        }
    } catch (err) {
        results.classList.add("hidden");
        setStatus(err.message || "Ошибка запроса", true);
    } finally {
        analyzeButton.disabled = false;
        analyzeButton.textContent = "Сравнить";
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runAnalyze(channelInput.value.trim(), true);
});

copyLinkButton.addEventListener("click", async () => {
    await copyShareLink();
});

shareButton.addEventListener("click", async () => {
    const url = shareLinkInput.value.trim();
    if (!url) return;

    if (navigator.share) {
        try {
            await navigator.share({
                title: "Сравнение каналов Telegram и MAX",
                text: `Результат анализа канала @${normalizeChannelForUrl(channelInput.value)}`,
                url
            });
            return;
        } catch (_err) {
            // fallback to copy
        }
    }

    await copyShareLink();
});

window.addEventListener("DOMContentLoaded", async () => {
    const initialChannel = new URLSearchParams(window.location.search).get("channel");
    if (initialChannel) {
        channelInput.value = initialChannel.startsWith("@") ? initialChannel : `@${initialChannel}`;
        await runAnalyze(channelInput.value.trim(), false);
    }
});
