require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Client } = require('pg');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function fetchInventoryContext() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    
    try {
        await client.connect();
        const res = await client.query('SELECT part_name, sku, material, detail1, detail2, available_qty, unit, price, vendor FROM inventory ORDER BY part_name ASC');
        
        let context = "Master Inventory (Part Name | SKU | Material | Size Details | Stock Qty | Unit | Price | Preferred Vendor):\n";
        res.rows.forEach(row => {
            const size = [row.detail1, row.detail2].filter(Boolean).join(" / ");
            context += `- "${row.part_name}" | SKU: ${row.sku} | Mat: ${row.material || 'N/A'} | Size: ${size || 'N/A'} | Stock: ${row.available_qty} ${row.unit || 'Pcs.'} | Price: $${row.price || '0.00'} | Vendor: ${row.vendor || 'N/A'}\n`;
        });
        return context;
    } catch (err) {
        console.error("Error fetching inventory context:", err);
        return "No inventory database context available due to error.";
    } finally {
        await client.end();
    }
}

async function processText(text) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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
Example:
[
  {"Part Name":"","SKU":"","Qty Required":"","Size":"","Material":"","Category":"","For Machine":"","Vendor":"","Price":"","Available Stock":"","stockWarning":"","suggestedMatch":""}
]

Message:
${text}
`;

    const result = await model.generateContent(prompt);
    let raw = result.response.text();
    console.log("\nRAW GEMINI RESPONSE:\n", raw);
}

async function runTests() {
  console.log('--- STARTING AI MATCHING VERIFICATION ---');
  
  // Test Case 1: Exact Name Match but high quantity (Stock check)
  console.log('\n--- Test 1: Exact Name Match with high qty (BG Base Manual Left should have 32 in stock) ---');
  await processText("Need 40 pcs of BG Base Manual Left for machine SMT");
  
  // Test Case 2: Misspelled/Informal Match
  console.log('\n--- Test 2: Misspelled Match (Grese NORMAL should match Grease NORMAL) ---');
  await processText("Please issue 2 kgs of normal grese for unit 2");

  // Test Case 3: Completely Unknown Item (should suggest nothing or close item)
  console.log('\n--- Test 3: Unknown Item (Should not match, category mechanical) ---');
  await processText("Need 5 specialized custom titanium bolts");
}

runTests();