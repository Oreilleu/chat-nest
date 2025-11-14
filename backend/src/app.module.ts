import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ChatModule } from './chat/chat.module';
import { User } from './entities/user.entity';
import { Message } from './entities/message.entity';
import { Room } from './entities/room.entity';
import { RoomUser } from './entities/room-user.entity';
import { Reaction } from './entities/reaction.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DATABASE_PATH || 'chat.db',
      entities: [User, Message, Room, RoomUser, Reaction],
      synchronize: true,
    }),
    AuthModule,
    UserModule,
    ChatModule,
  ],
})
export class AppModule {}
