import { useRef, useEffect } from 'react';
import { useMessages } from '../hooks/useMessages';
import { MessageItem } from './MessageItem';
import { MessageInput } from './MessageInput';
import { Hash, Flame, Users } from 'lucide-react';
import type { Channel } from '@hearth/shared';
import './ChatView.css';

interface ChatViewProps {
  channel: Channel | null;
  showMembers: boolean;
  onToggleMembers: () => void;
}

export function ChatView({ channel, showMembers, onToggleMembers }: ChatViewProps) {
  const { messages, isLoading, hasMore, loadMore, sendMessage, editMessage, deleteMessage, reactMessage, unreactMessage } = useMessages(channel?.id ?? null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on channel switch
  useEffect(() => {
    if (channel) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView();
      }, 50);
    }
  }, [channel?.id]);

  // Load more on scroll to top
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container || !hasMore || isLoading) return;

    if (container.scrollTop < 100) {
      const prevHeight = container.scrollHeight;
      loadMore().then(() => {
        // Maintain scroll position after loading older messages
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight - prevHeight;
        });
      });
    }
  };

  if (!channel) {
    return (
      <div className="chat-view chat-empty">
        <div className="chat-empty-content animate-fade-in">
          <span className="chat-empty-icon" style={{ display: 'inline-flex', color: '#f59e0b' }}><Flame size={64} /></span>
          <h2>Welcome to Hearth</h2>
          <p>Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-view">
      {/* Chat header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-header-hash" style={{ display: 'flex', alignItems: 'center' }}><Hash size={24} /></span>
          <h3 className="chat-header-name">{channel.name}</h3>
        </div>
        <div className="chat-header-actions">
          <button
            className={`btn-ghost btn-sm chat-header-btn ${showMembers ? 'active' : ''}`}
            onClick={onToggleMembers}
            title="Toggle member list"
            style={{ display: 'flex' }}
          >
            <Users size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="chat-messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {hasMore && (
          <div className="chat-load-more">
            {isLoading ? (
              <div className="chat-loading">Loading...</div>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={loadMore}>
                Load older messages
              </button>
            )}
          </div>
        )}

        {messages.length === 0 && !isLoading && (
          <div className="chat-welcome animate-fade-in">
            <div className="chat-welcome-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Hash size={32} /></div>
            <h3>Welcome to #{channel.name}!</h3>
            <p>This is the beginning of the #{channel.name} channel.</p>
          </div>
        )}

        {messages.map((message, index) => {
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const isGrouped =
            prevMessage !== null &&
            prevMessage.author_id === message.author_id &&
            new Date(message.created_at).getTime() -
              new Date(prevMessage.created_at).getTime() <
              5 * 60 * 1000; // 5 min grouping window

          return (
            <MessageItem
              key={message.id}
              message={message}
              isGrouped={isGrouped}
              onEdit={editMessage}
              onDelete={deleteMessage}
              onReact={reactMessage}
              onUnreact={unreactMessage}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <MessageInput
        channelName={channel.name}
        onSend={sendMessage}
      />
    </div>
  );
}
