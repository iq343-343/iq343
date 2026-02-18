const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios'); // We'll use axios instead of node-fetch for easier usage
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const path = require('path');
const cheerio = require('cheerio');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve Extragram App
app.use('/extragram', express.static(path.join(__dirname, 'extragram/dist')));

// Serve main site
app.use(express.static(__dirname));

// Routing for /products
app.get('/products', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Telegram Config
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Utility to parse Telegram-style numbers (1.2K, 5M, etc.)
const parseTgNumber = (text) => {
    if (!text) return 0;
    const cleanText = text.replace(/\s/g, '').replace(' ', '');
    if (cleanText.includes('K')) {
        return parseFloat(cleanText.replace('K', '')) * 1000;
    }
    if (cleanText.includes('M')) {
        return parseFloat(cleanText.replace('M', '')) * 1000000;
    }
    return parseInt(cleanText, 10) || 0;
};

// Route for Extragram Channel Analytics
app.get('/api/channel', async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) {
            return res.status(400).json({ error: 'Channel name is required' });
        }

        // Clean up channel name
        const cleanName = name.replace('@', '').replace('t.me/', '').replace('https://', '').replace('http://', '').split('/')[0];
        const url = `https://telegram.me/s/${cleanName}`;

        console.log(`Fetching data for: ${cleanName} from ${url}`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://t.me/',
            }
        });
        const html = response.data;
        const $ = cheerio.load(html);

        // Core Metadata
        const title = $('.tgme_channel_info_header_title span').text().trim() ||
            $('.tgme_header_title span').text().trim() ||
            $('.tgme_page_title span').text().trim() ||
            $('.tgme_page_title').text().trim();

        const description = $('.tgme_channel_info_description').text().trim() ||
            $('.tgme_page_description').text().trim();

        const avatar = $('.tgme_page_photo_image img').attr('src') ||
            $('.tgme_page_photo_image').attr('src');

        const isVerified = $('.tgme_page_verified').length > 0 || $('.tgme_verified_badge').length > 0;

        // Parse Total Subscribers
        let extraText = $('.tgme_page_extra').text().trim();
        if (!extraText) {
            extraText = $('.tgme_header_counter').text().trim();
        }

        let subscribers = 0;
        if (extraText) {
            const subsPart = extraText.split(' subscriber')[0].split(' member')[0];
            subscribers = parseTgNumber(subsPart);
        }

        // Parse Average Views & Reactions from last 10 messages
        let totalViews = 0;
        let totalReactions = 0;
        let postsProcessed = 0;

        const messages = $('.tgme_widget_message').toArray().reverse().slice(0, 10);

        messages.forEach(el => {
            const $msg = $(el);

            // Views
            const viewsText = $msg.find('.tgme_widget_message_views').text().trim();
            if (viewsText) {
                totalViews += parseTgNumber(viewsText);
            }

            // Reactions
            let msgReactions = 0;
            $msg.find('.tgme_reaction').each((i, rel) => {
                const countText = $(rel).contents().filter(function () {
                    return this.nodeType === 3; // text node
                }).text().trim();
                msgReactions += parseTgNumber(countText);
            });
            totalReactions += msgReactions;

            postsProcessed++;
        });

        const avgViews = postsProcessed > 0 ? Math.round(totalViews / postsProcessed) : 0;
        const avgReactions = postsProcessed > 0 ? Math.round(totalReactions / postsProcessed) : 0;

        // Generate Mock History
        const history = [];
        const growthMonth = Math.floor(subscribers * 0.05);
        let currentSubs = subscribers - growthMonth;

        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dailyGrowth = Math.floor(growthMonth / 30) + (Math.floor(Math.random() * (growthMonth / 100)) - (growthMonth / 200));
            currentSubs += dailyGrowth;
            history.push({
                date: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
                subscribers: Math.round(currentSubs)
            });
        }

        history[history.length - 1].subscribers = subscribers;
        const growthToday = Math.floor(Math.random() * (subscribers * 0.005));

        if (!subscribers && !title) {
            return res.status(404).json({ error: 'Channel not found or data hidden' });
        }

        res.json({
            username: `@${cleanName}`,
            title,
            description,
            avatar,
            isVerified,
            subscribers,
            growthToday,
            growthMonth,
            avgViews,
            avgReactions,
            history
        });

    } catch (error) {
        console.error('Error fetching channel data:', error.message);
        res.status(500).json({ error: 'Failed to fetch channel data' });
    }
});

// Route to handle contact form submission
app.post('/api/contact', async (req, res) => {
    try {
        const { name, project, phone, telegram } = req.body;

        // Basic validation
        if (!name || !phone || !telegram) {
            return res.status(400).json({ success: false, message: 'Пожалуйста, заполните обязательные поля (Имя, Телефон, Telegram).' });
        }

        // Construct message for Telegram
        const message = `
🔔 <b>Новая заявка с сайта!</b>

👤 <b>Имя:</b> ${name}
🚀 <b>Проект:</b> ${project || 'Не указан'}
📱 <b>Телефон:</b> ${phone}
✈️ <b>Telegram:</b> ${telegram.startsWith('@') ? telegram : '@' + telegram}
        `;

        // Send to Telegram
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });

        res.json({ success: true, message: 'Заявка успешно отправлена!' });

    } catch (error) {
        console.error('Error sending to Telegram:', error);
        res.status(500).json({ success: false, message: 'Ошибка при отправке заявки. Попробуйте позже.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
