import React, { useState, useRef, useEffect } from 'react';

// Helper to determine category based on part name
const getCategory = (partName = '') => {
  const name = partName.toLowerCase();
  if (name.includes('oil') || name.includes('diesel') || name.includes('fluid') || name.includes('coolant')) {
    return 'fluids';
  }
  if (name.includes('sensor') || name.includes('light') || name.includes('fan') || name.includes('electronic') || name.includes('cable') || name.includes('switch') || name.includes('turret')) {
    return 'electrical';
  }
  if (name.includes('tool') || name.includes('threading') || name.includes('parting') || name.includes('tape') || name.includes('measure') || name.includes('mallet')) {
    return 'tooling';
  }
  return 'mechanical';
};

// Custom dynamic flat SVG illustration header component
const CardHeaderIllustration = ({ category }) => {
  if (category === 'fluids') {
    return (
      <svg className="header-illustration-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.105-6 11.25-6 11.25s-6-4.145-6-11.25a6 6 0 0112 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  if (category === 'electrical') {
    return (
      <svg className="header-illustration-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    );
  }
  if (category === 'tooling') {
    return (
      <svg className="header-illustration-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A1.5 1.5 0 0019.5 21l2-2a1.5 1.5 0 000-2.25l-5.83-5.83M11.42 15.17l2.42-2.42M11.42 15.17L5.67 9.42M13.84 12.75l2.42-2.42M13.84 12.75L8.09 7M6.75 10.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18 6.25a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
      </svg>
    );
  }
  // Fallback: Mechanical
  return (
    <svg className="header-illustration-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.645-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
};

export default function RequestCard({ item, voiceNotes = [] }) {
  const category = getCategory(item.partName);
  
  // Minimalist Custom HTML5 Audio Player logic
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  
  // Heuristic: Map a local voice note by order or simple timestamps. 
  // Let's pair the 6 voice notes with elements dynamically based on their ID, or
  // if this is an audio-sourced request (e.g. some items don't have standard fields or look like transcribed text)
  // Let's pair voice notes sequentially to requests to give the user a beautiful interactive test bench!
  const voiceNote = voiceNotes[item.id % voiceNotes.length];

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const getCategoryClass = (cat) => {
    switch (cat) {
      case 'fluids': return 'cat-fluids';
      case 'electrical': return 'cat-electrical';
      case 'tooling': return 'cat-tooling';
      default: return 'cat-mechanical';
    }
  };

  const getStatusTextAndClass = (qty) => {
    // If quantity is missing or empty, mark urgent/alert.
    // If quantity contains "pcs" or "pcs", or is normal, it's an active demand.
    if (!qty || qty === '') {
      return { text: 'Specs Missing', className: 'status-urgent' };
    }
    return { text: 'Active Demand', className: 'status-active' };
  };

  const { text: statusText, className: statusClass } = getStatusTextAndClass(item.qty);

  return (
    <div className="demand-card">
      <div className={`demand-card-header ${getCategoryClass(category)}`}>
        <CardHeaderIllustration category={category} />
      </div>
      
      <div className="demand-card-body">
        <h2 className="demand-part-name">
          {item.partName || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Part Name Unspecified</span>}
        </h2>
        
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <svg style={{ width: '13px', height: '13px', color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>Requested by: <strong>{item.requestedBy || 'WhatsApp User'}</strong></span>
        </div>

        {item.receivedAt && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <svg style={{ width: '13px', height: '13px', color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Received At (IST): <strong>{new Date(item.receivedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</strong></span>
          </div>
        )}

        {item.approvedAt && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <svg style={{ width: '13px', height: '13px', color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
            </svg>
            <span>Approved At (IST): <strong>{new Date(item.approvedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</strong></span>
          </div>
        )}
        
        <div className="demand-machine">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {item.machine || 'Stock / General Care'}
        </div>
        
        <div className="specs-list">
          <div className="spec-item">
            <span className="spec-label">Quantity</span>
            <span className="spec-val">{item.qty || '—'}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Size Specification</span>
            <span className="spec-val">{item.size || '—'}</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Material Type</span>
            <span className="spec-val">{item.material || '—'}</span>
          </div>
        </div>
        
        {voiceNote && (
          <div className="voice-note-player-wrapper">
            <button className="voice-note-play-btn" onClick={handlePlayPause}>
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="4" height="16" />
                  <rect x="16" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <span className="voice-note-label">WhatsApp Voice Note</span>
            <span className="voice-note-time">ogg</span>
            <audio 
              ref={audioRef} 
              src={voiceNote.url}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              style={{ display: 'none' }}
            />
          </div>
        )}
        
        <div className="demand-card-footer" style={{ marginTop: voiceNote ? '1rem' : 'auto' }}>
          <div className="demand-vendor">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {item.vendor || 'Awaiting Allocation'}
          </div>
          
          <span className={`status-badge ${statusClass}`}>
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
}
