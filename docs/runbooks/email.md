# Email

The calendar sends a few emails: Family Password recovery, email confirmation, error reports and
summaries. They come from `EMAIL_FROM` in `wrangler.jsonc` (`calendario@phinest.org`).

Two ways to send, picked by the Worker on each email:

- **Resend** (used when the `RESEND_API_KEY` secret is set). Its free plan is far above what a
  family sends.
- **Cloudflare Email Service** (the `EMAIL` binding), used without that secret. It needs the
  Workers Paid plan.

A failed send never undoes the change that caused it; the app just reports that the email
didn't go.

## Set up Resend once

1. Create a free account at https://resend.com.
2. **Domains › Add domain** › `phinest.org`, region **Ireland (eu-west-1)**.
3. Add the DNS records Resend shows (DKIM, SPF, MX on `send.phinest.org`) in Cloudflare ›
   phinest.org › **DNS › Records**, then **Verify** in Resend.
4. **API Keys › Create API key**, permission **Sending access**, domain `phinest.org`.
5. Store it as a Worker secret:

   ```sh
   npx wrangler secret put RESEND_API_KEY
   ```

Emails go out from the next request; no redeploy is needed.

## Receiving email

Mail sent to an address at phinest.org is a separate, free Cloudflare feature: **Email Routing**
forwards it to an existing inbox.
