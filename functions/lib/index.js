"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.tournamentNotificationCron = exports.dailyBlitzWinTracker = exports.aiOrchestrator = exports.syncGameToMongo = void 0;
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
var syncGameToMongo_1 = require("./syncGameToMongo");
Object.defineProperty(exports, "syncGameToMongo", { enumerable: true, get: function () { return syncGameToMongo_1.syncGameToMongo; } });
var aiOrchestrator_1 = require("./aiOrchestrator");
Object.defineProperty(exports, "aiOrchestrator", { enumerable: true, get: function () { return aiOrchestrator_1.aiOrchestrator; } });
var dailyBlitz_1 = require("./dailyBlitz");
Object.defineProperty(exports, "dailyBlitzWinTracker", { enumerable: true, get: function () { return dailyBlitz_1.dailyBlitzWinTracker; } });
var tournamentCron_1 = require("./tournamentCron");
Object.defineProperty(exports, "tournamentNotificationCron", { enumerable: true, get: function () { return tournamentCron_1.tournamentNotificationCron; } });
//# sourceMappingURL=index.js.map