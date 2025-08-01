const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

// Обработка предварительного запроса (PreCheckoutQuery)
bot.on('pre_checkout_query', (ctx) => {
    // Подтверждаем, что готовы принять платеж
    return ctx.answerPreCheckoutQuery(true);
});

// Обработка успешного платежа
bot.on('successful_payment', async (ctx) => {
    console.log('Successful payment received:', ctx.message.successful_payment);
    
    // ВАЖНО: Здесь вы должны обновить данные пользователя в вашей базе данных
    const userId = ctx.message.from.id;
    const paymentInfo = ctx.message.successful_payment;


    console.log(`Subscription activated for user ${userId}`);
});

export default async function handler(req, res) {
    try {
        await bot.handleUpdate(req.body);
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Internal Server Error');
    }
}
