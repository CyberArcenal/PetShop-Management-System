// src/modules/pets/controllers/pet.controller.js
const { sendResponse } = require('../../shared/utils/response.util');
const petService = require('../services/pet.service');
const { withTransaction } = require('../../shared/utils/transactionWrapper');

const toInt = (value) => (value !== undefined ? parseInt(value, 10) : undefined);
const getErrorStatus = (err) => {
  if (err.message.includes('not found')) return 404;
  if (err.message.includes('required')) return 400;
  return 500;
};

const extractQueryOptions = (query) => ({
  page: toInt(query.page) || 1,
  limit: toInt(query.limit) || 10,
  clientId: toInt(query.clientId),
  species: query.species,
  search: query.search,
  sortBy: query.sortBy,
  sortOrder: query.sortOrder,
});

class PetController {
  // GET /api/v1/pets
  static async getAll(req, res) {
    try {
      const options = extractQueryOptions(req.query);
      const result = await petService.findAll(options);
      sendResponse(res, 200, result, 'Pets retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/pets/:id
  static async getById(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid pet ID');
      const withClient = req.query.withClient === 'true';
      const pet = await petService.findById(id, withClient);
      sendResponse(res, 200, pet, 'Pet found');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // POST /api/v1/pets
  static async create(req, res) {
    try {
      const { clientId, name, species, breed, birthDate, weight, medicalNotes } = req.body;
      if (!clientId) throw new Error('Client ID is required');
      if (!name) throw new Error('Pet name is required');
      if (!species) throw new Error('Species is required');

      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await petService.create(req.body, currentUser, queryRunner),
        { name: 'CreatePet' }
      );
      sendResponse(res, 201, data, 'Pet created');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // PUT /api/v1/pets/:id
  static async update(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid pet ID');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await petService.update(id, req.body, currentUser, queryRunner),
        { name: 'UpdatePet' }
      );
      sendResponse(res, 200, data, 'Pet updated');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // DELETE /api/v1/pets/:id
  static async delete(req, res) {
    try {
      const id = toInt(req.params.id);
      if (isNaN(id)) throw new Error('Invalid pet ID');
      const currentUser = req.user;
      const data = await withTransaction(
        async (queryRunner) => await petService.delete(id, currentUser, queryRunner),
        { name: 'DeletePet' }
      );
      sendResponse(res, 200, data, 'Pet deleted');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }

  // GET /api/v1/pets/stats
  static async getStats(req, res) {
    try {
      const stats = await petService.getStatistics();
      sendResponse(res, 200, stats, 'Pet statistics retrieved');
    } catch (err) {
      sendResponse(res, getErrorStatus(err), null, err.message);
    }
  }
}

module.exports = PetController;