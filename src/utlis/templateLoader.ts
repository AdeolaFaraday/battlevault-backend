// utils/templateLoader.ts
import { promises as fs } from 'fs';
import path from 'path';
import handlebars from 'handlebars';

// Cache for compiled templates
const templateCache: { [key: string]: handlebars.TemplateDelegate } = {};

export const loadTemplate = async (templateName: string): Promise<handlebars.TemplateDelegate> => {
    if (templateCache[templateName]) {
        return templateCache[templateName];
    }
    const filePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);
    try {
        const fileContent = await fs.readFile(filePath, { encoding: 'utf-8' });
        const compiledTemplate = handlebars.compile(fileContent);
        templateCache[templateName] = compiledTemplate;
        return compiledTemplate;
    } catch (error) {
        console.error(`Error loading template ${templateName}:`, error);
        throw error;
    }
};
