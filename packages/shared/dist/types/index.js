"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskType = exports.DlqStatus = exports.LogLevel = exports.TaskStatus = void 0;
// Re-export Prisma types
var client_1 = require("@prisma/client");
Object.defineProperty(exports, "TaskStatus", { enumerable: true, get: function () { return client_1.TaskStatus; } });
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return client_1.LogLevel; } });
Object.defineProperty(exports, "DlqStatus", { enumerable: true, get: function () { return client_1.DlqStatus; } });
// Task types enum
var TaskType;
(function (TaskType) {
    TaskType["API_CALL"] = "api-call";
    TaskType["DATABASE_OPERATION"] = "database-operation";
    TaskType["FILE_PROCESSING"] = "file-processing";
    TaskType["EMAIL_SEND"] = "email-send";
    TaskType["DATA_TRANSFORMATION"] = "data-transformation";
    TaskType["WEBHOOK_CALL"] = "webhook-call";
    TaskType["REPORT_GENERATION"] = "report-generation";
    TaskType["DATA_CLEANUP"] = "data-cleanup";
    TaskType["HEALTH_CHECK"] = "health-check";
    TaskType["SYSTEM_MAINTENANCE"] = "system-maintenance";
    TaskType["BACKUP_OPERATION"] = "backup-operation";
    TaskType["CACHE_REFRESH"] = "cache-refresh";
})(TaskType || (exports.TaskType = TaskType = {}));
