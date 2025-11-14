import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import { Message } from '../entities/message.entity';
import { Room } from '../entities/room.entity';
import { RoomUser } from '../entities/room-user.entity';
import { Reaction } from '../entities/reaction.entity';

@Injectable()
export class ChatService {
  private connectedUsers: Map<number, string> = new Map();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(RoomUser)
    private roomUserRepository: Repository<RoomUser>,
    @InjectRepository(Reaction)
    private reactionRepository: Repository<Reaction>,
    private jwtService: JwtService,
  ) {
    this.initGeneralRoom();
  }

  async initGeneralRoom() {
    const existingRoom = await this.roomRepository.findOne({ where: { isGeneral: true } });
    if (!existingRoom) {
      const room = this.roomRepository.create({ name: 'General', isGeneral: true });
      await this.roomRepository.save(room);
    }
  }

  async getUserFromSocket(socket: Socket): Promise<User | null> {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) return null;

    try {
      const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET || 'SECRET_KEY' });
      return this.userRepository.findOne({ where: { id: payload.sub } });
    } catch {
      return null;
    }
  }

  async handleConnection(userId: number, socketId: string) {
    this.connectedUsers.set(userId, socketId);
  }

  async handleDisconnect(socketId: string) {
    for (const [userId, sid] of this.connectedUsers.entries()) {
      if (sid === socketId) {
        this.connectedUsers.delete(userId);
        break;
      }
    }
  }

  async getSocketIdByUserId(userId: number): Promise<string | null> {
    return this.connectedUsers.get(userId) || null;
  }

  async getGeneralRoom() {
    return this.roomRepository.findOne({ where: { isGeneral: true } });
  }

  async getUserRooms(userId: number) {
    const generalRoom = await this.roomRepository.findOne({ where: { isGeneral: true } });
    const userRooms = await this.roomUserRepository.find({
      where: { user: { id: userId } },
      relations: ['room'],
    });
    const rooms = userRooms.map(ru => ru.room);
    if (generalRoom && !rooms.find(r => r.id === generalRoom.id)) {
      rooms.unshift(generalRoom);
    }
    return rooms;
  }

  async createMessage(userId: number, roomId: number, content: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!user || !room) return null;
    const message = this.messageRepository.create({ content, user, room });
    await this.messageRepository.save(message);
    return this.messageRepository.findOne({
      where: { id: message.id },
      relations: ['user', 'reactions', 'reactions.user', 'room'],
    });
  }

  async getMessage(messageId: number) {
    return this.messageRepository.findOne({
      where: { id: messageId },
      relations: ['room', 'user', 'reactions', 'reactions.user'],
    });
  }

  async getRoomMessages(roomId: number, socket: Socket) {
    const user = await this.getUserFromSocket(socket);
    if (!user) return [];

    const roomUser = await this.roomUserRepository.findOne({
      where: { room: { id: roomId }, user: { id: user.id } },
    });

    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) return [];

    if (room.isGeneral || !roomUser || roomUser.hasHistoryAccess) {
      return this.messageRepository.find({
        where: { room: { id: roomId } },
        relations: ['user', 'reactions', 'reactions.user'],
        order: { createdAt: 'ASC' },
      });
    }

    return [];
  }

  async addReaction(userId: number, messageId: number, emoji: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!user || !message) return null;

    const existingReaction = await this.reactionRepository.findOne({
      where: { user: { id: userId }, message: { id: messageId }, emoji },
    });

    if (existingReaction) {
      const reactionId = existingReaction.id;
      await this.reactionRepository.remove(existingReaction);
      return { removed: true, reactionId, messageId };
    }

    const reaction = this.reactionRepository.create({ emoji, user, message });
    await this.reactionRepository.save(reaction);
    return this.reactionRepository.findOne({
      where: { id: reaction.id },
      relations: ['user', 'message'],
    });
  }

  async createRoom(creatorId: number, name: string, userIds: number[], historyAccess: { [userId: number]: boolean }) {
    const room = this.roomRepository.create({ name });
    await this.roomRepository.save(room);

    const allUserIds = [creatorId, ...userIds];
    for (const userId of allUserIds) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (user) {
        const roomUser = this.roomUserRepository.create({
          room,
          user,
          hasHistoryAccess: historyAccess[userId] !== false,
        });
        await this.roomUserRepository.save(roomUser);
      }
    }

    return this.roomRepository.findOne({
      where: { id: room.id },
      relations: ['users'],
    });
  }

  async addUserToRoom(roomId: number, userId: number, hasHistoryAccess: boolean) {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!room || !user) return null;

    const existing = await this.roomUserRepository.findOne({
      where: { room: { id: roomId }, user: { id: userId } },
    });
    if (existing) return null;

    const roomUser = this.roomUserRepository.create({
      room,
      user,
      hasHistoryAccess,
    });
    await this.roomUserRepository.save(roomUser);
    return room;
  }
}
