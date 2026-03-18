import { PartialType } from '@nestjs/mapped-types';
import { CreateCodeSessionDto } from './create-code-session.dto';
import { IsString } from 'class-validator';

export class UpdateCodeSessionDto extends PartialType(CreateCodeSessionDto) {
  @IsString()
  source_code: string;
}
