import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const token = process.env.BOT_TOKEN;

if (!token) {
    console.error('BOT_TOKEN is not set in the environment.');
    process.exit(1);
}

const clearWebhookAndUpdates = async () => {
    try {
        const bot = new TelegramBot(token, { polling: false });

        console.log('Getting current webhook info...');
        const webhookInfo = await bot.getWebHookInfo();
        console.log('Current webhook:', webhookInfo);

        console.log('\nDeleting webhook and dropping pending updates...');
        await bot.deleteWebHook({ drop_pending_updates: true });

        console.log('✅ Webhook cleared successfully!');
        console.log('\nWaiting 5 seconds for Telegram to release the connection...');

        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('✅ Done! You can now start your bot.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

clearWebhookAndUpdates();
