// Site (registrable domain, eTLD+1) of a host per the Public Suffix List (spec 007 D2).
// The only file that imports `tldts`.
import { getDomain } from "tldts";

// Hosts without a registrable domain (localhost, IPs, bare public suffixes) are their own site.
export function siteOf(host: string): string {
  const bare = host.replace(/^\./, "").toLowerCase();
  return getDomain(bare, { allowPrivateDomains: true }) ?? bare;
}
