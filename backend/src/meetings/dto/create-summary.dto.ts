import { IsNotEmpty, IsString, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class CreateSummaryDto {
  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsArray()
  @IsOptional()
  keyPoints?: string[];

  @IsArray()
  @IsOptional()
  decisions?: string[];

  @IsArray()
  @IsOptional()
  actionItems?: string[];

  @IsBoolean()
  @IsOptional()
  isAiGenerated?: boolean;
}
