# Workers AI allowance

The free plan gives 10,000 neurons a day. The Briefing (and later Voice Entry) spend them.

## Estimate

The Briefing uses `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, priced at 26,668 neurons per million
input tokens and 204,805 per million output tokens.

| Per Briefing write | Tokens | Neurons |
| ------------------ | ------ | ------- |
| Prompt (instructions + up to 40 candidates) | about 1,300 | about 35 |
| Answer (2 to 4 sentences as JSON segments) | about 250 | about 51 |
| **Total** | | **about 86** |

The daily run writes (1 + non-archived Persons) × languages in use. A Family of four Persons in
two languages writes 10, about 860 neurons. Rewrites only touch the Briefings whose next 7 days
changed, and Refresh is limited to once a minute per Briefing. About 100 writes a day fit, so
the allowance holds for one Family with room for Voice Entry.

## Checking real use

Not measured yet: the numbers above are from the model's price list, not from a deployed Worker.
Each model call logs its token counts as `briefing usage {...}`. After deploy:

1. Run `npx wrangler tail` around 05:00 Family time, or open the Worker's logs in the
   Cloudflare dashboard, and note the `prompt_tokens` and `completion_tokens` lines.
2. Compare with **AI › Workers AI** in the dashboard, which shows neurons used per day.
3. Update the table above with the measured numbers.

If use nears the allowance, Workers AI refuses further calls for the day. The Briefing then falls
back to the countdown list on its own, so nothing breaks.
