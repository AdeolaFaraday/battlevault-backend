import { AWSError } from 'aws-sdk/lib/error';
import SES, { SendEmailResponse } from 'aws-sdk/clients/ses';
import { MailRequest } from '../../types/event';
require('dotenv').config();

const region = process.env.AWS_SES_REGION;

const accessKeyId = process.env.AWS_ACCESS_KEY ?? '';
const secretAccessKey = process.env.AWS_SECRET_KEY ?? '';

const ses = new SES({
    apiVersion: '2010-12-01',
    region,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});

const sendMail = async (request: MailRequest): Promise<SendEmailResponse> => {
    const { to, subject, html } = request;
    var params = {
        Destination: {
            ToAddresses: to,
        },
        Message: {
            Body: {
                Html: {
                    Charset: 'UTF-8',
                    Data: html,
                },
            },
            Subject: {
                Charset: 'UTF-8',
                Data: subject,
            },
        },
        Source: 'Ocpus <no-reply@ocpus.io>',
        // ReplyToAddresses: ['danielezihe@punch.cool'],
    };
    return new Promise((resolve, reject) => {
        ses.sendEmail(params, (error: AWSError, data: SendEmailResponse) => {
            if (error) reject(error);
            resolve(data);
        });
    });
};

export { sendMail };