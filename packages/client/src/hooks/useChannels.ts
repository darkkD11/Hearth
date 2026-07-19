import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useSocket } from '../contexts/SocketContext';
import type { Channel } from '@hearth/shared';

export function useChannels(serverId: string | null) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { socket } = useSocket();

  // Load channels on mount
  useEffect(() => {
    if (!serverId) return;

    setIsLoading(true);
    api
      .get<{ channels: Channel[] }>(`/servers/${serverId}/channels`)
      .then(({ channels }) => setChannels(channels))
      .catch((err) => console.error('[useChannels] Failed to load:', err))
      .finally(() => setIsLoading(false));
  }, [serverId]);

  // Listen for real-time channel updates
  useEffect(() => {
    if (!socket) return;

    const handleCreated = (channel: Channel) => {
      setChannels((prev) => [...prev, channel]);
    };

    const handleUpdated = (channel: Channel) => {
      setChannels((prev) =>
        prev.map((c) => (c.id === channel.id ? channel : c))
      );
    };

    const handleDeleted = (channelId: string) => {
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
    };

    socket.on('channel:created', handleCreated);
    socket.on('channel:updated', handleUpdated);
    socket.on('channel:deleted', handleDeleted);

    return () => {
      socket.off('channel:created', handleCreated);
      socket.off('channel:updated', handleUpdated);
      socket.off('channel:deleted', handleDeleted);
    };
  }, [socket]);

  return { channels, isLoading };
}
