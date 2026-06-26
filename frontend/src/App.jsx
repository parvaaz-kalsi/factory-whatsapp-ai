import ManagerDashboard from './users/manager/ManagerDashboard';
import EditorDashboard from './users/editor/EditorDashboard';
import ApproverDashboard from './users/approver/ApproverDashboard';
import ReceiverDashboard from './users/receiver/ReceiverDashboard';
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { FiAlertTriangle, FiInfo, FiInbox, FiRefreshCw, FiUser, FiDownload, FiPrinter, FiClipboard, FiClock, FiCheckCircle, FiArchive, FiBox, FiMessageSquare, FiLogOut } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import ApproverMetrics from './shared/components/ApproverMetrics';
import Filters from './shared/components/Filters';
import RequestCard from './shared/components/RequestCard';
import PendingCard from './shared/components/PendingCard';
import DemandTable from './shared/components/DemandTable';

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
          : currentUser.role === 'receiver'
            ? 'receiver'
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
    category: '',
    machine: '',
    vendor: '',
    price: ''
  });

  const [inventoryEditingId, setInventoryEditingId] = useState(null);
  const [showInventoryEditModal, setShowInventoryEditModal] = useState(false);
  const [inventoryEditFormData, setInventoryEditFormData] = useState({
    partName: '',
    sku: '',
    regNo: '',
    stockQuantity: '',
    unit: '',
    size: '',
    material: '',
    category: '',
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
  
  // Custom Demand State
  const [showCustomDemandModal, setShowCustomDemandModal] = useState(false);
  const [customDemandData, setCustomDemandData] = useState({
    partName: '', sku: '', regNo: '', qty: '', unit: '', size: '', material: '', machine: '', vendor: '', price: ''
  });

  const [kpiData, setKpiData] = useState({
    newWorkerDemands: 0,
    pendingApproval: 0,
    approvedNotReceived: 0
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPendingIndex, setCurrentPendingIndex] = useState(0);
  const [rejectReason, setRejectReason] = useState('');

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
    const socket = io(backendUrl, { transports: ['websocket'] });

    // Debounce dashboard updates — if multiple events fire within 2s, only refresh once
    let debounceTimer = null;
    socket.on('dashboard_update', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('[Socket.IO] Dashboard update event received. Refreshing data...');
        fetchData();
      }, 2000);
    });

    socket.on('whatsapp_status_update', () => {
      fetchWhatsappStatus();
    });

    socket.on('api_limit_update', (data) => {
      setApiLimitCount(data.count);
      setApiLimitMax(data.limit);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      socket.disconnect();
    };
  }, []);

  // Fetch all lists from backend
  async function fetchData() {
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

  // Initial fetch is handled by the activeTab useEffect above — no separate mount fetch needed

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

  const [approvingId, setApprovingId] = useState(null);
  const handleApprove = async (id, approvedData) => {
    try {
      setApprovingId(id);
      setRefreshing(true);
      const response = await fetch(`/api/pending/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvedData)
      });
      if (response.ok) {
        // Refresh local listings

      } else {
        alert('Failed to approve request.');
      }
    } catch (err) {
      console.error('Error approving request:', err);
    } finally {
      setApprovingId(null);
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
  const [forwardingId, setForwardingId] = useState(null);
  const handleForward = async (id, forwardData) => {
    const qtyVal = parseFloat(String(forwardData.qty || '').replace(/[^0-9.]/g, ''));
    const priceVal = parseFloat(String(forwardData.price || '').replace(/[^0-9.]/g, ''));

    if (isNaN(qtyVal) || qtyVal <= 0 || isNaN(priceVal) || priceVal <= 0) {
      alert('Quantity and Rate (Est. Price) must be greater than zero. Please edit the demand and fill these fields before forwarding.');
      return;
    }
    
    try {
      setForwardingId(id);
      setRefreshing(true);
      const response = await fetch(`/api/pending/${id}/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forwardData)
      });
      if (response.ok) {

      } else {
        alert('Failed to forward request.');
      }
    } catch (err) {
      console.error('Error forwarding request:', err);
    } finally {
      setForwardingId(null);
      setRefreshing(false);
    }
  };

  // Handle Receive Action
  const [receivingId, setReceivingId] = useState(null);
  const handleReceive = async (id) => {
    try {
      setReceivingId(id);
      setRefreshing(true);
      const response = await fetch(`/api/pending/${id}/receive`, {
        method: 'POST'
      });
      if (response.ok) {

      } else {
        alert('Failed to mark request as received.');
      }
    } catch (err) {
      console.error('Error receiving request:', err);
    } finally {
      setReceivingId(null);
      setRefreshing(false);
    }
  };

  // Handle Toggle Ordered Action
  const [orderingId, setOrderingId] = useState(null);
  const handleToggleOrdered = async (id, currentOrderedStatus) => {
    try {
      setOrderingId(id);
      setRefreshing(true);
      const response = await fetch(`/api/pending/${id}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOrdered: !currentOrderedStatus })
      });
      if (response.ok) {

      } else {
        alert('Failed to update ordered status.');
      }
    } catch (err) {
      console.error('Error updating ordered status:', err);
    } finally {
      setOrderingId(null);
      setRefreshing(false);
    }
  };

  // -------------------------------------------------------------
  // Export Functionality
  // -------------------------------------------------------------
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');

  const getFilteredExportData = () => {
    // Export exactly what the user is currently looking at in the Approved Tab
    // This now respects Date range, Machine, Vendor, and Search queries!
    const data = filteredRequests;
    
    return data.map(r => ({
      'Part Name': r.partName || '—',
      'Qty': r.qty || '—',
      'Size': r.size || '—',
      'Material': r.material || '—',
      'Machine': r.machine || '—',
      'Vendor': r.vendor || '—',
      'Rate': r.rate || r.price || '—'
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
        body: JSON.stringify({ ...editFormData, role: currentUser?.role })
      });
      if (response.ok) {
        setEditingRowId(null);

      } else {
        alert('Failed to save edits to database.');
      }
    } catch (err) {
      console.error('Error saving edits:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveInventoryEdit = async (id) => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/inventory/${id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inventoryEditFormData)
      });
      if (response.ok) {
        setInventoryEditingId(null);
        setShowInventoryEditModal(false);

      } else {
        alert('Failed to save inventory edits to database.');
      }
    } catch (err) {
      console.error('Error saving inventory edits:', err);
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
            return !r.status || r.status === 'pending_review' || r.status === 'draft';
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

    let matchesDate = true;
    if (activeTab === 'approved') {
      if (exportStartDate) {
        const start = new Date(exportStartDate);
        start.setHours(0, 0, 0, 0);
        if (new Date(item.approvedAt || item.demandTimestamp) < start) matchesDate = false;
      }
      if (exportEndDate) {
        const end = new Date(exportEndDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(item.approvedAt || item.demandTimestamp) > end) matchesDate = false;
      }
    }
    let matchesStatus = true;
    if (activeTab === 'approved' && selectedStatus !== '') {
      if (selectedStatus === 'ordered') {
        matchesStatus = item.isOrdered === true;
      } else if (selectedStatus === 'approved') {
        matchesStatus = item.status === 'approved' && item.isOrdered !== true;
      } else {
        matchesStatus = item.status === selectedStatus;
      }
    }

    return matchesSearch && matchesMachine && matchesVendor && matchesDate && matchesStatus;
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
        if (data.user.role === 'receiver') {
          setActiveTab('receiving');
        } else {
          setActiveTab('pending');
        }
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
  const globalUniqueSKUs = Array.from(new Set(inventoryItems.map(i => i.sku).filter(Boolean))).sort();
  const globalUniqueRegNos = Array.from(new Set(inventoryItems.map(i => i.regNo).filter(Boolean))).sort();
  const globalUniqueSizes = Array.from(new Set(inventoryItems.map(i => i.size).filter(Boolean))).sort();
  const globalUniqueUnits = Array.from(new Set(inventoryItems.map(i => i.unit).filter(Boolean))).sort();

  const handleCustomDemandPartNameChange = (e) => {
    const val = e.target.value;
    const matched = inventoryItems.find(i => i.partName === val);
    if (matched) {
      setCustomDemandData(prev => ({
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
      setCustomDemandData(prev => ({ ...prev, partName: val }));
    }
  };

  const handleCustomDemandSkuChange = (e) => {
    const val = e.target.value;
    setCustomDemandData(prev => ({ ...prev, sku: val }));
  };

  const handleCustomDemandRegNoChange = (e) => {
    const val = e.target.value;
    setCustomDemandData(prev => ({ ...prev, regNo: val }));
  };

  const submitCustomDemand = async (isDraft = false) => {
    if (isDraft) {
      if (!customDemandData.partName) {
        alert("Part Name is required even for drafts.");
        return;
      }
    } else {
      if (!customDemandData.partName || !customDemandData.qty || !customDemandData.price) {
        alert("Part Name, Quantity, and Rate are mandatory fields to forward to Approver.");
        return;
      }
    }

    try {
      setRefreshing(true);
      const payload = {
        ...customDemandData,
        editorName: currentUser ? currentUser.username : 'Editor',
        status: isDraft ? 'draft' : 'reviewed'
      };
      const response = await fetch('/api/pending/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setCustomDemandData({
          partName: '', sku: '', regNo: '', qty: '', unit: '', size: '', material: '', machine: '', vendor: '', price: ''
        });
        setShowCustomDemandModal(false);

        alert(isDraft ? "Draft successfully saved!" : "Custom demand successfully forwarded to the Approver!");
      } else {
        alert("Failed to submit custom demand.");
      }
    } catch (err) {
      console.error("Error submitting custom demand:", err);
      alert("Connection error occurred.");
    } finally {
      setRefreshing(false);
    }
  };

  const setCurrentUserRole = () => {};

  function handleClearFilters() {
    setSearchQuery('');
    setSelectedMachine('');
    setSelectedVendor('');
    setSelectedStatus('');
    setSelectedInventoryMachine('');
  }

  const handlePartNameChange = (e) => setEditFormData({...editFormData, partName: e.target.value});
  const handleSkuChange = (e) => setEditFormData({...editFormData, sku: e.target.value});

  const dashboardProps = { approvingId, forwardingId, receivingId, orderingId, handleToggleOrdered, loading, voiceNotes, exportStartDate, setExportStartDate, exportEndDate, setExportEndDate, exportToExcel, exportToPDF, printDemandList, customConfirm, availableGroups, handleToggleGroupActive,  activeTab, kpiData, filteredRequests, viewMode, currentPendingIndex, setCurrentPendingIndex, handleApprove, handleReject, handleForward, rejectingId, setRejectingId, rejectReason, setRejectReason, currentUserRole, inventoryItems, selectedInventoryMachine, setSelectedInventoryMachine, uniqueInventoryMachines, inventoryLoading, handleReceive, editingRowId, setEditingRowId, editFormData, setEditFormData, handleSaveInlineEdit, inventoryEditingId, setInventoryEditingId, inventoryEditFormData, setInventoryEditFormData, handleSaveInventoryEdit, showInventoryEditModal, setShowInventoryEditModal, handlePartNameChange, handleSkuChange, searchQuery, setSearchQuery, selectedMachine, setSelectedMachine, selectedVendor, setSelectedVendor, selectedStatus, setSelectedStatus, uniqueMachines, uniqueVendors, whatsappStatus, whatsappGroups, setWhatsappGroups, fetchWhatsappStatus, fetchWhatsappGroups, showCustomDemandModal, setShowCustomDemandModal, customDemandData, setCustomDemandData, submitCustomDemand, globalModal, setGlobalModal, handleClearFilters, filteredInventory, hasNoActiveGroups, setActiveTab, pendingRequests, apiLimitCount, apiLimitMax, setCurrentUserRole, setViewMode, fetchData, refreshing, setRefreshing, globalUniquePartNames, globalUniqueMaterials, globalUniqueMachines, globalUniqueVendors, globalUniqueSKUs, globalUniqueRegNos, globalUniqueSizes, globalUniqueUnits, handleCustomDemandPartNameChange, handleCustomDemandSkuChange, handleCustomDemandRegNoChange };
  return (
    <>
      {currentUserRole === 'observer' && <ManagerDashboard {...dashboardProps} />}
      {currentUserRole === 'reviewer' && <EditorDashboard {...dashboardProps} />}
      {currentUserRole === 'manager' && <ApproverDashboard {...dashboardProps} />}
      {currentUserRole === 'receiver' && <ReceiverDashboard {...dashboardProps} />}
    </>
  );
}
