// audio.ts — Minimal Sound Engine using Web Audio API
// Only win sound is kept.

let audioCtx: AudioContext | null = null;

function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

export function playWinSound() {
  try {
    initAudioContext();
    if (!audioCtx) return;
    
    // Arpeggio: C4 (261.63Hz) -> E4 (329.63Hz) -> G4 (392.00Hz) -> C5 (523.25Hz)
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, idx) => {
      const timeOffset = idx * 0.12;
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx!.currentTime + timeOffset);
      
      gain.gain.setValueAtTime(0, audioCtx!.currentTime + timeOffset);
      gain.gain.linearRampToValueAtTime(0.08, audioCtx!.currentTime + timeOffset + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx!.currentTime + timeOffset + 0.6);
      
      osc.connect(gain);
      gain.connect(audioCtx!.destination);
      
      osc.start(audioCtx!.currentTime + timeOffset);
      osc.stop(audioCtx!.currentTime + timeOffset + 0.6);
    });
  } catch {
    // blocked
  }
}
