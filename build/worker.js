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
const TelegramAntiSpamBot_1 = require("./TelegramAntiSpamBot");
exports.default = {
    fetch(request, env, ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            // Only handle Telegram webhook POSTs
            if (request.method === "POST") {
                const bot = new TelegramAntiSpamBot_1.TelegramAntiSpamBot(env);
                return yield bot.handleTelegramWebhook(request);
            }
            return new Response("OK", { status: 200 });
        });
    },
};
