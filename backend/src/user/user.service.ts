import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto) {
    await this.userRepository.update(userId, updateProfileDto);
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async getProfile(userId: number) {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async getAllUsers() {
    return this.userRepository.find({ select: ['id', 'username', 'color'] });
  }
}
