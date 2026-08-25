import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject } from 'class-validator';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export class PasskeyAuthenticationFinishDto {
  @ApiProperty({
    description:
      'The AuthenticationResponseJSON produced by navigator.credentials.get() for the passkey the user selected.',
  })
  @IsObject()
  @IsNotEmpty()
  response: AuthenticationResponseJSON;
}
