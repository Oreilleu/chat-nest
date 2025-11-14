import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { WsJwtGuard } from './ws-jwt.guard';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private chatService: ChatService) {}

  async handleConnection(client: Socket) {
    const user = await this.chatService.getUserFromSocket(client);
    if (!user) {
      client.disconnect();
      return;
    }
    await this.chatService.handleConnection(user.id, client.id);
    const generalRoom = await this.chatService.getGeneralRoom();
    if (generalRoom) {
      client.join(`room_${generalRoom.id}`);
    }
  }

  async handleDisconnect(client: Socket) {
    await this.chatService.handleDisconnect(client.id);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number; content: string },
  ) {
    const user = await this.chatService.getUserFromSocket(client);
    if (!user) return;
    const message = await this.chatService.createMessage(user.id, data.roomId, data.content);
    this.server.to(`room_${data.roomId}`).emit('newMessage', message);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number; isTyping: boolean },
  ) {
    const user = await this.chatService.getUserFromSocket(client);
    if (!user) return;
    client.to(`room_${data.roomId}`).emit('userTyping', {
      roomId: data.roomId,
      userId: user.id,
      username: user.username,
      isTyping: data.isTyping,
    });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('addReaction')
  async handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: number; emoji: string },
  ) {
    const user = await this.chatService.getUserFromSocket(client);
    if (!user) return;
    const result = await this.chatService.addReaction(user.id, data.messageId, data.emoji);
    const message = await this.chatService.getMessage(data.messageId);
    if (message && result) {
      if ('removed' in result) {
        this.server.to(`room_${message.room.id}`).emit('reactionRemoved', {
          messageId: result.messageId,
          reactionId: result.reactionId,
        });
      } else {
        this.server.to(`room_${message.room.id}`).emit('reactionAdded', result);
      }
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number },
  ) {
    client.join(`room_${data.roomId}`);
    const messages = await this.chatService.getRoomMessages(data.roomId, client);
    client.emit('roomMessages', messages);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('getRooms')
  async handleGetRooms(@ConnectedSocket() client: Socket) {
    const user = await this.chatService.getUserFromSocket(client);
    if (!user) return;
    const rooms = await this.chatService.getUserRooms(user.id);
    client.emit('userRooms', rooms);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('createRoom')
  async handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { name: string; userIds: number[]; historyAccess: { [userId: number]: boolean } },
  ) {
    const user = await this.chatService.getUserFromSocket(client);
    if (!user) return;
    const room = await this.chatService.createRoom(user.id, data.name, data.userIds, data.historyAccess);
    if (!room) return;

    for (const userId of [user.id, ...data.userIds]) {
      const socketId = await this.chatService.getSocketIdByUserId(userId);
      if (socketId) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) {
          socket.join(`room_${room.id}`);
          socket.emit('roomCreated', room);
        }
      }
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('addUserToRoom')
  async handleAddUserToRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number; userId: number; hasHistoryAccess: boolean },
  ) {
    const user = await this.chatService.getUserFromSocket(client);
    if (!user) return;
    const room = await this.chatService.addUserToRoom(data.roomId, data.userId, data.hasHistoryAccess);
    if (!room) return;

    const socketId = await this.chatService.getSocketIdByUserId(data.userId);
    if (socketId) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.join(`room_${room.id}`);
        socket.emit('roomCreated', room);
      }
    }
  }
}
