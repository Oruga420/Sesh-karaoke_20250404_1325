import React from 'react';
import './SyncControls.css';

interface SyncControlsProps { adjustment: number; onSyncAdjust: (adjustment: number) => void }
function SyncControls({ adjustment, onSyncAdjust }: SyncControlsProps) {
  return <details className="sync-controls">
    <summary>Ajustar sincronización</summary>
    <div className="sync-controls__body">
      <div className="sync-controls__info"><span className="sync-controls__label">Desfase de la letra</span>
        <output className="sync-controls__value" aria-label="Desfase de la letra">{adjustment > 0 ? '+' : ''}{(adjustment / 1000).toFixed(1).replace('.', ',')} s</output></div>
      <div className="sync-controls__buttons">
        <button type="button" className="sync-controls__button" aria-label="Reducir desfase 0,5 segundos" disabled={adjustment <= -30000} onClick={() => onSyncAdjust(Math.max(-30000, adjustment - 500))}>−0,5 s</button>
        <button type="button" className="sync-controls__button" aria-label="Reducir desfase 0,1 segundos" disabled={adjustment <= -30000} onClick={() => onSyncAdjust(Math.max(-30000, adjustment - 100))}>−0,1 s</button>
        <button type="button" className="sync-controls__button sync-controls__button--reset" disabled={adjustment === 0} onClick={() => onSyncAdjust(0)}>Restablecer</button>
        <button type="button" className="sync-controls__button" aria-label="Aumentar desfase 0,1 segundos" disabled={adjustment >= 30000} onClick={() => onSyncAdjust(Math.min(30000, adjustment + 100))}>+0,1 s</button>
        <button type="button" className="sync-controls__button" aria-label="Aumentar desfase 0,5 segundos" disabled={adjustment >= 30000} onClick={() => onSyncAdjust(Math.min(30000, adjustment + 500))}>+0,5 s</button>
      </div>
      <p>Un valor positivo adelanta la letra. El audio sigue en Spotify.</p>
    </div>
  </details>;
}
export default SyncControls;
