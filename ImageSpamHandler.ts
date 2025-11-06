// src/ImageSpamHandler.ts

export interface TelegramMessage {
  chat: { id: number };
  from?: { id: number; username: string };
  caption?: string;
  photo?: Array<{
    file_id: string;
    file_size?: number;
    width?: number;
    height?: number;
  }>;
  message_id: number;
}

export class ImageSpamHandler {
  private TELEGRAM_BOT_TOKEN: string;
  private GROQ_API_KEY: string;
  private AI_MODEL: string;
  private spamKeywords: any; // SpamKeywordData
  private spamMsgs: any; // SpamMsgsData

  constructor(
    telegramBotToken: string,
    groqApiKey: string,
    aiModel: string,
    spamKeywords: any,
    spamMsgs: any
  ) {
    this.TELEGRAM_BOT_TOKEN = telegramBotToken;
    this.GROQ_API_KEY = groqApiKey;
    this.AI_MODEL = aiModel;
    this.spamKeywords = spamKeywords;
    this.spamMsgs = spamMsgs;
  }

  // Download file from Telegram by file_id
  private async downloadTelegramFile(fileId: string): Promise<Uint8Array> {
    try {
      // Step 1: Get file info
      const fileInfoResponse = await fetch(
        `https://api.telegram.org/bot${this.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
      );
      const fileInfo = (await fileInfoResponse.json()) as {
        ok: boolean;
        result?: { file_path?: string };
      };
      if (!fileInfo.ok) {
        throw new Error(`Failed to get file info: ${JSON.stringify(fileInfo)}`);
      }

      const filePath = fileInfo.result?.file_path;
      if (!filePath) {
        throw new Error("No file_path in response");
      }

      // Step 2: Download the file
      const downloadUrl = `https://api.telegram.org/file/bot${this.TELEGRAM_BOT_TOKEN}/${filePath}`;
      const downloadResponse = await fetch(downloadUrl);
      if (!downloadResponse.ok) {
        throw new Error(
          `Failed to download file: ${downloadResponse.statusText}`
        );
      }

      return new Uint8Array(await downloadResponse.arrayBuffer());
    } catch (err) {
      console.error("Error downloading Telegram file:", err);
      throw err;
    }
  }

  // Convert Uint8Array to base64
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  // Main method: Process image, analyze with Groq vision, return if spam
  async processImage(
    msg: TelegramMessage,
    getGroqChatCompletion: (text: string, imageBase64?: string) => Promise<any>
  ): Promise<boolean> {
    try {
      if (!msg.photo || msg.photo.length === 0) {
        return false;
      }

      // Get the largest photo (last in array)
      const largestPhoto = msg.photo[msg.photo.length - 1];
      const fileId = largestPhoto.file_id;

      console.log(`Downloading image ${fileId} for analysis`);

      // Download image
      const imageBuffer = await this.downloadTelegramFile(fileId);
      if (imageBuffer.length === 0) {
        console.error("Downloaded empty image");
        return false;
      }

      // Convert to base64
      const imageBase64 = this.arrayBufferToBase64(imageBuffer);
      console.log(
        `Image converted to base64, size: ${imageBuffer.length} bytes`
      );

      // Use caption as text if available, else empty
      const textToAnalyze = msg.caption || "";

      // Analyze with Groq vision
      const chatCompletion = await getGroqChatCompletion(
        textToAnalyze,
        imageBase64
      );
      const response = chatCompletion.choices?.[0]?.message?.content || "";
      console.log("Image analysis response:", response);

      return response.trim() === "is_spam";
    } catch (err: any) {
      console.error("Error processing image:", err);
      // On error, assume not spam to avoid false positives
      return false;
    }
  }
}
