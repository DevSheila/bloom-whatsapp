import { Body, Controller, Get, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { Request } from 'express';

import * as process from 'node:process';
import { WhatsappService } from './whatsapp.service';
import { StabilityaiService } from 'src/stabilityai/stabilityai.service';
import { OpenaiService } from 'src/openai/openai.service';

@Controller('whatsapp')
export class WhatsappController {

  constructor(
    private readonly whatsAppService: WhatsappService,
    private readonly stabilityaiService: StabilityaiService,
    private readonly openaiService: OpenaiService,
    
  ) {}
  private readonly logger = new Logger(WhatsappController.name);

  @Get('webhook')
  whatsappVerificationChallenge(@Req() request: Request) {
    const mode = request.query['hub.mode'];
    const challenge = request.query['hub.challenge'];
    const token = request.query['hub.verify_token'];

    const verificationToken =
      process.env.WHATSAPP_CLOUD_API_WEBHOOK_VERIFICATION_TOKEN;

    if (!mode || !token) {
      return 'Error verifying token';
    }

    if (mode === 'subscribe' && token === verificationToken) {
      return challenge?.toString();
    }
  }

  @Post('webhook')
  @HttpCode(200)
  async handleIncomingWhatsappMessage(@Body() request: any) {
    const { messages } = request?.entry?.[0]?.changes?.[0].value ?? {};
    if (!messages) return;

    const message = messages[0];
    const messageSender = message.from;
    const messageID = message.id;
    this.logger.log(JSON.stringify(message, null, 2));

    // await this.whatsAppService.markMessageAsRead(messageID);

    switch (message.type) {
      case 'text':
        const text = message.text.body;
        const imageGenerationCommand = '/imagine';
        if (text.toLowerCase().includes(imageGenerationCommand)) {
          const response = await this.stabilityaiService.textToImage(
            text.replaceAll(imageGenerationCommand, ''),
          );

          if (Array.isArray(response)) {
            await this.whatsAppService.sendImageByUrl(
              messageSender,
              response[0],
              messageID,
            );
          }
          return;
        }

        await this.whatsAppService.sendWhatsAppMessage(
          messageSender,
          text,
          messageID,
        );
        break;
      case 'audio':
        const audioID = message.audio.id;
        await this.whatsAppService.downloadMedia(audioID, message.type);
        break;
      case 'image':
        const mediaID = message.image.id;
        const mediaData = await this.whatsAppService.downloadMedia(
          mediaID,
          message.type,
        );

        if (mediaData.status === 'success') {
          const openaiResponse = await this.openaiService.analyzeImage(
            messageSender,
            mediaData.data,
            message.image.caption
          );

          await this.whatsAppService.sendAnalyzedImageWhatsAppMessage(
            messageSender,
            openaiResponse,
            messageID,
          );
        }
        break;
    }

    return 'Message processed';
  }
}
