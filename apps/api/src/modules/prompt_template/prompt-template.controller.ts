import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { RolesGuard } from 'src/middleware/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/role';
import { ZodValidationPipe } from 'src/middleware/zod-validation.pipe';
import { PromptTemplateService } from './prompt-template.service';
import { CreateTemplateDto } from './input-dto/create-template.dto';
import { UpdateTemplateDto } from './input-dto/update-template.dto';
import { CreateVersionDto } from './input-dto/create-version.dto';
import { UpdateVersionDto } from './input-dto/update-version.dto';

@ApiTags('Prompt Template (Admin)')
// @ApiBearerAuth('access-token')
// @UseGuards(AuthGuard('jwt'), RolesGuard)
// @Roles(Role.ADMIN)
@Controller('prompt-templates')
export class PromptTemplateController {
  constructor(private readonly service: PromptTemplateService) {}

  /* ═══ 템플릿 ═══ */

  @ApiOperation({ summary: '전체 템플릿 목록 (버전 포함)' })
  @Get('list')
  getAllTemplates() {
    return this.service.findAll();
  }

  @ApiOperation({ summary: '템플릿 목록 조회 (type 기준, 버전 포함)' })
  @ApiParam({ name: 'type', enum: ['ARTICLE_AI', 'NEWSLETTER', 'CONCEPT_PAGE', 'REFINE'] })
  @Get('by-type/:type')
  getTemplatesByType(@Param('type') type: string) {
    return this.service.findByType(type);
  }

  @ApiOperation({ summary: '템플릿 생성 (+ 초기 버전 A)' })
  @Post('create')
  createTemplate(
    @Body(new ZodValidationPipe(CreateTemplateDto.schema)) dto: CreateTemplateDto,
  ) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: '템플릿 메타 수정 (name, description, tone_text)' })
  @Patch(':id/patch')
  updateTemplate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTemplateDto.schema)) dto: UpdateTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: '템플릿 소프트 삭제' })
  @Delete(':id/delete')
  deleteTemplate(@Param('id') id: string) {
    return this.service.softDelete(id);
  }

  /* ═══ 버전 ═══ */

  @ApiOperation({ summary: '버전 목록 조회 (code 기준)' })
  @Get(':code/versions')
  getVersionsByCode(@Param('code') code: string) {
    return this.service.findVersionsByCode(code);
  }

  @ApiOperation({ summary: '버전 추가 (B, C, D... 자동 태그)' })
  @Post(':id/add-new-versions')
  addVersion(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(CreateVersionDto.schema)) dto: CreateVersionDto,
  ) {
    return this.service.createVersion(id, dto);
  }

  @ApiOperation({ summary: '버전 수정 (prompt_text, parameters 등)' })
  @Patch(':id/versions/:versionId/patch')
  updateVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Body(new ZodValidationPipe(UpdateVersionDto.schema)) dto: UpdateVersionDto,
  ) {
    return this.service.updateVersion(id, versionId, dto);
  }

  @ApiOperation({ summary: '활성 버전 지정' })
  @Patch(':id/versions/:versionId/activate')
  activateVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.service.activateVersion(id, versionId);
  }

  @ApiOperation({ summary: '버전 소프트 삭제' })
  @Delete(':id/versions/:versionId/delete')
  deleteVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.service.softDeleteVersion(id, versionId);
  }
}
