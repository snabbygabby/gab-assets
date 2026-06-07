# Email-in Setup Guide

Forward any reservation confirmation email → itinerary auto-updates.

---

## What you need

- A **new Gmail** for trip emails (e.g. `gabby.trip.2025@gmail.com`)
- A **free Pipedream account** at pipedream.com
- A **Claude API key** from console.anthropic.com (free tier works)
- Your **GitHub Personal Access Token** (same one you put in the page settings)

---

## Step 1 — Create the Pipedream workflow

1. Go to **pipedream.com → New Workflow**
2. **Trigger**: Select **Gmail** → "New Email" → connect your trip Gmail
3. Add a **Code step** (Node.js) and paste the code from `pipedream-workflow.js`
4. Set these **Environment Variables** in Pipedream:
   - `ANTHROPIC_API_KEY` — your Claude API key
   - `GITHUB_TOKEN` — your GitHub fine-grained PAT
5. **Deploy** the workflow

---

## Step 2 — Forward confirmations

When you get a booking confirmation email (restaurant, flight, hotel, activity), **forward it** to your trip Gmail. Within ~30 seconds:

- Claude parses the email and extracts name, date, time, address, confirmation number
- The matching day in `data.json` gets updated
- Refresh the itinerary page and the new card appears

---

## What it handles automatically

- **Restaurant reservations** — name, date, time, address, confirmation number
- **Flight confirmations** — route, flight number, departure time, confirmation number
- **Hotel / Airbnb** — check-in/out dates, address, confirmation number
- **Activity bookings** — name, date, time, address

---

## Tips

- Forward the **original** confirmation email, not a forwarded chain
- If a date isn't in the July 9–22 range, the email is skipped (no errors)
- Cards added via email won't have photos — add a photo URL manually via the ⚙ flow if you want one
- If parsing goes wrong, you can always add the event manually using the **+** button on the page
