import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Room } from './room.entity';
import { User } from './user.entity';

@Entity()
export class RoomUser {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Room, room => room.roomUsers)
  room: Room;

  @ManyToOne(() => User)
  user: User;

  @Column({ default: true })
  hasHistoryAccess: boolean;
}
