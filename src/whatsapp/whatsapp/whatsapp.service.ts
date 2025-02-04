import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { catchError, lastValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { OpenaiService } from 'src/openai/openai.service';
import axios, { AxiosRequestConfig } from 'axios';
import * as path from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Injectable()
export class WhatsappService {
  constructor(
    private readonly openaiService: OpenaiService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private readonly httpService = new HttpService();
  private readonly logger = new Logger(WhatsappService.name);
  private readonly url = `https://graph.facebook.com/${process.env.WHATSAPP_CLOUD_API_VERSION}/${process.env.WHATSAPP_CLOUD_API_PHONE_NUMBER_ID}/messages`;
  private readonly config = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_API_ACCESS_TOKEN}`,
    },
  };

  async sendWhatsAppMessage(
    messageSender: string,
    userInput: string,
    messageID: string,
  ) {
    const aiResponse = await this.openaiService.generateAIResponse(
      messageSender,
      userInput,
    );

    const data = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: messageSender,
      context: {
        message_id: messageID,
      },
      type: 'text',
      text: {
        preview_url: false,
        body: aiResponse,
      },
    });

    try {
      const response = this.httpService
        .post(this.url, data, this.config)
        .pipe(
          map((res) => {
            return res.data;
          }),
        )
        .pipe(
          catchError((error) => {
            this.logger.log(`WhatsApp API URL: ${this.url}`);
            this.logger.error(
              'WhatsApp API Error:',
              error.response?.data || error.message,
            );

            // this.logger.error(error);
            throw new BadRequestException(
              'Error Posting To WhatsApp Cloud API',
            );
          }),
        );

      const messageSendingStatus = await lastValueFrom(response);
      this.logger.log('Message Sent. Status:', messageSendingStatus);
    } catch (error) {
      this.logger.error(error);
      return 'Axle broke!! Abort mission!!';
    }
  }
  async sendAnalyzedImageWhatsAppMessage(
    messageSender: string,
    aiResponse: string,
    messageID: string,
  ) {


    const data = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: messageSender,
      context: {
        message_id: messageID,
      },
      type: 'text',
      text: {
        preview_url: false,
        body: aiResponse,
      },
    });

    try {
      const response = this.httpService
        .post(this.url, data, this.config)
        .pipe(
          map((res) => {
            return res.data;
          }),
        )
        .pipe(
          catchError((error) => {
            this.logger.log(`WhatsApp API URL: ${this.url}`);
            this.logger.error(
              'WhatsApp API Error:',
              error.response?.data || error.message,
            );

            // this.logger.error(error);
            throw new BadRequestException(
              'Error Posting To WhatsApp Cloud API',
            );
          }),
        );

      const messageSendingStatus = await lastValueFrom(response);
      this.logger.log('Message Sent. Status:', messageSendingStatus);
    } catch (error) {
      this.logger.error(error);
      return 'Axle broke!! Abort mission!!';
    }
  }

  async sendImageByUrl(
    messageSender: string,
    fileName: string,
    messageID: string,
  ) {
    const imageUrl = `${process.env.SERVER_URL}/${fileName}`;
    const data = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: messageSender,
      context: {
        message_id: messageID,
      },
      type: 'image',
      image: {
        link: imageUrl,
      },
    });

    try {
      const response = this.httpService
        .post(this.url, data, this.config)
        .pipe(
          map((res) => {
            return res.data;
          }),
        )
        .pipe(
          catchError((error) => {
            this.logger.error(error);
            throw new BadRequestException(
              'Error Posting To WhatsApp Cloud API',
            );
          }),
        );

      const messageSendingStatus = await lastValueFrom(response);

      return `Image sent successfully, response: ${messageSendingStatus}`;
    } catch (error) {
      this.logger.error(error);
      return 'Axle broke!! Error Sending Image!!';
    }
  }

  async getMediaUrl(
    mediaID: string,
  ): Promise<{ status: 'error' | 'success'; data: string }> {
    try {
      const url = `https://graph.facebook.com/${process.env.WHATSAPP_CLOUD_API_VERSION}/${mediaID}`;

      const response = await axios.get(url, this.config);
      return { status: 'success', data: response.data.url };
    } catch (error) {
      this.logger.error('Error fetching URL', error);
      return { status: 'error', data: 'Error fetching media URL' };
    }
  }

  async downloadMedia(fileID: string, messageType: string) {
    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_API_ACCESS_TOKEN}`,
      },
      responseType: 'arraybuffer',
    };

    try {
      const url = await this.getMediaUrl(fileID);
      if (url.status !== 'success') throw new Error('Failed to get media URL');

      const response = await axios.get(url.data, config);
      //save  audio file locally.
      if (messageType === 'audio') {
        const fileType = response.headers['content-type'];
        const fileExtension = fileType?.split('/')[1];
        const fileName = `${fileID}.${fileExtension}`;

        const folderName = messageType;
        const folderPath = path.join(process.cwd(), folderName);

        const filePath = path.join(folderPath, fileName);

        //check if audio file exists, if not create it .
        if (!existsSync(folderPath)) {
          mkdirSync(folderPath);
        }
        writeFileSync(filePath, response.data);
      }
      if (messageType === 'image') {
        // Upload to Cloudinary
        const cloudinaryUrl = await this.cloudinaryService.uploadBuffer(
          Buffer.from(response.data),
          'bloom'
        );
        this.logger.log('Cloudinary downloadmedia  successful:', cloudinaryUrl);

        return { status: 'success', data: cloudinaryUrl };
      }

      return { status: 'success', data: response.data };
    } catch (error) {
      this.logger.error('Error fetching URL', error);
      return { status: 'error', data: 'Error fetching media URL' };
    }
  }

  async markMessageAsRead(messageID: string) {
    const data = JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageID,
    });

    try {
      const response = this.httpService
        .post(this.url, data, this.config)
        .pipe(
          map((res) => {
            return res.data;
          }),
        )
        .pipe(
          catchError((error) => {
            this.logger.error(error);
            throw new BadRequestException('Error Marking Message As Read');
          }),
        );

      const messageStatus = await lastValueFrom(response);
      this.logger.log('Message Marked As Read. Status:', messageStatus);
    } catch (error) {
      this.logger.error(error);
      return 'Axle broke!! Abort mission!!';
    }
  }
}
