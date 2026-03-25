// src/modules/database/database.module.ts
import { Module } from '@nestjs/common';
import knex from 'knex';
import config from 'src/config';

@Module({
  providers: [
    {
      provide: 'KNEX_CONNECTION',
      useFactory: async () => {
        return knex({
          client: 'pg',
          connection: {
            host: config.db.host,
            port: config.db.port,
            user: config.db.user,
            password: config.db.password,
            database: config.db.database,
          },
          pool: { min: 3, max: 10 },
        });
      },
    },
  ],
  exports: ['KNEX_CONNECTION'],
})
export class DatabaseModule {}
