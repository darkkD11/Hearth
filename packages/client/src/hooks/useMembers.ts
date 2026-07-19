import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useSocket } from '../contexts/SocketContext';
import type { ServerMember, UserStatus } from '@hearth/shared';

export function useMembers(serverId: string | null) {
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { socket } = useSocket();

  // Load members on mount
  useEffect(() => {
    if (!serverId) return;

    setIsLoading(true);
    api
      .get<{ members: ServerMember[] }>(`/servers/${serverId}/members`)
      .then(({ members }) => setMembers(members))
      .catch((err) => console.error('[useMembers] Failed to load:', err))
      .finally(() => setIsLoading(false));
  }, [serverId]);

  // Listen for status changes
  useEffect(() => {
    if (!socket) return;

    const handleStatusChange = (data: { user_id: string; status: UserStatus }) => {
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === data.user_id && m.user
            ? { ...m, user: { ...m.user, status: data.status } }
            : m
        )
      );
    };

    const handleMemberJoined = (member: ServerMember) => {
      setMembers((prev) => [...prev, member]);
    };

    const handleMemberLeft = (userId: string) => {
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    };

    socket.on('user:status_changed', handleStatusChange);
    socket.on('member:joined', handleMemberJoined);
    socket.on('member:left', handleMemberLeft);

    return () => {
      socket.off('user:status_changed', handleStatusChange);
      socket.off('member:joined', handleMemberJoined);
      socket.off('member:left', handleMemberLeft);
    };
  }, [socket]);

  // Split into online and offline
  const onlineMembers = members.filter((m) => m.user?.status !== 'offline');
  const offlineMembers = members.filter((m) => m.user?.status === 'offline');

  const kickMember = async (userId: string) => {
    if (!serverId) return false;
    try {
      await api.post(`/servers/${serverId}/members/${userId}/kick`);
      // The socket event member:left will handle removing them from the UI,
      // but we can also optimistically remove them
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      return true;
    } catch (err) {
      console.error('[useMembers] Kick failed:', err);
      return false;
    }
  };

  return { members, onlineMembers, offlineMembers, isLoading, kickMember };
}
