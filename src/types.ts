

// Types taken from @tautologer
export type Did = string & { __did__: never };
export const isDid = (did: unknown): did is Did => typeof did === "string" && did.startsWith("did:");

export type Handle = string & { __handle__: never };
// regex to match a Fully Qualified Domain Name
const fqdnRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/;
export const isHandle = (handle: unknown): handle is Handle => typeof handle === "string" && fqdnRegex.test(handle);

export type UserIdentifier = Did | Handle;
export const isUserIdentifier = (identifier: unknown): identifier is UserIdentifier =>
    isDid(identifier) || isHandle(identifier);

export type Cid = string & { __cid__: never };
export const isCid = (cid: unknown): cid is Cid => typeof cid === "string"; // TODO i'm sure there's more we can enforce about the string

export type Uri = string & { __uri__: never };
export const isUri = (uri: unknown): uri is Uri => typeof uri === "string" && uri.startsWith("at://"); // TODO i'm sure there's more we can enforce about the string


// Homegrown types
export interface Block {
    uri: Uri,
    cid: Cid,
    value: BlockRecord
}

export interface BlockRecord {
    '$type': string,
    subject: string,
    createdAt: string,
}

export interface FollowerRow {
    did: Did,
    handle: Handle,
    following_count: number,
    block_status: number,
    date_last_updated: string
}

export interface Follower {
    did: Did,
    handle: Handle,
    displayName: string,
    description: string,
    avatar: string,
    indexedAt: string,
    viewer: FollowerView

}

export interface FollowerView {
    muted: boolean,
    blockedBy: boolean,
    followedBy: Uri
}

export interface FollowerRecord {
    did: Did,
    handle: Handle,
    following_count: number,
    block_status: number,
    date_last_updated: string
}

export interface SubscribedBlockRecord {
    blocked_did: string;
    subscribed_did: string;
    date_last_updated: string;
}

export interface ExceedsMaxFollowCountResult {
    exceedsMax: boolean,
    followingCount: number,
}


