import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Readable } from 'stream';
import type { Request } from 'express';
import { ZodValidationPipe } from 'src/middleware/zod-validation.pipe';
import { SourceSubmissionService } from './source-submission.service';
import { CheckDuplicateDto, SubmitUrlDto } from './input-dto/submit-url.dto';

type RequestWithJwtUser = Request & { user?: { id?: string } };

const MAX_FILE_MB = Number(process.env.UPLOAD_MAX_FILE_MB ?? 20);

@ApiTags('Source Submission (User)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'))
@Controller('sources/submissions')
export class SourceSubmissionController {
  constructor(private readonly service: SourceSubmissionService) {}

  @ApiOperation({ summary: '링크 투고' })
  @Post()
  submitUrl(
    @Req() req: RequestWithJwtUser,
    @Body(new ZodValidationPipe(SubmitUrlDto.schema)) dto: SubmitUrlDto,
  ) {
    return this.service.submitUrl(this.userId(req), dto);
  }

  @ApiOperation({ summary: '파일 투고 (PDF · MD)' })
  @ApiConsumes('multipart/form-data')
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_MB * 1024 * 1024 } }),
  )
  submitFile(
    @Req() req: RequestWithJwtUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('name') name: string,
    @Body('reason') reason?: string,
  ) {
    if (!file) throw new BadRequestException('파일이 없습니다.');

    // 제목은 multipart 라 zod 파이프를 안 거친다. 여기서 본다.
    const title = String(name ?? '').trim();
    if (!title) throw new BadRequestException('제목을 적어 주세요.');
    if (title.length > 200) throw new BadRequestException('제목은 200자까지입니다.');

    return this.service.submitFile(
      this.userId(req),
      Readable.from(file.buffer),
      file.originalname,
      title,
      reason,
    );
  }

  @ApiOperation({ summary: '같은 자료가 이미 있는지 확인 (링크)' })
  @Post('check')
  check(
    @Req() req: RequestWithJwtUser,
    @Body(new ZodValidationPipe(CheckDuplicateDto.schema)) dto: CheckDuplicateDto,
  ) {
    return this.service.checkUrl(this.userId(req), dto.url);
  }

  @ApiOperation({ summary: '내 투고 목록' })
  @Get('mine')
  listMine(@Req() req: RequestWithJwtUser) {
    return this.service.listMine(this.userId(req));
  }

  private userId(req: RequestWithJwtUser): string {
    const id = String(req.user?.id ?? '').trim();
    if (!id) throw new UnauthorizedException('로그인이 필요합니다.');
    return id;
  }
}
