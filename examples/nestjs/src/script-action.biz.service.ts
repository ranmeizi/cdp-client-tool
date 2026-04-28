import { Injectable } from '@nestjs/common';
import { CctActionsService } from '@bomon/nestjs-cct-explorer';

@Injectable()
export class ScriptActionBizService {
  constructor(private readonly cctActionsService: CctActionsService) {}

  /**
   * 业务层示例：下发本地脚本并等待 report_result 回传结果。
   */
  async runBaiduScreenshotAction(device: string) {
    console.log('[ScriptActionBizService] runBaiduScreenshotAction start', { device });
    try {
      const result = await this.cctActionsService.runLocalScriptAction(
        device,
        { filename: 'baidu_screenshot.cjs' },
        { timeoutMs: 360000 },
      );
      console.log('[ScriptActionBizService] runBaiduScreenshotAction success', {
        device,
        result,
      });
      return result;
    } catch (error) {
      console.error('[ScriptActionBizService] runBaiduScreenshotAction failed', {
        device,
        error,
      });
      throw error;
    }
  }
}
