import { useEffect, useState } from 'react';
import { 
  LiveKitRoom, 
  GridLayout, 
  ParticipantTile, 
  FocusLayout,
  FocusLayoutContainer,
  CarouselLayout,
  RoomAudioRenderer, 
  ControlBar,
  useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import type { Channel } from '@hearth/shared';
import { Volume2, MonitorPlay } from 'lucide-react';
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
        <div className="connecting-spinner">
          <MonitorPlay size={32} className="pulse-icon" />
          <p>Connecting to voice...</p>
        </div>
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
          options={{
            screenShareCaptureOptions: {
              resolution: { width: 1920, height: 1080, frameRate: 60 },
              audio: true
            }
          }}
        >
          <RoomContent />
          <RoomAudioRenderer />
          <div className="lk-controls-wrapper">
            <ControlBar 
              variation="minimal"
              controls={{ 
                microphone: true, 
                camera: false, 
                screenShare: true, 
                leave: true, 
                chat: false 
              }}
            />
          </div>
        </LiveKitRoom>
      </div>
    </div>
  );
}

function RoomContent() {
  const allTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.Microphone, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.ScreenShareAudio, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  // Separate screen share tracks from participant tracks
  const screenShareTracks = allTracks.filter(
    (t) => t.source === Track.Source.ScreenShare
  );

  const participantTracks = allTracks.filter(
    (t) => t.source === Track.Source.Camera || t.source === Track.Source.Microphone
  );

  // If someone is screen sharing, use a focused layout
  if (screenShareTracks.length > 0) {
    const focusTrack = screenShareTracks[0];

    return (
      <div className="voice-grid-wrapper presentation-mode">
        <div className="presentation-main">
          <FocusLayoutContainer className="presentation-focus">
            <FocusLayout trackRef={focusTrack} />
          </FocusLayoutContainer>
        </div>
        {participantTracks.length > 0 && (
          <div className="presentation-strip">
            <CarouselLayout 
              tracks={participantTracks} 
              orientation="vertical"
            >
              <ParticipantTile />
            </CarouselLayout>
          </div>
        )}
      </div>
    );
  }

  // Default: grid layout for audio-only
  return (
    <div className="voice-grid-wrapper">
      <GridLayout tracks={participantTracks} style={{ height: '100%', width: '100%' }}>
        <ParticipantTile />
      </GridLayout>
    </div>
  );
}
