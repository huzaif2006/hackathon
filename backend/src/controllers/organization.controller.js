const organizationService = require('../services/organization.service')

function createCrudController(Model) {
  return {
    list: async (_req, res) => res.json({ items: await organizationService.listRecords(Model) }),
    create: async (req, res) => {
      const item = await organizationService.createRecord(Model, req.body, req.user.userId)
      res.status(201).json({ item })
    },
    update: async (req, res) => {
      const item = await organizationService.updateRecord(Model, req.params.id, req.body, req.user.userId)
      res.json({ item })
    },
    remove: async (req, res) => {
      await organizationService.deleteRecord(Model, req.params.id, req.user.userId)
      res.status(204).end()
    },
  }
}

module.exports = { createCrudController }
