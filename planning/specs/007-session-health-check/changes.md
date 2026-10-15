# 007 - session-health-check — Changes

## 2026-10-15 — Match cookies by site (eTLD+1) and widen the auth-name heuristic
Why: T005 on a signed-in LinkedIn profile returned `unauthenticated`: the session cookie `li_at` lives on `.www.linkedin.com`, which RFC 6265 domain-match rejects for host `linkedin.com`, and `li_at` did not match the name heuristic. "Is there a stored session for this app" is a same-site question, which browsers answer with the Public Suffix List.
- MODIFIED D2@1 → D2@2
- Tasks: T008 retires T002 (domain-match code replaced by siteOf); T009, T010 build D2@2; T011 repeats the live check
