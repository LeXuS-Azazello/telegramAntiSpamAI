export interface SpamKeywordData {
  words: string[];
  countOfbanned: number;
  countOfbannedAI: number;
}

export interface SpamMsgsData {
  msg: string[];
  countOfbanned: number;
}

export interface TelegramMessage {
  chat: { id: number };
  from?: { id: number; username: string };
  text: string;
  message_id: number;
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
}

export class TelegramAntiSpamBot {
  private TELEGRAM_BOT_TOKEN: string;
  private MY_TG_ID: number;
  private GROQ_API_KEY: string;
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

    this.TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
    this.MY_TG_ID = Number(env.MY_TG_ID); // Ensure MY_TG_ID is a number
    this.GROQ_API_KEY = env.GROQ_API_KEY;

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
    // D1: создать таблицу, если не существует
    await this.env.DB.prepare(
      `
      CREATE TABLE IF NOT EXISTS spam_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        msg TEXT,
        timestamp INTEGER
      )
    `
    ).run();

    // KV: начальные данные для spamKeywords
    const keywords = await this.env.SPAM_KEYWORDS.get("keywords");
    if (!keywords) {
      await this.env.SPAM_KEYWORDS.put(
        "keywords",
        JSON.stringify(this.spamKeywords)
      );
    }

    // KV: начальные данные для spamMsgs
    const msgs = await this.env.SPAM_MSGS.get("msgs");
    if (!msgs) {
      await this.env.SPAM_MSGS.put("msgs", JSON.stringify(this.spamMsgs));
    }
  }

  async loadState() {
    await this.ensureDbAndKvInitialized();

    // KV: ключевые слова
    const keywords = await this.env.SPAM_KEYWORDS.get("keywords");
    if (keywords) this.spamKeywords = JSON.parse(keywords);

    // KV: сообщения
    const msgs = await this.env.SPAM_MSGS.get("msgs");
    if (msgs) this.spamMsgs = JSON.parse(msgs);

    // D1: логи
    const logsRes = await this.env.DB.prepare(
      "SELECT user_id, username, msg, timestamp FROM spam_logs ORDER BY timestamp DESC LIMIT 100"
    ).all();
    this.spamLogs = logsRes.results.map((row: any) => ({
      user: { id: row.user_id, username: row.username },
      msg: row.msg,
      timestamp: row.timestamp,
    }));
  }

  async saveState() {
    // KV: ключевые слова
    await this.env.SPAM_KEYWORDS.put(
      "keywords",
      JSON.stringify(this.spamKeywords)
    );

    // KV: сообщения
    await this.env.SPAM_MSGS.put("msgs", JSON.stringify(this.spamMsgs));

    // D1: логи (добавляем только новые записи)
    if (this.spamLogs.length > 0) {
      const lastLog = this.spamLogs[this.spamLogs.length - 1];
      await this.env.DB.prepare(
        "INSERT INTO spam_logs (user_id, username, msg, timestamp) VALUES (?, ?, ?, ?)"
      )
        .bind(
          lastLog.user.id || 0,
          lastLog.user.username || "",
          lastLog.msg || "",
          lastLog.timestamp || 0
        )
        .run();
    }
  }

  async getGroqChatCompletion(msg: string) {
    const aiParams = {
      messages: [
        {
          role: "system",
          content: `You are an anti-spam assistant in a group about fishing tours. Analyze each message carefully and respond **only** with either "is_spam" or "is_no_spam" without any additional characters.

          If the message contains any information about fishing (such as fishing locations, techniques, equipment), you should respond with "is_no_spam". 
          
          The group supports both Russian and English languages. Messages with content like "passive income," "remote earnings," or "get paid with minimal effort" are considered spam. 
          
          Check for similar phrases in Russian. Here are some examples of spam messages: ${this.spamMsgs.msg.join(
            "\n"
          )}
          
          Use the following spam keywords to help identify spam keywords: ${JSON.stringify(
            this.spamKeywords.words
          )}.`,
        },
        { role: "user", content: msg },
      ],
      model: "gpt-3.5-turbo",
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

  async banUser(msg: TelegramMessage) {
    if (!msg.from || !msg.from.id) {
      console.error("Cannot ban user: msg.from is undefined");
      return;
    }

    // Send notification to the user before banning
    const banMessage = `Ваше сообщение было классифицировано как спам и удалено: "${msg.text}".\nПричина: Сообщение содержит спам (например, рекламу пассивного дохода или удалённой работы). Пожалуйста, воздержитесь от подобных сообщений.`;
    let notificationSent = await this.sendTelegramMessage(
      msg.from.id,
      banMessage
    );
    if (!notificationSent) {
      // Fallback to group chat
      console.log(
        `Falling back to group chat ${msg.chat.id} for ban notification`
      );
      notificationSent = await this.sendTelegramMessage(
        msg.chat.id,
        banMessage
      );
    }

    // Increment ban counter and log the ban
    this.spamKeywords.countOfbannedAI += 1;
    const log: SpamLog = {
      user: msg.from,
      msg: msg.text,
      timestamp: Date.now(),
    };
    this.spamLogs.push(log);
    await this.saveState();

    // Notify admin
    const adminMessage = `BANNED USER: ${JSON.stringify(msg.from)}\nMessage: ${
      msg.text
    }\nReason: Detected as spam\nNotification sent: ${notificationSent}`;
    await this.sendTelegramMessage(this.MY_TG_ID, adminMessage);
  }

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

      // Антиспам логика
      const chatCompletion = (await this.getGroqChatCompletion(msg.text)) as {
        choices?: { message?: { content?: string } }[];
      };
      const response = chatCompletion.choices?.[0]?.message?.content || "";
      console.log("Message from:", msg.from, "AI response:", response);

      if (response === "is_spam") {
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
          return new Response("Admin spam deleted", { status: 200 });
        } else {
          const restricted = await this.restrictTelegramUser(
            msg.chat.id,
            msg.from.id
          );
          if (restricted) {
            await this.banUser(msg);
          } else {
            console.error(
              `Failed to restrict user ${msg.from.id} in chat ${msg.chat.id}`
            );
            await this.sendTelegramMessage(
              this.MY_TG_ID,
              `Failed to restrict user ${JSON.stringify(
                msg.from
              )} for message: ${msg.text}`
            );
          }
          return new Response("Spam deleted and user banned", { status: 200 });
        }
      }

      return new Response("No spam", { status: 200 });
    } catch (err: any) {
      console.error("Error in handleTelegramWebhook:", err);
      return new Response("Error processing webhook", { status: 500 });
    }
  }
}
