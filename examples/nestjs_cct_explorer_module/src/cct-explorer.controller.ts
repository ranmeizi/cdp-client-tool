import {
  Controller,
  Get,
  Delete,
  Post,
  Query,
  Body,
  Inject,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DeviceGateway } from './device-gateway.interface';
import {
  DEVICE_GATEWAY_TOKEN,
  CCT_EXPLORER_OPTIONS,
  CctExplorerModuleOptions,
} from './tokens';
import { parseVirtualPath } from './path-utils';
import { DeviceQueueCacheService } from './device-queue-cache.service';

@Controller()
export class CctExplorerController {
  constructor(
    @Inject(DEVICE_GATEWAY_TOKEN)
    private readonly gateway: DeviceGateway,
    @Inject(CCT_EXPLORER_OPTIONS)
    private readonly options: CctExplorerModuleOptions,
    private readonly queueCache: DeviceQueueCacheService,
  ) {}

  @Get('devices')
  async getDevices() {
    const devices = await this.gateway.listDevices();
    const enriched = devices.map((d) => {
      const state = this.queueCache.getState(d.name);
      return {
        ...d,
        scriptQueue: state?.snapshot ?? null,
        queueUpdatedAt: state?.updatedAt ?? null,
        queueError: state?.error ?? null,
      };
    });
    return { devices: enriched };
  }

  @Get('fs/dir')
  async readDir(
    @Query('device') device: string,
    @Query('path') virtualPath = '',
  ) {
    if (!device || !virtualPath) {
      throw new HttpException(
        { code: '400', message: '缺少 device 或 path' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const parsed = parseVirtualPath(device, virtualPath);
    if ('error' in parsed) {
      throw new HttpException(
        { code: String(parsed.code), message: parsed.error },
        parsed.code,
      );
    }
    const entries = await this.gateway.readDir(device, parsed.devicePath);
    return { entries };
  }

  @Get('fs/file')
  async readFile(
    @Query('device') device: string,
    @Query('path') virtualPath = '',
    @Res() res: Response,
  ) {
    if (!device || !virtualPath) {
      throw new HttpException(
        { code: '400', message: '缺少 device 或 path' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const parsed = parseVirtualPath(device, virtualPath);
    if ('error' in parsed) {
      throw new HttpException(
        { code: String(parsed.code), message: parsed.error },
        parsed.code,
      );
    }
    let buf: Buffer;
    try {
      buf = await this.gateway.readFile(device, parsed.devicePath);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (err?.message === 'file_not_found') {
        throw new HttpException(
          { code: '404', message: '文件不存在' },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        { code: '500', message: (err?.message as string) || '读取文件失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    const filename = virtualPath.split('/').pop() || 'file';
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const mime: Record<string, string> = {
      '.js': 'application/javascript',
      '.mjs': 'application/javascript',
      '.ts': 'application/typescript',
      '.json': 'application/json',
      '.html': 'text/html',
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };
    res.setHeader(
      'Content-Type',
      mime[ext] || 'application/octet-stream',
    );
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(filename)}"`,
    );
    res.send(buf);
  }

  @Delete('fs/file')
  async deleteFile(
    @Query('device') device: string,
    @Query('path') virtualPath = '',
  ) {
    if (!device || !virtualPath) {
      throw new HttpException(
        { code: '400', message: '缺少 device 或 path' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const parsed = parseVirtualPath(device, virtualPath);
    if ('error' in parsed) {
      throw new HttpException(
        { code: String(parsed.code), message: parsed.error },
        parsed.code,
      );
    }
    await this.gateway.removeFile(device, parsed.devicePath);
    return { ok: true, message: 'deleted' };
  }

  @Post('fs/file')
  async writeFile(
    @Body('device') device: string,
    @Body('path') virtualPath = '',
    @Body('content') content: string,
  ) {
    if (!this.gateway.writeFile) {
      throw new HttpException(
        { code: '400', message: '当前网关未实现写文件能力' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!device || !virtualPath) {
      throw new HttpException(
        { code: '400', message: '缺少 device 或 path' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const parsed = parseVirtualPath(device, virtualPath);
    if ('error' in parsed) {
      throw new HttpException(
        { code: String(parsed.code), message: parsed.error },
        parsed.code,
      );
    }
    await this.gateway.writeFile(device, parsed.devicePath, content ?? '');
    return { ok: true, message: 'saved' };
  }

  @Post('scripts/interrupt')
  async interruptScript(
    @Body('device') device: string,
    @Body('jobId') jobId: string,
  ) {
    if (!device || !jobId) {
      throw new HttpException(
        { code: '400', message: '缺少 device 或 jobId' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!this.gateway.interruptScript) {
      throw new HttpException(
        { code: '400', message: '当前网关未实现中断能力' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const result = await this.gateway.interruptScript(device, jobId);
    if (!result.ok) {
      throw new HttpException(
        { code: '400', message: result.reason || '中断失败' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return { ok: true };
  }

  @Post('scripts/undo')
  async undoScript(
    @Body('device') device: string,
    @Body('jobId') jobId: string,
  ) {
    if (!device || !jobId) {
      throw new HttpException(
        { code: '400', message: '缺少 device 或 jobId' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!this.gateway.undoScript) {
      throw new HttpException(
        { code: '400', message: '当前网关未实现撤销能力' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const result = await this.gateway.undoScript(device, jobId);
    if (!result.ok) {
      throw new HttpException(
        { code: '400', message: result.reason || '撤销失败' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return { ok: true };
  }

  @Get('scripts/queue')
  async getScriptQueue(@Query('device') device: string) {
    if (!this.gateway.getScriptQueue) {
      throw new HttpException(
        { code: '400', message: '当前网关未实现队列查询能力' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!device) {
      throw new HttpException(
        { code: '400', message: '缺少 device' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const cached = this.queueCache.getState(device);
    if (cached?.snapshot && Date.now() - cached.updatedAt < 2000) {
      return cached.snapshot;
    }
    const snapshot = await this.gateway.getScriptQueue(device);
    return snapshot;
  }
}
