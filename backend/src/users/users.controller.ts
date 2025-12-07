import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // Get current authenticated user
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.usersService.findOne(user.id);
  }

  // Update current user's settings
  @Patch('me/settings')
  updateMySettings(@CurrentUser() user: User, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(user.id, updateUserDto);
  }

  // Get current user's activity stats
  @Get('me/stats')
  getMyStats(@CurrentUser() user: User) {
    return this.usersService.getUserStats(user.id);
  }

  // Get current user's storage stats
  @Get('me/storage')
  getMyStorage(@CurrentUser() user: User) {
    return this.usersService.getStorageStats(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Public()
  @Get('firebase/:firebaseUid')
  findByFirebaseUid(@Param('firebaseUid') firebaseUid: string) {
    return this.usersService.findByFirebaseUid(firebaseUid);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
