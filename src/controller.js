const { Op } = require('sequelize');

const getContractById = async (req, res) => {
    const {Contract} = req.app.get('models')
    const {id} = req.params
    const {id: profile_id} = req.profile
    const contract = await Contract.findOne({
        where: {
            id,
            [Op.or]: [
                {ContractorId: profile_id},
                {ClientId: profile_id}
            ]
        }
    })
    if(!contract) return res.status(404).end()
    res.json(contract)
}

const getContracts = async (req, res) => {
    const {Contract} = req.app.get('models')
    const {id: profile_id} = req.profile
    const contracts = await Contract.findAll({
        where: {
            status: {
                [Op.ne]: 'terminated'
            },
            [Op.or]: [
                {ContractorId: profile_id},
                {ClientId: profile_id}
            ],

        }
    })
    res.json(contracts)
}

const getUnpaidJobs = async (req, res) => {
    const {Contract, Job} = req.app.get('models')
    const {id: profile_id} = req.profile
    const jobs = await Job.findAll({
        where: {
            paid: {
                [Op.not]: true
            }
        },
        include: {
            attributes: [],
            model: Contract,
            where: {
                status: 'in_progress',
                [Op.or]: [
                    {ContractorId: profile_id},
                    {ClientId: profile_id}
                ],
            }
        }
    })

    res.json(jobs)
}

const payJob = async (req, res) => {
    const {Contract, Job, Profile} = req.app.get('models')
    const sequelize = req.app.get('sequelize')
    const {id} = req.params
    const t = await sequelize.transaction();
    try {
        const job = await Job.findOne({
            where: {
                id,
                paid: {
                    [Op.not]: true
                }
            },
            include: {
                model: Contract,
                where: {
                    ClientId: req.profile.id,
                }
            },
            transaction: t
        })
        if(!job) throw new Error('job not found')
        if (job.price > req.profile.balance) throw new Error('insufficient balance')
        await Profile.decrement({
            balance: job.price
        }, {
            where: {
                id: req.profile.id
            },
            transaction: t
        })
        await Profile.increment({
            balance: job.price
        }, {
            where: {
                id: job.Contract.ContractorId
            },
            transaction: t
        })
        await Job.update({
            paid: true
        }, {
            where: {
                id
            },
            transaction: t
        })
        await t.commit();
    } catch (e) {
        await t.rollback();
        return res.status(409).end()
    }
    res.json({})
}

const depositMoney = async (req, res) => {
    const {Contract, Job, Profile} = req.app.get('models')
    const sequelize = req.app.get('sequelize')
    const {id} = req.params
    const {deposit} = req.body
    const profile = await Profile.findOne({
        where: { id }
    })
    if(!profile || !deposit) return res.status(404).end()
    const t = await sequelize.transaction();
    try {
        const jobs = await Job.findAll({
            where: {
                paid: {
                    [Op.not]: true
                }
            },
            include: {
                model: Contract,
                where: {
                    ClientId: profile.id,
                }
            },
            transaction: t
        })
        const jobsDebt = jobs.reduce((prev, current) => prev + current.price, 0)
        if (deposit > jobsDebt * 0.25) throw new Error('invalid deposit')

        await Profile.increment({
            balance: deposit
        }, {
            where: {
                id: profile.id
            },
            transaction: t
        })
        await t.commit();
    } catch (e) {
        await t.rollback();
        return res.status(409).end()
    }
    res.json({})
}

const bestProfession = async (req, res) => {
    const {Contract, Job, Profile} = req.app.get('models')
    const {start, end} = req.query
    const contractor = {}
    const jobs = await Job.findAll({
        where: {
            paid: true,
            paymentDate: {
                [Op.between]: [start, end]
            }
        },
        include: {
            model: Contract,
        },
    })
    for (const job of jobs) {
        if (contractor[job.Contract.ContractorId]) {
            contractor[job.Contract.ContractorId] += job.price
        } else {
            contractor[job.Contract.ContractorId] = job.price
        }
    }
    let highestContractor;
    let highestIncome;
    for (const key in contractor) {
        if(!highestContractor || contractor[key] > highestIncome){
            highestContractor = key
            highestIncome = contractor[key]
        }
    }
    const profile = await Profile.findOne({
        where: {
            id: highestContractor
        }
    })

    res.json(profile)
}

const clientsByPay = async (req, res) => {
    const {Contract, Job } = req.app.get('models')
    const {start, end, limit = 2} = req.query
    const client = {}
    const jobs = await Job.findAll({
        where: {
            paid: true,
            paymentDate: {
                [Op.between]: [start, end]
            }
        },
        include: {
            model: Contract,
        },
    })
    for (const job of jobs) {
        if (client[job.Contract.ClientId]) {
            client[job.Contract.ClientId] += job.price
        } else {
            client[job.Contract.ClientId] = job.price
        }
    }
    const clients = Object.entries(client).map(([client_id, paid]) => ({client_id,paid}));
    const orderedClients = _.orderBy(clients, 'paid', 'desc');
    res.json(orderedClients.slice(0, limit))
}

module.exports = {
    getContractById,
    getContracts,
    getUnpaidJobs,
    payJob,
    depositMoney,
    bestProfession,
    clientsByPay
}