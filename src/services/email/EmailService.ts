// services/EmailService.ts
import { EmailProvider } from './EmailProvider';
import { MailRequest } from '../../types/event';
import { SendEmailResponse } from 'aws-sdk/clients/ses';

export class EmailService {
  private provider: EmailProvider;

  constructor(provider: EmailProvider) {
    this.provider = provider;
  }

  async sendEmail(request: MailRequest): Promise<SendEmailResponse> {
    return await this.provider.sendMail(request);
  }
}
