const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const axios = require("axios"); // Use axios for API requests
const Groq = require("groq-sdk");

const token = "7363518040:AAG415iNi8127l2tCIw7zaFV73J8CVf2G5o";
const MY_TG_ID = 314044882;
const bot = new TelegramBot(token, { polling: true });

const GROQ_API_URL = "https://api.groq.com/spam_detection"; // Replace with the actual API endpoint
const GROQ_API_KEY = "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"; // Replace with your Groq API key

const groq = new Groq({ apiKey: GROQ_API_KEY });
// this is initial test span words
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

// Functions for saving and loading spam keywords and logs
const saveKeywords = () =>
  fs.writeFileSync("spamKeywords.json", JSON.stringify(spamKeywords));
const saveMsgs = () =>
  fs.writeFileSync("spamMsgs.json", JSON.stringify(spamMsgs));

const saveLogs = (spamLogs) =>
  fs.writeFileSync("spamLogs.json", JSON.stringify(spamLogs));
var spamLogs = [];
const loadLogs = async () => {
  if (await fs.existsSync("spamLogs.json")) {
    spamLogs = JSON.parse(await fs.readFileSync("spamLogs.json"));
  }
};
const loadKeywords = async () => {
  if (await fs.existsSync("spamKeywords.json")) {
    spamKeywords = JSON.parse(await fs.readFileSync("spamKeywords.json"));
  }
};

bot.onText(/\/start/, (msg) =>
  bot.sendMessage(msg.chat.id, "Привет! Я твой рыбо анти-спам бот.")
);
bot.onText(/\/list/, (msg) =>
  bot.sendMessage(msg.chat.id, `список "${JSON.stringify(spamKeywords)}"`)
);
bot.onText(/\/logs/, (msg) =>
  bot.sendMessage(
    msg.chat.id,
    `logs "${JSON.stringify(spamLogs)}"` + spamLogs.length
  )
);

bot.onText(/\/add (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const newKeyword = match[1].toLowerCase();

  bot.getChatMember(chatId, userId).then((member) => {
    if (member.user.id == MY_TG_ID) {
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
  });
});
bot.onText(/\/addmsg (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const newMsg = match[1].toLowerCase();

  bot.getChatMember(chatId, userId).then((member) => {
    if (member.user.id == MY_TG_ID) {
      spamMsgs.msg.push(newMsg);
      saveMsgs(); // save spam msg
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
  });
});
bot.onText(/\/remove (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const keywordToRemove = match[1].toLowerCase();

  bot.getChatMember(chatId, userId).then((member) => {
    if (member.user.id == MY_TG_ID) {
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
  });
});

type telegramMessage = {
  chat: {
    id: number;
  };
  from: {
    id: number;
    username: string;
  };
  text: string;
};
const bannUser = (bot, msg: telegramMessage) => {
  bot.sendMessage(
    msg.chat.id,
    `Пользователь ${msg.from.username} был заблокирован за спам.`
  );
  spamKeywords.countOfbannedAI = (spamKeywords.countOfbannedAI || 0) + 1;
  spamLogs.push({ user: msg.from, msg: msg.text } as never);
  saveKeywords();
  saveLogs(spamLogs);
  axios
    .get("https://api.telegram.org/bot" + token + "/sendMessage", {
      params: {
        chat_id: MY_TG_ID,
        text: "BaNN USER: " + JSON.stringify(msg.from) + "\n " + msg.text,
      },
    })
    .then(function (response) {
      console.log("OK");
    })
    .catch(function (error) {
      console.log(error);
    })
    .finally(function () {
      // always executed
    });
  //axios.sendMessage('https://api.telegram.org/bot7363518040:AAG415iNi8127l2tCIw7zaFV73J8CVf2G5o/sendMessage?chat_id=314044882&text=test!!!');
};

bot.on("message", async (msg) => {
  console.log(msg);
  if (msg.text) {
    const messageText = msg.text.toLowerCase();
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    console.log("from TG: ", userId, chatId, msg);
    // Check if message is spam using Groq AI
    try {
      const chatCompletion = await getGroqChatCompletion(msg.text);

      const response = chatCompletion.choices[0]?.message?.content || "";
      console.log("AI response: ", response);
      if (msg.from.id == MY_TG_ID) {
        console.log("IM ADMIN! fake DELETE AND NO BANN ", userId, messageText);
        bot.deleteMessage(chatId, msg.message_id);
      } else {
        if (response == "is_spam") {
          console.log("SPAM!");
          // Delete and log spam message if Groq AI detects spam
          bot
            .deleteMessage(chatId, msg.message_id)
            .then(() => {
              if (userId != MY_TG_ID) {
                bot
                  .restrictChatMember(chatId, userId, {
                    permissions: { can_send_messages: false },
                  })
                  .then(() => bannUser(bot, msg));
              }
            })
            .catch((err) => console.log(err));
        }
      }
    } catch (error) {
      console.log("Error checking spam:", error);
    }
  } else {
    console.error("Wrong tg answer", msg);
  }
});

async function getGroqChatCompletion(msg) {
  const aiParams = {
    messages: [
      {
        role: "system",
        content: `You are an anti-spam assistant in a group about fishing tours. Analyze each message carefully and respond **only** with either "is_spam" or "is_no_spam" without any additional characters.
    
    If the message contains any information about fishing (such as fishing locations, techniques, equipment), you should respond with "is_no_spam". 
    
    The group supports both Russian and English languages. Messages with content like "passive income," "remote earnings," or "get paid with minimal effort" are considered spam. 
    
    Check for similar phrases in Russian. Here are some examples of spam messages:
    ${spamMsgs.msg.join("\n")}
    
    Use the following spam keywords to help identify spam messages: ${JSON.stringify(
      spamKeywords
    )}.`,
      },
      { role: "user", content: msg },
    ],
    model: "llama3-8b-8192",
  };
  console.log(aiParams);
  return groq.chat.completions.create(aiParams);
}

async function main() {
  loadKeywords();
  loadLogs();
  //const chatCompletion = await getGroqChatCompletion('Продам гараж, пишите в личку.');
  // Print the completion returned by the LLM.
  //console.log(chatCompletion.choices[0]?.message?.content || "");
  // Print the completion returned by the LLM.
  //console.log(chatCompletion.choices[0]?.message?.content || "");
}

main();
