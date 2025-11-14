import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Message } from './message.entity';
import { User } from './user.entity';

@Entity()
export class Reaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  emoji: string;

  @ManyToOne(() => Message, message => message.reactions)
  message: Message;

  @ManyToOne(() => User)
  user: User;
}
