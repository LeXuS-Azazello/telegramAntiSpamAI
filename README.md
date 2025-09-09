# Telegram Anti-Spam Bot (Cloudflare Worker)

This project is a Telegram bot for managing spam in fishing tour groups. It uses Groq AI for spam detection and is designed to run on Cloudflare Workers with KV and D1 for persistent storage.

## Prerequisites

- Telegram bot token
- Groq API key
- Your Telegram user ID (for admin commands)
- Cloudflare account with Workers, KV, and D1 enabled

## Installation and Setup

1. **Clone the repository**

   ```bash
   git clone <repository_url>
   cd telegramAntiSpam/telegramAntiSpam
   ```

2. **Configure Cloudflare Worker**

   - Edit `wrangler.toml` and set your secrets and bindings:
     - `TELEGRAM_BOT_TOKEN`
     - `MY_TG_ID`
     - `GROQ_API_KEY`
     - KV namespaces for `SPAM_KEYWORDS` and `SPAM_MSGS`
     - D1 database for `DB`

3. **Deploy the Worker**

   ```bash
   wrangler deploy
   ```

4. **Set Telegram Webhook**

   Replace `<TELEGRAM_BOT_TOKEN>` and `<your-worker-url>` with your values:

   ```
   https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-worker-url>
   ```

   Example:

   ```
   https://api.telegram.org/bot123456:ABC-DEF1234ghIklmno/setWebhook?url=https://telegram-antispam-worker.your-domain.workers.dev
   ```

## How It Works

- Telegram sends updates to your Worker via webhook.
- The Worker checks messages for spam using Groq AI and your custom filters.
- Spam messages are deleted and users may be restricted.
- All actions and logs are stored in Cloudflare KV and D1.

## Bot Commands

- `/start` — Welcome message
- `/listmsg` — List all spam messages
- `/list` — List all spam keywords
- `/logs` — Show ban logs
- `/add <keyword>` — Add a spam keyword (admin only)
- `/addmsg <message>` — Add a spam message (admin only)
- `/remove <keyword>` — Remove a spam keyword (admin only)

## Notes

- Make sure your bot has permission to delete messages and restrict users in your Telegram group.
- All persistent data is stored in Cloudflare KV and D1; no local files are used.
- You do **not** need to set up the webhook in the Cloudflare dashboard—just register it with Telegram as shown above.

## Troubleshooting

- If the bot does not respond, check your Worker logs in the Cloudflare dashboard.
- Ensure all environment variables and bindings are set correctly in `wrangler.toml`.
- Make sure your Telegram webhook URL is correct and publicly accessible.

````<!-- filepath: /home/lexus/projects/telegramBots/telegramAntispam/telegramAntiSpam/README.md -->
# Telegram Anti-Spam Bot (Cloudflare Worker)

This project is a Telegram bot for managing spam in fishing tour groups. It uses Groq AI for spam detection and is designed to run on Cloudflare Workers with KV and D1 for persistent storage.

## Prerequisites

- Telegram bot token
- Groq API key
- Your Telegram user ID (for admin commands)
- Cloudflare account with Workers, KV, and D1 enabled

## Installation and Setup

1. **Clone the repository**

   ```bash
   git clone <repository_url>
   cd telegramAntiSpam/telegramAntiSpam
````

2. **Configure Cloudflare Worker**

   - Edit `wrangler.toml` and set your secrets and bindings:
     - `TELEGRAM_BOT_TOKEN`
     - `MY_TG_ID`
     - `GROQ_API_KEY`
     - KV namespaces for `SPAM_KEYWORDS` and `SPAM_MSGS`
     - D1 database for `DB`

3. **Deploy the Worker**

   ```bash
   wrangler deploy
   ```

4. **Set Telegram Webhook**

   Replace `<LEGRAM_BOT_TOKEN>` and `<your-worker-url>` with your values:

   ```
   https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<your-worker-url>
   ```

   Example:

   ```
   https://api.telegram.org/bot123456:ABC-DEF1234ghIklmno/setWebhook?url=https://telegram-antispam-worker.your-domain.workers.dev
   ```

## How It Works

- Telegram sends updates to your Worker via webhook.
- The Worker checks messages for spam using Groq AI and your custom filters.
- Spam messages are deleted and users may be restricted.
- All actions and logs are stored in Cloudflare KV and D1.

## Bot Commands

- `/start` — Welcome message
- `/listmsg` — List all spam messages
- `/list` — List all spam keywords
- `/logs` — Show ban logs
- `/add <keyword>` — Add a spam keyword (admin only)
- `/addmsg <message>` — Add a spam message (admin only)
- `/remove <keyword>` — Remove a spam keyword (admin only)

## Notes

- Make sure your bot has permission to delete messages and restrict users in your Telegram group.
- All persistent data is stored in Cloudflare KV and D1; no local files are used.
- You do **not** need to set up the webhook in the Cloudflare dashboard—just register it with Telegram as shown above.

## Troubleshooting

- If the bot does not respond, check your Worker logs in the Cloudflare dashboard.
- Ensure all environment variables and bindings are set correctly in `wrangler.toml`.
- Make sure your Telegram webhook URL is correct and publicly accessible.
