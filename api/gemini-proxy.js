// Файл: api/gemini-proxy.js
// Эта серверная функция будет принимать запросы от вашего приложения,
// безопасно добавлять API-ключ и перенаправлять их в Google Gemini из США.

export default async function handler(req, res) {
    // Разрешаем CORS, чтобы ваше приложение могло делать запросы
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Отвечаем на предварительные запросы OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Проверяем, что это POST-запрос
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Получаем API-ключ из переменных окружения Vercel (это безопасно)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('Ключ GEMINI_API_KEY не установлен в переменных окружения Vercel.');
        return res.status(500).json({ error: 'Ошибка конфигурации сервера.' });
    }

    try {
        // Получаем промпт из тела запроса, который пришел от фронтенда
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Требуется указать промпт.' });
        }

        // Формируем URL и тело запроса к настоящему API Gemini
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ parts: [{ text: prompt }] }]
        };

        // Отправляем запрос от имени нашего сервера в США
        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await apiResponse.json();

        // Если Gemini вернул ошибку, пересылаем ее на фронтенд
        if (!apiResponse.ok) {
            console.error('Ошибка от API Gemini:', data);
            const errorMessage = data.error?.message || `HTTP ошибка: ${apiResponse.status}`;
            return res.status(apiResponse.status).json({ error: errorMessage });
        }
        
        // Отправляем успешный ответ от Gemini обратно в приложение
        res.status(200).json(data);

    } catch (error) {
        console.error('Ошибка в прокси-функции:', error);
        res.status(500).json({ error: 'Произошла внутренняя ошибка сервера.' });
    }
}
