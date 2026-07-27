import { setDefaultAutoSelectFamily } from "node:net";

let configured = false;

/**
 * Node's address-family autoselection gives each candidate address only a
 * short connection window. From high-latency regions that can make every Neon
 * address time out even though the endpoint is reachable. Let the first
 * resolved address use the client's normal connection timeout instead.
 */
export function configureDatabaseNetworking() {
  if (configured) return;
  setDefaultAutoSelectFamily(false);
  configured = true;
}
