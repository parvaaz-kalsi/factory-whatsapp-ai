const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const prompt = `
CRITICAL INSTRUCTION: First, determine if the message contains a clear, deliberate request for a factory machine part, tool, or material. 
If the message is empty, unintelligible, gibberish, or just random chatter, you MUST IMMEDIATELY return an empty JSON array: []

Only if there is a valid request, proceed with the following:
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
- "Back Gauge Pc" | SKU: 137 | Mat: MS | Size: 19 X 79 X 98 / No Detail | Stock: 0 Pcs. | Price: $0.00 | Vendor: SMT

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
- CRITICAL: If the message is empty, gibberish, or does NOT explicitly request a factory machine part, tool, or material, you MUST return an empty JSON array: []

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
send me 5 back gauge pc
`;

async function run() {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent(prompt);
    console.log(result.response.text());
}
run();
