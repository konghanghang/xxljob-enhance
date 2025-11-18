import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { XxljobModule } from '../xxljob/xxljob.module';

@Module({
  imports: [XxljobModule],
  controllers: [HealthController],
})
export class HealthModule {}
