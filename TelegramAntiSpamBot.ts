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
  from: { id: number; username: string };
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
    this.MY_TG_ID = Number(env.MY_TG_ID);
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
        "Приветствую,предоставляю возможность  удаленного заработка.Опыт не требуются обучаем всему с нуля .Доход от 60 000р за семь дней.За деталями пишите мне в личные сообщения",
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
  /*
  async loadState() {
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
  }*/

  async saveState() {
    // KV: ключевые слова
    await this.env.SPAM_KEYWORDS.put(
      "keywords",
      JSON.stringify(this.spamKeywords)
    );

    // KV: сообщения
    await this.env.SPAM_MSGS.put("msgs", JSON.stringify(this.spamMsgs));

    // D1: логи (добавляем только новые записи)
    // Можно оптимизировать, но здесь просто добавляем последний лог
    if (this.spamLogs.length > 0) {
      const lastLog = this.spamLogs[this.spamLogs.length - 1];
      await this.env.DB.prepare(
        "INSERT INTO spam_logs (user_id, username, msg, timestamp) VALUES (?, ?, ?, ?)"
      )
        .bind(
          lastLog.user.id || "0",
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
      model: "llama-3.3-70b",
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
    return await response.json();
  }

  async sendTelegramMessage(chatId: number, text: string) {
    await fetch(
      `https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      }
    );
  }
  /*
  async handleTelegramWebhook(request: Request) {
    const msg: TelegramMessage = await request.json();
    await this.loadState();

    // Если это команда
    if (msg.text && msg.text.startsWith("/")) {
      return await this.handleTelegramCommand(msg);
    }

    // ...антиспам логика...
    //const chatCompletion = await this.getGroqChatCompletion(msg.text);
    const chatCompletion = (await this.getGroqChatCompletion(msg.text)) as {
      choices?: { message?: { content?: string } }[];
    };
    const response = chatCompletion.choices?.[0]?.message?.content || "";
    console.log("msg from", msg);
    if (!msg.from || !msg.from.id) {
      console.log("msg.from", msg.from);
      return new Error("No msg.from.id telegram");
    } else {
      if (msg.from.id === this.MY_TG_ID && response === "is_spam") {
        await this.deleteTelegramMessage(msg.chat.id, msg.message_id);
        return new Response("Admin spam deleted", { status: 200 });
      } else if (response === "is_spam") {
        await this.deleteTelegramMessage(msg.chat.id, msg.message_id);
        if (msg.from.id !== this.MY_TG_ID) {
          await this.restrictTelegramUser(msg.chat.id, msg.from.id);
          await this.banUser(msg);
        }
        return new Response("Spam deleted and user banned", { status: 200 });
      }
      return new Response("No spam", { status: 200 });
    }
  }
  */
  /*
  async handleTelegramWebhook(request: Request) {
    try {
      // Получаем объект Update из Telegram с явной типизацией
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
        return new Response("No msg.from.id in message", { status: 200 });
      }

      await this.loadState();

      // Если это команда
      if (msg.text && msg.text.startsWith("/")) {
        return await this.handleTelegramCommand(msg);
      }

      // Антиспам логика
      const chatCompletion = (await this.getGroqChatCompletion(msg.text)) as {
        choices?: { message?: { content?: string } }[];
      };
      const response = chatCompletion.choices?.[0]?.message?.content || "";
      console.log("Message from:", msg.from, "AI response:", response);

      if (response === "is_spam") {
        await this.deleteTelegramMessage(msg.chat.id, msg.message_id);
        if (msg.from.id === this.MY_TG_ID) {
          return new Response("Admin spam deleted", { status: 200 });
        } else {
          await this.restrictTelegramUser(msg.chat.id, msg.from.id);
          await this.banUser(msg);
          return new Response("Spam deleted and user banned", { status: 200 });
        }
      }

      return new Response("No spam", { status: 200 });
    } catch (err: any) {
      console.error("Error in handleTelegramWebhook:", err);
      return new Response("Error processing webhook", { status: 500 });
    }
  }
    */
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
        return await this.handleTelegramCommand(msg);
      }

      // Антиспам логика
      const chatCompletion = (await this.getGroqChatCompletion(msg.text)) as {
        choices?: { message?: { content?: string } }[];
      };
      const response = chatCompletion.choices?.[0]?.message?.content || "";
      console.log("Message from:", msg.from, "AI response:", response);

      if (response === "is_spam") {
        await this.deleteTelegramMessage(msg.chat.id, msg.message_id);
        if (msg.from.id === this.MY_TG_ID) {
          return new Response("Admin spam deleted", { status: 200 });
        } else {
          await this.restrictTelegramUser(msg.chat.id, msg.from.id);
          await this.banUser(msg);
          return new Response("Spam deleted and user banned", { status: 200 });
        }
      }

      return new Response("No spam", { status: 200 });
    } catch (err: any) {
      console.error("Error in handleTelegramWebhook:", err);
      return new Response("Error processing webhook", { status: 500 });
    }
  }
  async deleteTelegramMessage(chatId: number, messageId: number) {
    await fetch(
      `https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/deleteMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      }
    );
  }

  async restrictTelegramUser(chatId: number, userId: number) {
    await fetch(
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
  }

  async banUser(msg: TelegramMessage) {
    this.spamKeywords.countOfbannedAI += 1;
    const log: SpamLog = {
      user: msg.from,
      msg: msg.text,
      timestamp: Date.now(),
    };
    this.spamLogs.push(log);
    await this.saveState();
    await this.sendTelegramMessage(
      this.MY_TG_ID,
      `BaNN USER: ${JSON.stringify(msg.from)}\n ${msg.text}`
    );
  }

  async handleTelegramCommand(msg: TelegramMessage): Promise<Response> {
    try {
      const chatId = msg.chat.id;
      const text = msg.text || "";
      const isAdmin = msg.from.id === this.MY_TG_ID;

      if (text === "/start") {
        await this.sendTelegramMessage(
          chatId,
          "Привет! Я твой рыбо анти-спам бот."
        );
        return new Response("OK", { status: 200 });
      }

      if (text === "/listmsg") {
        await this.sendTelegramMessage(
          chatId,
          `список msg: "${JSON.stringify(this.spamMsgs.msg)}"`
        );
        return new Response("OK", { status: 200 });
      }

      if (text === "/list") {
        await this.sendTelegramMessage(
          chatId,
          `список "${JSON.stringify(this.spamKeywords)}"`
        );
        return new Response("OK", { status: 200 });
      }

      if (text === "/logs") {
        await this.sendTelegramMessage(
          chatId,
          `logs "${JSON.stringify(this.spamLogs)}" ${this.spamLogs.length}`
        );
        return new Response("OK", { status: 200 });
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
          await this.sendTelegramMessage(
            chatId,
            `Ключевое слово "${newKeyword}" было добавлено в список блокировки.`
          );
        } else {
          await this.sendTelegramMessage(
            chatId,
            "Извините, эта команда доступна только администраторам."
          );
        }
        return new Response("OK", { status: 200 });
      }

      // /addmsg <msg>
      const addMsgMatch = text.match(/^\/addmsg (.+)$/);
      if (addMsgMatch) {
        if (isAdmin) {
          const newMsg = addMsgMatch[1].toLowerCase();
          this.spamMsgs.msg.push(newMsg);
          await this.env.SPAM_MSGS.put("msgs", JSON.stringify(this.spamMsgs));
          await this.sendTelegramMessage(
            chatId,
            `Ключевое СООБЩЕНИЕ "${newMsg}" было добавлено в список блокировки.`
          );
        } else {
          await this.sendTelegramMessage(
            chatId,
            "Извините, эта команда доступна только администраторам."
          );
        }
        return new Response("OK", { status: 200 });
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
            await this.sendTelegramMessage(
              chatId,
              `Ключевое слово "${keywordToRemove}" было удалено из списка блокировки.`
            );
          } else {
            await this.sendTelegramMessage(
              chatId,
              `Ключевое слово "${keywordToRemove}" не найдено в списке блокировки.`
            );
          }
        } else {
          await this.sendTelegramMessage(
            chatId,
            "Извините, эта команда доступна только администраторам."
          );
        }
        return new Response("OK", { status: 200 });
      }

      // Если команда не распознана
      await this.sendTelegramMessage(chatId, "Неизвестная команда.");
      return new Response("Unknown command", { status: 200 });
    } catch (err: any) {
      console.error(err);
      return new Response("Not ok.", { status: 500 });
    }
  }
}
