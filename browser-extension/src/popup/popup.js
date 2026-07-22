document.addEventListener('DOMContentLoaded', async () => {
  const card = document.getElementById('status-card');
  const label = document.getElementById('status-label');
  const detail = document.getElementById('status-detail');

  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' });

    if (!res || !res.connected) {
      card.className = 'status-card disconnected';
      label.textContent = 'Disconnected';
      detail.textContent = 'Start the desktop app to activate.';
    } else if (res.locked) {
      card.className = 'status-card locked';
      label.textContent = 'Locked';
      detail.textContent = 'Risk settings protected. Changes blocked.';
    } else {
      card.className = 'status-card unlocked';
      label.textContent = 'Unlocked';
      detail.textContent = 'Open desktop app to lock settings.';
    }
  } catch (e) {
    card.className = 'status-card disconnected';
    label.textContent = 'Error';
    detail.textContent = 'Extension unable to communicate.';
  }
});
