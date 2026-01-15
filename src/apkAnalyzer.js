import axios from "axios";
import ApkReader from "adbkit-apkreader";
import { createWriteStream } from "fs";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { pipeline } from "stream/promises";
import fileGetter from "./fileGetter.js";
import linkExtractor from "./linkExtractor.js";
import { addToSheet } from "./sheetClient.js";

const DOWNLOAD_TIMEOUT = 4 * 60 * 1000;

const registerApkAnalyzer = (bot, resultChannelId, mtprotoClient) => {
  // Unified handler for both channel posts and messages
  const handleFileUpload = async (msg) => {
    // 1. Check if it's a document/file
    if (!msg.document) {
      await safeSendTemporaryMessage(
        bot,
        msg.chat.id,
        "❌ <b>Not an app (apk, apks)</b>",
        3000
      );
      return;
    }

    // 2. Check extension immediately to fail fast
    const fileName = msg.document.file_name || "";
    if (!/\.apk[s]?$/i.test(fileName)) {
      await safeSendTemporaryMessage(
        bot,
        msg.chat.id,
        "❌ <b>Not an app (apk, apks)</b>",
        3000
      );
      return;
    }

    let analyzingMsg = null;
    let fileInfo = null;

    try {
      try {
        // 3. Send "Analyzing APK..." message checking pass
        // We send this BEFORE downloading so the user sees immediate feedback
        analyzingMsg = await bot.sendMessage(msg.chat.id, "⏳ <b>Analyzing APK...</b>", {
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });

        // 4. Download/Get File Info
        // This might take time for large files (MTProto download)
        fileInfo = await fileGetter(bot, msg, mtprotoClient);

        if (!fileInfo) {
          // Should catch cases where fileGetter rejects it for some reason
          await safeSendTemporaryMessage(
            bot,
            msg.chat.id,
            "❌ <b>Not an app (apk, apks)</b>",
            3000
          );
          return;
        }

        if (/\.apks$/i.test(fileInfo.fileName)) {
          await safeSendMessage(
            bot,
            resultChannelId,
            buildUnsupportedBundleMessage(msg, fileInfo)
          );
          return;
        }

        const analysis = await analyzeApk(fileInfo);
        const packageName = analysis.packageName;
        const appName = analysis.appName;

        if (!packageName) {
          await safeSendMessage(bot, resultChannelId, buildErrorMessage(msg, "Package name missing in APK manifest."));
          return;
        }

        const storeLinks = await linkExtractor(packageName);

        // Add to Google Sheets Backup
        const googlePlayLink = storeLinks.find(l => l.label.toLowerCase().includes('play store'))?.url;
        const fDroidLink = storeLinks.find(l => l.label.toLowerCase().includes('f-droid'))?.url;

        await addToSheet({
          fileName: fileInfo.fileName,
          packageName: packageName,
          googlePlayLink,
          fDroidLink,
          fileSize: formatBytes(fileInfo.fileSize)
        });

        // Send result to RESULT CHANNEL
        const resultMsg = await safeSendMessage(
          bot,
          resultChannelId,
          buildSuccessMessage(msg, fileInfo, packageName, appName, storeLinks)
        );

        // If result was sent successfully, reply to SOURCE CHANNEL
        if (resultMsg) {
          // 2. Generate link to result message
          const resultLink = getMessageLink(resultMsg);

          // 3. Reply to original upload
          const replyText = `<b>👍</b> <a href="${resultLink}">Check Analysis</a>`;

          await safeSendMessage(bot, msg.chat.id, replyText, {
            reply_to_message_id: msg.message_id
          });
        }

      } catch (error) {
        console.error("❌ Analyzer error:", error.message);
        await safeSendMessage(
          bot,
          resultChannelId,
          buildErrorMessage(msg, "Failed to analyze the APK. Please try again later.")
        );
      }
    } finally {
      // Delete "Analyzing APK..." message if it was sent
      if (analyzingMsg) {
        try {
          await bot.deleteMessage(msg.chat.id, analyzingMsg.message_id);
        } catch (e) {
          // Ignore delete error
        }
      }
    }
  };

  // Listen to both channel posts AND regular messages
  bot.on("channel_post", handleFileUpload);
  bot.on("message", handleFileUpload);
};

const analyzeApk = async (fileInfo) => {
  const tempDir = await mkdtemp(join(tmpdir(), "telebot-apk-"));
  const tempApkPath = join(tempDir, sanitizeFileName(fileInfo.fileName) || "download.apk");

  try {
    // If we have a buffer (MTProto download), write it to temp file
    if (fileInfo.buffer) {
      await writeFile(tempApkPath, fileInfo.buffer);
    } else if (fileInfo.fileUrl) {
      // Download from URL (Bot API)
      const response = await axios.get(fileInfo.fileUrl, {
        responseType: "stream",
        timeout: DOWNLOAD_TIMEOUT,
      });
      await pipeline(response.data, createWriteStream(tempApkPath));
    } else {
      throw new Error("No file buffer or URL provided");
    }

    const reader = await ApkReader.open(tempApkPath);
    const manifest = await reader.readManifest();

    // Extract app name from application label
    let appName = "Unknown App";
    if (manifest.application && manifest.application.label) {
      appName = manifest.application.label;
    }

    return {
      packageName: manifest.package,
      appName: appName,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

const buildSuccessMessage = (msg, fileInfo, packageName, appName, storeLinks) => {
  const channelRef = buildChannelReference(msg);
  const sizeLabel = formatBytes(fileInfo.fileSize);

  const messageParts = ["<b>📱 APK Analysis Complete</b>", ""];

  // App Name
  messageParts.push(`<b>App Name:</b> ${escapeHtml(appName)}`);

  // Package Name
  messageParts.push(`<b>Package:</b> <code>${escapeHtml(packageName)}</code>`);
  messageParts.push("");

  // Store Links or Package Name fallback
  if (storeLinks.length) {
    messageParts.push("<b>📦 Available on:</b>");
    storeLinks.forEach(({ label, url }) => {
      messageParts.push(`  • <a href="${url}">${escapeHtml(label)}</a>`);
    });
  } else {
    messageParts.push("<b>📦 Store Links:</b> Not found on Play Store or F-Droid");
  }
  messageParts.push("");

  // File info
  messageParts.push(`<b>File:</b> ${escapeHtml(fileInfo.fileName)}${sizeLabel ? ` (${sizeLabel})` : ""}`);

  // Link to the original message
  const messageLink = getMessageLink(msg);
  if (messageLink) {
    messageParts.push(`<b>🔗 Download Apk:</b> <a href="${messageLink}">View in Channel</a>`);
  }

  // If we have a direct file URL (Bot API), show it too
  if (fileInfo.fileUrl) {
    messageParts.push(`<b>📥 Direct Download:</b> <a href="${fileInfo.fileUrl}">Telegram File</a>`);
  }

  if (channelRef) {
    messageParts.push(`<b>Source Channel:</b> ${channelRef}`);
  }

  return messageParts.join("\n");
};

const getMessageLink = (msg) => {
  if (msg.chat?.username) {
    return `https://t.me/${msg.chat.username}/${msg.message_id}`;
  }

  // Handle private channels/groups (IDs start with -100)
  const chatIdStr = msg.chat.id.toString();
  if (chatIdStr.startsWith("-100")) {
    const cleanId = chatIdStr.substring(4);
    return `https://t.me/c/${cleanId}/${msg.message_id}`;
  }

  return null;
};

const buildUnsupportedBundleMessage = (msg, fileInfo) => {
  const channelRef = buildChannelReference(msg);

  const messageParts = ["<b>APK Analysis</b>", `<b>File:</b> ${escapeHtml(fileInfo.fileName)}`];

  if (channelRef) {
    messageParts.splice(1, 0, `<b>Source:</b> ${channelRef}`);
  }

  messageParts.push("Android App Bundle (.apks) files are not supported yet.");

  return messageParts.join("\n");
};

const buildErrorMessage = (msg, errorText) => {
  const channelRef = buildChannelReference(msg);

  const messageParts = ["<b>APK Analysis Failed</b>", escapeHtml(errorText)];

  if (channelRef) {
    messageParts.push(`<b>Source:</b> ${channelRef}`);
  }

  return messageParts.join("\n");
};

const buildChannelReference = (msg) => {
  const title = msg.chat?.title || msg.chat?.username;

  if (!title) {
    return null;
  }

  if (msg.chat?.username) {
    const messageLink = `https://t.me/${msg.chat.username}/${msg.message_id}`;
    return `<a href="${messageLink}">${escapeHtml(title)}</a>`;
  }

  return escapeHtml(title);
};

const sanitizeFileName = (fileName) => {
  if (!fileName) {
    return null;
  }

  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
};

const formatBytes = (size) => {
  if (!size) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let value = size;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
};

const escapeHtml = (input) => {
  const text = String(input ?? "");

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const safeSendMessage = async (bot, chatId, text, options = {}) => {
  try {
    return await bot.sendMessage(chatId, text, {
      parse_mode: "HTML",
      disable_web_page_preview: false,
      ...options
    });
  } catch (error) {
    console.error("Failed to send Telegram message:", error.message);
    return null;
  }
};

const safeSendTemporaryMessage = async (bot, chatId, text, deleteAfterMs = 3000) => {
  try {
    const sentMessage = await bot.sendMessage(chatId, text, {
      parse_mode: "HTML",
      disable_web_page_preview: false,
    });

    // Delete the message after the specified delay
    setTimeout(async () => {
      try {
        await bot.deleteMessage(chatId, sentMessage.message_id);
      } catch (error) {
        console.error("Failed to delete temporary message:", error.message);
      }
    }, deleteAfterMs);

    return sentMessage;
  } catch (error) {
    console.error("Failed to send temporary Telegram message:", error.message);
    return null;
  }
};

export default registerApkAnalyzer;
