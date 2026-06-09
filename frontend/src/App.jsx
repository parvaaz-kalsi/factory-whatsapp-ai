import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { FiAlertTriangle, FiInfo, FiInbox, FiRefreshCw, FiUser, FiDownload, FiPrinter, FiClipboard, FiClock, FiCheckCircle, FiArchive, FiBox, FiMessageSquare, FiLogOut } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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

  const currentUserRole = currentUser 
    ? (currentUser.role === 'editor' 
        ? 'reviewer' 
        : currentUser.role === 'approver' 
          ? 'manager' 
          : 'observer') 
    : null;

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

  // WhatsApp Integration States
  const [whatsappGroups, setWhatsappGroups] = useState([]);
  
  // Gemini API Rate Limit States
  const [apiLimitCount, setApiLimitCount] = useState(0);
  const [apiLimitMax, setApiLimitMax] = useState(15);

  const [whatsappStatus, setWhatsappStatus] = useState({
    status: 'disconnected',
    qr: null,
    phone: null,
    pushname: null,
    lastConnected: null
  });

  const [availableGroups, setAvailableGroups] = useState([]);
  const [isSyncingGroups, setIsSyncingGroups] = useState(false);
  const [globalModal, setGlobalModal] = useState({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: null, onCancel: null });

  useEffect(() => {
    window.alert = (message) => {
      setGlobalModal({ isOpen: true, type: 'alert', title: 'Notice', message, onConfirm: () => setGlobalModal({ isOpen: false }) });
    };
  }, []);

  const customConfirm = (title, message) => {
    return new Promise((resolve) => {
      setGlobalModal({
        isOpen: true, type: 'confirm', title, message, isLoading: false,
        onConfirm: () => { 
          setGlobalModal(prev => ({ ...prev, isLoading: true }));
          resolve(true); 
        },
        onCancel: () => { 
          setGlobalModal({ isOpen: false }); 
          resolve(false); 
        }
      });
    });
  };

  const hasNoActiveGroups = whatsappStatus.status === 'connected' && 
    (!availableGroups || availableGroups.length === 0 || !availableGroups.some(g => g.active));

  const fetchWhatsappStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        setWhatsappStatus(data);
      }
    } catch (err) {
      console.error('Error fetching whatsapp status:', err);
    }
  };

  const fetchWhatsappGroups = async () => {
    try {
      const res = await fetch('/api/whatsapp/groups');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAvailableGroups(data);
        } else {
          setAvailableGroups(data.groups || []);
          setIsSyncingGroups(data.isSyncing || false);
        }
      }
    } catch (err) {
      console.error('Error fetching whatsapp groups:', err);
    }
  };

  const handleToggleGroupActive = async (group) => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/whatsapp/groups/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: group.id,
          active: !group.active,
          name: group.name
        })
      });
      if (response.ok) {
        await fetchWhatsappGroups();
      } else {
        alert('Failed to update group routing state.');
      }
    } catch (err) {
      console.error('Error toggling group routing state:', err);
      alert('Connection error occurred.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial fetch on mount or tab change
    if (activeTab === 'whatsapp_settings') {
      fetchWhatsappStatus();
      fetchWhatsappGroups();
    } else {
      fetchData();
    }
  }, [activeTab]);

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);
    const socket = io(backendUrl);

    socket.on('dashboard_update', () => {
      console.log('[Socket.IO] Dashboard update event received. Refreshing data...');
      fetchData();
    });

    socket.on('api_limit_update', (data) => {
      setApiLimitCount(data.count);
      setApiLimitMax(data.limit);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Fetch all lists from backend
  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [pendingRes, approvedRes, voiceRes, kpiRes, inventoryRes, whatsappStatusRes, whatsappGroupsRes] = await Promise.all([
        fetch('/api/pending'),
        fetch('/api/requests'),
        fetch('/api/voice-notes'),
        fetch('/api/approver-kpis'),
        fetch('/api/inventory'),
        fetch('/api/whatsapp/status'),
        fetch('/api/whatsapp/groups')
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
      if (whatsappStatusRes && whatsappStatusRes.ok) {
        const statusData = await whatsappStatusRes.json();
        setWhatsappStatus(statusData);
      }
      if (whatsappGroupsRes && whatsappGroupsRes.ok) {
        const groupsData = await whatsappGroupsRes.json();
        if (Array.isArray(groupsData)) {
          setAvailableGroups(groupsData);
        } else {
          setAvailableGroups(groupsData.groups || []);
          setIsSyncingGroups(groupsData.isSyncing || false);
        }
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

  // Handle active tab synchronization based on user role
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'manager') {
        setActiveTab('pending_review');
      } else {
        setActiveTab('pending');
      }
    }
  }, [currentUser]);

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
  const [rejectingId, setRejectingId] = useState(null);
  const handleReject = async (id) => {
    if (!(await customConfirm('Confirm Rejection', 'Are you sure you want to reject and delete this request?'))) {
      return;
    }
    try {
      setRejectingId(id);
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
      setRejectingId(null);
      setGlobalModal(prev => ({ ...prev, isOpen: false }));
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

  // -------------------------------------------------------------
  // Export Functionality
  // -------------------------------------------------------------
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const getFilteredExportData = () => {
    let data = approvedRequests;
    
    // Filter by date range
    if (exportStartDate) {
      const start = new Date(exportStartDate);
      start.setHours(0, 0, 0, 0);
      data = data.filter(r => new Date(r.approvedAt || r.demandTimestamp) >= start);
    }
    if (exportEndDate) {
      const end = new Date(exportEndDate);
      end.setHours(23, 59, 59, 999);
      data = data.filter(r => new Date(r.approvedAt || r.demandTimestamp) <= end);
    }
    
    // Default behavior: Export only items that are approved but not yet received
    data = data.filter(r => r.status === 'approved'); // 'received' requests will be filtered out
    
    return data.map(r => ({
      'Part Name': r.partName || '—',
      'Qty': r.qty || '—',
      'Size': r.size || '—',
      'Material': r.material || '—',
      'Machine': r.machine || '—',
      'Vendor': r.vendor || '—',
      'Rate': r.rate || r.price || '—',
      'Requested By': r.requestedBy || '—',
      'Approved By': r.approvedBy || '—',
      'Approval Date': r.approvedAt ? new Date(r.approvedAt).toLocaleDateString() : '—'
    }));
  };

  const exportToExcel = () => {
    const data = getFilteredExportData();
    if (data.length === 0) return alert('No data available to export.');
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Demand List');
    XLSX.writeFile(workbook, 'Demand_List.xlsx');
  };

  const exportToPDF = () => {
    const data = getFilteredExportData();
    if (data.length === 0) return alert('No data available to export.');
    const doc = new jsPDF();
    doc.text('Demand List', 14, 15);
    const tableColumn = Object.keys(data[0]);
    const tableRows = data.map(row => Object.values(row));
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 8 }
    });
    doc.save('Demand_List.pdf');
  };

  const printDemandList = () => {
    const data = getFilteredExportData();
    if (data.length === 0) return alert('No data available to print.');
    const doc = new jsPDF();
    doc.text('Demand List', 14, 15);
    const tableColumn = Object.keys(data[0]);
    const tableRows = data.map(row => Object.values(row));
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
      styles: { fontSize: 8 }
    });
    
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
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
  // Editor (reviewer) sees only pending_review; Approver (manager) sees only reviewed; Manager (observer) has specific tabs
  const activeDataList = (() => {
    if (currentUserRole === 'observer') {
      if (activeTab === 'pending_review') {
        return pendingRequests.filter(r => !r.status || r.status === 'pending_review');
      }
      if (activeTab === 'reviewed') {
        return pendingRequests.filter(r => r.status === 'reviewed');
      }
      if (activeTab === 'approved_queue') {
        return pendingRequests.filter(r => r.status === 'approved');
      }
      if (activeTab === 'approved') {
        return approvedRequests;
      }
      return [];
    }
    return activeTab === 'pending' 
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
  })();

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
          {currentUserRole === 'observer' ? (
            <>
              {/* Manager Tab: New Worker Demands */}
              <button 
                className={`sidebar-menu-item ${activeTab === 'pending_review' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('pending_review');
                  handleClearFilters();
                }}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
              >
                <FiClipboard className="sidebar-icon" />
                <span style={{ flexGrow: 1 }}>New Worker Demands</span>
                {pendingRequests.filter(r => !r.status || r.status === 'pending_review').length > 0 && (
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
                    {pendingRequests.filter(r => !r.status || r.status === 'pending_review').length}
                  </span>
                )}
              </button>

              {/* Manager Tab: Pending Approval */}
              <button 
                className={`sidebar-menu-item ${activeTab === 'reviewed' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('reviewed');
                  handleClearFilters();
                }}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
              >
                <FiClock className="sidebar-icon" />
                <span style={{ flexGrow: 1 }}>Pending Approval</span>
                {pendingRequests.filter(r => r.status === 'reviewed').length > 0 && (
                  <span 
                    style={{
                      backgroundColor: '#f59e0b',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: '700',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '9999px',
                      marginLeft: 'auto'
                    }}
                  >
                    {pendingRequests.filter(r => r.status === 'reviewed').length}
                  </span>
                )}
              </button>

              {/* Manager Tab: Approved Queue */}
              <button 
                className={`sidebar-menu-item ${activeTab === 'approved_queue' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('approved_queue');
                  handleClearFilters();
                }}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
              >
                <FiCheckCircle className="sidebar-icon" />
                <span style={{ flexGrow: 1 }}>Approved Queue</span>
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

              {/* Manager Tab: Approved History */}
              <button 
                className={`sidebar-menu-item ${activeTab === 'approved' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('approved');
                  handleClearFilters();
                }}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
              >
                <FiArchive className="sidebar-icon" />
                Approved History
              </button>

              {/* Manager Tab: Inventory Catalog */}
              <button 
                className={`sidebar-menu-item ${activeTab === 'inventory' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('inventory');
                  handleClearFilters();
                }}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
              >
                <FiBox className="sidebar-icon" />
                Inventory Catalog
              </button>

              {/* Manager Tab: WhatsApp Integration */}
              <button 
                className={`sidebar-menu-item ${activeTab === 'whatsapp_settings' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('whatsapp_settings');
                  handleClearFilters();
                }}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
              >
                <FaWhatsapp className="sidebar-icon" />
                WhatsApp Integration
              </button>
            </>
          ) : (
            <>
              {/* Pending Approvals Tab Button */}
              <button 
                className={`sidebar-menu-item ${activeTab === 'pending' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('pending');
                  handleClearFilters();
                }}
                style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
              >
                <FiClipboard className="sidebar-icon" />
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
                <FiInbox className="sidebar-icon" />
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
                <FiArchive className="sidebar-icon" />
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

              {/* WhatsApp Integration Tab Button */}
              {currentUserRole === 'manager' && (
                <button 
                  className={`sidebar-menu-item ${activeTab === 'whatsapp_settings' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('whatsapp_settings');
                    handleClearFilters();
                  }}
                  style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none' }}
                >
                  <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  WhatsApp Integration
                </button>
              )}
            </>
          )}
        </nav>



        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* API Rate Limit Progress Bar (Sidebar) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            padding: '0 0.5rem'
          }}>
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

      {/* Main Content Workspace */}
      <main className="main-workspace">
        {/* Top Header Section */}
        <header className="header-section">
          <div className="header-title-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', flex: 1 }}>
            <h1>
              {activeTab === 'pending_review' 
                ? 'New Worker Demands' 
                : activeTab === 'reviewed' 
                  ? 'Pending Approval' 
                  : activeTab === 'approved_queue'
                    ? 'Approved Queue'
                    : activeTab === 'pending' 
                      ? 'Pending Demands' 
                      : activeTab === 'approved' 
                        ? 'Approved Requests' 
                        : activeTab === 'receiving'
                          ? 'Receiving Queue'
                          : activeTab === 'whatsapp_settings'
                            ? 'WhatsApp Integration'
                            : 'Inventory Catalog'}
            </h1>

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
            
            {/* Layout Switcher (Card / List Toggle) */}
            {activeTab !== 'whatsapp_settings' && (
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
            {activeTab !== 'whatsapp_settings' && (
              <button 
                className={`btn-refresh ${refreshing || inventoryLoading ? 'spinning' : ''}`} 
                onClick={activeTab === 'inventory' ? fetchInventory : fetchData}
                disabled={refreshing || inventoryLoading}
              >
                <FiRefreshCw 
                  size={16} 
                  strokeWidth={2.5} 
                  style={{ animation: (refreshing || inventoryLoading) ? 'spin 1s linear infinite' : 'none' }} 
                />
                {activeTab === 'inventory' 
                  ? (inventoryLoading ? 'Loading...' : 'Refresh Inventory') 
                  : (refreshing ? 'Syncing...' : 'Sync Sheet')}
              </button>
            )}

            {/* User Profile Professional Badge */}
            {currentUser && (
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#ffffff',
                  color: 'var(--text-primary)',
                  padding: '0.3rem 0.3rem 0.3rem 0.85rem',
                  borderRadius: '9999px',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  border: '1px solid var(--border-medium)',
                  fontFamily: 'var(--font-sans)',
                  cursor: 'default'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-primary)', textTransform: 'capitalize', fontWeight: 600, fontSize: '0.75rem' }}>
                    {currentUser.role}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  background: '#1e293b',
                  color: '#ffffff',
                  borderRadius: '50%',
                }}>
                  <FiUser size={13} strokeWidth={2.5} />
                </div>
              </div>
            )}
          </div>
        </header>

        {hasNoActiveGroups && activeTab !== 'whatsapp_settings' && (
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
            {currentUserRole === 'manager' || currentUserRole === 'reviewer' ? (
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
                      {(activeTab === 'pending' || activeTab === 'receiving') && currentUserRole !== 'observer' && (
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
                          {(activeTab === 'pending' || activeTab === 'receiving') && currentUserRole !== 'observer' && (
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
                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'var(--accent-rose-bg)', borderColor: '#fecaca', color: 'var(--accent-rose-text)', opacity: rejectingId === item.id ? 0.7 : 1 }}
                                        onClick={() => handleReject(item.id)}
                                        disabled={rejectingId === item.id}
                                      >
                                        {rejectingId === item.id ? 'Rejecting...' : 'Reject'}
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
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'var(--accent-rose-bg)', borderColor: '#fecaca', color: 'var(--accent-rose-text)', opacity: rejectingId === item.id ? 0.7 : 1 }}
                                        onClick={() => handleReject(item.id)}
                                        disabled={rejectingId === item.id}
                                      >
                                        {rejectingId === item.id ? (
                                          <><FiRefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Rejecting</>
                                        ) : 'Reject'}
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
                        rejectingId={rejectingId}
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

      {/* Global Custom Modal Pop-up */}
      {globalModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', width: '90%', maxWidth: '420px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', transform: 'scale(1)', animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {globalModal.type === 'confirm' ? <><FiAlertTriangle color="#ef4444" size={22} /> Confirm Action</> : <><FiInfo color="var(--primary-color)" size={22} /> Notice</>}
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              {globalModal.title && <strong style={{color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem'}}>{globalModal.title}</strong>}
              {globalModal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              {globalModal.type === 'confirm' && (
                <button onClick={globalModal.onCancel} disabled={globalModal.isLoading} style={{ padding: '0.625rem 1.25rem', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: globalModal.isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', fontSize: '0.9rem', opacity: globalModal.isLoading ? 0.6 : 1 }} onMouseOver={e => { if(!globalModal.isLoading) e.target.style.backgroundColor = '#e2e8f0'; }} onMouseOut={e => { if(!globalModal.isLoading) e.target.style.backgroundColor = '#f1f5f9'; }}>Cancel</button>
              )}
              <button onClick={globalModal.onConfirm} disabled={globalModal.isLoading} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.625rem 1.25rem', backgroundColor: globalModal.type === 'confirm' ? '#ef4444' : 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: globalModal.isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', fontSize: '0.9rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', opacity: globalModal.isLoading ? 0.7 : 1 }} onMouseOver={e => { if(!globalModal.isLoading) e.target.style.filter = 'brightness(1.1)'; }} onMouseOut={e => { if(!globalModal.isLoading) e.target.style.filter = 'brightness(1)'; }}>
                {globalModal.isLoading ? <><FiRefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing</> : (globalModal.type === 'confirm' ? 'Proceed' : 'Okay')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function handleClearFilters() {
    setSearchQuery('');
    setSelectedMachine('');
    setSelectedVendor('');
    setSelectedInventoryMachine('');
  }
}
