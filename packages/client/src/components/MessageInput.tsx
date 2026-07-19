import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { useSocket } from '../contexts/SocketContext';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Plus, Smile, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Attachment } from '@hearth/shared';
import './MessageInput.css';

interface MessageInputProps {
  channelName: string;
  onSend: (content: string, attachments?: Attachment[]) => void;
}

export function MessageInput({ channelName, onSend }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachmentPreview, setAttachmentPreview] = useState<{ file: File, url: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocket();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = content.trim();
    if (!trimmed && !attachmentPreview) return;

    let attachments: Attachment[] = [];
    
    if (attachmentPreview) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', attachmentPreview.file);
        
        const res = await api.post<{ url: string; fileType: string }>('/upload', formData);
        attachments.push({
          id: '', // Will be assigned by backend or not needed
          url: res.url,
          file_type: res.fileType
        });
      } catch (err) {
        console.error('Failed to upload file', err);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setContent('');
    setAttachmentPreview(null);
    setShowEmojiPicker(false);
    stopTyping();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const startTyping = () => {
    if (!isTypingRef.current && socket) {
      isTypingRef.current = true;
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 3000);
  };

  const stopTyping = () => {
    if (isTypingRef.current) isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    startTyping();
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  };

  const onEmojiSelect = (emoji: any) => {
    setContent((prev) => prev + emoji.native);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    setAttachmentPreview({ file, url });
    e.target.value = ''; // Reset input
  };

  const removeAttachment = () => {
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview.url);
    setAttachmentPreview(null);
  };

  return (
    <div className="message-input-container">
      <form className="message-input-form" onSubmit={handleSubmit}>
        <div className="message-input-wrapper">
          {attachmentPreview && (
            <div className="attachment-preview">
              <img src={attachmentPreview.url} alt="Attachment preview" />
              <button type="button" className="attachment-remove" onClick={removeAttachment} title="Remove attachment">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="message-actions">
            <button
              type="button"
              className="action-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
            >
              <Plus size={20} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              accept="image/*"
            />
          </div>

          <textarea
            ref={textareaRef}
            className="message-input"
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            rows={1}
            maxLength={4000}
            disabled={isUploading}
          />
          
          <div className="message-actions">
            <button
              type="button"
              className="action-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Select emoji"
            >
              <Smile size={20} />
            </button>
          </div>

          {showEmojiPicker && (
            <div className="emoji-picker-container">
              <Picker data={data} onEmojiSelect={onEmojiSelect} theme="dark" />
            </div>
          )}

          <button
            type="submit"
            className="message-send-btn"
            disabled={(!content.trim() && !attachmentPreview) || isUploading}
            title="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
