import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let client = null;

export const initMTProtoClient = async (apiId, apiHash) => {
    if (client) {
        return client;
    }

    const stringSession = new StringSession(''); // Empty session for bot

    client = new TelegramClient(
        stringSession,
        parseInt(apiId),
        apiHash,
        {
            connectionRetries: 5,
            useWSS: false,
        }
    );

    // Start client with bot token
    await client.start({
        botAuthToken: process.env.BOT_TOKEN,
    });

    console.log('✅ MTProto client initialized successfully');

    return client;
};

export const getMTProtoClient = () => {
    if (!client) {
        throw new Error('MTProto client not initialized. Call initMTProtoClient first.');
    }
    return client;
};

export default { initMTProtoClient, getMTProtoClient };
