import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Room } from './room.entity';
import { Reaction } from './reaction.entity';

@Entity()
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, user => user.messages)
  user: User;

  @ManyToOne(() => Room, room => room.messages)
  room: Room;

  @OneToMany(() => Reaction, reaction => reaction.message)
  reactions: Reaction[];
}
