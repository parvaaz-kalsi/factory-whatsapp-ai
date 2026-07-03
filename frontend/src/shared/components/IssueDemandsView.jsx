import React, { useState, useEffect } from 'react';
import { FiClipboard, FiCheckSquare, FiAlertCircle, FiDownload, FiPrinter } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function IssueDemandsView({ 
  inventoryItems, 
  globalUniqueMachines, 
  refreshing, 
  fetchData,
  setRefreshing 
}) {
  const [formData, setFormData] = useState({
    inventory_id: '',
    qty_issued: '',
    issued_to: '',
    machine: ''
  });
  const [partSearch, setPartSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [issuedItems, setIssuedItems] = useState([]);

  const fetchIssuedHistory = async () => {
    try {
      const res = await fetch('/api/issue');
      if (res.ok) {
        const data = await res.json();
        setIssuedItems(data);
      }
    } catch (err) {
      console.error('Failed to fetch issue history:', err);
    }
  };

  useEffect(() => {
    fetchIssuedHistory();
  }, []);

  const filteredIssuedItems = issuedItems.filter(item => {
    if (startDate && new Date(item.issued_at) < new Date(startDate)) return false;
    if (endDate && new Date(item.issued_at) > new Date(endDate + 'T23:59:59')) return false;
    return true;
  });

  const getExportData = () => {
    return filteredIssuedItems.map(item => ({
      'Date & Time': new Date(item.issued_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      'Part Name': item.part_name,
      'Qty Issued': item.qty_issued,
      'Issued To': item.issued_to,
      'Machine': item.machine
    }));
  };

  const exportToExcel = () => {
    const data = getExportData();
    if (data.length === 0) return alert('No data to export.');
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Issue History');
    XLSX.writeFile(workbook, 'Issue_History.xlsx');
  };

  const exportToPDF = () => {
    const data = getExportData();
    if (data.length === 0) return alert('No data to export.');
    const doc = new jsPDF();
    doc.text('Issue History', 14, 15);
    const tableColumn = Object.keys(data[0]);
    const tableRows = data.map(row => Object.values(row));
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 20, styles: { fontSize: 8 } });
    doc.save('Issue_History.pdf');
  };

  const printList = () => {
    const data = getExportData();
    if (data.length === 0) return alert('No data to print.');
    const doc = new jsPDF();
    doc.text('Issue History', 14, 15);
    const tableColumn = Object.keys(data[0]);
    const tableRows = data.map(row => Object.values(row));
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 20, styles: { fontSize: 8 } });
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  const selectedItem = inventoryItems.find(i => i.id === parseInt(formData.inventory_id));
  const availableQty = selectedItem ? selectedItem.stockQuantity : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!formData.inventory_id || !formData.qty_issued || !formData.issued_to || !formData.machine) {
      setError('Please fill in all fields.');
      return;
    }

    const qty = parseInt(formData.qty_issued, 10);
    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    if (qty > availableQty) {
      setError(`Cannot issue more than available stock (${availableQty}).`);
      return;
    }

    try {
      setRefreshing(true);
      const res = await fetch('/api/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory_id: formData.inventory_id,
          part_name: selectedItem.partName,
          qty_issued: qty,
          issued_to: formData.issued_to,
          machine: formData.machine
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to issue part.');
      }

      setSuccess(`Successfully issued ${qty} of ${selectedItem.partName} to ${formData.issued_to}.`);
      setFormData({ inventory_id: '', qty_issued: '', issued_to: '', machine: '' });
      setPartSearch('');
      await fetchData(); // Refresh inventory and issued history
      await fetchIssuedHistory(); // Refresh local issue history table
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Issue Form */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FiClipboard color="var(--accent-blue-text)" /> Issue Part from Inventory
        </h2>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <FiAlertCircle /> {error}
          </div>
        )}
        {success && (
          <div style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <FiCheckSquare /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Select Part *</label>
            <input 
              type="text"
              list="issue-parts-list"
              className="filter-select" 
              style={{ width: '100%', padding: '0.6rem' }} 
              placeholder="Search or select a part..."
              value={partSearch} 
              onChange={e => {
                setPartSearch(e.target.value);
                const match = inventoryItems.find(item => 
                  `${item.partName} ${item.size ? `(${item.size})` : ''} - [Stock: ${item.stockQuantity}]` === e.target.value
                );
                if (match) {
                  setFormData({...formData, inventory_id: match.id.toString()});
                } else {
                  setFormData({...formData, inventory_id: ''});
                }
              }}
            />
            <datalist id="issue-parts-list">
              {inventoryItems.map(item => (
                <option key={item.id} value={`${item.partName} ${item.size ? `(${item.size})` : ''} - [Stock: ${item.stockQuantity}]`} />
              ))}
            </datalist>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Quantity Issued *</label>
            <input 
              type="number" 
              min="1" 
              max={availableQty || 1}
              className="filter-select" 
              style={{ width: '100%', padding: '0.6rem' }} 
              value={formData.qty_issued} 
              onChange={e => setFormData({...formData, qty_issued: e.target.value})}
              placeholder="e.g. 5"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Issued To (Worker Name) *</label>
            <input 
              type="text" 
              className="filter-select" 
              style={{ width: '100%', padding: '0.6rem' }} 
              value={formData.issued_to} 
              onChange={e => setFormData({...formData, issued_to: e.target.value})}
              placeholder="e.g. John Doe"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Machine *</label>
            <input 
              type="text" 
              list="issue-machines-list"
              className="filter-select" 
              style={{ width: '100%', padding: '0.6rem' }} 
              value={formData.machine} 
              onChange={e => setFormData({...formData, machine: e.target.value})}
              placeholder="Select or enter machine"
            />
            <datalist id="issue-machines-list">
              {globalUniqueMachines.map(mac => <option key={mac} value={mac} />)}
            </datalist>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button 
              type="submit" 
              disabled={refreshing} 
              className="modal-btn modal-btn-primary" 
              style={{ backgroundColor: 'var(--accent-blue-bg)', color: 'var(--accent-blue-text)', borderColor: '#bfdbfe', padding: '0.6rem 1.5rem', fontWeight: 600 }}
            >
              {refreshing ? 'Processing...' : 'Issue Part'}
            </button>
          </div>
        </form>
      </div>

      {/* History Table */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Issue History</h2>
          
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>From:</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="filter-select" style={{ padding: '0.4rem' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>To:</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="filter-select" style={{ padding: '0.4rem' }} />
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={exportToExcel} className="action-btn" style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600 }} title="Export to Excel">
                <FiDownload /> Excel
              </button>
              <button onClick={exportToPDF} className="action-btn" style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600 }} title="Export to PDF">
                <FiDownload /> PDF
              </button>
              <button onClick={printList} className="action-btn" style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600 }} title="Print">
                <FiPrinter /> Print
              </button>
            </div>
          </div>
        </div>
        
        <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-sans)', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-medium)' }}>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date & Time</th>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Part Name</th>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Qty Issued</th>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Issued To</th>
                <th style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Machine</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssuedItems && filteredIssuedItems.length > 0 ? (
                filteredIssuedItems.map((item, i) => (
                  <tr key={item.id || i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)' }}>
                      {new Date(item.issued_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.part_name}</td>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 600, color: '#16a34a' }}>{item.qty_issued}</td>
                    <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)' }}>{item.issued_to}</td>
                    <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)' }}>
                      <span style={{ padding: '0.2rem 0.5rem', backgroundColor: '#f1f5f9', borderRadius: '4px', fontSize: '0.8rem' }}>{item.machine}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No items have been issued yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
