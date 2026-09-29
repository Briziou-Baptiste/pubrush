import { WSMessage } from '../types/webSocker.types';

export { WSMessage };

let userSocket: WebSocket | null = null;
let userPingInterval: ReturnType<typeof setInterval> | null = null;
let userReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let userExplicitClose = false;
let userRetryCount = 0;

let activeBarathonSocket: WebSocket | null = null;
let barathonPingInterval: ReturnType<typeof setInterval> | null = null;
let barathonReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let barathonExplicitClose = false;
let barathonRetryCount = 0;

function buildWsUrl(path: string, token: string, apiBaseUrl: string) {
  const wsBaseUrl = apiBaseUrl
    .replace(/^http:\/\//, 'ws://')
    .replace(/^https:\/\//, 'wss://');

  return `${wsBaseUrl}${path}?token=${encodeURIComponent(token)}`;
}

export function connectUserSocket({
  apiBaseUrl,
  token,
  onMessage,
  onOpen,
  onClose,
}: {
  apiBaseUrl: string;
  token: string;
  onMessage: (message: WSMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  disconnectUserSocket();
  userExplicitClose = false;

  function doConnect() {
    if (userExplicitClose) return;

    const url = buildWsUrl('/ws/me', token, apiBaseUrl);
    userSocket = new WebSocket(url);

    userSocket.onopen = () => {
      userRetryCount = 0;
      onOpen?.();

      if (userPingInterval) clearInterval(userPingInterval);
      userPingInterval = setInterval(() => {
        if (userSocket && userSocket.readyState === WebSocket.OPEN) {
          try {
            userSocket.send(JSON.stringify({ type: 'PING' }));
          } catch {
            // Socket might be closing
          }
        }
      }, 15000);
    };

    userSocket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'PONG') {
          return;
        }
        onMessage(parsed as WSMessage);
      } catch (error) {
        console.error('Invalid user websocket payload', error);
      }
    };

    userSocket.onerror = (error) => {
      console.error('User websocket error', error);
    };

    userSocket.onclose = () => {
      if (userPingInterval) {
        clearInterval(userPingInterval);
        userPingInterval = null;
      }
      onClose?.();

      if (!userExplicitClose) {
        const delay = Math.min(1000 * Math.pow(1.5, userRetryCount), 15000);
        userRetryCount++;
        userReconnectTimeout = setTimeout(() => {
          doConnect();
        }, delay);
      }
    };
  }

  doConnect();
  return userSocket;
}

export function disconnectUserSocket() {
  userExplicitClose = true;
  if (userReconnectTimeout) {
    clearTimeout(userReconnectTimeout);
    userReconnectTimeout = null;
  }
  if (userPingInterval) {
    clearInterval(userPingInterval);
    userPingInterval = null;
  }
  if (userSocket) {
    userSocket.close();
    userSocket = null;
  }
  userRetryCount = 0;
}

export function connectBarathonSocket({
  apiBaseUrl,
  token,
  barathonId,
  onMessage,
  onOpen,
  onClose,
}: {
  apiBaseUrl: string;
  token: string;
  barathonId: number;
  onMessage: (message: WSMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  disconnectBarathonSocket();
  barathonExplicitClose = false;

  function doConnect() {
    if (barathonExplicitClose) return;

    const url = buildWsUrl(`/ws/barathons/${barathonId}`, token, apiBaseUrl);
    activeBarathonSocket = new WebSocket(url);

    activeBarathonSocket.onopen = () => {
      barathonRetryCount = 0;
      onOpen?.();

      if (barathonPingInterval) clearInterval(barathonPingInterval);
      barathonPingInterval = setInterval(() => {
        if (activeBarathonSocket && activeBarathonSocket.readyState === WebSocket.OPEN) {
          try {
            activeBarathonSocket.send(JSON.stringify({ type: 'PING' }));
          } catch {
            // Socket might be closing
          }
        }
      }, 15000);
    };

    activeBarathonSocket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'PONG') {
          return;
        }
        onMessage(parsed as WSMessage);
      } catch (error) {
        console.error('Invalid barathon websocket payload', error);
      }
    };

    activeBarathonSocket.onerror = (error) => {
      console.error('Barathon websocket error', error);
    };

    activeBarathonSocket.onclose = () => {
      if (barathonPingInterval) {
        clearInterval(barathonPingInterval);
        barathonPingInterval = null;
      }
      onClose?.();

      if (!barathonExplicitClose) {
        const delay = Math.min(1000 * Math.pow(1.5, barathonRetryCount), 15000);
        barathonRetryCount++;
        barathonReconnectTimeout = setTimeout(() => {
          doConnect();
        }, delay);
      }
    };
  }

  doConnect();
  return activeBarathonSocket;
}

export function disconnectBarathonSocket() {
  barathonExplicitClose = true;
  if (barathonReconnectTimeout) {
    clearTimeout(barathonReconnectTimeout);
    barathonReconnectTimeout = null;
  }
  if (barathonPingInterval) {
    clearInterval(barathonPingInterval);
    barathonPingInterval = null;
  }
  if (activeBarathonSocket) {
    activeBarathonSocket.close();
    activeBarathonSocket = null;
  }
  barathonRetryCount = 0;
}

export function sendBarathonLocation(latitude: number, longitude: number) {
  if (activeBarathonSocket && activeBarathonSocket.readyState === WebSocket.OPEN) {
    try {
      activeBarathonSocket.send(
        JSON.stringify({
          type: 'UPDATE_LOCATION',
          latitude,
          longitude,
        })
      );
    } catch (e) {
      console.error('[WS][BARATHON] Error sending location:', e);
    }
  }
}
