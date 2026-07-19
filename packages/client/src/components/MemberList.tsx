import { useMembers } from '../hooks/useMembers';
import { useAuth } from '../contexts/AuthContext';
import { LogOut } from 'lucide-react';
import './MemberList.css';

interface MemberListProps {
  serverId: string | null;
}

export function MemberList({ serverId }: MemberListProps) {
  const { onlineMembers, offlineMembers, isLoading, kickMember } = useMembers(serverId);
  const { user, server } = useAuth();

  // Determine if current user can kick
  const allMembers = [...onlineMembers, ...offlineMembers];
  const currentUserMember = allMembers.find(m => m.user_id === user?.id);
  const isOwner = server?.owner_id === user?.id;
  
  const currentUserPerms = currentUserMember?.roles?.reduce((acc, r) => acc | r.permissions, 0) || 0;
  // MANAGE_MEMBERS = 4, ADMINISTRATOR = 64
  const canKick = isOwner || !!(currentUserPerms & 4) || !!(currentUserPerms & 64);

  const handleKick = (userId: string, username?: string) => {
    if (window.confirm(`Are you sure you want to kick ${username}?`)) {
      kickMember(userId);
    }
  };

  if (isLoading) {
    return (
      <aside className="member-list">
        <div className="member-list-loading">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="member-skeleton">
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%' }} />
              <div className="skeleton" style={{ width: `${60 + Math.random() * 40}%`, height: 14, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="member-list">
      {onlineMembers.length > 0 && (
        <div className="member-group">
          <div className="member-group-header">
            Online — {onlineMembers.length}
          </div>
          {onlineMembers.map((member) => (
            <div key={member.user_id} className="member-item animate-fade-in">
              <div className="avatar-wrapper">
                <div className="avatar avatar-sm">
                  {member.user?.avatar_url ? (
                    <img src={member.user.avatar_url} alt={member.user.username} />
                  ) : (
                    member.user?.username?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className={`status-indicator ${member.user?.status || 'online'}`} />
              </div>
              <div className="member-info">
                <span
                  className="member-name"
                  style={{
                    color: member.roles?.[0]?.color || 'var(--text-primary)',
                  }}
                >
                  {member.nickname || member.user?.display_name || member.user?.username}
                </span>
              </div>
              {canKick && member.user_id !== server?.owner_id && member.user_id !== user?.id && (
                <button
                  className="kick-btn"
                  onClick={() => handleKick(member.user_id, member.user?.username)}
                  title={`Kick ${member.user?.username}`}
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {offlineMembers.length > 0 && (
        <div className="member-group">
          <div className="member-group-header">
            Offline — {offlineMembers.length}
          </div>
          {offlineMembers.map((member) => (
            <div key={member.user_id} className="member-item offline">
              <div className="avatar-wrapper">
                <div className="avatar avatar-sm">
                  {member.user?.avatar_url ? (
                    <img src={member.user.avatar_url} alt={member.user.username} />
                  ) : (
                    member.user?.username?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className="status-indicator offline" />
              </div>
              <div className="member-info">
                <span className="member-name">
                  {member.nickname || member.user?.display_name || member.user?.username}
                </span>
              </div>
              {canKick && member.user_id !== server?.owner_id && member.user_id !== user?.id && (
                <button
                  className="kick-btn"
                  onClick={() => handleKick(member.user_id, member.user?.username)}
                  title={`Kick ${member.user?.username}`}
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
