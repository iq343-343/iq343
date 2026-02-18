import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';


const app = express();
const port = 3000;

app.use(cors());

app.get('/api/channel', async (req, res) => {
    try {
        const { name } = req.query;
        if (!name) {
            return res.status(400).json({ error: 'Channel name is required' });
        }

        // Clean up channel name (remove @, t.me/, etc)
        const cleanName = name.replace('@', '').replace('t.me/', '').replace('https://', '').split('/')[0];
        const url = `https://t.me/s/${cleanName}`;

        console.log(`Fetching data for: ${cleanName} from ${url}`);

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://t.me/',
            }
        });
        const html = response.data;
        const $ = cheerio.load(html);

        // Parse Subscriber Count
        // Try multiple selectors
        let extraText = $('.tgme_page_extra').text().trim();
        if (!extraText) {
            extraText = $('.tgme_header_counter').text().trim();
        }

        let subscribers = 0;

        if (extraText) {
            const subsPart = extraText.split(' subscriber')[0].split(' member')[0];

            if (subsPart.includes('K')) {
                subscribers = parseFloat(subsPart.replace('K', '').replace(' ', '')) * 1000;
            } else if (subsPart.includes('M')) {
                subscribers = parseFloat(subsPart.replace('M', '').replace(' ', '')) * 1000000;
            } else {
                subscribers = parseInt(subsPart.replace(/\s/g, ''), 10);
            }
        }

        // Parse Average Views (from visible posts)
        let totalViews = 0;
        let postCount = 0;

        $('.tgme_widget_message_views').each((i, el) => {
            const viewsText = $(el).text().trim();
            let views = 0;

            if (viewsText.includes('K')) {
                views = parseFloat(viewsText.replace('K', '')) * 1000;
            } else if (viewsText.includes('M')) {
                views = parseFloat(viewsText.replace('M', '')) * 1000000;
            } else {
                views = parseInt(viewsText.replace(/\s/g, ''), 10);
            }

            if (!isNaN(views)) {
                totalViews += views;
                postCount++;
            }
        });

        const avgViews = postCount > 0 ? Math.round(totalViews / postCount) : 0;

        // Generate Mock History based on real current subscriber count
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

        if (!subscribers) {
            console.log('Failed to parse subscribers. HTML preview might be blocked or changed.');
            return res.status(404).json({ error: 'Channel not found or data hidden' });
        }

        res.json({
            username: `@${cleanName}`,
            subscribers,
            growthToday,
            growthMonth,
            avgViews,
            history
        });

    } catch (error) {
        console.error('Error fetching channel data:', error.message);
        res.status(500).json({ error: 'Failed to fetch channel data' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
