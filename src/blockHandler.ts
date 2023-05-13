import { BskyAgent} from "@atproto/api";
import {createBlock, deleteBlock, getBlocks, getFollowers, getFollowingCount} from "./api.js";
import {
    checkBlockExists,
    deleteSubscriptionBlock,
    deleteUserBlock,
    getAllSubscriptionBlocks,
    getAllUserBlocks,
    getAllUserBlocksByReason,
    getFollower,
    getSingleSubscriptionBlocks,
    getUserBlock,
    getUniqueDids,
    insertFollower,
    insertSubscriptionBlock,
    insertUserBlock,
    updateFollower
} from "./db.js";
import {Block, BlockRecord, FollowerRow, Uri, Did, ExceedsMaxFollowCountResult} from "./types";
import logger from "./logger.js";

const blockLogger = logger.child({module: 'blockHandler.ts'})

async function exceedsMaxFollowCount(agent: BskyAgent, did: Did, followLimit: number | string ): Promise<ExceedsMaxFollowCountResult> {

    let followingCount = await getFollowingCount(agent, did);
    // If followingCount is undefined, we default to zero to be safe.
    if(!followingCount) {followingCount = 0}
    const exceedsMax = followingCount > followLimit

    return {exceedsMax, followingCount}
}

async function userBlockExists(did: Did): Promise<boolean> {

    const blockExists = await checkBlockExists(did, 'blocks')
    return blockExists > 0

}

async function parseKeyFromURI (uri: Uri): Promise<string> {

        // We split the uri by / to get parts and take the
        // last element. We throw an error if the uri
        // doesn't smell like a uri
        const parts = uri.split('/')
        if(parts.length !== 5) throw new Error("at uri is malformatted. Cannot extract key.")
        if(parts[0] !== 'at:') throw new Error("uri does not begin with at:. Treating as malformatted and skipping.")

        return parts[parts.length - 1]

}

async function syncRepoUserBlockList(agent: BskyAgent, did: Did) {

    const repoUserBlocks: Block[] = await getBlocks(agent, did)
    const allUserBlocks = await getAllUserBlocks()
    if(!allUserBlocks) throw new Error("User blocks missing or corrupted in database")

    const repoUserBlocksSet = new Set(repoUserBlocks.map(block => block.value.subject))
    const allUserBlocksSet = new Set(allUserBlocks.map(block => block.did))

    try {
        if (repoUserBlocks && repoUserBlocks.length > 0) {

            blockLogger.info(`Repo has ${repoUserBlocks.length} blocks`)

            for (const block of repoUserBlocks) {
                 const record = block.value as BlockRecord

                if(record.subject) {
                    if (!allUserBlocksSet.has(record.subject)) {

                        blockLogger.info(`Repo block at ${block.uri} does not exist in the local block list.`)

                        const rkey = await parseKeyFromURI(block.uri)
                        try {
                            const profile = await agent.getProfile({actor: record.subject})
                            // const profile = await getProfile(agent, record.subject)

                            await insertUserBlock({
                                did: record.subject,
                                handle: profile.data.handle,
                                rkey: rkey,
                                reason: 'manual',
                                date_blocked: record.createdAt,
                                date_last_updated: new Date().toISOString()
                            })
                            blockLogger.info(`${record.subject} blocked.`)
                        } catch (error) {
                            blockLogger.error(`Unable to insert with error: ${error}`)
                        }
                    }
                }
            }


        }
        const allUserManualBlocks = await getAllUserBlocksByReason('manual')
        const allUserManualBlockSet = new Set(allUserManualBlocks.map(block => block.did ))
        // This might be broken
        for (const block of allUserManualBlockSet) {

            if(!repoUserBlocksSet.has(block)) {
                try {
                    logger.info(`${block}`)
                    await deleteUserBlock(block)
                } catch (error) {
                    logger.error(`Error removing orphan block from local block list. Error: ${error}`)
                }
            }
        }
    } catch(error) {
        blockLogger.error(`Error syncing with user repo: ${error}`)
    }
}

async function syncUserBlockList(agent: BskyAgent) {

    blockLogger.info('Starting user block list sync...')

    const uniqueSubscribedBlocks = await getUniqueDids('subscriptionBlocks', 'blocks')
    const orphanedUserBlocks = await getUniqueDids('blocks', 'subscriptionBlocks')

    blockLogger.info(`${uniqueSubscribedBlocks.length} new blocks from subscriptions. ${orphanedUserBlocks.length} orphaned blocks to unblock.`)

    if(uniqueSubscribedBlocks.length > 0) {
        for (const block of uniqueSubscribedBlocks) {
            try {

                const response = await createBlock(agent, block.did)
                const {data: {handle}} = await agent.getProfile({actor: block.did})

                const rkey = await parseKeyFromURI(response.data.uri)

                await insertUserBlock({did: block.did,
                    handle: handle,
                    rkey: rkey,
                    reason: 'subscription',
                    date_blocked: new Date().toISOString(),
                    date_last_updated: new Date().toISOString()} )

                blockLogger.info(`${block.did} blocked`)

            } catch (error) {
                blockLogger.error(`Unable to process blocking for ${block.did}: ${error}`)
            }
        }
    }

    if(orphanedUserBlocks.length > 0) {
        for(const block of orphanedUserBlocks) {
            try {
                const record = await getUserBlock(block.did)
                const response = await deleteBlock(agent, block.did, record.r_key)

                if (response.status == 200) {
                    await deleteUserBlock(block.did)
                    blockLogger.info(`Deleted block for ${record.did}`)
                }
            } catch(error) {
                blockLogger.error('')
            }
        }
    }

}

export interface ResolvedHandle {
    data: {
        did: Did
    }
}

async function blockSubscriptions(agent: BskyAgent, subscriptionsList: string) {

    let subscriptions = []

    if(subscriptionsList) {
        subscriptions = subscriptionsList.split(',')
    }

    blockLogger.info(`Retrieving blocks for the following users: ${subscriptions}`)

    try {
        const newSubscriptionDidsSet = new Set();
        const allSubscriptionBlocksCurrent = await getAllSubscriptionBlocks()

        if(subscriptions) {
            for (const handle of subscriptions) {

                blockLogger.info(`Requesting block list from user ${handle}`)

                const {data: {did: subscriptionDid}} = await agent.resolveHandle({handle: handle});
                const subscriptionBlocksNew: Block[] = await getBlocks(agent, subscriptionDid as Did);

                if (!subscriptionBlocksNew) {
                    throw Error
                }

                blockLogger.info(`Received block list of ${subscriptionBlocksNew.length} entries`)
                blockLogger.info(`Retrieving all subscribed block lists from the database`)

                const subscriptionBlocksCurrent = await getSingleSubscriptionBlocks(subscriptionDid as Did)
                const subscriptionBlocksCurrentSet = new Set(subscriptionBlocksCurrent.map(block => block.did))

                blockLogger.info(`Retrieved ${subscriptionBlocksCurrentSet.size} blocks from the database.`)

                for (const block of subscriptionBlocksNew) {

                    const blockDid = block.value.subject
                    newSubscriptionDidsSet.add(blockDid)

                    try {
                        const date_last_updated = new Date().toISOString();

                        if (!subscriptionBlocksCurrentSet.has(blockDid)) {
                            await insertSubscriptionBlock({
                                blocked_did: blockDid,
                                subscribed_did: subscriptionDid,
                                date_last_updated
                            });
                            blockLogger.info(`${blockDid} inserted into subscriptionBlock`)
                        } else {
                            blockLogger.info(`${blockDid} already exists in block list for ${handle}. Skipping insert.`)
                        }
                    } catch (error) {
                        blockLogger.error(`Error adding subscription block for user: ${error.message}`);
                    }
                }
            }
        }

        for (const block of allSubscriptionBlocksCurrent) {
            if(!newSubscriptionDidsSet.has(block.did)) {
                await deleteSubscriptionBlock(block.did)
                blockLogger.info(`Removed ${block.did} from subscriptionBlocks as it no longer appears in any subscription lists`)
            }
        }
    } catch (error) {
        blockLogger.error(`Error running blockSubscriptions: ${error.message}`);
    }
}

async function blockSpam(agent: BskyAgent, db: any, followLimit: string | number): Promise<void> {

    try {
        const followers = await getFollowers(agent);

        if(!followers) {
            throw Error
        }

        for (const follower of followers) {
            let followerRow = await getFollower(follower.did)

            if (!followerRow) {
                followerRow = {
                    did: follower.did,
                    handle: follower.handle,
                    following_count: 0,
                    block_status: 0,
                    date_last_updated: new Date().toISOString(),
                } as FollowerRow;

                await insertFollower({did: followerRow.did, handle: followerRow.handle, following_count: followerRow.following_count, block_status: followerRow.block_status, date_last_updated: new Date().toISOString()})
            }

            const { exceedsMax, followingCount } = await exceedsMaxFollowCount(agent, follower.did, followLimit)

            // @ts-ignore
            if (exceedsMax) {

                blockLogger.info(`Blocking ${follower.handle} who is following ${followingCount} users.`)
                const blockExists = await userBlockExists(follower.did)

                if(!blockExists) {
                    const response = await createBlock(agent, follower.did);
                    const rKey = await parseKeyFromURI(response.data.uri)
                    await insertUserBlock({
                        did: follower.did,
                        handle: follower.handle,
                        rkey: rKey,
                        reason: 'spam',
                        date_blocked: new Date().toISOString(),
                        date_last_updated: new Date().toISOString()
                    })
                    blockLogger.info(`Blocked ${follower.handle}.`)
                } else {
                    blockLogger.info(`${follower.handle} is already in block list. Updating followers table then continuing.`)
                }
                await updateFollower({did:follower.did, handle: follower.handle, following_count: followingCount, block_status: 1, date_last_updated: new Date().toISOString()})
            } else {
                blockLogger.info(`Doing nothing with ${follower.handle} who is following ${followingCount} users.`)
                await updateFollower({did:follower.did, handle: follower.handle, following_count: followingCount, block_status: 0, date_last_updated: new Date().toISOString()})
            }
        }
    } catch (error) {
        blockLogger.error(`Error running spam blocker: ${error.message}`);
    }
}

export {blockSpam, blockSubscriptions, syncUserBlockList, syncRepoUserBlockList}