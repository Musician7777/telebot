import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import registerApkAnalyzer from './src/apkAnalyzer.js';
import { initMTProtoClient } from './src/mtprotoClient.js';

dotenv.config({ path: '.env' });

const token = process.env.BOT_TOKEN;
const resultChannelId = process.env.RESULT_CHANNEL_ID;
const apiId = process.env.API_ID;
const apiHash = process.env.API_HASH;
import http from 'http';

// Simple health check server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is alive!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});


if (!token) {
  console.error('BOT_TOKEN is not set in the environment.');
  process.exit(1);
}

if (!resultChannelId) {
  console.error('RESULT_CHANNEL_ID is not set in the environment.');
  process.exit(1);
}

if (!apiId || !apiHash) {
  console.error('API_ID and API_HASH are required for MTProto client.');
  process.exit(1);
}

// Create bot without polling initially
const bot = new TelegramBot(token, { polling: false });

const start = async () => {
  try {
    // Clear any existing webhook and pending updates to avoid 409 conflicts
    console.log('Clearing existing webhooks and pending updates...');
    await bot.deleteWebHook({ drop_pending_updates: true });

    // Wait a moment for Telegram to process the webhook deletion
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Initialize MTProto client for large file downloads
    console.log('Initializing MTProto client...');
    const mtprotoClient = await initMTProtoClient(apiId, apiHash);

    // Set up error handler before starting polling
    bot.on('polling_error', (error) => {
      console.error('Polling error:', error?.response?.body ?? error.message);
    });

    // Now start polling
    console.log('Starting bot polling...');
    await bot.startPolling();

    // Register the APK analyzer with MTProto client
    registerApkAnalyzer(bot, resultChannelId, mtprotoClient);

    console.log('✅ Bot is up and polling for channel posts.');
  } catch (err) {
    console.error('❌ Failed to start bot:', err.message);
    process.exit(1);
  }
};

start();

export default bot;
