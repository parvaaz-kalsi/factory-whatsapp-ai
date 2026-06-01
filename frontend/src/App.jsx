import React, { useState, useEffect } from 'react';
import Metrics from './components/Metrics';
import ApproverMetrics from './components/ApproverMetrics';
import Filters from './components/Filters';
import RequestCard from './components/RequestCard';
import PendingCard from './components/PendingCard';

export default function App() {
  // Navigation / Tabs State
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'approved'

  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const currentUserRole = currentUser ? (currentUser.role === 'editor' ? 'reviewer' : 'manager') : null;

  // View switch and inline table editing states
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  const [editingRowId, setEditingRowId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    partName: '',
    sku: '',
    regNo: '',
    qty: '',
    size: '',
    material: '',
    machine: '',
    vendor: '',
    price: ''
  });

  // Data States
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [voiceNotes, setVoiceNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiData, setKpiData] = useState({
    newWorkerDemands: 0,
    pendingApproval: 0,
    approvedNotReceived: 0
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [currentPendingIndex, setCurrentPendingIndex] = useState(0);

  // Live Inventory Catalog States
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedInventoryMachine, setSelectedInventoryMachine] = useState('');
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [uniqueInventoryMachines, setUniqueInventoryMachines] = useState([]);

  // Fetch live inventory catalog from DB
  const fetchInventory = async () => {
    try {
      setInventoryLoading(true);
      const url = selectedInventoryMachine 
        ? `/api/inventory?machine=${encodeURIComponent(selectedInventoryMachine)}`
        : '/api/inventory';
        
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setInventoryItems(data);
        
        // Extract unique machine/group names if we retrieved the full inventory
        if (!selectedInventoryMachine) {
          const machines = Array.from(new Set(data.map(item => item.machine).filter(Boolean))).sort();
          setUniqueInventoryMachines(machines);
        }
      }
    } catch (err) {
      console.error('Failed to fetch inventory catalog:', err);
    } finally {
      setInventoryLoading(false);
    }
  };

  // Trigger inventory fetch when catalog tab is active or machine group changes
  useEffect(() => {
    if (activeTab === 'inventory') {
      fetchInventory();
    }
  }, [activeTab, selectedInventoryMachine]);

  // Fetch all lists from backend
  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [pendingRes, approvedRes, voiceRes, kpiRes, inventoryRes] = await Promise.all([
        fetch('/api/pending'),
        fetch('/api/requests'),
        fetch('/api/voice-notes'),
        fetch('/api/approver-kpis'),
        fetch('/api/inventory')
      ]);

      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingRequests(pendingData);
      }
      if (approvedRes.ok) {
        const approvedData = await approvedRes.json();
        setApprovedRequests(approvedData);
      }
      if (voiceRes.ok) {
        const voiceData = await voiceRes.json();
        setVoiceNotes(voiceData);
      }
      if (kpiRes.ok) {
        const kpiValues = await kpiRes.json();
        setKpiData({
          newWorkerDemands: kpiValues.new_worker_demands || 0,
          pendingApproval: kpiValues.pending_approval || 0,
          approvedNotReceived: kpiValues.approved_not_received || 0
        });
      }
      if (inventoryRes.ok) {
        const inventoryData = await inventoryRes.json();
        setInventoryItems(inventoryData);
        const machines = Array.from(new Set(inventoryData.map(item => item.machine).filter(Boolean))).sort();
        setUniqueInventoryMachines(machines);
        console.log('[Console Log] Master inventory catalog loaded successfully. Total records:', inventoryData.length);
      }
    } catch (err) {
      console.error('Failed to sync dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Bounds checker for pending slideshow index
  useEffect(() => {
    if (currentPendingIndex >= pendingRequests.length && pendingRequests.length > 0) {
      setCurrentPendingIndex(pendingRequests.length - 1);
    }
  }, [pendingRequests.length, currentPendingIndex]);

  // Handle Approve Action
  const handleApprove = async (id, approvedData) => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/pending/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvedData)
      });
      if (response.ok) {
        // Refresh local listings
        await fetchData();
      } else {
        alert('Failed to approve request.');
      }
    } catch (err) {
      console.error('Error approving request:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle Reject Action
  const [isRejecting, setIsRejecting] = useState(false);
  const handleReject = async (id) => {
    if (!window.confirm('Are you sure you want to reject and delete this request?')) {
      return;
    }
    try {
      setRefreshing(true);
      const response = await fetch(`/api/pending/${id}/reject`, {
        method: 'POST'
      });
      if (response.ok) {
        await fetchData();
      } else {
        alert('Failed to reject request.');
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle Forward Action (Reviewer)
  const handleForward = async (id, forwardData) => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/pending/${id}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forwardData)
      });
      if (response.ok) {
        await fetchData();
      } else {
        alert('Failed to forward request.');
      }
    } catch (err) {
      console.error('Error forwarding request:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle Receive Action
  const handleReceive = async (id) => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/pending/${id}/receive`, {
        method: 'POST'
      });
      if (response.ok) {
        await fetchData();
      } else {
        alert('Failed to mark request as received.');
      }
    } catch (err) {
      console.error('Error receiving request:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle Inline Save Edit in Table View
  const handleSaveInlineEdit = async (id) => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/pending/${id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      if (response.ok) {
        setEditingRowId(null);
        await fetchData();
      } else {
        alert('Failed to save edits to database.');
      }
    } catch (err) {
      console.error('Error saving edits:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Select current active data list depending on active tab AND user role
  // Editor (reviewer) sees only pending_review; Approver (manager) sees only reviewed
  const activeDataList = 
    activeTab === 'pending' 
      ? pendingRequests.filter(r => {
          if (currentUserRole === 'reviewer') {
            return !r.status || r.status === 'pending_review';
          }
          // Approver (manager) only sees requests forwarded by the Editor
          return r.status === 'reviewed';
        })
      : activeTab === 'receiving'
        ? pendingRequests.filter(r => r.status === 'approved')
        : approvedRequests;

  // Filter the active list client-side
  const filteredRequests = activeDataList.filter((item) => {
    const matchesSearch =
      (item.partName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.size || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.material || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.machine || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.vendor || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMachine =
      selectedMachine === '' || item.machine === selectedMachine;

    const matchesVendor =
      selectedVendor === '' || item.vendor === selectedVendor;

    return matchesSearch && matchesMachine && matchesVendor;
  });

  // Filter live inventory catalog client-side by search query
  const filteredInventory = inventoryItems.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.partName || '').toLowerCase().includes(query) ||
      (item.machine || '').toLowerCase().includes(query) ||
      (item.size || '').toLowerCase().includes(query) ||
      (item.material || '').toLowerCase().includes(query) ||
      (item.category || '').toLowerCase().includes(query) ||
      (item.sku || '').toLowerCase().includes(query) ||
      (item.vendor || '').toLowerCase().includes(query)
    );
  });

  // Calculate dynamic lists for filter dropdown selects
  const uniqueMachines = Array.from(
    new Set(activeDataList.map((r) => r.machine).filter(Boolean))
  ).sort();

  const uniqueVendors = Array.from(
    new Set(activeDataList.map((r) => r.vendor).filter(Boolean))
  ).sort();

  // Metric KPI Calculations
  const totalDemandsCount = activeDataList.length;
  const activeMachinesCount = new Set(
    activeDataList.map((r) => r.machine).filter(Boolean)
  ).size;
  const activeVendorsCount = new Set(
    activeDataList.map((r) => r.vendor).filter(Boolean)
  ).size;

  // Handle Login submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!usernameInput || !passwordInput) {
      setLoginError('Username and password are required.');
      return;
    }
    try {
      setLoginLoading(true);
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        localStorage.setItem('user', JSON.stringify(data.user));
        setCurrentUser(data.user);
      } else {
        setLoginError(data.error || 'Authentication failed.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('Failed to connect to authentication server.');
    } finally {
      setLoginLoading(false);
    }
  };

  // If not logged in, render the login screen matching dashboard styling
  if (!currentUser) {
    return (
      <div className="login-page-container">
        <form onSubmit={handleLoginSubmit} className="login-card">
          <div className="login-logo-wrapper">
            <h1 className="login-brand">AVARZ</h1>
            <p className="login-subtitle">Supply Chain Management System</p>
          </div>

          {loginError && (
            <div className="login-error-alert">
              <svg style={{ width: '16px', height: '16px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{loginError}</span>
            </div>
          )}

          <div className="login-field">
            <label className="login-label">Username</label>
            <input
              type="text"
              placeholder="Enter profile username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="login-input"
              disabled={loginLoading}
            />
          </div>

          <div className="login-field">
            <label className="login-label">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="login-input"
              disabled={loginLoading}
            />
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={loginLoading}
          >
            {loginLoading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    );
  }

  const globalUniquePartNames = Array.from(new Set(inventoryItems.map(i => i.partName).filter(Boolean))).sort();
  const globalUniqueMaterials = Array.from(new Set(inventoryItems.map(i => i.material).filter(Boolean))).sort();
  const globalUniqueMachines = Array.from(new Set(inventoryItems.map(i => i.machine).filter(Boolean))).sort();
  const globalUniqueVendors = Array.from(new Set(inventoryItems.map(i => i.vendor).filter(Boolean))).sort();

  return (
    <div className="app-container">
      {/* Left Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">AVARZ</div>
        
        <div className="sidebar-section-label">General</div>
        <nav className="sidebar-menu">
          {/* Pending Approvals Tab Button */}
          <button 
            className={`sidebar-menu-item ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('pending');
              handleClearFilters();
            }}
            style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
          >
            <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span style={{ flexGrow: 1 }}>Pending Demands</span>
            {pendingRequests.filter(r => currentUserRole === 'reviewer' ? (!r.status || r.status === 'pending_review') : r.status === 'reviewed').length > 0 && (
              <span 
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '9999px',
                  marginLeft: 'auto'
                }}
              >
                {pendingRequests.filter(r => currentUserRole === 'reviewer' ? (!r.status || r.status === 'pending_review') : r.status === 'reviewed').length}
              </span>
            )}
          </button>

          {/* Receiving Queue Tab Button */}
          <button 
            className={`sidebar-menu-item ${activeTab === 'receiving' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('receiving');
              handleClearFilters();
            }}
            style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
          >
            <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span style={{ flexGrow: 1 }}>Receiving Queue</span>
            {pendingRequests.filter(r => r.status === 'approved').length > 0 && (
              <span 
                style={{
                  backgroundColor: 'var(--accent-blue-text)',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '9999px',
                  marginLeft: 'auto'
                }}
              >
                {pendingRequests.filter(r => r.status === 'approved').length}
              </span>
            )}
          </button>

          {/* Approved History Tab Button */}
          <button 
            className={`sidebar-menu-item ${activeTab === 'approved' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('approved');
              handleClearFilters();
            }}
            style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
          >
            <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Approved History
          </button>

          {/* Inventory Catalog Tab Button */}
          <button 
            className={`sidebar-menu-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('inventory');
              handleClearFilters();
            }}
            style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
          >
            <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Inventory Catalog
          </button>
        </nav>

        {/* Audio Logs Sidebar Attachment */}
        <div className="sidebar-section-label" style={{ marginTop: '1.5rem' }}>Audio Notes Log</div>
        <div className="audio-library-wrapper">
          {voiceNotes.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '0.5rem' }}>No voice files logged</div>
          ) : (
            voiceNotes.slice(0, 4).map((note) => (
              <a key={note.filename} href={note.url} target="_blank" rel="noreferrer" className="audio-lib-item">
                <svg className="audio-lib-play-icon" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Voice {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </a>
            ))
          )}
        </div>

        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {currentUser && (
            <div style={{ padding: '0 0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Profile: <strong>{currentUser.displayName}</strong> 
              <br />
              Role: <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{currentUser.role}</span>
            </div>
          )}
          <button 
            onClick={() => {
              localStorage.removeItem('user');
              window.location.reload();
            }}
            className="sidebar-menu-item"
            style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '0.75rem 1rem' }}
          >
            <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="main-workspace">
        {/* Top Header Section */}
        <header className="header-section">
          <div className="header-title-wrapper">
            <h1>
              {activeTab === 'pending' 
                ? 'Pending Approvals' 
                : activeTab === 'approved' 
                  ? 'Approved Requests' 
                  : 'Inventory Catalog'}
            </h1>
          </div>
          
          <div className="header-controls">

            {/* Minimalist Search Bar */}
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
            
            {/* Layout Switcher (Card / List Toggle) */}
            {true && (
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

            {/* Refresh / Sync Button */}
            <button 
              className={`btn-refresh ${refreshing || inventoryLoading ? 'spinning' : ''}`} 
              onClick={activeTab === 'inventory' ? fetchInventory : fetchData}
              disabled={refreshing || inventoryLoading}
            >
              <svg 
                width="16" 
                height="16" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2.5}
                style={{ animation: (refreshing || inventoryLoading) ? 'spin 1s linear infinite' : 'none' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
              </svg>
              {activeTab === 'inventory' 
                ? (inventoryLoading ? 'Loading...' : 'Refresh Inventory') 
                : (refreshing ? 'Syncing...' : 'Sync Sheet')}
            </button>
          </div>
        </header>

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
                        
                        <div className="demand-machine" style={{ marginBottom: '0.75rem' }}>
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {item.machine || 'General'}
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
                            <span className="spec-val" style={{ fontWeight: 600, color: '#0f172a' }}>
                              {item.rate && parseFloat(item.rate) > 0 ? `$${parseFloat(item.rate).toFixed(2)}` : (item.price && parseFloat(item.price) > 0 ? `$${parseFloat(item.price).toFixed(2)}` : '—')}
                            </span>
                          </div>
                        </div>
                        
                        <div className="demand-card-footer" style={{ marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem' }}>
                          <div className="demand-vendor">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {item.vendor || '—'}
                          </div>
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item, index) => {
                       const isLowStock = item.stockQuantity === 0;
                       return (
                        <tr 
                          key={item.id || index} 
                          style={{ 
                            borderBottom: index === filteredInventory.length - 1 ? 'none' : '1px solid var(--border-light)',
                            transition: 'background-color var(--transition-fast)'
                          }}
                          className="inventory-table-row"
                        >
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{index + 1}</td>
                          <td style={{ padding: '1rem 1.25rem', color: '#1d4ed8', fontFamily: 'monospace', fontWeight: 600 }}>{item.sku}</td>
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{item.regNo}</td>
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.partName}</td>
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
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
                          </td>
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 700, textAlign: 'right', color: isLowStock ? '#dc2626' : '#16a34a' }}>
                            {isLowStock ? 'Out of Stock' : item.stockQuantity}
                          </td>
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>{item.unit}</td>
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontWeight: 500 }}>{item.size}</td>
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>{item.material}</td>
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>{item.category}</td>
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontWeight: 500 }}>{item.vendor}</td>
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {item.rate && parseFloat(item.rate) > 0 ? `$${parseFloat(item.rate).toFixed(2)}` : (item.price && parseFloat(item.price) > 0 ? `$${parseFloat(item.price).toFixed(2)}` : '—')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* KPI Summary Panels */}
            {currentUser && currentUser.role === 'approver' ? (
              <ApproverMetrics
                newWorkerDemands={kpiData.newWorkerDemands}
                pendingApproval={kpiData.pendingApproval}
                approvedNotReceived={kpiData.approvedNotReceived}
              />
            ) : (
              <Metrics
                totalDemands={totalDemandsCount}
                activeMachinesCount={activeMachinesCount}
                activeVendorsCount={activeVendorsCount}
              />
            )}

            {/* Quick Filters */}
            <Filters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedMachine={selectedMachine}
              setSelectedMachine={setSelectedMachine}
              selectedVendor={selectedVendor}
              setSelectedVendor={setSelectedVendor}
              uniqueMachines={uniqueMachines}
              uniqueVendors={uniqueVendors}
            />

            {filteredRequests.length === 0 ? (
              <div className="empty-state">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
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
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-sans)', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-medium)' }}>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>P No.</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Reg No.</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Part Name</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Qty</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Size Specs</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Material</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Machine</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Vendor</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Requested By</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Timestamp</th>
                      <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Rate</th>
                      {(activeTab === 'pending' || activeTab === 'receiving') && (
                        <th style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((item, index) => {
                      const isEditingRow = editingRowId === item.id;
                      const isApproved = activeTab === 'approved' || item.status === 'approved';
                      
                      // Options extracted dynamically from master inventory catalog for inline editing
                      const uniquePartNames = Array.from(new Set([
                        editFormData.partName,
                        ...inventoryItems.map(i => i.partName)
                      ].filter(Boolean))).sort();

                      const uniqueSKUs = Array.from(new Set([
                        editFormData.sku,
                        ...inventoryItems.map(i => i.sku)
                      ].filter(Boolean))).sort();

                      const uniqueRegNos = Array.from(new Set([
                        editFormData.regNo,
                        ...inventoryItems.map(i => i.regNo)
                      ].filter(Boolean))).sort();

                      const qtyOptions = Array.from(new Set([
                        editFormData.qty,
                        '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12', '15', '20', '25', '30', '40', '50', '100'
                      ].filter(Boolean))).sort((a, b) => {
                        const na = parseInt(a.replace(/[^0-9]/g, '')) || 0;
                        const nb = parseInt(b.replace(/[^0-9]/g, '')) || 0;
                        return na - nb;
                      });

                      const uniqueSizes = Array.from(new Set([
                        editFormData.size,
                        ...inventoryItems.map(i => i.size)
                      ].filter(Boolean))).sort();

                      const uniqueMaterials = Array.from(new Set([
                        editFormData.material,
                        ...inventoryItems.map(i => i.material)
                      ].filter(Boolean))).sort();

                      const uniqueMachines = Array.from(new Set([
                        editFormData.machine,
                        ...inventoryItems.map(i => i.machine)
                      ].filter(Boolean))).sort();

                      const uniqueVendors = Array.from(new Set([
                        editFormData.vendor,
                        ...inventoryItems.map(i => i.vendor)
                      ].filter(Boolean))).sort();

                      // Master data auto-fill handlers for inline editing
                      const handlePartNameChange = (e) => {
                        const val = e.target.value;
                        console.log('[Console Log - List View Edit] Selected Part Name:', val);
                        const matched = inventoryItems.find(i => i.partName === val);
                        if (matched) {
                          setEditFormData(prev => ({
                            ...prev,
                            partName: val,
                            sku: matched.sku || '',
                            regNo: matched.regNo || '',
                            size: matched.size !== '—' ? (matched.size || prev.size) : prev.size,
                            material: matched.material !== '—' ? (matched.material || prev.material) : prev.material,
                            machine: matched.machine !== 'General Compatibility' ? (matched.machine || prev.machine) : prev.machine,
                            vendor: matched.vendor !== '—' ? (matched.vendor || prev.vendor) : prev.vendor,
                            price: matched.price || prev.price
                          }));
                        } else {
                          setEditFormData(prev => ({ ...prev, partName: val }));
                        }
                      };

                      const handleSkuChange = (e) => {
                        const val = e.target.value;
                        console.log('[Console Log - List View Edit] Selected SKU (P No.):', val);
                        const matched = inventoryItems.find(i => i.sku === val);
                        if (matched) {
                          setEditFormData(prev => ({
                            ...prev,
                            sku: val,
                            partName: matched.partName || prev.partName,
                            regNo: matched.regNo || '',
                            size: matched.size !== '—' ? (matched.size || prev.size) : prev.size,
                            material: matched.material !== '—' ? (matched.material || prev.material) : prev.material,
                            machine: matched.machine !== 'General Compatibility' ? (matched.machine || prev.machine) : prev.machine,
                            vendor: matched.vendor !== '—' ? (matched.vendor || prev.vendor) : prev.vendor,
                            price: matched.price || prev.price
                          }));
                        } else {
                          setEditFormData(prev => ({ ...prev, sku: val }));
                        }
                      };

                      const handleRegNoChange = (e) => {
                        const val = e.target.value;
                        console.log('[Console Log - List View Edit] Selected Reg No.:', val);
                        const matched = inventoryItems.find(i => i.regNo === val);
                        if (matched) {
                          setEditFormData(prev => ({
                            ...prev,
                            regNo: val,
                            partName: matched.partName || prev.partName,
                            sku: matched.sku || '',
                            size: matched.size !== '—' ? (matched.size || prev.size) : prev.size,
                            material: matched.material !== '—' ? (matched.material || prev.material) : prev.material,
                            machine: matched.machine !== 'General Compatibility' ? (matched.machine || prev.machine) : prev.machine,
                            vendor: matched.vendor !== '—' ? (matched.vendor || prev.vendor) : prev.vendor,
                            price: matched.price || prev.price
                          }));
                        } else {
                          setEditFormData(prev => ({ ...prev, regNo: val }));
                        }
                      };

                      // Status badge style helper
                      let statusBg = '#fffbeb';
                      let statusColor = '#b45309';
                      let statusLabel = 'Awaiting Review';

                      if (isApproved) {
                        statusBg = '#f0fdf4';
                        statusColor = '#15803d';
                        statusLabel = 'Approved';
                      } else if (item.status === 'reviewed') {
                        statusBg = '#eff6ff';
                        statusColor = '#1e40af';
                        statusLabel = 'Reviewed';
                      } else if (item.status === 'rejected') {
                        statusBg = '#fff1f2';
                        statusColor = '#be123c';
                        statusLabel = 'Rejected';
                      }

                      return (
                        <tr 
                          key={item.id || index}
                          style={{ 
                            borderBottom: index === filteredRequests.length - 1 ? 'none' : '1px solid var(--border-light)',
                            transition: 'background-color var(--transition-fast)'
                          }}
                          className="inventory-table-row"
                        >
                          {/* Status Badge */}
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <span 
                              className="status-badge"
                              style={{
                                backgroundColor: statusBg,
                                color: statusColor,
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}
                            >
                              {statusLabel}
                            </span>
                          </td>

                          {/* P No. / SKU */}
                          <td style={{ padding: '1rem 1.25rem', fontFamily: 'monospace', fontWeight: 600, color: '#1d4ed8' }}>
                            {isEditingRow ? (
                              <input 
                                type="text"
                                value={editFormData.sku}
                                onChange={handleSkuChange}
                                placeholder="P No."
                                className="filter-select"
                                style={{ width: '130px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              />
                            ) : (
                              item.sku || '—'
                            )}
                          </td>

                          {/* Reg No. */}
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                            {isEditingRow ? (
                              <input 
                                type="text"
                                value={editFormData.regNo}
                                onChange={handleRegNoChange}
                                placeholder="Reg No."
                                className="filter-select"
                                style={{ width: '130px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              />
                            ) : (
                              item.regNo || '—'
                            )}
                          </td>

                          {/* Part Name */}
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {isEditingRow ? (
                              <input 
                                type="text"
                                list="inventory-parts-list"
                                value={editFormData.partName}
                                onChange={handlePartNameChange}
                                placeholder="Part Name"
                                className="filter-select"
                                style={{ width: '220px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              />
                            ) : (
                              item.partName || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unspecified</span>
                            )}
                          </td>

                          {/* Quantity */}
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {isEditingRow ? (
                              <input 
                                type="text"
                                value={editFormData.qty}
                                onChange={(e) => setEditFormData({ ...editFormData, qty: e.target.value })}
                                placeholder="Qty"
                                className="filter-select"
                                style={{ width: '80px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              />
                            ) : (
                              item.qty || '—'
                            )}
                          </td>

                          {/* Size Specs */}
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)' }}>
                            {isEditingRow ? (
                              <input 
                                type="text"
                                value={editFormData.size}
                                onChange={(e) => setEditFormData({ ...editFormData, size: e.target.value })}
                                placeholder="Size specs"
                                className="filter-select"
                                style={{ width: '130px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              />
                            ) : (
                              item.size || '—'
                            )}
                          </td>

                          {/* Material */}
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                            {isEditingRow ? (
                              <input 
                                type="text"
                                list="inventory-materials-list"
                                value={editFormData.material}
                                onChange={(e) => setEditFormData({ ...editFormData, material: e.target.value })}
                                placeholder="Material"
                                className="filter-select"
                                style={{ width: '130px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              />
                            ) : (
                              item.material || '—'
                            )}
                          </td>

                          {/* Machine */}
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)' }}>
                            {isEditingRow ? (
                              <input 
                                type="text"
                                list="inventory-machines-list"
                                value={editFormData.machine}
                                onChange={(e) => setEditFormData({ ...editFormData, machine: e.target.value })}
                                placeholder="Machine"
                                className="filter-select"
                                style={{ width: '160px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              />
                            ) : (
                              <span style={{ 
                                display: 'inline-block',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                backgroundColor: '#f1f5f9',
                                color: 'var(--text-primary)'
                              }}>
                                {item.machine || 'General'}
                              </span>
                            )}
                          </td>

                          {/* Vendor */}
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {isEditingRow ? (
                              <input 
                                type="text"
                                list="inventory-vendors-list"
                                value={editFormData.vendor}
                                onChange={(e) => setEditFormData({ ...editFormData, vendor: e.target.value })}
                                placeholder="Vendor"
                                className="filter-select"
                                style={{ width: '180px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              />
                            ) : (
                              item.vendor || '—'
                            )}
                          </td>

                          {/* Requested By */}
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            {item.requestedBy || 'WhatsApp User'}
                          </td>

                          {/* Timestamp */}
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
                            {item.receivedAt ? new Date(item.receivedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'}
                          </td>

                          {/* Rate */}
                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {isEditingRow ? (
                              <input 
                                type="text"
                                value={editFormData.price}
                                onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                                className="filter-select"
                                style={{ width: '80px', padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                              />
                            ) : (
                              item.price && parseFloat(item.price) > 0 ? `$${item.price}` : (item.rate ? `$${item.rate}` : '—')
                            )}
                          </td>

                          {/* Actions Column (For Pending Active Demands & Receiving Queue) */}
                          {(activeTab === 'pending' || activeTab === 'receiving') && (
                            <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                              {activeTab === 'receiving' ? (
                                <button 
                                  className="btn-refresh" 
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'var(--accent-green-bg)', borderColor: '#bbf7d0', color: 'var(--accent-green-text)', fontWeight: 600 }}
                                  onClick={() => handleReceive(item.id)}
                                >
                                  Mark as Received
                                </button>
                              ) : isEditingRow ? (
                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                  <button 
                                    className="btn-refresh" 
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'var(--accent-green-bg)', borderColor: '#bbf7d0', color: 'var(--accent-green-text)' }} 
                                    onClick={() => handleSaveInlineEdit(item.id)}
                                  >
                                    Save
                                  </button>
                                  <button 
                                    className="btn-refresh" 
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderColor: '#fecaca', color: '#dc2626' }} 
                                    onClick={() => setEditingRowId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                  {/* Edit Button */}
                                  <button 
                                    className="btn-refresh" 
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--accent-blue-text)' }} 
                                    onClick={() => {
                                      setEditingRowId(item.id);
                                      setEditFormData({
                                        partName: item.partName || '',
                                        qty: item.qty || '',
                                        size: item.size || '',
                                        material: item.material || '',
                                        machine: item.machine || '',
                                        vendor: item.vendor || '',
                                        price: item.price || item.rate || ''
                                      });
                                    }}
                                  >
                                    Edit
                                  </button>

                                  {currentUserRole === 'reviewer' ? (
                                    /* Reviewer Actions */
                                    <>
                                      <button 
                                        className="btn-refresh" 
                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'var(--accent-green-bg)', borderColor: '#bbf7d0', color: 'var(--accent-green-text)' }}
                                        onClick={() => handleForward(item.id, {
                                          partName: item.partName,
                                          qty: item.qty,
                                          size: item.size,
                                          material: item.material,
                                          machine: item.machine,
                                          vendor: item.vendor,
                                          price: item.price || item.rate
                                        })}
                                      >
                                        Forward
                                      </button>
                                      <button 
                                        className="btn-refresh" 
                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'var(--accent-rose-bg)', borderColor: '#fecaca', color: 'var(--accent-rose-text)' }}
                                        onClick={() => handleReject(item.id)}
                                      >
                                        Reject
                                      </button>
                                    </>
                                  ) : (
                                    /* Manager Actions */
                                    <>
                                      <button 
                                        className="btn-refresh" 
                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'var(--accent-green-bg)', borderColor: '#bbf7d0', color: 'var(--accent-green-text)' }}
                                        onClick={() => handleApprove(item.id, {
                                          partName: item.partName,
                                          qty: item.qty,
                                          size: item.size,
                                          material: item.material,
                                          machine: item.machine,
                                          vendor: item.vendor,
                                          price: item.price || item.rate
                                        })}
                                      >
                                        Approve
                                      </button>
                                      <button 
                                        className="btn-refresh" 
                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'var(--accent-rose-bg)', borderColor: '#fecaca', color: 'var(--accent-rose-text)' }}
                                        onClick={() => handleReject(item.id)}
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );

  function handleClearFilters() {
    setSearchQuery('');
    setSelectedMachine('');
    setSelectedVendor('');
    setSelectedInventoryMachine('');
  }
}
