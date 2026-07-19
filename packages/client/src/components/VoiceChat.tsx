import { useEffect, useState } from 'react';
import { 
  LiveKitRoom, 
  GridLayout, 
  ParticipantTile, 
  RoomAudioRenderer, 
  ControlBar,
  useTracks
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import type { Channel } from '@hearth/shared';
import { Volume2 } from 'lucide-react';
import { api } from '../lib/api';
import './VoiceChat.css';

interface VoiceChatProps {
  channel: Channel;
  onDisconnect: () => void;
}

export function VoiceChat({ channel, onDisconnect }: VoiceChatProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchToken = async () => {
      try {
        const res = await api.get<{ token: string; url: string }>(`/livekit/token?channelId=${channel.id}`);
        if (!mounted) return;
        setToken(res.token);
        setServerUrl(res.url);
      } catch (err) {
        console.error('Failed to fetch LiveKit token:', err);
        setError('Failed to connect to voice channel.');
      }
    };
    fetchToken();
    return () => { mounted = false; };
  }, [channel.id]);

  if (error) {
    return (
      <div className="voice-chat-container flex-center">
        <div className="voice-error">
          <p>{error}</p>
          <button className="btn mt-4" onClick={onDisconnect}>Leave Channel</button>
        </div>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="voice-chat-container flex-center">
        <p>Connecting to voice...</p>
      </div>
    );
  }

  return (
    <div className="voice-chat-container">
      <div className="voice-chat-header">
        <span className="voice-chat-icon"><Volume2 size={24} /></span>
        <h3 className="voice-chat-title">{channel.name}</h3>
      </div>
      
      <div className="livekit-wrapper">
        <LiveKitRoom
          video={false}
          audio={true}
          token={token}
          serverUrl={serverUrl}
          onDisconnected={onDisconnect}
          className="lk-hearth-theme"
        >
          <RoomView />
          <RoomAudioRenderer />
          <div className="lk-controls-wrapper">
            <ControlBar 
              controls={{ microphone: true, camera: false, screenShare: false, leave: true, chat: false }}
            />
          </div>
        </LiveKitRoom>
      </div>
    </div>
  );
}

function RoomView() {
  // Request all active camera and microphone tracks to render participants
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.Microphone, withPlaceholder: true }
    ],
    { onlySubscribed: false }
  );

  return (
    <div className="voice-grid-wrapper">
      <GridLayout tracks={tracks} style={{ height: '100%', width: '100%' }}>
        <ParticipantTile />
      </GridLayout>
    </div>
  );
}
