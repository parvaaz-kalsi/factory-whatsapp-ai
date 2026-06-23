import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiRefreshCw, FiCheckCircle, FiXCircle, FiCornerUpRight, FiEdit2, FiSave, FiX, FiAlertCircle, FiDatabase, FiPlus, FiAlertTriangle, FiSearch, FiCopy, FiBox } from 'react-icons/fi';
import { standardizeUnit, displayQty, displayUnit } from '../../utils/unitStandardizer';
import MultiTagInput from './MultiTagInput';

// Helper to determine category based on part name
const getCategory = (partName = '') => {
  const name = partName.toLowerCase();
  if (name.includes('oil') || name.includes('diesel') || name.includes('fluid') || name.includes('coolant')) {
    return 'fluids';
  }
  if (name.includes('sensor') || name.includes('light') || name.includes('fan') || name.includes('electronic') || name.includes('cable') || name.includes('switch') || name.includes('turret')) {
    return 'electrical';
  }
  if (name.includes('tool') || name.includes('threading') || name.includes('parting') || name.includes('tape') || name.includes('measure') || name.includes('mallet')) {
    return 'tooling';
  }
  return 'mechanical';
};

const CardHeaderIllustration = ({ category }) => {
  if (category === 'fluids') {
    return (
      <svg className="header-illustration-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.105-6 11.25-6 11.25s-6-4.145-6-11.25a6 6 0 0112 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  if (category === 'electrical') {
    return (
      <svg className="header-illustration-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    );
  }
  if (category === 'tooling') {
    return (
      <svg className="header-illustration-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A1.5 1.5 0 0019.5 21l2-2a1.5 1.5 0 000-2.25l-5.83-5.83M11.42 15.17l2.42-2.42M11.42 15.17L5.67 9.42M13.84 12.75l2.42-2.42M13.84 12.75L8.09 7M6.75 10.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18 6.25a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
      </svg>
    );
  }
  return (
    <svg className="header-illustration-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.645-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
};

export default function PendingCard({ item, voiceNotes = [], currentUserRole, onApprove, onReject, onForward, activeTab, onReceive, inventoryItems = [], rejectingId, approvingId, forwardingId, receivingId }) {
  const category = getCategory(item.partName);
  
  // Custom voice player state
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    partName: item.partName || '',
    sku: item.sku || '',
    regNo: item.regNo || '',
    qty: displayQty(item.qty, item.unit),
    unit: displayUnit(item.qty, item.unit),
    size: item.size || '',
    material: item.material || '',
    machine: item.machine || '',
    vendor: item.vendor || '',
    category: item.category || '',
    price: String(item.price || item.rate || '').replace(/[\$Rs\s]/g, '')
  });

  // Add to Inventory Modal State
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [addInventoryLoading, setAddInventoryLoading] = useState(false);
  const [inventoryFormData, setInventoryFormData] = useState({
    partName: item.partName || '',
    sku: '',
    regNo: '',
    material: item.material || '',
    size: item.size || '',
    machine: item.machine || '',
    vendor: item.vendor || '',
    unit: 'Pcs.',
    price: item.price || item.rate || '',
    availableQty: '0',
    category: ''
  });

  const voiceNote = voiceNotes.find(note => {
    return voiceNotes[item.id.charCodeAt(0) % voiceNotes.length];
  });

  // Unique options extracted dynamically from master inventory catalog
  const uniquePartNames = Array.from(new Set([
    formData.partName,
    ...inventoryItems.map(i => i.partName)
  ].filter(Boolean))).sort();

  const uniqueSKUs = Array.from(new Set([
    formData.sku,
    ...inventoryItems.map(i => i.sku)
  ].filter(Boolean))).sort();

  const uniqueRegNos = Array.from(new Set([
    formData.regNo,
    ...inventoryItems.map(i => i.regNo)
  ].filter(Boolean))).sort();

  const uniqueCategories = Array.from(new Set([
    formData.category,
    ...inventoryItems.map(i => i.category)
  ].filter(Boolean))).sort();

  const qtyOptions = Array.from(new Set([
    formData.qty,
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12', '15', '20', '25', '30', '40', '50', '100'
  ].filter(Boolean))).sort((a, b) => {
    const na = parseInt(a.replace(/[^0-9]/g, '')) || 0;
    const nb = parseInt(b.replace(/[^0-9]/g, '')) || 0;
    return na - nb;
  });

  const uniqueSizes = Array.from(new Set([
    formData.size,
    ...inventoryItems.map(i => i.size)
  ].filter(Boolean))).sort();

  const uniqueMaterials = Array.from(new Set([
    formData.material,
    ...inventoryItems.map(i => i.material)
  ].filter(Boolean))).sort();

  const uniqueUnits = Array.from(new Set([
    formData.unit,
    ...inventoryItems.map(i => i.unit)
  ].filter(Boolean))).sort();


  const uniqueMachines = Array.from(new Set([
    formData.machine,
    ...inventoryItems.map(i => i.machine)
  ].filter(Boolean))).sort();

  const uniqueVendors = Array.from(new Set([
    formData.vendor,
    ...inventoryItems.map(i => i.vendor)
  ].filter(Boolean))).sort();

  // Temporary Console Logs to verify dropdown master data population
  console.log('[Console Log - PendingCard] Master inventory count:', inventoryItems.length);
  console.log('[Console Log - PendingCard] Rendered dropdown option lengths:', {
    partNames: uniquePartNames.length,
    skus: uniqueSKUs.length,
    regNos: uniqueRegNos.length,
    sizes: uniqueSizes.length,
    materials: uniqueMaterials.length,
    machines: uniqueMachines.length,
    vendors: uniqueVendors.length
  });
  console.log('[Console Log - PendingCard] Current selected values:', formData);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    console.log(`[Console Log - PendingCard] Field "${name}" changed to:`, value);
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePartNameChange = (e) => {
    const val = e.target.value;
    console.log('[Console Log - PendingCard] Selected Part Name:', val);
    const matched = inventoryItems.find(i => i.partName === val);
    if (matched) {
      setFormData(prev => ({
        ...prev,
        partName: val,
        sku: matched.sku || '',
        regNo: matched.regNo || '',
        category: matched.category !== '—' ? (matched.category || prev.category) : prev.category,
        size: matched.size !== '—' ? (matched.size || prev.size) : prev.size,
        material: matched.material !== '—' ? (matched.material || prev.material) : prev.material,
        machine: matched.machine !== 'General Compatibility' ? (matched.machine || prev.machine) : prev.machine,
        vendor: matched.vendor !== '—' ? (matched.vendor || prev.vendor) : prev.vendor,
        price: String(matched.price || prev.price).replace(/[\$Rs\.\s]/g, match => match === '.' ? '.' : '')
      }));
    } else {
      setFormData(prev => ({ ...prev, partName: val }));
    }
  };

  const handleSkuChange = (e) => {
    const val = e.target.value;
    console.log('[Console Log - PendingCard] Selected SKU (P No.):', val);
    setFormData(prev => ({ ...prev, sku: val }));
  };

  const handleRegNoChange = (e) => {
    const val = e.target.value;
    console.log('[Console Log - PendingCard] Selected Reg No.:', val);
    const matched = inventoryItems.find(i => i.regNo === val);
    if (matched) {
      setFormData(prev => ({
        ...prev,
        regNo: val,
        partName: matched.partName || prev.partName,
        sku: matched.sku || '',
        category: matched.category !== '—' ? (matched.category || prev.category) : prev.category,
        size: matched.size !== '—' ? (matched.size || prev.size) : prev.size,
        material: matched.material !== '—' ? (matched.material || prev.material) : prev.material,
        machine: matched.machine !== 'General Compatibility' ? (matched.machine || prev.machine) : prev.machine,
        vendor: matched.vendor !== '—' ? (matched.vendor || prev.vendor) : prev.vendor,
        price: String(matched.price || prev.price).replace(/[\$Rs\.\s]/g, match => match === '.' ? '.' : '')
      }));
    } else {
      setFormData(prev => ({ ...prev, regNo: val }));
    }
  };

  const handleSaveEdit = async () => {
    try {
      console.log('[Console Log - PendingCard] Saving edits payload:', formData);
      const response = await fetch(`/api/pending/${item.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        setIsEditing(false);
        if (activeTab === 'receiving' && onReceive) {
           onReceive(item.id);
        } else {
           window.location.reload();
        }
      } else {
        alert('Failed to save edits to database.');
      }
    } catch (err) {
      console.error('Error saving edits:', err);
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      partName: item.partName || '',
      sku: item.sku || '',
      regNo: item.regNo || '',
      qty: displayQty(item.qty, item.unit),
      unit: displayUnit(item.qty, item.unit),
      size: item.size || '',
      material: item.material || '',
      machine: item.machine || '',
      vendor: item.vendor || '',
      category: item.category || '',
      price: String(item.price || item.rate || '').replace(/[\$Rs\s]/g, '')
    });
    setIsEditing(false);
  };

  const handleInventoryFormChange = (e) => {
    const { name, value } = e.target;
    setInventoryFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddToInventory = async () => {
    if (!inventoryFormData.partName.trim()) {
      alert('Part Name is required.');
      return;
    }
    setAddInventoryLoading(true);
    try {
      const response = await fetch('/api/inventory/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inventoryFormData)
      });
      const data = await response.json();
      if (response.ok) {
        alert(`"${inventoryFormData.partName}" has been added to inventory successfully!`);
        setShowAddInventory(false);
        window.location.reload();
      } else {
        alert(data.error || 'Failed to add item to inventory.');
      }
    } catch (err) {
      console.error('Error adding to inventory:', err);
      alert('Network error. Please try again.');
    } finally {
      setAddInventoryLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const getCategoryClass = (cat) => {
    switch (cat) {
      case 'fluids': return 'cat-fluids';
      case 'electrical': return 'cat-electrical';
      case 'tooling': return 'cat-tooling';
      default: return 'cat-mechanical';
    }
  };

  return (
    <div className="demand-card" style={{ borderColor: 'var(--border-medium)' }}>
      <div className={`demand-card-header ${getCategoryClass(category)}`}>
        <CardHeaderIllustration category={category} />
        <span 
          className="status-badge"
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            backgroundColor: item.status === 'draft' ? '#f3f4f6' : (item.status === 'reviewed' ? '#eff6ff' : '#fef3c7'),
            color: item.status === 'draft' ? '#4b5563' : (item.status === 'reviewed' ? '#1e40af' : '#b45309'),
            fontSize: '0.7rem',
            fontWeight: 600
          }}
        >
          {item.status === 'draft' ? 'Draft' : (item.status === 'reviewed' ? 'Reviewed (Awaiting Manager)' : 'Awaiting Review')}
        </span>
      </div>

      <div className="demand-card-body">
        {isEditing ? (
          /* EDIT MODE: Minimalist Searchable Autocomplete Form with datalist assistance */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {item.suggestedMatch && item.suggestedMatch !== 'No Match' && (
              <div 
                onClick={() => handlePartNameChange({ target: { value: item.suggestedMatch } })}
                style={{
                  backgroundColor: '#f0fdf4',
                  borderColor: '#22c55e',
                  borderWidth: '1px',
                  borderStyle: 'dashed',
                  color: '#15803d',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: 'var(--shadow-sm)'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#dcfce7'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#f0fdf4'}
              >
                <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Click to apply AI Suggestion: <strong>{item.suggestedMatch}</strong></span>
              </div>
            )}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Part Name (Searchable)</label>
              <input
                type="text"
                name="partName"
                list="inventory-parts-card-list"
                placeholder="Enter or select part name"
                className="card-input"
                style={{ width: '100%', padding: '0.4rem 0.75rem', marginTop: '0.2rem' }}
                value={formData.partName}
                onChange={handlePartNameChange}
              />
              <datalist id="inventory-parts-card-list">
                {uniquePartNames.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>P No. (SKU)</label>
                <input
                  type="text"
                  name="sku"
                  placeholder="Enter P No."
                  className="card-input"
                  style={{ width: '100%', padding: '0.4rem 0.75rem', marginTop: '0.2rem', fontFamily: 'monospace' }}
                  value={formData.sku}
                  onChange={handleSkuChange}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Reg No.</label>
                <input
                  type="text"
                  name="regNo"
                  placeholder="Enter Reg No."
                  className="card-input"
                  style={{ width: '100%', padding: '0.4rem 0.75rem', marginTop: '0.2rem' }}
                  value={formData.regNo}
                  onChange={handleRegNoChange}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Quantity</label>
                <input
                  type="text"
                  name="qty"
                  placeholder="Enter Qty"
                  className="card-input"
                  style={{ width: '100%', padding: '0.4rem 0.75rem', marginTop: '0.2rem' }}
                  value={formData.qty}
                  onChange={(e) => setFormData({ ...formData, qty: e.target.value.replace(/[^\d.]/g, '') })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Unit</label>
                <input
                  type="text"
                  name="unit"
                  list={`unit-list-${item.id}`}
                  placeholder="e.g. pcs"
                  className="card-input"
                  style={{ width: '100%', padding: '0.4rem 0.75rem', marginTop: '0.2rem' }}
                  value={formData.unit || ''}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  onBlur={(e) => setFormData({ ...formData, unit: standardizeUnit(e.target.value) })}
                />
                <datalist id={`unit-list-${item.id}`}>
                  {uniqueUnits.map(u => <option key={u} value={u} />)}
                </datalist>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Size Specs</label>
                <input
                  type="text"
                  name="size"
                  placeholder="Enter Size specs"
                  className="card-input"
                  style={{ width: '100%', padding: '0.4rem 0.75rem', marginTop: '0.2rem' }}
                  value={formData.size}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Material (Searchable)</label>
                <input
                  type="text"
                  name="material"
                  list="inventory-materials-card-list"
                  placeholder="Enter or select material"
                  className="card-input"
                  style={{ width: '100%', padding: '0.4rem 0.75rem', marginTop: '0.2rem' }}
                  value={formData.material}
                  onChange={handleInputChange}
                />
                <datalist id="inventory-materials-card-list">
                  {uniqueMaterials.map(mat => (
                    <option key={mat} value={mat} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Category (Searchable)</label>
                <input
                  type="text"
                  name="category"
                  list="inventory-categories-card-list"
                  placeholder="Enter or select category"
                  className="card-input"
                  style={{ width: '100%', padding: '0.4rem 0.75rem', marginTop: '0.2rem', textTransform: 'capitalize' }}
                  value={formData.category}
                  onChange={handleInputChange}
                />
                <datalist id="inventory-categories-card-list">
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Machine (Searchable, Multiple)</label>
                <MultiTagInput
                  name="machine"
                  list="inventory-machines-card-list"
                  placeholder="Enter or select machine"
                  value={formData.machine}
                  onChange={handleInputChange}
                  options={uniqueMachines}
                  style={{ marginTop: '0.2rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Vendor (Searchable)</label>
                <input
                  type="text"
                  name="vendor"
                  list="inventory-vendors-card-list"
                  placeholder="Enter or select vendor"
                  className="card-input"
                  style={{ width: '100%', padding: '0.4rem 0.75rem', marginTop: '0.2rem' }}
                  value={formData.vendor}
                  onChange={handleInputChange}
                />
                <datalist id="inventory-vendors-card-list">
                  {uniqueVendors.map(ven => (
                    <option key={ven} value={ven} />
                  ))}
                </datalist>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Rate (Est. Price)</label>
                <input
                  type="text"
                  name="price"
                  placeholder="0.00"
                  className="card-input"
                  style={{ width: '100%', padding: '0.4rem 0.75rem', marginTop: '0.2rem' }}
                  value={formData.price}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button 
                className="btn-refresh" 
                disabled={receivingId === item.id}
                style={{ flexGrow: 1, padding: '0.4rem', fontSize: '0.8rem', justifyContent: 'center', opacity: receivingId === item.id ? 0.7 : 1 }} 
                onClick={handleSaveEdit}
              >
                {receivingId === item.id ? (
                  <><FiRefreshCw size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '0.35rem' }} /> Processing...</>
                ) : activeTab === 'receiving' ? 'Confirm & Mark as Received' : 'Save'}
              </button>
              <button 
                className="btn-refresh" 
                style={{ flexGrow: 1, padding: '0.4rem', fontSize: '0.8rem', justifyContent: 'center', borderColor: '#fecaca', color: '#dc2626' }} 
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* READ MODE */
          <>
            <h2 className="demand-part-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              {formData.partName || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Part Name Unspecified</span>}
              {currentUserRole !== 'observer' && (
                <button 
                  onClick={() => setIsEditing(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-blue-text)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '0.1rem 0.4rem'
                  }}
                >
                  Edit
                </button>
              )}
            </h2>
            
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <svg style={{ width: '13px', height: '13px', color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Requested by: <strong>{item.requestedBy || 'WhatsApp User'}</strong></span>
            </div>
            
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <svg style={{ width: '13px', height: '13px', color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Received At (IST): <strong>{item.receivedAt ? new Date(item.receivedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}</strong></span>
            </div>

            {item.editedAt && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <svg style={{ width: '13px', height: '13px', color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Last Edit by <strong>{item.editedBy || 'Admin'}</strong> At (IST): <strong>{new Date(item.editedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</strong></span>
              </div>
            )}
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {(formData.machine || 'Stock / General Care').split(',').map(m => m.trim()).filter(Boolean).map((mac, idx) => (
                <div key={idx} className="demand-machine" style={{ marginBottom: 0 }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {mac}
                </div>
              ))}
            </div>

            {item.stockWarning && (() => {
              let bg = '#fee2e2';
              let border = '#fca5a5';
              let color = '#991b1b';
              let label = 'Stock Warning';
              let icon = (
                <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              );
              let isNoMatch = false;

              if (item.stockWarning === 'Stock Available') {
                bg = '#f0fdf4';
                border = '#bbf7d0';
                color = '#16803d';
                label = 'Stock Status';
                icon = (
                  <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                );
              } else if (item.stockWarning === 'No Inventory Match') {
                bg = '#fffbeb';
                border = '#fde68a';
                color = '#b45309';
                label = 'Stock Warning';
                isNoMatch = true;
                icon = (
                  <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                  </svg>
                );
              }

              return (
                <div style={{
                  backgroundColor: bg,
                  borderColor: border,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: color,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginBottom: '0.75rem',
                  flexWrap: 'wrap'
                }}>
                  {icon}
                  <span style={{ flex: 1 }}><strong>{label}:</strong> {item.stockWarning}</span>
                  {isNoMatch && (
                    <button
                      onClick={() => setShowAddInventory(true)}
                      className="add-inventory-btn"
                    >
                      + Add to Inventory
                    </button>
                  )}
                </div>
              );
            })()}

            {item.suggestedMatch && item.suggestedMatch !== 'No Match' && (
              <div 
                onClick={() => {
                  handlePartNameChange({ target: { value: item.suggestedMatch } });
                  setIsEditing(true);
                }}
                style={{
                  backgroundColor: '#eff6ff',
                  borderColor: '#bfdbfe',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  color: '#1e40af',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginBottom: '0.75rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#dbeafe'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#eff6ff'}
              >
                <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span><strong>AI Suggestion:</strong> {item.suggestedMatch} <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>(Click to Apply)</span></span>
              </div>
            )}

            <div className="specs-list">
              <div className="spec-item">
                <span className="spec-label">P No. (SKU)</span>
                <span className="spec-val" style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8' }}>{formData.sku || '—'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Reg. No.</span>
                <span className="spec-val" style={{ fontWeight: 500 }}>{formData.regNo || '—'}</span>
              </div>
                            <div className="spec-item">
                <span className="spec-label">Category</span>
                <span className="spec-val" style={{ textTransform: 'capitalize' }}>{formData.category || '—'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Quantity</span>
                <span className="spec-val">{formData.qty || '—'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Unit</span>
                <span className="spec-val">{formData.unit || '—'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Size Specification</span>
                <span className="spec-val">{formData.size || '—'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Material Type</span>
                <span className="spec-val">{formData.material || '—'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Allocated Vendor</span>
                <span className="spec-val">{formData.vendor || '—'}</span>
              </div>
              <div className="spec-item">
                <span className="spec-label">Rate (Est. Price)</span>
                <span className="spec-val" style={{ fontWeight: 600, color: '#0f172a' }}>{formData.price ? `Rs.${formData.price}` : '—'}</span>
              </div>
              {item.availableStock && item.stockWarning !== 'No Inventory Match' ? (
                <div className="spec-item">
                  <span className="spec-label">Available Stock</span>
                  <span className="spec-val" style={{ fontWeight: 600, color: parseInt(item.availableStock) === 0 ? '#dc2626' : '#16a34a' }}>
                    {item.availableStock}
                  </span>
                </div>
              ) : item.stockWarning === 'No Inventory Match' ? (
                <div className="spec-item">
                  <span className="spec-label">Available Stock</span>
                  <span className="spec-val" style={{ fontWeight: 600, color: 'var(--text-muted)' }}>—</span>
                </div>
              ) : null}
            </div>

            {voiceNote && (
              <div className="voice-note-player-wrapper" style={{ marginBottom: '1.25rem' }}>
                <button className="voice-note-play-btn" onClick={handlePlayPause}>
                  {isPlaying ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="4" y="4" width="4" height="16" />
                      <rect x="16" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <span className="voice-note-label">Original Audio Notes</span>
                <span className="voice-note-time">ogg</span>
                <audio 
                  ref={audioRef} 
                  src={voiceNote.url}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  style={{ display: 'none' }}
                />
              </div>
            )}

            {/* Admin Verification Panel */}
            {currentUserRole !== 'observer' && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
                {activeTab === 'receiving' ? (
                  /* RECEIVING ACTIONS */
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="btn-refresh"
                    style={{
                      flexGrow: 1,
                      justifyContent: 'center',
                      backgroundColor: 'var(--accent-blue-bg)',
                      borderColor: '#bfdbfe',
                      color: 'var(--accent-blue-text)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      padding: '0.55rem',
                    }}
                  >
                    Review & Receive
                  </button>
                ) : currentUserRole === 'reviewer' ? (
                  /* REVIEWER ACTIONS */
                  <>
                    <button 
                      onClick={() => onForward(item.id, formData)}
                      disabled={forwardingId === item.id}
                      className="btn-refresh"
                      style={{
                        flexGrow: 1,
                        justifyContent: 'center',
                        backgroundColor: 'var(--accent-green-bg)',
                        borderColor: '#bbf7d0',
                        color: 'var(--accent-green-text)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        padding: '0.55rem',
                        opacity: forwardingId === item.id ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      {forwardingId === item.id ? (
                        <><FiRefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
                      ) : 'Forward for Approval'}
                    </button>
                    
                    <button 
                      onClick={() => onReject(item.id)}
                      disabled={rejectingId === item.id}
                      className="btn-refresh"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        flexGrow: 1,
                        justifyContent: 'center',
                        backgroundColor: 'var(--accent-rose-bg)',
                        borderColor: '#fecaca',
                        color: 'var(--accent-rose-text)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        padding: '0.55rem',
                        opacity: rejectingId === item.id ? 0.7 : 1
                      }}
                    >
                      {rejectingId === item.id ? (
                        <><FiRefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Rejecting...</>
                      ) : 'Reject'}
                    </button>
                  </>
                ) : (
                  /* MANAGER ACTIONS */
                  <>
                    <button 
                      onClick={() => onApprove(item.id, formData)}
                      disabled={approvingId === item.id}
                      className="btn-refresh"
                      style={{
                        flexGrow: 1,
                        justifyContent: 'center',
                        backgroundColor: 'var(--accent-green-bg)',
                        borderColor: '#bbf7d0',
                        color: 'var(--accent-green-text)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        padding: '0.55rem',
                        opacity: approvingId === item.id ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      {approvingId === item.id ? (
                        <><FiRefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
                      ) : 'Approve'}
                    </button>
                    
                    <button 
                      onClick={() => onReject(item.id)}
                      disabled={rejectingId === item.id}
                      className="btn-refresh"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        flexGrow: 1,
                        justifyContent: 'center',
                        backgroundColor: 'var(--accent-rose-bg)',
                        borderColor: '#fecaca',
                        color: 'var(--accent-rose-text)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        padding: '0.55rem',
                        opacity: rejectingId === item.id ? 0.7 : 1
                      }}
                    >
                      {rejectingId === item.id ? (
                        <><FiRefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Rejecting...</>
                      ) : 'Reject'}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add to Inventory Modal */}
      {showAddInventory && createPortal(
        <div className="inv-modal-overlay" onClick={() => setShowAddInventory(false)}>
          <div className="inv-modal" onClick={e => e.stopPropagation()}>
            <div className="inv-modal-header">
              <h3>
                <svg style={{ width: '22px', height: '22px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Add New Inventory Item
              </h3>
              <button className="inv-modal-close" onClick={() => setShowAddInventory(false)}>✕</button>
            </div>

            <p className="inv-modal-subtitle">
              This item was not found in the inventory database. Fill in the details below to add it.
            </p>

            <div className="inv-modal-form">
              <div className="inv-form-full">
                <label>Part Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" name="partName" value={inventoryFormData.partName} onChange={handleInventoryFormChange} placeholder="Enter part name" />
              </div>

              <div className="inv-form-row">
                <div className="inv-form-field">
                  <label>SKU / P No.</label>
                  <input type="text" name="sku" value={inventoryFormData.sku} onChange={handleInventoryFormChange} placeholder="Auto-generated if blank" />
                </div>
                <div className="inv-form-field">
                  <label>Reg No.</label>
                  <input type="text" name="regNo" value={inventoryFormData.regNo} onChange={handleInventoryFormChange} placeholder="Registration number" />
                </div>
              </div>

              <div className="inv-form-row">
                <div className="inv-form-field">
                  <label>Material</label>
                  <input type="text" name="material" list="inv-modal-materials" value={inventoryFormData.material} onChange={handleInventoryFormChange} placeholder="e.g. Steel, Brass" />
                  <datalist id="inv-modal-materials">
                    {uniqueMaterials.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>
                <div className="inv-form-field">
                  <label>Size / Detail</label>
                  <input type="text" name="size" value={inventoryFormData.size} onChange={handleInventoryFormChange} placeholder="e.g. 10mm x 20mm" />
                </div>
              </div>

              <div className="inv-form-row">
                <div className="inv-form-field">
                  <label>Machine / Group</label>
                  <input type="text" name="machine" list="inv-modal-machines" value={inventoryFormData.machine} onChange={handleInventoryFormChange} placeholder="e.g. CNC Lathe" />
                  <datalist id="inv-modal-machines">
                    {uniqueMachines.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>
                <div className="inv-form-field">
                  <label>Vendor</label>
                  <input type="text" name="vendor" list="inv-modal-vendors" value={inventoryFormData.vendor} onChange={handleInventoryFormChange} placeholder="Vendor name" />
                  <datalist id="inv-modal-vendors">
                    {uniqueVendors.map(v => <option key={v} value={v} />)}
                  </datalist>
                </div>
              </div>

              <div className="inv-form-row">
                <div className="inv-form-field">
                  <label>Unit</label>
                  <select name="unit" value={inventoryFormData.unit} onChange={handleInventoryFormChange}>
                    <option value="Pcs.">Pcs.</option>
                    <option value="Kg">Kg</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Mtr">Mtr</option>
                    <option value="Set">Set</option>
                    <option value="Box">Box</option>
                    <option value="Pair">Pair</option>
                  </select>
                </div>
                <div className="inv-form-field">
                  <label>Category</label>
                  <input type="text" name="category" value={inventoryFormData.category} onChange={handleInventoryFormChange} placeholder="e.g. Mechanical, Electrical" />
                </div>
              </div>

              <div className="inv-form-row">
                <div className="inv-form-field">
                  <label>Price / Rate (₹)</label>
                  <input type="text" name="price" value={inventoryFormData.price} onChange={handleInventoryFormChange} placeholder="0.00" />
                </div>
                <div className="inv-form-field">
                  <label>Initial Stock Qty</label>
                  <input type="text" name="availableQty" value={inventoryFormData.availableQty} onChange={handleInventoryFormChange} placeholder="0" />
                </div>
              </div>
            </div>

            <div className="inv-modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => setShowAddInventory(false)} disabled={addInventoryLoading}>Cancel</button>
              <button className="modal-btn modal-btn-primary" onClick={handleAddToInventory} disabled={addInventoryLoading}>
                {addInventoryLoading ? (
                  <><FiRefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Adding...</>
                ) : (
                  'Add Item to Inventory'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

