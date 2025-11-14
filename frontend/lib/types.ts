export interface User {
  id: number;
  username: string;
  color: string;
}

export interface Message {
  id: number;
  content: string;
  createdAt: string;
  user: User;
  reactions: Reaction[];
}

export interface Reaction {
  id: number;
  emoji: string;
  user: User;
}

export interface Room {
  id: number;
  name: string;
  isGeneral: boolean;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
