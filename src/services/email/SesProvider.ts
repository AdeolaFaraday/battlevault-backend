// services/SesProvider.ts
import { EmailProvider } from './EmailProvider';
import { MailRequest } from '../../types/event';
import { SendEmailResponse } from 'aws-sdk/clients/ses';
import { sendMail } from '../aws/ses';

export class SesProvider implements EmailProvider {
  async sendMail(request: MailRequest): Promise<SendEmailResponse> {
    return await sendMail(request);
  }
}
