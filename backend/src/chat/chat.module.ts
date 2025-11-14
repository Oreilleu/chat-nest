import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { User } from '../entities/user.entity';
import { Message } from '../entities/message.entity';
import { Room } from '../entities/room.entity';
import { RoomUser } from '../entities/room-user.entity';
import { Reaction } from '../entities/reaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Message, Room, RoomUser, Reaction]),
    JwtModule.register({
      secret: 'SECRET_KEY',
    }),
  ],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
