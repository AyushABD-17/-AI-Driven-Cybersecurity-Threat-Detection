import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useAlertStore from '../stores/alertStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function useSocket() {
  const socketRef = useRef(null);
  const { setConnectionStatus, addAlert, updateStats } = useAlertStore();

  useEffect(() => {
    // In a real app we'd get this from an auth store
    const token = localStorage.getItem('token') || 'dummy-dev-token-replace-me';

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('🔌 Connected to threat feed:', socket.id);
      setConnectionStatus(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from threat feed');
      setConnectionStatus(false);
    });

    // Handle high-priority threats mapped to real-time feed
    socket.on('threat:alert', (alertData) => {
      addAlert(alertData);
    });

    // Handle background summary updates
    socket.on('stats:update', (stats) => {
      updateStats(stats);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [setConnectionStatus, addAlert, updateStats]);

  return socketRef.current;
}
