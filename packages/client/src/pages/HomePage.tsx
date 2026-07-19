import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useChannels } from '../hooks/useChannels';
import { Sidebar } from '../components/Sidebar';
import { ChatView } from '../components/ChatView';
import { VoiceChat } from '../components/VoiceChat';
import { MemberList } from '../components/MemberList';
import './HomePage.css';

export function HomePage() {
  const { server } = useAuth();
  const { socket } = useSocket();
  const { channels } = useChannels(server?.id ?? null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(true);

  // Auto-select first text channel
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      const firstText = channels.find((c) => c.type === 'text');
      if (firstText) {
        setActiveChannelId(firstText.id);
      }
    }
  }, [channels, activeChannelId]);

  // Join/leave socket rooms when channel changes
  useEffect(() => {
    if (!socket || !activeChannelId) return;

    socket.emit('channel:join', activeChannelId);

    return () => {
      socket.emit('channel:leave', activeChannelId);
    };
  }, [socket, activeChannelId]);

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;

  const handleDisconnectVoice = () => {
    const firstText = channels.find((c) => c.type === 'text');
    if (firstText) {
      setActiveChannelId(firstText.id);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        channels={channels}
        activeChannelId={activeChannelId}
        onChannelSelect={setActiveChannelId}
      />
      <div className="app-main">
        {activeChannel?.type === 'voice' ? (
          <VoiceChat 
            channel={activeChannel} 
            onDisconnect={handleDisconnectVoice} 
          />
        ) : (
          <ChatView
            channel={activeChannel}
            showMembers={showMembers}
            onToggleMembers={() => setShowMembers((s) => !s)}
          />
        )}
      </div>
      {showMembers && (
        <MemberList serverId={server?.id ?? null} />
      )}
    </div>
  );
}
