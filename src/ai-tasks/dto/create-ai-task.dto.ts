import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAiTaskDto {
  @ApiProperty({
    example: '请总结最近的设备状态并给出建议',
    minLength: 1,
    maxLength: 10000,
    description: 'AI 任务提示词',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  prompt!: string;
}
