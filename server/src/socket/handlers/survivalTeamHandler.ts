import { Server, Socket } from 'socket.io';
import { SurvivalTeam } from '../../models/SurvivalTeam';
import { User } from '../../models/User';
import { Room } from '../../models/Room';
import { Transaction } from '../../models/Transaction';
import {
  TIER_CONFIG,
  TEAM_SURVIVAL_STAGES,
  SurvivalTier,
  BotPersonality,
} from '../../models/SurvivalTournament';
import { getAdminConfig } from '../../models/AdminConfig';
import {
  startRoomGame,
  getActiveGame,
  setBotPersonality,
  assignBotPersonalities,
} from './gameHandler';
import { GameState } from '../../../../shared/src/types';
import { getBadge } from '../../utils/badgeCache';

const POINTS_PER_RUPEE = 100;
function pointsToRupees(p: number) { return p / POINTS_PER_RUPEE; }

async function getEffectiveTierConfig(tier: SurvivalTier) {
  try {
    const adminCfg = await getAdminConfig();
    const sc = (adminCfg.survivalConfig as any)?.[tier];
    if (sc && typeof sc.entryPoints === 'number' && Array.isArray(sc.stageRewards) && sc.stageRewards.length === 5) {
      return { entryPoints: sc.entryPoints, label: TIER_CONFIG[tier].label, stageRewards: sc.stageRewards as number[] };
    }
  } catch { /* fall through */ }
  return TIER_CONFIG[tier];
}

/**
 * Build the full interleaved room player list for a team stage, including enemy bots.
 * Seat order: host → enemy[0] → allyBot[0] → enemy[1] → nonHostHuman[0] → ...
 * This ensures no two same-team players sit side by side.
 * Returns ready-to-insert room player objects and the enemy bot userIds.
 */
function buildTeamRoomPlayers(
  humanMembers: any[],
  allyBotMembers: any[],
  stageConfig: typeof TEAM_SURVIVAL_STAGES[0],
  hostId: string,
  roomCode: string,
): { players: any[]; enemyBotUserIds: string[] } {
  const host    = humanMembers.find((m: any) => m.userId === hostId);
  const nonHost = humanMembers.filter((m: any) => m.userId !== hostId);

  const enemyEntries = stageConfig.botNames.map((name, i) => ({
    userId:   `stagebot_${roomCode}_${i + 1}`,
    username: name,
    avatar:   `bot_${stageConfig.personalities[i] ?? 'smart'}`,
    isReady:  true,
    isHost:   false,
    isBot:    true,
  }));

  const toRoomPlayer = (m: any): any => ({
    userId:   m.userId,
    username: m.username,
    avatar:   m.isBot ? `bot_${m.personality ?? 'smart'}` : (m.avatar ?? ''),
    isReady:  true,
    isHost:   m.userId === hostId,
    isBot:    !!m.isBot,
  });

  const ordered: any[] = [];
  if (host) ordered.push(toRoomPlayer(host));

  let ei = 0, ai = 0, ni = 0;
  while (ei < enemyEntries.length || ai < allyBotMembers.length || ni < nonHost.length) {
    if (ei < enemyEntries.length)    ordered.push(enemyEntries[ei++]);
    if (ai < allyBotMembers.length)  ordered.push(toRoomPlayer(allyBotMembers[ai++]));
    if (ni < nonHost.length)         ordered.push(toRoomPlayer(nonHost[ni++]));
  }

  return { players: ordered, enemyBotUserIds: enemyEntries.map(e => e.userId) };
}

function buildTeamPayload(team: any, entryPoints: number) {
  return {
    teamCode: team.teamCode,
    hostId: team.hostId,
    tier: team.tier,
    entryFeeMode: team.entryFeeMode,
    maxSize: team.maxSize,
    members: (team.members ?? []).map((m: any) => ({
      userId: m.userId,
      username: m.username,
      avatar: m.avatar,
      isBot: m.isBot ?? false,
      personality: m.personality ?? null,
    })),
    status: team.status,
    currentStage: team.currentStage,
    currentRoomCode: team.currentRoomCode ?? null,
    stageResults: team.stageResults ?? [],
    totalPointsEarned: team.totalPointsEarned ?? 0,
    entryPoints,
  };
}

function emitGameStateToMember(socket: Socket, game: any, userId: string) {
  const myPlayer = game.players.find((p: any) => p.userId === userId);
  socket.emit('game:state', {
    id: game.id,
    roomId: game.roomId,
    status: game.status,
    players: game.players.map((p: any) => ({
      id: p.id, userId: p.userId, username: p.username, avatar: p.avatar,
      handCount: p.handCount, totalScore: p.totalScore, roundScore: p.roundScore,
      isConnected: p.isConnected, isEliminated: p.isEliminated,
      seatIndex: p.seatIndex, isBot: p.isBot,
      badge: p.isBot ? undefined : getBadge(p.userId),
    })),
    discardPile: game.discardPile,
    deckCount: game.deck.length,
    jokerRank: game.jokerRank,
    jokerCard: game.jokerCard,
    currentPlayerIndex: game.currentPlayerIndex,
    turnNumber: game.turnNumber,
    turnStartTime: game.turnStartTime,
    turnTimeLimit: game.turnTimeLimit,
    attackChain: game.attackChain,
    roundCount: game.roundCount,
    roundNumber: game.roundNumber,
    hasDrawnThisTurn: game.hasDrawnThisTurn,
    showPlayerId: game.showPlayerId,
    roundResult: game.roundResult,
    chatMessages: game.chatMessages,
    myHand: myPlayer?.hand ?? [],
    myPlayerId: myPlayer?.id ?? '',
  });
}

async function joinHumanMembersToRoom(io: Server, team: any, roomCode: string) {
  const humanMembers = (team.members ?? []).filter((m: any) => !m.isBot);
  for (const member of humanMembers) {
    const memberSocket = [...io.sockets.sockets.values()].find(
      s => (s as any).userId === member.userId,
    );
    if (memberSocket) {
      await memberSocket.join(roomCode);
      memberSocket.data = { ...memberSocket.data, roomCode };
    }
  }
}

async function startTeamRoom(io: Server, team: any, roomCode: string, stageConfig: typeof TEAM_SURVIVAL_STAGES[0]) {
  await joinHumanMembersToRoom(io, team, roomCode);
  await startRoomGame(io, roomCode);

  const game = getActiveGame(roomCode);
  if (!game) return;

  // Partition bots: team bots (ally) vs opponent bots (stage AI)
  const teamBotIds = new Set((team.members as any[]).filter((m: any) => m.isBot).map((m: any) => m.userId));
  const teamBotPersonalityMap = new Map<string, string>(
    (team.members as any[]).filter((m: any) => m.isBot).map((m: any) => [m.userId, m.personality ?? 'smart'])
  );
  const allBots = game.players.filter((p: any) => p.isBot);
  const allyBots = allBots.filter((b: any) => teamBotIds.has(b.userId));
  const opponentBots = allBots.filter((b: any) => !teamBotIds.has(b.userId));

  // Inject team groups for team-aware round scoring (show caller's team all get 0 on success, etc.)
  const teamMemberUserIds = (team.members as any[]).map((m: any) => m.userId);
  const opponentBotUserIds = opponentBots.map((b: any) => b.userId);
  (game as any).teamGroups = [teamMemberUserIds, opponentBotUserIds];

  // Assign personalities: ally bots get their chosen personality; opponent bots get stage personality
  assignBotPersonalities(game.id, [
    ...allyBots.map((b: any) => ({ userId: b.userId, personality: (teamBotPersonalityMap.get(b.userId) ?? 'smart') as BotPersonality })),
    ...opponentBots.map((b: any, i: number) => ({ userId: b.userId, personality: (stageConfig.personalities[i] ?? stageConfig.personalities[0]) as BotPersonality })),
  ]);

  const humanMembers = (team.members ?? []).filter((m: any) => !m.isBot);
  for (const member of humanMembers) {
    const memberSocket = [...io.sockets.sockets.values()].find(
      s => (s as any).userId === member.userId,
    );
    if (memberSocket) emitGameStateToMember(memberSocket, game, member.userId);
  }
}

// Called from survivalHandler.handleSurvivalMatchEnd for team rooms
export async function handleTeamSurvivalMatchEnd(io: Server, state: GameState, team: any) {
  try {
    const tierCfg = await getEffectiveTierConfig(team.tier);
    const stageIdx = team.currentStage - 1;
    const stageReward = tierCfg.stageRewards[stageIdx] ?? 0;
    const stageConfig = TEAM_SURVIVAL_STAGES.find(s => s.stage === team.currentStage)!;

    const getScore = (playerId: string): number => {
      if (state.roundResult) {
        const pr = (state.roundResult as any).playerResults?.find((r: any) => r.playerId === playerId);
        if (pr) return pr.totalScore;
      }
      return state.players.find(p => p.id === playerId)?.totalScore ?? 999;
    };

    // Team members (human + ally bots) vs stage AI opponent bots
    const teamMemberIds = new Set((team.members as any[]).map((m: any) => m.userId));
    const teamPlayers   = state.players.filter(p => teamMemberIds.has(p.userId));
    const opponentBots  = state.players.filter(p => !teamMemberIds.has(p.userId));

    const teamScore    = teamPlayers.reduce((sum, p) => sum + getScore(p.id), 0);
    const botScores    = opponentBots.map(b => getScore(b.id));
    const botTotalScore = botScores.reduce((s, v) => s + v, 0);

    const teamWon = teamScore < botTotalScore;

    const scoreboard = [
      { name: 'Your Team', score: teamScore, isTeam: true, isHuman: true },
      { name: 'AI Bots', score: botTotalScore, isTeam: false, isHuman: false },
    ].sort((a, b) => a.score - b.score);

    team.stageResults.push({
      stage: team.currentStage,
      teamScore,
      botTotalScore,
      botScores,
      botNames: stageConfig.botNames,
      teamWon,
      pointsEarned: teamWon ? stageReward : 0,
    });

    const teamRoom = `team:${team.teamCode}`;

    const payload: Record<string, any> = {
      stage:         team.currentStage,
      totalStages:   5,
      stageName:     stageConfig.name,
      stageDesc:     stageConfig.description,
      botNames:      stageConfig.botNames,
      teamScore,
      botScores,
      botTotalScore,
      scoreboard,
      teamWon,
      pointsEarned:  teamWon ? stageReward : 0,
      stageResults:  team.stageResults,
      isTeamMode:    true,
      entryFeeMode:  team.entryFeeMode,
    };

    if (!teamWon) {
      team.status = 'completed';
      team.currentRoomCode = null;
      team.completedAt = new Date();
      await team.save();
      payload.tournamentOver = true;
      payload.won = false;
      payload.totalPointsEarned = team.totalPointsEarned;
      io.to(teamRoom).emit('survival:team_stage_result', payload);
      return;
    }

    // ── Credit stage reward based on fee mode ──────────────────────────────────
    const humanTeamMembers = (team.members as any[]).filter(m => !m.isBot);

    if (team.entryFeeMode === 'split') {
      // Split equally among human members only
      const perMember = humanTeamMembers.length > 0 ? Math.floor(stageReward / humanTeamMembers.length) : 0;
      const rupees = pointsToRupees(perMember);
      for (const member of humanTeamMembers) {
        await User.findByIdAndUpdate(member.userId, { $inc: { walletBalance: rupees } });
        await Transaction.create({
          userId: member.userId,
          type: 'winning',
          amount: rupees,
          status: 'completed',
          description: `Team Survival Stage ${team.currentStage} (${stageConfig.name}) — ${perMember} pts (split)`,
          metadata: { teamId: String(team._id), stage: team.currentStage },
        });
      }
      team.totalPointsEarned += perMember;
      payload.pointsEarned = perMember;
      payload.prizeNote = `Split among ${humanTeamMembers.length} member${humanTeamMembers.length !== 1 ? 's' : ''}`;
    } else {
      // host_pays → full prize to host only
      const rupees = pointsToRupees(stageReward);
      await User.findByIdAndUpdate(team.hostId, { $inc: { walletBalance: rupees } });
      await Transaction.create({
        userId: team.hostId,
        type: 'winning',
        amount: rupees,
        status: 'completed',
        description: `Team Survival Stage ${team.currentStage} (${stageConfig.name}) — ${stageReward} pts (host)`,
        metadata: { teamId: String(team._id), stage: team.currentStage },
      });
      team.totalPointsEarned += stageReward;
      payload.pointsEarned = stageReward;
      payload.prizeNote = 'All to host';
    }

    if (team.currentStage >= 5) {
      team.status = 'completed';
      team.currentRoomCode = null;
      team.completedAt = new Date();
      await team.save();
      payload.tournamentOver = true;
      payload.won = true;
      payload.totalPointsEarned = team.totalPointsEarned;
    } else {
      const nextStage = team.currentStage + 1;
      const nextStageConfig = TEAM_SURVIVAL_STAGES.find(s => s.stage === nextStage)!;

      const humanMembersNext = (team.members as any[]).filter(m => !m.isBot);
      const allyBotMembersNext = (team.members as any[]).filter(m => m.isBot);

      let nextCode: string = '';
      let att = 0;
      do {
        nextCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        att++;
      } while (await Room.exists({ code: nextCode }) && att < 10);

      const { players: nextPlayers } = buildTeamRoomPlayers(humanMembersNext, allyBotMembersNext, nextStageConfig, team.hostId, nextCode);
      await Room.create({
        code: nextCode,
        name: `Team Survival S${nextStage}`.slice(0, 30),
        hostId: team.hostId,
        players: nextPlayers,
        config: {
          maxPlayers: nextPlayers.length,
          roundCount: 3,
          isPrivate: true,
          turnTimeLimit: 30,
          allowBots: true,
          botCount: 0,
          entryFee: 0,
        },
        paidPlayerIds: [],
        status: 'waiting',
      });

      team.currentStage = nextStage;
      team.currentRoomCode = nextCode;
      await team.save();

      payload.tournamentOver = false;
      payload.nextStage = nextStage;
      payload.nextRoomCode = nextCode;
      payload.nextStageName = nextStageConfig.name;
      payload.nextStageDesc = nextStageConfig.description;
      payload.nextBotNames = nextStageConfig.botNames;
    }

    io.to(teamRoom).emit('survival:team_stage_result', payload);
  } catch (err) {
    console.error('[TeamSurvival] Match end error:', err);
  }
}

export function registerSurvivalTeamHandlers(io: Server, socket: Socket) {
  const userId: string   = (socket as any).userId;
  const username: string = (socket as any).username;
  const avatar: string   = (socket as any).avatar;
  const isGuest: boolean = (socket as any).isGuest;

  // ── Create team ────────────────────────────────────────────────────────────
  socket.on('survival:team_create', async (data: {
    tier: SurvivalTier;
    entryFeeMode: 'split' | 'host_pays';
    maxSize: number;
  }) => {
    try {
      if (isGuest) return socket.emit('survival:team_error', 'Guests cannot join team tournaments. Please sign in.');
      const { tier, entryFeeMode } = data;
      const maxSize = 2; // Team Arena is fixed at 2v2
      if (!TIER_CONFIG[tier]) return socket.emit('survival:team_error', 'Invalid tournament tier.');

      const existing = await SurvivalTeam.findOne({
        'members.userId': userId,
        status: { $in: ['forming', 'playing'] },
      });

      if (existing?.status === 'playing') {
        return socket.emit('survival:team_error', 'You have an ongoing team tournament. Finish it first.');
      }
      if (existing?.status === 'forming') {
        // Auto-abandon stale forming team so user can create a fresh one
        existing.status = 'abandoned';
        await existing.save();
        io.to(`team:${existing.teamCode}`).emit('survival:team_disbanded', { reason: 'Host started a new team.' });
        socket.leave(`team:${existing.teamCode}`);
      }

      const tierCfg = await getEffectiveTierConfig(tier);

      let teamCode: string = '';
      let att = 0;
      do {
        teamCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        att++;
      } while (await SurvivalTeam.exists({ teamCode, status: { $in: ['forming', 'playing'] } }) && att < 10);

      const team = await SurvivalTeam.create({
        teamCode,
        hostId: userId,
        tier,
        entryFeeMode,
        maxSize,
        members: [{ userId, username, avatar, walletDeducted: false, isBot: false }],
        status: 'forming',
        currentStage: 1,
        currentRoomCode: null,
        stageResults: [],
        totalPointsEarned: 0,
        entryPoints: tierCfg.entryPoints,
      });

      await socket.join(`team:${teamCode}`);
      socket.emit('survival:team_updated', buildTeamPayload(team, tierCfg.entryPoints));
    } catch (err) {
      console.error('[TeamSurvival] Create error:', err);
      socket.emit('survival:team_error', 'Failed to create team. Please try again.');
    }
  });

  // ── Join team ──────────────────────────────────────────────────────────────
  socket.on('survival:team_join', async (data: { teamCode: string }) => {
    try {
      if (isGuest) return socket.emit('survival:team_error', 'Guests cannot join team tournaments. Please sign in.');
      const code = (data.teamCode ?? '').trim().toUpperCase();
      if (!code) return socket.emit('survival:team_error', 'Enter a team code.');

      const team = await SurvivalTeam.findOne({ teamCode: code, status: 'forming' });
      if (!team) return socket.emit('survival:team_error', 'Team not found or already started. Check the invite code.');

      const humanCount = (team.members as any[]).filter(m => !m.isBot).length;
      if (humanCount >= team.maxSize) return socket.emit('survival:team_error', 'Team is full.');
      if (team.members.some((m: any) => m.userId === userId))
        return socket.emit('survival:team_error', 'You are already in this team.');

      const existing = await SurvivalTeam.findOne({
        'members.userId': userId,
        status: { $in: ['forming', 'playing'] },
      });
      if (existing) return socket.emit('survival:team_error', 'You are already in another active team.');

      (team.members as any).push({ userId, username, avatar, walletDeducted: false, isBot: false });
      await team.save();

      await socket.join(`team:${code}`);
      const tierCfg = await getEffectiveTierConfig(team.tier);
      io.to(`team:${code}`).emit('survival:team_updated', buildTeamPayload(team, tierCfg.entryPoints));
    } catch (err) {
      console.error('[TeamSurvival] Join error:', err);
      socket.emit('survival:team_error', 'Failed to join team. Please try again.');
    }
  });

  // ── Add bot to team (host only) ────────────────────────────────────────────
  const VALID_PERSONALITIES = new Set(['safe', 'aggressive', 'bluff', 'smart']);
  const PERSONALITY_DISPLAY: Record<string, string> = {
    safe: 'Guardian', aggressive: 'Viper', bluff: 'Mystic', smart: 'Tactician',
  };

  socket.on('survival:team_add_bot', async (data: { personality?: string }) => {
    try {
      const personality = (data?.personality && VALID_PERSONALITIES.has(data.personality)) ? data.personality : 'smart';

      const team = await SurvivalTeam.findOne({ hostId: userId, status: 'forming' });
      if (!team) return socket.emit('survival:team_error', 'No forming team found.');
      if (team.members.length >= team.maxSize) return socket.emit('survival:team_error', 'Team is already full.');

      const botCount = (team.members as any[]).filter(m => m.isBot).length;
      const botUserId = `bot_${team.teamCode}_${botCount + 1}`;

      (team.members as any).push({
        userId: botUserId,
        username: PERSONALITY_DISPLAY[personality] ?? `Bot ${botCount + 1}`,
        avatar: `bot_${personality}`,
        walletDeducted: false,
        isBot: true,
        personality,
      });

      // Bots require host to pay full entry fee — no split allowed
      team.entryFeeMode = 'host_pays';
      await team.save();

      const tierCfg = await getEffectiveTierConfig(team.tier);
      io.to(`team:${team.teamCode}`).emit('survival:team_updated', buildTeamPayload(team, tierCfg.entryPoints));
    } catch (err) {
      console.error('[TeamSurvival] AddBot error:', err);
      socket.emit('survival:team_error', 'Failed to add bot. Please try again.');
    }
  });

  // ── Remove bot from team (host only) ──────────────────────────────────────
  socket.on('survival:team_remove_bot', async (data: { botUserId: string }) => {
    try {
      const team = await SurvivalTeam.findOne({ hostId: userId, status: 'forming' });
      if (!team) return;

      team.members = (team.members as any[]).filter(m => m.userId !== data.botUserId) as any;
      await team.save();

      const tierCfg = await getEffectiveTierConfig(team.tier);
      io.to(`team:${team.teamCode}`).emit('survival:team_updated', buildTeamPayload(team, tierCfg.entryPoints));
    } catch (err) {
      console.error('[TeamSurvival] RemoveBot error:', err);
    }
  });

  // ── Start tournament (host only) ───────────────────────────────────────────
  socket.on('survival:team_start', async () => {
    try {
      if (isGuest) return socket.emit('survival:team_error', 'Guests cannot start team tournaments.');

      const team = await SurvivalTeam.findOne({ hostId: userId, status: 'forming' });
      if (!team) return socket.emit('survival:team_error', 'No team found. Create a team first.');
      if (team.members.length < 2) return socket.emit('survival:team_error', 'Need at least 2 members (humans or bots) to start.');

      const hasBots = (team.members as any[]).some(m => m.isBot);
      if (hasBots) {
        team.entryFeeMode = 'host_pays';
      }

      const tierCfg = await getEffectiveTierConfig(team.tier);
      const humanMembers = (team.members as any[]).filter(m => !m.isBot);

      // Deduct entry fees (humans only)
      const deducted: { userId: string; amount: number }[] = [];
      for (const member of humanMembers) {
        let costRupees = 0;
        if (team.entryFeeMode === 'split') {
          costRupees = pointsToRupees(Math.ceil(tierCfg.entryPoints / humanMembers.length));
        } else {
          costRupees = member.userId === team.hostId ? pointsToRupees(tierCfg.entryPoints) : 0;
        }

        if (costRupees > 0) {
          const ok = await User.findOneAndUpdate(
            { _id: member.userId, walletBalance: { $gte: costRupees } },
            { $inc: { walletBalance: -costRupees } },
            { new: true },
          );
          if (!ok) {
            for (const d of deducted) {
              await User.findByIdAndUpdate(d.userId, { $inc: { walletBalance: d.amount } });
            }
            const user = await User.findById(member.userId).select('username').lean();
            return socket.emit('survival:team_error',
              `${(user as any)?.username ?? 'A member'} has insufficient balance. Tournament not started.`);
          }
          member.walletDeducted = true;
          deducted.push({ userId: member.userId, amount: costRupees });

          await Transaction.create({
            userId: member.userId,
            type: 'entry_fee',
            amount: costRupees,
            status: 'completed',
            description: `Team Survival entry (${tierCfg.label})`,
            metadata: { teamId: String(team._id) },
          });
        }
      }

      const stageConfig = TEAM_SURVIVAL_STAGES[0];
      let code: string = '';
      let rAtt = 0;
      do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
        rAtt++;
      } while (await Room.exists({ code }) && rAtt < 10);

      const allyBotMembers = (team.members as any[]).filter(m => m.isBot);
      const { players: s1Players } = buildTeamRoomPlayers(humanMembers, allyBotMembers, stageConfig, team.hostId, code);
      await Room.create({
        code,
        name: `Team Survival S1`.slice(0, 30),
        hostId: team.hostId,
        players: s1Players,
        config: {
          maxPlayers: s1Players.length,
          roundCount: 3,
          isPrivate: true,
          turnTimeLimit: 30,
          allowBots: true,
          botCount: 0,
          entryFee: 0,
        },
        paidPlayerIds: [],
        status: 'waiting',
      });

      team.status = 'playing';
      team.currentRoomCode = code;
      await team.save();

      await startTeamRoom(io, team, code, stageConfig);

      io.to(`team:${team.teamCode}`).emit('survival:team_started', {
        teamCode: team.teamCode,
        roomCode: code,
        stage: 1,
        stageName: stageConfig.name,
        stageDesc: stageConfig.description,
        botNames: stageConfig.botNames,
        tier: team.tier,
        entryPoints: tierCfg.entryPoints,
      });
    } catch (err) {
      console.error('[TeamSurvival] Start error:', err);
      socket.emit('survival:team_error', 'Failed to start tournament. Please try again.');
    }
  });

  // ── Continue to next stage (host only, after stage win) ────────────────────
  socket.on('survival:team_continue', async () => {
    try {
      const team = await SurvivalTeam.findOne({ hostId: userId, status: 'playing' });
      if (!team?.currentRoomCode) return;

      const stageConfig = TEAM_SURVIVAL_STAGES.find(s => s.stage === team.currentStage);
      if (!stageConfig) return;

      await startTeamRoom(io, team, team.currentRoomCode, stageConfig);

      io.to(`team:${team.teamCode}`).emit('survival:team_stage_started', {
        stage: team.currentStage,
        stageName: stageConfig.name,
        stageDesc: stageConfig.description,
        roomCode: team.currentRoomCode,
        botNames: stageConfig.botNames,
      });
    } catch (err) {
      console.error('[TeamSurvival] Continue error:', err);
      socket.emit('survival:team_error', 'Failed to advance stage. Please try again.');
    }
  });

  // ── Quit active team tournament (host only, with refund if no rounds played) ─
  socket.on('survival:team_quit', async () => {
    try {
      const team = await SurvivalTeam.findOne({ hostId: userId, status: 'playing' });
      if (!team) return socket.emit('survival:team_error', 'No active team tournament found.');

      const canRefund = (team.stageResults ?? []).length === 0;
      const tierCfg = await getEffectiveTierConfig(team.tier);
      const humanMembers = (team.members as any[]).filter(m => !m.isBot && m.walletDeducted);

      let refundPoints = 0;
      if (canRefund) {
        for (const member of humanMembers) {
          let refundRupees = 0;
          if (team.entryFeeMode === 'split') {
            refundRupees = pointsToRupees(Math.ceil(tierCfg.entryPoints / humanMembers.length));
          } else if (member.userId === team.hostId) {
            refundRupees = pointsToRupees(tierCfg.entryPoints);
          }
          if (refundRupees > 0) {
            await User.findByIdAndUpdate(member.userId, { $inc: { walletBalance: refundRupees } });
            refundPoints += refundRupees * POINTS_PER_RUPEE;
            await Transaction.create({
              userId: member.userId,
              type: 'refund',
              amount: refundRupees,
              status: 'completed',
              description: `Team Survival quit refund (${tierCfg.label})`,
              metadata: { teamId: String(team._id) },
            });
          }
        }
      }

      team.status = 'abandoned';
      team.completedAt = new Date();
      await team.save();

      const teamRoom = `team:${team.teamCode}`;
      io.to(teamRoom).emit('survival:team_quit_result', {
        refunded: canRefund,
        refundAmount: refundPoints,
      });
    } catch (err) {
      console.error('[TeamSurvival] Quit error:', err);
      socket.emit('survival:team_error', 'Failed to quit tournament. Please try again.');
    }
  });

  // ── Rejoin active team match (works whether game is running or not yet started) ─
  socket.on('survival:team_rejoin', async () => {
    try {
      const team = await SurvivalTeam.findOne({
        'members.userId': userId,
        status: 'playing',
      });
      if (!team?.currentRoomCode) {
        return socket.emit('survival:team_error', 'No active team match found. The tournament may have ended.');
      }

      await socket.join(`team:${team.teamCode}`);

      const stageConfig = TEAM_SURVIVAL_STAGES.find(s => s.stage === team.currentStage);
      if (!stageConfig) return;

      const existingGame = getActiveGame(team.currentRoomCode);

      if (existingGame) {
        // Game is already running — just reconnect this member
        await socket.join(team.currentRoomCode);
        socket.data = { ...socket.data, roomCode: team.currentRoomCode };
        emitGameStateToMember(socket, existingGame, userId);
      } else if (team.hostId === userId) {
        // Game not started yet (between stages) — host starts it now
        await startTeamRoom(io, team, team.currentRoomCode, stageConfig);
        io.to(`team:${team.teamCode}`).emit('survival:team_stage_started', {
          stage: team.currentStage,
          stageName: stageConfig.name,
          stageDesc: stageConfig.description,
          roomCode: team.currentRoomCode,
          botNames: stageConfig.botNames,
        });
      } else {
        // Non-host trying to rejoin an unstarted stage — inform them
        socket.emit('survival:team_error', 'Waiting for the host to start the next stage.');
      }
    } catch (err) {
      console.error('[TeamSurvival] Rejoin error:', err);
      socket.emit('survival:team_error', 'Failed to rejoin. Please try again.');
    }
  });

  // ── Leave team ─────────────────────────────────────────────────────────────
  socket.on('survival:team_leave', async () => {
    try {
      const team = await SurvivalTeam.findOne({
        'members.userId': userId,
        status: 'forming',
      });
      if (!team) return;

      const code = team.teamCode;
      if (team.hostId === userId) {
        team.status = 'abandoned';
        await team.save();
        io.to(`team:${code}`).emit('survival:team_disbanded', { reason: 'Host left the team.' });
      } else {
        team.members = team.members.filter((m: any) => m.userId !== userId) as any;
        await team.save();
        socket.leave(`team:${code}`);
        const tierCfg = await getEffectiveTierConfig(team.tier);
        io.to(`team:${code}`).emit('survival:team_updated', buildTeamPayload(team, tierCfg.entryPoints));
      }
    } catch (err) {
      console.error('[TeamSurvival] Leave error:', err);
    }
  });

  // ── Status / reconnect ─────────────────────────────────────────────────────
  socket.on('survival:team_status', async () => {
    try {
      const team = await SurvivalTeam.findOne({
        'members.userId': userId,
        status: { $in: ['forming', 'playing'] },
      });
      if (!team) return socket.emit('survival:team_updated', null);
      await socket.join(`team:${team.teamCode}`);
      const tierCfg = await getEffectiveTierConfig(team.tier);
      socket.emit('survival:team_updated', buildTeamPayload(team, tierCfg.entryPoints));
    } catch (err) {
      console.error('[TeamSurvival] Status error:', err);
    }
  });
}
