import React from 'react';

export default function ApproverMetrics({ newWorkerDemands, pendingApproval, approvedNotReceived }) {
  return (
    <div className="metrics-row">
      {/* KPI Card 1: New Worker Demands */}
      <div className="metric-card">
        <div className="metric-icon-wrapper" style={{ backgroundColor: 'var(--accent-amber-bg)', color: 'var(--accent-amber-text)' }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div className="metric-info">
          <h3>New Worker Demands</h3>
          <div className="metric-value">{newWorkerDemands}</div>
        </div>
      </div>

      {/* KPI Card 2: Pending Approval */}
      <div className="metric-card">
        <div className="metric-icon-wrapper" style={{ backgroundColor: 'var(--accent-purple-bg)', color: 'var(--accent-purple-text)' }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="metric-info">
          <h3>Pending Approval</h3>
          <div className="metric-value">{pendingApproval}</div>
        </div>
      </div>

      {/* KPI Card 3: Approved but Not Received */}
      <div className="metric-card">
        <div className="metric-icon-wrapper" style={{ backgroundColor: 'var(--accent-blue-bg)', color: 'var(--accent-blue-text)' }}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div className="metric-info">
          <h3>Approved (Not Received)</h3>
          <div className="metric-value">{approvedNotReceived}</div>
        </div>
      </div>
    </div>
  );
}
