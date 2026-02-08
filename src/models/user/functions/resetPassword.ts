import jwt from 'jsonwebtoken';
import UserModel from '../types/userModel';

export interface ResetPasswordResult {
    success: boolean;
    message: string;
}

interface PasswordResetTokenPayload {
    email: string;
    purpose: string;
    iat: number;
    exp: number;
}

export default async function resetPassword(
    this: UserModel,
    data: { token: string; newPassword: string }
): Promise<ResetPasswordResult> {
    const { token, newPassword } = data;

    // Validate password length
    if (!newPassword || newPassword.length < 8) {
        return {
            success: false,
            message: 'Password must be at least 8 characters long.',
        };
    }

    // Verify JWT token
    let decoded: PasswordResetTokenPayload;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET as string) as PasswordResetTokenPayload;
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return {
                success: false,
                message: 'Password reset link has expired. Please request a new one.',
            };
        }
        return {
            success: false,
            message: 'Invalid password reset link.',
        };
    }

    // Verify token purpose
    if (decoded.purpose !== 'password-reset') {
        return {
            success: false,
            message: 'Invalid password reset link.',
        };
    }

    // Find user by email and matching token
    const user = await this.findOne({
        email: decoded.email,
        passwordResetToken: token,
    });

    if (!user) {
        return {
            success: false,
            message: 'Invalid password reset link or link has already been used.',
        };
    }

    // Check if token has expired (database-level check)
    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
        return {
            success: false,
            message: 'Password reset link has expired. Please request a new one.',
        };
    }

    // Update password and clear reset token fields
    user.password = newPassword; // Will be hashed by pre-save middleware
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return {
        success: true,
        message: 'Password has been reset successfully. You can now login with your new password.',
    };
}
