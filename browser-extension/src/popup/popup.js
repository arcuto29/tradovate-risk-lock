document.addEventListener('DOMContentLoaded', async () => {
  const status = document.getElementById('status');
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' });
    if (!res.connected) { status.className = 'disconnected'; status.textContent = 'Desktop app not connected. Make sure it is running.'; }
    else if (res.locked) { status.className = 'locked'; status.textContent = 'LOCKED - Risk settings protection active'; }
    else { status.className = 'unlocked'; status.textContent = 'Unlocked - Open desktop app to lock settings'; }
  } catch { status.className = 'disconnected'; status.textContent = 'Extension error'; }
});
