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
    if (isError) {
        statusPanel.setAttribute("data-error", "true");
    } else {
        statusPanel.removeAttribute("data-error");
    }
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

function formatSignedNumber(value) {
    if (!hasNumber(value)) return "н/д";
    return `${value > 0 ? "+" : ""}${formatMetric(value, "integer")}`;
}

function buildKpiCard(title, value, note = "") {
    const card = document.createElement("div");
    card.className = "bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 ring-1 ring-white/10 flex flex-col justify-between transition hover:bg-slate-800/80";
    card.innerHTML = `
      <div>
        <span class="text-slate-400 text-[10px] font-medium uppercase tracking-wider block mb-2 break-words line-clamp-2">${title}</span>
        <div class="text-lg md:text-xl font-bold text-white break-words">${value}</div>
      </div>
      ${note ? `<div class="text-[10px] text-slate-500 mt-3 pt-2 border-t border-slate-700/50 leading-loose break-words">${note}</div>` : ""}
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

    const buildOverviewCard = (platform, data, exists, colorTheme) => {
        if (!exists) {
            return `
            <div class="bg-slate-800/40 backdrop-blur-md rounded-3xl p-6 ring-1 ring-white/10 flex flex-col justify-center text-center items-center">
              <div class="text-slate-500 mb-2 font-display uppercase tracking-widest text-xs">MAX</div>
              <h3 class="text-xl font-bold text-white mb-2">Канал не найден</h3>
              <p class="text-sm text-slate-400">Сервис не нашёл канал в открытых источниках MAX.</p>
            </div>`;
        }
        const platformIcon = platform === "Telegram"
            ? `<img src="./images/ikon/Логотип Telegram.png" alt="Telegram Icon" class="w-4 h-4 object-contain opacity-90">`
            : `<img src="./images/ikon/Иконка Макс 2025.png" alt="MAX Icon" class="w-4 h-4 object-contain opacity-90">`;

        return `
        <div class="bg-slate-800/40 backdrop-blur-md rounded-3xl p-6 ring-1 ring-white/10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div class="relative flex-shrink-0">
                <img src="${data.avatarUrl || ""}" alt="${platform} avatar" class="w-20 h-20 rounded-2xl object-cover ring-2 ring-${colorTheme}-500/20 shadow-lg" onerror="this.style.display='none'" />
            </div>
            <div class="flex-1">
                <div class="flex items-center justify-center md:justify-start gap-2 mb-1">
                    <h2 class="text-xl font-bold text-white font-display leading-tight">${data.title || `@${data.channel}`}</h2>
                </div>
                <div class="flex items-center justify-center md:justify-start gap-1.5 text-${colorTheme}-400 font-medium text-sm mb-3">
                    <span>@${data.channel || ""} • ${platform}</span>
                    ${platformIcon}
                </div>
                <p class="text-slate-400 text-xs leading-relaxed max-w-lg mb-4 line-clamp-2">${truncateText(data.description, 140)}</p>
                <div class="flex flex-wrap items-center justify-center md:justify-start gap-4">
                    <a href="${data.publicUrl || "#"}" target="_blank" rel="noopener" class="text-sm font-medium px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition ring-1 ring-white/10">Открыть канал</a>
                    <div class="flex gap-4 text-xs">
                       <span class="text-slate-400">Подписчики: <b class="text-white">${formatMetric(data.subscribers, "compact")}</b></span>
                       <span class="text-slate-400">ER: <b class="text-white">${formatMetric(data.avgPostReachPct, "percent")}</b></span>
                    </div>
                </div>
            </div>
        </div>`;
    };

    channelOverview.innerHTML = `
      ${buildOverviewCard("Telegram", tg, true, "blue")}
      ${buildOverviewCard("MAX", mx, !!mx, "purple")}
    `;
}

function fillTelegramCards(data) {
    telegramCards.innerHTML = "";
    const cards = [
        buildKpiCard("Канал", data.title || `@${data.channel}`),
        buildKpiCard("Подписчики", formatMetric(data.subscribers, "integer")),
        buildKpiCard("Средние просмотры", formatMetric(data.avgViews, "integer")),
        buildKpiCard("Средние реакции", formatMetric(data.avgReactions, "integer")),
        buildKpiCard("ER (Engagement Rate)", formatMetric(data.avgPostReachPct, "percent")),
        buildKpiCard("Рост за 30 дней", hasNumber(data.growth30d) ? `${formatSignedPercent(data.growth30d)} (${formatSignedNumber(data.growth30dValue)} чел.)` : "н/д"),
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
        winnerTag.classList.add("bg-blue-500/20", "text-blue-400");
    } else if (data.bestPlatform === "max") {
        winnerTag.textContent = winnerMap.max;
        winnerTag.classList.add("bg-purple-500/20", "text-purple-400");
    } else {
        winnerTag.textContent = "Сравнение";
        winnerTag.classList.add("bg-slate-700", "text-slate-300");
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
        card.className = "bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 ring-1 ring-white/10";
        card.innerHTML = `
      <div class="text-slate-400 text-[9px] uppercase font-medium tracking-wider mb-2 break-words line-clamp-2">${item.title}</div>
      <div class="text-base md:text-lg font-bold text-white break-words">${item.value}</div>
    `;
        comparisonGrid.appendChild(card);
    });
}

// Canvas helpers removed, chart is now constructed via HTML DOM.

function drawBarsChart(payload) {
    const container = document.getElementById("barsChartContainer");
    if (!container) return;

    container.innerHTML = "";

    const maxStats = payload.max.exists ? payload.max.stats : {};

    const metrics = [
        { label: "Подписчики", tg: payload.telegram.subscribers, mx: maxStats.subscribers, format: "integer" },
        { label: "Сред. охват", tg: payload.telegram.avgViews, mx: maxStats.avgViews, format: "integer" },
        { label: "Охват (%)", tg: payload.telegram.avgPostReachPct, mx: maxStats.avgPostReachPct, format: "percent" }
    ];

    const allValues = metrics.flatMap((m) => [m.tg, m.mx]).filter((value) => hasNumber(value));
    if (!allValues.length) {
        container.innerHTML = `<div class="w-full h-full flex items-center justify-center text-slate-400 text-sm md:text-lg text-center font-display">Недостаточно открытых данных для сравнения KPI</div>`;
        return;
    }

    const maxValue = Math.max(...allValues) * 1.15; // 15% headroom

    const grid = document.createElement('div');
    grid.className = "w-full h-full flex justify-between gap-2 md:gap-8 pb-8 border-b border-slate-700 relative";

    metrics.forEach(metric => {
        const group = document.createElement('div');
        group.className = "flex-1 flex flex-col justify-end items-center relative h-full gap-2";

        const barsWrapper = document.createElement('div');
        barsWrapper.className = "w-full flex items-end justify-center gap-1 md:gap-3 h-full";

        // Telegram Bar
        const tgValue = hasNumber(metric.tg) ? metric.tg : 0;
        const tgHeightPct = maxValue > 0 ? (tgValue / maxValue) * 100 : 0;
        const tgBar = document.createElement('div');
        tgBar.className = "w-1/2 max-w-[50px] bg-blue-500 rounded-t-md relative group transition-all duration-500 flex flex-col justify-end items-center";
        tgBar.style.height = `${Math.max(tgHeightPct, 2)}%`;
        if (hasNumber(metric.tg)) {
            const label = document.createElement('span');
            label.className = "absolute -top-6 text-[10px] md:text-xs font-bold text-white whitespace-nowrap";
            label.textContent = formatMetric(metric.tg, metric.format);
            tgBar.appendChild(label);
        }

        // Max Bar
        const mxValue = hasNumber(metric.mx) ? metric.mx : 0;
        const mxHeightPct = maxValue > 0 ? (mxValue / maxValue) * 100 : 0;
        const mxBar = document.createElement('div');
        mxBar.className = "w-1/2 max-w-[50px] bg-purple-500 rounded-t-md relative group transition-all duration-500 flex flex-col justify-end items-center";
        mxBar.style.height = `${Math.max(mxHeightPct, 2)}%`;
        if (hasNumber(metric.mx)) {
            const label = document.createElement('span');
            label.className = "absolute -top-6 text-[10px] md:text-xs font-bold text-white whitespace-nowrap";
            label.textContent = formatMetric(metric.mx, metric.format);
            mxBar.appendChild(label);
        }

        barsWrapper.appendChild(tgBar);
        barsWrapper.appendChild(mxBar);
        group.appendChild(barsWrapper);

        const groupLabel = document.createElement('div');
        groupLabel.className = "absolute -bottom-8 w-full text-center text-[10px] md:text-[13px] text-slate-300 font-medium break-words leading-tight";
        groupLabel.textContent = metric.label;
        group.appendChild(groupLabel);

        grid.appendChild(group);
    });

    container.appendChild(grid);

    // Legend
    const legend = document.createElement('div');
    legend.className = "absolute top-0 right-0 flex gap-4 text-[10px] md:text-xs font-medium text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-full ring-1 ring-white/10 z-10";
    legend.innerHTML = `
        <div class="flex items-center gap-2"><div class="w-3 h-3 bg-blue-500 rounded-full"></div>Telegram</div>
        <div class="flex items-center gap-2"><div class="w-3 h-3 bg-purple-500 rounded-full"></div>MAX</div>
    `;
    container.appendChild(legend);
}

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
    const response = await fetch("/scope/api/analyze", {
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

// Telegram-style Accordion Animation Logic
document.querySelectorAll('details').forEach((el) => {
    const summary = el.querySelector('summary');
    const content = el.querySelector('summary ~ *');

    if (!summary || !content) return;

    summary.addEventListener('click', (e) => {
        // Only handle closing (when it's already open)
        if (el.hasAttribute('open')) {
            e.preventDefault(); // Stop immediate close

            // Add closing class to trigger CSS animation
            el.classList.add('closing');

            // Wait for animation to finish then actually remove the open attribute
            const onAnimationEnd = () => {
                el.removeAttribute('open');
                el.classList.remove('closing');
                content.removeEventListener('animationend', onAnimationEnd);
            };

            content.addEventListener('animationend', onAnimationEnd);
        }
    });
});
