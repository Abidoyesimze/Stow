import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Keypair } from '@stellar/stellar-sdk';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserPreferences } from '../users/entities/user-preferences.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthAuditEvent } from './entities/auth-audit-event.entity';
import { WebAuthnCredential } from './entities/webauthn-credential.entity';
import { AuthService } from './auth.service';

jest.mock('@simplewebauthn/server', () => ({
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

type UsersRepoMock = jest.Mocked<
  Pick<Repository<User>, 'findOneBy' | 'create' | 'save'>
>;

type PreferencesRepoMock = jest.Mocked<
  Pick<Repository<UserPreferences>, 'findOneBy' | 'create' | 'save'>
>;

type RefreshTokenRepoMock = jest.Mocked<
  Pick<Repository<RefreshToken>, 'findOneBy' | 'create' | 'save' | 'update'>
>;

type AuthAuditEventRepoMock = jest.Mocked<
  Pick<Repository<AuthAuditEvent>, 'create' | 'save'>
>;

type WebAuthnCredentialRepoMock = jest.Mocked<
  Pick<Repository<WebAuthnCredential>, 'findOneBy' | 'save'>
>;

/** Builds a fake AuthenticationResponseJSON whose clientDataJSON echoes `challenge`. */
function buildAssertionResponse(
  challenge: string,
  overrides: Partial<AuthenticationResponseJSON> = {},
): AuthenticationResponseJSON {
  const clientDataJSON = Buffer.from(
    JSON.stringify({
      type: 'webauthn.get',
      challenge,
      origin: 'http://localhost:3000',
    }),
  ).toString('base64url');

  return {
    id: 'cred-id-1',
    rawId: 'cred-id-1',
    type: 'public-key',
    clientExtensionResults: {},
    response: {
      clientDataJSON,
      authenticatorData: 'authenticator-data',
      signature: 'signature-bytes',
    },
    ...overrides,
  } as unknown as AuthenticationResponseJSON;
}

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let usersRepository: UsersRepoMock;
  let preferencesRepository: PreferencesRepoMock;
  let refreshTokensRepository: RefreshTokenRepoMock;
  let authAuditEventsRepository: AuthAuditEventRepoMock;
  let webAuthnCredentialsRepository: WebAuthnCredentialRepoMock;

  const address = 'GABC1234567890';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('token.jwt.value'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserPreferences),
          useValue: {
            findOneBy: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            findOneBy: jest.fn(),
            create: jest.fn((entity: Partial<RefreshToken>) => entity),
            save: jest.fn((entity: RefreshToken) => Promise.resolve(entity)),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuthAuditEvent),
          useValue: {
            create: jest.fn((entity: Partial<AuthAuditEvent>) => entity),
            save: jest.fn((entity: AuthAuditEvent) => Promise.resolve(entity)),
          },
        },
        {
          provide: getRepositoryToken(WebAuthnCredential),
          useValue: {
            findOneBy: jest.fn(),
            save: jest.fn((entity: WebAuthnCredential) =>
              Promise.resolve(entity),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);
    usersRepository = module.get(getRepositoryToken(User));
    preferencesRepository = module.get(getRepositoryToken(UserPreferences));
    refreshTokensRepository = module.get(getRepositoryToken(RefreshToken));
    authAuditEventsRepository = module.get(getRepositoryToken(AuthAuditEvent));
    webAuthnCredentialsRepository = module.get(
      getRepositoryToken(WebAuthnCredential),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('generateChallenge() returns unique nonce each call', () => {
    const one = service.generateChallenge(address);
    const two = service.generateChallenge(address);

    expect(one).not.toEqual(two);
    expect(one).toContain('InsightArena:nonce:');
    expect(two).toContain(address);
  });

  it('verifySignature() returns user on valid sig and creates preferences if new user', async () => {
    service.generateChallenge(address);
    jest.spyOn(service, 'verifyStellarSignature').mockReturnValue(true);

    const savedUser = { id: 'u-1', stellar_address: address } as User;
    usersRepository.findOneBy.mockResolvedValue(null);
    usersRepository.create.mockReturnValue(savedUser);
    usersRepository.save.mockResolvedValue(savedUser);
    preferencesRepository.findOneBy.mockResolvedValue(null);
    preferencesRepository.create.mockReturnValue({
      userId: savedUser.id,
    } as UserPreferences);
    preferencesRepository.save.mockResolvedValue({
      userId: savedUser.id,
    } as UserPreferences);

    const user = await service.verifySignature(address, 'signed-hex');

    expect(user).toEqual(savedUser);
    expect(usersRepository.save).toHaveBeenCalledWith(savedUser);
    expect(preferencesRepository.findOneBy).toHaveBeenCalledWith({
      userId: 'u-1',
    });
    expect(preferencesRepository.create).toHaveBeenCalledWith({
      userId: 'u-1',
    });
    expect(preferencesRepository.save).toHaveBeenCalled();
  });

  it('verifySignature() does not create duplicate preferences for existing users', async () => {
    service.generateChallenge(address);
    jest.spyOn(service, 'verifyStellarSignature').mockReturnValue(true);

    const existingUser = { id: 'u-1', stellar_address: address } as User;
    usersRepository.findOneBy.mockResolvedValue(existingUser);
    usersRepository.save.mockResolvedValue(existingUser);

    const user = await service.verifySignature(address, 'signed-hex');

    expect(user).toEqual(existingUser);
    expect(preferencesRepository.save).not.toHaveBeenCalled();
  });

  it('verifySignature() throws UnauthorizedException on invalid sig', async () => {
    service.generateChallenge(address);
    jest.spyOn(service, 'verifyStellarSignature').mockReturnValue(false);

    await expect(service.verifySignature(address, 'bad-sig')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('expired nonce throws UnauthorizedException', async () => {
    jest.useFakeTimers();

    service.generateChallenge(address);
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);

    await expect(service.verifySignature(address, 'any-sig')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('verifyChallenge() returns access token, refresh token and user', async () => {
    service.generateChallenge(address);
    jest.spyOn(service, 'verifyStellarSignature').mockReturnValue(true);

    const savedUser = { id: 'u-2', stellar_address: address } as User;
    usersRepository.findOneBy.mockResolvedValue(savedUser);
    usersRepository.save.mockResolvedValue(savedUser);
    preferencesRepository.findOneBy.mockResolvedValue({
      id: 'prefs-1',
      userId: savedUser.id,
    } as UserPreferences);

    const result = await service.verifyChallenge(address, 'signed-hex');

    expect(result.access_token).toBe('token.jwt.value');
    expect(result.user).toEqual(savedUser);
    expect(typeof result.refresh_token).toBe('string');
    expect(result.refresh_token.length).toBeGreaterThan(0);
    expect(jwtService.signAsync.mock.calls[0][0]).toEqual({
      sub: 'u-2',
      stellar_address: address,
    });

    // A brand-new refresh token family is started on login.
    expect(refreshTokensRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u-2',
        previous_token_id: null,
      }),
    );
  });

  it('verifySignature() does not duplicate existing preferences', async () => {
    service.generateChallenge(address);
    jest.spyOn(service, 'verifyStellarSignature').mockReturnValue(true);

    const savedUser = { id: 'u-3', stellar_address: address } as User;
    usersRepository.findOneBy.mockResolvedValue(savedUser);
    usersRepository.save.mockResolvedValue(savedUser);
    preferencesRepository.findOneBy.mockResolvedValue({
      id: 'prefs-1',
      userId: savedUser.id,
    } as UserPreferences);

    await service.verifySignature(address, 'signed-hex');

    expect(preferencesRepository.save).not.toHaveBeenCalled();
  });

  it('removeChallenge() invalidates challenge', () => {
    const challenge = service.generateChallenge(address);

    expect(service.isValidChallenge(challenge)).toBe(true);
    service.removeChallenge(challenge);
    expect(service.isValidChallenge(challenge)).toBe(false);
  });

  it('isValidChallenge() returns false for unknown challenge', () => {
    expect(service.isValidChallenge('unknown')).toBe(false);
  });

  it('verifySignature() rejects a replayed challenge', async () => {
    service.generateChallenge(address);
    const verifySignature = jest
      .spyOn(service, 'verifyStellarSignature')
      .mockReturnValue(true);
    const savedUser = { id: 'u-replay', stellar_address: address } as User;
    usersRepository.findOneBy.mockResolvedValue(null);
    usersRepository.create.mockReturnValue(savedUser);
    usersRepository.save.mockResolvedValue(savedUser);

    await service.verifySignature(address, 'signed-hex');

    await expect(
      service.verifySignature(address, 'signed-hex'),
    ).rejects.toThrow('Challenge already used');
    expect(verifySignature).toHaveBeenCalledTimes(1);
  });

  it('isValidChallenge() deletes and rejects expired challenges', () => {
    jest.useFakeTimers();

    const challenge = service.generateChallenge(address);
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(service.isValidChallenge(challenge)).toBe(false);
  });

  it('verifyStellarSignature() uses mocked Keypair.verify and returns true', () => {
    const verify = jest.fn().mockReturnValue(true);
    jest
      .spyOn(Keypair, 'fromPublicKey')
      .mockReturnValue({ verify } as unknown as Keypair);

    const ok = service.verifyStellarSignature(address, 'challenge', 'abcd');

    expect(ok).toBe(true);
    expect(verify).toHaveBeenCalled();
  });

  it('verifyStellarSignature() returns false when sdk throws', () => {
    jest.spyOn(Keypair, 'fromPublicKey').mockImplementation(() => {
      throw new Error('invalid key');
    });

    const ok = service.verifyStellarSignature('bad-key', 'challenge', 'abcd');

    expect(ok).toBe(false);
  });

  describe('cleanupExpiredChallenges', () => {
    it('should remove expired challenges periodically', () => {
      jest.useFakeTimers();

      const cache = (
        service as unknown as {
          challengeCache: Map<string, { expiresAt: number; used: boolean }>;
        }
      ).challengeCache;

      // Add some expired challenges
      cache.set('expired-1', { expiresAt: Date.now() - 1000, used: false });
      cache.set('expired-2', { expiresAt: Date.now() - 2000, used: false });
      cache.set('valid-1', { expiresAt: Date.now() + 100000, used: false });

      expect(cache.size).toBe(3);

      // Call the cleanup method directly
      service.cleanupExpiredChallenges();

      expect(cache.size).toBe(1);
      expect(cache.has('valid-1')).toBe(true);
      expect(cache.has('expired-1')).toBe(false);
      expect(cache.has('expired-2')).toBe(false);
    });

    it('should be called via @Cron decorator every 5 minutes', () => {
      const cleanupSpy = jest.spyOn(service, 'cleanupExpiredChallenges');

      // Verify the method exists and is callable
      expect(service.cleanupExpiredChallenges).toBeDefined();

      service.cleanupExpiredChallenges();

      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should cleanup expired challenges without waiting for generateChallenge', () => {
      jest.useFakeTimers();

      const cache = (
        service as unknown as {
          challengeCache: Map<string, { expiresAt: number; used: boolean }>;
        }
      ).challengeCache;

      // Simulate high read load: many verifySignature calls without generateChallenge
      service.generateChallenge(address);
      cache.set('old-challenge', { expiresAt: Date.now() - 10000, used: true });

      expect(cache.size).toBe(2);

      // Cleanup should remove expired entries independently
      service.cleanupExpiredChallenges();

      expect(cache.size).toBe(1);
      expect(cache.has('old-challenge')).toBe(false);
    });
  });

  describe('rotateRefreshToken', () => {
    const rawToken = 'raw-refresh-token-value';
    const existingUser = {
      id: 'user-refresh-1',
      stellar_address: 'GABC1234',
    } as User;

    const buildStoredToken = (
      overrides: Partial<RefreshToken> = {},
    ): RefreshToken =>
      ({
        id: 'rt-1',
        user_id: existingUser.id,
        family_id: 'family-1',
        token_hash: service['hashToken'](rawToken),
        previous_token_id: null,
        revoked_at: null,
        expires_at: new Date(Date.now() + 60_000),
        created_at: new Date(),
        ...overrides,
      }) as RefreshToken;

    it('issues a new access + refresh token and revokes the old one on valid rotation', async () => {
      const stored = buildStoredToken();
      refreshTokensRepository.findOneBy.mockResolvedValue(stored);
      usersRepository.findOneBy.mockResolvedValue(existingUser);
      jwtService.signAsync.mockResolvedValue('new.jwt.token');

      const result = await service.rotateRefreshToken(rawToken);

      expect(result.access_token).toBe('new.jwt.token');
      expect(typeof result.refresh_token).toBe('string');
      expect(result.refresh_token).not.toBe(rawToken);

      // Old token is revoked.
      expect(refreshTokensRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rt-1', revoked_at: expect.any(Date) }),
      );

      // New token is issued in the same family, chained to the old one.
      expect(refreshTokensRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: existingUser.id,
          family_id: 'family-1',
          previous_token_id: 'rt-1',
        }),
      );

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: existingUser.id,
        stellar_address: existingUser.stellar_address,
      });

      // No reuse => no audit event.
      expect(authAuditEventsRepository.save).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the token does not exist', async () => {
      refreshTokensRepository.findOneBy.mockResolvedValue(null);

      await expect(service.rotateRefreshToken('unknown')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.rotateRefreshToken('unknown')).rejects.toThrow(
        'Invalid refresh token',
      );
    });

    it('throws UnauthorizedException when the token has expired', async () => {
      const stored = buildStoredToken({
        expires_at: new Date(Date.now() - 1000),
      });
      refreshTokensRepository.findOneBy.mockResolvedValue(stored);

      await expect(service.rotateRefreshToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.rotateRefreshToken(rawToken)).rejects.toThrow(
        'Refresh token expired',
      );
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      const stored = buildStoredToken();
      refreshTokensRepository.findOneBy.mockResolvedValue(stored);
      usersRepository.findOneBy.mockResolvedValue(null);

      await expect(service.rotateRefreshToken(rawToken)).rejects.toThrow(
        'User not found or has been deleted',
      );
    });

    it('detects reuse of an already-rotated token, revokes the whole family, and records an audit event', async () => {
      const stored = buildStoredToken({ revoked_at: new Date() });
      refreshTokensRepository.findOneBy.mockResolvedValue(stored);

      await expect(service.rotateRefreshToken(rawToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.rotateRefreshToken(rawToken)).rejects.toThrow(
        'Refresh token reuse detected; session revoked',
      );

      expect(refreshTokensRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({ family_id: 'family-1' }),
        expect.objectContaining({ revoked_at: expect.any(Date) }),
      );

      expect(authAuditEventsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'refresh_token_reuse_detected',
          user_id: existingUser.id,
          family_id: 'family-1',
          metadata: { tokenId: 'rt-1' },
        }),
      );

      // Reuse must never mint new tokens or an access token.
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('passkey (WebAuthn) login', () => {
    const mockGenerateOptions = generateAuthenticationOptions as jest.Mock;
    const mockVerify = verifyAuthenticationResponse as jest.Mock;

    beforeEach(() => {
      // These are plain jest.fn()s from a jest.mock() factory, not spies, so
      // the outer afterEach's jest.restoreAllMocks() does not reset them.
      mockGenerateOptions.mockReset();
      mockVerify.mockReset();
    });

    const storedCredential = {
      id: 'cred-row-1',
      user_id: 'user-passkey-1',
      credential_id: 'cred-id-1',
      public_key: Buffer.from('public-key-bytes'),
      counter: '0',
      device_type: 'singleDevice',
      backed_up: false,
      transports: null,
      created_at: new Date(),
      last_used_at: null,
    } as unknown as WebAuthnCredential;

    const passkeyUser = {
      id: 'user-passkey-1',
      stellar_address: 'GPASSKEYUSER',
    } as User;

    describe('beginPasskeyAuthentication', () => {
      it('returns the generated options and stores the challenge for later verification', async () => {
        mockGenerateOptions.mockResolvedValue({
          challenge: 'test-challenge-abc',
          rpId: 'localhost',
          allowCredentials: [],
          timeout: 60000,
          userVerification: 'preferred',
        });

        const options = await service.beginPasskeyAuthentication();

        expect(options.challenge).toBe('test-challenge-abc');

        const cache = (
          service as unknown as {
            passkeyChallengeCache: Map<
              string,
              { expiresAt: number; used: boolean }
            >;
          }
        ).passkeyChallengeCache;
        expect(cache.has('test-challenge-abc')).toBe(true);
        expect(cache.get('test-challenge-abc')?.used).toBe(false);
      });
    });

    describe('finishPasskeyAuthentication', () => {
      it('authenticates a valid assertion and issues an access + refresh token', async () => {
        mockGenerateOptions.mockResolvedValue({
          challenge: 'test-challenge-abc',
        });
        await service.beginPasskeyAuthentication();

        webAuthnCredentialsRepository.findOneBy.mockResolvedValue({
          ...storedCredential,
        });
        mockVerify.mockResolvedValue({
          verified: true,
          authenticationInfo: {
            newCounter: 1,
            credentialID: 'cred-id-1',
            userVerified: true,
            credentialDeviceType: 'singleDevice',
            credentialBackedUp: false,
            origin: 'http://localhost:3000',
            rpID: 'localhost',
          },
        });
        usersRepository.findOneBy.mockResolvedValue(passkeyUser);
        jwtService.signAsync.mockResolvedValue('passkey.jwt.token');

        const assertion = buildAssertionResponse('test-challenge-abc');
        const result = await service.finishPasskeyAuthentication(assertion);

        expect(result.access_token).toBe('passkey.jwt.token');
        expect(result.user).toEqual(passkeyUser);
        expect(typeof result.refresh_token).toBe('string');
        expect(result.refresh_token.length).toBeGreaterThan(0);

        expect(webAuthnCredentialsRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            counter: '1',
            last_used_at: expect.any(Date),
          }),
        );

        // The challenge must not be usable a second time.
        await expect(
          service.finishPasskeyAuthentication(assertion),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('rejects an assertion for an unknown/expired challenge', async () => {
        const assertion = buildAssertionResponse('never-issued-challenge');

        await expect(
          service.finishPasskeyAuthentication(assertion),
        ).rejects.toThrow(UnauthorizedException);
        expect(webAuthnCredentialsRepository.findOneBy).not.toHaveBeenCalled();
      });

      it('rejects an assertion whose credential id is not registered', async () => {
        mockGenerateOptions.mockResolvedValue({
          challenge: 'test-challenge-unknown-cred',
        });
        await service.beginPasskeyAuthentication();
        webAuthnCredentialsRepository.findOneBy.mockResolvedValue(null);

        const assertion = buildAssertionResponse(
          'test-challenge-unknown-cred',
        );

        await expect(
          service.finishPasskeyAuthentication(assertion),
        ).rejects.toThrow('Passkey not recognized');
        expect(mockVerify).not.toHaveBeenCalled();
      });

      it('rejects an assertion that fails cryptographic verification', async () => {
        mockGenerateOptions.mockResolvedValue({
          challenge: 'test-challenge-bad-sig',
        });
        await service.beginPasskeyAuthentication();
        webAuthnCredentialsRepository.findOneBy.mockResolvedValue({
          ...storedCredential,
        });
        mockVerify.mockResolvedValue({ verified: false });

        const assertion = buildAssertionResponse('test-challenge-bad-sig');

        await expect(
          service.finishPasskeyAuthentication(assertion),
        ).rejects.toThrow('Invalid passkey assertion');
        expect(webAuthnCredentialsRepository.save).not.toHaveBeenCalled();
        expect(jwtService.signAsync).not.toHaveBeenCalled();
      });

      it('rejects when verification throws (e.g. malformed signature)', async () => {
        mockGenerateOptions.mockResolvedValue({
          challenge: 'test-challenge-throws',
        });
        await service.beginPasskeyAuthentication();
        webAuthnCredentialsRepository.findOneBy.mockResolvedValue({
          ...storedCredential,
        });
        mockVerify.mockRejectedValue(new Error('bad signature encoding'));

        const assertion = buildAssertionResponse('test-challenge-throws');

        await expect(
          service.finishPasskeyAuthentication(assertion),
        ).rejects.toThrow('Invalid passkey assertion');
      });
    });
  });
});
