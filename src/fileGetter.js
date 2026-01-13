import { TELEGRAM_FILE_BASE_URL } from "../constants.js";

const MAX_BOT_API_SIZE = 20 * 1024 * 1024; // 20MB in bytes

const fileGetter = async (bot, msg, mtprotoClient) => {
  const document = msg.document;

  if (!document) {
    return null;
  }

  const fileName = document.file_name ?? "";

  if (!/\.apk[s]?$/i.test(fileName)) {
    // console.log(`Skipping non-APK document (${fileName || "unnamed"}).`); // Removed log
    return null;
  }

  const fileSize = document.file_size ?? 0;

  // For files ≤20MB, use Bot API (faster and simpler)
  if (fileSize <= MAX_BOT_API_SIZE) {
    // console.log(`📥 Using Bot API for file (${(fileSize / 1024 / 1024).toFixed(2)}MB)`); // Removed log
    const file = await bot.getFile(document.file_id);
    const fileUrl = `${TELEGRAM_FILE_BASE_URL}${process.env.BOT_TOKEN}/${file.file_path}`;

    return {
      fileUrl,
      fileName,
      fileSize,
      mimeType: document.mime_type ?? "",
      buffer: null, // Will download via URL
    };
  }

  // For files >20MB, use MTProto client
  // console.log(`📥 Using MTProto for large file (${(fileSize / 1024 / 1024).toFixed(2)}MB)`); // Removed log

  try {
    // 1. Fetch the actual MTProto message
    // console.log('🔄 Fetching MTProto message object...'); // Removed log
    const messages = await mtprotoClient.getMessages(msg.chat.id, {
      ids: [msg.message_id],
    });

    if (!messages || messages.length === 0 || !messages[0].media) {
      throw new Error("Could not fetch message or media not found via MTProto");
    }

    const mtprotoMsg = messages[0];

    // 2. Download file using MTProto downloadMedia on the fetched message
    // console.log('📥 Starting MTProto download...'); // Removed log
    const buffer = await mtprotoClient.downloadMedia(mtprotoMsg, {
      workers: 1,
      progressCallback: (downloaded, total) => {
        // Log removed
      }
    });

    if (!buffer || buffer.length === 0) {
      throw new Error(`downloadMedia returned empty buffer (size: ${buffer ? buffer.length : 'null'})`);
    }

    // console.log(`✅ Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)}MB successfully`); // Removed log

    return {
      fileUrl: null, // MTProto download, no URL
      fileName,
      fileSize,
      mimeType: document.mime_type ?? "",
      buffer: buffer, // Actual file content
    };
  } catch (error) {
    console.error("MTProto download error:", error);
    throw new Error(`MTProto download failed: ${error.message}`);
  }
};

export default fileGetter;