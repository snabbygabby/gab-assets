// kindred-calendar.jsx

import { run } from "uebersicht"

export const command = `
  ICAL=/opt/homebrew/bin/icalBuddy
  if [ -f "$ICAL" ]; then
    $ICAL \
      -b "§EVT§" \
      -iep "title,datetime,calendar" \
      -po "title,datetime,calendar" \
      -df "%Y-%m-%d" \
      -tf "%H:%M" \
      -ic "Events" \
      eventsFrom:"2026-01-01" to:"2026-12-31" 2>/dev/null
  else
    echo "NO_ICALBUDDY"
  fi
`

export const refreshFrequency = 300000

function parseEvents(output) {
  if (!output || output.includes("NO_ICALBUDDY")) return []
  const events = []
  const blocks = output.split(/§EVT§\s*/).slice(1)

  for (const block of blocks) {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean)
    if (!lines[0]) continue

    const title = lines[0].replace(/\s*\([^)]+\)\s*$/, "").trim()
    const dateLine = lines.find(l => l.match(/\d{4}-\d{2}-\d{2}/)) || ""
    const dateMatch = dateLine.match(/(\d{4}-\d{2}-\d{2})/)
    if (!dateMatch) continue

    const [year, month, day] = dateMatch[1].split("-").map(Number)
    const timeMatch = dateLine.match(/(\d{2}:\d{2})/)

    events.push({
      title, year, month, day,
      time: timeMatch ? timeMatch[1] : null,
      dateObj: new Date(year, month - 1, day),
    })
  }

  return events
}

function deleteEvent(e) {
  const dateStr = `${e.year}-${String(e.month).padStart(2,"0")}-${String(e.day).padStart(2,"0")}`

  const script = `
    tell application "Calendar"
      tell calendar "Events"
        set theEvents to (every event whose summary is "${e.title}" and start date ≥ date "${dateStr} 00:00:00" and start date ≤ date "${dateStr} 23:59:59")
        repeat with ev in theEvents
          delete ev
        end repeat
      end tell
    end tell
  `

  run(`osascript -e '${script.replace(/\n/g, " ")}'`)
}

export const className = `
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  padding: 28px 24px;
  box-sizing: border-box;
  background: transparent;
  pointer-events: none;
`

export const render = ({ output }) => {
  const events = parseEvents(output)

  return (
    <div style={{ pointerEvents: "auto", fontFamily: "-apple-system", color: "#3d2b1f" }}>
      {events.map((e, i) => (
        <div
          key={i}
          onClick={() => {
            const ref = new Date(Date.UTC(2001, 0, 1))
            const d = new Date(e.year, e.month - 1, e.day)
            const secs = Math.floor((d - ref) / 1000)
            run(`open "calshow://${secs}"`)
          }}
          style={{
            display: "flex",
            justifyContent: "space-between",
            cursor: "pointer",
            padding: "4px 0"
          }}
        >
          <span>{e.title}</span>

          <span
            onClick={(ev) => {
              ev.stopPropagation()
              deleteEvent(e)
            }}
            style={{ cursor: "pointer", opacity: 0.5 }}
          >
            ✕
          </span>
        </div>
      ))}
    </div>
  )
}
