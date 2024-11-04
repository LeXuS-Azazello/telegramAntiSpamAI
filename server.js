var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
var TelegramBot = require("node-telegram-bot-api");
var fs = require("fs");
var axios = require("axios");
var Groq = require("groq-sdk");
var dotenv = require("dotenv");
// Load environment variables
dotenv.config();
var token = process.env.TELEGRAM_BOT_TOKEN;
var MY_TG_ID = process.env.MY_TG_ID;
var GROQ_API_KEY = process.env.GROQ_API_KEY;
var bot = new TelegramBot(token, { polling: true });
var GROQ_API_URL = "https://api.groq.com/spam_detection";
var groq = new Groq({ apiKey: GROQ_API_KEY });
// Initialize data structures
var spamKeywords = {
    words: ["спамслово1", "спамслово2", "спамслово3"],
    countOfbanned: 0,
    countOfbannedAI: 0,
};
var spamMsgs = {
    msg: [
        "Наркота, онлайн бессплатно! налетай!",
        "Хoчeшь пaccивный дoxод? Нaпиши мнe + и я тeбe рaccкaжу кaк yдлaённo пoлучaть дoxод с минимaльными yсилиями Ждy в л.c.p.",
        "Приветствую,предоставляю возможность  удаленного заработка.Опыт не требуются обучаем всему с нуля .Доход от 60 000р за семь дней.За деталями пишите мне в личные сообщения",
    ],
    countOfbanned: 0,
};
// An array to store logs of banned users
var spamLogs = [];
// Function to save keywords to a file
var saveKeywords = function () {
    return fs.writeFileSync("spamKeywords.json", JSON.stringify(spamKeywords));
};
// Function to save messages to a file
var saveMsgs = function () {
    return fs.writeFileSync("spamMsgs.json", JSON.stringify(spamMsgs));
};
// Function to save logs to a file
var saveLogs = function () {
    return fs.writeFileSync("spamLogs.json", JSON.stringify(spamLogs));
};
// Load logs from file, if available
var loadLogs = function () { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        if (fs.existsSync("spamLogs.json")) {
            spamLogs = JSON.parse(fs.readFileSync("spamLogs.json", "utf-8"));
        }
        return [2 /*return*/];
    });
}); };
// Load keywords from file, if available
var loadKeywords = function () { return __awaiter(_this, void 0, void 0, function () {
    return __generator(this, function (_a) {
        if (fs.existsSync("spamKeywords.json")) {
            spamKeywords = JSON.parse(fs.readFileSync("spamKeywords.json", "utf-8"));
        }
        return [2 /*return*/];
    });
}); };
// Function to ban a user and log the action
var bannUser = function (msg) {
    bot.sendMessage(msg.chat.id, "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C ".concat(msg.from.username, " \u0431\u044B\u043B \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D \u0437\u0430 \u0441\u043F\u0430\u043C."));
    spamKeywords.countOfbannedAI += 1;
    spamLogs.push({ user: msg.from, msg: msg.text });
    saveKeywords();
    saveLogs();
    axios
        .get("https://api.telegram.org/bot".concat(token, "/sendMessage"), {
        params: {
            chat_id: MY_TG_ID,
            text: "BaNN USER: ".concat(JSON.stringify(msg.from), "\n ").concat(msg.text),
        },
    })
        .catch(console.log);
};
// Bot command handlers
bot.onText(/\/start/, function (msg) {
    return bot.sendMessage(msg.chat.id, "Привет! Я твой рыбо анти-спам бот.");
});
bot.onText(/\/list/, function (msg) {
    return bot.sendMessage(msg.chat.id, "\u0441\u043F\u0438\u0441\u043E\u043A \"".concat(JSON.stringify(spamKeywords), "\""));
});
bot.onText(/\/logs/, function (msg) {
    return bot.sendMessage(msg.chat.id, "logs \"".concat(JSON.stringify(spamLogs), "\" ").concat(spamLogs.length));
});
bot.onText(/\/add (.+)/, function (msg, match) { return __awaiter(_this, void 0, void 0, function () {
    var chatId, newKeyword, member;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!match)
                    return [2 /*return*/];
                chatId = msg.chat.id;
                newKeyword = match[1].toLowerCase();
                return [4 /*yield*/, bot.getChatMember(chatId, msg.from.id)];
            case 1:
                member = _a.sent();
                if (member.user.id === MY_TG_ID) {
                    spamKeywords.words.push(newKeyword);
                    saveKeywords();
                    bot.sendMessage(chatId, "\u041A\u043B\u044E\u0447\u0435\u0432\u043E\u0435 \u0441\u043B\u043E\u0432\u043E \"".concat(newKeyword, "\" \u0431\u044B\u043B\u043E \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u0441\u043F\u0438\u0441\u043E\u043A \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0438."));
                }
                else {
                    bot.sendMessage(chatId, "Извините, эта команда доступна только администраторам.");
                }
                return [2 /*return*/];
        }
    });
}); });
bot.onText(/\/addmsg (.+)/, function (msg, match) { return __awaiter(_this, void 0, void 0, function () {
    var chatId, newMsg, member;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!match)
                    return [2 /*return*/];
                chatId = msg.chat.id;
                newMsg = match[1].toLowerCase();
                return [4 /*yield*/, bot.getChatMember(chatId, msg.from.id)];
            case 1:
                member = _a.sent();
                if (member.user.id === MY_TG_ID) {
                    spamMsgs.msg.push(newMsg);
                    saveMsgs();
                    bot.sendMessage(chatId, "\u041A\u043B\u044E\u0447\u0435\u0432\u043E\u0435 \u0421\u041E\u041E\u0411\u0429\u0415\u041D\u0418\u0415 \"".concat(newMsg, "\" \u0431\u044B\u043B\u043E \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u0441\u043F\u0438\u0441\u043E\u043A \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0438."));
                }
                else {
                    bot.sendMessage(chatId, "Извините, эта команда доступна только администраторам.");
                }
                return [2 /*return*/];
        }
    });
}); });
bot.onText(/\/remove (.+)/, function (msg, match) { return __awaiter(_this, void 0, void 0, function () {
    var chatId, keywordToRemove, member, index;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!match)
                    return [2 /*return*/];
                chatId = msg.chat.id;
                keywordToRemove = match[1].toLowerCase();
                return [4 /*yield*/, bot.getChatMember(chatId, msg.from.id)];
            case 1:
                member = _a.sent();
                if (member.user.id === MY_TG_ID) {
                    index = spamKeywords.words.indexOf(keywordToRemove);
                    if (index !== -1) {
                        spamKeywords.words.splice(index, 1);
                        saveKeywords();
                        bot.sendMessage(chatId, "\u041A\u043B\u044E\u0447\u0435\u0432\u043E\u0435 \u0441\u043B\u043E\u0432\u043E \"".concat(keywordToRemove, "\" \u0431\u044B\u043B\u043E \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430 \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0438."));
                    }
                    else {
                        bot.sendMessage(chatId, "\u041A\u043B\u044E\u0447\u0435\u0432\u043E\u0435 \u0441\u043B\u043E\u0432\u043E \"".concat(keywordToRemove, "\" \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u0432 \u0441\u043F\u0438\u0441\u043A\u0435 \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0438."));
                    }
                }
                else {
                    bot.sendMessage(chatId, "Извините, эта команда доступна только администраторам.");
                }
                return [2 /*return*/];
        }
    });
}); });
// Handler for incoming messages
bot.on("message", function (msg) { return __awaiter(_this, void 0, void 0, function () {
    var messageText, userId, chatId, chatCompletion, response, error_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!msg.text) {
                    console.error("Wrong tg answer", msg);
                    return [2 /*return*/];
                }
                messageText = msg.text.toLowerCase();
                userId = msg.from.id;
                chatId = msg.chat.id;
                console.log("from TG: ", userId, chatId, msg);
                _c.label = 1;
            case 1:
                _c.trys.push([1, 7, , 8]);
                return [4 /*yield*/, getGroqChatCompletion(msg.text)];
            case 2:
                chatCompletion = _c.sent();
                response = ((_b = (_a = chatCompletion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "";
                if (!(msg.from.id === MY_TG_ID)) return [3 /*break*/, 3];
                console.log("IM ADMIN! fake DELETE AND NO BANN ", userId, messageText);
                bot.deleteMessage(chatId, msg.message_id);
                return [3 /*break*/, 6];
            case 3:
                if (!(response === "is_spam")) return [3 /*break*/, 6];
                console.log("SPAM!");
                return [4 /*yield*/, bot.deleteMessage(chatId, msg.message_id)];
            case 4:
                _c.sent();
                if (!(userId !== MY_TG_ID)) return [3 /*break*/, 6];
                return [4 /*yield*/, bot.restrictChatMember(chatId, userId, {
                        permissions: { can_send_messages: false },
                    })];
            case 5:
                _c.sent();
                bannUser(msg);
                _c.label = 6;
            case 6: return [3 /*break*/, 8];
            case 7:
                error_1 = _c.sent();
                console.log("Error checking spam:", error_1);
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); });
// Function to get a chat completion from the Groq AI
function getGroqChatCompletion(msg) {
    return __awaiter(this, void 0, void 0, function () {
        var aiParams;
        return __generator(this, function (_a) {
            aiParams = {
                messages: [
                    {
                        role: "system",
                        content: "You are an anti-spam assistant in a group about fishing tours. Analyze each message carefully and respond **only** with either \"is_spam\" or \"is_no_spam\" without any additional characters.\n\n        If the message contains any information about fishing (such as fishing locations, techniques, equipment), you should respond with \"is_no_spam\". \n        \n        The group supports both Russian and English languages. Messages with content like \"passive income,\" \"remote earnings,\" or \"get paid with minimal effort\" are considered spam. \n        \n        Check for similar phrases in Russian. Here are some examples of spam messages: ".concat(spamMsgs.msg.join("\n"), "\n        \n        Use the following spam keywords to help identify spam messages: ").concat(JSON.stringify(spamKeywords.words), "."),
                    },
                    { role: "user", content: msg },
                ],
                model: "llama3-8b-8192",
                name: null,
            };
            console.log(aiParams);
            return [2 /*return*/, groq.chat.completions.create(aiParams)];
        });
    });
}
// Main function to load required data and start bot
function main() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, loadKeywords()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, loadLogs()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
main();
