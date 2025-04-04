import React, { useState } from 'react';
import './SyncControls.css';

interface SyncControlsProps {
  onSyncAdjust: (adjustment: number) => void;
}

function SyncControls({ onSyncAdjust }: SyncControlsProps) {
  const [syncOffset, setSyncOffset] = useState<number>(0);
  
  const handleSyncAdjust = (amount: number) => {
    const newOffset = syncOffset + amount;
    setSyncOffset(newOffset);
    onSyncAdjust(newOffset);
    
    // Show feedback to the user
    console.log(`Lyrics timing adjusted by ${amount}ms, new offset: ${newOffset}ms`);
  };
  
  return (
    <div className="sync-controls">
      <div className="sync-controls__info">
        <span className="sync-controls__label">Lyrics Sync: </span>
        <span className="sync-controls__value">{syncOffset > 0 ? '+' : ''}{syncOffset / 1000}s</span>
      </div>
      <div className="sync-controls__buttons">
        <button 
          className="sync-controls__button" 
          onClick={() => handleSyncAdjust(-500)}
          title="Make lyrics appear earlier"
        >
          ◀◀ Earlier
        </button>
        <button 
          className="sync-controls__button" 
          onClick={() => handleSyncAdjust(-100)}
          title="Fine tune earlier"
        >
          ◀
        </button>
        <button 
          className="sync-controls__button sync-controls__button--reset" 
          onClick={() => {
            setSyncOffset(0);
            onSyncAdjust(0);
          }}
          title="Reset to default timing"
        >
          Reset
        </button>
        <button 
          className="sync-controls__button" 
          onClick={() => handleSyncAdjust(100)}
          title="Fine tune later"
        >
          ▶
        </button>
        <button 
          className="sync-controls__button" 
          onClick={() => handleSyncAdjust(500)}
          title="Make lyrics appear later"
        >
          Later ▶▶
        </button>
      </div>
    </div>
  );
}

export default SyncControls;