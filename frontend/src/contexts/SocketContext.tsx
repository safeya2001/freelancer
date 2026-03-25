import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';
import axios from 'axios';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  onlineUsers: Set<string>;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false, onlineUsers: new Set() });

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/**
 * Returns the Socket.IO server base URL.
 *
 * Priority:
 *  1. NEXT_PUBLIC_SOCKET_URL env var — set this in .env.local for local dev
 *     (e.g. http://localhost:3001) to reach the backend directly.
 *  2. window.location.origin — correct in production where nginx proxies
 *     /socket.io/* to the backend on the same domain.
 */
function getSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3001';
}

/** Refresh the access token. Returns true on success, false on failure. */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const refreshToken = Cookies.get('refresh_token');
    const { data } = await axios.post(
      `${BASE_URL}/auth/refresh`,
      refreshToken ? { refresh_token: refreshToken } : {},
      { withCredentials: true },
    );
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if (data.data?.access_token) {
      Cookies.set('access_token', data.data.access_token, { expires: 1 / 96, secure: isSecure, sameSite: 'strict' });
    }
    if (data.data?.refresh_token) {
      Cookies.set('refresh_token', data.data.refresh_token, { expires: 7, secure: isSecure, sameSite: 'strict' });
    }
    return !!data.data?.access_token;
  } catch {
    return false;
  }
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const { isAuthenticated } = useAuth();
  // Track the socket in a ref so the disconnect handler can access it without stale closure
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    // Require an initial token to create the socket
    const initialToken = Cookies.get('access_token');
    if (!initialToken) return;

    const s = io(`${getSocketUrl()}/chat`, {
      // Callback form — called on every reconnection attempt, picks up the latest cookie
      auth: (cb) => { cb({ token: Cookies.get('access_token') }); },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    });

    socketRef.current = s;

    s.on('connect', () => setConnected(true));

    s.on('disconnect', async (reason) => {
      setConnected(false);
      // 'io server disconnect' means the server explicitly closed the connection.
      // This happens when the JWT expires — Socket.IO does NOT auto-reconnect in
      // this case, so we must refresh the token and reconnect manually.
      if (reason === 'io server disconnect') {
        const ok = await refreshAccessToken();
        if (ok) {
          socketRef.current?.connect();
        }
      }
    });

    s.on('user_online', ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => new Set(prev).add(userId));
    });
    s.on('user_offline', ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => { const n = new Set(prev); n.delete(userId); return n; });
    });

    setSocket(s);
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket, connected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
