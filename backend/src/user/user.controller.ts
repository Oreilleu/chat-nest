import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Get('profile')
  getProfile(@Request() req) {
    return this.userService.getProfile(req.user.userId);
  }

  @Put('profile')
  updateProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.userService.updateProfile(req.user.userId, updateProfileDto);
  }

  @Get('all')
  getAllUsers() {
    return this.userService.getAllUsers();
  }
}
