require("dotenv").config();
const { Telegraf } = require("telegraf");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Function to download voice message
async function downloadFile(fileId) {
    const fileInfo = await bot.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;
    const localPath = path.join(__dirname, "voice.ogg");

    const response = await axios({
        url: fileUrl,
        method: "GET",
        responseType: "stream",
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);
        writer.on("finish", () => resolve(localPath));
        writer.on("error", reject);
    });
}

// Function to send audio to Deepgram
async function transcribeAudio(filePath) {
    const audioData = fs.createReadStream(filePath);
    
    try {
        const response = await axios.post(
            "https://api.deepgram.com/v1/listen?model=base&smart_format=true&language=ru",
            audioData,
            {
                headers: {
                    "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
                    "Content-Type": "audio/ogg",
                },
            }
        );
        console.log(response.data);
        return response.data.results.channels[0].alternatives[0].transcript || "No transcript available.";
    } catch (error) {
        console.error("Deepgram API error:", error.response?.data || error.message);
        return "Error transcribing the audio.";
    }
}

// Handle voice messages
bot.on("voice", async (ctx) => {
    try {
        await ctx.reply("Processing your voice message...");
        const fileId = ctx.message.voice.file_id;
        const filePath = await downloadFile(fileId);
        const transcript = await transcribeAudio(filePath);
        await ctx.reply(`📝 Transcription: ${transcript}`);
        fs.unlinkSync(filePath); // Cleanup file
    } catch (error) {
        console.error("Error:", error);
        await ctx.reply("Sorry, something went wrong.");
    }
});

bot.launch();
console.log("🤖 Bot is running...");
