"use client";

type MutationMessage = {
  path: string;
  at: number;
};

const CHANNEL_NAME = "nexora-realtime";
let channel: BroadcastChannel | null | undefined;

function getChannel() {
  if (channel !== undefined) return channel;
  channel =
    typeof window !== "undefined" && "BroadcastChannel" in window
      ? new BroadcastChannel(CHANNEL_NAME)
      : null;
  return channel;
}

export function publishMutation(path: string) {
  getChannel()?.postMessage({ path, at: Date.now() } satisfies MutationMessage);
}

export function subscribeToMutations(listener: (path: string) => void) {
  const active = getChannel();
  if (!active) return () => {};

  const onMessage = (event: MessageEvent<MutationMessage>) => {
    if (event.data?.path) listener(event.data.path);
  };
  active.addEventListener("message", onMessage);
  return () => active.removeEventListener("message", onMessage);
}
