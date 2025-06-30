import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AutoScalingService, AutoScalingConfig } from './auto-scaling.service';

export class UpdateAutoScalingConfigDto {
  scaleUpThreshold?: number;
  scaleDownThreshold?: number;
  minNodes?: number;
  maxNodes?: number;
  cooldownPeriod?: number;
  checkInterval?: number;
}

@Controller('api/auto-scaling')
export class AutoScalingController {
  constructor(private autoScalingService: AutoScalingService) {}

  @Get('stats')
  async getAutoScalingStats() {
    try {
      const stats = await this.autoScalingService.getAutoScalingStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to fetch auto-scaling statistics',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('config')
  async getConfig() {
    try {
      const stats = await this.autoScalingService.getAutoScalingStats();
      return {
        success: true,
        data: stats.config,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to fetch auto-scaling configuration',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('config')
  async updateConfig(@Body() updateDto: UpdateAutoScalingConfigDto) {
    try {
      const updatedConfig =
        await this.autoScalingService.updateConfig(updateDto);
      return {
        success: true,
        message: 'Auto-scaling configuration updated successfully',
        data: updatedConfig,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to update auto-scaling configuration',
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('scale-up')
  async manualScaleUp() {
    try {
      await this.autoScalingService.manualScaleUp();
      return {
        success: true,
        message: 'Manual scale up executed successfully',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to execute manual scale up',
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('scale-down')
  async manualScaleDown() {
    try {
      await this.autoScalingService.manualScaleDown();
      return {
        success: true,
        message: 'Manual scale down executed successfully',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to execute manual scale down',
          error: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('nodes/count')
  async getCurrentNodeCount() {
    try {
      const nodeCount = await this.autoScalingService.getCurrentNodeCount();
      return {
        success: true,
        data: {
          currentNodes: nodeCount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'Failed to fetch current node count',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
