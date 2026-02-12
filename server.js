const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios'); // We'll use axios instead of node-fetch for easier usage
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Serve static files from current directory

// Telegram Config
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Route to handle form submission
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
