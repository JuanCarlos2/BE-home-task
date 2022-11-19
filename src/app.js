const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const {
    getContractById,
    getContracts,
    getUnpaidJobs,
    payJob,
    depositMoney,
    bestProfession,
    clientsByPay
} = require('./controller')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * @returns contract by id
 */
app.get('/contracts/:id',getProfile,getContractById)

/**
 * @returns list of non terminated contracts
 */
app.get('/contracts',getProfile,getContracts)

/**
 * @returns list of unpaid jobs
 */
app.get('/jobs/unpaid',getProfile,getUnpaidJobs)

/**
 * pays job
 */
app.post('/jobs/:id/pay',getProfile,payJob)

/**
 * deposits money, body param deposit
 */
 app.post('/balances/deposit/:id',getProfile,depositMoney)

/**
 * @returns best profession
 */
 app.get('/admin/best-profession',getProfile,bestProfession)

 /**
 * @returns clients by pay
 */
  app.get('/admin/best-clients',getProfile,clientsByPay)
module.exports = app;
