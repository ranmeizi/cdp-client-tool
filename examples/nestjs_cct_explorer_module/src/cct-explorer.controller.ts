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
import { join } from 'node:path';
import { DeviceGateway } from './device-gateway.interface';
import {
  DEVICE_GATEWAY_TOKEN,
  CCT_EXPLORER_OPTIONS,
  CctExplorerModuleOptions,
} from './tokens';
import { parseVirtualPath } from './path-utils';

@Controller()
export class CctExplorerController {
  constructor(
    @Inject(DEVICE_GATEWAY_TOKEN)
    private readonly gateway: DeviceGateway,
    @Inject(CCT_EXPLORER_OPTIONS)
    private readonly options: CctExplorerModuleOptions,
  ) {}

  @Get('browser')
  async renderBrowser(@Res() res: Response) {
    const filePath = join(__dirname, 'public', 'browser.html');
    res.sendFile(filePath);
  }

  @Get('api/devices')
  async getDevices() {
    const devices = await this.gateway.listDevices();
    return { devices };
  }

  @Get('api/fs/dir')
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

  @Get('api/fs/file')
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

  @Delete('api/fs/file')
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

  @Post('api/fs/file')
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
}
