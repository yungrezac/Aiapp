// Импортируем необходимые модули
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

// --- Конфигурация и Проверка ---
// Все секретные данные берутся из переменных окружения Vercel.
const {
    YOOKASSA_SHOP_ID,
    YOOKASSA_SECRET_KEY,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
} = process.env;

// **ВАЖНАЯ ПРОВЕРКА**: Убедимся, что все переменные окружения загружены.
if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("КРИТИЧЕСКАЯ ОШИБКА: Одна или несколько переменных окружения не установлены!");
    console.error("Проверьте настройки проекта на Vercel -> Settings -> Environment Variables.");
    // Завершаем работу, если конфигурация неполная
    // (Это не остановит сервер Vercel, но предотвратит выполнение кода с ошибками)
}

const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3/payments';

// --- Инициализация ---
const app = express();
// Инициализируем Supabase только если ключи существуют
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Маршруты API ---
const router = express.Router();

// Маршрут для создания платежа: /api/create-payment
router.post('/create-payment', async (req, res) => {
    // Дополнительная проверка, что все настроено перед обработкой запроса
    if (!supabase || !YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
        return res.status(500).json({ error: "Сервер не сконфигурирован. Проверьте переменные окружения." });
    }

    try {
        const { userId, amount, description, botUsername, appName } = req.body;

        if (!userId || !amount || !description || !botUsername || !appName) {
            return res.status(400).json({ error: 'Отсутствуют обязательные поля' });
        }
        
        const idempotenceKey = uuidv4();
        const returnUrl = `https://t.me/${botUsername}/${appName}`;

        const paymentData = {
            amount: {
                value: amount.toFixed(2),
                currency: 'RUB'
            },
            confirmation: {
                type: 'redirect',
                return_url: returnUrl
            },
            capture: true,
            description: description,
            metadata: {
                userId: userId
            }
        };

        const authHeader = 'Basic ' + Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

        const yookassaResponse = await fetch(YOOKASSA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Idempotence-Key': idempotenceKey,
                'Authorization': authHeader
            },
            body: JSON.stringify(paymentData)
        });

        const responseData = await yookassaResponse.json();

        if (!yookassaResponse.ok) {
            console.error('Ошибка от YooKassa:', responseData);
            throw new Error(responseData.description || 'Не удалось создать платеж');
        }

        res.json({ confirmationUrl: responseData.confirmation.confirmation_url });

    } catch (error) {
        console.error('Ошибка в /create-payment:', error);
        res.status(500).json({ error: error.message });
    }
});

// Маршрут для вебхуков от YooKassa: /api/yookassa-webhook
router.post('/yookassa-webhook', async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ error: "Сервер не сконфигурирован." });
    }

    try {
        const notification = req.body;
        console.log('Получен вебхук от YooKassa:', notification);

        if (notification?.event === 'payment.succeeded' && notification?.object?.status === 'succeeded') {
            const paymentObject = notification.object;
            const userId = paymentObject.metadata.userId;

            if (!userId) {
                console.error('В метаданных платежа отсутствует userId!');
                return res.status(200).send('OK, no userId');
            }

            const subscriptionEndDate = new Date();
            subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);

            const { error } = await supabase
                .from('profiles')
                .update({
                    subscription_is_active: true,
                    subscription_end_date: subscriptionEndDate.toISOString(),
                })
                .eq('id', userId);

            if (error) {
                console.error(`Ошибка обновления профиля для пользователя ${userId}:`, error);
            } else {
                console.log(`Подписка для пользователя ${userId} успешно активирована.`);
            }
        }
        
        res.status(200).send('OK');

    } catch (error) {
        console.error('Ошибка в /yookassa-webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Подключаем роутер к основному приложению
app.use('/api', router);

// Экспортируем приложение для Vercel
export default app;
