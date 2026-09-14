import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/role';
import { RolesGuard } from 'src/middleware/roles.guard';
import { SourceRegistryService } from './source-registry.service';

type Req2 = Request & { user?: { id?: string } };

/**
 * 소스 관리 (관리자).
 * 기획: apps/docs/source-registry/1-work-guidelines.md · 구현서 §5·§6
 * 경로 하나하나에 @Roles(Role.ADMIN) 을 건다 — 컨트롤러 레벨 가드는 쓰지 않는다.
 */
@ApiTags('Source Registry (Admin)')
@ApiBearerAuth('access-token')
@Controller('admin/registry')
export class SourceRegistryController {
  constructor(private readonly service: SourceRegistryService) {}

  @ApiOperation({ summary: '[ADMIN] 표 목록' })
  @Get('tables')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  tables() {
    return this.service.tables();
  }

  @ApiOperation({ summary: '[ADMIN] 한 표의 칼럼·행' })
  @Get('tables/:key')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  table(@Param('key') key: string) {
    return this.service.table(key);
  }

  @ApiOperation({ summary: '[ADMIN] 칸 하나 고치기' })
  @Patch('rows/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  setCell(@Param('id') id: string, @Body() body: { key: string; value: unknown }) {
    return this.service.setCell(id, body?.key, body?.value);
  }

  @ApiOperation({ summary: '[ADMIN] 행 추가' })
  @Post('tables/:key/rows')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  addRow(@Req() req: Req2, @Param('key') key: string) {
    const id = String(req.user?.id ?? '').trim();
    if (!id) throw new UnauthorizedException('로그인이 필요합니다.');
    return this.service.addRow(key, id);
  }

  @ApiOperation({ summary: '[ADMIN] 행 삭제 (소프트)' })
  @Delete('rows/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  removeRow(@Param('id') id: string) {
    return this.service.removeRow(id);
  }

  @ApiOperation({ summary: '[ADMIN] 칼럼 추가' })
  @Post('tables/:key/fields')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  addField(@Param('key') key: string, @Body() body: { label: string; kind: any }) {
    return this.service.addField(key, body);
  }

  @ApiOperation({ summary: '[ADMIN] 칼럼 이름·선택지 고치기' })
  @Patch('fields/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  updateField(@Param('id') id: string, @Body() body: { label?: string; options?: string[] }) {
    return this.service.updateField(id, body);
  }
}
