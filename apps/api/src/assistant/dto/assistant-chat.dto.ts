import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AssistantHistoryMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(1500)
  content!: string;
}

export class AssistantChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1500)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({
    each: true,
  })
  @Type(
    () =>
      AssistantHistoryMessageDto,
  )
  history: AssistantHistoryMessageDto[] =
    [];
}
