import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/role';
import { RolesGuard } from 'src/middleware/roles.guard';
import { LoadPreviewService } from './load-preview.service';
import { SourceSubmissionService } from './source-submission.service';
import { UploadGateService } from './upload-gate.service';

type RequestWithJwtUser = Request & { user?: { id?: string } };

/**
 * 투고 검토 (관리자).
 * 기획: apps/docs/source-submission/1-work-guidelines.md §9
 *
 * 경로 하나하나에 @Roles(Role.ADMIN) 을 건다 — 컨트롤러 레벨 가드는 쓰지 않는다.
 */
@ApiTags('Source Submission (Admin)')
@ApiBearerAuth('access-token')
@Controller('admin/submissions')
export class AdminSubmissionController {
  constructor(
    private readonly service: SourceSubmissionService,
    private readonly gate: UploadGateService,
    private readonly preview: LoadPreviewService,
  ) {}

  @ApiOperation({ summary: '[ADMIN] 투고 목록' })
  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  list(@Query('kind') kind?: 'FILE' | 'URL', @Query('status') status?: string) {
    return this.service.adminList(kind, status);
  }

  @ApiOperation({ summary: '[ADMIN] 투고 상세 (파일 본문은 주지 않는다)' })
  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  detail(@Param('id') id: string) {
    return this.service.adminGet(id);
  }

  @ApiOperation({ summary: '[ADMIN] 원문 보기' })
  @Get(':id/view')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async view(@Param('id') id: string, @Res() res: Response) {
    await this.send(id, res, false);
  }

  @ApiOperation({ summary: '[ADMIN] 내려받기' })
  @Get(':id/download')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async download(@Param('id') id: string, @Res() res: Response) {
    await this.send(id, res, true);
  }

  @ApiOperation({ summary: '[ADMIN] 분석 시작' })
  @Post(':id/analyze')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  analyze(@Param('id') id: string) {
    return this.service.startAnalysis(id);
  }

  @ApiOperation({ summary: '[ADMIN] 분석 상태' })
  @Get(':id/analysis')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  analysis(@Param('id') id: string) {
    return this.service.getAnalysis(id);
  }

  @ApiOperation({ summary: '[ADMIN] 적재 미리보기' })
  @Get(':id/load-preview')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  async loadPreview(@Param('id') id: string) {
    return this.preview.build(await this.service.loadPreviewRow(id));
  }

  @ApiOperation({ summary: '[ADMIN] 승인' })
  @Post(':id/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  approve(@Req() req: RequestWithJwtUser, @Param('id') id: string) {
    return this.service.decide(id, 'APPROVED', this.adminId(req));
  }

  @ApiOperation({ summary: '[ADMIN] 유보' })
  @Post(':id/hold')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  hold(@Req() req: RequestWithJwtUser, @Param('id') id: string) {
    return this.service.decide(id, 'ON_HOLD', this.adminId(req));
  }

  @ApiOperation({ summary: '[ADMIN] 반려' })
  @Post(':id/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  reject(@Req() req: RequestWithJwtUser, @Param('id') id: string) {
    return this.service.decide(id, 'REJECTED', this.adminId(req));
  }

  @ApiOperation({ summary: '[ADMIN] 조사 목록 JSON 내보내기' })
  @Post('export')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.ADMIN)
  export(@Body('ids') ids: string[]) {
    return this.service.exportLinks(Array.isArray(ids) ? ids : []);
  }

  /* ── 내부 ── */

  /**
   * 파일을 내려준다. 폴더를 웹 서버가 직접 서빙하지 않고 API 가 읽어 보낸다.
   * 붙이는 헤더의 이유는 기획 §6-B.
   */
  private async send(id: string, res: Response, asAttachment: boolean) {
    const f = await this.service.adminFile(id);
    const kind = f.mime.startsWith('application/pdf') ? 'pdf' : 'md';
    res.set(this.gate.safeHeaders(kind));
    if (asAttachment) {
      // 파일 이름은 유저가 지은 것이다. 헤더에 그대로 넣지 않고 인코딩해서 붙인다.
      res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.fileName)}`);
    }
    f.stream.pipe(res);
  }

  private adminId(req: RequestWithJwtUser): string {
    const id = String(req.user?.id ?? '').trim();
    if (!id) throw new UnauthorizedException('로그인이 필요합니다.');
    return id;
  }
}
