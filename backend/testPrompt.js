const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testPrompt() {
    const text = "8.6 drill hss\nQty. 4";
    const prompt = `
CRITICAL INSTRUCTION: First, determine if the message contains a clear, deliberate request for a factory machine part, tool, or material. 
If the message is empty, unintelligible, gibberish, or just random chatter, you MUST IMMEDIATELY return an empty JSON array: []

Only if there is a valid request, proceed with the following:
Translate to English.

The message may contain ONE or MULTIPLE items/parts being requested by factory workers.
Cross-reference each request against the provided company's Master Inventory List below.

EXTRACTION RULES:
1. Extract "Part Name", "Size", "Material", "For Machine", and "Vendor" EXACTLY as requested in the raw text. Do NOT override or rewrite them with inventory details. For example, if they ask for "Level Gauge 3 inch from Parveen Hyd", Part Name = "Level Gauge", Size = "3 inch", Vendor = "Parveen Hyd".
2. After extracting the raw request, check if there is a matching item in the Master Inventory.
3. If an inventory match is found (even with spelling variations, informal names, abbreviations, or Hindi/Punjabi terms):
   - Put the canonical inventory name, SKU, and details into the "suggestedMatch" field. (e.g., "Matches inventory: Level Bolt (SKU: 83), Vendor: SMT").
   - Populate "SKU" with the matched SKU so the system can link it.
   - Populate "Available Stock", "Price", and "Category" from the matched inventory item.
   - If the requested quantity (Qty Required) exceeds the matched inventory item's stock (Stock), generate a detailed warning in the "stockWarning" field (e.g., "Requested 5, but only 2 available in stock").
4. If NO inventory match is found:
   - Leave SKU, Available Stock, Price, stockWarning empty.
   - If there is a similar item in the inventory that might be what they wanted, suggest it in the "suggestedMatch" field (e.g., "Did you mean back gauge pc (SKU: 137)?").

MASTER INVENTORY:
(pretend inventory is here)

For EACH item extract:
- Part Name (EXACTLY as requested, do not use inventory name)
- SKU (blank if not matched)
- Qty Required (plain number only, e.g., "1", "20")
- Size (EXACTLY as requested)
- Material (EXACTLY as requested)
- Category (blank if not matched)
- For Machine (EXACTLY as requested)
- Vendor (EXACTLY as requested)
- Price (blank if not matched)
- Available Stock (blank if not matched)
- stockWarning (blank if no stock issue)
- suggestedMatch (blank if no suggestion, otherwise describe the matched inventory item)

Rules:
- If Vendor is mentioned once for multiple items, apply it to ALL items
- If "For Machine" is mentioned once for multiple items, apply it to ALL items
- If Size or Material is not mentioned, leave it empty
- Qty should be just the number (e.g. "1", "20", "12")
- CRITICAL: If the message is empty, gibberish, or does NOT explicitly request a factory machine part, tool, or material, you MUST return an empty JSON array: []

Return ONLY a raw JSON array with NO markdown, NO code fences, NO explanation.
Message:
${text}
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const result = await model.generateContent(prompt);
    console.log("RESPONSE: ", result.response.text());
}

testPrompt();
