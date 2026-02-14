"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTemplate = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
const templateCache = {};
const loadTemplate = async (templateName) => {
    if (templateCache[templateName]) {
        return templateCache[templateName];
    }
    const filePath = path_1.default.join(__dirname, '..', 'templates', `${templateName}.html`);
    try {
        const fileContent = await fs_1.promises.readFile(filePath, { encoding: 'utf-8' });
        const compiledTemplate = handlebars_1.default.compile(fileContent);
        templateCache[templateName] = compiledTemplate;
        return compiledTemplate;
    }
    catch (error) {
        console.error(`Error loading template ${templateName}:`, error);
        throw error;
    }
};
exports.loadTemplate = loadTemplate;
//# sourceMappingURL=templateLoader.js.map