import { HydratedDocument } from 'mongoose';
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
): Promise<HydratedDocument<UserDoc> | null> {
    //TODO:refactor to use login jwt convention
    const emailVerificationToken = jwt.sign({ email: data.email }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    const isVerified = !!data?.emailVerifiedAt;
    const newUser = new this({
        ...data,
        ...(isVerified ? { isVerified: true } : { emailVerificationToken })
    });
    const template = await loadTemplate('verifyEmail');
    // Inject dynamic data into the template
    if (!isVerified) {
        const verificationLink = `${process.env.CLIENT_URL}/verify-email/${emailVerificationToken}`
        const html = template({ verificationLink });
        const mailRequest: MailRequest = {
            to: [data.email],
            subject: 'Verify Your Email',
            html,
        };
        await emailService.sendEmail(mailRequest)
    }
    await newUser.save()
    return newUser
}