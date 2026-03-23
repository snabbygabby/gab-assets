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

const MONTHS = [
  "January","February","March","April",
  "May","June","July","August",
  "September","October","November","December"
]
const SHORT_MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec"
]
const DAY_HEADERS = ["S","M","T","W","T","F","S"]

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

// ✨ DELETE EVENT HELPER
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

function getDaysInMonth(year, month) { return new Date(year, month, 0).getDate() }
function getFirstDayOfMonth(year, month) { return new Date(year, month - 1, 1).getDay() }

export const className = `
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  padding: 28px 24px;
  box-sizing: border-box;
  background: transparent;
  pointer-events: none;
  user-select: none;
  font-family: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
  color: #3d2b1f;
`

const C = {
  cardBg: "rgba(242, 228, 208, 0.52)",
  cardBorder: "rgba(185, 148, 108, 0.2)",
  monthLabel: "#8a6a50",
  monthActive: "#8b3a22",
  dayText: "rgba(55, 35, 15, 0.75)",
  dayHeader: "rgba(100, 70, 50, 0.42)",
  todayBg: "#8b3a22",
  todayText: "#fff",
  dotColor: "#8b3a22",
  eventBg: "rgba(139, 58, 34, 0.07)",
  eventBorder: "rgba(139, 58, 34, 0.25)",
  eventDate: "#8b3a22",
  eventTitle: "#3d2b1f",
  divider: "rgba(185, 148, 108, 0.22)",
  pastOpacity: 0.35,
}

function MonthCard({ monthIndex, year, currentMonth, currentDay, eventMap }) {
  const monthNum = monthIndex + 1
  const daysInMonth = getDaysInMonth(year, monthNum)
  const firstDay = getFirstDayOfMonth(year, monthNum)
  const isCurrentMonth = monthNum === currentMonth
  const monthEvents = (eventMap[monthNum] || []).sort((a, b) => a.day - b.day)

  const cells = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{ background: C.cardBg, borderRadius: "12px", padding: "8px" }}>
      <div style={{ fontSize: "8px", fontWeight: "700", color: isCurrentMonth ? C.monthActive : C.monthLabel }}>
        {MONTHS[monthIndex]}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {DAY_HEADERS.map((d, i) => (
          <div key={i} style={{ fontSize: "6px", textAlign: "center", color: C.dayHeader }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />
          const isToday = isCurrentMonth && day === currentDay
          const hasEvent = !!(eventMap[monthNum]?.find(e => e.day === day))

          return (
            <div key={idx} style={{ textAlign: "center" }}>
              <div style={{
                fontSize: "7px",
                background: isToday ? C.todayBg : "transparent",
                color: isToday ? "#fff" : C.dayText,
                borderRadius: "50%"
              }}>{day}</div>
              {hasEvent && <div style={{ width: "3px", height: "3px", background: C.dotColor, margin: "auto" }} />}
            </div>
          )
        })}
      </div>

      {monthEvents.map((e, i) => (
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
            pointerEvents: "auto"
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

export const render = ({ output }) => {
  const events = parseEvents(output)
  const now = new Date()

  const eventMap = {}
  events.forEach(e => {
    if (!eventMap[e.month]) eventMap[e.month] = []
    eventMap[e.month].push(e)
  })

  return (
    <div style={{ display: "flex", pointerEvents: "auto", gap: "10px" }}>
      {MONTHS.map((_, i) => (
        <MonthCard
          key={i}
          monthIndex={i}
          year={now.getFullYear()}
          currentMonth={now.getMonth() + 1}
          currentDay={now.getDate()}
          eventMap={eventMap}
        />
      ))}
    </div>
  )
}

