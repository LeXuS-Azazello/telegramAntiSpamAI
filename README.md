# Telegram Anti-Spam Bot

This project is a Telegram bot designed to help manage spam in a group about fishing tours. It uses the Groq AI service to classify incoming messages as spam or not.

## Prerequisites

- Node.js and npm installed
- A Telegram bot token
- Groq API key

## Installation and Setup

1. **Clone the repository**
   ```bash
   git clone <repository_url>
   cd telegramAntiSpam/telegramAntiSpam
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a .env file**
   Inside the telegramAntiSpam directory, create a file called .env with the following content:

   ```
   TELEGRAM_BOT_TOKEN=<your_telegram_bot_token>
   MY_TG_ID=<your_telegram_user_id>
   GROQ_API_KEY=<your_groq_api_key>
   ```

   Replace `<your_telegram_bot_token>`, `<your_telegram_user_id>`, and `<your_groq_api_key>` with your actual tokens and ID.

## Running the Server

To start the bot, run:

```bash
node server.js
```

## Bot Commands

- **Start the bot**: `/start`  
  Initiates the bot and sends a welcome message.

- **List all spam messages**: `/listmsg`  
  Displays the list of predefined spam messages.

- **List all spam keywords**: `/list`  
  Displays the list of spam keywords.

- **List ban logs**: `/logs`  
  Shows all logs of banned users.

- **Add a new keyword**: `/add <keyword>`  
  Adds a new keyword to the spam filters. (Admin only)

- **Add a new spam message**: `/addmsg <message>`  
  Adds a new predefined spam message. (Admin only)

- **Remove a keyword**: `/remove <keyword>`  
  Removes a keyword from the spam filters. (Admin only)

## Notes

Ensure your bot has the requisite permissions to delete messages and restrict chat members in the group.

You can edit `spamKeywords.json` and `spamMsgs.json` directly if you need to modify data manually.
