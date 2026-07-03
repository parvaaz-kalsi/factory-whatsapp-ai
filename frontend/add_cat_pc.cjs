const fs = require('fs');

let pc = fs.readFileSync('src/shared/components/PendingCard.jsx', 'utf8');

// 1. Add category to formData
if (!pc.includes("category: item.category || '',")) {
  pc = pc.replace(/price: String\(item\.price/g, `category: item.category || '',\n    price: String(item.price`);
}

// 2. Add uniqueCategories
if (!pc.includes('const uniqueCategories =')) {
  pc = pc.replace(/const uniqueRegNos = Array\.from\([\s\S]*?\]\.filter\(Boolean\)\)\)\.sort\(\);/, match => match + `\n\n  const uniqueCategories = Array.from(new Set([\n    formData.category,\n    ...inventoryItems.map(i => i.category)\n  ].filter(Boolean))).sort();`);
}

// 3. Add category to auto-fill
pc = pc.replace(/regNo: matched\.regNo \|\| '',/g, `regNo: matched.regNo || '',\n        category: matched.category !== '—' ? (matched.category || prev.category) : prev.category,`);

// 4. Add UI field
const newField = `
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Category (Searchable)</label>
                <input
                  type="text"
                  name="category"
                  list="inventory-categories-card-list"
                  placeholder="Enter or select category"
                  className="card-input"
                  style={{ width: '100%', padding: '0.4rem 0.75rem', marginTop: '0.2rem' }}
                  value={formData.category}
                  onChange={handleInputChange}
                />
                <datalist id="inventory-categories-card-list">
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>`;

if (!pc.includes('inventory-categories-card-list')) {
  pc = pc.replace(/<div style=\{\{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0\.5rem' \}\}>\s*<div>\s*<label[^>]*>Quantity<\/label>/, newField + `\n              <div>\n                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Quantity</label>`);
}

// 5. Add to specs list
const specItem = `              <div className="spec-item">
                <span className="spec-label">Category</span>
                <span className="spec-val" style={{ textTransform: 'capitalize' }}>{formData.category || '—'}</span>
              </div>`;
if (!pc.includes('spec-val" style={{ textTransform: \'capitalize\' }}>{formData.category')) {
  pc = pc.replace(/<div className="spec-item">\s*<span className="spec-label">Quantity<\/span>/, specItem + `\n              <div className="spec-item">\n                <span className="spec-label">Quantity</span>`);
}

// 6. Add to handleCancelEdit
if (!pc.includes("category: item.category || ''")) {
  pc = pc.replace(/price: String\(item\.price/g, `category: item.category || '',\n      price: String(item.price`);
}

fs.writeFileSync('src/shared/components/PendingCard.jsx', pc);
console.log('PendingCard.jsx updated');
