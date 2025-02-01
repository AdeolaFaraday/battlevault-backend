import { CallbackError, Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';
import { directoryImport } from 'directory-import';
import { importFunctionsAndAppendToSchema } from '../../utlis/utlis';
import UserDoc from './types/userDoc';
import UserModel from './types/userModel';

const importedFunctions = directoryImport('./functions');


const userSchema: Schema = new Schema(
    {
        userName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 25,
        },
        firstName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 25,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 25,
        },
        avatar: {
            type: String
        },
        email: {
            type: String,
            required: true,
        },
        password: {
            type: String,
        },
        profileStatus: {
            type: String,
            default: 'ACTIVE',
            enum: ['WAITING', 'ACTIVE', 'DISABLED', 'BLACK_LISTED'],
        },
        accountStatus: { type: String },
        isVerified: {
            type: Boolean,
            default: false,
        },
        emailVerifiedAt: {
            type: Date,
            default: null,
        },
        gender: {
            type: String,
            enum: ['MALE', 'FEMALE', 'OTHER'],
        },
        lastLogin: { type: Date },
        totalGamesPlayed: { type: Number, default: 0 },
        totalWins: { type: Number, default: 0 },
        totalLosses: { type: Number, default: 0 },
        experiencePoints: { type: Number, default: 0 },
    },
    {
        toJSON: {
            transform(_: any, ret: any) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.password;
                delete ret.__v;
            },
        },
        timestamps: true,
    }
);

userSchema.pre('save', async function generateHash(next) {
    if (this.isModified('password')) {
        try {
            const hash = await bcrypt.hash(this.password as string, 10);
            this.password = hash;
        } catch (err) {
            return next(err as CallbackError);
        }
    }
    return next()
})

importFunctionsAndAppendToSchema(importedFunctions, userSchema);

const User = model<UserDoc, UserModel>('User', userSchema);

export default User;