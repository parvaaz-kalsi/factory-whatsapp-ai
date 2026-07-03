import React from 'react';
import { FiRefreshCw, FiLogOut } from 'react-icons/fi';

export default function Topbar({
  activeTab,
  searchQuery,
  setSearchQuery,
  currentUserRole,
  setCurrentUserRole,
  setActiveTab,
  viewMode,
  setViewMode,
  setShowCustomDemandModal,
  fetchData,
  refreshing
}) {
  const getTitle = () => {
    switch(activeTab) {
      case 'pending_review': return 'New Worker Demands';
      case 'reviewed': return 'Pending Approval';
      case 'approved_queue': return 'Approved Queue';
      case 'pending': return 'Pending Demands';
      case 'approved': return 'Approved Requests';
      case 'receiving': return 'Receiving Queue';
      case 'whatsapp_settings': return 'WhatsApp Integration';
      case 'inventory': return 'Inventory Catalog';
      default: return 'Dashboard';
    }
  };

  return (
    <header className="header-section">
      <div className="header-title-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', flex: 1 }}>
        <h1>{getTitle()}</h1>

        {/* Minimalist Search Bar */}
        {activeTab !== 'whatsapp_settings' && (
          <div className="search-input-wrapper">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={activeTab === 'inventory' ? 'Search part name, category, SKU...' : 'Search parts, size, machine...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>
      
      <div className="header-controls">
        {currentUserRole === 'reviewer' && activeTab === 'pending' && (
          <button 
            onClick={() => setShowCustomDemandModal(true)}
            className="btn-refresh"
            style={{ 
              backgroundColor: 'var(--accent-blue-bg)', 
              borderColor: '#bfdbfe', 
              color: 'var(--accent-blue-text)', 
              padding: '0.45rem 1rem', 
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 600
            }}
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ width: '14px', height: '14px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Custom Demand
          </button>
        )}

        {/* Layout Switcher (Card / List Toggle) */}
        {activeTab !== 'whatsapp_settings' && activeTab !== 'issue_demands' && (
          <div style={{ 
            display: 'flex', 
            backgroundColor: '#f1f5f9', 
            border: '1px solid var(--border-medium)', 
            borderRadius: '9999px', 
            padding: '3px', 
            gap: '2px',
            alignItems: 'center'
          }}>
            <button 
              onClick={() => setViewMode('card')} 
              style={{
                border: 'none',
                background: viewMode === 'card' ? '#ffffff' : 'none',
                color: viewMode === 'card' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.45rem 0.95rem',
                borderRadius: '9999px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: viewMode === 'card' ? 'var(--shadow-sm)' : 'none',
                transition: 'all var(--transition-fast)',
                fontFamily: 'var(--font-sans)'
              }}
            >
              <svg style={{ width: '13px', height: '13px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Card
            </button>
            <button 
              onClick={() => setViewMode('list')} 
              style={{
                border: 'none',
                background: viewMode === 'list' ? '#ffffff' : 'none',
                color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.45rem 0.95rem',
                borderRadius: '9999px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none',
                transition: 'all var(--transition-fast)',
                fontFamily: 'var(--font-sans)'
              }}
            >
              <svg style={{ width: '13px', height: '13px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              List
            </button>
          </div>
        )}

        <button 
          onClick={fetchData} 
          disabled={refreshing} 
          className="btn-refresh"
          title="Manual Refresh"
          style={{ padding: '0.45rem 1.25rem' }}
        >
          <FiRefreshCw 
            size={16} 
            style={{ 
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
              strokeWidth: '2.5'
            }} 
          />
          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sync Sheet</span>
        </button>

        <div className="user-profile-widget" style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid var(--border-medium)', borderRadius: '9999px', padding: '0.25rem 0.25rem 0.25rem 1rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginRight: '0.75rem' }}>
            {currentUserRole === 'manager' ? 'Approver' : currentUserRole === 'reviewer' ? 'Editor' : currentUserRole === 'receiver' ? 'Receiver' : 'Manager'}
          </span>
          <div className="avatar-circle" style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
            <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="14" width="14" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
        </div>
      </div>
    </header>
  );
}
