// // // require('dotenv').config();

// // // const {
// // //     Client,
// // //     LocalAuth
// // // } = require('whatsapp-web.js');

// // // const qrcode =
// // // require('qrcode-terminal');

// // // const fs =
// // // require('fs');

// // // const {
// // //     GoogleGenerativeAI
// // // } = require("@google/generative-ai");

// // // const genAI =
// // // new GoogleGenerativeAI(
// // //     process.env.GEMINI_API_KEY
// // // );


// // // // ----------------------
// // // // WhatsApp Client
// // // // ----------------------

// // // const client =
// // // new Client({
// // //     authStrategy:
// // //         new LocalAuth()
// // // });

// // // client.on('qr', qr => {

// // //     console.log(
// // //         "Scan QR:"
// // //     );

// // //     qrcode.generate(
// // //         qr,
// // //         { small:true }
// // //     );

// // // });


// // // client.on(
// // // 'ready',
// // // () => {

// // // console.log(
// // // "WhatsApp Connected"
// // // );

// // // });


// // // // ----------------------
// // // // Listen for messages
// // // // ----------------------

// // // client.on('message', async msg => {

// // //     const chat =
// // //     await msg.getChat();

// // //     console.log(
// // //         "Name:",
// // //         chat.name
// // //     );

// // //     console.log(
// // //         "ID:",
// // //         chat.id._serialized
// // //     );

// // // });


// // // // ----------------------
// // // // Check voice note
// // // // ----------------------

// // // if(msg.hasMedia){

// // // const media =
// // // await msg.downloadMedia();

// // // if(
// // // media.mimetype &&
// // // media.mimetype.includes(
// // // 'audio'
// // // )
// // // ){

// // // console.log(
// // // "Voice note received"
// // // );


// // // // save audio

// // // const buffer =
// // // Buffer.from(
// // // media.data,
// // // 'base64'
// // // );

// // // const filename =
// // // `voice_${Date.now()}.ogg`;

// // // fs.writeFileSync(
// // // filename,
// // // buffer
// // // );

// // // console.log(
// // // "Saved:",
// // // filename
// // // );


// // // // ----------------------
// // // // Gemini Processing
// // // // ----------------------

// // // const model =
// // // genAI.getGenerativeModel({

// // // model:
// // // "gemini-2.5-flash"

// // // });


// // // const audioBase64 =
// // // fs.readFileSync(
// // // filename
// // // ).toString(
// // // "base64"
// // // );


// // // const prompt = `

// // // Worker may speak
// // // Hindi, Punjabi,
// // // or other language.

// // // Translate to English.

// // // Extract ONLY:

// // // Part Name
// // // Qty Required
// // // Size
// // // Material
// // // For Machine
// // // Vendor

// // // Return JSON.

// // // Example:

// // // {
// // // "Part Name":"",
// // // "Qty Required":"",
// // // "Size":"",
// // // "Material":"",
// // // "For Machine":"",
// // // "Vendor":""
// // // }

// // // `;


// // // const result =
// // // await model
// // // .generateContent([

// // // prompt,

// // // {
// // // inlineData:{

// // // mimeType:
// // // "audio/ogg",

// // // data:
// // // audioBase64

// // // }
// // // }

// // // ]);


// // // console.log(
// // // "\nGemini Output:"
// // // );

// // // console.log(
// // // result.response.text()
// // // );

// // // }

// // // }

// // // }catch(err){

// // // console.log(
// // // "ERROR:"
// // // );

// // // console.log(err);

// // // }

// // // });


// // // // ----------------------

// // // client.initialize();

// // require('dotenv').config();

// // const {google} = require('googleapis');
// // const { Client, LocalAuth } = require('whatsapp-web.js');
// // const qrcode = require('qrcode-terminal');
// // const fs = require('fs');
// // const { GoogleGenerativeAI } =
// //     require("@google/generative-ai");

// // const genAI =
// //     new GoogleGenerativeAI(
// //         process.env.GEMINI_API_KEY
// //     );


// // // ==========================================
// // // CONFIG
// // // ==========================================

// // const TARGET_GROUP =
// //     "120363427181556541@g.us"; // Example: 12036....@g.us


// // // ==========================================
// // // WHATSAPP CLIENT
// // // ==========================================

// // const client = new Client({
// //     authStrategy: new LocalAuth()
// // });

// // client.on('qr', qr => {
// //     console.log("Scan QR:");
// //     qrcode.generate(qr, { small: true });
// // });

// // client.on('ready', () => {
// //     console.log("WhatsApp Connected");
// // });


// // // ==========================================
// // // LISTEN FOR MESSAGES
// // // ONLY FROM TARGET GROUP
// // // ==========================================

// // client.on('message', async (msg) => {

// //     try {

// //         const chat =
// //             await msg.getChat();

// //         // Ignore everything except chosen group

// //         if (
// //             !chat.isGroup ||
// //             chat.id._serialized !== TARGET_GROUP
// //         ) {
// //             return;
// //         }

// //         console.log("\n==================");
// //         console.log("Factory Group:");
// //         console.log(chat.name);
// //         console.log("==================");


// //         // ==========================
// //         // TEXT MESSAGE
// //         // ==========================

// //         if (
// //             msg.body &&
// //             !msg.hasMedia &&
// //             msg.body.trim() !== ""
// //         ) {

// //             console.log(
// //                 "Text:",
// //                 msg.body
// //             );

// //             const data =
// //                 await processText(
// //                     msg.body
// //                 );

// //             console.log(
// //                 "\nExtracted:"
// //             );

// //             console.log(data);
// //             await updateSheet(data);
// //         }


// //         // ==========================
// //         // VOICE NOTE
// //         // ==========================

// //         if (msg.hasMedia) {

// //             const media =
// //                 await msg.downloadMedia();

// //             if (
// //                 media.mimetype &&
// //                 media.mimetype.includes(
// //                     'audio'
// //                 )
// //             ) {

// //                 console.log(
// //                     "Voice note received"
// //                 );

// //                 const filename =
// //                     `voice_${Date.now()}.ogg`;

// //                 fs.writeFileSync(
// //                     filename,
// //                     Buffer.from(
// //                         media.data,
// //                         'base64'
// //                     )
// //                 );

// //                 console.log(
// //                     "Saved:",
// //                     filename
// //                 );

// //                 const data =
// //                     await processAudio(
// //                         filename
// //                     );

// //                 console.log(
// //                     "\nExtracted:"
// //                 );

// //                 console.log(data);
// //                 await updateSheet(data);
// //             }
// //         }

// //     }
// //     catch (err) {

// //         console.log(
// //             "\nERROR:"
// //         );

// //         console.log(err);
// //     }

// // });



// // // ==========================================
// // // PROCESS TEXT → GEMINI
// // // ==========================================

// // async function processText(text) {

// //     const model =
// //         genAI.getGenerativeModel({
// //             model:
// //                 "gemini-2.5-flash"
// //         });



// // const prompt = `
// // Translate to English.

// // Extract:
// // Part Name
// // Qty Required
// // Size
// // Material
// // For Machine
// // Vendor

// // Return ONLY valid JSON like this:
// // {
// //   "Part Name": "",
// //   "Qty Required": "",
// //   "Size": "",
// //   "Material": "",
// //   "For Machine": "",
// //   "Vendor": ""
// // }

// // Message:
// // ${text}

// // `;

// //     const result =
// //         await model.generateContent(
// //             prompt
// //         );

// //     try {

// //         return JSON.parse(
// //             result.response.text()
// //         );

// //     } catch {

// //         return result.response.text();
// //     }
// // }



// // // ==========================================
// // // PROCESS AUDIO → GEMINI
// // // ==========================================

// // async function processAudio(filename) {

// //     const model =
// //         genAI.getGenerativeModel({
// //             model:
// //                 "gemini-2.5-flash"
// //         });

// //     const audioBase64 =
// //         fs.readFileSync(
// //             filename
// //         ).toString(
// //             'base64'
// //         );


// //     const result =
// //         await model.generateContent([

// //             `
// // Translate to English.

// // Extract:

// // Part Name
// // Qty Required
// // Size
// // Material
// // For Machine
// // Vendor

// // Return JSON ONLY.
// //             `,

// //             {
// //                 inlineData: {
// //                     mimeType:
// //                         "audio/ogg",

// //                     data:
// //                         audioBase64
// //                 }
// //             }

// //         ]);


// //     try {

// //         return JSON.parse(
// //             result.response.text()
// //         );

// //     } catch {

// //         return result.response.text();
// //     }

// // }

// // // ===================================
// // // UPDATE GOOGLE SHEET
// // // ===================================

// // async function updateSheet(data){

// // try{

// // const auth =
// // new google.auth.GoogleAuth({

// // keyFile:
// // 'credentials.json',

// // scopes:[
// // 'https://www.googleapis.com/auth/spreadsheets'
// // ]

// // });


// // const sheets =
// // google.sheets({

// // version:'v4',
// // auth

// // });


// // const res = await sheets.spreadsheets.values.append({
// //   spreadsheetId: '14QSTB1DJeaY44Ec2WTA12znOW6L5AsLALhLLEedwVpI',
// //   range: 'Sheet1!A:F',   // IMPORTANT FIX (use your tab name)
// //   valueInputOption: 'USER_ENTERED',
// //   requestBody: {
// //     values: [[
// //       data["Part Name"] || "",
// //       data["Qty Required"] || "",
// //       data["Size"] || "",
// //       data["Material"] || "",
// //       data["For Machine"] || "",
// //       data["Vendor"] || ""
// //     ]]
// //   }
// // });

// // console.log("Google Sheet Updated");
// // console.log("Append Response:", JSON.stringify(res.data, null, 2));

// // }

// // catch(err){

// // console.log(
// // "Sheet Error:"
// // );

// // console.log(err);

// // }

// // }

// // // ==========================================
// // // START CLIENT
// // // ==========================================


// // client.initialize();

// // require('dotenv').config();

// // const {google} = require('googleapis');
// // const { Client, LocalAuth } = require('whatsapp-web.js');
// // const qrcode = require('qrcode-terminal');
// // const fs = require('fs');
// // const { GoogleGenerativeAI } = require("@google/generative-ai");

// // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


// // // ==========================================
// // // CONFIG
// // // ==========================================

// // const TARGET_GROUP = "120363427181556541@g.us";


// // // ==========================================
// // // WHATSAPP CLIENT
// // // ==========================================

// // const client = new Client({
// //     authStrategy: new LocalAuth()
// // });

// // client.on('qr', qr => {
// //     console.log("Scan QR:");
// //     qrcode.generate(qr, { small: true });
// // });

// // client.on('ready', () => {
// //     console.log("WhatsApp Connected");
// // });


// // // ==========================================
// // // LISTEN FOR MESSAGES
// // // ONLY FROM TARGET GROUP
// // // ==========================================

// // client.on('message', async (msg) => {

// //     try {

// //         const chat = await msg.getChat();

// //         if (!chat.isGroup || chat.id._serialized !== TARGET_GROUP) {
// //             return;
// //         }

// //         console.log("\n==================");
// //         console.log("Factory Group:");
// //         console.log(chat.name);
// //         console.log("==================");


// //         // ==========================
// //         // TEXT MESSAGE
// //         // ==========================

// //         if (msg.body && !msg.hasMedia && msg.body.trim() !== "") {

// //             console.log("Text:", msg.body);

// //             const data = await processText(msg.body);

// //             console.log("\nExtracted:");
// //             console.log(data);
// //             await updateSheet(data);
// //         }


// //         // ==========================
// //         // VOICE NOTE
// //         // ==========================

// //         if (msg.hasMedia) {

// //             const media = await msg.downloadMedia();

// //             if (media.mimetype && media.mimetype.includes('audio')) {

// //                 console.log("Voice note received");

// //                 const filename = `voice_${Date.now()}.ogg`;

// //                 fs.writeFileSync(filename, Buffer.from(media.data, 'base64'));

// //                 console.log("Saved:", filename);

// //                 const data = await processAudio(filename);

// //                 console.log("\nExtracted:");
// //                 console.log(data);
// //                 await updateSheet(data);
// //             }
// //         }

// //     } catch (err) {
// //         console.log("\nERROR:");
// //         console.log(err);
// //     }

// // });



// // // ==========================================
// // // PROCESS TEXT → GEMINI
// // // ==========================================

// // async function processText(text) {

// //     const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// //     const prompt = `
// // Translate to English.

// // Extract:
// // Part Name, Qty Required, Size, Material, For Machine, Vendor

// // Return ONLY raw JSON with NO markdown, NO code fences, NO explanation:
// // {"Part Name":"","Qty Required":"","Size":"","Material":"","For Machine":"","Vendor":""}

// // Message:
// // ${text}
// // `;

// //     const result = await model.generateContent(prompt);

// //     let raw = result.response.text();

// //     console.log("RAW GEMINI RESPONSE (text):", raw);

// //     raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

// //     try {
// //         return JSON.parse(raw);
// //     } catch {
// //         console.log("PARSE FAILED. Raw:", raw);
// //         return {
// //             "Part Name": raw,
// //             "Qty Required": "",
// //             "Size": "",
// //             "Material": "",
// //             "For Machine": "",
// //             "Vendor": ""
// //         };
// //     }
// // }



// // // ==========================================
// // // PROCESS AUDIO → GEMINI
// // // ==========================================

// // async function processAudio(filename) {

// //     const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// //     const audioBase64 = fs.readFileSync(filename).toString('base64');

// //     const result = await model.generateContent([

// //         `
// // Translate to English.

// // Extract:
// // Part Name, Qty Required, Size, Material, For Machine, Vendor

// // Return ONLY raw JSON with NO markdown, NO code fences, NO explanation:
// // {"Part Name":"","Qty Required":"","Size":"","Material":"","For Machine":"","Vendor":""}
// //         `,

// //         {
// //             inlineData: {
// //                 mimeType: "audio/ogg",
// //                 data: audioBase64
// //             }
// //         }

// //     ]);

// //     let raw = result.response.text();

// //     console.log("RAW GEMINI RESPONSE (audio):", raw);

// //     raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

// //     try {
// //         return JSON.parse(raw);
// //     } catch {
// //         console.log("PARSE FAILED. Raw:", raw);
// //         return {
// //             "Part Name": raw,
// //             "Qty Required": "",
// //             "Size": "",
// //             "Material": "",
// //             "For Machine": "",
// //             "Vendor": ""
// //         };
// //     }
// // }


// // // ===================================
// // // UPDATE GOOGLE SHEET
// // // ===================================

// // async function updateSheet(data) {

// //     try {

// //         console.log("Writing to sheet:", JSON.stringify([
// //             data["Part Name"] || "",
// //             data["Qty Required"] || "",
// //             data["Size"] || "",
// //             data["Material"] || "",
// //             data["For Machine"] || "",
// //             data["Vendor"] || ""
// //         ]));

// //         const auth = new google.auth.GoogleAuth({
// //             keyFile: 'credentials.json',
// //             scopes: ['https://www.googleapis.com/auth/spreadsheets']
// //         });

// //         const sheets = google.sheets({ version: 'v4', auth });

// //         const res = await sheets.spreadsheets.values.append({
// //             spreadsheetId: '14QSTB1DJeaY44Ec2WTA12znOW6L5AsLALhLLEedwVpI',
// //             range: 'Sheet1!A:F',
// //             valueInputOption: 'USER_ENTERED',
// //             requestBody: {
// //                 values: [[
// //                     data["Part Name"] || "",
// //                     data["Qty Required"] || "",
// //                     data["Size"] || "",
// //                     data["Material"] || "",
// //                     data["For Machine"] || "",
// //                     data["Vendor"] || ""
// //                 ]]
// //             }
// //         });

// //         console.log("Google Sheet Updated");
// //         console.log("Append Response:", JSON.stringify(res.data, null, 2));

// //     } catch (err) {
// //         console.log("Sheet Error:");
// //         console.log(err);
// //     }
// // }


// // // ==========================================
// // // START CLIENT
// // // ==========================================

// // client.initialize();

require('dotenv').config();

const { google } = require('googleapis');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


// ==========================================
// CONFIG
// ==========================================

const TARGET_GROUP = "120363427181556541@g.us";


// ==========================================
// WHATSAPP CLIENT
// ==========================================

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


// ==========================================
// LISTEN FOR MESSAGES (Both incoming and self-created)
// ==========================================

client.on('message_create', async (msg) => {

    try {
        const chat = await msg.getChat();

        if (!chat.isGroup || chat.id._serialized !== TARGET_GROUP) {
            return;
        }

        // Extremely robust extraction of the actual JID JID pushname/notifyName/sender JID
        const notifyName = msg.notifyName || msg._data?.notifyName || '';
        let senderName = notifyName;

        if (!senderName) {
            try {
                const contact = await msg.getContact();
                senderName = contact.pushname || contact.name || contact.number || '';
            } catch (err) {
                console.error("Failed to get contact JID for sender identity:", err);
            }
        }

        if (!senderName) {
            const jid = msg.author || msg.from || '';
            senderName = jid.split('@')[0] || 'WhatsApp User';
        }

        senderName = senderName.toString().trim();

        console.log("\n==================");
        console.log("Factory Group:", chat.name);
        console.log("Resolved Sender JID:", senderName);
        console.log("==================");

        // ==========================
        // TEXT MESSAGE
        // ==========================

        if (msg.body && !msg.hasMedia && msg.body.trim() !== "") {

            console.log("Text:", msg.body);

            const items = await processText(msg.body);

            console.log("\nExtracted:");
            console.log(items);

            for (const item of items) {
                console.log(`[WhatsApp Bot] Dispatching text request. Sender: "${senderName}"`);
                console.log(`[WhatsApp Bot] Payload:`, JSON.stringify(item, null, 2));
                await sendToPendingQueue(item, senderName);
            }
        }


        // ==========================
        // VOICE NOTE
        // ==========================

        if (msg.hasMedia) {

            const media = await msg.downloadMedia();

            if (media.mimetype && media.mimetype.includes('audio')) {

                console.log("Voice note received");

                const filename = `voice_${Date.now()}.ogg`;

                fs.writeFileSync(filename, Buffer.from(media.data, 'base64'));

                console.log("Saved:", filename);

                const items = await processAudio(filename);

                console.log("\nExtracted:");
                console.log(items);

                for (const item of items) {
                    console.log(`[WhatsApp Bot] Dispatching audio request. Sender: "${senderName}"`);
                    console.log(`[WhatsApp Bot] Payload:`, JSON.stringify(item, null, 2));
                    await sendToPendingQueue(item, senderName);
                }
            }
        }

    } catch (err) {
        console.log("\nERROR:");
        console.log(err);
    }

});



// ==========================================
// DB INVENTORY FETCH FOR GEMINI PROMPT
// ==========================================

async function fetchInventoryContext() {
    const { Client } = require('pg');
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query('SELECT part_name, sku, material, detail1, detail2, available_qty, unit, price, vendor FROM inventory ORDER BY part_name ASC');

        // Compress inventory rows to a compact text summary for Gemini prompt context
        let context = "Master Inventory (Part Name | SKU | Material | Size Details | Stock Qty | Unit | Price | Preferred Vendor):\n";
        res.rows.forEach(row => {
            const size = [row.detail1, row.detail2].filter(Boolean).join(" / ");
            context += `- "${row.part_name}" | SKU: ${row.sku} | Mat: ${row.material || 'N/A'} | Size: ${size || 'N/A'} | Stock: ${row.available_qty} ${row.unit || 'Pcs.'} | Price: $${row.price || '0.00'} | Vendor: ${row.vendor || 'N/A'}\n`;
        });
        return context;
    } catch (err) {
        console.error("Error fetching inventory context for Gemini:", err);
        return "No inventory database context available due to error.";
    } finally {
        await client.end();
    }
}

// ==========================================
// RESILIENT GEMINI GENERATE WITH RETRY & FALLBACK
// ==========================================

async function generateWithRetry(prompt, isAudio = false, audioBase64 = null) {
    const models = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
    const maxRetries = 3;
    const delays = [2000, 4000, 6000];

    for (const modelName of models) {
        console.log(`Attempting Gemini request using model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                let result;
                if (isAudio) {
                    result = await model.generateContent([
                        prompt,
                        {
                            inlineData: {
                                mimeType: "audio/ogg",
                                data: audioBase64
                            }
                        }
                    ]);
                } else {
                    result = await model.generateContent(prompt);
                }

                const text = result.response.text();
                if (text) {
                    return text; // Success!
                }
            } catch (err) {
                const errMessage = err.message || '';
                const isTemporaryError = errMessage.includes('503') ||
                    errMessage.includes('high demand') ||
                    errMessage.includes('overload') ||
                    errMessage.includes('Unavailable') ||
                    errMessage.includes('fetch');

                if (attempt < maxRetries && isTemporaryError) {
                    const delay = delays[attempt];
                    console.log(`Gemini retry attempt ${attempt + 1} for ${modelName} after ${delay}ms... (Error: ${errMessage})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.log(`Request failed for model ${modelName} on attempt ${attempt + 1}. Error: ${errMessage}`);
                    break; // Fallback to next model or exit loop
                }
            }
        }
    }
    return null; // All retries and models failed
}

// ==========================================
// PROCESS TEXT → GEMINI
// ==========================================

async function processText(text) {
    const inventoryContext = await fetchInventoryContext();

    const prompt = `
Translate to English.

The message may contain ONE or MULTIPLE items/parts being requested by factory workers.
Cross-reference each request against the provided company's Master Inventory List below.

INVENTORY MATCHING RULES:
1. Match the requested part to the closest matching item in the Master Inventory.
2. If an inventory match is found (even with spelling variations, informal names, abbreviations, or Hindi/Punjabi terms):
   - Use the canonical "Part Name" from the inventory.
   - Populate "SKU" with the inventory's SKU.
   - Populate "Size", "Material", and "Vendor" with details from the matched inventory item if not explicitly overridden by the worker's message.
   - Populate "Available Stock", "Price", and "Category" from the matched inventory item.
   - If the requested quantity (Qty Required) exceeds the matched inventory item's stock (Stock), generate a detailed warning in the "stockWarning" field (e.g., "Requested 5, but only 2 available in stock").
3. If no match is found:
   - Perform standard extraction (leave SKU, Available Stock, Price, stockWarning empty).
   - If there is a similar item in the inventory that might be what they wanted, suggest it in the "suggestedMatch" field (e.g., "Did you mean back gauge pc (SKU: 137)?").

MASTER INVENTORY:
${inventoryContext}

For EACH item extract:
- Part Name (canonical matched name or parsed name)
- SKU (blank if not matched)
- Qty Required (plain number only, e.g., "1", "20")
- Size (use detail1/detail2 format from inventory if matched)
- Material
- Category (blank if not matched)
- For Machine
- Vendor
- Price (blank if not matched)
- Available Stock (blank if not matched)
- stockWarning (blank if no stock issue)
- suggestedMatch (blank if no suggestion)

Rules:
- If Vendor is mentioned once for multiple items, apply it to ALL items
- If "For Machine" is mentioned once for multiple items, apply it to ALL items
- If Size or Material is not mentioned, leave it empty
- Qty should be just the number (e.g. "1", "20", "12")

Return ONLY a raw JSON array with NO markdown, NO code fences, NO explanation.
Example format:
[
  {
    "Part Name": "",
    "SKU": "",
    "Qty Required": "",
    "Size": "",
    "Material": "",
    "Category": "",
    "For Machine": "",
    "Vendor": "",
    "Price": "",
    "Available Stock": "",
    "stockWarning": "",
    "suggestedMatch": ""
  }
]

Message:
${text}
`;

    const raw = await generateWithRetry(prompt, false, null);
    if (!raw) {
        console.error("Gemini failed completely after retries and fallback. Skipping text request safely.");
        return []; // Return empty array so it is skipped safely without crashing
    }

    console.log("RAW GEMINI RESPONSE (text):", raw);

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        console.log("PARSE FAILED. Raw:", raw);
        return [{
            "Part Name": raw,
            "SKU": "",
            "Qty Required": "",
            "Size": "",
            "Material": "",
            "Category": "",
            "For Machine": "",
            "Vendor": "",
            "Price": "",
            "Available Stock": "",
            "stockWarning": "",
            "suggestedMatch": ""
        }];
    }
}

// ==========================================
// PROCESS AUDIO → GEMINI
// ==========================================

async function processAudio(filename) {
    const inventoryContext = await fetchInventoryContext();
    const audioBase64 = fs.readFileSync(filename).toString('base64');

    const prompt = `
Translate to English.

The message may contain ONE or MULTIPLE items/parts being requested by factory workers.
Cross-reference each request against the provided company's Master Inventory List below.

INVENTORY MATCHING RULES:
1. Match the requested part to the closest matching item in the Master Inventory.
2. If an inventory match is found (even with spelling variations, informal names, abbreviations, or Hindi/Punjabi terms):
   - Use the canonical "Part Name" from the inventory.
   - Populate "SKU" with the inventory's SKU.
   - Populate "Size", "Material", and "Vendor" with details from the matched inventory item if not explicitly overridden by the worker's message.
   - Populate "Available Stock", "Price", and "Category" from the matched inventory item.
   - If the requested quantity (Qty Required) exceeds the matched inventory item's stock (Stock), generate a detailed warning in the "stockWarning" field (e.g., "Requested 5, but only 2 available in stock").
3. If no match is found:
   - Perform standard extraction (leave SKU, Available Stock, Price, stockWarning empty).
   - If there is a similar item in the inventory that might be what they wanted, suggest it in the "suggestedMatch" field (e.g., "Did you mean back gauge pc (SKU: 137)?").

MASTER INVENTORY:
${inventoryContext}

For EACH item extract:
- Part Name (canonical matched name or parsed name)
- SKU (blank if not matched)
- Qty Required (plain number only, e.g., "1", "20")
- Size (use detail1/detail2 format from inventory if matched)
- Material
- Category (blank if not matched)
- For Machine
- Vendor
- Price (blank if not matched)
- Available Stock (blank if not matched)
- stockWarning (blank if no stock issue)
- suggestedMatch (blank if no suggestion)

Rules:
- If Vendor is mentioned once for multiple items, apply it to ALL items
- If "For Machine" is mentioned once for multiple items, apply it to ALL items
- If Size or Material is not mentioned, leave it empty
- Qty should be just the number (e.g. "1", "20", "12")

Return ONLY a raw JSON array with NO markdown, NO code fences, NO explanation.
Example format:
[
  {
    "Part Name": "",
    "SKU": "",
    "Qty Required": "",
    "Size": "",
    "Material": "",
    "Category": "",
    "For Machine": "",
    "Vendor": "",
    "Price": "",
    "Available Stock": "",
    "stockWarning": "",
    "suggestedMatch": ""
  }
]
`;

    const raw = await generateWithRetry(prompt, true, audioBase64);
    if (!raw) {
        console.error("Gemini failed completely after retries and fallback. Skipping audio request safely.");
        return []; // Return empty array so it is skipped safely without crashing
    }

    console.log("RAW GEMINI RESPONSE (audio):", raw);

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        console.log("PARSE FAILED. Raw:", raw);
        return [{
            "Part Name": raw,
            "SKU": "",
            "Qty Required": "",
            "Size": "",
            "Material": "",
            "Category": "",
            "For Machine": "",
            "Vendor": "",
            "Price": "",
            "Available Stock": "",
            "stockWarning": "",
            "suggestedMatch": ""
        }];
    }
}

// ===================================
// UPDATE GOOGLE SHEET
// ===================================

async function updateSheet(data) {
    try {
        console.log("Writing to sheet:", JSON.stringify([
            data["Part Name"] || "",
            data["Qty Required"] || "",
            data["Size"] || "",
            data["Material"] || "",
            data["For Machine"] || "",
            data["Vendor"] || ""
        ]));

        const auth = new google.auth.GoogleAuth({
            keyFile: 'credentials.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const res = await sheets.spreadsheets.values.append({
            spreadsheetId: '14QSTB1DJeaY44Ec2WTA12znOW6L5AsLALhLLEedwVpI',
            range: 'Sheet1!A:F',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[
                    data["Part Name"] || "",
                    data["Qty Required"] || "",
                    data["Size"] || "",
                    data["Material"] || "",
                    data["For Machine"] || "",
                    data["Vendor"] || ""
                ]]
            }
        });

        console.log("Row written:", data["Part Name"]);
    } catch (err) {
        console.log("Sheet Error:");
        console.log(err);
    }
}

// ==========================================
// SEND TO DASHBOARD PENDING QUEUE
// ==========================================

async function sendToPendingQueue(data, senderName = 'WhatsApp User') {
    return new Promise((resolve) => {
        const mappedData = {
            partName: data["Part Name"] || "",
            qty: data["Qty Required"] || "",
            size: data["Size"] || "",
            material: data["Material"] || "",
            machine: data["For Machine"] || "",
            vendor: data["Vendor"] || "",
            requestedBy: senderName,
            sku: data["SKU"] || "",
            category: data["Category"] || "",
            price: data["Price"] || "",
            availableStock: data["Available Stock"] || "",
            stockWarning: data["stockWarning"] || "",
            suggestedMatch: data["suggestedMatch"] || ""
        };

        const payload = JSON.stringify(mappedData);

        const options = {
            hostname: 'localhost',
            port: 3001,
            path: '/api/pending',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = require('http').request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                console.log("Sent to dashboard pending queue successfully:", body);
                resolve();
            });
        });

        req.on('error', (err) => {
            console.error("Failed to send pending request to dashboard:", err.message);
            resolve();
        });

        req.write(payload);
        req.end();
    });
}



// ==========================================
// START CLIENT
// ==========================================

client.initialize();

// require('dotenv').config();


// const { Client, LocalAuth } = require('whatsapp-web.js');
// const qrcode = require('qrcode-terminal');
// const fs = require('fs');
// const { GoogleGenerativeAI } =
//     require("@google/generative-ai");


// const genAI =
//     new GoogleGenerativeAI(
//         process.env.GEMINI_API_KEY
//     );




// // ==========================================
// // CONFIG
// // ==========================================


// const TARGET_GROUP =
//     "120363427181556541@g.us"; // Example: 12036....@g.us




// // ==========================================
// // WHATSAPP CLIENT
// // ==========================================


// const client = new Client({
//     authStrategy: new LocalAuth()
// });


// client.on('qr', qr => {
//     console.log("Scan QR:");
//     qrcode.generate(qr, { small: true });
// });


// client.on('ready', () => {
//     console.log("WhatsApp Connected");
// });




// // ==========================================
// // LISTEN FOR MESSAGES
// // ONLY FROM TARGET GROUP
// // ==========================================


// client.on('message', async (msg) => {


//     try {


//         const chat =
//             await msg.getChat();


//         // Ignore everything except chosen group


//         if (
//             !chat.isGroup ||
//             chat.id._serialized !== TARGET_GROUP
//         ) {
//             return;
//         }


//         console.log("\n==================");
//         console.log("Factory Group:");
//         console.log(chat.name);
//         console.log("==================");




//         // ==========================
//         // TEXT MESSAGE
//         // ==========================


//         if (
//             msg.body &&
//             !msg.hasMedia &&
//             msg.body.trim() !== ""
//         ) {


//             console.log(
//                 "Text:",
//                 msg.body
//             );


//             const data =
//                 await processText(
//                     msg.body
//                 );


//             console.log(
//                 "\nExtracted:"
//             );


//             console.log(data);
//         }




//         // ==========================
//         // VOICE NOTE
//         // ==========================


//         if (msg.hasMedia) {


//             const media =
//                 await msg.downloadMedia();


//             if (
//                 media.mimetype &&
//                 media.mimetype.includes(
//                     'audio'
//                 )
//             ) {


//                 console.log(
//                     "Voice note received"
//                 );


//                 const filename =
//                     `voice_${Date.now()}.ogg`;


//                 fs.writeFileSync(
//                     filename,
//                     Buffer.from(
//                         media.data,
//                         'base64'
//                     )
//                 );


//                 console.log(
//                     "Saved:",
//                     filename
//                 );


//                 const data =
//                     await processAudio(
//                         filename
//                     );


//                 console.log(
//                     "\nExtracted:"
//                 );


//                 console.log(data);
//             }
//         }


//     }
//     catch (err) {


//         console.log(
//             "\nERROR:"
//         );


//         console.log(err);
//     }


// });






// // ==========================================
// // PROCESS TEXT → GEMINI
// // ==========================================


// async function processText(text) {


//     const model =
//         genAI.getGenerativeModel({
//             model:
//                 "gemini-2.5-flash"
//         });


//     const prompt = `


// Translate to English.


// Extract:


// Part Name
// Qty Required
// Size
// Material
// For Machine
// Vendor


// Return JSON ONLY.


// Message:
// ${text}


// `;


//     const result =
//         await model.generateContent(
//             prompt
//         );


//     try {


//         return JSON.parse(
//             result.response.text()
//         );


//     } catch {


//         return result.response.text();
//     }
// }






// // ==========================================
// // PROCESS AUDIO → GEMINI
// // ==========================================


// async function processAudio(filename) {


//     const model =
//         genAI.getGenerativeModel({
//             model:
//                 "gemini-2.5-flash"
//         });


//     const audioBase64 =
//         fs.readFileSync(
//             filename
//         ).toString(
//             'base64'
//         );




//     const result =
//         await model.generateContent([


//             `
// Translate to English.


// Extract:


// Part Name
// Qty Required
// Size
// Material
// For Machine
// Vendor


// Return JSON ONLY.
//             `,


//             {
//                 inlineData: {
//                     mimeType:
//                         "audio/ogg",


//                     data:
//                         audioBase64
//                 }
//             }


//         ]);




//     try {


//         return JSON.parse(
//             result.response.text()
//         );


//     } catch {


//         return result.response.text();
//     }


// }




// // ==========================================
// // START CLIENT
// // ==========================================


// client.initialize();
