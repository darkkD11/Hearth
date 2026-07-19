/**
 * Browser Notification utilities for Hearth.
 * Requests permission on first call and fires desktop notifications
 * when the tab is not focused.
 */

let permissionGranted = false;

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  
  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }
  
  if (Notification.permission === 'denied') {
    return false;
  }
  
  const result = await Notification.requestPermission();
  permissionGranted = result === 'granted';
  return permissionGranted;
}

export function sendDesktopNotification(title: string, body: string, icon?: string): void {
  if (!permissionGranted || document.hasFocus()) return;
  
  try {
    const notification = new Notification(title, {
      body,
      icon: icon || '/favicon.ico',
      tag: 'hearth-message', // Prevents notification spam
      silent: false,
    });
    
    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
    
    // Focus the window when clicked
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}
