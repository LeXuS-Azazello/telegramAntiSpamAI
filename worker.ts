import { TelegramAntiSpamBot } from "./TelegramAntiSpamBot";

export default {
  async fetch(request: Request, env: any, ctx: any) {
    // Only handle Telegram webhook POSTs
    if (request.method === "POST") {
      const bot = new TelegramAntiSpamBot(env);
      return await bot.handleTelegramWebhook(request);
    }
    return new Response("OK", { status: 200 });
  },
};
