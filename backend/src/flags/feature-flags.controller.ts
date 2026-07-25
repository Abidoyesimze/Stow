import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { FeatureFlagsService, ResolvedFlagDto } from './feature-flags.service';
import { CreateFeatureFlagDto } from './dto/create-feature-flag.dto';
import { FeatureFlag } from './entities/feature-flag.entity';

@ApiTags('Feature Flags')
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new feature flag (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Flag created',
    type: FeatureFlag,
  })
  @ApiResponse({ status: 409, description: 'Flag key already exists' })
  async create(@Body() dto: CreateFeatureFlagDto): Promise<FeatureFlag> {
    return this.featureFlagsService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a feature flag (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Flag updated',
    type: FeatureFlag,
  })
  @ApiResponse({ status: 404, description: 'Flag not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateFeatureFlagDto>,
  ): Promise<FeatureFlag> {
    return this.featureFlagsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a feature flag (admin only)' })
  @ApiResponse({ status: 200, description: 'Flag deleted' })
  @ApiResponse({ status: 404, description: 'Flag not found' })
  async delete(@Param('id') id: string): Promise<{ message: string }> {
    await this.featureFlagsService.delete(id);
    return { message: `Feature flag ${id} deleted` };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all feature flags (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'All feature flags',
    type: [FeatureFlag],
  })
  async findAll(): Promise<FeatureFlag[]> {
    return this.featureFlagsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single feature flag (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag details',
    type: FeatureFlag,
  })
  @ApiResponse({ status: 404, description: 'Flag not found' })
  async findOne(@Param('id') id: string): Promise<FeatureFlag> {
    return this.featureFlagsService.findOne(id);
  }

  @Get('resolve/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Resolve all feature flags for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Resolved flags for the current user',
  })
  async resolveForCurrentUser(
    @CurrentUser() user: User,
  ): Promise<ResolvedFlagDto[]> {
    return this.featureFlagsService.resolveFlagsForUser(user);
  }

  @Get('resolve/:key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Resolve a single feature flag for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Resolved flag for the current user',
  })
  @ApiResponse({ status: 404, description: 'Flag key not found' })
  async resolveSingleFlag(
    @Param('key') key: string,
    @CurrentUser() user: User,
  ): Promise<ResolvedFlagDto> {
    const result = await this.featureFlagsService.resolveFlagForUser(key, user);
    if (!result) {
      return {
        key,
        name: key,
        is_enabled: false,
        targeting_type: null,
        targeting_rules: null,
      };
    }
    return result;
  }
}
