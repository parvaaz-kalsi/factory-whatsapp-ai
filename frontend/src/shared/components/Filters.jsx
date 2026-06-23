import React from 'react';

export default function Filters({
  searchQuery,
  setSearchQuery,
  selectedMachine,
  setSelectedMachine,
  selectedVendor,
  setSelectedVendor,
  selectedStatus,
  setSelectedStatus,
  activeTab,
  uniqueMachines = [],
  uniqueVendors = []
}) {
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedMachine('');
    setSelectedVendor('');
    if (setSelectedStatus) setSelectedStatus('');
  };

  const hasActiveFilters = searchQuery !== '' || selectedMachine !== '' || selectedVendor !== '' || (activeTab === 'approved' && selectedStatus !== '');

  return (
    <div className="filter-dashboard">
      {/* Dynamic Dropdown: By Machine */}
      <div className="filter-group">
        <label className="filter-label">Machine Type</label>
        <select
          className="filter-select"
          value={selectedMachine}
          onChange={(e) => setSelectedMachine(e.target.value)}
        >
          <option value="">All Machines</option>
          {uniqueMachines.map((machine) => (
            <option key={machine} value={machine}>
              {machine}
            </option>
          ))}
        </select>
      </div>

      {/* Dynamic Dropdown: By Vendor */}
      <div className="filter-group">
        <label className="filter-label">Allocated Vendor</label>
        <select
          className="filter-select"
          value={selectedVendor}
          onChange={(e) => setSelectedVendor(e.target.value)}
        >
          <option value="">All Vendors</option>
          {uniqueVendors.map((vendor) => (
            <option key={vendor} value={vendor}>
              {vendor}
            </option>
          ))}
        </select>
      </div>

      {/* Dynamic Dropdown: By Receipt Status (Only for Approved History) */}
      {activeTab === 'approved' && (
        <div className="filter-group">
          <label className="filter-label">Receipt Status</label>
          <select
            className="filter-select"
            value={selectedStatus || ''}
            onChange={(e) => setSelectedStatus && setSelectedStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="approved">Approved</option>
            <option value="ordered">Ordered</option>
            <option value="received">Received</option>
          </select>
        </div>
      )}

      {/* Clear Filters Button (Minimalist text link style) */}
      {hasActiveFilters && (
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

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="active-filter-tags">
          {searchQuery && (
            <span className="filter-tag">
              Search: "{searchQuery}"
              <span className="filter-tag-close" onClick={() => setSearchQuery('')}>✕</span>
            </span>
          )}
          {selectedMachine && (
            <span className="filter-tag">
              Machine: {selectedMachine}
              <span className="filter-tag-close" onClick={() => setSelectedMachine('')}>✕</span>
            </span>
          )}
          {selectedVendor && (
            <span className="filter-tag">
              Vendor: {selectedVendor}
              <span className="filter-tag-close" onClick={() => setSelectedVendor('')}>✕</span>
            </span>
          )}
          {activeTab === 'approved' && selectedStatus && (
            <span className="filter-tag">
              Status: {selectedStatus === 'approved' ? 'Approved' : selectedStatus === 'ordered' ? 'Ordered' : 'Received'}
              <span className="filter-tag-close" onClick={() => setSelectedStatus && setSelectedStatus('')}>✕</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
