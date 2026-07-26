import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiKeyService } from './api-key.service';
import { ApiKey } from './entities/api-key.entity';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';

jest.mock('bcrypt');

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let repository: any;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        {
          provide: getRepositoryToken(ApiKey),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
  });

  describe('create', () => {
    it('should create an API key with scopes', async () => {
      const mockDto = { name: 'Test Key', scopes: ['read:test', 'write:test'] };
      const mockApiKey = {
        id: 'key123',
        name: mockDto.name,
        key_prefix: 'ia_abcdef',
        scopes: mockDto.scopes,
        created_at: new Date(),
      };

      repository.create.mockReturnValue(mockApiKey);
      repository.save.mockResolvedValue(mockApiKey);

      const result = await service.create('user123', mockDto);

      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user123',
        name: mockDto.name,
        scopes: mockDto.scopes,
      }));
      expect(result.scopes).toEqual(mockDto.scopes);
      expect(result.id).toBe(mockApiKey.id);
    });
  });

  describe('validateKey', () => {
    it('should successfully validate an existing unrevoked key', async () => {
      const rawKey = 'ia_validkey12345';
      const mockApiKey = {
        id: 'key123',
        key_hash: 'hashed',
        revoked_at: null,
        expires_at: null,
      };

      repository.find.mockResolvedValue([mockApiKey]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateKey(rawKey);
      expect(result).toEqual(mockApiKey);
    });

    it('should throw UnauthorizedException for an invalid format', async () => {
      await expect(service.validateKey('invalidformat')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if no candidate matches', async () => {
      repository.find.mockResolvedValue([]);
      await expect(service.validateKey('ia_validkey12345')).rejects.toThrow(UnauthorizedException);
    });
  });
});
