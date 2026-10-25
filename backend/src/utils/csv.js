function parseCsv(source) {
  source = source.replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (inQuotes) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        inQuotes = false
      } else {
        field += character
      }
      continue
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      row.push(field)
      if (row.some((value) => value.trim() !== '')) {
        rows.push(row)
      }
      row = []
      field = ''
      if (character === '\r' && source[index + 1] === '\n') {
        index += 1
      }
    } else {
      field += character
    }
  }

  if (inQuotes) {
    throw new Error('CSV contains an unclosed quoted field')
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((value) => value.trim() !== '')) {
      rows.push(row)
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = rows[0].map((header) => header.trim())
  if (new Set(headers).size !== headers.length) {
    throw new Error('CSV contains duplicate column names')
  }

  return {
    headers,
    rows: rows.slice(1).map((values, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, column) => [
        header,
        (values[column] || '').trim(),
      ])),
      extraColumn: values.length > headers.length,
    })),
  }
}

function escapeCsv(value) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) {
    text = `'${text}`
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function stringifyCsv(headers, rows) {
  return [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
  ].join('\r\n')
}

module.exports = { parseCsv, stringifyCsv }
