import React, { useEffect, useRef, useState, useMemo } from 'react';
import './Lyrics.css';

interface LyricsProps {
  syncedLyrics: any[];
  currentLine: number;
  currentWord: number;
  progress: number; // Progress in milliseconds
  duration: number; // Total duration in milliseconds
  paused: boolean; // Whether playback is paused
}

function Lyrics({ syncedLyrics, currentLine, currentWord, progress, duration, paused }: LyricsProps) {
  const lyricsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightedRef = useRef<HTMLSpanElement>(null);
  const [syncEnabled, setSyncEnabled] = useState(true);
  
  // Log the incoming lyrics data for debugging and validate content
  useEffect(() => {
    console.log('Lyrics component received:', {
      linesCount: syncedLyrics?.length || 0,
      currentLine,
      currentWord,
      progress,
      sample: syncedLyrics?.length > 0 ? 
        syncedLyrics[0].map((w: any) => w.word || w).join(' ') : 'No lyrics'
    });
    
    // Validate that syncedLyrics doesn't contain unintended intro messages
    if (syncedLyrics?.length > 0) {
      const firstLine = syncedLyrics[0];
      if (firstLine?.length > 0) {
        const firstWord = firstLine[0]?.word;
        if (firstWord && typeof firstWord === 'string' && 
            (firstWord.includes('Now playing') || firstWord.includes('Welcome'))) {
          console.warn('Detected intro message in lyrics, this should be removed');
        }
      }
    }
  }, [syncedLyrics, currentLine, currentWord, progress]);
  
  // Calculate the current lyrics state based on progress
  const lyricsState = useMemo(() => {
    // If there are no lyrics or sync is disabled or playback is paused, show all lyrics
    if (!syncedLyrics || syncedLyrics.length === 0 || !syncEnabled || paused) {
      return {
        before: '',
        highlighted: '',
        after: syncedLyrics ? syncedLyrics.map(line => 
          line.map((w: any) => w.word || w).join(' ')
        ).join('\n') : ''
      };
    }
    
    // Progress in seconds
    const progressSeconds = progress / 1000;
    
    // Find lines that have passed and current line based on timestamp
    const passedLinesWithCurrent = syncedLyrics
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => {
        // Get the timestamp of the line (first word's timestamp)
        const timestamp = line[0]?.timestamp || 0;
        return timestamp <= progressSeconds;
      });
    
    // Lines that have fully passed (all except current)
    const passedLines = passedLinesWithCurrent.slice(0, -1);
    
    // Current line being sung
    const currentLyrics = passedLinesWithCurrent.length > 0
      ? passedLinesWithCurrent[passedLinesWithCurrent.length - 1]
      : null;
    
    // Upcoming lines
    const upcomingLines = syncedLyrics
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => {
        const timestamp = line[0]?.timestamp || 0;
        return timestamp > progressSeconds;
      });
    
    // Format lines for display
    const before = passedLines.map(({ line }) => 
      line.map((w: any) => w.word || w).join(' ')
    ).join('\n');
    
    const highlighted = currentLyrics 
      ? currentLyrics.line.map((w: any) => w.word || w).join(' ')
      : '';
    
    const after = upcomingLines.map(({ line }) => 
      line.map((w: any) => w.word || w).join(' ')
    ).join('\n');
    
    return { before, highlighted, after };
  }, [syncedLyrics, progress, syncEnabled, paused]);
  
  // Effect to scroll to the highlighted line with debounce to prevent jumpy behavior
  useEffect(() => {
    if (syncEnabled && highlightedRef.current) {
      // Debounce the scroll to prevent jumpiness
      const timeoutId = setTimeout(() => {
        if (highlightedRef.current) {
          highlightedRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 100); // Small delay to batch scroll operations
      
      return () => clearTimeout(timeoutId);
    }
  }, [lyricsState.highlighted, syncEnabled, currentLine]);
  
  // Alternative effect to scroll to the active line (when viewing all lyrics)
  // with debouncing to prevent jumpy behavior
  useEffect(() => {
    if (!syncEnabled && lyricsRef.current && syncedLyrics?.length > 0) {
      const scrollToLine = () => {
        if (!lyricsRef.current) return;
        
        // Get all line elements
        const lineElements = lyricsRef.current.querySelectorAll('.lyrics__line');
        
        // If we have line elements and the current line is valid
        if (lineElements.length > 0 && currentLine < lineElements.length) {
          // Get the current line element
          const currentLineElement = lineElements[currentLine] as HTMLElement;
          
          // Smooth scroll to the current line
          setTimeout(() => {
            if (currentLineElement) {
              currentLineElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });
            }
          }, 150);
        }
      };
      
      // Debounce the scroll operation
      const timeoutId = setTimeout(scrollToLine, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [currentLine, syncedLyrics, syncEnabled]);
  
  // Effect for tracking mouse movement for dynamic background
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      container.style.setProperty('--mouse-x', `${x}%`);
      container.style.setProperty('--mouse-y', `${y}%`);
    };
    
    container.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  // Toggle sync mode
  const toggleSyncEnabled = () => setSyncEnabled(prev => !prev);
  
  // Empty state - improved with more information and debugging
  if (!syncedLyrics || syncedLyrics.length === 0) {
    console.log('Lyrics component showing empty state - no lyrics available');
    
    return (
      <div className="lyrics lyrics--empty">
        <div className="lyrics__empty-content">
          <div className="lyrics__empty-icon">🎵</div>
          <p>No lyrics found for this song</p>
          <p className="lyrics__empty-message">
            We couldn't find synchronized lyrics for this track.
            <br />
            Try another song or check back later.
          </p>
          <div className="lyrics__debug-info">
            <p><small>Debug: syncedLyrics={JSON.stringify(Boolean(syncedLyrics))}, length={syncedLyrics?.length || 0}</small></p>
            <button 
              className="lyrics__retry-button" 
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // When sync mode is enabled, use the three-part display (before, highlighted, after)
  if (syncEnabled) {
    return (
      <div className="lyrics lyrics--dynamic" ref={containerRef}>
        <div className="lyrics__fade lyrics__fade--top"></div>
        
        <div className="lyrics__sync-toggle" onClick={toggleSyncEnabled}>
          <span className="lyrics__sync-icon">🔄</span>
        </div>
        
        <div className="lyrics__container" ref={lyricsRef}>
          {/* Past lyrics */}
          <div className="lyrics__passed-section">
            {lyricsState.before}
          </div>
          
          {/* Current line */}
          {lyricsState.highlighted && (
            <div className="lyrics__highlighted-wrapper">
              <span className="lyrics__highlighted" ref={highlightedRef}>
                {lyricsState.highlighted}
              </span>
            </div>
          )}
          
          {/* Upcoming lyrics */}
          <div className="lyrics__upcoming-section">
            {lyricsState.after}
          </div>
        </div>
        
        <div className="lyrics__fade lyrics__fade--bottom"></div>
        
        <div className="lyrics__progress">
          <div className="lyrics__progress-text">
            {Math.floor(progress / 60000)}:{String(Math.floor((progress / 1000) % 60)).padStart(2, '0')} / 
            {Math.floor(duration / 60000)}:{String(Math.floor((duration / 1000) % 60)).padStart(2, '0')}
          </div>
          <div className="lyrics__progress-bar">
            <div 
              className="lyrics__progress-fill"
              style={{width: `${(progress / duration) * 100}%`}}
            ></div>
          </div>
        </div>
      </div>
    );
  }
  
  // When sync mode is disabled, show the traditional line-by-line view with word highlighting
  return (
    <div className="lyrics lyrics--dynamic" ref={containerRef}>
      <div className="lyrics__fade lyrics__fade--top"></div>
      
      <div className="lyrics__sync-toggle" onClick={toggleSyncEnabled}>
        <span className="lyrics__sync-icon">📝</span>
      </div>
      
      <div className="lyrics__container" ref={lyricsRef}>
        {syncedLyrics.map((line, lineIndex) => (
          <div
            key={`line-${lineIndex}`}
            className={`
              lyrics__line
              ${lineIndex === currentLine ? 'lyrics__line--active' : ''}
              ${lineIndex < currentLine ? 'lyrics__line--passed' : ''}
              ${lineIndex > currentLine ? 'lyrics__line--upcoming' : ''}
            `}
            style={{
              opacity: lineIndex === currentLine ? 1 : 
                       lineIndex === currentLine - 1 || lineIndex === currentLine + 1 ? 0.8 :
                       lineIndex === currentLine - 2 || lineIndex === currentLine + 2 ? 0.6 : 0.3,
              transform: lineIndex === currentLine ? 'scale(1.05) translateZ(10px)' : 
                         lineIndex === currentLine - 1 ? 'scale(0.95) translateZ(5px)' :
                         lineIndex === currentLine + 1 ? 'scale(0.95) translateZ(5px)' : 'scale(0.9) translateZ(0)',
              filter: lineIndex !== currentLine ? 'blur(0.5px)' : 'none'
            }}
          >
            {line.map((word: any, wordIndex: number) => {
              // Enhanced word format handling with better LRC support
              let wordText = '';
              
              if (typeof word === 'string') {
                wordText = word.trim();
              } else if (word && typeof word === 'object') {
                // Try to find the word property
                if ('word' in word && typeof word.word === 'string') {
                  wordText = word.word.trim();
                } else {
                  // Try common variants that might occur due to API response format
                  const possibleWordProps = ['text', 'content', 'value'];
                  for (const prop of possibleWordProps) {
                    if (prop in word && typeof word[prop] === 'string') {
                      wordText = word[prop].trim();
                      break;
                    }
                  }
                  
                  // Last resort - convert entire object to string if nothing works
                  if (!wordText && Object.keys(word).length > 0) {
                    wordText = JSON.stringify(word).trim();
                    console.warn(`Couldn't extract word text properly`, word);
                  }
                }
              }
              
              // Skip rendering empty words
              if (!wordText) {
                console.warn(`Empty word at line ${lineIndex}, word ${wordIndex}`, word);
                return null;
              }
              
              return (
                <React.Fragment key={`word-${lineIndex}-${wordIndex}`}>
                  <span
                    className={`
                      lyrics__word
                      ${lineIndex === currentLine ? 'lyrics__word--current' : ''}
                      ${lineIndex < currentLine ? 'lyrics__word--line-passed' : ''}
                    `}
                  >
                    {wordText}
                  </span>
                  {/* Add a clear space after each word */}
                  <span className="lyrics__word-space">{' '}</span>
                </React.Fragment>
              );
            })}
          </div>
        ))}
      </div>
      
      <div className="lyrics__fade lyrics__fade--bottom"></div>
      
      <div className="lyrics__progress">
        <div className="lyrics__progress-text">
          Line {currentLine + 1} of {syncedLyrics.length}
        </div>
        <div className="lyrics__progress-bar">
          <div 
            className="lyrics__progress-fill"
            style={{width: `${(currentLine / (syncedLyrics.length - 1)) * 100}%`}}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default Lyrics;