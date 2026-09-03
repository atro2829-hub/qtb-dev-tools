-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "country" TEXT,
    "address" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "trialEndsAt" DATETIME,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "organization" TEXT NOT NULL DEFAULT 'QTB DEV',
    "devName" TEXT NOT NULL DEFAULT 'Mohammed AL-QUTAIBI',
    "devEmail" TEXT NOT NULL DEFAULT 'dev@qutaibiv.com',
    "supportEmail" TEXT NOT NULL DEFAULT 'info@qutaibiv.com',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "geminiApiKey" TEXT NOT NULL DEFAULT '',
    "agentApiKey" TEXT NOT NULL DEFAULT '',
    "admobAppId" TEXT NOT NULL DEFAULT '',
    "admobBannerId" TEXT NOT NULL DEFAULT '',
    "adsenseClientId" TEXT NOT NULL DEFAULT '',
    "adsenseSlotId" TEXT NOT NULL DEFAULT '',
    "freeTrialEnabled" BOOLEAN NOT NULL DEFAULT true,
    "freeTrialDays" INTEGER NOT NULL DEFAULT 365,
    "freeDailyLimit" INTEGER NOT NULL DEFAULT 5,
    "announcement" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "iban" TEXT NOT NULL DEFAULT '',
    "swiftCode" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "instructions" TEXT NOT NULL DEFAULT '',
    "iconSvg" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SubscriptionRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'yearly',
    "bankAccountId" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "amount" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentReference" TEXT NOT NULL DEFAULT '',
    "proofFileName" TEXT NOT NULL DEFAULT '',
    "proofData" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "audience" TEXT NOT NULL DEFAULT 'all',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NotificationRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ToolJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "toolType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "sourceFormat" TEXT NOT NULL DEFAULT '',
    "targetFormat" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ToolJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRead_notificationId_userId_key" ON "NotificationRead"("notificationId", "userId");

