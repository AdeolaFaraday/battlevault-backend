// services/MailgunProvider.ts
import { EmailProvider } from './EmailProvider';
import { MailRequest } from '../../types/event';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import dotenv from 'dotenv';
dotenv.config();

export class MailgunProvider implements EmailProvider {
    private mg;
    private domain: string;

    constructor() {
        const mailgun = new Mailgun(FormData);
        this.mg = mailgun.client({
            username: 'api',
            key: process.env.MAILGUN_API_KEY || 'API_KEY',
            url: "https://api.eu.mailgun.net"
        });
        this.domain = process.env.MAILGUN_DOMAIN || 'mail.battlevault.app';
    }

    async sendMail(request: MailRequest): Promise<any> {
        try {
            const data = await this.mg.messages.create(this.domain, {
                from: `BattleVault <postmaster@${this.domain}>`,
                to: request.to,
                subject: request.subject,
                html: request.html,
            });

            return data;
        } catch (error) {
            console.error('Mailgun Error:', error);
            throw error;
        }
    }
}
