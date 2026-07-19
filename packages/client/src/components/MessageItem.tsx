import { useState } from 'react';
import type { Message, Reaction } from '@hearth/shared';
import { useAuth } from '../contexts/AuthContext';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { SmilePlus, Pencil, Trash2 } from 'lucide-react';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
  isGrouped: boolean;
  canManage?: boolean;
  onEdit?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
  onReact?: (id: string, emoji: string) => void;
  onUnreact?: (id: string, emoji: string) => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday =
    new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today at ${time}`;
  if (isYesterday) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString()} ${time}`;
}

export function MessageItem({ message, isGrouped, canManage, onEdit, onDelete, onReact, onUnreact }: MessageItemProps) {
  const { user } = useAuth();
  const author = message.author;
  const initial = author?.username?.charAt(0).toUpperCase() || '?';
  const isAuthor = user?.id === message.author_id;

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleEditSave = () => {
    if (editContent.trim() && editContent !== message.content) {
      onEdit?.(message.id, editContent);
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleEmojiSelect = (emoji: any) => {
    setShowEmojiPicker(false);
    onReact?.(message.id, emoji.native);
  };

  const toggleReaction = (emoji: string, hasReacted: boolean) => {
    if (hasReacted) {
      onUnreact?.(message.id, emoji);
    } else {
      onReact?.(message.id, emoji);
    }
  };

  // Group reactions by emoji
  const groupedReactions = (message.reactions || []).reduce((acc: Record<string, { count: number, hasReacted: boolean }>, reaction: Reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = { count: 0, hasReacted: false };
    }
    acc[reaction.emoji].count += 1;
    if (reaction.user_id === user?.id) {
      acc[reaction.emoji].hasReacted = true;
    }
    return acc;
  }, {});

  const renderContent = () => {
    if (isEditing) {
      return (
        <div className="message-edit-container">
          <textarea
            className="message-edit-input"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleEditSave();
              } else if (e.key === 'Escape') {
                handleEditCancel();
              }
            }}
            autoFocus
          />
          <div className="message-edit-actions">
            escape to <a onClick={handleEditCancel}>cancel</a> • enter to <a onClick={handleEditSave}>save</a>
          </div>
        </div>
      );
    }
    return <div className="message-content">{message.content}</div>;
  };

  const renderAttachments = () => {
    if (!message.attachments || message.attachments.length === 0) return null;
    return (
      <div className="message-attachments">
        {message.attachments.map((att) => (
          <div key={att.id || att.url} className="message-attachment">
            <img src={att.url} alt="attachment" />
          </div>
        ))}
      </div>
    );
  };

  const renderReactions = () => {
    const entries = Object.entries(groupedReactions);
    if (entries.length === 0) return null;

    return (
      <div className="message-reactions">
        {entries.map(([emoji, { count, hasReacted }]) => (
          <button
            key={emoji}
            className={`reaction-btn ${hasReacted ? 'active' : ''}`}
            onClick={() => toggleReaction(emoji, hasReacted)}
            title={`React with ${emoji}`}
          >
            <span className="reaction-emoji">{emoji}</span>
            <span className="reaction-count">{count}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderActionsMenu = () => {
    return (
      <div className="message-actions-menu">
        <button
          className="message-action-btn"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="Add Reaction"
        >
          <SmilePlus size={16} />
        </button>
        
        {isAuthor && (
          <button className="message-action-btn" onClick={() => setIsEditing(true)} title="Edit Message">
            <Pencil size={14} />
          </button>
        )}
        
        {(isAuthor || canManage) && (
          <button className="message-action-btn danger" onClick={() => onDelete?.(message.id)} title="Delete Message">
            <Trash2 size={14} />
          </button>
        )}
        
        {showEmojiPicker && (
          <div className="react-popover">
            <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="dark" onClickOutside={() => setShowEmojiPicker(false)} />
          </div>
        )}
      </div>
    );
  };

  if (isGrouped) {
    return (
      <div className="message-item grouped">
        <span className="message-time-hover">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <div className="message-body">
          {renderContent()}
          {renderAttachments()}
          {renderReactions()}
        </div>
        {!isEditing && renderActionsMenu()}
      </div>
    );
  }

  return (
    <div className="message-item animate-fade-in">
      <div className="avatar-wrapper">
        <div className="avatar">
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt={author.username} />
          ) : (
            initial
          )}
        </div>
      </div>
      <div className="message-body">
        <div className="message-header">
          <span
            className="message-author"
            style={{ color: '#c9a0ff' }}
          >
            {author?.display_name || author?.username || 'Unknown'}
          </span>
          <span className="message-timestamp">{formatTime(message.created_at)}</span>
          {message.edited_at && (
            <span className="message-edited">(edited)</span>
          )}
        </div>
        {renderContent()}
        {renderAttachments()}
        {renderReactions()}
      </div>
      {!isEditing && renderActionsMenu()}
    </div>
  );
}
