import { Buffer } from "buffer";
export interface SpamKeywordData {
  words: string[];
  countOfbanned: number;
  countOfbannedAI: number;
  countOfbannedImage: number; // New counter for image-based bans
}

export interface SpamMsgsData {
  msg: string[];
  countOfbanned: number;
}

export interface TelegramMessage {
  chat: { id: number };
  from?: { id: number; username: string };
  text?: string;
  message_id: number;
  photo?: Array<{
    file_id: string;
    file_size?: number;
    width: number;
    height: number;
  }>;
  caption?: string; // Caption for photos
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export interface SpamLog {
  user: { id: number; username: string };
  msg: string;
  timestamp: number;
  file_id?: string; // New field for image file_id
}

export class TelegramAntiSpamBot {
  private TELEGRAM_BOT_TOKEN: string;
  private MY_TG_ID: number;
  private GROQ_API_KEY: string;
  private AI_MODEL: string;
  private env: any;

  private spamKeywords: SpamKeywordData;
  private spamMsgs: SpamMsgsData;
  private spamLogs: SpamLog[];

  constructor(env: any) {
    this.env = env;

    // Проверки на обязательные переменные окружения
    if (!env || typeof env !== "object") {
      throw new Error("Missing env object for Worker bindings");
    }
    if (!env.TELEGRAM_BOT_TOKEN) {
      throw new Error("Missing env.TELEGRAM_BOT_TOKEN");
    }
    if (!env.MY_TG_ID) {
      throw new Error("Missing env.MY_TG_ID");
    }
    if (!env.GROQ_API_KEY) {
      throw new Error("Missing env.GROQ_API_KEY");
    }
    if (!env.SPAM_KEYWORDS) {
      throw new Error("Missing env.SPAM_KEYWORDS (KV namespace)");
    }
    if (!env.SPAM_MSGS) {
      throw new Error("Missing env.SPAM_MSGS (KV namespace)");
    }
    if (!env.DB) {
      throw new Error("Missing env.DB (D1 database binding)");
    }
    if (!env.AI_MODEL) {
      throw new Error("Missing env.AI_MODEL (ai model not set binding)");
    }

    this.TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
    this.MY_TG_ID = Number(env.MY_TG_ID); // Ensure MY_TG_ID is a number
    this.GROQ_API_KEY = env.GROQ_API_KEY;
    this.AI_MODEL = env.AI_MODEL;

    this.spamKeywords = {
      words: [
        "БЕССПЛАТНЫЙ",
        "Удаленный",
        "Пассивный",
        "удаленной деятельности",
        "удаленного заработка",
      ],
      countOfbanned: 0,
      countOfbannedAI: 0,
      countOfbannedImage: 0, // Initialize new counter
    };
    this.spamMsgs = {
      msg: [
        "Наркота, онлайн бессплатно! налетай!",
        "Удалённо ,можно работать с телефона, ПК.Пиши + в личку",
        "Хoчeшь пaccивный дoxод? Нaпиши мнe + и я тeбe рaccкaжу кaк yдлaённo пoлучaть дoxод с минимaльными yсилиями Ждy в л.c.p.",
        "Приветствую,предоставляю возможность удаленного заработка.Опыт не требуются обучаем всему с нуля .Доход от 60 000р за семь дней.За деталями пишите мне в личные сообщения",
        "Гибкий график, удалённо 7000р в день. 18+",
        "Нужны 2-3 человека (18+) для удаленной деятельности от 70-100$ в день. Заинтересованных прошу писать ➕  в личныe cooбщeниe.",
      ],
      countOfbanned: 0,
    };
    this.spamLogs = [];
  }

  async ensureDbAndKvInitialized() {
    // D1: create table if not exists, add file_id column if missing
    await this.env.DB.prepare(
      `
      CREATE TABLE IF NOT EXISTS spam_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        msg TEXT,
        timestamp INTEGER,
        file_id TEXT
      )
    `
    ).run();

    // KV: initial data for spamKeywords
    const keywords = await this.env.SPAM_KEYWORDS.get("keywords");
    if (!keywords) {
      await this.env.SPAM_KEYWORDS.put(
        "keywords",
        JSON.stringify(this.spamKeywords)
      );
    }

    // KV: initial data for spamMsgs
    const msgs = await this.env.SPAM_MSGS.get("msgs");
    if (!msgs) {
      await this.env.SPAM_MSGS.put("msgs", JSON.stringify(this.spamMsgs));
    }

    // KV: initialize image cache if not exists
    const cache = await this.env.SPAM_KEYWORDS.get("image_cache");
    if (!cache) {
      await this.env.SPAM_KEYWORDS.put("image_cache", JSON.stringify({}));
    }
  }

  async loadState() {
    await this.ensureDbAndKvInitialized();

    // KV: keywords
    const keywords = await this.env.SPAM_KEYWORDS.get("keywords");
    if (keywords) this.spamKeywords = JSON.parse(keywords);

    // KV: messages
    const msgs = await this.env.SPAM_MSGS.get("msgs");
    if (msgs) this.spamMsgs = JSON.parse(msgs);

    // KV: image cache
    const cacheStr = await this.env.SPAM_KEYWORDS.get("image_cache");
    if (cacheStr) {
      // Clean expired cache entries (older than 1 hour)
      const cache = JSON.parse(cacheStr);
      const now = Date.now();
      Object.keys(cache).forEach((key) => {
        if (now - cache[key].timestamp > 3600000) {
          // 1 hour in ms
          delete cache[key];
        }
      });
      await this.env.SPAM_KEYWORDS.put("image_cache", JSON.stringify(cache));
    }

    // D1: logs
    const logsRes = await this.env.DB.prepare(
      "SELECT user_id, username, msg, timestamp, file_id FROM spam_logs ORDER BY timestamp DESC LIMIT 100"
    ).all();
    this.spamLogs = logsRes.results.map((row: any) => ({
      user: { id: row.user_id, username: row.username },
      msg: row.msg,
      timestamp: row.timestamp,
      file_id: row.file_id,
    }));
  }

  async saveState() {
    // KV: keywords
    await this.env.SPAM_KEYWORDS.put(
      "keywords",
      JSON.stringify(this.spamKeywords)
    );

    // KV: messages
    await this.env.SPAM_MSGS.put("msgs", JSON.stringify(this.spamMsgs));

    // D1: logs (add only new records)
    if (this.spamLogs.length > 0) {
      const lastLog = this.spamLogs[this.spamLogs.length - 1];
      await this.env.DB.prepare(
        "INSERT INTO spam_logs (user_id, username, msg, timestamp, file_id) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(
          lastLog.user.id || 0,
          lastLog.user.username || "",
          lastLog.msg || "",
          lastLog.timestamp || 0,
          lastLog.file_id || null
        )
        .run();
    }
  }

  // New method: Get Telegram file path by file_id
  private async getTelegramFilePath(fileId: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
      );
      const result: any = await response.json(); // Explicitly typing result as 'any' to handle JSON response
      if (result.ok) {
        return result.result.file_path;
      }
      console.error("Failed to get file path:", result);
      return null;
    } catch (err) {
      console.error("Error getting file path:", err);
      return null;
    }
  }

  // New method: Download and convert image to base64
  private async downloadImageToBase64(fileId: string): Promise<string | null> {
    const filePath = await this.getTelegramFilePath(fileId);
    if (!filePath) return null;

    try {
      const response = await fetch(
        `https://api.telegram.org/file/bot${this.TELEGRAM_BOT_TOKEN}/${filePath}`
      );
      if (!response.ok) {
        console.error("Failed to download image:", response.status);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > 10 * 1024 * 1024) {
        // 10MB limit
        console.error("Image too large:", buffer.length);
        return null;
      }

      const mimeType = response.headers.get("content-type") || "image/jpeg";
      const base64 = buffer.toString("base64");
      return `data:${mimeType};base64,${base64}`;
    } catch (err) {
      console.error("Error downloading/converting image:", err);
      return null;
    }
  }

  // Updated: AI completion with vision support
  async getGroqChatCompletion(msg: string, imageBase64?: string) {
    const messages: any[] = [
      {
        role: "system",
        content: `You are an anti-spam assistant in a group about fishing tours. Analyze the message and/or image carefully. Respond **only** with "is_spam" or "is_no_spam" without any additional text.

        If the content (text or image) mentions fishing (locations, techniques, equipment), respond "is_no_spam".
        Spam includes: "passive income," "remote work," "earn money easily" or Russian equivalents like "пассивный доход," "удалённая работа," "заработок без усилий".
        
        Spam keywords: ${JSON.stringify(this.spamKeywords.words)}.
        Spam message examples: ${this.spamMsgs.msg.join("\n")}.
        
        For images: Use OCR to detect text; check for spam graphics (e.g., job ads, crypto schemes). If image is fishing-related, "is_no_spam".`,
      },
      { role: "user", content: msg }, // Text part
    ];

    // Add image if provided
    if (imageBase64) {
      messages[1].content += `\n\n[Analyze this image for spam]`;
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe and classify this image as spam or not based on the system prompt.",
          },
          { type: "image_url", image_url: { url: imageBase64 } },
        ],
      });
    }

    const aiParams = {
      messages,
      model: this.AI_MODEL || "groq/llama-3.2-11b-vision-preview", // Default to vision model
    };

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aiParams),
      }
    );
    const apiResponse = await response.json();
    console.log("Groq API response:", JSON.stringify(apiResponse, null, 2));
    return apiResponse;
  }

  // Cache image analysis result
  private async cacheImageResult(fileId: string, isSpam: boolean) {
    const cacheStr = await this.env.SPAM_KEYWORDS.get("image_cache");
    const cache = cacheStr ? JSON.parse(cacheStr) : {};
    cache[fileId] = { is_spam: isSpam, timestamp: Date.now() };
    await this.env.SPAM_KEYWORDS.put("image_cache", JSON.stringify(cache), {
      expirationTtl: 3600,
    }); // 1 hour TTL
  }

  // Get cached result for image
  private async getCachedImageResult(fileId: string): Promise<boolean | null> {
    const cacheStr = await this.env.SPAM_KEYWORDS.get("image_cache");
    if (!cacheStr) return null;
    const cache = JSON.parse(cacheStr);
    const entry = cache[fileId];
    if (entry && Date.now() - entry.timestamp < 3600000) {
      return entry.is_spam;
    }
    return null;
  }

  async sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
    try {
      console.log(
        `Attempting to send message to chatId: ${chatId}, text: ${text}`
      );
      const response = await fetch(
        `https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        }
      );
      const result: any = await response.json();
      if (!result.ok) {
        console.error(
          `Failed to send Telegram message to ${chatId}:`,
          JSON.stringify(result, null, 2)
        );
        return false;
      }
      console.log(`Successfully sent message to ${chatId}: ${text}`);
      return true;
    } catch (err) {
      console.error(`Error sending Telegram message to ${chatId}:`, err);
      return false;
    }
  }

  async deleteTelegramMessage(
    chatId: number,
    messageId: number
  ): Promise<boolean> {
    try {
      console.log(
        `Attempting to delete message ${messageId} in chat ${chatId}`
      );
      const response = await fetch(
        `https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/deleteMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
        }
      );
      const result: any = await response.json();
      if (!result.ok) {
        console.error(
          `Failed to delete message ${messageId} in chat ${chatId}:`,
          JSON.stringify(result, null, 2)
        );
        return false;
      }
      console.log(
        `Successfully deleted message ${messageId} in chat ${chatId}`
      );
      return true;
    } catch (err) {
      console.error(
        `Error deleting message ${messageId} in chat ${chatId}:`,
        err
      );
      return false;
    }
  }

  async restrictTelegramUser(chatId: number, userId: number): Promise<boolean> {
    try {
      console.log(`Attempting to restrict user ${userId} in chat ${chatId}`);
      const response = await fetch(
        `https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/restrictChatMember`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            user_id: userId,
            permissions: { can_send_messages: false },
          }),
        }
      );
      const result: any = await response.json();
      if (!result.ok) {
        console.error(
          `Failed to restrict user ${userId} in chat ${chatId}:`,
          JSON.stringify(result, null, 2)
        );
        return false;
      }
      console.log(`Successfully restricted user ${userId} in chat ${chatId}`);
      return true;
    } catch (err) {
      console.error(`Error restricting user ${userId} in chat ${chatId}:`, err);
      return false;
    }
  }

  // Updated: banUser with image support
  async banUser(msg: TelegramMessage, fileId?: string) {
    if (!msg.from || !msg.from.id) {
      console.error("Cannot ban user: msg.from is undefined");
      return;
    }

    const reason = fileId ? "spam image" : "spam message";
    const banMessage = `Ваше сообщение было классифицировано как спам и удалено: "${
      msg.text || "Image"
    }"\nПричина: ${reason}. Пожалуйста, воздержитесь от подобных сообщений.`;
    let notificationSent = await this.sendTelegramMessage(
      msg.from.id,
      banMessage
    );
    if (!notificationSent) {
      console.log(
        `Falling back to group chat ${msg.chat.id} for ban notification`
      );
      // notificationSent = await this.sendTelegramMessage(msg.chat.id, banMessage);
    }

    // Increment appropriate counter
    if (fileId) {
      this.spamKeywords.countOfbannedImage += 1;
    } else {
      this.spamKeywords.countOfbannedAI += 1;
    }

    const log: SpamLog = {
      user: msg.from,
      msg: msg.text || "Image spam",
      timestamp: Date.now(),
      file_id: fileId,
    };
    this.spamLogs.push(log);
    await this.saveState();

    // Notify admin
    const adminMessage = `BANNED USER: ${JSON.stringify(msg.from)}\nMessage: ${
      msg.text || "Image"
    }\nFile ID: ${
      fileId || "N/A"
    }\nReason: Detected as spam\nNotification sent: ${notificationSent}`;
    await this.sendTelegramMessage(this.MY_TG_ID, adminMessage);
  }

  // Updated: handle commands with new /testimage
  async handleTelegramCommand(msg: TelegramMessage): Promise<Response> {
    try {
      const chatId = msg.chat.id;
      const text = msg.text || "";
      const isAdmin = msg.from?.id === this.MY_TG_ID;

      console.log(
        `Processing command: ${text} from user ${msg.from?.id} (isAdmin: ${isAdmin}) in chat ${chatId}`
      );

      if (text === "/start") {
        const success = await this.sendTelegramMessage(
          chatId,
          "Привет! Я твой рыбо анти-спам бот."
        );
        return new Response(success ? "OK" : "Failed to send /start response", {
          status: success ? 200 : 500,
        });
      }

      if (text === "/listmsg") {
        const success = await this.sendTelegramMessage(
          chatId,
          `Список спам-сообщений: ${JSON.stringify(this.spamMsgs.msg)}`
        );
        return new Response(
          success ? "OK" : "Failed to send /listmsg response",
          { status: success ? 200 : 500 }
        );
      }

      if (text === "/list") {
        const success = await this.sendTelegramMessage(
          chatId,
          `Список спам-ключевых слов: ${JSON.stringify(this.spamKeywords)}`
        );
        return new Response(success ? "OK" : "Failed to send /list response", {
          status: success ? 200 : 500,
        });
      }

      if (text === "/logs") {
        const success = await this.sendTelegramMessage(
          chatId,
          `Логи спама (${this.spamLogs.length} записей):\n${JSON.stringify(
            this.spamLogs,
            null,
            2
          )}`
        );
        return new Response(success ? "OK" : "Failed to send /logs response", {
          status: success ? 200 : 500,
        });
      }

      // New: /testimage <file_id> - for admin testing
      const testImageMatch = text.match(/^\/testimage (.+)$/);
      if (testImageMatch && isAdmin) {
        const fileId = testImageMatch[1];
        const base64 = await this.downloadImageToBase64(fileId);
        if (!base64) {
          const success = await this.sendTelegramMessage(
            chatId,
            "Failed to download image."
          );
          return new Response(success ? "OK" : "Failed", {
            status: success ? 200 : 500,
          });
        }

        const chatCompletion = (await this.getGroqChatCompletion(
          "",
          base64
        )) as {
          choices?: { message?: { content?: string } }[];
        };
        const aiResult =
          chatCompletion.choices?.[0]?.message?.content || "error";
        const isSpam = aiResult === "is_spam";
        await this.cacheImageResult(fileId, isSpam);

        const success = await this.sendTelegramMessage(
          chatId,
          `Image ${fileId}: ${isSpam ? "SPAM" : "OK"} (AI: ${aiResult})`
        );
        return new Response(
          success ? "OK" : "Failed to send /testimage response",
          {
            status: success ? 200 : 500,
          }
        );
      } else if (testImageMatch) {
        const success = await this.sendTelegramMessage(
          chatId,
          "Only admins can use /testimage."
        );
        return new Response(success ? "OK" : "Failed", {
          status: success ? 200 : 500,
        });
      }

      // /add <keyword>
      const addMatch = text.match(/^\/add (.+)$/);
      if (addMatch) {
        if (isAdmin) {
          const newKeyword = addMatch[1].toLowerCase();
          this.spamKeywords.words.push(newKeyword);
          await this.env.SPAM_KEYWORDS.put(
            "keywords",
            JSON.stringify(this.spamKeywords)
          );
          const success = await this.sendTelegramMessage(
            chatId,
            `Ключевое слово "${newKeyword}" было добавлено в список блокировки.`
          );
          return new Response(success ? "OK" : "Failed to send /add response", {
            status: success ? 200 : 500,
          });
        } else {
          const success = await this.sendTelegramMessage(
            chatId,
            "Извините, эта команда доступна только администраторам."
          );
          return new Response(
            success ? "OK" : "Failed to send /add non-admin response",
            { status: success ? 200 : 500 }
          );
        }
      }

      // /addmsg <msg>
      const addMsgMatch = text.match(/^\/addmsg (.+)$/);
      if (addMsgMatch) {
        if (isAdmin) {
          const newMsg = addMsgMatch[1].toLowerCase();
          this.spamMsgs.msg.push(newMsg);
          await this.env.SPAM_MSGS.put("msgs", JSON.stringify(this.spamMsgs));
          const success = await this.sendTelegramMessage(
            chatId,
            `Ключевое сообщение "${newMsg}" было добавлено в список блокировки.`
          );
          return new Response(
            success ? "OK" : "Failed to send /addmsg response",
            { status: success ? 200 : 500 }
          );
        } else {
          const success = await this.sendTelegramMessage(
            chatId,
            "Извините, эта команда доступна только администраторам."
          );
          return new Response(
            success ? "OK" : "Failed to send /addmsg non-admin response",
            { status: success ? 200 : 500 }
          );
        }
      }

      // /remove <keyword>
      const removeMatch = text.match(/^\/remove (.+)$/);
      if (removeMatch) {
        if (isAdmin) {
          const keywordToRemove = removeMatch[1].toLowerCase();
          const index = this.spamKeywords.words.indexOf(keywordToRemove);
          if (index !== -1) {
            this.spamKeywords.words.splice(index, 1);
            await this.env.SPAM_KEYWORDS.put(
              "keywords",
              JSON.stringify(this.spamKeywords)
            );
            const success = await this.sendTelegramMessage(
              chatId,
              `Ключевое слово "${keywordToRemove}" было удалено из списка блокировки.`
            );
            return new Response(
              success ? "OK" : "Failed to send /remove response",
              { status: success ? 200 : 500 }
            );
          } else {
            const success = await this.sendTelegramMessage(
              chatId,
              `Ключевое слово "${keywordToRemove}" не найдено в списке блокировки.`
            );
            return new Response(
              success ? "OK" : "Failed to send /remove not-found response",
              { status: success ? 200 : 500 }
            );
          }
        } else {
          const success = await this.sendTelegramMessage(
            chatId,
            "Извините, эта команда доступна только администраторам."
          );
          return new Response(
            success ? "OK" : "Failed to send /remove non-admin response",
            { status: success ? 200 : 500 }
          );
        }
      }

      // Если команда не распознана
      const success = await this.sendTelegramMessage(
        chatId,
        "Неизвестная команда."
      );
      return new Response(
        success ? "Unknown command" : "Failed to send unknown command response",
        { status: success ? 200 : 500 }
      );
    } catch (err: any) {
      console.error("Error in handleTelegramCommand:", err);
      return new Response("Error processing command", { status: 500 });
    }
  }

  // Updated: main webhook handler with image support
  async handleTelegramWebhook(request: Request): Promise<Response> {
    try {
      // Получаем объект Update из Telegram
      const update: TelegramUpdate = await request.json();
      console.log("Received update:", JSON.stringify(update, null, 2));

      // Проверяем, есть ли в обновлении сообщение
      if (!update.message) {
        console.log("No message in update, skipping.");
        return new Response("No message in update", { status: 200 });
      }

      const msg: TelegramMessage = update.message;

      // Проверяем наличие msg.from
      if (!msg.from || !msg.from.id) {
        console.log(
          "No msg.from or msg.from.id in message:",
          JSON.stringify(msg, null, 2)
        );
        return new Response("No msg.from.id in message", { status: 400 });
      }

      await this.loadState();

      // Если это команда
      if (msg.text && msg.text.startsWith("/")) {
        console.log(`Handling command: ${msg.text} from user ${msg.from.id}`);
        return await this.handleTelegramCommand(msg);
      }

      let isSpam = false;
      let reason = "text";

      // Handle text spam first (existing logic)
      if (msg.text) {
        const chatCompletion = (await this.getGroqChatCompletion(msg.text)) as {
          choices?: { message?: { content?: string } }[];
        };
        const textResponse =
          chatCompletion.choices?.[0]?.message?.content || "";
        console.log("Text AI response:", textResponse);
        if (textResponse === "is_spam") {
          isSpam = true;
        }
      }

      // New: Handle image spam
      if (msg.photo && msg.photo.length > 0) {
        const largestPhoto = msg.photo[msg.photo.length - 1]; // Largest size
        const fileId = largestPhoto.file_id;

        // Check cache first
        let imageSpam = await this.getCachedImageResult(fileId);
        if (imageSpam === null) {
          const base64 = await this.downloadImageToBase64(fileId);
          if (base64) {
            const caption = msg.caption || ""; // Include caption if any
            const chatCompletion = (await this.getGroqChatCompletion(
              caption,
              base64
            )) as {
              choices?: { message?: { content?: string } }[];
            };
            const imageResponse =
              chatCompletion.choices?.[0]?.message?.content || "";
            console.log("Image AI response:", imageResponse);
            imageSpam = imageResponse === "is_spam";
            await this.cacheImageResult(fileId, imageSpam);
          } else {
            console.log("Skipping image analysis: download failed");
            imageSpam = false;
          }
        }
        console.log("Image spam result:", imageSpam);
        if (imageSpam) {
          isSpam = true;
          reason = "image";
        }
      }

      if (isSpam) {
        const deleted = await this.deleteTelegramMessage(
          msg.chat.id,
          msg.message_id
        );
        if (!deleted) {
          console.error(
            `Failed to delete spam message ${msg.message_id} from user ${msg.from.id}`
          );
        }

        if (msg.from.id === this.MY_TG_ID) {
          // Admin: just delete, no ban
          const adminMsg = `Admin message deleted: ${reason} spam (${
            msg.text || "Image"
          })`;
          await this.sendTelegramMessage(this.MY_TG_ID, adminMsg);
          return new Response("Admin spam deleted", { status: 200 });
        } else {
          const restricted = await this.restrictTelegramUser(
            msg.chat.id,
            msg.from.id
          );
          if (restricted) {
            const fileId = msg.photo
              ? msg.photo[msg.photo.length - 1]?.file_id
              : undefined;
            await this.banUser(msg, fileId);
          } else {
            console.error(
              `Failed to restrict user ${msg.from.id} in chat ${msg.chat.id}`
            );
            await this.sendTelegramMessage(
              this.MY_TG_ID,
              `Failed to restrict user ${JSON.stringify(
                msg.from
              )} for ${reason} spam: ${msg.text || "Image"}`
            );
          }
          return new Response(`Spam deleted and user banned (${reason})`, {
            status: 200,
          });
        }
      }

      return new Response("No spam", { status: 200 });
    } catch (err: any) {
      console.error("Error in handleTelegramWebhook:", err);
      return new Response("Error processing webhook", { status: 500 });
    }
  }
}
