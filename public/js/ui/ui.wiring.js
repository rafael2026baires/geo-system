export function wireUI({ onReplayClick, startRealtimeAuto, getActiveUnit }) {
    
  const btnReplay = document.getElementById('btnReplay');
  if (btnReplay) {
    btnReplay.onclick = () => onReplayClick(getActiveUnit);
  }

  // auto-start realtime
  //startRealtimeAuto(getActiveUnit);
  
}