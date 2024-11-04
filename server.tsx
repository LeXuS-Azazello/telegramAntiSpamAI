const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const axios = require("axios");
const Groq = require("groq-sdk");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const MY_TG_ID = Number(process.env.MY_TG_ID);
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const bot = new TelegramBot(token, { polling: true });

const GROQ_API_URL = "https://api.groq.com/spam_detection";

const groq = new Groq({ apiKey: GROQ_API_KEY });

// Define interfaces for structured data
/**
 * @typedef {Object} SpamKeywordData
 * @property {string[]} words
 * @property {number} countOfbanned
 * @property {number} countOfbannedAI
 */
type SpamKeywordData = {
  words: string[];
  countOfbanned: number;
  countOfbannedAI: number;
};

type SpamMsgsData = {
  msg: string[];
  countOfbanned: number;
};

type TelegramMessage = {
  chat: { id: number };
  from: { id: number; username: string };
  text: string;
  message_id: number;
};

type SpamLog = {
  user: { id: number; username: string };
  msg: string;
};

// Initialize data structures
let spamKeywords: SpamKeywordData = {
  words: ["БЕССПЛАТНЫЙ", "Удаленный", "Пассивный"],
  countOfbanned: 0,
  countOfbannedAI: 0,
};

let spamMsgs: SpamMsgsData = {
  msg: [
    "Наркота, онлайн бессплатно! налетай!",
    "Хoчeшь пaccивный дoxод? Нaпиши мнe + и я тeбe рaccкaжу кaк yдлaённo пoлучaть дoxод с минимaльными yсилиями Ждy в л.c.p.",
    "Приветствую,предоставляю возможность  удаленного заработка.Опыт не требуются обучаем всему с нуля .Доход от 60 000р за семь дней.За деталями пишите мне в личные сообщения",
  ],
  countOfbanned: 0,
};

// An array to store logs of banned users
let spamLogs: SpamLog[] = [];

// Function to save keywords to a file
const saveKeywords = (): void =>
  fs.writeFileSync("spamKeywords.json", JSON.stringify(spamKeywords));

// Function to save messages to a file
const saveMsgs = (): void =>
  fs.writeFileSync("spamMsgs.json", JSON.stringify(spamMsgs));

// Function to save logs to a file
const saveLogs = (): void =>
  fs.writeFileSync("spamLogs.json", JSON.stringify(spamLogs));

// Load logs from file, if available
const loadLogs = async (): Promise<void> => {
  if (fs.existsSync("spamLogs.json")) {
    spamLogs = JSON.parse(fs.readFileSync("spamLogs.json", "utf-8"));
  }
};

// Load keywords from file, if available
const loadKeywords = async (): Promise<void> => {
  if (fs.existsSync("spamKeywords.json")) {
    spamKeywords = JSON.parse(fs.readFileSync("spamKeywords.json", "utf-8"));
  }
};

// Function to ban a user and log the action
const bannUser = (msg: TelegramMessage): void => {
  bot.sendMessage(
    msg.chat.id,
    `Пользователь ${msg.from.username} был заблокирован за спам.`
  );
  spamKeywords.countOfbannedAI += 1;
  spamLogs.push({ user: msg.from, msg: msg.text });
  saveKeywords();
  saveLogs();
  axios
    .get(`https://api.telegram.org/bot${token}/sendMessage`, {
      params: {
        chat_id: MY_TG_ID,
        text: `BaNN USER: ${JSON.stringify(msg.from)}\n ${msg.text}`,
      },
    })
    .catch(console.log);
};

// Bot command handlers
bot.onText(/\/start/, (msg: TelegramMessage) =>
  bot.sendMessage(msg.chat.id, "Привет! Я твой рыбо анти-спам бот.")
);
bot.onText(/\/listmsg/, (msg: TelegramMessage) =>
  bot.sendMessage(msg.chat.id, `список msg: "${JSON.stringify(spamMsgs.msg)}"`)
);
bot.onText(/\/list/, (msg: TelegramMessage) =>
  bot.sendMessage(msg.chat.id, `список "${JSON.stringify(spamKeywords)}"`)
);
bot.onText(/\/logs/, (msg: TelegramMessage) =>
  bot.sendMessage(
    msg.chat.id,
    `logs "${JSON.stringify(spamLogs)}" ${spamLogs.length}`
  )
);

bot.onText(
  /\/add (.+)/,
  async (msg: TelegramMessage, match: RegExpMatchArray) => {
    if (!match) return;
    const chatId = msg.chat.id;
    const newKeyword = match[1].toLowerCase();

    const member = await bot.getChatMember(chatId, msg.from.id);
    console.log("member", member.user.id, MY_TG_ID);
    if (member.user.id === MY_TG_ID) {
      spamKeywords.words.push(newKeyword);
      saveKeywords();
      bot.sendMessage(
        chatId,
        `Ключевое слово "${newKeyword}" было добавлено в список блокировки.`
      );
    } else {
      bot.sendMessage(
        chatId,
        "Извините, эта команда доступна только администраторам."
      );
    }
  }
);

bot.onText(
  /\/addmsg (.+)/,
  async (msg: TelegramMessage, match: RegExpMatchArray) => {
    if (!match) return;
    const chatId = msg.chat.id;
    const newMsg = match[1].toLowerCase();

    const member = await bot.getChatMember(chatId, msg.from.id);
    if (member.user.id === MY_TG_ID) {
      spamMsgs.msg.push(newMsg);
      saveMsgs();
      bot.sendMessage(
        chatId,
        `Ключевое СООБЩЕНИЕ "${newMsg}" было добавлено в список блокировки.`
      );
    } else {
      bot.sendMessage(
        chatId,
        "Извините, эта команда доступна только администраторам."
      );
    }
  }
);

bot.onText(
  /\/remove (.+)/,
  async (msg: TelegramMessage, match: RegExpMatchArray) => {
    if (!match) return;
    const chatId = msg.chat.id;
    const keywordToRemove = match[1].toLowerCase();

    const member = await bot.getChatMember(chatId, msg.from.id);
    if (member.user.id === MY_TG_ID) {
      const index = spamKeywords.words.indexOf(keywordToRemove);
      if (index !== -1) {
        spamKeywords.words.splice(index, 1);
        saveKeywords();
        bot.sendMessage(
          chatId,
          `Ключевое слово "${keywordToRemove}" было удалено из списка блокировки.`
        );
      } else {
        bot.sendMessage(
          chatId,
          `Ключевое слово "${keywordToRemove}" не найдено в списке блокировки.`
        );
      }
    } else {
      bot.sendMessage(
        chatId,
        "Извините, эта команда доступна только администраторам."
      );
    }
  }
);

// Handler for incoming messages
bot.on("message", async (msg: TelegramMessage) => {
  if (!msg.text || msg.text[0] === "/") {
    console.error("admin comand skipped", msg.text);
    return;
  }

  const messageText = msg.text;
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  //console.log("from TG: ", userId, chatId, msg);

  try {
    const chatCompletion = await getGroqChatCompletion(msg.text);
    const response = chatCompletion.choices[0]?.message?.content || "";
    console.log("AI response: ", response);
    if (msg.from.id === MY_TG_ID && response === "is_spam") {
      console.log("IM ADMIN! fake DELETE AND NO BANN::: ", messageText);
      await bot.deleteMessage(chatId, msg.message_id);
    } else if (response === "is_spam") {
      console.log("SPAM!");
      await bot.deleteMessage(chatId, msg.message_id);
      if (userId !== MY_TG_ID) {
        await bot.restrictChatMember(chatId, userId, {
          permissions: { can_send_messages: false },
        });
        bannUser(msg);
      }
    }
  } catch (error) {
    console.log("Error checking spam:", error);
  }
});

// Function to get a chat completion from the Groq AI
async function getGroqChatCompletion(msg: string) {
  const aiParams = {
    messages: [
      {
        role: "system",
        content: `You are an anti-spam assistant in a group about fishing tours. Analyze each message carefully and respond **only** with either "is_spam" or "is_no_spam" without any additional characters.

        If the message contains any information about fishing (such as fishing locations, techniques, equipment), you should respond with "is_no_spam". 
        
        The group supports both Russian and English languages. Messages with content like "passive income," "remote earnings," or "get paid with minimal effort" are considered spam. 
        
        Check for similar phrases in Russian. Here are some examples of spam messages: ${spamMsgs.msg.join(
          "\n"
        )}
        
        Use the following spam keywords to help identify spam keywords: ${JSON.stringify(
          spamKeywords.words
        )}.`,
      },
      { role: "user", content: msg },
    ],
    model: "llama3-8b-8192",
  };
  console.log(aiParams);
  return groq.chat.completions.create(aiParams);
}

// Main function to load required data and start bot
async function main() {
  await loadKeywords();
  await loadLogs();
}

main();
