import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

function IsIanaTimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isIanaTimezone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          try {
            Intl.DateTimeFormat(undefined, { timeZone: value });
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(): string {
          return 'digest_timezone must be a valid IANA timezone name (e.g. "America/Chicago")';
        },
      },
    });
  };
}

export class UpdateUserPreferencesDto {
  @IsOptional()
  @IsBoolean()
  email_notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  marketing_emails?: boolean;

  @IsOptional()
  @IsBoolean()
  goal_created_notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  goal_contribution_notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  goal_reached_notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  deposit_notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  withdrawal_notifications?: boolean;

  @IsOptional()
  @IsBoolean()
  group_settlement_notifications?: boolean;

  @IsOptional()
  @IsIn(['daily', 'weekly', 'off'])
  digest_frequency?: 'daily' | 'weekly' | 'off';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  digest_hour?: number;

  /** IANA timezone name, e.g. "America/Chicago". */
  @IsOptional()
  @IsString()
  @IsIanaTimezone()
  digest_timezone?: string;
}

export class UserPreferencesResponseDto {
  id: string;
  email_notifications: boolean;
  marketing_emails: boolean;
  goal_created_notifications: boolean;
  goal_contribution_notifications: boolean;
  goal_reached_notifications: boolean;
  deposit_notifications: boolean;
  withdrawal_notifications: boolean;
  group_settlement_notifications: boolean;
  digest_frequency: 'daily' | 'weekly' | 'off';
  digest_hour: number;
  digest_timezone: string;
  created_at: Date;
  updated_at: Date;
}
