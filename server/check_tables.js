const { sequelize } = require('./src/models');
sequelize.getQueryInterface().showAllSchemas().then(tables => {
    console.log('Tables:', tables);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
