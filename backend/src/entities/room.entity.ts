import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Message } from './message.entity';
import { RoomUser } from './room-user.entity';

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ default: false })
  isGeneral: boolean;

  @ManyToMany(() => User, user => user.rooms)
  @JoinTable()
  users: User[];

  @OneToMany(() => Message, message => message.room)
  messages: Message[];

  @OneToMany(() => RoomUser, roomUser => roomUser.room)
  roomUsers: RoomUser[];
}
