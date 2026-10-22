import React from 'react';
import './SyncControls.css';

interface SyncControlsProps { adjustment: number; onSyncAdjust: (adjustment: number) => void }
function SyncControls({ adjustment, onSyncAdjust }: SyncControlsProps) {
  return <div className="sync-controls">
    <div className="sync-controls__info"><span className="sync-controls__label">Lyrics offset:</span>
      <output className="sync-controls__value">{adjustment > 0 ? '+' : ''}{(adjustment / 1000).toFixed(1)}s</output></div>
    <div className="sync-controls__buttons">
      <button type="button" className="sync-controls__button" onClick={() => onSyncAdjust(Math.max(-30000, adjustment - 500))}>−0.5s</button>
      <button type="button" className="sync-controls__button" aria-label="Decrease lyrics offset by 0.1 seconds" onClick={() => onSyncAdjust(Math.max(-30000, adjustment - 100))}>−0.1s</button>
      <button type="button" className="sync-controls__button sync-controls__button--reset" onClick={() => onSyncAdjust(0)}>Reset</button>
      <button type="button" className="sync-controls__button" aria-label="Increase lyrics offset by 0.1 seconds" onClick={() => onSyncAdjust(Math.min(30000, adjustment + 100))}>+0.1s</button>
      <button type="button" className="sync-controls__button" onClick={() => onSyncAdjust(Math.min(30000, adjustment + 500))}>+0.5s</button>
    </div>
  </div>;
}
export default SyncControls;
