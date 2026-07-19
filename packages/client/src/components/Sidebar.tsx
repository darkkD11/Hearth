import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Hash, Volume2, Power, Flame } from 'lucide-react';
import type { Channel } from '@hearth/shared';
import './Sidebar.css';

interface SidebarProps {
  channels: Channel[];
  activeChannelId: string | null;
  onChannelSelect: (channelId: string) => void;
}

export function Sidebar({ channels, activeChannelId, onChannelSelect }: SidebarProps) {
  const { user, server, logout } = useAuth();
  const { isConnected } = useSocket();

  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceChannels = channels.filter((c) => c.type === 'voice');

  return (
    <aside className="sidebar">
      {/* Server header */}
      <div className="sidebar-header">
        <div className="server-name-row">
          <span className="server-icon" style={{ display: 'flex', color: '#f59e0b' }}><Flame size={20} /></span>
          <h2 className="server-name">{server?.name || 'Hearth'}</h2>
        </div>
        <div className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`}
             title={isConnected ? 'Connected' : 'Reconnecting...'} />
      </div>

      {/* Channel list */}
      <nav className="channel-list">
        {textChannels.length > 0 && (
          <div className="channel-group">
            <div className="channel-group-header">
              <span className="channel-group-label">Text Channels</span>
            </div>
            {textChannels.map((channel) => (
              <button
                key={channel.id}
                className={`channel-item ${activeChannelId === channel.id ? 'active' : ''}`}
                onClick={() => onChannelSelect(channel.id)}
              >
                <span className="channel-icon" style={{ display: 'flex' }}><Hash size={18} /></span>
                <span className="channel-name">{channel.name}</span>
              </button>
            ))}
          </div>
        )}

        {voiceChannels.length > 0 && (
          <div className="channel-group">
            <div className="channel-group-header">
              <span className="channel-group-label">Voice Channels</span>
            </div>
            {voiceChannels.map((channel) => (
              <button
                key={channel.id}
                className={`channel-item voice ${activeChannelId === channel.id ? 'active' : ''}`}
                onClick={() => onChannelSelect(channel.id)}
              >
                <span className="channel-icon" style={{ display: 'flex' }}><Volume2 size={18} /></span>
                <span className="channel-name">{channel.name}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* User panel */}
      <div className="user-panel">
        <div className="user-panel-info">
          <div className="avatar-wrapper">
            <div className="avatar avatar-sm">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className={`status-indicator ${user?.status || 'offline'}`} />
          </div>
          <div className="user-panel-details">
            <span className="user-panel-name">{user?.display_name || user?.username}</span>
            <span className="user-panel-status">
              {isConnected ? (user?.status || 'Online') : 'Reconnecting...'}
            </span>
          </div>
        </div>
        <button className="btn-ghost btn-sm user-panel-logout" onClick={logout} title="Log out" style={{ display: 'flex' }}>
          <Power size={18} />
        </button>
      </div>
    </aside>
  );
}
