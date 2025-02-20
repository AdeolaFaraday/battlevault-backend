// di/container.ts
import { EmailService } from './EmailService';
import { SesProvider } from './SesProvider';

const emailProvider = new SesProvider();
const emailService = new EmailService(emailProvider);

export { emailService };
