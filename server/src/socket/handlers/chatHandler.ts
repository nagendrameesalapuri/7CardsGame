import { Server, Socket } from 'socket.io';
import { getActiveGame } from './gameHandler';
import { ChatMessage, GameState } from '../../../../shared/src/types';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_REACTIONS = ['👏', '🎉', '😂', '😱', '🔥', '💀', '🤯', '😎', '👀', '🙏'];

export function registerChatHandlers(io: Server, socket: Socket) {
  const userId: string = (socket as any).userId;
  const username: string = (socket as any).username;
  const avatar: string = (socket as any).avatar;

  socket.on('chat:send', (message: string) => {
    if (!message || typeof message !== 'string') return;
    const cleaned = message.trim().slice(0, 200);
    if (!cleaned) return;

    const msg: ChatMessage = {
      id: uuidv4(),
      playerId: userId,
      username,
      avatar,
      message: cleaned,
      type: 'chat',
      timestamp: new Date().toISOString(),
    };

    // Append to in-memory game state
    const game = getActiveGame(socket.data.roomCode);
    if (game) game.chatMessages.push(msg);

    io.to(socket.data.roomCode).emit('chat:received', msg);
  });

  socket.on('chat:reaction', (emoji: string) => {
    if (!ALLOWED_REACTIONS.includes(emoji)) return;

    const msg: ChatMessage = {
      id: uuidv4(),
      playerId: userId,
      username,
      avatar,
      message: emoji,
      type: 'reaction',
      timestamp: new Date().toISOString(),
    };

    io.to(socket.data.roomCode).emit('chat:received', msg);
  });
}
