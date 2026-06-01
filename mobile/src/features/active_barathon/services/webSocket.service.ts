let userSocket: WebSocket | null = null;
let activeBarathonSocket: WebSocket | null = null;
import { WSMessage } from '../types/webSocker.types';
export { WSMessage };

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

  const url = buildWsUrl('/ws/me', token, apiBaseUrl);
  userSocket = new WebSocket(url);

  userSocket.onopen = () => {
    onOpen?.();
  };

  userSocket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data) as WSMessage;
      onMessage(parsed);
    } catch (error) {
      console.error('Invalid user websocket payload', error);
    }
  };

  userSocket.onerror = (error) => {
    console.error('User websocket error', error);
  };

  userSocket.onclose = () => {
    onClose?.();
  };

  return userSocket;
}

export function disconnectUserSocket() {
  if (userSocket) {
    userSocket.close();
    userSocket = null;
  }
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

  const url = buildWsUrl(`/ws/barathons/${barathonId}`, token, apiBaseUrl);
  activeBarathonSocket = new WebSocket(url);

  activeBarathonSocket.onopen = () => {
    onOpen?.();
  };

  activeBarathonSocket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data) as WSMessage;
      onMessage(parsed);
    } catch (error) {
      console.error('Invalid barathon websocket payload', error);
    }
  };

  activeBarathonSocket.onerror = (error) => {
    console.error('Barathon websocket error', error);
  };

  activeBarathonSocket.onclose = () => {
    onClose?.();
  };

  return activeBarathonSocket;
}

export function disconnectBarathonSocket() {
  if (activeBarathonSocket) {
    activeBarathonSocket.close();
    activeBarathonSocket = null;
  }
}
