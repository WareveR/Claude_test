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

Resend only sends; it has no inbox. Mail sent to an address at phinest.org is a separate, free
Cloudflare feature, **Email Routing**, which forwards it to an existing inbox:

1. Cloudflare › phinest.org › **Email › Email Routing** › enable it and accept the DNS records it
   adds.
2. **Routing rules › Create address** for each address (`info@`, `calendario@`, a personal one)
   with the destination inbox. Cloudflare sends a confirmation to that inbox once.
3. Optionally turn on **Catch-all** to forward any other address at phinest.org.

## Sending personal mail as an address at phinest.org

Gmail can send as `info@phinest.org` through Resend's SMTP server:

1. In Resend, **API Keys › Create API key** named `gmail`, **Sending access**, domain
   `phinest.org`. Use a separate key from the Worker's, so either can be replaced alone.
2. In Gmail, **Settings › Accounts › Send mail as › Add another email address**:
   - SMTP server `smtp.resend.com`, port `465`, SSL
   - username `resend` (that word, not an email address)
   - password: the API key from step 1
3. Gmail emails a confirmation code to the new address; it arrives through Email Routing.

Everything sent this way counts against the same Resend quota as the calendar's emails.
