import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const token: string | undefined =
      (client.handshake.auth.token as string | undefined) ||
      client.handshake.headers.authorization?.split(' ')[1];

    if (!token) return false;

    try {
      this.jwtService.verify(token, { secret: 'SECRET_KEY' });
      return true;
    } catch {
      return false;
    }
  }
}
