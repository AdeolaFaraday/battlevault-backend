// di/container.ts
import { EmailService } from './EmailService';
import { MailgunProvider } from './MailgunProvider';

const emailProvider = new MailgunProvider();
const emailService = new EmailService(emailProvider);

export { emailService };
