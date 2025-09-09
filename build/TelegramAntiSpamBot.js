"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramAntiSpamBot = void 0;
class TelegramAntiSpamBot {
    constructor(env) {
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
                "Хoчeшь пaccивный дoxод? Нaпиши мнe + и я тeбe рaccкaжу кaк yдлaённo пoлучaть дoxод с минимaльными yсилиями Ждy в л.c.p.",
                "Приветствую,предоставляю возможность  удаленного заработка.Опыт не требуются обучаем всему с нуля .Доход от 60 000р за семь дней.За деталями пишите мне в личные сообщения",
                "Гибкий график, удалённо 7000р в день. 18+",
                "Нужны 2-3 человека (18+) для удаленной деятельности от 70-100$ в день. Заинтересованных прошу писать ➕  в личныe cooбщeниe.",
            ],
            countOfbanned: 0,
        };
        this.spamLogs = [];
    }
    ensureDbAndKvInitialized() {
        return __awaiter(this, void 0, void 0, function* () {
            // D1: создать таблицу, если не существует
            yield this.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS spam_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        msg TEXT,
        timestamp INTEGER
      )
    `).run();
            // KV: начальные данные для spamKeywords
            const keywords = yield this.env.SPAM_KEYWORDS.get("keywords");
            if (!keywords) {
                yield this.env.SPAM_KEYWORDS.put("keywords", JSON.stringify(this.spamKeywords));
            }
            // KV: начальные данные для spamMsgs
            const msgs = yield this.env.SPAM_MSGS.get("msgs");
            if (!msgs) {
                yield this.env.SPAM_MSGS.put("msgs", JSON.stringify(this.spamMsgs));
            }
        });
    }
    loadState() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureDbAndKvInitialized();
            // KV: ключевые слова
            const keywords = yield this.env.SPAM_KEYWORDS.get("keywords");
            if (keywords)
                this.spamKeywords = JSON.parse(keywords);
            // KV: сообщения
            const msgs = yield this.env.SPAM_MSGS.get("msgs");
            if (msgs)
                this.spamMsgs = JSON.parse(msgs);
            // D1: логи
            const logsRes = yield this.env.DB.prepare("SELECT user_id, username, msg, timestamp FROM spam_logs ORDER BY timestamp DESC LIMIT 100").all();
            this.spamLogs = logsRes.results.map((row) => ({
                user: { id: row.user_id, username: row.username },
                msg: row.msg,
                timestamp: row.timestamp,
            }));
        });
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
    saveState() {
        return __awaiter(this, void 0, void 0, function* () {
            // KV: ключевые слова
            yield this.env.SPAM_KEYWORDS.put("keywords", JSON.stringify(this.spamKeywords));
            // KV: сообщения
            yield this.env.SPAM_MSGS.put("msgs", JSON.stringify(this.spamMsgs));
            // D1: логи (добавляем только новые записи)
            // Можно оптимизировать, но здесь просто добавляем последний лог
            if (this.spamLogs.length > 0) {
                const lastLog = this.spamLogs[this.spamLogs.length - 1];
                yield this.env.DB.prepare("INSERT INTO spam_logs (user_id, username, msg, timestamp) VALUES (?, ?, ?, ?)")
                    .bind(lastLog.user.id, lastLog.user.username, lastLog.msg, lastLog.timestamp)
                    .run();
            }
        });
    }
    getGroqChatCompletion(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const aiParams = {
                messages: [
                    {
                        role: "system",
                        content: `You are an anti-spam assistant in a group about fishing tours. Analyze each message carefully and respond **only** with either "is_spam" or "is_no_spam" without any additional characters.

          If the message contains any information about fishing (such as fishing locations, techniques, equipment), you should respond with "is_no_spam". 
          
          The group supports both Russian and English languages. Messages with content like "passive income," "remote earnings," or "get paid with minimal effort" are considered spam. 
          
          Check for similar phrases in Russian. Here are some examples of spam messages: ${this.spamMsgs.msg.join("\n")}
          
          Use the following spam keywords to help identify spam keywords: ${JSON.stringify(this.spamKeywords.words)}.`,
                    },
                    { role: "user", content: msg },
                ],
                model: "llama-3.3-70b",
            };
            const response = yield fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(aiParams),
            });
            return yield response.json();
        });
    }
    sendTelegramMessage(chatId, text) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fetch(`https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text }),
            });
        });
    }
    /*
    async handleTelegramWebhook(request: Request) {
      const msg: TelegramMessage = await request.json();
      if (!msg.text || msg.text[0] === "/") {
        return new Response("admin command skipped", { status: 200 });
      }
      await this.loadState();
  
      const chatCompletion = await this.getGroqChatCompletion(msg.text);
      const response = chatCompletion.choices?.[0]?.message?.content || "";
  
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
    }*/
    handleTelegramWebhook(request) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const msg = yield request.json();
            yield this.loadState();
            // Если это команда
            if (msg.text && msg.text.startsWith("/")) {
                return yield this.handleTelegramCommand(msg);
            }
            // ...антиспам логика...
            const chatCompletion = yield this.getGroqChatCompletion(msg.text);
            const response = ((_c = (_b = (_a = chatCompletion.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || "";
            if (msg.from.id === this.MY_TG_ID && response === "is_spam") {
                yield this.deleteTelegramMessage(msg.chat.id, msg.message_id);
                return new Response("Admin spam deleted", { status: 200 });
            }
            else if (response === "is_spam") {
                yield this.deleteTelegramMessage(msg.chat.id, msg.message_id);
                if (msg.from.id !== this.MY_TG_ID) {
                    yield this.restrictTelegramUser(msg.chat.id, msg.from.id);
                    yield this.banUser(msg);
                }
                return new Response("Spam deleted and user banned", { status: 200 });
            }
            return new Response("No spam", { status: 200 });
        });
    }
    deleteTelegramMessage(chatId, messageId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fetch(`https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/deleteMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
            });
        });
    }
    restrictTelegramUser(chatId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fetch(`https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/restrictChatMember`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    user_id: userId,
                    permissions: { can_send_messages: false },
                }),
            });
        });
    }
    banUser(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            this.spamKeywords.countOfbannedAI += 1;
            const log = {
                user: msg.from,
                msg: msg.text,
                timestamp: Date.now(),
            };
            this.spamLogs.push(log);
            yield this.saveState();
            yield this.sendTelegramMessage(this.MY_TG_ID, `BaNN USER: ${JSON.stringify(msg.from)}\n ${msg.text}`);
        });
    }
    handleTelegramCommand(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const chatId = msg.chat.id;
            const text = msg.text || "";
            const isAdmin = msg.from.id === this.MY_TG_ID;
            if (text === "/start") {
                yield this.sendTelegramMessage(chatId, "Привет! Я твой рыбо анти-спам бот.");
                return new Response("OK", { status: 200 });
            }
            if (text === "/listmsg") {
                yield this.sendTelegramMessage(chatId, `список msg: "${JSON.stringify(this.spamMsgs.msg)}"`);
                return new Response("OK", { status: 200 });
            }
            if (text === "/list") {
                yield this.sendTelegramMessage(chatId, `список "${JSON.stringify(this.spamKeywords)}"`);
                return new Response("OK", { status: 200 });
            }
            if (text === "/logs") {
                yield this.sendTelegramMessage(chatId, `logs "${JSON.stringify(this.spamLogs)}" ${this.spamLogs.length}`);
                return new Response("OK", { status: 200 });
            }
            // /add <keyword>
            const addMatch = text.match(/^\/add (.+)$/);
            if (addMatch) {
                if (isAdmin) {
                    const newKeyword = addMatch[1].toLowerCase();
                    this.spamKeywords.words.push(newKeyword);
                    yield this.env.SPAM_KEYWORDS.put("keywords", JSON.stringify(this.spamKeywords));
                    yield this.sendTelegramMessage(chatId, `Ключевое слово "${newKeyword}" было добавлено в список блокировки.`);
                }
                else {
                    yield this.sendTelegramMessage(chatId, "Извините, эта команда доступна только администраторам.");
                }
                return new Response("OK", { status: 200 });
            }
            // /addmsg <msg>
            const addMsgMatch = text.match(/^\/addmsg (.+)$/);
            if (addMsgMatch) {
                if (isAdmin) {
                    const newMsg = addMsgMatch[1].toLowerCase();
                    this.spamMsgs.msg.push(newMsg);
                    yield this.env.SPAM_MSGS.put("msgs", JSON.stringify(this.spamMsgs));
                    yield this.sendTelegramMessage(chatId, `Ключевое СООБЩЕНИЕ "${newMsg}" было добавлено в список блокировки.`);
                }
                else {
                    yield this.sendTelegramMessage(chatId, "Извините, эта команда доступна только администраторам.");
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
                        yield this.env.SPAM_KEYWORDS.put("keywords", JSON.stringify(this.spamKeywords));
                        yield this.sendTelegramMessage(chatId, `Ключевое слово "${keywordToRemove}" было удалено из списка блокировки.`);
                    }
                    else {
                        yield this.sendTelegramMessage(chatId, `Ключевое слово "${keywordToRemove}" не найдено в списке блокировки.`);
                    }
                }
                else {
                    yield this.sendTelegramMessage(chatId, "Извините, эта команда доступна только администраторам.");
                }
                return new Response("OK", { status: 200 });
            }
            // Если команда не распознана
            yield this.sendTelegramMessage(chatId, "Неизвестная команда.");
            return new Response("Unknown command", { status: 200 });
        });
    }
}
exports.TelegramAntiSpamBot = TelegramAntiSpamBot;
