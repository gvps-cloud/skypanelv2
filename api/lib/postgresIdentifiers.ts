import { escapeIdentifier } from "pg";

const MAX_POSTGRES_IDENTIFIER_BYTES = 63;
const SAFE_CHANNEL_NAME = /^[A-Za-z0-9_-]+$/;

function assertValidChannelName(channelName: string): void {
  if (!SAFE_CHANNEL_NAME.test(channelName)) {
    throw new Error("Invalid channel name");
  }

  if (Buffer.byteLength(channelName, "utf8") > MAX_POSTGRES_IDENTIFIER_BYTES) {
    throw new Error("Invalid channel name");
  }
}

export function buildListenCommand(channelName: string): string {
  assertValidChannelName(channelName);
  return `LISTEN ${escapeIdentifier(channelName)}`;
}

export function buildUnlistenCommand(channelName: string): string {
  assertValidChannelName(channelName);
  return `UNLISTEN ${escapeIdentifier(channelName)}`;
}
