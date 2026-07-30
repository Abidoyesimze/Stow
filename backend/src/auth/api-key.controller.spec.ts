import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { User } from '../users/entities/user.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

describe('ApiKeyController', () => {
  let controller: ApiKeyController;
  let apiKeyService: jest.Mocked<ApiKeyService>;

  beforeEach(async () => {
    apiKeyService = {
      create: jest.fn(),
      listForUser: jest.fn(),
      revoke: jest.fn(),
    } as unknown as jest.Mocked<ApiKeyService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeyController],
      providers: [
        {
          provide: ApiKeyService,
          useValue: apiKeyService,
        },
      ],
    }).compile();

    controller = module.get<ApiKeyController>(ApiKeyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an API key with scopes', async () => {
      const mockUser = { id: 'user123' } as User;
      const dto: CreateApiKeyDto = {
        name: 'Test Key',
        scopes: ['read', 'write'],
      };
      const expectedResponse = {
        id: 'key1',
        name: 'Test Key',
        key: 'ia_rawkey',
        key_prefix: 'ia_rawk',
        scopes: ['read', 'write'],
        expires_at: null,
        created_at: new Date(),
      };

      apiKeyService.create.mockResolvedValue(expectedResponse);

      const result = await controller.create(mockUser, dto);

      expect(apiKeyService.create).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual(expectedResponse);
    });
  });
});
