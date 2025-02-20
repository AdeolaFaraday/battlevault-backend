// services/EmailProvider.ts
import { SendEmailResponse } from 'aws-sdk/clients/ses';
import { MailRequest } from '../../types/event';

export interface EmailProvider {
    sendMail(request: MailRequest): Promise<SendEmailResponse>;
}
