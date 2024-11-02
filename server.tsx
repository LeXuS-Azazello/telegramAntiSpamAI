const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
//const axios = require('axios'); // Use axios for API requests
const Groq = require("groq-sdk");

const token = '7363518040:AAG415iNi8127l2tCIw7zaFV73J8CVf2G5o';
const MY_TG_ID = 314044882;
const bot = new TelegramBot(token, { polling: true });

const GROQ_API_URL = 'https://api.groq.com/spam_detection'; // Replace with the actual API endpoint
const GROQ_API_KEY = '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'; // Replace with your Groq API key

const groq = new Groq({ apiKey: GROQ_API_KEY });




var spamKeywords = {words: ['спамслово1', 'спамслово2', 'спамслово3'], countOfbanned: 0};

// Functions for saving and loading spam keywords and logs
const saveKeywords = () => fs.writeFileSync('spamKeywords.json', JSON.stringify(spamKeywords));
const saveLogs = (spamLogs) => fs.writeFileSync('spamLogs.json', JSON.stringify(spamLogs));
var spamLogs = [];
const loadLogs = async () => {
    if (await fs.existsSync('spamLogs.json')) {
        spamLogs = JSON.parse(await fs.readFileSync('spamLogs.json'));
    }
};
const loadKeywords = async () => {
    if (await fs.existsSync('spamKeywords.json')) {
        spamKeywords = JSON.parse(await fs.readFileSync('spamKeywords.json'));
    }
};

bot.onText(/\/start/, (msg) => bot.sendMessage(msg.chat.id, 'Привет! Я твой рыбо анти-спам бот.'));
bot.onText(/\/list/, (msg) => bot.sendMessage(msg.chat.id, `список "${JSON.stringify(spamKeywords)}"`));
bot.onText(/\/logs/, (msg) => bot.sendMessage(msg.chat.id, `logs "${JSON.stringify(spamLogs)}"` + spamLogs.length));

bot.onText(/\/add (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const newKeyword = match[1].toLowerCase();

    bot.getChatMember(chatId, userId).then(member => {
        if (member.user.id == MY_TG_ID) {
            spamKeywords.words.push(newKeyword);
            saveKeywords();
            bot.sendMessage(chatId, `Ключевое слово "${newKeyword}" было добавлено в список блокировки.`);
        } else {
            bot.sendMessage(chatId, 'Извините, эта команда доступна только администраторам.');
        }
    });
});
bot.onText(/\/remove (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const keywordToRemove = match[1].toLowerCase();

    bot.getChatMember(chatId, userId).then(member => {
        if (member.user.id == MY_TG_ID) {
            const index = spamKeywords.words.indexOf(keywordToRemove);
            if (index !== -1) {
                spamKeywords.words.splice(index, 1);
                saveKeywords();
                bot.sendMessage(chatId, `Ключевое слово "${keywordToRemove}" было удалено из списка блокировки.`);
            } else {
                bot.sendMessage(chatId, `Ключевое слово "${keywordToRemove}" не найдено в списке блокировки.`);
            }
        } else {
            bot.sendMessage(chatId, 'Извините, эта команда доступна только администраторам.');
        }
    });
});

const bannUser = (bot, msg) => {
    bot.sendMessage(msg.chat.id, `Пользователь ${msg.from.username} был заблокирован за спам.`);
    spamKeywords.countOfbanned = (spamKeywords.countOfbanned || 0) + 1;
    spamLogs.push({ user: msg.from, msg: msg.text });
    saveKeywords();
    saveLogs(spamLogs);
};

bot.on('message', async (msg) => {
    console.log(msg)
    if(msg.text) {
        const messageText = msg.text.toLowerCase();
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        console.log('from TG: ', msg);
        // Check if message is spam using Groq AI
        try {
            const chatCompletion = await getGroqChatCompletion(msg.text)
            
            
            const response = chatCompletion.choices[0]?.message?.content || "";
            console.log("AI response: ", response);
            if (msg.from.id == MY_TG_ID) { 
                console.log('IM ADMIN! fake DELETE AND BANN ', userId, messageText)
            }
            else {
                if (response == 'is_spam') {
                    console.log('SPAM!')
                    // Delete and log spam message if Groq AI detects spam
                    bot.deleteMessage(chatId, msg.message_id)
                        .then(() => {
                            if (userId != MY_TG_ID) {
                                bot.restrictChatMember(chatId, userId, {
                                    permissions: { can_send_messages: false }
                                }).then(() => bannUser(bot, msg));
                            }
                        })
                        .catch(err => console.log(err));
                }
            }
        } catch (error) {
            console.log('Error checking spam:', error);
        }
    }
    else {
        console.error('Wrong tg answer', msg);
    }
});


async function getGroqChatCompletion(msg) {
  return groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a anti spam assistant. This is group about fishing tours. Do not mark is_spam if message contains any info about fishing. You must check message and answer only: is_spam or is_no_spam. This is spam black list: ' + JSON.stringify(spamKeywords) },
      { role: 'user', content: msg },
    ],
    model: "llama3-8b-8192",
  });
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
