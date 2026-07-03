import { useState, useEffect, useCallback } from 'react';
import socket from '../socket';

export function useDashboardData() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [voiceNotes, setVoiceNotes] = useState([]);
  const [kpiData, setKpiData] = useState({ newWorkerDemands: 0, pendingApproval: 0, approvedNotReceived: 0 });
  const [inventoryItems, setInventoryItems] = useState([]);
  const [uniqueInventoryMachines, setUniqueInventoryMachines] = useState([]);
  const [issuedItems, setIssuedItems] = useState([]);
  
  const [apiLimitCount, setApiLimitCount] = useState(0);
  const [apiLimitMax, setApiLimitMax] = useState(15);
  
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [whatsappGroups, setWhatsappGroups] = useState([]);
  const [qrCodeData, setQrCodeData] = useState(null);
  
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [pendingRes, approvedRes, voiceRes, kpiRes, inventoryRes, whatsappStatusRes, whatsappGroupsRes, issuedRes] = await Promise.all([
        fetch('/api/pending'),
        fetch('/api/requests'),
        fetch('/api/voice-notes'),
        fetch('/api/approver-kpis'),
        fetch('/api/inventory'),
        fetch('/api/whatsapp/status'),
        fetch('/api/whatsapp/groups'),
        fetch('/api/issue')
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
      }
      if (whatsappStatusRes.ok) {
        const wStatus = await whatsappStatusRes.json();
        setWhatsappStatus(wStatus);
      }
      if (whatsappGroupsRes.ok) {
        const groups = await whatsappGroupsRes.json();
        setWhatsappGroups(groups);
      }
      if (issuedRes.ok) {
        const issuedData = await issuedRes.json();
        setIssuedItems(issuedData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const fetchWhatsappStatus = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/whatsapp/status');
      if (response.ok) {
        const data = await response.json();
        setWhatsappStatus(data);
        if (data.status === 'qr_ready') {
          const qrRes = await fetch('/api/whatsapp/qr-image');
          if (qrRes.ok) {
            const qrData = await qrRes.json();
            setQrCodeData(qrData.qrImage);
          }
        } else {
          setQrCodeData(null);
        }
      }
    } catch (err) {
      console.error('Error fetching WhatsApp status:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const fetchWhatsappGroups = useCallback(async () => {
    try {
      const response = await fetch('/api/whatsapp/groups');
      if (response.ok) {
        const data = await response.json();
        setWhatsappGroups(data);
      }
    } catch (err) {
      console.error('Error fetching WhatsApp groups:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();

    socket.on('dashboard_update', () => {
      console.log('[Socket.IO] Dashboard update event received. Refreshing data...');
      fetchData();
    });

    socket.on('api_limit_update', (data) => {
      setApiLimitCount(data.count);
      setApiLimitMax(data.limit);
    });

    return () => {
      socket.off('dashboard_update');
      socket.off('api_limit_update');
    };
  }, [fetchData]);

  return {
    pendingRequests,
    approvedRequests,
    voiceNotes,
    kpiData,
    inventoryItems,
    uniqueInventoryMachines,
    apiLimitCount,
    apiLimitMax,
    issuedItems,
    setIssuedItems,
    whatsappStatus,
    whatsappGroups,
    qrCodeData,
    refreshing,
    setRefreshing,
    fetchData,
    fetchWhatsappStatus,
    fetchWhatsappGroups
  };
}
