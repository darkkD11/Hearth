import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { sendDesktopNotification } from '../lib/notifications';
import type { Message, PaginatedMessages } from '@hearth/shared';

export function useMessages(channelId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();
  const loadedChannelRef = useRef<string | null>(null);

  // Load initial messages when channel changes
  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      return;
    }

    // Don't reload if we already have this channel loaded
    if (loadedChannelRef.current === channelId && messages.length > 0) {
      return;
    }

    setIsLoading(true);
    loadedChannelRef.current = channelId;

    api
      .get<PaginatedMessages>(`/channels/${channelId}/messages?limit=50`)
      .then(({ messages: msgs, has_more }) => {
        setMessages(msgs);
        setHasMore(has_more);
      })
      .catch((err) => {
        console.error('[useMessages] Failed to load messages:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [channelId]);

  // Listen for new messages via socket
  useEffect(() => {
    if (!socket || !channelId) return;

    const handleNewMessage = (message: Message) => {
      if (message.channel_id === channelId) {
        setMessages((prev) => [...prev, message]);

        // Fire desktop notification if the message is from someone else
        if (message.author_id !== user?.id) {
          const authorName = message.author?.display_name || message.author?.username || 'Someone';
          sendDesktopNotification(
            `${authorName}`,
            message.content.length > 100 ? message.content.slice(0, 100) + '...' : message.content
          );
        }
      }
    };

    const handleMessageUpdated = (message: Message) => {
      if (message.channel_id === channelId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? message : m))
        );
      }
    };

    const handleMessageDeleted = (data: { message_id: string; channel_id: string }) => {
      if (data.channel_id === channelId) {
        setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:updated', handleMessageUpdated);
    socket.on('message:deleted', handleMessageDeleted);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:updated', handleMessageUpdated);
      socket.off('message:deleted', handleMessageDeleted);
    };
  }, [socket, channelId]);

  // Load older messages (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!channelId || !hasMore || isLoading || messages.length === 0) return;

    setIsLoading(true);
    try {
      const oldestId = messages[0].id;
      const { messages: olderMessages, has_more } = await api.get<PaginatedMessages>(
        `/channels/${channelId}/messages?before=${oldestId}&limit=50`
      );
      setMessages((prev) => [...olderMessages, ...prev]);
      setHasMore(has_more);
    } catch (err) {
      console.error('[useMessages] Failed to load more:', err);
    } finally {
      setIsLoading(false);
    }
  }, [channelId, hasMore, isLoading, messages]);

  const sendMessage = useCallback(
    (content: string, attachments?: any[]) => {
      if (!socket || !channelId) return;

      socket.emit('message:send', { channel_id: channelId, content, attachments }, (response) => {
        if (!response.success) {
          console.error('[useMessages] Send failed:', response.error);
        }
      });
    },
    [socket, channelId]
  );

  const editMessage = useCallback((messageId: string, content: string) => {
    if (!socket || !channelId) return;
    socket.emit('message:edit', { message_id: messageId, channel_id: channelId, content }, (res) => {
      if (!res.success) console.error('[useMessages] Edit failed:', res.error);
    });
  }, [socket, channelId]);

  const deleteMessage = useCallback((messageId: string) => {
    if (!socket || !channelId) return;
    socket.emit('message:delete', { message_id: messageId, channel_id: channelId }, (res) => {
      if (!res.success) console.error('[useMessages] Delete failed:', res.error);
    });
  }, [socket, channelId]);

  const reactMessage = useCallback((messageId: string, emoji: string) => {
    if (!socket || !channelId) return;
    socket.emit('message:react', { message_id: messageId, channel_id: channelId, emoji }, (res) => {
      if (!res.success) console.error('[useMessages] React failed:', res.error);
    });
  }, [socket, channelId]);

  const unreactMessage = useCallback((messageId: string, emoji: string) => {
    if (!socket || !channelId) return;
    socket.emit('message:unreact', { message_id: messageId, channel_id: channelId, emoji }, (res) => {
      if (!res.success) console.error('[useMessages] Unreact failed:', res.error);
    });
  }, [socket, channelId]);

  return { messages, isLoading, hasMore, loadMore, sendMessage, editMessage, deleteMessage, reactMessage, unreactMessage };
}
