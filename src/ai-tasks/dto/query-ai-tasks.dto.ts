import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AiTaskStatus } from '../../generated/prisma/enums';

export class QueryAiTasksDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, description: '页码' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    example: 20,
    minimum: 1,
    maximum: 100,
    description: '每页条数',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({
    enum: AiTaskStatus,
    example: AiTaskStatus.COMPLETED,
    description: '任务状态过滤',
  })
  @IsOptional()
  @IsEnum(AiTaskStatus)
  status?: AiTaskStatus;

  @ApiPropertyOptional({
    example: 'offline devices',
    maxLength: 200,
    description: 'Prompt 关键字',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
