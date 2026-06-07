// ─────────────────────────────────────────────────────────────────────────────
// Pipedream Workflow — Europe Trip 2025 Email Parser
// Paste this entire file into a Pipedream "Code" step (Node.js)
// Required env vars: ANTHROPIC_API_KEY, GITHUB_TOKEN
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";

export default defineComponent({
  async run({ steps, $ }) {
    // ── 1. Extract email content ────────────────────────────────────────────
    const email = steps.trigger.event;
    const subject = email.subject || "";
    const body =
      email.body?.text ||
      email.snippet ||
      email.body?.html?.replace(/<[^>]+>/g, " ") ||
      "";

    if (!body && !subject) return $.flow.exit("Empty email");

    // ── 2. Parse with Claude ────────────────────────────────────────────────
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are parsing a travel confirmation email for a trip to Lausanne (July 9-12) and Nice, France (July 13-22), 2025.

Email Subject: ${subject}
Email Body: ${body.slice(0, 4000)}

Extract information and return ONLY valid JSON (no explanation, no markdown):

For restaurants/activities/hotels:
{
  "type": "restaurant|activity|accommodation|highlight|other",
  "name": "place or event name",
  "date": "YYYY-MM-DD",
  "time": "display string like '8:00 pm' or null",
  "address": "full address or null",
  "website": "URL or null",
  "confirmationNumber": "string or null",
  "notes": "important details or null",
  "skip": false
}

For flights:
{
  "type": "flight",
  "fromIATA": "3-letter code",
  "fromCity": "city name",
  "toIATA": "3-letter code",
  "toCity": "city name",
  "date": "YYYY-MM-DD",
  "time": "departure time display string or null",
  "flightNumber": "e.g. UA234 or null",
  "confirmationNumber": "string or null",
  "notes": "terminal, baggage allowance, etc. or null",
  "skip": false
}

If this is NOT a travel reservation or booking confirmation, return: {"skip": true}
If the date is outside July 9-22 2025, return: {"skip": true, "reason": "date out of range"}`,
        },
      ],
    });

    let parsed;
    try {
      parsed = JSON.parse(response.content[0].text.trim());
    } catch {
      return $.flow.exit("Claude returned non-JSON: " + response.content[0].text);
    }

    if (parsed.skip) {
      return $.flow.exit("Skipped: " + (parsed.reason || "not a reservation"));
    }

    if (!parsed.date) {
      return $.flow.exit("No date found in email");
    }

    // ── 3. Build event object ───────────────────────────────────────────────
    const eventId = "email-" + Date.now();
    let newEvent;

    if (parsed.type === "flight") {
      newEvent = {
        id: eventId,
        type: "flight",
        category: "Flight" + (parsed.flightNumber ? " · " + parsed.flightNumber : ""),
        fromIATA: parsed.fromIATA,
        fromCity: parsed.fromCity || parsed.fromIATA,
        toIATA: parsed.toIATA,
        toCity: parsed.toCity || parsed.toIATA,
        time: parsed.time || null,
        flightNumber: parsed.flightNumber || null,
        confirmationNumber: parsed.confirmationNumber || null,
        notes: parsed.notes || null,
      };
    } else {
      const catLabel = {
        restaurant: "Restaurant",
        activity: "Activity",
        accommodation: "Accommodation",
        highlight: "Highlight",
        other: "",
      }[parsed.type] || parsed.type;

      newEvent = {
        id: eventId,
        type: parsed.type,
        category: catLabel,
        name: parsed.name,
        subtitle: parsed.notes || null,
        time: parsed.time || null,
        timeLabel: null,
        address: parsed.address || null,
        appleMaps: parsed.address
          ? `https://maps.apple.com/?address=${encodeURIComponent(parsed.address)}&q=${encodeURIComponent(parsed.name)}`
          : null,
        googleMaps: parsed.address
          ? `https://www.google.com/maps/search/${encodeURIComponent(parsed.address)}`
          : null,
        website: parsed.website || null,
        menu: null,
        photo: null,
        confirmationNumber: parsed.confirmationNumber || null,
        notes: null,
      };
    }

    // ── 4. Fetch current data.json from GitHub ──────────────────────────────
    const GH_REPO = "snabbygabby/gab-assets";
    const GH_PATH = "europe-2025/data.json";
    const ghHeaders = {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "pipedream-trip-bot",
    };

    const fileRes = await fetch(
      `https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH}`,
      { headers: ghHeaders }
    );
    if (!fileRes.ok) throw new Error(`GitHub GET failed: ${fileRes.status}`);
    const fileData = await fileRes.json();

    const currentData = JSON.parse(
      Buffer.from(fileData.content.replace(/\n/g, ""), "base64").toString("utf8")
    );

    // ── 5. Find the right day and insert event ──────────────────────────────
    // For July 13 specifically, try the Nice arrival day (2025-07-13-nice) if it's a non-flight
    let added = false;
    const targetDayId = parsed.date;

    for (const dest of currentData.destinations) {
      for (const day of dest.days) {
        if (day.id === targetDayId || day.id === targetDayId + "-nice") {
          // Prefer the non-"-nice" variant unless it doesn't exist
          if (day.id === targetDayId || !currentData.destinations.flatMap(d => d.days).find(d => d.id === targetDayId)) {
            day.events.push(newEvent);
            added = true;
            break;
          }
        }
      }
      if (added) break;
    }

    if (!added) {
      return $.flow.exit(`No matching day found for ${parsed.date}`);
    }

    // ── 6. Commit updated data.json ─────────────────────────────────────────
    const updatedContent = Buffer.from(
      JSON.stringify(currentData, null, 2),
      "utf8"
    ).toString("base64");

    const commitMessage =
      parsed.type === "flight"
        ? `Add flight ${parsed.fromIATA}→${parsed.toIATA} on ${parsed.date}`
        : `Add ${parsed.name} on ${parsed.date}`;

    const putRes = await fetch(
      `https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH}`,
      {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify({
          message: commitMessage,
          content: updatedContent,
          sha: fileData.sha,
        }),
      }
    );

    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(`GitHub PUT failed: ${err.message}`);
    }

    return {
      success: true,
      added: newEvent,
      day: parsed.date,
      commit: commitMessage,
    };
  },
});
