document.addEventListener('DOMContentLoaded', async () => {
  const card = document.getElementById('status-card');
  const label = document.getElementById('status-label');
  const detail = document.getElementById('status-detail');

  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' });

    if (!res || !res.connected) {
      card.className = 'status-card disconnected';
      label.textContent = 'Not Connected';
      detail.textContent = 'Start the Trading Guardian desktop app to activate protection.';
    } else if (res.locked) {
      card.className = 'status-card locked';
      label.textContent = 'Protection Active';
      detail.textContent = 'Risk settings are locked. Weakening changes will be blocked.';
    } else {
      card.className = 'status-card unlocked';
      label.textContent = 'Connected — Unlocked';
      detail.textContent = 'Open the desktop app and lock your settings to activate protection.';
    }
  } catch (e) {
    card.className = 'status-card disconnected';
    label.textContent = 'Extension Error';
    detail.textContent = 'Unable to communicate with the background service.';
  }
});
