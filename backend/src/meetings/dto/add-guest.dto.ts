import { IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class AddGuestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsBoolean()
  @IsOptional()
  isAiDetected?: boolean;
}
