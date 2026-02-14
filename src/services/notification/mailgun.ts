import { emailService } from '../email';
import { loadTemplate } from '../../utlis/templateLoader';
import { MailRequest } from '../../types/event';

export default class TournamentNotificationService {
    static async notifyParticipants(emails: string[], tournamentTitle: string, stageName: string, warningNumber: number) {
        const template = await loadTemplate('tournamentWarning');
        const gameLink = `${process.env.CLIENT_URL}/tournaments`; // General link for now
        const html = template({
            tournamentTitle,
            stageName,
            warningNumber,
            gameLink
        });

        const mailRequest: MailRequest = {
            to: emails,
            subject: `Match Warning: ${tournamentTitle} - ${stageName}`,
            html
        };

        return emailService.sendEmail(mailRequest);
    }

    static async notifyAdminOfDelay(tournamentTitle: string, stageName: string, gameNames: string[]) {
        const template = await loadTemplate('adminAlert');
        const html = template({
            tournamentTitle,
            stageName,
            gameNames
        });

        const mailRequest: MailRequest = {
            to: ['adexconly@gmail.com'],
            subject: `URGENT: Delayed Tournament Games - ${tournamentTitle}`,
            html
        };

        return emailService.sendEmail(mailRequest);
    }
}
