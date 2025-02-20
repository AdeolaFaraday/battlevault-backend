import jwt from 'jsonwebtoken';
import { CreateUserInputs } from "../types/userAuth";
import UserDoc from "../types/userDoc";
import UserModel from "../types/userModel";
import { MailRequest } from '../../../types/event';
import { emailService } from '../../../services/email';
import { loadTemplate } from '../../../utlis/templateLoader';

export default async function createUser(
    this: UserModel,
    data: CreateUserInputs
): Promise<UserDoc | null> {
    //TODO:refactor to use login jwt convention
    const emailVerificationToken = jwt.sign({ email: data.email }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    const newUser = new this({ ...data, emailVerificationToken });
    const template = await loadTemplate('verifyEmail');
    // Inject dynamic data into the template
    const verificationLink = `${process.env.CLIENT_URL}/verify-email/${emailVerificationToken}`
    const html = template({ verificationLink });
    const mailRequest: MailRequest = {
        to: [data.email],
        subject: 'Verify Your Email',
        html,
    };
    await emailService.sendEmail(mailRequest)
    newUser.save()
    return newUser
}