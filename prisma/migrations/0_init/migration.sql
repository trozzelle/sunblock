-- CreateTable
CREATE TABLE "Blocks" (
    "did" TEXT NOT NULL PRIMARY KEY,
    "handle" TEXT NOT NULL,
    "rKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "dateBlocked" TEXT NOT NULL,
    "dateLastUpdated" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Followers" (
    "follower" TEXT NOT NULL PRIMARY KEY,
    "handle" TEXT NOT NULL,
    "followingCount" INTEGER NOT NULL,
    "blockStatus" INTEGER NOT NULL,
    "dateLastUpdated" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SubscriptionBlocks" (
    "did" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "dateLastUpdated" TEXT NOT NULL,

    PRIMARY KEY ("author", "did")
);

-- CreateTable
CREATE TABLE "Subscriptions" (
    "author" TEXT NOT NULL PRIMARY KEY,
    "handle" TEXT NOT NULL,
    "blockCount" INTEGER NOT NULL,
    "dateAdded" TEXT NOT NULL,
    "dateLastUpdated" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Blocks_did_key" ON "Blocks"("did");

-- CreateIndex
CREATE UNIQUE INDEX "Followers_follower_key" ON "Followers"("follower");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriptions_author_key" ON "Subscriptions"("author");

