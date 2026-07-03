import React from 'react';
import { FiClipboard, FiClock, FiCheckCircle, FiCheckSquare, FiArchive, FiSettings, FiLogOut } from 'react-icons/fi';

export default function Sidebar({
  currentUserRole,
  activeTab,
  setActiveTab,
  handleClearFilters,
  pendingRequests,
  apiLimitCount,
  apiLimitMax
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">AVARZ</div>
      
      <div className="sidebar-section-label">General</div>
      <nav className="sidebar-menu">
        {currentUserRole === 'observer' ? (
          <>
            <button 
              className={`sidebar-menu-item ${activeTab === 'pending_review' ? 'active' : ''}`}
              onClick={() => { setActiveTab('pending_review'); handleClearFilters(); }}
              style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
            >
              <FiClipboard className="sidebar-icon" />
              <span style={{ flexGrow: 1 }}>New Worker Demands</span>
              {pendingRequests.filter(r => !r.status || r.status === 'pending_review').length > 0 && (
                <span className="badge-danger">{pendingRequests.filter(r => !r.status || r.status === 'pending_review').length}</span>
              )}
            </button>

            <button 
              className={`sidebar-menu-item ${activeTab === 'reviewed' ? 'active' : ''}`}
              onClick={() => { setActiveTab('reviewed'); handleClearFilters(); }}
              style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
            >
              <FiClock className="sidebar-icon" />
              <span style={{ flexGrow: 1 }}>Pending Approval</span>
              {pendingRequests.filter(r => r.status === 'reviewed').length > 0 && (
                <span className="badge-warning">{pendingRequests.filter(r => r.status === 'reviewed').length}</span>
              )}
            </button>

            <button 
              className={`sidebar-menu-item ${activeTab === 'approved_queue' ? 'active' : ''}`}
              onClick={() => { setActiveTab('approved_queue'); handleClearFilters(); }}
              style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
            >
              <FiCheckCircle className="sidebar-icon" />
              <span style={{ flexGrow: 1 }}>Approved Queue</span>
              {pendingRequests.filter(r => r.status === 'approved').length > 0 && (
                <span className="badge-primary">{pendingRequests.filter(r => r.status === 'approved').length}</span>
              )}
            </button>

            <button 
              className={`sidebar-menu-item ${activeTab === 'approved' ? 'active' : ''}`}
              onClick={() => { setActiveTab('approved'); handleClearFilters(); }}
              style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
            >
              <FiCheckSquare className="sidebar-icon" />
              Approved History
            </button>
          </>
        ) : currentUserRole === 'receiver' ? (
          <>
            <button 
              className={`sidebar-menu-item ${activeTab === 'receiving' ? 'active' : ''}`}
              onClick={() => { setActiveTab('receiving'); handleClearFilters(); }}
              style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
            >
              <FiCheckCircle className="sidebar-icon" />
              <span style={{ flexGrow: 1 }}>Receiving Queue</span>
              {pendingRequests.filter(r => r.status === 'approved').length > 0 && (
                <span className="badge-primary">{pendingRequests.filter(r => r.status === 'approved').length}</span>
              )}
            </button>
            <button 
              className={`sidebar-menu-item ${activeTab === 'approved' ? 'active' : ''}`}
              onClick={() => { setActiveTab('approved'); handleClearFilters(); }}
              style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
            >
              <FiCheckSquare className="sidebar-icon" />
              Receipt History
            </button>
            <button 
              className={`sidebar-menu-item ${activeTab === 'issue_demands' ? 'active' : ''}`}
              onClick={() => { setActiveTab('issue_demands'); handleClearFilters(); }}
              style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
            >
              <FiClipboard className="sidebar-icon" />
              Issue Demands
            </button>
          </>
        ) : (
          <>
            <button 
              className={`sidebar-menu-item ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => { setActiveTab('pending'); handleClearFilters(); }}
              style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
            >
              <FiClock className="sidebar-icon" />
              <span style={{ flexGrow: 1 }}>Pending Demands</span>
              {pendingRequests.length > 0 && (
                <span className="badge-primary">{pendingRequests.length}</span>
              )}
            </button>
            <button 
              className={`sidebar-menu-item ${activeTab === 'approved' ? 'active' : ''}`}
              onClick={() => { setActiveTab('approved'); handleClearFilters(); }}
              style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
            >
              <FiCheckSquare className="sidebar-icon" />
              Approved Demands
            </button>
          </>
        )}
      </nav>

      <div className="sidebar-section-label" style={{ marginTop: '2rem' }}>Management</div>
      <nav className="sidebar-menu">
        <button 
          className={`sidebar-menu-item ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => { setActiveTab('inventory'); handleClearFilters(); }}
          style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
        >
          <FiArchive className="sidebar-icon" />
          Inventory Catalog
        </button>

        {currentUserRole !== 'reviewer' && currentUserRole !== 'receiver' && (
          <button 
            className={`sidebar-menu-item ${activeTab === 'whatsapp_settings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('whatsapp_settings'); handleClearFilters(); }}
            style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
          >
            <FiSettings className="sidebar-icon" />
            WhatsApp Settings
          </button>
        )}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', padding: '0 0.5rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <span>API Limit (Gemini)</span>
            <span style={{ color: apiLimitCount >= apiLimitMax ? '#ef4444' : apiLimitCount > (apiLimitMax * 0.7) ? '#f59e0b' : 'var(--text-secondary)' }}>
              {apiLimitCount} / {apiLimitMax}
            </span>
          </div>
          <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--border-medium)', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              backgroundColor: apiLimitCount >= apiLimitMax ? '#ef4444' : apiLimitCount > (apiLimitMax * 0.7) ? '#f59e0b' : '#94a3b8',
              width: `${Math.min((apiLimitCount / apiLimitMax) * 100, 100)}%`,
              transition: 'all var(--transition-fast)'
            }}></div>
          </div>
        </div>

        <button 
          onClick={() => {
            localStorage.removeItem('user');
            window.location.reload();
          }}
          className="sidebar-menu-item danger"
          style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
        >
          <FiLogOut className="sidebar-icon" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
