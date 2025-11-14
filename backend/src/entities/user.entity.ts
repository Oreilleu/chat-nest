import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToMany } from 'typeorm';
import { Message } from './message.entity';
import { Room } from './room.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ default: '#000000' })
  color: string;

  @OneToMany(() => Message, message => message.user)
  messages: Message[];

  @ManyToMany(() => Room, room => room.users)
  rooms: Room[];
}
