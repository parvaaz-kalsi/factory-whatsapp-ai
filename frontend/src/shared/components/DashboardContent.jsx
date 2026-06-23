import React from 'react';
import ApproverMetrics from './ApproverMetrics';
import Filters from './Filters';
import DemandTable from './DemandTable';
import PendingCard from './PendingCard';
import RequestCard from './RequestCard';
import { standardizeUnit } from '../../utils/unitStandardizer';
import { FiRefreshCw, FiAlertTriangle, FiInfo, FiTrash2, FiClipboard, FiInbox, FiUser, FiDownload, FiPrinter } from 'react-icons/fi';
import MultiTagInput from './MultiTagInput';

export default function DashboardContent(props) { // Force HMR reload
  const { approvingId, forwardingId, receivingId, orderingId, loading, activeTab, kpiData, filteredRequests, viewMode, currentPendingIndex, setCurrentPendingIndex, handleApprove, handleReject, handleForward, rejectingId, setRejectingId, rejectReason, setRejectReason, currentUserRole, inventoryItems, selectedInventoryMachine, setSelectedInventoryMachine, uniqueInventoryMachines, inventoryLoading, handleReceive, handleToggleOrdered, editingRowId, setEditingRowId, editFormData, setEditFormData, handleSaveInlineEdit, inventoryEditingId, setInventoryEditingId, inventoryEditFormData, setInventoryEditFormData, handleSaveInventoryEdit, showInventoryEditModal, setShowInventoryEditModal, handlePartNameChange, handleSkuChange, searchQuery, setSearchQuery, selectedMachine, setSelectedMachine, selectedVendor, setSelectedVendor, selectedStatus, setSelectedStatus, uniqueMachines, uniqueVendors, whatsappStatus, whatsappGroups, setWhatsappGroups, fetchWhatsappStatus, fetchWhatsappGroups, showCustomDemandModal, setShowCustomDemandModal, customDemandData, setCustomDemandData, submitCustomDemand, globalModal, setGlobalModal, handleClearFilters, filteredInventory, hasNoActiveGroups, setActiveTab, pendingRequests, apiLimitCount, apiLimitMax, setCurrentUserRole, setViewMode, fetchData, refreshing, setRefreshing, globalUniquePartNames, globalUniqueMaterials, globalUniqueMachines, globalUniqueVendors, globalUniqueSKUs, globalUniqueRegNos, globalUniqueSizes, globalUniqueUnits, handleCustomDemandPartNameChange, handleCustomDemandSkuChange, handleCustomDemandRegNoChange, voiceNotes, exportStartDate, setExportStartDate, exportEndDate, setExportEndDate, exportToExcel, exportToPDF, printDemandList, customConfirm, availableGroups, handleToggleGroupActive } = props;

  return (
    <>
        {hasNoActiveGroups && activeTab !== 'whatsapp_settings' && currentUserRole !== 'reviewer' && currentUserRole !== 'receiver' && (
          <div 
            style={{
              backgroundColor: 'var(--accent-amber-bg)',
              border: '1px solid #fde047',
              color: 'var(--accent-amber-text)',
              padding: '1rem 1.25rem',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <svg style={{ width: '20px', height: '20px', flexShrink: 0, marginTop: '2px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div style={{ flexGrow: 1 }}>
              <strong style={{ display: 'block', marginBottom: '0.15rem' }}>No Active WhatsApp Groups Configured!</strong>
              The AI demand parser will ignore incoming messages until at least one target group is set to active.
              {currentUserRole === 'manager' && (
                <button 
                  onClick={() => setActiveTab('whatsapp_settings')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-blue-text)',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                    marginLeft: '0.5rem',
                    fontFamily: 'inherit',
                    fontSize: 'inherit'
                  }}
                >
                  Configure Settings
                </button>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Syncing active listings...</p>
          </div>
        ) : activeTab === 'inventory' ? (
          /* INVENTORY CATALOG VIEW */
          <div className="inventory-container" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Inventory Filters Row */}
            <div className="filter-dashboard" style={{ marginBottom: '1rem' }}>
              <div className="filter-group">
                <label className="filter-label">Filter by Machine / Group</label>
                <select
                  className="filter-select"
                  value={selectedInventoryMachine}
                  onChange={(e) => setSelectedInventoryMachine(e.target.value)}
                >
                  <option value="">All Machines / Groups</option>
                  {uniqueInventoryMachines.map((machine) => (
                    <option key={machine} value={machine}>
                      {machine}
                    </option>
                  ))}
                </select>
              </div>

              {(searchQuery || selectedInventoryMachine) && (
                <button
                  onClick={handleClearFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    marginLeft: 'auto'
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>

            {/* Inventory Items Layout Rendering */}
            {inventoryLoading ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading inventory items...</p>
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="empty-state">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <h3>No Inventory Items Found</h3>
                <p>No inventory matched your machine filter or search query.</p>
              </div>
            ) : viewMode === 'card' ? (
              /* INVENTORY CARD VIEW GRID */
              <div className="demands-grid" style={{ marginTop: '1rem' }}>
                {filteredInventory.map((item, index) => {
                  const isLowStock = item.stockQuantity === 0;
                  const category = (item.category || 'mechanical').toLowerCase();
                  
                  return (
                    <div 
                      key={item.id || index} 
                      className="demand-card" 
                      style={{ 
                        borderColor: 'var(--border-medium)',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      <div className={`demand-card-header cat-${category}`} style={{ position: 'relative' }}>
                        {/* Elegant Box Icon illustration for inventory items */}
                        <svg className="header-illustration-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span 
                          className="status-badge"
                          style={{
                            position: 'absolute',
                            top: '0.75rem',
                            right: '0.75rem',
                            backgroundColor: isLowStock ? '#fee2e2' : '#f0fdf4',
                            color: isLowStock ? '#991b1b' : '#16803d',
                            fontSize: '0.7rem',
                            fontWeight: 600
                          }}
                        >
                          {isLowStock ? 'Out of Stock' : `${item.stockQuantity} ${item.unit || 'Pcs.'}`}
                        </span>
                      </div>
                      
                      <div className="demand-card-body" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                            <h2 className="demand-part-name" style={{ marginBottom: '0.5rem' }}>
                              {item.partName || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unnamed Item</span>}
                            </h2>
                            
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8', backgroundColor: '#eff6ff', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                {item.sku || 'GEN-SKU'}
                              </span>
                              <span style={{ color: 'var(--text-muted)' }}>|</span>
                              <span>Reg No: <strong>{item.regNo || '—'}</strong></span>
                            </div>
                            
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                              {(item.machine || 'General').split(',').map(m => m.trim()).filter(Boolean).map((mac, idx) => (
                                <div key={idx} className="demand-machine" style={{ marginBottom: 0 }}>
                                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {mac}
                                </div>
                              ))}
                            </div>
                            
                            <div className="specs-list" style={{ marginBottom: '1.25rem' }}>
                              <div className="spec-item">
                                <span className="spec-label">Size Specification</span>
                                <span className="spec-val">{item.size || '—'}</span>
                              </div>
                              <div className="spec-item">
                                <span className="spec-label">Material Type</span>
                                <span className="spec-val">{item.material || '—'}</span>
                              </div>
                              <div className="spec-item">
                                <span className="spec-label">Category</span>
                                <span className="spec-val" style={{ textTransform: 'capitalize' }}>{item.category || '—'}</span>
                              </div>
                              <div className="spec-item">
                                <span className="spec-label">Rate (Catalog Price)</span>
                                <span className="spec-val">
                                  {item.rate && parseFloat(item.rate) > 0 ? `Rs.${parseFloat(item.rate).toFixed(2)}` : (item.price && parseFloat(item.price) > 0 ? `Rs.${parseFloat(item.price).toFixed(2)}` : '—')}
                                </span>
                              </div>
                            </div>
                            
                            <div className="demand-card-footer" style={{ marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div className="demand-vendor">
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                {item.vendor || '—'}
                              </div>
                              
                              <button
                                onClick={() => {
                                  setInventoryEditingId(item.id);
                                  setInventoryEditFormData({
                                    partName: item.partName || '',
                                    sku: item.sku || '',
                                    regNo: item.regNo || '',
                                    stockQuantity: item.stockQuantity || '',
                                    unit: item.unit || '',
                                    size: item.size || '',
                                    material: item.material || '',
                                    category: item.category || '',
                                    machine: item.machine || '',
                                    vendor: item.vendor || '',
                                    price: item.rate || item.price || ''
                                  });
                                  setShowInventoryEditModal(true);
                                }}
                                className="action-btn"
                                style={{ padding: '0.35rem 0.6rem', minWidth: 'auto', backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 600 }}
                                title="Edit"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                Edit
                              </button>
                            </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* INVENTORY LIST VIEW TABLE */
              <div className="table-responsive" style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
                overflowX: 'auto'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-sans)', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-medium)' }}>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>S.No.</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>P.No.</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Reg. No.</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Part Name</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Machine / Group</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Stock Qty</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Unit</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Size Specs</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Material</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Category</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Vendor</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Rate</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item, index) => {
                       const isLowStock = item.stockQuantity === 0;
                       const isEditingRow = inventoryEditingId === item.id;
                       
                       return (
                        <tr 
                          key={item.id || index} 
                          style={{ 
                            borderBottom: index === filteredInventory.length - 1 ? 'none' : '1px solid var(--border-light)',
                            transition: 'background-color var(--transition-fast)',
                            backgroundColor: isEditingRow ? '#f8fafc' : 'transparent'
                          }}
                          className="inventory-table-row"
                        >
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{index + 1}</td>
                          
                          <td style={{ padding: '1rem 1.25rem', color: '#1d4ed8', fontFamily: 'monospace', fontWeight: 600 }}>
                            {isEditingRow ? (
                              <input type="text" className="filter-select" style={{ width: '80px', padding: '0.35rem' }} value={inventoryEditFormData.sku} onChange={(e) => setInventoryEditFormData({...inventoryEditFormData, sku: e.target.value})} />
                            ) : item.sku}
                          </td>
                          
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {isEditingRow ? (
                              <input type="text" className="filter-select" style={{ width: '80px', padding: '0.35rem' }} value={inventoryEditFormData.regNo} onChange={(e) => setInventoryEditFormData({...inventoryEditFormData, regNo: e.target.value})} />
                            ) : item.regNo}
                          </td>
                          
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {isEditingRow ? (
                              <input type="text" className="filter-select" style={{ width: '120px', padding: '0.35rem' }} value={inventoryEditFormData.partName} onChange={(e) => setInventoryEditFormData({...inventoryEditFormData, partName: e.target.value})} />
                            ) : item.partName}
                          </td>
                          
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                            {isEditingRow ? (
                              <input type="text" list="inventory-machines-list" className="filter-select" style={{ width: '100px', padding: '0.35rem' }} value={inventoryEditFormData.machine} onChange={(e) => setInventoryEditFormData({...inventoryEditFormData, machine: e.target.value})} />
                            ) : (
                              <span style={{ 
                                display: 'inline-block',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                backgroundColor: '#f1f5f9',
                                color: 'var(--text-primary)'
                              }}>
                                {item.machine}
                              </span>
                            )}
                          </td>
                          
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 700, textAlign: 'right', color: isLowStock && !isEditingRow ? '#dc2626' : '#16a34a' }}>
                            {isEditingRow ? (
                              <input type="text" className="filter-select" style={{ width: '60px', padding: '0.35rem', textAlign: 'right' }} value={inventoryEditFormData.stockQuantity} onChange={(e) => setInventoryEditFormData({...inventoryEditFormData, stockQuantity: e.target.value.replace(/[^\d]/g, '')})} />
                            ) : (isLowStock ? 'Out of Stock' : item.stockQuantity)}
                          </td>
                          
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                            {isEditingRow ? (
                              <input type="text" list="inventory-units-list" className="filter-select" style={{ width: '60px', padding: '0.35rem' }} value={inventoryEditFormData.unit || ''} onChange={(e) => setInventoryEditFormData({...inventoryEditFormData, unit: e.target.value})} onBlur={(e) => {
                                import('../../utils/unitStandardizer').then(({ standardizeUnit }) => {
                                  setInventoryEditFormData({...inventoryEditFormData, unit: standardizeUnit(e.target.value)});
                                });
                              }} />
                            ) : item.unit}
                          </td>
                          
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {isEditingRow ? (
                              <input type="text" className="filter-select" style={{ width: '80px', padding: '0.35rem' }} value={inventoryEditFormData.size} onChange={(e) => setInventoryEditFormData({...inventoryEditFormData, size: e.target.value})} />
                            ) : item.size}
                          </td>
                          
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                            {isEditingRow ? (
                              <input type="text" list="inventory-materials-list" className="filter-select" style={{ width: '80px', padding: '0.35rem' }} value={inventoryEditFormData.material} onChange={(e) => setInventoryEditFormData({...inventoryEditFormData, material: e.target.value})} />
                            ) : item.material}
                          </td>
                          
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                            {isEditingRow ? (
                              <input type="text" list="inventory-categories-list" className="filter-select" style={{ width: '90px', padding: '0.35rem' }} value={inventoryEditFormData.category} onChange={(e) => setInventoryEditFormData({...inventoryEditFormData, category: e.target.value})} />
                            ) : item.category}
                          </td>
                          
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {isEditingRow ? (
                              <input type="text" list="inventory-vendors-list" className="filter-select" style={{ width: '100px', padding: '0.35rem' }} value={inventoryEditFormData.vendor} onChange={(e) => setInventoryEditFormData({...inventoryEditFormData, vendor: e.target.value})} />
                            ) : item.vendor}
                          </td>
                          
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {isEditingRow ? (
                              <input type="text" className="filter-select" style={{ width: '70px', padding: '0.35rem' }} value={inventoryEditFormData.price} onChange={(e) => setInventoryEditFormData({...inventoryEditFormData, price: e.target.value})} />
                            ) : (item.rate && parseFloat(item.rate) > 0 ? `Rs.${parseFloat(item.rate).toFixed(2)}` : (item.price && parseFloat(item.price) > 0 ? `Rs.${parseFloat(item.price).toFixed(2)}` : '—'))}
                          </td>
                          
                          <td style={{ padding: '1rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {isEditingRow ? (
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => handleSaveInventoryEdit(item.id)}
                                  disabled={refreshing}
                                  className="action-btn action-approve"
                                  style={{ padding: '0.4rem', minWidth: 'auto', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                  title="Save"
                                >
                                  {refreshing ? <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}></div> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                </button>
                                <button
                                  onClick={() => setInventoryEditingId(null)}
                                  className="action-btn action-reject"
                                  style={{ padding: '0.4rem', minWidth: 'auto', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                  title="Cancel"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setInventoryEditingId(item.id);
                                  setInventoryEditFormData({
                                    partName: item.partName || '',
                                    sku: item.sku || '',
                                    regNo: item.regNo || '',
                                    stockQuantity: item.stockQuantity || '',
                                    unit: item.unit || '',
                                    size: item.size || '',
                                    material: item.material || '',
                                    category: item.category || '',
                                    machine: item.machine || '',
                                    vendor: item.vendor || '',
                                    price: item.rate || item.price || ''
                                  });
                                }}
                                className="action-btn"
                                style={{ padding: '0.4rem', minWidth: 'auto', backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                                title="Edit"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === 'whatsapp_settings' ? (
          /* WHATSAPP INTEGRATION SETTINGS VIEW */
          (currentUserRole !== 'manager' && currentUserRole !== 'observer') ? (
            <div className="empty-state">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3>Access Denied</h3>
              <p>You do not have administrative privileges to access WhatsApp Settings.</p>
            </div>
          ) : (
            <div className="whatsapp-settings-container">
              <div className="whatsapp-settings-card">
                <div className="whatsapp-settings-header">
                  <div>
                    <h2>WhatsApp Integration Control Panel</h2>
                    <p>Monitor status, scan pairing QR codes, and manage active sessions entirely from the dashboard.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {/* Status Badge */}
                    <span 
                      className="whatsapp-status-badge"
                      style={{
                        backgroundColor: 
                          whatsappStatus.status === 'connected' ? 'var(--accent-green-bg)' :
                          whatsappStatus.status === 'authenticating' ? 'var(--accent-blue-bg)' :
                          whatsappStatus.status === 'qr' ? 'var(--accent-amber-bg)' : 'var(--accent-rose-bg)',
                        color:
                          whatsappStatus.status === 'connected' ? 'var(--accent-green-text)' :
                          whatsappStatus.status === 'authenticating' ? 'var(--accent-blue-text)' :
                          whatsappStatus.status === 'qr' ? 'var(--accent-amber-text)' : 'var(--accent-rose-text)'
                      }}
                    >
                      <span className={`status-dot status-dot-${whatsappStatus.status}`}></span>
                      {whatsappStatus.status === 'connected' ? 'Connected' :
                       whatsappStatus.status === 'authenticating' ? 'Authenticating...' :
                       whatsappStatus.status === 'qr' ? 'Awaiting Scan' : 'Disconnected'}
                    </span>

                    {/* Moved Action Buttons */}
                    {whatsappStatus.status === 'connected' && (
                      <button 
                        className="btn-whatsapp-action btn-whatsapp-action-danger"
                        style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                        onClick={async () => {
                          if (await customConfirm('Disconnect WhatsApp', 'Are you sure you want to disconnect WhatsApp? This will log out the active session.')) {
                            try {
                              setRefreshing(true);
                              const res = await fetch('/api/whatsapp/logout', { method: 'POST' });
                              if (res.ok) {
                                await fetchWhatsappStatus();
                              }
                            } catch (err) {
                              console.error('Logout error:', err);
                            } finally {
                              setRefreshing(false);
                              setGlobalModal(prev => ({ ...prev, isOpen: false }));
                            }
                          }
                        }}
                        disabled={refreshing}
                      >
                        <svg style={{ width: '16px', height: '16px', marginRight: '0.35rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Disconnect Session
                      </button>
                    )}

                    {(whatsappStatus.status === 'disconnected' || whatsappStatus.status === 'qr') && (
                      <button 
                        className="btn-whatsapp-action"
                        style={{ 
                          backgroundColor: '#2563eb', 
                          color: 'white', 
                          border: 'none',
                          padding: '0.6rem 1.25rem',
                          fontSize: '0.9rem',
                          boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1)'
                        }}
                        onClick={async () => {
                          try {
                            setRefreshing(true);
                            await fetch('/api/whatsapp/reconnect', { method: 'POST' });
                            await fetchWhatsappStatus();
                          } catch (err) {
                            console.error('Reconnect error:', err);
                          } finally {
                            setRefreshing(false);
                          }
                        }}
                        disabled={refreshing}
                      >
                        <FiRefreshCw 
                          size={16} 
                          style={{ 
                            marginRight: '0.35rem',
                            animation: refreshing ? 'spin 1s linear infinite' : 'none' 
                          }} 
                        />
                        {refreshing ? 'Relaunching...' : 'Relaunch Client'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="whatsapp-settings-body">
                  {/* Warning Alert Banner inside settings page if connected but no active groups */}
                  {hasNoActiveGroups && (
                    <div 
                      style={{
                        backgroundColor: 'var(--accent-amber-bg)',
                        border: '1px solid #fde047',
                        color: 'var(--accent-amber-text)',
                        padding: '1rem 1.25rem',
                        borderRadius: '12px',
                        marginBottom: '1rem',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <svg style={{ width: '20px', height: '20px', flexShrink: 0, marginTop: '2px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <strong style={{ display: 'block', marginBottom: '0.15rem' }}>No Active WhatsApp Groups Configured!</strong>
                        The AI demand parser will ignore incoming messages until at least one target group below is set to active.
                      </div>
                    </div>
                  )}

                  {/* Account detail grid if connected */}
                  {whatsappStatus.status === 'connected' && (
                    <div className="whatsapp-details-grid">
                      <div className="whatsapp-detail-item">
                        <span className="whatsapp-detail-label">Linked Number</span>
                        <span className="whatsapp-detail-value">+{whatsappStatus.phone || 'N/A'}</span>
                      </div>
                      <div className="whatsapp-detail-item">
                        <span className="whatsapp-detail-label">Display Name</span>
                        <span className="whatsapp-detail-value">{whatsappStatus.pushname || 'WhatsApp Client'}</span>
                      </div>
                      <div className="whatsapp-detail-item" style={{ gridColumn: 'span 2' }}>
                        <span className="whatsapp-detail-label">Last Connected Time</span>
                        <span className="whatsapp-detail-value">
                          {whatsappStatus.lastConnected 
                            ? new Date(whatsappStatus.lastConnected).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) 
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* QR code scanner section if awaiting scan */}
                  {whatsappStatus.status === 'qr' && whatsappStatus.qr && (
                    <div className="whatsapp-qr-section">
                      <div className="whatsapp-qr-frame">
                        <img 
                          src={whatsappStatus.qrDataUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(whatsappStatus.qr)}`} 
                          alt="WhatsApp pairing QR code"
                          className="whatsapp-qr-image"
                        />
                      </div>

                      <div className="whatsapp-instructions">
                        <h3>Scan to reconnect WhatsApp</h3>
                        <ol className="whatsapp-steps">
                          <li className="whatsapp-step-item">
                            <span className="whatsapp-step-num">1</span>
                            <span>Open <strong>WhatsApp</strong> on your mobile phone.</span>
                          </li>
                          <li className="whatsapp-step-item">
                            <span className="whatsapp-step-num">2</span>
                            <span>Tap <strong>Menu</strong> (three vertical dots on Android) or <strong>Settings</strong> (gear icon on iOS).</span>
                          </li>
                          <li className="whatsapp-step-item">
                            <span className="whatsapp-step-num">3</span>
                            <span>Select <strong>Linked Devices</strong>, and then tap <strong>Link a Device</strong>.</span>
                          </li>
                          <li className="whatsapp-step-item">
                            <span className="whatsapp-step-num">4</span>
                            <span>Point your phone camera to this screen to capture and scan the QR code.</span>
                          </li>
                        </ol>
                      </div>
                    </div>
                  )}

                  {/* Loading placeholder when initializing or authenticating (checking session) */}
                  {(whatsappStatus.status === 'disconnected' || whatsappStatus.status === 'authenticating') && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3.5rem 1rem', gap: '1.25rem' }}>
                      <div className="spinner"></div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {whatsappStatus.status === 'authenticating' ? 'Connecting & Syncing History...' : 'Initializing WhatsApp Client...'}
                        </p>
                        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                          {whatsappStatus.status === 'authenticating' ? 'Verifying linked session credentials and checking device connection...' : 'Starting backend browser instance in sandbox mode...'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Group Routing Rules Section */}
                  <div className="whatsapp-groups-section" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '2rem', marginTop: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                      Group Routing Rules
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                      Select which WhatsApp groups the AI Demand Parser should monitor. Messages from unselected groups will be ignored.
                    </p>

                    {availableGroups.length === 0 ? (
                      <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px dashed var(--border-medium)' }}>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                          {whatsappStatus.status === 'connected' 
                            ? 'No active group chats found on this WhatsApp account.' 
                            : 'Connect WhatsApp to fetch available groups.'}
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {availableGroups.map((group) => (
                          <div 
                            key={group.id} 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '1rem 1.25rem',
                              backgroundColor: '#f8fafc',
                              borderRadius: '12px',
                              border: '1px solid var(--border-light)',
                              transition: 'background-color var(--transition-fast)'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.925rem' }}>
                                {group.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                                ID: {group.id}
                              </div>
                            </div>
                            
                            <button
                              onClick={() => handleToggleGroupActive(group)}
                              className="btn-refresh"
                              style={{
                                padding: '0.45rem 1rem',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                backgroundColor: group.active ? 'var(--accent-green-bg)' : '#ffffff',
                                borderColor: group.active ? '#bbf7d0' : 'var(--border-medium)',
                                color: group.active ? 'var(--accent-green-text)' : 'var(--text-secondary)',
                                borderRadius: '9999px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                boxShadow: 'var(--shadow-sm)'
                              }}
                            >
                              {group.active ? (
                                <>
                                  <span style={{ width: '6px', height: '6px', backgroundColor: '#16a34a', borderRadius: '50%' }}></span>
                                  Active
                                </>
                              ) : 'Inactive'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>


                </div>
              </div>
            </div>
          )
        ) : (
          <>
            {/* KPI Summary Panels */}
            <ApproverMetrics
              newWorkerDemands={kpiData.newWorkerDemands}
              pendingApproval={kpiData.pendingApproval}
              approvedNotReceived={kpiData.approvedNotReceived}
            />

            {/* Quick Filters */}
            <Filters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedMachine={selectedMachine}
              setSelectedMachine={setSelectedMachine}
              selectedVendor={selectedVendor}
              setSelectedVendor={setSelectedVendor}
              selectedStatus={selectedStatus}
              setSelectedStatus={setSelectedStatus}
              activeTab={activeTab}
              uniqueMachines={uniqueMachines}
              uniqueVendors={uniqueVendors}
            />

            {/* Export Toolbar */}
            {activeTab === 'approved' && (
              <div className="export-toolbar no-print" style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Export Demand List</h3>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Start Date</label>
                    <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="filter-select" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>End Date</label>
                    <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="filter-select" />
                  </div>
                  </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <button onClick={exportToExcel} className="btn-refresh" style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem' }}>
                    <FiDownload style={{ marginRight: '0.35rem' }} /> Export Excel
                  </button>
                  <button onClick={exportToPDF} className="btn-refresh" style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem' }}>
                    <FiDownload style={{ marginRight: '0.35rem' }} /> Export PDF
                  </button>
                  <button onClick={printDemandList} className="btn-refresh" style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem' }}>
                    <FiPrinter style={{ marginRight: '0.35rem' }} /> Print Demand List
                  </button>
                </div>
              </div>
            )}

            {filteredRequests.length === 0 ? (
              <div className="empty-state">
                <FiInbox size={56} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.6 }} />
                <h3>No Demands Found</h3>
                <p>
                  {activeTab === 'pending' 
                    ? 'No requests are currently awaiting approval.' 
                    : 'The historical database from Google Sheets is empty or matches no filters.'}
                </p>
              </div>
            ) : viewMode === 'list' ? (
              /* LIST/TABLE VIEW FORMAT FOR PENDING & APPROVED REQUESTS */
              <div className="table-responsive" style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
                overflowX: 'auto',
                marginTop: '1rem'
              }}>
                
                <DemandTable
                  filteredRequests={filteredRequests}
                  editingRowId={editingRowId}
                  activeTab={activeTab}
                  currentUserRole={currentUserRole}
                  inventoryItems={inventoryItems}
                  editFormData={editFormData}
                  setEditFormData={setEditFormData}
                  handleSaveInlineEdit={handleSaveInlineEdit}
                  setEditingRowId={setEditingRowId}
                  handleReceive={handleReceive}
                  handleToggleOrdered={handleToggleOrdered}
                  handleReject={handleReject}
                  handleApprove={handleApprove}
                  handleForward={handleForward}
                  rejectingId={rejectingId}
                  setRejectingId={setRejectingId}
                  rejectReason={rejectReason}
                  setRejectReason={setRejectReason}
                  approvingId={approvingId}
                  forwardingId={forwardingId}
                  receivingId={receivingId}
                  orderingId={orderingId}
                />

              </div>
            ) : (activeTab === 'pending' || activeTab === 'receiving') ? (
              /* SLIDESHOW / CAROUSEL FORMAT FOR PENDING APPROVALS & RECEIVING QUEUE */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '2rem' }}>
                  {/* Left Chevron Button */}
                  <button 
                    className="btn-refresh" 
                    disabled={currentPendingIndex === 0} 
                    onClick={() => setCurrentPendingIndex(p => Math.max(0, p - 1))}
                    style={{ 
                      width: '46px', 
                      height: '46px', 
                      padding: 0, 
                      borderRadius: '50%', 
                      justifyContent: 'center', 
                      flexShrink: 0,
                      opacity: currentPendingIndex === 0 ? 0.3 : 1,
                      cursor: currentPendingIndex === 0 ? 'not-allowed' : 'pointer',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Focused Central Card */}
                  <div style={{ flexGrow: 1, maxWidth: '440px' }}>
                    {filteredRequests[currentPendingIndex] && (
                      <PendingCard
                        key={filteredRequests[currentPendingIndex].id}
                        item={filteredRequests[currentPendingIndex]}
                        voiceNotes={voiceNotes}
                        currentUserRole={currentUserRole}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onForward={handleForward}
                        activeTab={activeTab}
                        onReceive={handleReceive}
                        inventoryItems={inventoryItems}
                        rejectingId={rejectingId}
                        approvingId={approvingId}
                        forwardingId={forwardingId}
                        receivingId={receivingId}
                      />
                    )}
                  </div>

                  {/* Right Chevron Button */}
                  <button 
                    className="btn-refresh" 
                    disabled={currentPendingIndex === filteredRequests.length - 1} 
                    onClick={() => setCurrentPendingIndex(p => Math.min(filteredRequests.length - 1, p + 1))}
                    style={{ 
                      width: '46px', 
                      height: '46px', 
                      padding: 0, 
                      borderRadius: '50%', 
                      justifyContent: 'center', 
                      flexShrink: 0,
                      opacity: currentPendingIndex === filteredRequests.length - 1 ? 0.3 : 1,
                      cursor: currentPendingIndex === filteredRequests.length - 1 ? 'not-allowed' : 'pointer',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Progress Indicators */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Demand {currentPendingIndex + 1} of {filteredRequests.length}
                  </span>
                  
                  {/* Slider Progress Bar */}
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {filteredRequests.map((_, i) => (
                      <span 
                        key={i} 
                        onClick={() => setCurrentPendingIndex(i)}
                        style={{
                          display: 'inline-block',
                          width: i === currentPendingIndex ? '20px' : '6px',
                          height: '6px',
                          borderRadius: '9999px',
                          backgroundColor: i === currentPendingIndex ? 'var(--text-primary)' : 'var(--border-medium)',
                          transition: 'all var(--transition-fast)',
                          cursor: 'pointer'
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* STANDARD GRID FORMAT FOR APPROVED LOGS */
              <div className="demands-grid">
                {filteredRequests.map((item) => (
                  <RequestCard 
                    key={item.id} 
                    item={item} 
                    voiceNotes={voiceNotes} 
                    currentUserRole={currentUserRole}
                    handleToggleOrdered={handleToggleOrdered}
                  />
                ))}
              </div>
            )}
          </>
        )}

      {/* Custom Demand Modal */}

      {/* MODALS */}
      {showCustomDemandModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', transform: 'scale(1)', animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
              <FiClipboard color="var(--accent-blue-text)" size={22} /> Create Custom Demand
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Part Name *</label>
                <input type="text" list="custom-demand-parts" className="filter-select" style={{ width: '100%' }} value={customDemandData.partName} onChange={handleCustomDemandPartNameChange} placeholder="e.g. Hex Bolt" />
                <datalist id="custom-demand-parts">
                  {globalUniquePartNames.map(name => <option key={name} value={name} />)}
                </datalist>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>P No. (SKU)</label>
                  <input type="text" list="custom-demand-skus" className="filter-select" style={{ width: '100%' }} value={customDemandData.sku} onChange={handleCustomDemandSkuChange} placeholder="e.g. PN-123" />
                  <datalist id="custom-demand-skus">
                    {globalUniqueSKUs.map(sku => <option key={sku} value={sku} />)}
                  </datalist>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Reg No.</label>
                  <input type="text" list="custom-demand-regnos" className="filter-select" style={{ width: '100%' }} value={customDemandData.regNo} onChange={handleCustomDemandRegNoChange} placeholder="e.g. RN-456" />
                  <datalist id="custom-demand-regnos">
                    {globalUniqueRegNos.map(reg => <option key={reg} value={reg} />)}
                  </datalist>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Quantity *</label>
                  <input type="text" className="filter-select" style={{ width: '100%' }} value={customDemandData.qty} onChange={e => setCustomDemandData({...customDemandData, qty: e.target.value.replace(/[^\d.]/g, '')})} placeholder="e.g. 500" />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Unit</label>
                  <input type="text" list="custom-demand-units" className="filter-select" style={{ width: '100%' }} value={customDemandData.unit || ''} onChange={e => setCustomDemandData({...customDemandData, unit: e.target.value})} onBlur={e => setCustomDemandData({...customDemandData, unit: standardizeUnit(e.target.value)})} placeholder="e.g. pcs" />
                  <datalist id="custom-demand-units">
                     {globalUniqueUnits && globalUniqueUnits.map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>Rate (Est. Price)</label>
                  <input type="text" className="filter-select" style={{ width: '100%' }} value={customDemandData.price} onChange={e => setCustomDemandData({...customDemandData, price: e.target.value})} placeholder="e.g. Rs.5.00" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Size Specs</label>
                  <input type="text" list="custom-demand-sizes" className="filter-select" style={{ width: '100%' }} value={customDemandData.size} onChange={e => setCustomDemandData({...customDemandData, size: e.target.value})} placeholder="e.g. 10mm" />
                  <datalist id="custom-demand-sizes">
                    {globalUniqueSizes.map(size => <option key={size} value={size} />)}
                  </datalist>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Material</label>
                  <input type="text" list="custom-demand-materials" className="filter-select" style={{ width: '100%' }} value={customDemandData.material} onChange={e => setCustomDemandData({...customDemandData, material: e.target.value})} placeholder="e.g. Steel" />
                  <datalist id="custom-demand-materials">
                    {globalUniqueMaterials.map(mat => <option key={mat} value={mat} />)}
                  </datalist>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Machine (Searchable, Multiple)</label>
                  <MultiTagInput
                    name="machine"
                    list="custom-demand-machines"
                    placeholder="Enter or select machine"
                    value={customDemandData.machine}
                    onChange={e => setCustomDemandData({...customDemandData, machine: e.target.value})}
                    options={globalUniqueMachines}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Vendor</label>
                  <input type="text" list="custom-demand-vendors" className="filter-select" style={{ width: '100%' }} value={customDemandData.vendor} onChange={e => setCustomDemandData({...customDemandData, vendor: e.target.value})} placeholder="e.g. Acme Corp" />
                  <datalist id="custom-demand-vendors">
                    {globalUniqueVendors.map(ven => <option key={ven} value={ven} />)}
                  </datalist>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
              <button onClick={() => setShowCustomDemandModal(false)} className="modal-btn modal-btn-cancel">Cancel</button>
              <button onClick={() => submitCustomDemand(true)} className="modal-btn" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)' }}>
                Save as Draft
              </button>
              <button onClick={() => submitCustomDemand(false)} className="modal-btn modal-btn-primary" style={{ backgroundColor: 'var(--accent-blue-bg)', color: 'var(--accent-blue-text)', borderColor: '#bfdbfe' }}>
                Forward to Approver
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Inventory Edit Modal */}
      {showInventoryEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', transform: 'scale(1)', animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
              <FiClipboard color="var(--accent-blue-text)" size={22} /> Edit Inventory Item
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Part Name *</label>
                <input type="text" className="filter-select" style={{ width: '100%' }} value={inventoryEditFormData.partName} onChange={e => setInventoryEditFormData({...inventoryEditFormData, partName: e.target.value})} placeholder="e.g. Hex Bolt" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>P No. (SKU)</label>
                  <input type="text" className="filter-select" style={{ width: '100%' }} value={inventoryEditFormData.sku} onChange={e => setInventoryEditFormData({...inventoryEditFormData, sku: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Reg No.</label>
                  <input type="text" className="filter-select" style={{ width: '100%' }} value={inventoryEditFormData.regNo} onChange={e => setInventoryEditFormData({...inventoryEditFormData, regNo: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Stock Quantity *</label>
                  <input type="text" className="filter-select" style={{ width: '100%' }} value={inventoryEditFormData.stockQuantity} onChange={e => setInventoryEditFormData({...inventoryEditFormData, stockQuantity: e.target.value.replace(/[^\d]/g, '')})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Unit</label>
                  <input type="text" list="inventory-units-list" className="filter-select" style={{ width: '100%' }} value={inventoryEditFormData.unit || ''} onChange={(e) => setInventoryEditFormData({...inventoryEditFormData, unit: e.target.value})} onBlur={(e) => {
                    import('../../utils/unitStandardizer').then(({ standardizeUnit }) => {
                      setInventoryEditFormData({...inventoryEditFormData, unit: standardizeUnit(e.target.value)});
                    });
                  }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Size Specs</label>
                  <input type="text" className="filter-select" style={{ width: '100%' }} value={inventoryEditFormData.size} onChange={e => setInventoryEditFormData({...inventoryEditFormData, size: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Material</label>
                  <input type="text" list="inventory-materials-list" className="filter-select" style={{ width: '100%' }} value={inventoryEditFormData.material} onChange={e => setInventoryEditFormData({...inventoryEditFormData, material: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Category</label>
                  <input type="text" list="inventory-categories-list" className="filter-select" style={{ width: '100%' }} value={inventoryEditFormData.category} onChange={e => setInventoryEditFormData({...inventoryEditFormData, category: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Machine (Searchable, Multiple)</label>
                  <MultiTagInput
                    name="machine"
                    list="inventory-machines-list"
                    placeholder="Enter or select machine"
                    value={inventoryEditFormData.machine}
                    onChange={e => setInventoryEditFormData({...inventoryEditFormData, machine: e.target.value})}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Vendor</label>
                  <input type="text" list="inventory-vendors-list" className="filter-select" style={{ width: '100%' }} value={inventoryEditFormData.vendor} onChange={e => setInventoryEditFormData({...inventoryEditFormData, vendor: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Rate (Est. Price)</label>
                  <input type="text" className="filter-select" style={{ width: '100%' }} value={inventoryEditFormData.price} onChange={e => setInventoryEditFormData({...inventoryEditFormData, price: e.target.value})} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
              <button onClick={() => { setShowInventoryEditModal(false); setInventoryEditingId(null); }} disabled={refreshing} className="modal-btn modal-btn-cancel">Cancel</button>
              <button onClick={() => handleSaveInventoryEdit(inventoryEditingId)} disabled={refreshing} className="modal-btn modal-btn-primary" style={{ backgroundColor: 'var(--accent-green-bg)', color: 'var(--accent-green-text)', borderColor: '#bbf7d0' }}>
                {refreshing ? <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderColor: 'rgba(22, 163, 74, 0.3)', borderTopColor: '#16a34a', marginRight: '0.5rem', display: 'inline-block', verticalAlign: 'middle' }}></div> : null} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Custom Modal Pop-up */}
      {globalModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', width: '90%', maxWidth: '420px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', transform: 'scale(1)', animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {globalModal.type === 'confirm' ? <><FiAlertTriangle color="#ef4444" size={22} /> Confirm Action</> : <><FiInfo color="var(--accent-blue-text)" size={22} /> Notice</>}
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              {globalModal.title && <strong style={{color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem'}}>{globalModal.title}</strong>}
              {globalModal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              {globalModal.type === 'confirm' && (
                <button onClick={globalModal.onCancel} disabled={globalModal.isLoading} className="modal-btn modal-btn-cancel">Cancel</button>
              )}
              <button onClick={globalModal.onConfirm} disabled={globalModal.isLoading} className="modal-btn modal-btn-primary">
                {globalModal.isLoading ? <><FiRefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing</> : (globalModal.type === 'confirm' ? 'Proceed' : 'Okay')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Datalists for Dropdowns */}
      <datalist id="inventory-parts-list">
        {globalUniquePartNames.map(name => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="inventory-vendors-list">
        {globalUniqueVendors.map(ven => (
          <option key={ven} value={ven} />
        ))}
      </datalist>
      <datalist id="inventory-machines-list">
        {globalUniqueMachines.map(mac => (
          <option key={mac} value={mac} />
        ))}
      </datalist>
      <datalist id="inventory-materials-list">
        {globalUniqueMaterials.map(mat => (
          <option key={mat} value={mat} />
        ))}
      </datalist>
      <datalist id="inventory-units-list">
        {globalUniqueUnits.map(unit => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
      <datalist id="inventory-categories-list">
        {Array.from(new Set(inventoryItems.map(i => i.category).filter(Boolean))).sort().map(cat => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
    </>
  );
}
