import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Language } from '../enums/language.enum';

export class CreateCodeSessionDto {
  @IsEnum(Language, {
    message: `language must be one of: ${Object.values(Language).join(', ')}`,
  })
  language: Language;

  @IsString()
  @IsOptional()
  userId?: string;
}
