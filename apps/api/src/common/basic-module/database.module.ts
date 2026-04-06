// src/modules/database/database.module.ts
import { Module, Logger } from '@nestjs/common';
import knex from 'knex';
import config from 'src/config';

const logger = new Logger('DatabaseModule');

@Module({
  providers: [
    {
      provide: 'KNEX_CONNECTION',
      useFactory: async () => {
        logger.log(`Connecting to DB: ${config.db.host}:${config.db.port} / ${config.db.database} (user: ${config.db.user})`);

        const db = knex({
          client: 'pg',
          connection: {
            host: config.db.host,
            port: config.db.port,
            user: config.db.user,
            password: config.db.password,
            database: config.db.database,
            ssl: { rejectUnauthorized: false },
          },
          pool: { min: 1, max: 5 },
        });

        db.raw('SELECT 1')
          .then(() => logger.log('DB connection successful'))
          .catch((err: Error) => logger.error(`DB connection failed: ${err.message}`));

        return db;
      },
    },
  ],
  exports: ['KNEX_CONNECTION'],
})
export class DatabaseModule {}
