require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ----------------------
// Shared Gemini prompt
// ----------------------

const EXTRACTION_PROMPT = `
Worker may speak Hindi, Punjabi, or other language.
Translate to English.

Extract ONLY:

Part Name
Qty Required
Size
Material
For Machine
Vendor

Return JSON only, no explanation.

Example:
{
  "Part Name": "",
  "Qty Required": "",
  "Size": "",
  "Material": "",
  "For Machine": "",
  "Vendor": ""
}
`;

// ----------------------
// WhatsApp Client
// ----------------------

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    console.log("Scan QR:");
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log("WhatsApp Connected");
});

// ----------------------
// Listen for messages
// ----------------------

client.on('message_create', async msg => {
    try {
        console.log("\nNew message:");
        console.log(msg.body);

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // ----------------------
        // AUDIO: Voice note
        // ----------------------

        if (msg.hasMedia) {
            const media = await msg.downloadMedia();

            if (media.mimetype && media.mimetype.includes('audio')) {
                console.log("Voice note received");

                const buffer = Buffer.from(media.data, 'base64');
                const filename = `voice_${Date.now()}.ogg`;
                fs.writeFileSync(filename, buffer);
                console.log("Saved:", filename);

                const audioBase64 = fs.readFileSync(filename).toString("base64");

                const result = await model.generateContent([
                    EXTRACTION_PROMPT,
                    {
                        inlineData: {
                            mimeType: "audio/ogg",
                            data: audioBase64
                        }
                    }
                ]);

                console.log("\nGemini Output (audio):");
                console.log(result.response.text());

                // Clean up temp file
                fs.unlinkSync(filename);
            }

        // ----------------------
        // TEXT: Plain message
        // ----------------------

        } else if (msg.body && msg.body.trim().length > 0) {
            console.log("Text message received");

            const result = await model.generateContent([
                EXTRACTION_PROMPT,
                { text: msg.body }
            ]);

            console.log("\nGemini Output (text):");
            console.log(result.response.text());
        }

    } catch (err) {
        console.log("ERROR:");
        console.log(err);
    }
});

// ----------------------

client.initialize();