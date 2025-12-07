import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsString()
  @IsOptional()
  photoURL?: string;

  @IsString()
  @IsNotEmpty()
  firebaseUid: string;
}
