/**
 * useVoiceChat — WebRTC voice chat hook.
 *
 * Flow (full mesh, each peer connects to every other):
 *  1. joinVoice() → getUserMedia → emit voice:join
 *  2. Server replies voice:peers (existing list) → create offer for each
 *  3. Server fires voice:peer_joined (new arrivals after us) → they create offer to us
 *  4. Offer received → create answer → ICE exchange → audio plays
 *
 * Speaking detection uses AudioContext AnalyserNode on both local and remote streams.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { getSocket, on } from '../services/socket';

// Public STUN servers — fine for LAN / most home networks.
// Add TURN credentials here for symmetric-NAT support in production.
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const SPEAKING_THRESHOLD = 12; // 0–255 RMS threshold
const SPEAKING_POLL_MS = 80;

export type VoicePermissionError = 'denied' | 'not_found' | 'unavailable' | null;

export interface VoiceParticipant {
  userId: string;
  username: string;
  isSpeaking: boolean;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement | null;
  analyser: AnalyserNode | null;
  audioCtx: AudioContext | null;
}

function computeRms(analyser: AnalyserNode): number {
  const buf = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length) * 100;
}

function makeAnalyser(ctx: AudioContext, stream: MediaStream): AnalyserNode {
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  src.connect(analyser);
  return analyser;
}

export function useVoiceChat() {
  const [isInVoice, setIsInVoice] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [permissionError, setPermissionError] = useState<VoicePermissionError>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerEntry>>(new Map());
  // userId → username for all voice participants (excluding self)
  const peerNamesRef = useRef<Map<string, string>>(new Map());
  const speakingRef = useRef<Map<string, boolean>>(new Map());
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const localAudioCtxRef = useRef<AudioContext | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Participant list sync ─────────────────────────────────────────────────

  const syncParticipants = useCallback(() => {
    const list: VoiceParticipant[] = [];
    peerNamesRef.current.forEach((username, userId) => {
      list.push({ userId, username, isSpeaking: speakingRef.current.get(userId) ?? false });
    });
    setParticipants(list);
  }, []);

  // ── Speaking poll ─────────────────────────────────────────────────────────

  const startSpeakingPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      // Local speaking
      if (localAnalyserRef.current) {
        const rms = computeRms(localAnalyserRef.current);
        setIsSpeaking(rms > SPEAKING_THRESHOLD);
      }
      // Remote speaking
      let changed = false;
      peersRef.current.forEach((entry, userId) => {
        if (!entry.analyser) return;
        const rms = computeRms(entry.analyser);
        const speaking = rms > SPEAKING_THRESHOLD;
        if (speakingRef.current.get(userId) !== speaking) {
          speakingRef.current.set(userId, speaking);
          changed = true;
        }
      });
      if (changed) syncParticipants();
    }, SPEAKING_POLL_MS);
  }, [syncParticipants]);

  // ── Create peer connection ────────────────────────────────────────────────

  const createPeer = useCallback((targetUserId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_CONFIG);

    // Add local tracks to the connection
    localStreamRef.current?.getTracks().forEach(track =>
      pc.addTrack(track, localStreamRef.current!)
    );

    // Forward ICE candidates via signaling
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        getSocket().emit('voice:ice_candidate', {
          targetUserId,
          candidate: candidate.toJSON(),
        });
      }
    };

    // Play remote audio when tracks arrive
    pc.ontrack = ({ streams }) => {
      const stream = streams[0];
      if (!stream) return;

      const audio = new Audio();
      audio.srcObject = stream;
      audio.autoplay = true;
      audio.volume = 1;
      // Silence the audio if tab is background — let browser decide
      audio.play().catch(() => {});

      // Remote speaking detection
      const ctx = new AudioContext();
      const analyser = makeAnalyser(ctx, stream);

      const entry = peersRef.current.get(targetUserId);
      if (entry) {
        entry.audioEl = audio;
        entry.analyser = analyser;
        entry.audioCtx = ctx;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        // Peer dropped — clean up their entry
        const entry = peersRef.current.get(targetUserId);
        if (entry) {
          entry.audioEl && (entry.audioEl.srcObject = null);
          entry.audioCtx?.close().catch(() => {});
          entry.pc.close();
          peersRef.current.delete(targetUserId);
        }
        peerNamesRef.current.delete(targetUserId);
        speakingRef.current.delete(targetUserId);
        syncParticipants();
      }
    };

    return pc;
  }, [syncParticipants]);

  // ── Initiate offer to an existing peer ───────────────────────────────────

  const callPeer = useCallback(async (targetUserId: string) => {
    const pc = createPeer(targetUserId);
    peersRef.current.set(targetUserId, { pc, audioEl: null, analyser: null, audioCtx: null });

    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      getSocket().emit('voice:offer', { targetUserId, offer });
    } catch (err) {
      console.error('[Voice] createOffer failed', err);
      pc.close();
      peersRef.current.delete(targetUserId);
    }
  }, [createPeer]);

  // ── Handle incoming offer ─────────────────────────────────────────────────

  const handleOffer = useCallback(async (
    fromUserId: string,
    offer: RTCSessionDescriptionInit,
  ) => {
    // Create the peer if it doesn't already exist (may arrive before peer_joined)
    if (!peersRef.current.has(fromUserId)) {
      const pc = createPeer(fromUserId);
      peersRef.current.set(fromUserId, { pc, audioEl: null, analyser: null, audioCtx: null });
    }
    const entry = peersRef.current.get(fromUserId)!;
    const pc = entry.pc;

    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket().emit('voice:answer', { targetUserId: fromUserId, answer });
    } catch (err) {
      console.error('[Voice] handleOffer failed', err);
    }
  }, [createPeer]);

  // ── Cleanup all voice resources ───────────────────────────────────────────

  const cleanupAll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

    peersRef.current.forEach(entry => {
      try {
        entry.audioEl && (entry.audioEl.srcObject = null);
        entry.audioCtx?.close();
        entry.pc.close();
      } catch (_) {}
    });
    peersRef.current.clear();

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    localAudioCtxRef.current?.close().catch(() => {});
    localAudioCtxRef.current = null;
    localAnalyserRef.current = null;

    peerNamesRef.current.clear();
    speakingRef.current.clear();
    setParticipants([]);
    setIsSpeaking(false);
    setIsMuted(false);
    setIsInVoice(false);
    setIsJoining(false);
  }, []);

  // ── Public: join voice ────────────────────────────────────────────────────

  const joinVoice = useCallback(async () => {
    if (isInVoice || isJoining) return;
    setPermissionError(null);
    setIsJoining(true);

    try {
      // Pre-check permission state — catches the "previously denied" case on Android
      // where getUserMedia throws immediately without showing a dialog.
      if (navigator.permissions) {
        try {
          const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (perm.state === 'denied') {
            setPermissionError('denied');
            setIsJoining(false);
            return;
          }
        } catch (_) {
          // Permissions API unsupported in this browser — fall through to getUserMedia
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // Set up local speaking detection
      const ctx = new AudioContext();
      localAudioCtxRef.current = ctx;
      localAnalyserRef.current = makeAnalyser(ctx, stream);

      getSocket().emit('voice:join');
      setIsInVoice(true);
      startSpeakingPoll();
    } catch (err: any) {
      const name: string = err?.name ?? '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setPermissionError('denied');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setPermissionError('not_found');
      } else {
        setPermissionError('unavailable');
      }
      console.error('[Voice] getUserMedia failed:', err);
    } finally {
      setIsJoining(false);
    }
  }, [isInVoice, isJoining, startSpeakingPoll]);

  // ── Public: leave voice ───────────────────────────────────────────────────

  const leaveVoice = useCallback(() => {
    getSocket().emit('voice:leave');
    cleanupAll();
  }, [cleanupAll]);

  // ── Public: mute / unmute ─────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  }, []);

  // ── Socket event subscriptions ────────────────────────────────────────────

  useEffect(() => {
    const unsubs = [
      // Existing peers list when we first join (we call each of them)
      on('voice:peers', (peers) => {
        peers.forEach(({ userId, username }) => {
          peerNamesRef.current.set(userId, username);
          callPeer(userId);
        });
        syncParticipants();
      }),

      // New peer joined after us (they will call us — just register their name)
      on('voice:peer_joined', ({ userId, username }) => {
        peerNamesRef.current.set(userId, username);
        syncParticipants();
      }),

      // Peer left voice
      on('voice:peer_left', ({ userId }) => {
        const entry = peersRef.current.get(userId);
        if (entry) {
          entry.audioEl && (entry.audioEl.srcObject = null);
          entry.audioCtx?.close().catch(() => {});
          entry.pc.close();
          peersRef.current.delete(userId);
        }
        peerNamesRef.current.delete(userId);
        speakingRef.current.delete(userId);
        syncParticipants();
      }),

      // Incoming WebRTC offer
      on('voice:offer', ({ fromUserId, offer }) => {
        handleOffer(fromUserId, offer as RTCSessionDescriptionInit);
      }),

      // Incoming WebRTC answer
      on('voice:answer', ({ fromUserId, answer }) => {
        const entry = peersRef.current.get(fromUserId);
        if (entry) {
          entry.pc.setRemoteDescription(answer as RTCSessionDescriptionInit).catch(e =>
            console.error('[Voice] setRemoteDescription answer failed', e)
          );
        }
      }),

      // Incoming ICE candidate
      on('voice:ice_candidate', ({ fromUserId, candidate }) => {
        const entry = peersRef.current.get(fromUserId);
        if (entry) {
          entry.pc.addIceCandidate(new RTCIceCandidate(candidate as RTCIceCandidateInit)).catch(e =>
            console.error('[Voice] addIceCandidate failed', e)
          );
        }
      }),
    ];

    return () => { unsubs.forEach(fn => fn()); };
  }, [callPeer, handleOffer, syncParticipants]);

  // Clean up when hook unmounts (e.g. navigating away from game)
  useEffect(() => () => { if (isInVoice) cleanupAll(); }, []);

  return {
    isInVoice,
    isJoining,
    isMuted,
    isSpeaking,
    participants,
    permissionError,
    joinVoice,
    leaveVoice,
    toggleMute,
  };
}
