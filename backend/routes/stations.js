const express = require('express');
const router = express.Router();
const stationController = require('../controllers/stationController');

// @route   GET api/stations
router.get('/', stationController.getStations);

// @route   POST api/stations
router.post('/', stationController.addStation);

// @route   DELETE api/stations/:id
router.delete('/:id', stationController.deleteStation);

module.exports = router;
