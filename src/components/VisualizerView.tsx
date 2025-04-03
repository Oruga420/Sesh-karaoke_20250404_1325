import React, { useEffect, useRef } from 'react';
import './VisualizerView.css';

interface VisualizerViewProps {
  isPlaying: boolean;
  trackProgress: number;
}

const VisualizerView: React.FC<VisualizerViewProps> = ({ isPlaying, trackProgress }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  const barCount = 64; // Number of bars in the visualizer
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions with high resolution
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    // Define bars for the visualization
    const bars: number[] = Array(barCount).fill(0);
    
    // Beat detection variables
    const beatDetector = {
      bpm: 120, // Starting BPM (beats per minute)
      lastBeat: 0,
      beatInterval: 60000 / 120, // ms between beats (initially 500ms for 120bpm)
      sensitivity: 0.15, // How sensitive the beat detection is
      energyHistory: [] as number[],
      beatSmoother: 0, // For smoothing beat transitions
    };
    
    // Function to detect beats from the trackProgress
    const detectBeat = (time: number): boolean => {
      // First, adjust BPM based on trackProgress changes (simulating beat detection)
      if (trackProgress > 0) {
        // Use trackProgress to influence BPM - creates more realistic variations
        const progressFactor = Math.sin(trackProgress / 30000) * 5; // Slight BPM variations
        beatDetector.bpm = 120 + progressFactor;
        beatDetector.beatInterval = 60000 / beatDetector.bpm;
      }
      
      // Simple beat detection based on time
      const elapsedSinceLastBeat = time - beatDetector.lastBeat;
      
      if (elapsedSinceLastBeat >= beatDetector.beatInterval) {
        // Reset beat timing with slight randomness for realism
        const randomOffset = (Math.random() * 10) - 5; // +/- 5ms randomness
        beatDetector.lastBeat = time - randomOffset;
        return true;
      }
      
      return false;
    };
    
    // Create a pattern for active bars
    const createBarGradient = () => {
      const gradient = ctx.createLinearGradient(0, canvas.height / dpr, 0, 0);
      gradient.addColorStop(0, '#1DB954');    // Spotify green
      gradient.addColorStop(0.6, '#1ed760');  // Lighter green
      gradient.addColorStop(1, '#ffffff');    // White
      return gradient;
    };
    
    // Define colors
    const activeBarColor = createBarGradient();
    const inactiveBarColor = 'rgba(255, 255, 255, 0.2)';
    
    // For storing beat energy
    let beatEnergy = 0;
    let lastRenderTime = 0;
    
    // Animation function
    const animate = (time: number) => {
      // Calculate delta time since last frame for smooth animations
      const delta = time - (lastRenderTime || time);
      lastRenderTime = time;
      
      // Detect if a beat occurs at this moment
      const isBeat = isPlaying ? detectBeat(time) : false;
      
      // Update beat energy (decays over time, spikes on beats)
      beatEnergy *= 0.95; // Decay
      if (isBeat) {
        beatEnergy = 1.0; // Full energy on beat
      }
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      
      // Draw visualizer background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      
      // Calculate bar width with spacing
      const spacing = 2;
      const totalWidth = (canvas.width / dpr) - (spacing * (barCount - 1));
      const barWidth = totalWidth / barCount;
      
      // Update bars - different animation when playing vs paused
      if (isPlaying) {
        // Animate actively when playing
        for (let i = 0; i < barCount; i++) {
          // Create semi-random yet rhythmic movement
          const now = time / 1000;
          const phase = i / barCount * Math.PI * 2;
          
          // Center bars have higher response to beats
          const centerFactor = 1 - 2 * Math.abs((i / barCount) - 0.5);
          
          // Each frequency range responds differently to beats
          // Bass (low freq) has strongest beat response
          const frequencyResponse = i < barCount * 0.3 ? 1.2 : // Bass
                              i < barCount * 0.7 ? 0.8 : // Mids
                              0.6; // Highs
          
          // Create wave-like pattern based on position and time
          const baseHeight = 0.2 + 0.1 * Math.sin(now * 2.5 + phase);
          
          // Add variety across frequency spectrum
          const frequencyHeight = 0.2 * Math.pow(Math.sin(now * (3 + i/barCount*5) + phase), 2);
          
          // Add strong response on beats, shaped by frequency response
          const beatResponse = beatEnergy * frequencyResponse * centerFactor * 0.7;
          
          // Combine all effects and clamp to valid range
          bars[i] = Math.min(0.95, Math.max(0.05, 
            baseHeight + 
            frequencyHeight + 
            beatResponse
          ));
          
          // Add slight smoothing for natural look
          bars[i] = bars[i] * 0.7 + (bars[i] * 0.3);
        }
      } else {
        // Gentle idle animation when paused
        for (let i = 0; i < barCount; i++) {
          // Create gentle wave effect
          const now = time / 2000;
          const value = 0.15 + 0.08 * Math.sin(now + i / barCount * Math.PI * 4);
          
          // Smoothly transition to idle state
          bars[i] = bars[i] * 0.9 + value * 0.1;
        }
      }
      
      // Draw bars
      for (let i = 0; i < barCount; i++) {
        // Calculate bar height and position
        const barHeight = (canvas.height / dpr) * bars[i];
        const x = i * (barWidth + spacing);
        const y = (canvas.height / dpr) - barHeight;
        
        // Draw background bar
        ctx.fillStyle = inactiveBarColor;
        ctx.fillRect(x, 0, barWidth, canvas.height / dpr);
        
        // Draw active bar
        ctx.fillStyle = activeBarColor;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
      
      // Add beat flash effect
      if (isPlaying && beatEnergy > 0.7) {
        ctx.fillStyle = `rgba(29, 185, 84, ${beatEnergy * 0.15})`;
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      }
      
      // Continue animation
      animationFrameId.current = requestAnimationFrame(animate);
    };
    
    // Start animation
    animationFrameId.current = requestAnimationFrame(animate);
    
    // Cleanup function
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying, trackProgress]);
  
  return (
    <div className="visualizer-container">
      {/* Stand-alone playing status indicator */}
      <div className="playback-status">
        {isPlaying ? (
          <div className="playback-status__playing">
            <div className="playback-status__playing-icon">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="playback-status__label">Now Playing</span>
          </div>
        ) : (
          <div className="playback-status__paused">
            <div className="playback-status__pause-icon">
              <span></span><span></span>
            </div>
            <span className="playback-status__label">Paused</span>
          </div>
        )}
      </div>

      {/* Separate standalone visualizer */}
      <div className="visualizer">
        <canvas ref={canvasRef} className="visualizer__canvas" />
      </div>
    </div>
  );
};

export default VisualizerView;