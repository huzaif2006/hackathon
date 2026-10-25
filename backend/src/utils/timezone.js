const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function datePartsInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]))
}

function dateKeyInTimezone(date, timezone) {
  const parts = datePartsInTimezone(date, timezone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

function weekdayForDateKey(dateKey) {
  return weekdayNames[new Date(`${dateKey}T00:00:00.000Z`).getUTCDay()]
}

function zonedLocalTimeToUtc(dateKey, time, timezone) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const desiredUtcParts = Date.UTC(year, month - 1, day, hour, minute)
  let guess = desiredUtcParts

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(guess))
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
    const observedUtcParts = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    )
    guess += desiredUtcParts - observedUtcParts
  }

  return new Date(guess)
}

function monthDateKeys(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return Array.from({ length: daysInMonth }, (_, index) => (
    `${year}-${String(monthNumber).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
  ))
}

function startOfUtcDay(dateKey) {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

module.exports = {
  dateKeyInTimezone,
  monthDateKeys,
  startOfUtcDay,
  weekdayForDateKey,
  zonedLocalTimeToUtc,
}
