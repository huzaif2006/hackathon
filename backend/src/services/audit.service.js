const mongoose = require('mongoose')
const AuditLog = require('../models/audit-log.model')
const AppError = require('../utils/app-error')

function sanitize(value) {
  if (value === null || value === undefined) return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof mongoose.Types.ObjectId) return value.toString()
  if (Array.isArray(value)) return value.map(sanitize)
  if (typeof value !== 'object') return value

  const source = typeof value.toObject === 'function' ? value.toObject() : value
  return Object.fromEntries(Object.entries(source)
    .filter(([key]) => !/(password|token|secret|credential|authorization)/i.test(key))
    .map(([key, child]) => [key, sanitize(child)]))
}

async function logAction({ actor, action, entityType, entityId, before = null, after = null, session }) {
  if (!actor) throw new Error('Audit action requires an actor')
  const [entry] = await AuditLog.create([{
    actor,
    action,
    entityType,
    entityId: String(entityId),
    before: sanitize(before),
    after: sanitize(after),
  }], session ? { session } : undefined)
  return entry
}

async function listAuditLogs(filters) {
  const query = {}
  if (filters.action) query.action = filters.action
  if (filters.entityType) query.entityType = filters.entityType
  if (filters.actor) query.actor = filters.actor
  if (filters.from || filters.to) {
    query.createdAt = {
      ...(filters.from ? { $gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
      ...(filters.to ? { $lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
    }
  }
  const skip = (filters.page - 1) * filters.limit
  const [items, total] = await Promise.all([
    AuditLog.find(query)
      .select('-__v')
      .populate('actor', 'name email role')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(filters.limit)
      .lean(),
    AuditLog.countDocuments(query),
  ])
  return {
    items,
    pagination: { page: filters.page, limit: filters.limit, total, pages: Math.ceil(total / filters.limit) },
  }
}

async function getRecentAuditLogs(limit = 10) {
  return AuditLog.find()
    .select('-__v')
    .populate('actor', 'name email role')
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
}

module.exports = { getRecentAuditLogs, listAuditLogs, logAction, sanitize }
