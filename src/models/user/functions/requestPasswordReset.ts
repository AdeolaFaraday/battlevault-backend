import jwt from 'jsonwebtoken';
import UserModel from '../types/userModel';
import { MailRequest } from '../../../types/event';
import { emailService } from '../../../services/email';
import { loadTemplate } from '../../../utlis/templateLoader';

const PASSWORD_RESET_EXPIRY_HOURS = 1;

export interface RequestPasswordResetResult {
    success: boolean;
    message: string;
}

export default async function requestPasswordReset(
    this: UserModel,
    data: { email: string }
): Promise<RequestPasswordResetResult> {
    const { email } = data;

    // Find user by email
    const user = await this.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration attacks
    if (!user) {
        return {
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent.',
        };
    }

    // Generate password reset token
    const passwordResetToken = jwt.sign(
        { email: user.email, purpose: 'password-reset' },
        process.env.JWT_SECRET as string,
        { expiresIn: `${PASSWORD_RESET_EXPIRY_HOURS}h` }
    );

    // Calculate expiry date
    const passwordResetExpires = new Date();
    passwordResetExpires.setHours(passwordResetExpires.getHours() + PASSWORD_RESET_EXPIRY_HOURS);

    // Save token to user
    user.passwordResetToken = passwordResetToken;
    user.passwordResetExpires = passwordResetExpires;
    await user.save();

    // Load and send email
    const template = await loadTemplate('forgotPassword');
    const resetLink = `${process.env.CLIENT_URL}/reset-password/${passwordResetToken}`;
    const html = template({ resetLink });

    const mailRequest: MailRequest = {
        to: [user.email],
        subject: 'Reset Your Password - BattleVault',
        html,
    };

    await emailService.sendEmail(mailRequest);

    return {
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
    };
}
